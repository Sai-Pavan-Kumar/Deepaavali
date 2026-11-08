// Input contract between the UI and the tracker. Modes only read `hands` and
// listen on `bus`. The pointer feeds it as a fallback; tracker.js feeds real
// landmarks with the same shapes, so mode code never branches on the source.
export const hands = {
  tracking: false,
  special: null,
  namasteProgress: 0,
  visphotProgress: 0,
  lastPointerTime: 0,
  left: { x: 0.24, y: 0.86, visible: true, landmarks: null, gesture: null, candidate: null, holdProgress: 0 },
  right: { x: 0.76, y: 0.86, visible: true, landmarks: null, gesture: null, candidate: null, holdProgress: 0 },
};
export const bus = new EventTarget();

export function setTracking(on) {
  hands.tracking = on;
  document.body.classList.toggle('tracking', on);
  bus.dispatchEvent(new CustomEvent('tracking', { detail: on }));
}

/** x,y normalised 0..1 in stage space, already mirrored. */
export function setHand(side, { x, y, visible = true, landmarks = null, gesture = null, candidate = null, holdProgress = 0 }) {
  Object.assign(hands[side], { x, y, visible, landmarks, gesture, candidate, holdProgress });
}

/** name: victory|thumbsUp|openPalm|fist|iLoveYou|mahaVisphot|namaskaram */
export function emitGesture(name, detail = {}) {
  bus.dispatchEvent(new CustomEvent('gesture', { detail: { name, ...detail } }));
}

const SKIN = '#c98d62';
const SKIN_LIGHT = '#e2ab83';
const SKIN_SHADE = '#8e5b3c';
const SKIN_DARK = '#6b3f25';
const NAIL_COLOR = '#f2d2c2';
const FINGERS = [[0, 1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];

function drawLandmarkHand(ctx, lm, w, h) {
  const pt = (i) => [lm[i].x * w, lm[i].y * h];
  const size = Math.hypot(lm[0].x * w - lm[9].x * w, lm[0].y * h - lm[9].y * h);
  ctx.save();
  ctx.shadowColor = 'rgba(255,180,90,0.35)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  [0, 1, 5, 9, 13, 17].forEach((i, k) => (k ? ctx.lineTo(...pt(i)) : ctx.moveTo(...pt(i))));
  ctx.closePath();
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  FINGERS.forEach((finger, f) => {
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = size * (f === 0 ? 0.3 : 0.26);
    ctx.beginPath();
    finger.forEach((i, k) => (k ? ctx.lineTo(...pt(i)) : ctx.moveTo(...pt(f === 0 ? 1 : i))));
    ctx.stroke();
    ctx.strokeStyle = SKIN_LIGHT;
    ctx.lineWidth = size * 0.08;
    ctx.beginPath();
    ctx.moveTo(...pt(finger[finger.length - 2]));
    ctx.lineTo(...pt(finger[finger.length - 1]));
    ctx.stroke();
  });
  ctx.restore();
}

/**
 * Natural first-person hand holding agarbatti/sparkler:
 * The stick is held delicately and realistically between the THUMB and INDEX FINGER.
 * Middle, ring, and pinky are comfortably curled underneath.
 */
function drawPinchHand(ctx, x, y, side, h, tool, tip) {
  const s = h / 900;
  const dir = side === 'left' ? -1 : 1; // 1 for right hand, -1 for left hand
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ----------------------------------------------------
  // 1. Forearm Sleeve (enters from bottom of screen)
  // ----------------------------------------------------
  const sleeve = ctx.createLinearGradient(x, y + 20 * s, x, h);
  sleeve.addColorStop(0, '#1c2840');
  sleeve.addColorStop(0.5, '#121b2c');
  sleeve.addColorStop(1, '#0b101b');
  ctx.fillStyle = sleeve;
  ctx.beginPath();
  ctx.moveTo(x - dir * 28 * s, y + 36 * s);
  ctx.quadraticCurveTo(x + dir * 30 * s, h - 50 * s, x + dir * 60 * s - 40 * s, h + 10);
  ctx.lineTo(x + dir * 60 * s + 60 * s, h + 10);
  ctx.quadraticCurveTo(x + dir * 45 * s + 35 * s, h - 60 * s, x + dir * 28 * s, y + 36 * s);
  ctx.closePath();
  ctx.fill();

  // Festive gold cuff trim on sleeve:
  ctx.strokeStyle = 'rgba(255, 211, 107, 0.75)';
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(x - dir * 28 * s, y + 36 * s);
  ctx.lineTo(x + dir * 28 * s, y + 36 * s);
  ctx.stroke();

  // ----------------------------------------------------
  // 2. Wrist & Base of Palm (Skin)
  // ----------------------------------------------------
  const palmGrad = ctx.createRadialGradient(
    x - dir * 6 * s, y + 10 * s, 6 * s,
    x, y + 15 * s, 48 * s
  );
  palmGrad.addColorStop(0, SKIN_LIGHT);
  palmGrad.addColorStop(0.7, SKIN);
  palmGrad.addColorStop(1, SKIN_SHADE);

  ctx.fillStyle = palmGrad;
  ctx.beginPath();
  // Wrist leading up to heel of palm:
  ctx.moveTo(x - dir * 24 * s, y + 36 * s);
  ctx.lineTo(x + dir * 24 * s, y + 36 * s);
  // Outer edge of palm up to pinky:
  ctx.quadraticCurveTo(x + dir * 32 * s, y + 20 * s, x + dir * 30 * s, y + 6 * s);
  // Middle & Index knuckle arch:
  ctx.quadraticCurveTo(x + dir * 18 * s, y - 16 * s, x - dir * 12 * s, y - 8 * s);
  // Base of thumb (thenar):
  ctx.quadraticCurveTo(x - dir * 32 * s, y + 6 * s, x - dir * 24 * s, y + 36 * s);
  ctx.closePath();
  ctx.fill();

  // ----------------------------------------------------
  // 3. Curled Lower Fingers (Pinky, Ring, Middle)
  // Curled into the palm below the pinch grip:
  // ----------------------------------------------------
  const fingerData = [
    { name: 'pinky', ox: dir * 20 * s, oy: y + 18 * s, w: 12 * s, h: 22 * s, ang: dir * 0.45 },
    { name: 'ring', ox: dir * 12 * s, oy: y + 6 * s, w: 13 * s, h: 24 * s, ang: dir * 0.35 },
    { name: 'middle', ox: dir * 2 * s, oy: y - 5 * s, w: 14 * s, h: 26 * s, ang: dir * 0.22 },
  ];

  fingerData.forEach((f) => {
    ctx.save();
    ctx.translate(x + f.ox, f.oy);
    ctx.rotate(f.ang);

    const fGrad = ctx.createLinearGradient(-f.w, 0, f.w, 0);
    fGrad.addColorStop(0, SKIN_LIGHT);
    fGrad.addColorStop(0.6, SKIN);
    fGrad.addColorStop(1, SKIN_SHADE);

    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.roundRect(-f.w * 0.5, -f.h * 0.5, f.w, f.h, f.w * 0.45);
    ctx.fill();

    // Finger joint crease:
    ctx.strokeStyle = 'rgba(110, 60, 35, 0.4)';
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(-f.w * 0.4, 0);
    ctx.lineTo(f.w * 0.4, 0);
    ctx.stroke();

    ctx.restore();
  });

  // Pinch contact point where thumb and index meet:
  const pinchX = x - dir * 10 * s;
  const pinchY = y - 26 * s;

  // ----------------------------------------------------
  // 4. The Tool (Agarbatti / Sparkler)
  // Resting directly through the pinch point!
  // ----------------------------------------------------
  if (tool && tip) {
    // Bottom of the stick (bamboo handle extending backward past thumb web):
    const handleEndX = pinchX + dir * 24 * s;
    const handleEndY = pinchY + 42 * s;

    // Vector along stick:
    const vx = tip.x - pinchX;
    const vy = tip.y - pinchY;
    const stickDist = Math.hypot(vx, vy) || 1;
    const ux = vx / stickDist;
    const uy = vy / stickDist;

    if (tool.kind === 'agarbatti') {
      // 4A. Wooden bamboo handle at bottom:
      ctx.strokeStyle = '#c99a63'; // light bamboo
      ctx.lineWidth = Math.max(2.5, 3.2 * s);
      ctx.beginPath();
      ctx.moveTo(handleEndX, handleEndY);
      ctx.lineTo(pinchX + ux * 10 * s, pinchY + uy * 10 * s);
      ctx.stroke();

      // 4B. Fragrant brown incense masala coating extending up to the burning tip:
      ctx.strokeStyle = '#4a2c16';
      ctx.lineWidth = Math.max(4.2, 5.5 * s);
      ctx.beginPath();
      ctx.moveTo(pinchX + ux * 8 * s, pinchY + uy * 8 * s);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();

      // Incense texture grain:
      ctx.strokeStyle = '#6b3f20';
      ctx.lineWidth = Math.max(1.8, 2.2 * s);
      ctx.beginPath();
      ctx.moveTo(pinchX + ux * 14 * s, pinchY + uy * 14 * s);
      ctx.lineTo(tip.x - ux * 6 * s, tip.y - uy * 6 * s);
      ctx.stroke();

      // 4C. Glowing Red-Orange Burning Coal / Ember at tip:
      const emberR = 18 * s;
      const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, emberR);
      glow.addColorStop(0, 'rgba(255, 255, 230, 1)');
      glow.addColorStop(0.2, 'rgba(255, 120, 30, 0.95)');
      glow.addColorStop(0.5, 'rgba(255, 45, 10, 0.6)');
      glow.addColorStop(1, 'rgba(255, 30, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, emberR, 0, Math.PI * 2);
      ctx.fill();

      // White-hot core dot:
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, Math.max(1.5, 2.8 * s), 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Sparkler metal wire & coating:
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = Math.max(2.2, 2.8 * s);
      ctx.beginPath();
      ctx.moveTo(handleEndX, handleEndY);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();

      // Pyrotechnic grey coat:
      const coatFrac = 0.6 * (1 - (tool.burnt || 0));
      ctx.strokeStyle = tool.lit ? '#374151' : '#6b7280';
      ctx.lineWidth = Math.max(5, 7 * s);
      ctx.beginPath();
      ctx.moveTo(tip.x - ux * (stickDist * coatFrac), tip.y - uy * (stickDist * coatFrac));
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    }
  }

  // ----------------------------------------------------
  // 5. Index Finger & Thumb Clamping OVER the stick!
  // This visually proves the stick is pinched between them!
  // ----------------------------------------------------

  // 5A. Index Finger (Arches from top and presses down onto stick):
  const indexGrad = ctx.createLinearGradient(
    x - dir * 18 * s, y - 4 * s,
    pinchX, pinchY
  );
  indexGrad.addColorStop(0, SKIN_LIGHT);
  indexGrad.addColorStop(0.5, SKIN);
  indexGrad.addColorStop(1, SKIN_SHADE);

  ctx.fillStyle = indexGrad;
  ctx.beginPath();
  // Knuckle:
  ctx.moveTo(x - dir * 4 * s, y - 8 * s);
  // Upper curve of extended index finger:
  ctx.quadraticCurveTo(x - dir * 16 * s, y - 26 * s, pinchX - dir * 2 * s, pinchY - 6 * s);
  // Rounded fingertip curving over the stick:
  ctx.quadraticCurveTo(pinchX + dir * 4 * s, pinchY - 8 * s, pinchX + dir * 6 * s, pinchY + 2 * s);
  // Pad pressing down onto the stick:
  ctx.quadraticCurveTo(pinchX, pinchY + 6 * s, x - dir * 2 * s, y - 2 * s);
  ctx.closePath();
  ctx.fill();

  // Index fingernail:
  ctx.fillStyle = NAIL_COLOR;
  ctx.beginPath();
  ctx.ellipse(pinchX + dir * 1 * s, pinchY - 4 * s, 3.5 * s, 5 * s, dir * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Index joint wrinkle:
  ctx.strokeStyle = 'rgba(110, 60, 35, 0.45)';
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(x - dir * 10 * s, y - 16 * s);
  ctx.lineTo(x - dir * 4 * s, y - 12 * s);
  ctx.stroke();

  // 5B. The Thumb (Rises from the palm and presses firmly against the stick):
  const thumbGrad = ctx.createRadialGradient(
    pinchX - dir * 6 * s, pinchY + 6 * s, 3 * s,
    pinchX, pinchY, 24 * s
  );
  thumbGrad.addColorStop(0, SKIN_LIGHT);
  thumbGrad.addColorStop(0.7, SKIN);
  thumbGrad.addColorStop(1, SKIN_DARK);

  ctx.fillStyle = thumbGrad;
  ctx.beginPath();
  // Thumb base:
  ctx.moveTo(x - dir * 26 * s, y + 16 * s);
  // Outer thumb contour:
  ctx.quadraticCurveTo(x - dir * 30 * s, y - 4 * s, pinchX - dir * 8 * s, pinchY + 2 * s);
  // Rounded thumb pad pressing against stick & index:
  ctx.quadraticCurveTo(pinchX - dir * 6 * s, pinchY - 8 * s, pinchX, pinchY - 4 * s);
  // Inner thumb contour leading back to thumb-index web:
  ctx.quadraticCurveTo(pinchX + dir * 2 * s, pinchY + 12 * s, x - dir * 10 * s, y + 18 * s);
  ctx.closePath();
  ctx.fill();

  // Thumbnail on the thumb pad:
  ctx.fillStyle = NAIL_COLOR;
  ctx.beginPath();
  ctx.ellipse(pinchX - dir * 5 * s, pinchY - 2 * s, 4 * s, 6 * s, -dir * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Contact shadow line where thumb and index clamp the stick:
  ctx.strokeStyle = 'rgba(70, 35, 15, 0.55)';
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(pinchX - dir * 2 * s, pinchY - 2 * s);
  ctx.lineTo(pinchX + dir * 4 * s, pinchY + 3 * s);
  ctx.stroke();

  ctx.restore();
}

/** Where the held tool starts and points. With landmarks the tool follows the real finger direction. */
function toolLine(hand, side, w, h) {
  const s = h / 900;
  if (hand.landmarks) {
    const lm = hand.landmarks;
    // Landmark 4 is thumb tip, 8 is index tip -> grip is exactly between them:
    const grip = { x: ((lm[4].x + lm[8].x) / 2) * w, y: ((lm[4].y + lm[8].y) / 2) * h };
    let dx = (lm[8].x - lm[0].x) * w;
    let dy = (lm[8].y - lm[0].y) * h;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    return { grip, tip: { x: grip.x + dx * 165 * s, y: grip.y + dy * 165 * s } };
  }
  const dir = side === 'left' ? -1 : 1;
  // Precision pinch point between thumb and index finger:
  const grip = { x: hand.x * w - dir * 10 * s, y: hand.y * h - 26 * s };
  return { grip, tip: { x: grip.x - dir * 42 * s, y: grip.y - 150 * s } };
}

/** Draws a hand plus its tool, returns the tool tip {x,y} in px (the ignition point). */
export function drawHand(ctx, side, tool, w, h) {
  const hand = hands[side];
  if (!hand.visible) return null;
  const { grip, tip } = toolLine(hand, side, w, h);
  if (hand.landmarks) {
    if (tool) drawTool(ctx, tool, grip, tip, h / 900);
    drawLandmarkHand(ctx, hand.landmarks, w, h);
  } else {
    // Human-crafted precision pinch grip holding the agarbatti / sparkler:
    drawPinchHand(ctx, hand.x * w, hand.y * h, side, h, tool, tip);
  }
  return tip;
}

function drawTool(ctx, tool, from, tip, s) {
  ctx.lineCap = 'round';
  if (tool.kind === 'agarbatti') {
    ctx.strokeStyle = '#c99a63';
    ctx.lineWidth = Math.max(2.2, 3 * s);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    ctx.strokeStyle = '#4a2c16';
    ctx.lineWidth = Math.max(4.5, 5.5 * s);
    ctx.beginPath();
    ctx.moveTo(from.x + (tip.x - from.x) * 0.25, from.y + (tip.y - from.y) * 0.25);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 18 * s);
    glow.addColorStop(0, 'rgba(255, 255, 220, 1)');
    glow.addColorStop(0.25, 'rgba(255, 110, 30, 0.95)');
    glow.addColorStop(1, 'rgba(255, 50, 10, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 18 * s, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.strokeStyle = '#a6a6b2';
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  const coat = 0.55 * (1 - (tool.burnt || 0));
  ctx.strokeStyle = tool.lit ? '#4a4048' : '#6e6e7c';
  ctx.lineWidth = 7 * s;
  ctx.beginPath();
  ctx.moveTo(tip.x + (from.x - tip.x) * coat, tip.y + (from.y - tip.y) * coat);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
}

/** Pointer fallback: drives whichever hand is active. */
export function bindPointer(el, getActiveSide) {
  const move = (e) => {
    hands.lastPointerTime = performance.now();
    const r = el.getBoundingClientRect();
    setHand(getActiveSide(), {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      visible: true,
      landmarks: null,
    });
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerdown', move);
}
