// Hand-drawn SVG art. Original designs inspired by Telugu-state Narakasura effigies:
// horned crown, handlebar moustache, striped dhoti, sword and shield, bamboo scaffold.
export const NARAKASURA_SVG = `
<svg viewBox="0 0 240 520" class="effigy-svg" aria-label="Narakasura effigy">
  <defs>
    <linearGradient id="skin" x1="0" x2="1"><stop offset="0" stop-color="#e8b04a"/><stop offset="1" stop-color="#c98a2a"/></linearGradient>
    <linearGradient id="gold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#c8902a"/></linearGradient>
  </defs>
  <g stroke="#6b4a26" stroke-width="3" opacity=".55">
    <path d="M70 120V510M170 120V510M60 200H180M60 300H180M60 400H180M70 200L170 300M170 200L70 300M70 300L170 400"/>
  </g>
  <rect x="62" y="470" width="116" height="40" fill="#3a3f4a"/>
  <g class="effigy-body">
    <path d="M78 40 Q40 30 30 0 Q58 22 84 26Z M162 40 Q200 30 210 0 Q182 22 156 26Z" fill="#efe6d2" stroke="#8a7a5a" stroke-width="2"/>
    <path d="M84 52 L92 14 L108 34 L120 6 L132 34 L148 14 L156 52Z" fill="url(#gold)" stroke="#8a5a1a" stroke-width="2"/>
    <circle cx="120" cy="40" r="6" fill="#1fa36a"/>
    <path d="M82 52 H158 V104 Q120 132 82 104Z" fill="url(#skin)"/>
    <path d="M88 70 Q100 62 112 70 M128 70 Q140 62 152 70" stroke="#2a1608" stroke-width="4" fill="none"/>
    <ellipse cx="100" cy="78" rx="7" ry="5" fill="#fff"/><ellipse cx="140" cy="78" rx="7" ry="5" fill="#fff"/>
    <circle cx="101" cy="78" r="3" fill="#2a1608"/><circle cx="139" cy="78" r="3" fill="#2a1608"/>
    <path d="M114 56 V64 M120 54 V66 M126 56 V64" stroke="#d2321e" stroke-width="2.5"/>
    <path d="M120 92 Q100 88 86 96 Q72 100 70 88 Q84 102 100 94 Q112 90 120 96 Q128 90 140 94 Q156 102 170 88 Q168 100 154 96 Q140 88 120 92Z" fill="#1a0e06"/>
    <path d="M110 108 Q120 112 130 108" stroke="#8a1a10" stroke-width="3" fill="none"/>
    <path d="M70 130 Q120 116 170 130 L176 230 H64Z" fill="url(#skin)"/>
    <path d="M78 134 Q120 168 162 134" stroke="#d2321e" stroke-width="7" fill="none"/>
    <path d="M84 140 Q120 178 156 140" stroke="#ffd36b" stroke-width="5" fill="none" stroke-dasharray="3 6"/>
    <circle cx="120" cy="168" r="9" fill="#1fa36a" stroke="#ffd36b" stroke-width="3"/>
    <path d="M66 136 L30 230 L44 236 L76 160Z M174 136 L210 230 L196 236 L164 160Z" fill="url(#skin)"/>
    <path d="M34 226 h16 M190 226 h16" stroke="#ffd36b" stroke-width="5"/>
    <path d="M40 236 L46 236 L52 372 L34 382Z" fill="#e8ecf0" stroke="#8a929c" stroke-width="2"/>
    <rect x="30" y="228" width="26" height="8" rx="2" fill="#8a5a1a"/>
    <circle cx="204" cy="252" r="22" fill="#cfd6dc" stroke="#ffd36b" stroke-width="4"/>
    <circle cx="204" cy="252" r="6" fill="#ffd36b"/>
    <rect x="64" y="226" width="112" height="16" fill="url(#gold)"/>
    <path d="M66 242 H174 L184 420 H56Z" fill="#2b5fd9"/>
    <path d="M62 274 H178 M60 306 H180 M58 338 H182 M57 370 H183" stroke="#e64a8a" stroke-width="12"/>
    <path d="M60 290 H180 M58 354 H182" stroke="#ffd36b" stroke-width="6"/>
    <path d="M104 242 V420 M136 242 V420" stroke="#d2321e" stroke-width="10"/>
    <path d="M70 420 H112 V462 H64Z M128 420 H170 L176 462 H128Z" fill="#e8b04a"/>
    <path d="M58 462 H116 V472 H52Z M124 462 H182 L188 472 H124Z" fill="#d2321e"/>
  </g>
</svg>`;

const BULBS = ['#ff5a4d', '#ffd36b', '#86ff9e', '#7cc8ff', '#ff7ad9'];
const bulbRow = (y, from, to, step, sag = 18) => Array.from({ length: Math.floor((to - from) / step) }, (_, i) => {
  const x = from + i * step;
  const k = ((x - from) % 160) / 160;
  return `<circle class="bulb" style="--d:${(i % 5) * 0.3}s" cx="${x}" cy="${y + Math.sin(k * Math.PI) * sag}" r="3.2" fill="${BULBS[i % 5]}"/>`;
}).join('');

const crowd = (x0, x1, y, seed) => {
  let out = '';
  for (let x = x0, i = seed; x < x1; x += 26 + (i % 3) * 6, i++) {
    const h = 46 + (i * 37) % 30;
    out += `<path d="M${x - 14} ${y} Q${x - 14} ${y - h + 18} ${x} ${y - h + 14} Q${x + 14} ${y - h + 18} ${x + 14} ${y}Z" fill="#0b0912"/><circle cx="${x}" cy="${y - h + 4}" r="10" fill="#0b0912"/>`;
    if (i % 7 === 0) out += `<rect x="${x + 6}" y="${y - h - 18}" width="10" height="16" rx="2" fill="#7cc8ff" opacity=".7"/>`; // someone filming on a phone
  }
  return out;
};

// Festival ground at night: rock hill behind (Ursu Gutta vibe), bunting, a bulb-lit
// barricade and a crowd watching from the front. Effigy sits on top via HTML.
export const VADHA_BG_SVG = `
<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="vsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03030a"/><stop offset=".6" stop-color="#140f26"/><stop offset="1" stop-color="#2b1730"/></linearGradient>
    <linearGradient id="vground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2420"/><stop offset="1" stop-color="#120e0c"/></linearGradient>
    <radialGradient id="vglow" cx=".5" cy="1" r=".6"><stop offset="0" stop-color="#ff8a3c" stop-opacity=".35"/><stop offset="1" stop-color="#ff8a3c" stop-opacity="0"/></radialGradient>
    <radialGradient id="flood"><stop offset="0" stop-color="#ffe2b0" stop-opacity=".22"/><stop offset="1" stop-color="#ffe2b0" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#vsky)"/>
  ${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 397) % 1600}" cy="${(i * 211) % 360}" r="${i % 4 ? 1 : 1.6}" fill="#fff" opacity="${0.2 + (i % 5) * 0.1}"/>`).join('')}
  <path d="M0 640 Q120 470 260 520 Q330 380 470 430 Q560 330 640 420 L700 640Z" fill="#100d18"/>
  <path d="M900 640 Q980 400 1100 450 Q1180 330 1300 410 Q1400 360 1480 470 Q1560 450 1600 520 V640Z" fill="#120f1b"/>
  <ellipse cx="420" cy="470" rx="60" ry="40" fill="#1a1626"/><ellipse cx="1230" cy="440" rx="70" ry="44" fill="#1a1626"/>
  <rect y="560" width="1600" height="340" fill="url(#vglow)"/>
  <path d="M0 640 H1600 V900 H0Z" fill="url(#vground)"/>
  <circle cx="300" cy="420" r="260" fill="url(#flood)"/><circle cx="1300" cy="420" r="260" fill="url(#flood)"/>
  <path d="M300 640 V430 M1300 640 V430" stroke="#2a2a34" stroke-width="8"/>
  <rect x="284" y="420" width="32" height="14" rx="3" fill="#fff2d0"/><rect x="1284" y="420" width="32" height="14" rx="3" fill="#fff2d0"/>
  <path d="M0 470 Q200 520 400 480 T800 480 T1200 480 T1600 470" stroke="#3a2a30" stroke-width="1.5" fill="none"/>
  ${Array.from({ length: 32 }, (_, i) => `<path d="M${i * 50 + 10} ${484 + Math.sin(i * 0.8) * 10} l12 26 l12 -26Z" fill="${['#ff9a3c', '#ffd36b', '#2e8b3a', '#e2463a'][i % 4]}" opacity=".85"/>`).join('')}
  <path d="M0 700 H1600" stroke="#5a4636" stroke-width="5"/>
  ${Array.from({ length: 33 }, (_, i) => `<rect x="${i * 50}" y="680" width="6" height="40" fill="#5a4636"/>`).join('')}
  ${bulbRow(694, 0, 1600, 25, 8)}
  ${crowd(-10, 520, 900, 1)}${crowd(1080, 1620, 900, 4)}
</svg>`;

// --- Gully Patakha street: one-point perspective. Road down the middle,
// independent houses on both sides converging to a vanishing point at (800, 420).
const VP = { x: 800, y: 420 };
function pt(side, t, u) {
  const x = 800 * t;
  const y = 820 - 400 * t - u * 520 * (1 - t);
  return `${side === 'L' ? x : 1600 - x},${y}`;
}
const quad = (side, t0, t1, u0, u1) => `${pt(side, t0, u0)} ${pt(side, t1, u0)} ${pt(side, t1, u1)} ${pt(side, t0, u1)}`;

const HOUSES = [
  { t: [0, 0.26], h: 0.95, c: '#2a2036', trim: '#ffd36b' },
  { t: [0.28, 0.5], h: 0.75, c: '#24304a', trim: '#ff9a3c' },
  { t: [0.52, 0.66], h: 0.9, c: '#33223a', trim: '#86ff9e' },
  { t: [0.68, 0.79], h: 0.7, c: '#232a40', trim: '#ff7ad9' },
  { t: [0.81, 0.88], h: 0.85, c: '#2c2234', trim: '#ffd36b' },
];

function houseSvg(side, { t: [t0, t1], h, c, trim }, index) {
  const span = t1 - t0;
  const tw = (a, b) => [t0 + span * a, t0 + span * b];
  const [d0, d1] = tw(0.4, 0.6);
  const [w0, w1] = tw(0.12, 0.3);
  const [w2, w3] = tw(0.7, 0.88);
  const diyas = Array.from({ length: 5 }, (_, i) => {
    const [x, y] = pt(side, t0 + span * (0.1 + i * 0.2), h).split(',').map(Number);
    const r = 5 * (1 - (t0 + span * 0.5));
    return `<g class="diya" style="--d:${((i + index) * 0.37) % 2}s"><ellipse cx="${x}" cy="${y - r * 0.3}" rx="${r * 1.4}" ry="${r * 0.6}" fill="#b5542a"/><ellipse cx="${x}" cy="${y - r * 1.4}" rx="${r * 0.5}" ry="${r}" fill="#ffb347"/></g>`;
  }).join('');
  return `
    <polygon points="${quad(side, t0, t1, 0, h)}" fill="${c}"/>
    <polygon points="${quad(side, t0, t1, h, h + 0.04)}" fill="#120e18"/>
    <polygon points="${quad(side, d0, d1, 0, 0.42)}" fill="#ffcf7a" opacity=".85"/>
    <polygon points="${quad(side, w0, w1, 0.5, 0.75)}" fill="${index % 2 ? '#ffcf7a' : '#3a2e44'}" opacity=".9"/>
    <polygon points="${quad(side, w2, w3, 0.5, 0.75)}" fill="#ffcf7a" opacity=".9"/>
    <polyline points="${pt(side, t0, h * 0.86)} ${pt(side, t1, h * 0.86)}" stroke="${trim}" stroke-width="${3 * (1 - t0)}" stroke-dasharray="2 6" opacity=".9"/>
    <polygon points="${quad(side, t0, t1, 0, 0.12)}" fill="#1a1422"/>
    ${diyas}`;
}

const roadDashes = Array.from({ length: 9 }, (_, i) => {
  const a = 1 - (i / 9) ** 1.6;
  const b = 1 - ((i + 0.45) / 9) ** 1.6;
  const y0 = VP.y + (900 - VP.y) * a;
  const y1 = VP.y + (900 - VP.y) * b;
  return `<polygon points="${800 - 7 * a},${y0} ${800 + 7 * a},${y0} ${800 + 7 * b},${y1} ${800 - 7 * b},${y1}" fill="#e8e0cc" opacity=".35"/>`;
}).join('');

const stringLights = [0.18, 0.45, 0.7].map((t, k) => {
  const [lx, ly] = pt('L', t, 0.85).split(',').map(Number);
  const [rx, ry] = pt('R', t, 0.85).split(',').map(Number);
  const sag = 60 * (1 - t);
  const n = Math.round(30 * (1 - t)) + 6;
  const bulbs = Array.from({ length: n }, (_, i) => {
    const p = (i + 0.5) / n;
    const x = lx + (rx - lx) * p;
    const y = ly + Math.sin(p * Math.PI) * sag;
    return `<circle class="bulb" style="--d:${((i + k) % 5) * 0.3}s" cx="${x}" cy="${y}" r="${4 * (1 - t) + 1}" fill="${BULBS[(i + k) % 5]}"/>`;
  }).join('');
  return `<path d="M${lx} ${ly} Q800 ${ly + sag * 2} ${rx} ${ry}" stroke="#2e2636" fill="none"/>${bulbs}`;
}).join('');

export const COLONY_SVG = `
<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" class="colony-svg" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04040b"/><stop offset=".75" stop-color="#171030"/><stop offset="1" stop-color="#2c1a34"/></linearGradient>
    <linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2530"/><stop offset="1" stop-color="#3c3540"/></linearGradient>
    <radialGradient id="lamp"><stop offset="0" stop-color="#ffd38a" stop-opacity=".45"/><stop offset="1" stop-color="#ffd38a" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  ${Array.from({ length: 50 }, (_, i) => `<circle cx="${(i * 331) % 1600}" cy="${(i * 173) % 380}" r="${i % 5 ? 1 : 1.7}" fill="#fff" opacity="${0.15 + (i % 4) * 0.12}"/>`).join('')}
  <path d="M640 420 v-30 h30 v-14 h40 v22 h30 v-40 h40 v62Z M840 420 v-50 h36 v20 h30 v-12 h44 v42Z" fill="#120e1c"/>
  <polygon points="0,820 ${VP.x - 10},${VP.y + 4} 230,900 0,900" fill="#2b2430"/>
  <polygon points="1600,820 ${VP.x + 10},${VP.y + 4} 1370,900 1600,900" fill="#2b2430"/>
  <polygon points="230,900 ${VP.x - 10},${VP.y + 4} ${VP.x + 10},${VP.y + 4} 1370,900" fill="url(#road)"/>
  ${roadDashes}
  <ellipse cx="800" cy="900" rx="520" ry="160" fill="url(#lamp)"/>
  ${HOUSES.map((h, i) => houseSvg('L', h, i)).join('')}
  ${HOUSES.map((h, i) => houseSvg('R', { ...h, c: HOUSES[(i + 2) % HOUSES.length].c }, i + 1)).join('')}
  <g opacity=".75"><ellipse cx="120" cy="868" rx="80" ry="18" fill="none" stroke="#ff7ad9" stroke-width="3"/><ellipse cx="120" cy="868" rx="50" ry="11" fill="none" stroke="#ffd36b" stroke-width="3" stroke-dasharray="6 6"/></g>
  <g opacity=".75"><ellipse cx="1480" cy="868" rx="80" ry="18" fill="none" stroke="#7cc8ff" stroke-width="3"/><ellipse cx="1480" cy="868" rx="50" ry="11" fill="none" stroke="#ff9a3c" stroke-width="3" stroke-dasharray="6 6"/></g>
  ${stringLights}
</svg>`;

// Brass candle stand: the sparkler-lighting station. Sized like a real candle, not a pillar.
export const CANDLE_SVG = `
<svg viewBox="0 0 80 160" aria-hidden="true">
  <ellipse cx="40" cy="152" rx="30" ry="7" fill="#7a5420"/>
  <path d="M28 152 L33 128 H47 L52 152Z" fill="#c8902a"/>
  <rect x="29" y="76" width="22" height="54" rx="4" fill="#fff1d8"/>
  <path d="M29 82 q11 7 22 0" stroke="#e8d6b4" stroke-width="3" fill="none"/>
  <path d="M40 76 V68" stroke="#2a1a10" stroke-width="2"/>
  <g class="flame"><path d="M40 26 Q54 50 40 70 Q26 50 40 26Z" fill="#ffb347"/><path d="M40 42 Q47 54 40 68 Q33 54 40 42Z" fill="#fff4c0"/></g>
</svg>`;
