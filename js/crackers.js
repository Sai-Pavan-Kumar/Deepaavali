import { burst, fountain, smoke, rand, randomColor, PALETTE } from './fx.js';
import { sfx, play } from './sfx.js';

// One drawing per cracker, used by the shop, the road and the effect anchor,
// so what you place is exactly what burns. A shared "shade" overlay gives every
// paper tube the same cylindrical light, which is what makes them read as 3D.
let uid = 0;
const shade = (id) => `<linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".32" stop-color="#fff" stop-opacity=".35"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient>`;
const tube = (x, y, w, h, fill, s, rx = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#${s})"/>`;
const fuse = (x, y, dx = 4) => `<path d="M${x} ${y} q${dx} -6 ${dx * 0.4} -12" stroke="#d8c08a" stroke-width="1.6" fill="none" stroke-dasharray="2 1.4"/>`;

const SHAPES = {
  rocket: (a, b, s) => `
    <path d="M24 40 Q22 50 26 62 H38 Q42 50 40 40 Q38 34 35 32 V26 H29 V32 Q26 34 24 40Z" fill="#7fb8a8" opacity=".35" stroke="#bfe6da" stroke-opacity=".5"/>
    <path d="M32 54 V20" stroke="#b08a5a" stroke-width="2"/>
    ${tube(28, 10, 8, 18, a, s)}<path d="M28 10 L32 2 L36 10Z" fill="${b}"/><rect x="28" y="16" width="8" height="3" fill="${b}"/>${fuse(32, 28, -3)}`,
  box: (a, b, s) => `${tube(10, 22, 44, 36, a, s, 3)}<rect x="10" y="22" width="44" height="7" fill="${b}"/>
    ${[0, 1, 2, 3].map((i) => `<ellipse cx="${17 + i * 10}" cy="22" rx="4" ry="2" fill="#1a1010"/>`).join('')}<text x="32" y="47" font-size="9" font-weight="900" text-anchor="middle" fill="${b}" font-family="sans-serif">12</text>${fuse(54, 40, 4)}`,
  cone: (a, b, s) => `<path d="M18 58 L27 14 H37 L46 58Z" fill="${a}"/><path d="M18 58 L27 14 H37 L46 58Z" fill="url(#${s})"/>
    <path d="M23 34 H41 M21 46 H43" stroke="${b}" stroke-width="3.5"/><ellipse cx="32" cy="58" rx="14" ry="3.5" fill="#5a3a20"/><ellipse cx="32" cy="14" rx="5" ry="1.6" fill="#3a2010"/>${fuse(32, 13, 3)}`,
  disc: (a, b) => `<g class="spin-disc"><ellipse cx="32" cy="42" rx="24" ry="9" fill="none" stroke="${a}" stroke-width="7"/><ellipse cx="32" cy="42" rx="24" ry="9" fill="none" stroke="${b}" stroke-width="7" stroke-dasharray="7 9" class="disc-stripes"/></g>
    <ellipse cx="32" cy="42" rx="5" ry="2" fill="#d9c49a"/>${fuse(56, 40, 4)}`,
  stick: (a, b, s) => `<path d="M32 62 V30" stroke="#8a6a3a" stroke-width="2.4"/>${tube(29, 8, 6, 26, a, s, 3)}<path d="M29 14 H35 M29 22 H35" stroke="${b}" stroke-width="2"/>${fuse(32, 8, 3)}`,
  wand: (a) => `<path d="M32 62 V6" stroke="#9a9aa6" stroke-width="2"/><path d="M32 30 V6" stroke="${a}" stroke-width="5" stroke-linecap="round"/>`,
  ball: (a, b, s) => `<circle cx="32" cy="42" r="15" fill="${a}"/><circle cx="32" cy="42" r="15" fill="url(#${s})"/><path d="M18 40 Q32 48 46 40" stroke="${b}" stroke-width="3" fill="none"/>${fuse(32, 27, 3)}`,
  bomb: (a, b, s) => `${tube(14, 30, 36, 26, a, s, 4)}<rect x="14" y="38" width="36" height="9" fill="${b}"/><circle cx="32" cy="42.5" r="6" fill="#fff4dc"/><circle cx="32" cy="42.5" r="3.5" fill="${a}"/>
    <path d="M14 34 H50" stroke="#000" stroke-opacity=".2"/>${fuse(32, 30, 4)}`,
  chain: (a, b, s) => `<path d="M2 50 Q32 44 62 50" stroke="#4a3018" stroke-width="1.5" fill="none"/>
    ${Array.from({ length: 10 }, (_, i) => `<g transform="rotate(${i % 2 ? 22 : -22} ${5 + i * 6} 48)">${tube(2 + i * 6, 40, 6, 14, i % 2 ? a : b, s, 1.5)}</g>`).join('')}${fuse(62, 49, 3)}`,
};

export function crackerIcon(cracker, size = 64) {
  const s = `shade-${cracker.id}-${uid++}`;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs>${shade(s)}</defs>${SHAPES[cracker.shape](cracker.colors[0], cracker.colors[1], s)}</svg>`;
}

// ---- Effects. `spot` = { x, top, base, el? }: top is the fuse/mouth, base the ground contact. ----

function drawRocketSprite(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#e2463a';
  ctx.fillRect(-3, -9, 6, 14);
  ctx.fillStyle = '#ffd36b';
  ctx.beginPath();
  ctx.moveTo(-3, -9); ctx.lineTo(0, -15); ctx.lineTo(3, -9);
  ctx.fill();
  ctx.restore();
}

/** Rocket body physically leaves the bottle and climbs; the burst happens where it actually is. */
export function launch(fx, x, y, { apexY, drift = rand(-80, 80), frames = 60, onBurst, sound = true }) {
  if (sound) sfx.rocket();
  let f = 0;
  let px = x;
  let py = y;
  fx.repeat(16, frames * 16 + 16, () => {
    if (f >= frames) return;
    f++;
    const k = f / frames;
    const nx = x + drift * k * k;
    const ny = y + (apexY - y) * (1 - (1 - k) ** 2);
    const angle = Math.atan2(ny - py, nx - px) + Math.PI / 2;
    fx.paint((ctx) => drawRocketSprite(ctx, nx, ny, angle));
    for (let i = 0; i < 3; i++) fx.spawn({ x: nx, y: ny + 6, vx: rand(-0.6, 0.6), vy: rand(0.6, 2), color: i ? PALETTE.saffron : PALETTE.white, decay: 0.045, size: 2 });
    px = nx;
    py = ny;
    if (f === frames) onBurst(nx, ny);
  });
}

function aerial(fx, spot, burstFn, { apex = rand(0.1, 0.28), sound = true } = {}) {
  const { h } = fx.size();
  if (spot.el) spot.el.classList.add('launched');
  launch(fx, spot.x, spot.top, { apexY: h * apex, sound, onBurst: (bx, by) => { burstFn(bx, by); sfx.smallBang(); } });
}

export const CRACKERS = [
  { id: 'rocket', name: 'Rocket', local: 'Rocket Baanam', shape: 'rocket', colors: ['#e2463a', '#ffd36b'], fuseMs: 900, burnMs: 2200,
    ignite: (fx, spot) => aerial(fx, spot, (x, y) => burst(fx, x, y, { count: 120, speed: 5.5 })) },
  { id: 'skyshot', name: '12 Shot Sky King', local: 'Sky Shot', shape: 'box', colors: ['#24307a', '#ffb347'], fuseMs: 1100, burnMs: 7600,
    ignite: (fx, spot) => {
      sfx.volley();
      for (let i = 0; i < 12; i++) setTimeout(() => {
        sfx.smallBang();
        const tint = [randomColor(), PALETTE.white];
        launch(fx, spot.x + rand(-6, 6), spot.top, { apexY: fx.size().h * rand(0.12, 0.35), frames: 38, drift: rand(-120, 120), sound: false, onBurst: (x, y) => burst(fx, x, y, { count: 70, speed: 4.2, colors: tint }) });
      }, i * 560);
    } },
  { id: 'peacock', name: 'Mayura Shell', local: 'Nemali Pinchham', shape: 'rocket', colors: ['#0f7a6a', '#7cc8ff'], fuseMs: 900, burnMs: 3200,
    ignite: (fx, spot) => aerial(fx, spot, (x, y) => burst(fx, x, y, { count: 170, speed: 4.2, gravity: 0.08, decay: 0.007, colors: [PALETTE.green, PALETTE.blue, PALETTE.gold] })) },
  { id: 'rangoli', name: 'Rangoli Shell', local: 'Muggu Shell', shape: 'rocket', colors: ['#b0307a', '#fff4dc'], fuseMs: 900, burnMs: 3200,
    ignite: (fx, spot) => aerial(fx, spot, (x, y) => { burst(fx, x, y, { count: 80, speed: 5.4, colors: [PALETTE.pink] }); burst(fx, x, y, { count: 40, speed: 2.6, colors: [PALETTE.gold] }); }) },
  { id: 'bhoochakram', name: 'Bhoo Chakram', local: 'Bhoochakram', shape: 'disc', colors: ['#2e8b3a', '#ffd36b'], fuseMs: 800, burnMs: 5200,
    ignite: (fx, spot) => {
      sfx.spinner(5);
      spot.el?.classList.add('spinning');
      let angle = 0;
      fx.repeat(16, 5000, () => {
        angle += 0.6;
        const cx = spot.x;
        const cy = spot.base - 10;
        for (let i = 0; i < 4; i++) {
          const a = angle + i * (Math.PI / 2);
          fx.spawn({ x: cx + Math.cos(a) * 20, y: cy + Math.sin(a) * 7, vx: -Math.sin(a) * 5, vy: Math.cos(a) * 1.6 - 0.8, color: i % 2 ? PALETTE.gold : PALETTE.green, gravity: 0.1, decay: 0.045, size: 1.8 });
        }
      });
    } },
  { id: 'chichubuddi', name: 'Chichubuddi', local: 'Flower Pot', shape: 'cone', colors: ['#c8452c', '#ffe08a'], fuseMs: 800, burnMs: 5600,
    ignite: (fx, spot) => { sfx.fountain(5.4, 0.72); fountain(fx, spot.x, spot.top, { duration: 5400, height: 12, spread: 1.5 }); } },
  { id: 'pencil', name: 'Colour Pencil', local: 'Pencil', shape: 'stick', colors: ['#7a3fd1', '#86ff9e'], fuseMs: 600, burnMs: 4200,
    ignite: (fx, spot) => { sfx.fountain(4, 1.3); fountain(fx, spot.x, spot.top, { duration: 4000, height: 7, spread: 0.7, colors: [PALETTE.green, PALETTE.violet, PALETTE.red], rate: 20 }); } },
  { id: 'twinkle', name: 'Twinkling Star', local: 'Mitukula Chukka', shape: 'ball', colors: ['#d8c32b', '#2a2a6a'], fuseMs: 700, burnMs: 4800,
    ignite: (fx, spot) => {
      sfx.twinkle(4.5);
      fx.repeat(45, 4500, () => fx.spawn({ x: spot.x + rand(-60, 60), y: spot.top - rand(0, 120), flash: rand(6, 14), color: Math.random() < 0.5 ? PALETTE.white : PALETTE.gold, gravity: 0, decay: 0.08 }));
    } },
  { id: 'laxmi', name: 'Laxmi Bomb', local: 'Laxmi Bomb', shape: 'bomb', colors: ['#d23a2a', '#ffd36b'], fuseMs: 1600, burnMs: 1200,
    ignite: (fx, spot) => {
      sfx.bang();
      fx.shake(10);
      spot.el?.classList.add('blown');
      burst(fx, spot.x, spot.base - 14, { count: 80, speed: 7, colors: [PALETTE.white, PALETTE.gold], gravity: 0.22, decay: 0.05 });
      paperShreds(fx, spot, ['#d23a2a', '#ffd36b']);
      smoke(fx, spot.x, spot.base - 20, 16);
    } },
  { id: 'atom', name: 'Atom Bomb', local: 'Atom Bomb', shape: 'bomb', colors: ['#1c1c24', '#ff5a4d'], fuseMs: 2200, burnMs: 1600,
    ignite: (fx, spot) => {
      sfx.atom();
      fx.shake(22);
      spot.el?.classList.add('blown');
      fx.spawn({ x: spot.x, y: spot.base - 20, flash: 460, color: 'rgba(255,240,210,0.95)', decay: 0.035, gravity: 0 });
      burst(fx, spot.x, spot.base - 14, { count: 150, speed: 10, colors: [PALETTE.white, PALETTE.saffron], gravity: 0.25, decay: 0.035 });
      paperShreds(fx, spot, ['#1c1c24', '#ff5a4d']);
      smoke(fx, spot.x, spot.base - 20, 34);
    } },
  { id: 'thousandwala', name: '1000 Wala', local: 'Veyyi Wala', shape: 'chain', colors: ['#c8452c', '#2e8b3a'], fuseMs: 900, burnMs: 6200, wide: true,
    ignite: (fx, spot) => {
      sfx.wala(6);
      spot.el?.classList.add('eating');
      const width = spot.width || 200;
      fx.repeat(40, 6000, (p) => {
        // The pops run from the fuse end (right) back along the string, like the real thing.
        const px = spot.x + width / 2 - p * width;
        fx.spawn({ x: px, y: spot.base - 12 - rand(0, 10), flash: rand(14, 30), color: PALETTE.white, decay: 0.14, gravity: 0 });
        for (let k = 0; k < 4; k++) fx.spawn({ x: px, y: spot.base - 12, vx: rand(-3, 3), vy: rand(-4, -1), color: k ? '#c8452c' : PALETTE.gold, gravity: 0.2, decay: 0.05, size: 1.4 });
      });
      smoke(fx, spot.x, spot.base - 20, 20);
    } },
  { id: 'sparkler', name: 'Kaakaruthulu', local: 'Sparkler', shape: 'wand', colors: ['#6e6e7c', '#c9c9d6'], fuseMs: 0, burnMs: 20000, handheld: true, ignite: () => {} },
];

function paperShreds(fx, spot, colors) {
  for (let i = 0; i < 30; i++) {
    fx.spawn({ x: spot.x, y: spot.base - 14, vx: rand(-5, 5), vy: rand(-8, -2), color: colors[i % 2], gravity: 0.25, drag: 0.96, decay: 0.012, size: 3 });
  }
}

export function sparkle(fx, x, y, intensity = 1) {
  for (let i = 0; i < 6 * intensity; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(1.5, 5);
    fx.spawn({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color: Math.random() < 0.7 ? PALETTE.white : PALETTE.gold, gravity: 0.08, decay: 0.07, size: 1.3 });
  }
}

export const crackerById = (id) => CRACKERS.find((c) => c.id === id);

/** Far-off fireworks over the rooftops: quiet and delayed, so the night never feels empty. */
export function distantSky(fx) {
  let wait = 1500;
  return (dt) => {
    wait -= dt;
    if (wait > 0) return;
    wait = rand(2200, 5000);
    const { w, h } = fx.size();
    burst(fx, rand(w * 0.05, w * 0.95), rand(h * 0.06, h * 0.28), { count: 50, speed: 2.4, decay: 0.016 });
    play('bomb', { rate: 1.4, gain: 0.18, delay: 0.25 });
  };
}
