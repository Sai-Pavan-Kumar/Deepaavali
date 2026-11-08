// Road placement and ignition for Gully Patakha. Crackers are placed in the
// street's own perspective (smaller when farther), keep the orientation they
// were placed in, and the effect comes out of the exact cracker you lit.
import { crackerIcon } from './crackers.js';
import { sfx } from './sfx.js';
import { PALETTE } from './fx.js';

const VIEW = { w: 1600, h: 900, horizon: 420 };
// Spots on the road in SVG coordinates, nearest first. The box sits below 820.
const SLOTS = [
  { x: 640, y: 760 }, { x: 960, y: 760 }, { x: 800, y: 700 },
  { x: 700, y: 650 }, { x: 900, y: 650 }, { x: 600, y: 690 }, { x: 1000, y: 690 },
];
// Fuse tip and "mouth" (where the effect leaves) per shape, in the 64-unit icon space.
const POINTS = {
  rocket: { fuse: [30, 30], mouth: [32, 6] },
  box: { fuse: [56, 30], mouth: [32, 22] },
  cone: { fuse: [33, 3], mouth: [32, 14] },
  disc: { fuse: [58, 30], mouth: [32, 42] },
  stick: { fuse: [33, 0], mouth: [32, 8] },
  ball: { fuse: [33, 17], mouth: [32, 30] },
  bomb: { fuse: [34, 20], mouth: [32, 42] },
  chain: { fuse: [63, 38], mouth: [32, 48] },
};

/** Maps SVG coords to stage px, matching preserveAspectRatio="xMidYMax slice". */
export function svgToStage(stage, x, y) {
  const scale = Math.max(stage.width / VIEW.w, stage.height / VIEW.h);
  return { x: (stage.width - VIEW.w * scale) / 2 + x * scale, y: stage.height - VIEW.h * scale + y * scale, scale };
}

export function createRoad(root, layer) {
  let items = [];

  function place(cracker) {
    const used = new Set(items.map((it) => it.slot));
    const slot = SLOTS.find((s) => !used.has(s));
    if (!slot) return null;
    const el = document.createElement('div');
    el.className = `road-item shape-${cracker.shape}`;
    el.innerHTML = crackerIcon(cracker, 64);
    layer.appendChild(el);
    const item = { cracker, slot, el, state: 'idle', dwell: 0 };
    items.push(item);
    layout(item);
    return item;
  }

  function layout(item) {
    const stage = root.getBoundingClientRect();
    const { x, y, scale } = svgToStage(stage, item.slot.x, item.slot.y);
    const depth = (item.slot.y - VIEW.horizon) / (VIEW.h - VIEW.horizon); // 0 far .. 1 near
    const size = 150 * depth * scale * (item.cracker.wide ? 2.6 : 1);
    Object.assign(item.el.style, { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${item.cracker.wide ? size / 2.6 : size}px` });
    item.size = size;
  }

  function point(item, which) {
    const stage = root.getBoundingClientRect();
    const r = item.el.getBoundingClientRect();
    const [px, py] = POINTS[item.cracker.shape][which];
    return { x: r.left - stage.left + (px / 64) * r.width, y: r.top - stage.top + (py / 64) * r.height };
  }

  function spot(item) {
    const stage = root.getBoundingClientRect();
    const r = item.el.getBoundingClientRect();
    return { x: r.left - stage.left + r.width / 2, top: point(item, 'mouth').y, base: r.bottom - stage.top, width: r.width, el: item.el };
  }

  function light(fx, item) {
    item.state = 'fusing';
    item.el.classList.add('fusing');
    sfx.fuse(item.cracker.fuseMs / 1000);
    fx.repeat(30, item.cracker.fuseMs, () => {
      const at = point(item, 'fuse');
      fx.spawn({ x: at.x, y: at.y, vx: (Math.random() - 0.5) * 2.4, vy: -Math.random() * 2.4, color: PALETTE.gold, decay: 0.07, size: 1.3 });
    });
    setTimeout(() => {
      item.el.classList.remove('fusing');
      item.cracker.ignite(fx, spot(item));
      setTimeout(() => remove(item), item.cracker.burnMs);
    }, item.cracker.fuseMs);
  }

  function remove(item) {
    item.el.classList.add('gone');
    setTimeout(() => item.el.remove(), 600);
    items = items.filter((it) => it !== item);
  }

  return {
    place,
    light,
    fusePoint: (item) => point(item, 'fuse'),
    idle: () => items.filter((it) => it.state === 'idle'),
    relayout: () => items.forEach(layout),
    clear() {
      items.forEach((it) => it.el.remove());
      items = [];
    },
  };
}
