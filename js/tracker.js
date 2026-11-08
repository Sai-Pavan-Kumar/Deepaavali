// Webcam hand tracking. Loads MediaPipe lazily (only when a mode opens) and feeds
// the same hands/bus contract the pointer uses, so modes never know the source.
import { hands, setHand, emitGesture, setTracking } from './hands.js?v=14';

const VISION_VERSION = '1.2.2'; // verified on npm, Nov 2026
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task';

const GESTURE_NAMES = {
  Pointing_Up: 'victory',
  Thumb_Up: 'thumbsUp',
  Closed_Fist: 'fist',
  ILoveYou: 'iLoveYou',
};
const HOLD_MS = 1500; // Strict 1.5s lock for single-hand gestures
const NAMASTE_HOLD_MS = 1000; // 1.0s lock for Namaskaram: responsive, zero fatigue, stable
const COOLDOWN_AFTER_FIRE_MS = 1400; // 1.4s post-fire breather: prevents accidental triggers when relaxing hand
const LOST_MS = 450;
const SMOOTHING = 0.55; // EMA weight of the newest frame: lower = smoother, higher = snappier

let recognizer = null;
let running = false;
let lastVideoTime = -1;
let lastInferenceTime = 0;
const gestureCooldownUntil = { left: 0, right: 0, special: 0 }; // Per-hand post-fire pause: one hand never blocks the other
const INFERENCE_INTERVAL_MS = 1000 / 30; // 30 fps cap for MediaPipe inference on mobile/laptops
const perSide = { left: makeSideState(), right: makeSideState() };
const special = {
  namasteSince: 0,
  lastSeenNamaste: 0,
  namasteFired: false,
  visphotSince: 0,
  lastSeenVisphot: 0,
  visphotFired: false,
  isDoubleFist: false,
};

function makeSideState() {
  return {
    smooth: null,
    seenAt: 0,
    raw: null,
    candidate: null,
    candidateSince: 0,
    lastSeenCandidate: 0,
    holdProgress: 0,
    unlocked: null,
    fired: null,
    lastWrist: null,
  };
}

export async function startTracker(video, onStatus) {
  if (running) return;
  running = true;
  try {
    if (!recognizer) {
      onStatus('loading');
      const { FilesetResolver, GestureRecognizer } = await import(`${VISION_URL}/vision_bundle.mjs`);
      const files = await FilesetResolver.forVisionTasks(`${VISION_URL}/wasm`);
      const options = (delegate) => ({ baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numHands: 2 });
      recognizer = await GestureRecognizer.createFromOptions(files, options('GPU')).catch(() => GestureRecognizer.createFromOptions(files, options('CPU')));
    }
    onStatus('live');
    setTracking(true);
    loop(video);
  } catch (err) {
    running = false;
    onStatus('failed');
    console.warn('Hand tracking unavailable, touch/mouse still works.', err);
  }
}

export function stopTracker() {
  running = false;
  setTracking(false);
  hands.special = null;
  hands.namasteProgress = 0;
  hands.visphotProgress = 0;
  special.namasteSince = 0;
  special.lastSeenNamaste = 0;
  special.namasteFired = false;
  special.visphotSince = 0;
  special.lastSeenVisphot = 0;
  special.visphotFired = false;
  special.isDoubleFist = false;
  gestureCooldownUntil.left = 0;
  gestureCooldownUntil.right = 0;
  gestureCooldownUntil.special = 0;
  ['left', 'right'].forEach((side) => {
    perSide[side].candidate = null;
    perSide[side].holdProgress = 0;
    perSide[side].unlocked = null;
    perSide[side].fired = null;
    setHand(side, { gesture: null, candidate: null, holdProgress: 0 });
  });
}

function loop(video) {
  if (!running) return;
  const now = performance.now();
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastInferenceTime >= INFERENCE_INTERVAL_MS) {
    lastVideoTime = video.currentTime;
    lastInferenceTime = now;
    handleResult(recognizer.recognizeForVideo(video, now), video);
  }
  requestAnimationFrame(() => loop(video));
}

// The stage is a cover-fit crop of the video; map mirrored video coords into stage coords.
function toStage(p, video) {
  const stage = video.parentElement.getBoundingClientRect();
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const sw = stage.width || 1280;
  const sh = stage.height || 720;
  const va = vw / vh;
  const sa = sw / sh;
  let x = 1 - p.x;
  let y = p.y;
  if (va > sa) x = (x - 0.5) * (va / sa) + 0.5;
  else y = (y - 0.5) * (sa / va) + 0.5;
  return { x, y, z: p.z };
}

function sideFor(result, index) {
  if (result.landmarks.length === 2) {
    const x0 = 1 - result.landmarks[0][0].x;
    const x1 = 1 - result.landmarks[1][0].x;
    if (Math.abs(x0 - x1) < 0.02) {
      // Hands are overlapping/touching in center: assign distinct sides deterministically:
      return index === 0 ? 'left' : 'right';
    }
    return (1 - result.landmarks[index][0].x < 1 - result.landmarks[1 - index][0].x) ? 'left' : 'right';
  }
  return result.handedness[index]?.[0]?.categoryName === 'Left' ? 'left' : 'right';
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function classifyHand(lm, top) {
  if (!lm || lm.length < 21) return null;
  const w = lm[0]; // wrist

  const dIndexTip = dist(lm[8], w);
  const dIndexPip = dist(lm[6], w);
  const dMidTip = dist(lm[12], w);
  const dMidPip = dist(lm[10], w);
  const dRingTip = dist(lm[16], w);
  const dRingPip = dist(lm[14], w);
  const dPinkyTip = dist(lm[20], w);
  const dPinkyPip = dist(lm[18], w);

  const indexExt = dIndexTip > dIndexPip * 1.15;
  const midExt = dMidTip > dMidPip * 1.15;
  const ringExt = dRingTip > dRingPip * 1.15;
  const pinkyExt = dPinkyTip > dPinkyPip * 1.15;

  const indexCurl = dIndexTip < dIndexPip * 1.05;
  const midCurl = dMidTip < dMidPip * 1.05;
  const ringCurl = dRingTip < dRingPip * 1.05;
  const pinkyCurl = dPinkyTip < dPinkyPip * 1.05;

  // Thumb extension:
  const thumbOut = dist(lm[4], lm[9]) > dist(lm[2], lm[9]) * 1.25;

  const topCategory = top && top.score > 0.55 ? top.categoryName : null;

  // 1. Index Point Up (☝️): index extended pointing up, other 3 fingers curled into palm
  if ((topCategory === 'Pointing_Up' && !midExt && !ringExt && !pinkyExt) ||
      (indexExt && midCurl && ringCurl && pinkyCurl && lm[8].y < lm[6].y)) {
    return 'victory';
  }

  // 2. I Love You (🤟): thumb out, index extended, pinky extended, middle & ring curled
  if ((topCategory === 'ILoveYou' && midCurl && ringCurl) ||
      (thumbOut && indexExt && pinkyExt && midCurl && ringCurl)) {
    return 'iLoveYou';
  }

  // Check if all 4 non-thumb fingers are curled into the palm:
  const allCurled = (indexCurl && midCurl && ringCurl && pinkyCurl) ||
                    (topCategory === 'Closed_Fist' || topCategory === 'Thumb_Up');

  if (allCurled && !indexExt && !midExt && !ringExt && !pinkyExt) {
    // Thumbs Up (👍) requires the thumb to stick distinctly UP into the air above the fist:
    // - Thumb tip (4) must be higher (smaller y) than index PIP (6) and middle PIP (10) by a clear margin
    // - Thumb tip (4) must be higher than thumb IP joint (3)
    // - Thumb must be extended away from its base (2)
    const isThumbUp = lm[4].y < lm[3].y &&
                      lm[4].y < lm[6].y - 0.035 &&
                      lm[4].y < lm[10].y - 0.035 &&
                      dist(lm[4], lm[2]) > dist(lm[3], lm[2]) * 1.2;

    if (isThumbUp && topCategory !== 'Closed_Fist') {
      return 'thumbsUp';
    }

    // Otherwise, thumb is folded across the fingers -> Closed Fist (✊)!
    return 'fist';
  }

  // NOTE: openPalm (Bhoo Chakram) is removed completely per user request so it never conflicts with Namaskaram

  return null;
}

function handleResult(result, video) {
  const now = performance.now();
  const seen = new Set();
  result.landmarks.forEach((raw, i) => {
    const side = sideFor(result, i);
    if (seen.has(side)) return;
    seen.add(side);
    const state = perSide[side];
    const mapped = raw.map((p) => toStage(p, video));
    state.smooth = state.smooth && now - state.seenAt < LOST_MS
      ? state.smooth.map((s, k) => ({ x: s.x + (mapped[k].x - s.x) * SMOOTHING, y: s.y + (mapped[k].y - s.y) * SMOOTHING, z: mapped[k].z }))
      : mapped;
    state.seenAt = now;
    const top = result.gestures[i]?.[0];
    state.raw = classifyHand(state.smooth, top);
  });

  ['left', 'right'].forEach((side) => {
    if (!seen.has(side) && now - perSide[side].seenAt > LOST_MS) {
      // If this hand is currently driven by mouse/touch fallback, keep it visible:
      if (hands[side].landmarks === null && (hands.lastPointerTime || 0) > 0) return;
      perSide[side].raw = null;
      perSide[side].candidate = null;
      perSide[side].holdProgress = 0;
      perSide[side].unlocked = null;
      perSide[side].fired = null;
      setHand(side, { ...hands[side], visible: false, landmarks: null, gesture: null, candidate: null, holdProgress: 0 });
    }
  });

  // Evaluate dual-hand specials (Namaskaram, Double Fist Maha Visphot) first:
  detectSpecials(now);

  const isDoubleFist = special.isDoubleFist;
  const isNamasteActive = (hands.namasteProgress > 0) || (hands.special === 'namaskaram');
  ['left', 'right'].forEach((side) => {
    if (!seen.has(side)) return;
    const state = perSide[side];
    // If double fist or namaskaram is active, suppress single hand gesture tracking and emission:
    const effectiveGesture = ((isDoubleFist && state.raw === 'fist') || isNamasteActive) ? null : state.raw;
    trackGesture(side, state, effectiveGesture, now);
    const anchor = state.smooth[9];
    setHand(side, {
      x: anchor.x,
      y: anchor.y,
      landmarks: state.smooth,
      gesture: (isDoubleFist || isNamasteActive) ? null : state.unlocked,
      candidate: (isDoubleFist || isNamasteActive) ? null : state.candidate,
      holdProgress: (isDoubleFist || isNamasteActive) ? 0 : state.holdProgress,
    });
  });
}

function trackGesture(side, state, rawGesture, now) {
  // If in post-fire cooldown for THIS hand (or special cooldown), pause candidate locking:
  if (now < (gestureCooldownUntil[side] || 0) || now < (gestureCooldownUntil.special || 0)) {
    state.candidate = null;
    state.holdProgress = 0;
    state.unlocked = null;
    return;
  }

  // Grace tolerance for 1-2 frame jitter (<120ms):
  if (!rawGesture && state.candidate && now - state.lastSeenCandidate < 120) {
    rawGesture = state.candidate;
  } else if (rawGesture) {
    state.lastSeenCandidate = now;
  }

  // If gesture changed:
  if (rawGesture !== state.candidate) {
    // If we were continuously firing victory (rockets) and now stopped, apply cooldown to this hand:
    if (state.unlocked === 'victory' && rawGesture !== 'victory') {
      gestureCooldownUntil[side] = now + COOLDOWN_AFTER_FIRE_MS;
    }
    state.candidate = rawGesture;
    state.candidateSince = now;
    state.holdProgress = 0;
    state.unlocked = null;
    state.fired = null;
    return;
  }

  // Gesture must be held steadily for >= 1.5s to unlock!
  if (rawGesture) {
    const elapsed = now - state.candidateSince;
    state.holdProgress = Math.min(1, elapsed / HOLD_MS);

    if (elapsed >= HOLD_MS) {
      state.unlocked = rawGesture;
      if (state.fired !== rawGesture) {
        state.fired = rawGesture;
        const p = state.smooth[9];
        const thumb = state.smooth[4];
        emitGesture(rawGesture, { side, x: thumb.x, y: thumb.y, palmX: p.x, palmY: p.y, landmarks: state.smooth });

        // One-shot gestures trigger post-fire cooldown immediately for THIS hand:
        if (rawGesture !== 'victory') {
          gestureCooldownUntil[side] = now + COOLDOWN_AFTER_FIRE_MS;
          state.candidate = null;
          state.holdProgress = 0;
        }
      }
    } else {
      state.unlocked = null;
    }
  } else {
    state.holdProgress = 0;
    state.unlocked = null;
  }
}

function checkNamaste(L, R) {
  if (!L || !R) return false;

  // 1. Both hands must be pointing upwards (fingertips above wrists):
  // 0 = wrist, 12 = middle tip, 8 = index tip
  const leftFingersUp = L[12].y < L[0].y && L[8].y < L[0].y;
  const rightFingersUp = R[12].y < R[0].y && R[8].y < R[0].y;
  if (!leftFingersUp || !rightFingersUp) return false;

  // 2. Both hands must have fingers extended (not curled into fists):
  const leftExt = dist(L[12], L[0]) > dist(L[10], L[0]) * 1.05;
  const rightExt = dist(R[12], R[0]) > dist(R[10], R[0]) * 1.05;
  if (!leftExt || !rightExt) return false;

  // 3. Proximity: hands joined in prayer pose
  const wristDist = dist(L[0], R[0]);
  const palmDist = dist(L[9], R[9]);
  const midTipDist = dist(L[12], R[12]);
  const indexTipDist = dist(L[8], R[8]);

  // Fingertips touching/close OR palms touching/close:
  const tipsClose = midTipDist < 0.28 || indexTipDist < 0.28;
  const palmsClose = palmDist < 0.30;
  const wristsClose = wristDist < 0.38;

  // Vertical alignment: wrists and tips are at similar heights:
  const yAlign = Math.abs(L[0].y - R[0].y) < 0.25 && Math.abs(L[12].y - R[12].y) < 0.25;

  // Horizontal alignment: hands are centered near each other:
  const xAlign = Math.abs(L[9].x - R[9].x) < 0.30;

  return (tipsClose || palmsClose) && wristsClose && yAlign && xAlign;
}

function detectSpecials(now) {
  const L = perSide.left.smooth;
  const R = perSide.right.smooth;
  const both = L && R && now - perSide.left.seenAt < LOST_MS && now - perSide.right.seenAt < LOST_MS;

  // 1. Namaskaram: palms pressed together, fingers up, held for 1.0s (responsive & stable)
  const isNamaste = both && checkNamaste(L, R);
  if (isNamaste) {
    special.lastSeenNamaste = now;
    if (now >= (gestureCooldownUntil.special || 0)) {
      special.namasteSince ||= now;
      const elapsed = now - special.namasteSince;
      hands.namasteProgress = Math.min(1, elapsed / NAMASTE_HOLD_MS);
      if (elapsed >= NAMASTE_HOLD_MS) {
        hands.special = 'namaskaram';
        if (!special.namasteFired) {
          special.namasteFired = true;
          const centerX = (L[9].x + R[9].x) / 2;
          const centerY = (L[9].y + R[9].y) / 2;
          emitGesture('namaskaram', { x: centerX, y: centerY });
          gestureCooldownUntil.special = now + COOLDOWN_AFTER_FIRE_MS;
          gestureCooldownUntil.left = now + COOLDOWN_AFTER_FIRE_MS;
          gestureCooldownUntil.right = now + COOLDOWN_AFTER_FIRE_MS;
        }
      }
    }
  } else {
    // 350ms grace tolerance to bridge momentary tracking blips or webcam occlusion:
    const graceElapsed = now - (special.lastSeenNamaste || 0);
    if (special.namasteSince && graceElapsed < 350) {
      hands.namasteProgress = Math.min(1, (now - special.namasteSince) / NAMASTE_HOLD_MS);
    } else {
      special.namasteSince = 0;
      special.namasteFired = false;
      hands.namasteProgress = 0;
      if (hands.special === 'namaskaram') hands.special = null;
    }
  }

  // 2. Maha Visphot: Both hands showing closed fists (Double Fist ✊ ✊) held for 1.5s!
  const leftFist = perSide.left.raw === 'fist' || perSide.left.candidate === 'fist';
  const rightFist = perSide.right.raw === 'fist' || perSide.right.candidate === 'fist';
  const isDoubleFist = both && !isNamaste && leftFist && rightFist;
  special.isDoubleFist = isDoubleFist;

  if (isDoubleFist) {
    special.lastSeenVisphot = now;
    if (now < (gestureCooldownUntil.special || 0)) return;
    special.visphotSince ||= now;
    const elapsed = now - special.visphotSince;
    hands.visphotProgress = Math.min(1, elapsed / HOLD_MS);

    // Suppress single fist state completely:
    perSide.left.unlocked = null;
    perSide.right.unlocked = null;
    perSide.left.holdProgress = 0;
    perSide.right.holdProgress = 0;

    if (elapsed >= HOLD_MS) {
      hands.special = 'mahaVisphot';
      if (!special.visphotFired) {
        special.visphotFired = true;
        emitGesture('mahaVisphot', {});
        gestureCooldownUntil.special = now + 11500;
        gestureCooldownUntil.left = now + 11500;
        gestureCooldownUntil.right = now + 11500;
        setTimeout(() => { if (hands.special === 'mahaVisphot') hands.special = null; }, 10500);
      }
    }
  } else {
    // 250ms grace tolerance for double fist:
    const graceElapsed = now - (special.lastSeenVisphot || 0);
    if (special.visphotSince && graceElapsed < 250) {
      hands.visphotProgress = Math.min(1, (now - special.visphotSince) / HOLD_MS);
    } else {
      special.visphotSince = 0;
      special.visphotFired = false;
      hands.visphotProgress = 0;
      if (hands.special === 'mahaVisphot') hands.special = null;
    }
  }
}
