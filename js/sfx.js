// Real recorded crackers are the base layer; every other cracker voice is derived
// from them (pitch, speed, layering) so the whole app sounds like one street.
// Synth noise stays only for tiny UI-level sounds (fuse, whoosh, chime).
const SAMPLE_FILES = {
  bomb: 'sounds/laxmibomb.wav',
  wala: 'sounds/1000Wala.wav',
  launch: 'sounds/rocket launch sound.wav',
  rocket: 'sounds/single rocket.wav',
  volley: 'sounds/rocket sound.wav',
  sparkle: 'sounds/sparkle.wav',
  ambient: 'sounds/homepage sound.mp3',
};

let ac = null;
let master = null;
let noiseBuffer = null;
const buffers = {};
let loading = null;

function audio() {
  if (ac) return ac;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 6;
  comp.ratio.value = 4;
  master = ac.createGain();
  master.gain.value = 1.4;
  master.connect(comp).connect(ac.destination);
  noiseBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ac;
}

export function unlockAudio() {
  audio().resume();
  loading ??= Promise.all(Object.entries(SAMPLE_FILES).map(async ([key, url]) => {
    try {
      const res = await fetch(encodeURI(url));
      buffers[key] = await ac.decodeAudioData(await res.arrayBuffer());
    } catch {
      // A missing file must never break play; that voice just stays silent.
    }
  }));
  return loading;
}

/** Plays a recorded sample. Returns a stop() handle for loops (sparklers, fountains). */
export function play(key, { rate = 1, gain = 1, offset = 0, duration, delay = 0, loop = false, fadeIn = 0.005 } = {}) {
  const buffer = buffers[key];
  if (!ac || !buffer) {
    // Loops (ambience, sparklers) can start late without feeling wrong; one-shots cannot.
    if (!loop || !loading) return () => {};
    let stop = null;
    let cancelled = false;
    loading.then(() => !cancelled && (stop = play(key, { rate, gain, offset, duration, delay, loop, fadeIn })));
    return () => {
      cancelled = true;
      stop?.();
    };
  }
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = loop;
  src.playbackRate.value = rate;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + fadeIn);
  src.connect(g).connect(master);
  const startAt = Math.min(offset, buffer.duration - 0.05);
  src.start(t, startAt);
  const stopAt = (when) => {
    g.gain.setTargetAtTime(0.0001, when, 0.12);
    src.stop(when + 0.6);
  };
  if (duration) stopAt(t + duration);
  let stopped = !!duration;
  return () => {
    if (stopped) return;
    stopped = true;
    stopAt(ac.currentTime);
  };
}

function noise(dur, { type = 'lowpass', freq = 1200, freqEnd, q = 0.8, gain = 0.6, attack = 0.004, delay = 0 } = {}) {
  const a = audio();
  const t = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = a.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t);
  if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

function tone(freq, freqEnd, dur, { type = 'sine', gain = 0.3, delay = 0 } = {}) {
  const a = audio();
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

const vary = (base, spread = 0.08) => base * (1 - spread + Math.random() * spread * 2);

export const sfx = {
  bang: (delay = 0) => play('bomb', { rate: vary(1), gain: 1.6, offset: 0.88, delay }),
  // Atom bomb = the laxmi sample slowed down (bigger body) plus a sub thump you feel.
  atom: (delay = 0) => {
    play('bomb', { rate: 0.68, gain: 2.2, offset: 0.88, delay });
    tone(70, 24, 1.2, { gain: 1, delay });
  },
  smallBang: (delay = 0) => play('bomb', { rate: vary(1.5), gain: 0.7, offset: 0.88, delay }),
  launch: () => play('launch', { rate: vary(1), gain: 1.1 }),
  rocket: () => play('rocket', { rate: vary(1), gain: 1.1, duration: 3.2 }),
  volley: () => play('volley', { gain: 1.2 }),
  wala: (seconds = 6) => play('wala', { gain: 1.3, duration: seconds }),
  twinkle: (seconds) => play('wala', { rate: 1.7, gain: 0.45, offset: 1, duration: seconds }),
  // Fountains reuse the sparkle hiss, pitched down so the bigger cracker sounds bigger.
  fountain: (seconds, rate = 0.75) => play('sparkle', { rate, gain: 1.3, duration: seconds, loop: true, fadeIn: 0.2 }),
  spinner: (seconds) => {
    play('sparkle', { rate: 1.25, gain: 1.1, duration: seconds, loop: true, fadeIn: 0.1 });
    tone(1400, 2200, seconds, { type: 'triangle', gain: 0.04 });
  },
  sparklerLoop: () => play('sparkle', { rate: vary(1.05), gain: 0.9, loop: true, offset: Math.random() * 3, fadeIn: 0.3 }),
  ambient: () => play('ambient', { gain: 0.35, loop: true, fadeIn: 1.5 }),
  fuse: (seconds = 1) => noise(seconds, { type: 'bandpass', freq: 6000, q: 2, gain: 0.3, attack: 0.05 }),
  whoosh: () => noise(0.45, { type: 'bandpass', freq: 600, freqEnd: 2600, q: 1.2, gain: 0.8, attack: 0.03 }),
  bowCreak: (p) => tone(90 + p * 60, 70, 0.08, { type: 'sawtooth', gain: 0.05 }),
  thud: () => noise(0.18, { freq: 500, gain: 0.8 }),
  roar: (seconds = 6) => noise(seconds, { freq: 380, gain: 0.7, attack: 0.5 }),
  pop: (delay = 0) => noise(0.05, { type: 'bandpass', freq: 2500 + Math.random() * 1500, q: 1.4, gain: 0.6, delay }),
  chime() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, f * 0.995, 2.8, { gain: 0.16, delay: i * 0.18 }));
  },
};
