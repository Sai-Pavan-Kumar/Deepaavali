// One additive-blend particle canvas per mode. The pool cap is what keeps a
// budget Android phone at 60fps when the Maha Visphot fires everything at once.
const MAX_PARTICLES = 2400;

export const PALETTE = {
  gold: '#ffd36b',
  saffron: '#ff9a3c',
  red: '#ff5a4d',
  green: '#86ff9e',
  blue: '#7cc8ff',
  pink: '#ff7ad9',
  white: '#fff4dc',
  violet: '#b98cff',
};
const COLORS = Object.values(PALETTE);
export const randomColor = () => COLORS[(Math.random() * COLORS.length) | 0];
export const rand = (min, max) => min + Math.random() * (max - min);

export function createFx(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  const timers = [];
  const drawHooks = [];
  const paints = [];
  let width = 0;
  let height = 0;
  let shake = 0;
  let dpr = 1;
  let deadzone = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function spawn(p) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({ vx: 0, vy: 0, life: 1, decay: 0.02, gravity: 0.06, drag: 0.985, size: 2, color: PALETTE.gold, ...p });
  }

  // Runs fn(progress 0..1) every `interval` ms for `duration` ms: the backbone of fountains, fuses, spinners.
  function repeat(interval, duration, fn) {
    timers.push({ interval, duration, fn, acc: 0, elapsed: 0 });
  }

  function step(p, s) {
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.gravity * s;
    p.x += p.vx * s;
    p.y += p.vy * s;
    p.life -= p.decay * s;
  }

  function draw(p) {
    ctx.globalAlpha = Math.min(1, p.life);
    if (p.flash) {
      const r = p.flash * (1.4 - p.life * 0.4);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      return;
    }
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.size * (0.4 + p.life * 0.6);
    ctx.beginPath();
    ctx.moveTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last);
    last = now;
    const s = dt / 16.7;
    for (let i = timers.length - 1; i >= 0; i--) {
      const t = timers[i];
      t.elapsed += dt;
      t.acc += dt;
      while (t.acc >= t.interval) {
        t.acc -= t.interval;
        t.fn(Math.min(1, t.elapsed / t.duration));
      }
      if (t.elapsed >= t.duration) timers.splice(i, 1);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    if (shake > 0.3) {
      ctx.translate(rand(-shake, shake), rand(-shake, shake));
      shake *= 0.9;
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      step(p, s);
      if (p.life <= 0 || p.y > height + 40 || (deadzone > 0 && p.y > height - deadzone)) {
        particles.splice(i, 1);
        continue;
      }
      draw(p);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    paints.forEach((paint) => paint(ctx));
    paints.length = 0;
    drawHooks.forEach((hook) => hook(ctx, dt));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    ctx,
    spawn,
    repeat,
    shake: (amount) => (shake = Math.max(shake, amount)),
    onDraw: (hook) => drawHooks.push(hook),
    paint: (fn) => paints.push(fn),
    size: () => ({ w: width, h: height }),
    setDeadzone: (val) => (deadzone = val),
    clear: () => {
      particles.length = 0;
      timers.length = 0;
    },
  };
}

// ---- Reusable effect shapes, composed by the cracker catalog ----

export function burst(fx, x, y, { count = 90, speed = 5, colors, gravity = 0.05, decay = 0.012, size = 2.2 } = {}) {
  const palette = colors || [randomColor(), randomColor()];
  fx.spawn({ x, y, flash: 90 + count, color: 'rgba(255,230,180,0.9)', decay: 0.06, gravity: 0 });
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand(-0.05, 0.05);
    const v = speed * rand(0.75, 1.05);
    fx.spawn({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, color: palette[i % palette.length], gravity, decay: decay * rand(0.8, 1.3), size });
  }
}

export function fountain(fx, x, y, { duration = 4000, height = 9, spread = 1.4, colors = [PALETTE.gold, PALETTE.white, PALETTE.saffron], rate = 16 } = {}) {
  fx.repeat(rate, duration, (progress) => {
    const swell = Math.sin(Math.min(1, progress * 1.4) * Math.PI) * 0.6 + 0.5;
    for (let i = 0; i < 4; i++) {
      fx.spawn({ x, y, vx: rand(-spread, spread), vy: -height * swell * rand(0.7, 1.05), color: colors[(Math.random() * colors.length) | 0], gravity: 0.16, decay: 0.022, size: 1.8 });
    }
  });
}

export function smoke(fx, x, y, amount = 12) {
  for (let i = 0; i < amount; i++) {
    fx.spawn({ x: x + rand(-20, 20), y, vx: rand(-0.4, 0.4), vy: rand(-1.2, -0.4), color: 'rgba(120,110,130,0.18)', flash: rand(20, 40), gravity: -0.005, decay: 0.006 });
  }
}
