import { createFx, burst, fountain, smoke, PALETTE, rand } from './fx.js';
import { sfx } from './sfx.js';
import { bus, hands } from './hands.js?v=14';
import { launch, sparkle } from './crackers.js';

export const MUDRAS = [
  { id: 'victory', emoji: '☝️', title: 'Point Up', subtitle: 'Continuous rockets', key: '1' },
  { id: 'thumbsUp', emoji: '👍', title: 'Thumbs up', subtitle: 'Chichubuddi', key: '2' },
  { id: 'fist', emoji: '✊', title: 'Fist', subtitle: 'Laxmi Bomb', key: '3' },
  { id: 'iLoveYou', emoji: '🤟', title: 'I love you', subtitle: 'Heart shell', key: '4' },
  { id: 'mahaVisphot', emoji: '🌀', title: 'Maha Visphot', subtitle: 'Both hands fists', key: '5' },
  { id: 'namaskaram', emoji: '🙏', title: 'Namaskaram', subtitle: 'Palms together', key: '6' },
];

const COOLDOWN_MS = 750;
const WISH_MS = 24000;
const DOCK_DEADZONE = 105; // Strict dead zone above the options dock

export function initMudra(root) {
  const fx = createFx(root.querySelector('canvas'));
  fx.setDeadzone(DOCK_DEADZONE);

  const legend = root.querySelector('.legend');
  const wish = root.querySelector('.wish');
  const drawHud = root.querySelector('.draw-hud');
  const clearBtn = root.querySelector('.draw-clear-btn');
  const lastFired = { left: 0, right: 0, default: 0 };
  let lastAnarSound = 0;
  let stopAmbient = () => {};
  let manualActive = null;
  let manualActiveTimer = null;
  const lastRocketLaunch = { left: 0, right: 0 };
  let activePots = [];

  // Sparkler Drawing state (full dual-hand & multitouch support):
  let isDrawMode = false;
  let activeStrokes = [];
  const currentHandStrokes = { left: null, right: null };
  const currentPointerStrokes = new Map();
  let sparklerSoundStop = null;
  const STROKE_DURATION_MS = 6000;

  function drawSparklerPath(ctx, pts, intensity) {
    if (!pts || pts.length === 0) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (pts.length === 1) {
      const p = pts[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 * intensity, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = `rgba(255, 215, 60, ${intensity})`;
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.restore();
      return;
    }

    const build = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) {
        ctx.lineTo(pts[k].x, pts[k].y);
      }
    };

    // 1. Fiery festive aura:
    ctx.shadowColor = `rgba(255, 140, 20, ${0.9 * intensity})`;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = `rgba(255, 120, 20, ${0.7 * intensity})`;
    ctx.lineWidth = 10;
    build();
    ctx.stroke();

    // 2. Radiant gold body:
    ctx.shadowColor = `rgba(255, 215, 60, ${0.95 * intensity})`;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(255, 215, 75, ${0.95 * intensity})`;
    ctx.lineWidth = 5;
    build();
    ctx.stroke();

    // 3. Incandescent white core wire:
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 3;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.98 * intensity})`;
    ctx.lineWidth = 2.4;
    build();
    ctx.stroke();

    ctx.restore();
  }

  function toggleDrawMode(force) {
    isDrawMode = typeof force === 'boolean' ? force : !isDrawMode;
    const drawBtn = legend.querySelector('#draw-chip');
    if (drawBtn) drawBtn.classList.toggle('active', isDrawMode);
    if (drawHud) drawHud.hidden = !isDrawMode;
    if (!isDrawMode) {
      currentHandStrokes.left = null;
      currentHandStrokes.right = null;
      currentPointerStrokes.clear();
      if (activeStrokes.length === 0 && sparklerSoundStop) {
        sparklerSoundStop();
        sparklerSoundStop = null;
      }
    }
  }

  function clearAllStrokes() {
    activeStrokes = [];
    currentHandStrokes.left = null;
    currentHandStrokes.right = null;
    currentPointerStrokes.clear();
    if (sparklerSoundStop) {
      sparklerSoundStop();
      sparklerSoundStop = null;
    }
  }

  clearBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearAllStrokes();
  });

  root.addEventListener('pointerdown', (e) => {
    if (!isDrawMode) return;
    if (e.target.closest('.legend') || e.target.closest('.hud') || e.target.closest('.draw-hud') || e.target.closest('.wish.show')) return;
    const canvasEl = root.querySelector('canvas');
    const rect = canvasEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const stroke = {
      id: Math.random(),
      pointerId: e.pointerId,
      points: [{ x: px, y: py }],
      startTime: performance.now(),
    };
    currentPointerStrokes.set(e.pointerId, stroke);
    activeStrokes.push(stroke);
    sparkle(fx, px, py, 1.8);
    if (!sparklerSoundStop) sparklerSoundStop = sfx.sparklerLoop();
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDrawMode) return;
    const stroke = currentPointerStrokes.get(e.pointerId);
    if (!stroke) return;
    const canvasEl = root.querySelector('canvas');
    const rect = canvasEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const pts = stroke.points;
    const lastPt = pts[pts.length - 1];
    if (Math.hypot(px - lastPt.x, py - lastPt.y) > 2.5) {
      pts.push({ x: px, y: py });
      sparkle(fx, px, py, 1.0);
    }
  });

  const endPointerStroke = (e) => {
    if (e?.pointerId != null) {
      currentPointerStrokes.delete(e.pointerId);
    } else {
      currentPointerStrokes.clear();
    }
  };
  window.addEventListener('pointerup', endPointerStroke);
  window.addEventListener('pointercancel', endPointerStroke);

  function placeFlowerpot(x, y) {
    sfx.fountain(5.5, 0.85);
    activePots.push({
      x,
      y,
      startTime: performance.now(),
      duration: 5500,
    });
  }

  legend.innerHTML = MUDRAS.map((m) => `
    <button class="mudra-chip" data-id="${m.id}" title="${m.title} (${m.subtitle})">
      <span class="mudra-emoji">${m.emoji}</span>
      <div class="mudra-info">
        <span class="mudra-title">${m.title}</span>
        <span class="mudra-sub">${m.subtitle}</span>
      </div>
    </button>`).join('') + `
    <div class="legend-sep" aria-hidden="true"></div>
    <button class="mudra-chip pencil-chip" id="draw-chip" title="Sparkler Draw · Pinch in air (👌) or drag on screen to draw!">
      <span class="mudra-emoji">
        <svg class="pencil-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
      </span>
      <div class="mudra-info">
        <span class="mudra-title">Draw</span>
        <span class="mudra-sub">Pinch / Drag</span>
      </div>
    </button>`;
  buildWish(wish);

  function drawFlowerPot(ctx, x, y, scale = 1.35) {
    const potH = 65 * scale;
    const topW = 10 * scale;
    const botW = 30 * scale;

    ctx.save();
    ctx.translate(x, y);

    // Earthen base shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, potH + 4 * scale, botW + 8 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Terracotta clay base ring
    ctx.fillStyle = '#2c1209';
    ctx.beginPath();
    ctx.ellipse(0, potH, botW + 3 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Terracotta cone body
    const grad = ctx.createLinearGradient(-botW, 0, botW, 0);
    grad.addColorStop(0, '#75180d');
    grad.addColorStop(0.25, '#c53424');
    grad.addColorStop(0.55, '#ea4c38');
    grad.addColorStop(0.85, '#d03b29');
    grad.addColorStop(1, '#5a1208');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-topW, 0);
    ctx.lineTo(topW, 0);
    ctx.lineTo(botW, potH);
    ctx.quadraticCurveTo(0, potH + 8 * scale, -botW, potH);
    ctx.closePath();
    ctx.fill();

    // Green festive ribbon band
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 3.5 * scale;
    ctx.beginPath();
    ctx.moveTo(-topW * 1.3, potH * 0.28);
    ctx.quadraticCurveTo(0, potH * 0.28 + 3 * scale, topW * 1.3, potH * 0.28);
    ctx.stroke();

    // Decorative rich gold bands
    ctx.strokeStyle = '#ffd36b';
    ctx.lineWidth = 3.5 * scale;
    ctx.beginPath();
    ctx.moveTo(-topW * 1.7, potH * 0.48);
    ctx.quadraticCurveTo(0, potH * 0.48 + 4 * scale, topW * 1.7, potH * 0.48);
    ctx.moveTo(-botW * 0.75, potH * 0.75);
    ctx.quadraticCurveTo(0, potH * 0.75 + 5 * scale, botW * 0.75, potH * 0.75);
    ctx.stroke();

    // Top clay nozzle rim
    ctx.fillStyle = '#1e0c05';
    ctx.beginPath();
    ctx.ellipse(0, 0, topW * 1.2, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing core inside nozzle
    ctx.fillStyle = '#fff4a0';
    ctx.shadowColor = '#ffd36b';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.ellipse(0, 0, topW * 0.7, 2.2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function sprayChichubuddi(x, y, age = 0) {
    // Swell curve: rises up to peak around 40-70% then gently falls
    const swell = Math.sin(Math.min(1, age * 1.15) * Math.PI);
    const count = Math.floor(4 + swell * 6);
    const maxVy = 7 + swell * 8;

    for (let i = 0; i < count; i++) {
      fx.spawn({
        x: x + rand(-8, 8),
        y: y,
        vx: rand(-2.4, 2.4) * (0.8 + swell * 0.4),
        vy: -rand(maxVy * 0.5, maxVy + 3),
        color: Math.random() < 0.65 ? PALETTE.gold : (Math.random() < 0.5 ? PALETTE.white : PALETTE.saffron),
        gravity: 0.26,
        decay: 0.022,
        size: rand(1.8, 3.2),
      });
    }

    if (swell > 0.35 && Math.random() < 0.22) {
      fx.spawn({
        x: x + rand(-4, 4),
        y: y,
        vx: rand(-3.5, 3.5),
        vy: -rand(8, 14),
        color: PALETTE.gold,
        gravity: 0.2,
        decay: 0.04,
        flash: 16,
      });
    }
  }

  function launchFingerRocket(tipX, tipY, h) {
    sfx.launch();
    const colors = [PALETTE.gold, PALETTE.green, PALETTE.saffron, PALETTE.pink, PALETTE.blue, PALETTE.violet];
    const color = colors[(Math.random() * colors.length) | 0];
    const startY = Math.min(tipY, h - DOCK_DEADZONE - 10);
    launch(fx, tipX, startY, {
      apexY: Math.max(h * 0.08, startY - h * rand(0.38, 0.52)),
      drift: rand(-20, 20),
      frames: 30,
      sound: false,
      onBurst: (bx, by) => {
        burst(fx, bx, by, { count: 100, speed: 4.8, colors: [color, PALETTE.white] });
        sfx.bang();
      },
    });
  }

  function burstHeart(bx, by) {
    sfx.bang();
    fx.spawn({ x: bx, y: by, flash: 140, color: 'rgba(255,180,220,0.95)', decay: 0.05, gravity: 0 });
    const count = 100;
    const colors = [PALETTE.pink, PALETTE.red, PALETTE.gold, PALETTE.white];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      // Parametric heart curve:
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      const speed = 0.28 * rand(0.9, 1.15);
      fx.spawn({
        x: bx,
        y: by,
        vx: hx * speed,
        vy: hy * speed,
        color: colors[i % colors.length],
        gravity: 0.035,
        decay: 0.012,
        size: rand(2.2, 3.2),
      });
    }
    setTimeout(() => sfx.chime(), 200);
  }

  function blastLaxmiBomb(x, y) {
    const { h } = fx.size();
    const clampedY = Math.min(y, h - DOCK_DEADZONE - 25);
    fx.shake(14);
    sfx.bang();
    burst(fx, x, clampedY, { count: 150, speed: 6.8, colors: [PALETTE.red, PALETTE.gold, PALETTE.saffron] });
    smoke(fx, x, clampedY, 18);
  }

  function triggerFinale(w, h, center) {
    wish.classList.remove('show');
    void wish.offsetWidth;
    wish.classList.add('show');
    sfx.outro();
    sfx.chime();
    setTimeout(() => sfx.volley(), 800);
    burst(fx, center.x, center.y, { count: 160, speed: 5.2, colors: [PALETTE.gold, PALETTE.white, PALETTE.saffron] });
    [0.18, 0.82, 0.35, 0.65, 0.5].forEach((xRatio, i) => {
      setTimeout(() => {
        launch(fx, w * xRatio, h - DOCK_DEADZONE - 10, {
          apexY: h * rand(0.1, 0.22),
          frames: 42,
          sound: false,
          onBurst: (bx, by) => {
            burst(fx, bx, by, { count: 125, speed: 4.8, colors: [PALETTE.gold, PALETTE.saffron, PALETTE.white] });
            sfx.smallBang();
          },
        });
      }, 850 + i * 360);
    });
    setTimeout(() => wish.classList.remove('show'), WISH_MS);
  }

  function triggerMahaVisphot(w, h) {
    const bottomY = h - DOCK_DEADZONE - 12;

    // 1. Audio Bed: 10,000-Wala machine-gun ladi crackle + fountain hiss + initial sky volley
    sfx.wala(10.5);
    sfx.fountain(10.0, 0.8);
    sfx.volley();
    fx.shake(16);

    // 2. Chichubuddi Fountains: 3 massive fountains (left, center, right) roaring for full 10s
    [0.18, 0.5, 0.82].forEach((xRatio, idx) => {
      const fxX = w * xRatio;
      const colors = idx === 1
        ? [PALETTE.gold, PALETTE.saffron, PALETTE.white]
        : (idx === 0 ? [PALETTE.green, PALETTE.gold] : [PALETTE.pink, PALETTE.gold]);
      fountain(fx, fxX, bottomY, { duration: 10000, height: idx === 1 ? 14 : 11, spread: 2.2, colors, rate: 16 });
    });

    // 3. Continuous 1000-Wala ground ladi crackles: rapid-fire micro-bursts along the ground every 85ms for 10s!
    for (let t = 0; t < 10000; t += 85) {
      setTimeout(() => {
        if (!root.classList.contains('active')) return;
        const popX = w * (0.12 + Math.random() * 0.76);
        const popY = bottomY - rand(5, 35);
        fx.spawn({
          x: popX,
          y: popY,
          flash: 26,
          color: Math.random() < 0.5 ? PALETTE.red : (Math.random() < 0.5 ? PALETTE.gold : PALETTE.white),
          decay: 0.08,
          gravity: 0,
        });
        burst(fx, popX, popY, {
          count: 14,
          speed: 3.2,
          colors: [PALETTE.red, PALETTE.gold, PALETTE.white],
          gravity: 0.12,
          decay: 0.04,
          size: 1.8,
        });
        if (Math.random() < 0.28) sfx.pop();
      }, t);
    }

    // 4. Heavy Laxmi Bombs & Atom Bombs exploding periodically across the screen with screen shakes:
    const bombTimes = [600, 1800, 3200, 4800, 6200, 7600, 9000, 10000];
    bombTimes.forEach((bt, i) => {
      setTimeout(() => {
        if (!root.classList.contains('active')) return;
        const bx = w * (0.2 + Math.random() * 0.6);
        const by = h * (0.32 + Math.random() * 0.38);
        fx.shake(i % 2 === 0 ? 18 : 14);
        if (i % 2 === 0) sfx.atom();
        else sfx.bang();
        burst(fx, bx, by, {
          count: 180,
          speed: 7.5,
          colors: [PALETTE.red, PALETTE.gold, PALETTE.saffron, PALETTE.white],
          decay: 0.014,
          size: 3.0,
        });
        smoke(fx, bx, by, 22);
      }, bt);
    });

    // 5. Sky Rockets barrage: 32+ multi-color rockets whistling up and blooming across the sky!
    const rocketColors = [PALETTE.gold, PALETTE.green, PALETTE.blue, PALETTE.pink, PALETTE.saffron, PALETTE.violet, PALETTE.white];
    for (let r = 0; r < 32; r++) {
      const delay = 250 + r * 300 + rand(-50, 50);
      setTimeout(() => {
        if (!root.classList.contains('active')) return;
        const rx = w * (0.1 + Math.random() * 0.8);
        const color = rocketColors[r % rocketColors.length];
        if (r % 4 === 0) sfx.launch();
        launch(fx, rx, bottomY, {
          apexY: h * rand(0.08, 0.3),
          drift: rand(-30, 30),
          frames: 32,
          sound: false,
          onBurst: (bx, by) => {
            burst(fx, bx, by, { count: 120, speed: 5.4, colors: [color, PALETTE.white, PALETTE.gold] });
            sfx.smallBang();
          },
        });
      }, delay);
    }

    // 6. Special Heart Shells at 4.2s and 8.0s:
    [4200, 8000].forEach((ht) => {
      setTimeout(() => {
        if (!root.classList.contains('active')) return;
        burstHeart(w * (0.3 + Math.random() * 0.4), h * 0.22);
      }, ht);
    });

    // 7. Grand Cataclysmic Finale (9.5s - 10.5s): Massive fan volley across the entire horizon!
    setTimeout(() => {
      if (!root.classList.contains('active')) return;
      sfx.volley();
      fx.shake(24);
      [0.15, 0.32, 0.5, 0.68, 0.85].forEach((xr, k) => {
        const cx = w * xr;
        launch(fx, cx, bottomY, {
          apexY: h * (0.08 + k * 0.02),
          drift: (xr - 0.5) * 80,
          frames: 35,
          sound: false,
          onBurst: (bx, by) => {
            burst(fx, bx, by, { count: 220, speed: 6.8, colors: [PALETTE.gold, PALETTE.saffron, PALETTE.white] });
            sfx.atom();
            smoke(fx, bx, by, 30);
          },
        });
      });
    }, 9500);
  }

  // Live 60fps loop: real-time particle emission, placed flowerpot rendering, and 1.5s hold progress feedback
  fx.onDraw((ctx) => {
    if (!root.classList.contains('active')) return;
    const { w, h } = fx.size();
    const now = performance.now();

    // Determine active and candidate gestures:
    const activeGesture = hands.special || hands.right?.gesture || hands.left?.gesture || null;
    const candidateGesture = hands.right?.candidate || hands.left?.candidate || null;
    const holdProgress = Math.max(hands.right?.holdProgress || 0, hands.left?.holdProgress || 0);
    const activeId = manualActive || activeGesture;

    // Mutually exclusive chip highlights + 1.5s dwell hold progress fill (including Namaskaram & Maha Visphot):
    legend.querySelectorAll('.mudra-chip:not(#draw-chip)').forEach((chip) => {
      const id = chip.dataset.id;
      const isActive = activeId === id;
      const isVisphotHolding = id === 'mahaVisphot' && (hands.visphotProgress || 0) > 0 && (hands.visphotProgress || 0) < 1;
      const isNamasteHolding = id === 'namaskaram' && (hands.namasteProgress || 0) > 0 && (hands.namasteProgress || 0) < 1;
      const isCandidateHolding = !(hands.visphotProgress > 0) && !(hands.namasteProgress > 0) && candidateGesture === id && holdProgress > 0 && holdProgress < 1;
      const isHolding = !isActive && (isVisphotHolding || isNamasteHolding || isCandidateHolding);
      chip.classList.toggle('active', isActive);
      chip.classList.toggle('holding', isHolding);
      if (isHolding) {
        const p = isVisphotHolding ? hands.visphotProgress : (isNamasteHolding ? hands.namasteProgress : holdProgress);
        chip.style.setProperty('--progress', `${(p * 100).toFixed(0)}%`);
      } else {
        chip.style.removeProperty('--progress');
      }
    });

    // Render and spray all placed flowerpots where the user planted them:
    activePots = activePots.filter((pot) => now - pot.startTime < pot.duration);
    activePots.forEach((pot) => {
      const age = (now - pot.startTime) / pot.duration;
      drawFlowerPot(ctx, pot.x, pot.y, 1.35);
      sprayChichubuddi(pot.x, pot.y, age);
    });

    // Render and manage active burning sparkler strokes:
    activeStrokes = activeStrokes.filter((st) => now - st.startTime < STROKE_DURATION_MS);
    const isAnyPinching = Boolean(currentHandStrokes.left || currentHandStrokes.right || currentPointerStrokes.size > 0);
    if (activeStrokes.length > 0 || isAnyPinching) {
      if (!sparklerSoundStop) sparklerSoundStop = sfx.sparklerLoop();
    } else if (sparklerSoundStop) {
      sparklerSoundStop();
      sparklerSoundStop = null;
    }

    activeStrokes.forEach((stroke) => {
      const age = (now - stroke.startTime) / STROKE_DURATION_MS;
      const intensity = Math.max(0, 1 - age * age);
      const pts = stroke.points;
      if (pts.length > 0) {
        drawSparklerPath(ctx, pts, intensity);

        // Crackling sparks along the burning sparkler path:
        if (intensity > 0.08) {
          const sparksCount = Math.min(3, Math.ceil(pts.length * 0.1));
          for (let s = 0; s < sparksCount; s++) {
            const pIdx = Math.floor(Math.random() * pts.length);
            const pt = pts[pIdx];
            sparkle(fx, pt.x, pt.y, 0.5);
          }
        }
      }
    });

    if (hands.tracking) {
      if (isDrawMode) {
        ['left', 'right'].forEach((side) => {
          const hand = hands[side];
          if (!hand?.visible || !hand.landmarks) {
            currentHandStrokes[side] = null;
            return;
          }
          const lm = hand.landmarks;
          const thumbTip = lm[4];
          const indexTip = lm[8];
          const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
          const isPinching = pinchDist < 0.085;
          const pinchX = ((thumbTip.x + indexTip.x) / 2) * w;
          const pinchY = ((thumbTip.y + indexTip.y) / 2) * h;

          // Sparkler tip cursor & bloom for each hand:
          ctx.save();
          ctx.beginPath();
          ctx.arc(pinchX, pinchY, isPinching ? 6.5 : 4, 0, Math.PI * 2);
          ctx.fillStyle = isPinching ? '#ffffff' : 'rgba(255, 211, 107, 0.85)';
          ctx.shadowColor = '#ffd36b';
          ctx.shadowBlur = isPinching ? 22 : 10;
          ctx.fill();
          ctx.restore();

          if (isPinching) {
            if (!currentHandStrokes[side]) {
              currentHandStrokes[side] = {
                id: Math.random(),
                side,
                points: [{ x: pinchX, y: pinchY }],
                startTime: now,
              };
              activeStrokes.push(currentHandStrokes[side]);
            } else {
              const pts = currentHandStrokes[side].points;
              const lastPt = pts[pts.length - 1];
              if (Math.hypot(pinchX - lastPt.x, pinchY - lastPt.y) > 2.5) {
                pts.push({ x: pinchX, y: pinchY });
              }
            }
            sparkle(fx, pinchX, pinchY, 1.4);
          } else {
            currentHandStrokes[side] = null;
          }
        });
      } else {
        ['left', 'right'].forEach((side) => {
          const hand = hands[side];
          if (!hand.visible || !hand.landmarks) return;
          const lm = hand.landmarks;

          if (hand.gesture === 'victory') {
            const bothActive = hands.left?.gesture === 'victory' && hands.right?.gesture === 'victory';
            const interval = bothActive ? 320 : 250;
            if (now - (lastRocketLaunch[side] || 0) > interval) {
              lastRocketLaunch[side] = now;
              const tx = lm[8].x * w;
              const ty = lm[8].y * h;
              launchFingerRocket(tx, ty, h);
            }
          }
        });
      }
    }
  });

  const getHandAnchor = (side = 'right') => {
    const { w, h } = fx.size();
    const targetSide = side === 'left' ? 'left' : (side === 'right' ? 'right' : null);
    const hand = targetSide && hands[targetSide]?.visible && hands[targetSide].landmarks
      ? hands[targetSide]
      : (hands.right?.visible && hands.right.landmarks
          ? hands.right
          : (hands.left?.visible && hands.left.landmarks ? hands.left : null));
    if (hand?.landmarks) {
      const lm = hand.landmarks;
      return {
        tip1: { x: lm[8].x * w, y: lm[8].y * h },
        tip2: { x: lm[12].x * w, y: lm[12].y * h },
        thumb: { x: lm[4].x * w, y: lm[4].y * h },
        palm: { x: lm[9].x * w, y: lm[9].y * h },
      };
    }
    const defaultX = side === 'left' ? w * 0.35 : w * 0.65;
    return {
      tip1: { x: defaultX, y: h * 0.6 },
      tip2: { x: defaultX, y: h * 0.6 },
      thumb: { x: defaultX, y: h * 0.62 },
      palm: { x: defaultX, y: h * 0.62 },
    };
  };

  const EFFECTS = {
    victory(d) {
      const { h } = fx.size();
      const anchor = getHandAnchor(d?.side);
      launchFingerRocket(anchor.tip1.x, anchor.tip1.y, h);
    },
    thumbsUp(d) {
      const { w, h } = fx.size();
      const anchor = getHandAnchor(d?.side);
      const px = d?.x != null ? d.x * w : anchor.thumb.x;
      const rawY = d?.y != null ? d.y * h : anchor.thumb.y;
      const potH = 65 * 1.35;
      const maxNozzleY = h - DOCK_DEADZONE - potH - 12;
      const py = Math.max(90, Math.min(rawY, maxNozzleY));
      placeFlowerpot(px, py);
    },
    fist(d) {
      const { w, h } = fx.size();
      const anchor = getHandAnchor(d?.side);
      const px = d?.palmX != null ? d.palmX * w : anchor.palm.x;
      const py = d?.palmY != null ? d.palmY * h : anchor.palm.y;
      blastLaxmiBomb(px, py);
    },
    iLoveYou(d) {
      const { w, h } = fx.size();
      const anchor = getHandAnchor(d?.side);
      const tipX = d?.landmarks ? d.landmarks[8].x * w : anchor.tip1.x;
      const tipY = d?.landmarks ? d.landmarks[8].y * h : anchor.tip1.y;
      sfx.launch();
      launch(fx, tipX, Math.min(tipY, h - DOCK_DEADZONE - 10), {
        apexY: Math.max(h * 0.12, tipY - h * 0.5),
        drift: 0,
        frames: 35,
        sound: false,
        onBurst: (bx, by) => burstHeart(bx, by),
      });
    },
    mahaVisphot() {
      const { w, h } = fx.size();
      triggerMahaVisphot(w, h);
    },
    namaskaram(d) {
      const { w, h } = fx.size();
      const center = d?.x && d?.y ? { x: d.x * w, y: d.y * h } : { x: w * 0.5, y: h * 0.45 };
      triggerFinale(w, h, center);
    },
  };

  function fire(id, detail) {
    const now = performance.now();
    const side = detail?.side || 'default';
    if (now - (lastFired[side] || 0) < COOLDOWN_MS || !EFFECTS[id]) return;
    lastFired[side] = now;

    // Set momentary manual active feedback:
    manualActive = id;
    clearTimeout(manualActiveTimer);
    manualActiveTimer = setTimeout(() => { manualActive = null; }, id === 'mahaVisphot' ? 10500 : 500);

    EFFECTS[id](detail);
  }

  legend.addEventListener('click', (e) => {
    const drawBtn = e.target.closest('#draw-chip');
    if (drawBtn) {
      e.stopPropagation();
      toggleDrawMode();
      return;
    }
    const chip = e.target.closest('.mudra-chip');
    if (chip && chip.dataset.id) {
      if (isDrawMode) toggleDrawMode(false);
      fire(chip.dataset.id);
    }
  });

  wish.addEventListener('click', (e) => {
    if (!e.target.closest('.wish-socials')) {
      wish.classList.remove('show');
    }
  });

  window.addEventListener('keydown', (e) => {
    if (!root.classList.contains('active')) return;
    if (e.key.toLowerCase() === 'd') {
      toggleDrawMode();
      return;
    }
    if (e.key.toLowerCase() === 'c' && isDrawMode) {
      clearAllStrokes();
      return;
    }
    const m = MUDRAS.find((x) => x.key === e.key.toLowerCase());
    if (m) {
      if (isDrawMode) toggleDrawMode(false);
      fire(m.id);
    }
  });

  bus.addEventListener('gesture', ({ detail }) => {
    if (root.classList.contains('active')) {
      if (isDrawMode) return; // Do not trigger crackers while drawing
      if (detail.name === 'victory' && hands.tracking) return;
      fire(detail.name, detail);
    }
  });

  return {
    enter() {
      stopAmbient = sfx.ambient();
      fx.setDeadzone(DOCK_DEADZONE);
    },
    leave() {
      fx.clear();
      stopAmbient();
      wish.classList.remove('show');
      manualActive = null;
      activePots = [];
      toggleDrawMode(false);
      clearAllStrokes();
    },
  };
}

function buildWish(el) {
  const petals = (n, r, len, color) => Array.from({ length: n }, (_, i) => `<ellipse cx="200" cy="${200 - r}" rx="${len * 0.35}" ry="${len}" fill="${color}" transform="rotate(${(360 / n) * i} 200 200)"/>`).join('');
  const diyas = Array.from({ length: 11 }, (_, i) => {
    const a = Math.PI + (i / 10) * Math.PI;
    return `<span class="wish-diya" style="--i:${i};left:${50 + Math.cos(a) * 46}%;top:${58 + Math.sin(a) * 40}%"></span>`;
  }).join('');
  const title = 'Happy Deepavali'.split('').map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  el.innerHTML = `
    <svg class="wish-mandala" viewBox="0 0 400 400" aria-hidden="true">
      ${petals(24, 150, 34, 'rgba(255,154,60,.22)')}${petals(16, 108, 30, 'rgba(255,122,217,.2)')}${petals(12, 66, 26, 'rgba(255,211,107,.28)')}
      <circle cx="200" cy="200" r="182" fill="none" stroke="rgba(255,211,107,.35)" stroke-dasharray="2 8" stroke-width="3"/>
    </svg>
    <div class="wish-diyas" aria-hidden="true">${diyas}</div>
    <p class="wish-by">by The SurfBoard</p>
    <h2 aria-label="Happy Deepavali">${title}</h2>
    <blockquote>May the light you kindle tonight find its way into every home still waiting in the dark.</blockquote>
    <div class="wish-socials" aria-label="Follow The SurfBoard">
      <span class="socials-label">Follow us</span>
      <a href="https://www.instagram.com/the_surfboard/" target="_blank" rel="noopener noreferrer" class="social-pill social-insta" title="Follow @the_surfboard on Instagram">
        <svg class="social-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
        </svg>
        <span>@the_surfboard</span>
      </a>
      <a href="https://www.youtube.com/@the_surfboard" target="_blank" rel="noopener noreferrer" class="social-pill social-yt" title="Subscribe to @the_surfboard on YouTube">
        <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
        <span>YouTube</span>
      </a>
    </div>`;
}
