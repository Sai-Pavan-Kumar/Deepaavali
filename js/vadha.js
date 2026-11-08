import { createFx, burst, smoke, rand, PALETTE } from './fx.js';
import { sfx } from './sfx.js';
import { hands } from './hands.js?v=14';
import { launch, distantSky } from './crackers.js';
import { NARAKASURA_SVG, VADHA_BG_SVG } from './art.js';
import { rigGeometry, drawBow, drawNockedArrow, drawArcherHands, drawFlame } from './vadha-rig.js?v=9';

const ARROWS_PER_ROUND = 5;
const RELOAD_MS = 450;
const isPhone = () => window.matchMedia('(pointer: coarse) and (max-aspect-ratio: 1/1)').matches;

/**
 * Geometric analysis of 21 MediaPipe hand landmarks:
 * Returns { isClosed, isOpen, isPinch, curled, extended } instantly without waiting for hold timers.
 */
function analyzeHand(lm) {
  if (!lm || lm.length < 21) return { isClosed: false, isOpen: false, isPinch: false, curled: 0, extended: 0 };
  const wrist = lm[0];
  const palm = lm[9]; // Middle MCP knuckle
  const palmSize = Math.hypot(wrist.x - palm.x, wrist.y - palm.y) || 0.1;

  // Finger tips: Index(8), Middle(12), Ring(16), Pinky(20)
  // Finger PIPs: Index(6), Middle(10), Ring(14), Pinky(18)
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  let curled = 0;
  let extended = 0;

  for (let i = 0; i < 4; i++) {
    const tip = lm[tips[i]];
    const pip = lm[pips[i]];
    const dWristTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const dWristPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    const dPalmTip = Math.hypot(tip.x - palm.x, tip.y - palm.y);

    if (dWristTip < dWristPip * 1.08 || dPalmTip < palmSize * 0.95) {
      curled++;
    } else if (dWristTip > dWristPip * 1.15 && dPalmTip > palmSize * 1.1) {
      extended++;
    }
  }

  // Pinch check: thumb tip (4) to index tip (8)
  const pinchDist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
  const isPinch = pinchDist < palmSize * 0.48;

  // Closed fist or pinch grip
  const isClosed = curled >= 3 || (curled >= 2 && isPinch);
  // Open hand with fingers spread
  const isOpen = extended >= 3;

  return { isClosed, isOpen, isPinch, curled, extended };
}

export function initVadha(root) {
  root.querySelector('.effigy').innerHTML = NARAKASURA_SVG;
  root.querySelector('.vadha-bg').innerHTML = VADHA_BG_SVG;
  const fx = createFx(root.querySelector('canvas'));
  const ui = {
    effigy: root.querySelector('.effigy'),
    reticle: root.querySelector('.reticle'),
    power: root.querySelector('.power-fill'),
    arrows: root.querySelector('[data-arrows]'),
    wind: root.querySelector('[data-wind]'),
    result: root.querySelector('.result'),
    hint: root.querySelector('.hint'),
  };
  const state = {
    arrows: 0,
    drawing: null,
    drawingSource: null,
    aim: null,
    power: 0,
    wind: 0,
    flying: null,
    burnt: false,
    reloadAt: 0,
    camStart: 0,
  };
  let stopAmbient = () => {};

  function newRound() {
    fx.clear();
    const { w, h } = fx.size();
    Object.assign(state, {
      arrows: ARROWS_PER_ROUND,
      drawing: null,
      drawingSource: null,
      flying: null,
      burnt: false,
      power: 0,
      aim: { x: w * 0.5, y: h * 0.42 },
    });
    ui.effigy.classList.remove('burning', 'charred');
    ui.result.hidden = true;
    rollWind();
    renderHud();
  }

  function rollWind() {
    state.wind = Math.round(rand(-3, 3) * 10) / 10;
    ui.wind.textContent = `${state.wind > 0 ? '→' : state.wind < 0 ? '←' : '·'} ${Math.abs(state.wind)}`;
  }

  function startDraw(source = 'pointer') {
    if (state.flying || state.burnt || state.arrows <= 0 || performance.now() < state.reloadAt) return false;
    state.drawing = true;
    state.drawingSource = source;
    return true;
  }

  function release() {
    if (!state.drawing) return;
    state.drawing = false;
    state.drawingSource = null;
    let power = state.power;
    if (power < 0.25) {
      power = 0.35; // ensure a tap/quick release still fires cleanly
    }
    const { w, h } = fx.size();
    const g = rigGeometry(w, h, state.aim, power);

    // Ballistic flight duration: full draw is punchy (360ms), low draw is ~520ms
    const duration = 360 + (1 - power) * 160;

    // Shakiness / dispersion decreases with full, steady draw
    const shakiness = (1 - power) * 20;
    const baseTarget = {
      x: state.aim.x + rand(-shakiness, shakiness),
      y: state.aim.y + rand(-shakiness, shakiness),
    };

    // Realistic ballistics parameters:
    // 1. Gravity drop: full draw has almost zero drop; low draw drops below target
    const gravityDrop = Math.pow(1 - power, 1.4) * (h * 0.35);

    // 2. Parabolic arc apex:
    const arcHeight = Math.max(12, 38 * power);

    // 3. Continuous crosswind drift:
    // Right wind (→) pushes arrow to the RIGHT (+).
    // Left wind (←) pushes arrow to the LEFT (-).
    const totalWindDrift = state.wind * (w * 0.022);

    // Launch origin: arrow rests on the bow riser shelf right next to sight pin
    const from = { x: g.shelf.x, y: g.shelf.y };

    state.flying = {
      from,
      baseTarget,
      gravityDrop,
      arcHeight,
      totalWindDrift,
      duration,
      elapsed: 0,
      t: 0,
      power,
      u: g.u,
    };
    state.arrows--;
    state.power = 0;
    sfx.whoosh();
    renderHud();
  }

  function computeFlightPos(f, t) {
    const baseX = f.from.x + (f.baseTarget.x - f.from.x) * t;
    const baseY = f.from.y + (f.baseTarget.y - f.from.y) * t;
    const windX = f.totalWindDrift * Math.pow(t, 1.5);
    const dropY = f.gravityDrop * Math.pow(t, 1.8);
    const arcY = -Math.sin(t * Math.PI) * f.arcHeight;
    return { x: baseX + windX, y: baseY + dropY + arcY };
  }

  function effigyBox() {
    const box = ui.effigy.getBoundingClientRect();
    const stage = root.getBoundingClientRect();
    return { left: box.left - stage.left, top: box.top - stage.top, width: box.width, height: box.height };
  }

  function effigyHit(p) {
    const b = effigyBox();
    const margin = 20; // forgiving festive hitbox covering crown, arms & effigy pedestal
    return (
      p.x >= b.left - margin &&
      p.x <= b.left + b.width + margin &&
      p.y >= b.top - margin &&
      p.y <= b.top + b.height + margin
    );
  }

  function burnEffigy(p) {
    state.burnt = true;
    ui.effigy.classList.add('burning');
    const b = effigyBox();
    sfx.bang();
    sfx.roar(8);
    setTimeout(() => sfx.wala(7), 600);
    burst(fx, p.x, p.y, { count: 140, speed: 7, colors: [PALETTE.saffron, PALETTE.gold] });
    fx.repeat(30, 8000, (progress) => {
      for (let i = 0; i < 7; i++) {
        fx.spawn({
          x: b.left + b.width * rand(0.2, 0.8),
          y: b.top + b.height * rand(0.08, 0.95),
          vx: rand(-0.6, 0.6),
          vy: rand(-3.5, -1),
          color: Math.random() < 0.5 ? PALETTE.saffron : PALETTE.red,
          gravity: -0.04,
          decay: 0.03,
          size: rand(3, 8),
        });
      }
      if (Math.random() < 0.07) {
        burst(fx, b.left + b.width * rand(0.25, 0.75), b.top + b.height * rand(0.1, 0.8), { count: 50, speed: 4 });
        sfx.smallBang();
      }
      if (progress > 0.55) ui.effigy.classList.add('charred');
    });
    setTimeout(() => smoke(fx, b.left + b.width / 2, b.top + b.height * 0.3, 40), 5000);
    setTimeout(celebrate, 6500);
    setTimeout(() => showResult(true), 8200);
  }

  function celebrate() {
    const { w, h } = fx.size();
    sfx.volley();
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        launch(fx, w * (0.1 + i * 0.11), h * 0.75, {
          apexY: h * rand(0.08, 0.3),
          frames: 45,
          sound: false,
          onBurst: (x, y) => {
            burst(fx, x, y, { count: 110, speed: 5 });
            sfx.smallBang();
          },
        });
      }, i * 220);
    }
  }

  function showResult(won) {
    ui.result.hidden = false;
    ui.result.querySelector('h2').textContent = won ? 'Narakasura Vadha complete' : 'Out of arrows';
    ui.result.querySelector('p').textContent = won
      ? 'Light wins over darkness. Happy Deepavali!'
      : 'Narakasura still stands. Breathe, and aim again.';
    if (won) sfx.chime();
  }

  function renderHud() {
    ui.arrows.textContent = state.arrows;
    ui.power.style.transform = `scaleX(${state.power})`;
    // Canvas renders high-detail Olympic sight pin at 60fps; keep DOM reticle hidden
    if (ui.reticle) ui.reticle.style.display = 'none';
    ui.hint.hidden = state.arrows < ARROWS_PER_ROUND || !!state.drawing;
  }

  // Camera Archery tracking variables:
  let lastPointerTime = 0;
  let aimSmooth = null;
  let wasStringClosed = false;
  let camDrawStartTime = 0;

  // Webcam archery: Left/primary hand aims the bow; Right hand makes a fist/pinch to draw & opens to shoot!
  function trackHands() {
    if (!hands.tracking || isPhone()) return;
    const now = performance.now();

    // If mouse was interacted with within 1.2s, let mouse have priority
    if (now - lastPointerTime < 1200) return;

    const { w, h } = fx.size();
    const hasL = !!(hands.left?.visible && hands.left?.landmarks && hands.left.landmarks.length >= 21);
    const hasR = !!(hands.right?.visible && hands.right?.landmarks && hands.right.landmarks.length >= 21);

    if (!hasL && !hasR) return;

    let bowHand = null;
    let stringHand = null;

    if (hasL && hasR) {
      // Both hands present:
      // The hand on the left side of the screen (smaller stage x) is the bow/aiming hand.
      // The hand on the right side of the screen (larger stage x) is the string/drawing hand.
      if (hands.left.x <= hands.right.x) {
        bowHand = hands.left;
        stringHand = hands.right;
      } else {
        bowHand = hands.right;
        stringHand = hands.left;
      }
    } else {
      // Single hand present:
      // Whichever hand is raised, it controls the bow aim!
      bowHand = hasL ? hands.left : hands.right;
    }

    // 1. Bow Hand = Moves the Bow & Sight Scope
    if (bowHand && bowHand.landmarks) {
      // Use palm center (lm[9]) or index knuckle (lm[5]) for steady aim
      const aimPt = bowHand.landmarks[9] || bowHand.landmarks[5] || bowHand;
      const targetAimX = Math.max(w * 0.10, Math.min(w * 0.74, aimPt.x * w));
      const targetAimY = Math.max(h * 0.08, Math.min(h * 0.84, aimPt.y * h - h * 0.10));

      if (!aimSmooth) {
        aimSmooth = { x: targetAimX, y: targetAimY };
      } else {
        // Smooth exponential filter (snappy, zero jitter)
        aimSmooth.x += (targetAimX - aimSmooth.x) * 0.38;
        aimSmooth.y += (targetAimY - aimSmooth.y) * 0.38;
      }
      state.aim = { x: aimSmooth.x, y: aimSmooth.y };
      renderHud();
    }

    // 2. String Hand = Arrow Nock, Draw & Release Gestures
    if (stringHand && stringHand.landmarks && bowHand) {
      const sState = analyzeHand(stringHand.landmarks);
      const apart = Math.hypot(bowHand.x - stringHand.x, bowHand.y - stringHand.y);

      // Phase A: NOT DRAWING -> Start draw on closed fist / pinch near bow hand
      if (!state.drawing) {
        if (sState.isClosed && apart < 0.55) {
          if (startDraw('camera')) {
            state.camStart = apart;
            camDrawStartTime = now;
            state.power = 0.35;
            sfx.bowCreak(state.power);
            wasStringClosed = true;
          }
        }
      }
      // Phase B: DRAWING WITH CAMERA -> Tension buildup & Release
      else if (state.drawing && state.drawingSource === 'camera') {
        const pullDist = Math.max(0, apart - state.camStart);
        const distPower = pullDist / 0.20; // pulling hands apart builds tension
        const timePower = Math.min(0.9, (now - camDrawStartTime) / 500);
        const targetPower = Math.max(0.35, Math.min(1.0, Math.max(distPower, timePower)));

        if (targetPower - state.power > 0.08) {
          sfx.bowCreak(targetPower);
        }
        state.power = targetPower;

        // RELEASE TRIGGERS:
        // 1. String hand opens fingers (sState.isOpen or !sState.isClosed after 160ms hold)
        if (wasStringClosed && (sState.isOpen || (!sState.isClosed && now - camDrawStartTime > 160))) {
          wasStringClosed = false;
          release();
        }
      }
      wasStringClosed = sState.isClosed;
    } else if (state.drawing && state.drawingSource === 'camera') {
      // If string hand drops out of camera while drawn, release arrow
      if (wasStringClosed && now - camDrawStartTime > 200) {
        wasStringClosed = false;
        release();
      }
    }
  }

  function drawFlight(ctx, dt, time) {
    const f = state.flying;
    if (!f) return;
    f.elapsed += dt;
    f.t = Math.min(1, f.elapsed / f.duration);
    const t = f.t;

    // Instantaneous trajectory position
    const cur = computeFlightPos(f, t);

    // Tangent angle calculation for aerodynamic pitch
    const dtAhead = 0.008;
    const tAhead = Math.min(1, t + dtAhead);
    const ahead = computeFlightPos(f, tAhead);
    const ang = Math.atan2(ahead.y - cur.y, ahead.x - cur.x);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const nx = -uy;
    const ny = ux;

    // Perspective depth scale (starts close at shelf ~0.95, recedes into depth ~0.22)
    const scale = Math.max(0.22, 0.95 - t * 0.73);
    const u = f.u || fx.size().h;
    const arrowLen = u * 0.26 * scale;
    const x = cur.x;
    const y = cur.y;

    ctx.save();
    // 1. Wooden shaft:
    ctx.strokeStyle = '#5a2e12';
    ctx.lineWidth = Math.max(2.2, u * 0.008 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - ux * arrowLen, y - uy * arrowLen);
    ctx.lineTo(x, y);
    ctx.stroke();

    // 2. Fletchings (Pankh):
    const fletchLen = arrowLen * 0.28;
    const fletchW = u * 0.012 * scale;
    const tailX = x - ux * arrowLen;
    const tailY = y - uy * arrowLen;
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tailX + ux * fletchLen + nx * fletchW, tailY + uy * fletchLen + ny * fletchW);
    ctx.lineTo(tailX + ux * (fletchLen * 0.7), tailY + uy * (fletchLen * 0.7));
    ctx.lineTo(tailX + ux * fletchLen - nx * fletchW, tailY + uy * fletchLen - ny * fletchW);
    ctx.closePath();
    ctx.fill();

    // 3. Golden broadhead blade:
    const tipLen = u * 0.026 * scale;
    const tipW = u * 0.011 * scale;
    ctx.beginPath();
    ctx.moveTo(x + ux * tipLen, y + uy * tipLen);
    ctx.lineTo(x - nx * tipW, y - ny * tipW);
    ctx.lineTo(x + nx * tipW, y + ny * tipW);
    ctx.closePath();
    ctx.fillStyle = '#ffd700';
    ctx.fill();

    // 4. Sacred fire (Agni) & glowing trail at arrowhead:
    drawFlame(ctx, x, y, u * 0.026 * scale + 2, time, ux, uy, nx, ny);
    ctx.restore();

    // Sparks trailing behind flying fire arrow with wind drift
    fx.spawn({
      x: x - ux * arrowLen * 0.3 + rand(-3, 3),
      y: y - uy * arrowLen * 0.3 + rand(-3, 3),
      vx: rand(-0.6, 0.6) - ux * 2.0 + state.wind * 0.25,
      vy: rand(-0.6, 0.6) - uy * 2.0,
      color: Math.random() < 0.65 ? PALETTE.gold : PALETTE.saffron,
      decay: 0.045,
      size: 3.5 * scale + 1,
    });

    if (t < 1) return;

    // --- Impact / Collision Handling ---
    state.flying = null;
    state.reloadAt = performance.now() + RELOAD_MS;

    const hit = !state.burnt && effigyHit({ x, y });
    if (hit) {
      burnEffigy({ x, y });
    } else {
      // Missed or dropped short into ground / barricade
      sfx.thud();
      smoke(fx, x, y, 14);
      burst(fx, x, y, { count: 35, speed: 3.5, colors: ['#5a3a20', '#ffd700', '#c85a20'] });
      rollWind();
      if (state.arrows === 0 && !state.burnt) setTimeout(() => showResult(false), 700);
    }
  }

  const skyTick = distantSky(fx);
  fx.onDraw((ctx, dt) => {
    if (!root.classList.contains('active') || !state.aim) return;
    const { w, h } = fx.size();
    const now = performance.now();
    trackHands();

    // Smooth bow tension charging while pointer is held down:
    if (state.drawing && state.drawingSource === 'pointer') {
      const elapsed = now - drawStartTime;
      const targetPower = Math.min(1.0, 0.25 + (elapsed / 420) * 0.75);
      if (targetPower - state.power > 0.08) {
        sfx.bowCreak(targetPower);
      }
      state.power = targetPower;
      renderHud();
    }

    skyTick(dt);
    drawFlight(ctx, dt, now);

    // First-person Olympic / Vedic Archery Rig:
    const g = rigGeometry(w, h, state.aim, state.power);
    drawBow(ctx, w, h, g);
    if (!state.flying && !state.burnt && state.arrows > 0 && now > state.reloadAt) {
      drawNockedArrow(ctx, g, state.aim, g.u, now);
    }
    drawArcherHands(ctx, g, g.u, !!state.drawing);
  });

  const surface = root.querySelector('.vadha-input');
  let drawStartTime = 0;

  function updatePointerAim(e) {
    lastPointerTime = performance.now();
    const rect = surface.getBoundingClientRect();
    const { w, h } = fx.size();
    // Direct 1:1 aiming: mouse cursor directly drives sight scope & bow rig smoothly
    const x = Math.max(w * 0.08, Math.min(w * 0.74, e.clientX - rect.left));
    const y = Math.max(h * 0.08, Math.min(h * 0.84, e.clientY - rect.top));
    state.aim = { x, y };
    aimSmooth = { x, y };
    renderHud();
  }

  surface.addEventListener('pointermove', (e) => {
    updatePointerAim(e);
  });

  surface.addEventListener('pointerdown', (e) => {
    updatePointerAim(e);
    if (!startDraw('pointer')) return;
    surface.setPointerCapture(e.pointerId);
    drawStartTime = performance.now();
    state.power = 0.25;
    sfx.bowCreak(state.power);
    renderHud();
  });

  const onPointerUp = (e) => {
    if (state.drawingSource === 'pointer') {
      updatePointerAim(e);
      release();
    }
  };
  surface.addEventListener('pointerup', onPointerUp);
  surface.addEventListener('pointercancel', onPointerUp);

  root.querySelector('[data-replay]').addEventListener('click', newRound);
  return {
    enter() {
      newRound();
      stopAmbient = sfx.ambient();
    },
    leave() {
      fx.clear();
      stopAmbient();
    },
  };
}
