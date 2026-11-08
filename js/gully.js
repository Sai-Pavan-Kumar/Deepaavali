import { createFx } from './fx.js';
import { sfx } from './sfx.js';
import { hands, drawHand, bindPointer, bus } from './hands.js?v=14';
import { CRACKERS, crackerIcon, crackerById, sparkle, distantSky } from './crackers.js';
import { COLONY_SVG, CANDLE_SVG } from './art.js';
import { createRoad, svgToStage } from './gully-road.js';

// Dwell times are the "feel" of real lighting: a quick touch never works.
const DWELL = { agarbatti: 500, candle: 1300, sparklerToSparkler: 3000, box: 400, pick: 550 };
const REACH = 0.05; // ignition radius as a fraction of stage height
const SPARKLER_MS = 20000;
const CANDLE_AT = { x: 150, y: 700 }; // on the left footpath, in street SVG coords

export function initGully(root) {
  root.querySelector('.colony').innerHTML = COLONY_SVG;
  const candle = root.querySelector('.candle');
  candle.innerHTML = CANDLE_SVG;
  const fx = createFx(root.querySelector('canvas'));
  const road = createRoad(root, root.querySelector('.road-items'));
  const shop = root.querySelector('.shop');
  const box = root.querySelector('.pataka-box');
  const chip = root.querySelector('[data-hand-switch]');
  const toast = root.querySelector('.toast');
  const onboarding = root.querySelector('#gully-onboarding');
  const gotItBtn = root.querySelector('#gully-got-it');
  const skyTick = distantSky(fx);

  function dismissOnboarding() {
    if (onboarding?.classList.contains('active')) {
      onboarding.classList.remove('active');
      sessionStorage.setItem('gully_onboarded', '1');
    }
  }

  gotItBtn?.addEventListener('click', dismissOnboarding);
  onboarding?.addEventListener('click', (e) => {
    if (e.target === onboarding) dismissOnboarding();
  });

  const tools = { left: null, right: { kind: 'agarbatti' } };
  const dwellState = { box: { dwell: 0 }, pick: { dwell: 0, id: null } };
  let activeSide = 'right';
  let stopAmbient = () => {};
  const rings = [];

  shop.innerHTML = CRACKERS.map((c, i) => `
    <button class="shop-item" data-id="${c.id}" style="--i:${i}">
      <span class="shop-art">${crackerIcon(c, 60)}</span><span class="shop-name">${c.name}</span><span class="shop-local">${c.local}</span>
    </button>`).join('');

  function say(text) {
    toast.textContent = text;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
  }

  function setActive(side) {
    activeSide = side;
    chip.textContent = `Mouse moves: ${side === 'right' ? 'Right' : 'Left'} hand · Q to switch`;
  }

  function openShop(open) {
    shop.classList.toggle('open', open);
    box.setAttribute('aria-expanded', String(open));
  }

  function pick(id) {
    const cracker = crackerById(id);
    openShop(false);
    if (cracker.handheld) return takeSparkler();
    if (!road.place(cracker)) return say('Road is full. Light what is there first.');
    say(`${cracker.name} is on the road. Touch its fuse with the agarbatti.`);
  }

  function takeSparkler() {
    const sparkler = { kind: 'sparkler', lit: false, burnt: 0, dwell: 0, stopSound: null };
    if (!tools.left) {
      tools.left = sparkler;
      if (!hands.tracking) setActive('left');
      return say('Sparkler in your left hand. Hold its tip in the candle flame.');
    }
    tools.right = sparkler;
    if (!hands.tracking) setActive('right');
    say('Second sparkler. Touch it to the lit one and hold for 3 seconds.');
  }

  function placeCandle() {
    const stage = root.getBoundingClientRect();
    const p = svgToStage(stage, CANDLE_AT.x, CANDLE_AT.y);
    // On narrow phones the left footpath is cropped away; keep the candle reachable on screen.
    const x = Math.max(p.x, stage.width * 0.12);
    Object.assign(candle.style, { left: `${x}px`, top: `${p.y}px`, height: `${Math.max(130 * p.scale, stage.height * 0.1)}px` });
  }

  function candleFlame() {
    const r = candle.getBoundingClientRect();
    const s = root.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height * 0.3 };
  }

  const near = (a, b, h) => a && b && Math.hypot(a.x - b.x, a.y - b.y) < REACH * h;

  // Contact time decides; stepping away bleeds it out slowly instead of resetting.
  function dwell(target, touching, dt, needed, at) {
    target.dwell = touching ? target.dwell + dt : Math.max(0, target.dwell - dt * 2);
    if (target.dwell > 0 && at) rings.push({ ...at, p: Math.min(1, target.dwell / needed) });
    return target.dwell >= needed;
  }

  function updateSparkler(side, tip, otherTip, dt, h) {
    const tool = tools[side];
    if (tool.lit) {
      tool.burnt += dt / SPARKLER_MS;
      sparkle(fx, tip.x, tip.y, 1.3);
      if (tool.burnt >= 1) {
        tool.stopSound?.();
        tools[side] = side === 'right' ? { kind: 'agarbatti' } : null;
        if (!hands.tracking) setActive('right');
      }
      return;
    }
    const other = tools[side === 'left' ? 'right' : 'left'];
    const byCandle = near(tip, candleFlame(), h);
    const bySparkler = other?.kind === 'sparkler' && other.lit && near(tip, otherTip, h);
    if (dwell(tool, byCandle || bySparkler, dt, bySparkler ? DWELL.sparklerToSparkler : DWELL.candle, tip)) {
      tool.lit = true;
      tool.stopSound = sfx.sparklerLoop();
      say('Lit! Wave it around.');
    }
  }

  function handPoint(side, w, h) {
    const s = root.getBoundingClientRect();
    return { x: hands[side].x * w + s.left, y: hands[side].y * h + s.top };
  }

  // Webcam path: the left hand rests on the box to open it and hovers a cracker to pick it.
  function handleBoxAndShop(dt, w, h) {
    if (!hands.left.visible) return;
    const p = handPoint('left', w, h);
    const r = box.getBoundingClientRect();
    const onBox = p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;
    const s = root.getBoundingClientRect();
    if (!shop.classList.contains('open')) {
      if (dwell(dwellState.box, onBox, dt, DWELL.box, onBox ? { x: p.x - s.left, y: p.y - s.top } : null)) {
        dwellState.box.dwell = 0;
        openShop(true);
      }
      return;
    }
    if (!hands.tracking) return;
    const btn = document.elementFromPoint(p.x, p.y)?.closest('.shop-item');
    if (btn?.dataset.id !== dwellState.pick.id) dwellState.pick = { dwell: 0, id: btn?.dataset.id };
    if (btn && dwell(dwellState.pick, true, dt, DWELL.pick, { x: p.x - s.left, y: p.y - s.top })) pick(btn.dataset.id);
  }

  fx.onDraw((ctx, dt) => {
    if (!root.classList.contains('active')) return;
    const { w, h } = fx.size();
    rings.length = 0;
    skyTick(dt);
    if (onboarding?.classList.contains('active') && (hands.left?.landmarks || hands.right?.landmarks)) {
      dismissOnboarding();
    }
    const leftTip = drawHand(ctx, 'left', tools.left, w, h);
    const rightTip = drawHand(ctx, 'right', tools.right, w, h);
    if (tools.right?.kind === 'agarbatti' && rightTip && Math.random() < 0.25) {
      fx.spawn({ x: rightTip.x, y: rightTip.y, vy: -0.6, vx: 0.2, color: 'rgba(200,200,210,0.1)', flash: 9, gravity: -0.01, decay: 0.01 });
    }
    if (tools.left?.kind === 'sparkler' && leftTip) updateSparkler('left', leftTip, rightTip, dt, h);
    if (tools.right?.kind === 'sparkler' && rightTip) updateSparkler('right', rightTip, leftTip, dt, h);
    const igniters = [];
    if (tools.right?.kind === 'agarbatti') igniters.push(rightTip);
    if (tools.left?.lit) igniters.push(leftTip);
    if (tools.right?.lit) igniters.push(rightTip);
    road.idle().forEach((item) => {
      const at = road.fusePoint(item);
      if (dwell(item, igniters.some((tip) => near(tip, at, h)), dt, DWELL.agarbatti, at)) road.light(fx, item);
    });
    handleBoxAndShop(dt, w, h);
    drawRings(ctx, rings, h);
  });

  box.addEventListener('click', () => openShop(!shop.classList.contains('open')));
  shop.addEventListener('click', (e) => {
    const btn = e.target.closest('.shop-item');
    if (btn) pick(btn.dataset.id);
  });
  chip.addEventListener('click', () => setActive(activeSide === 'right' ? 'left' : 'right'));
  window.addEventListener('keydown', (e) => {
    if (root.classList.contains('active') && e.key.toLowerCase() === 'q') setActive(activeSide === 'right' ? 'left' : 'right');
  });
  bindPointer(root.querySelector('.gully-input'), () => activeSide);
  new ResizeObserver(() => {
    placeCandle();
    road.relayout();
  }).observe(root);
  bus.addEventListener('tracking', ({ detail }) => chip.toggleAttribute('hidden', detail));

  return {
    enter() {
      hands.left.visible = true;
      hands.right.visible = true;
      hands.lastPointerTime = performance.now();
      placeCandle();
      stopAmbient = sfx.ambient();
      if (!sessionStorage.getItem('gully_onboarded')) {
        onboarding?.classList.add('active');
      }
      say(hands.tracking ? '🙌 Hands painaki ettandi · Raise hands in front of camera!' : 'Tap Pataka Box to pick crackers · Move mouse to light');
    },
    leave() {
      fx.clear();
      road.clear();
      stopAmbient();
      ['left', 'right'].forEach((side) => tools[side]?.stopSound?.());
      tools.left = null;
      tools.right = { kind: 'agarbatti' };
      setActive('right');
      openShop(false);
    },
  };
}

function drawRings(ctx, rings, h) {
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  rings.forEach(({ x, y, p }) => {
    ctx.strokeStyle = 'rgba(255,211,107,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, h * 0.03, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,211,107,1)';
    ctx.beginPath();
    ctx.arc(x, y, h * 0.03, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
  });
}
