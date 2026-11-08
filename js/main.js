import { unlockAudio, sfx } from './sfx.js';
import { createFx } from './fx.js';
import { distantSky, crackerIcon, crackerById } from './crackers.js';
import { NARAKASURA_SVG } from './art.js';
import { startTracker, stopTracker } from './tracker.js?v=14';
import { initVadha } from './vadha.js?v=14';
import { initGully } from './gully.js?v=14';
import { initMudra } from './mudra.js?v=14';

const camera = document.getElementById('cam');
const status = document.getElementById('tracker-status');
const modes = {
  vadha: initVadha(document.getElementById('mode-vadha')),
  gully: initGully(document.getElementById('mode-gully')),
  mudra: initMudra(document.getElementById('mode-mudra')),
};
let current = null;
let stream = null;
let stopHomeAmbient = () => {};

const STATUS_TEXT = {
  loading: 'Waking up the diyas…',
  live: 'Hands live',
  failed: 'Tracking off · use touch or mouse',
  denied: 'Camera off · use touch or mouse',
};
function setStatus(key) {
  status.textContent = STATUS_TEXT[key];
  status.dataset.state = key;
}

// Camera is optional: if permission is denied every mode still plays with touch/mouse.
async function startCamera() {
  if (stream) return true;
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('denied');
    return false;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false });
    camera.srcObject = stream;
    await camera.play().catch(() => {});
    document.body.classList.add('has-camera');
    return true;
  } catch {
    setStatus('denied');
    return false;
  }
}

async function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  if (current) modes[current].leave();
  stopHomeAmbient();
  current = id.replace('mode-', '');
  document.body.dataset.mode = modes[current] ? current : 'home';
  if (!modes[current]) {
    current = null;
    stopTracker();
    status.dataset.state = 'hidden';
    stopHomeAmbient = sfx.ambient();
    return;
  }
  modes[current].enter();
  if (await startCamera()) startTracker(camera, setStatus);
}

function decorateHome() {
  document.querySelector('[data-art="vadha"]').innerHTML = NARAKASURA_SVG;
  document.querySelector('[data-art="gully"]').innerHTML = crackerIcon(crackerById('chichubuddi'), 120);
  const fx = createFx(document.querySelector('#home canvas'));
  const tick = distantSky(fx);
  fx.onDraw((ctx, dt) => document.body.dataset.mode === 'home' && tick(dt));
}

let audioReady = null;
document.addEventListener('pointerdown', () => {
  if (audioReady) return;
  // Browsers only allow audio after a user gesture; the first tap anywhere starts the night.
  audioReady = unlockAudio().then(() => {
    if (!current) stopHomeAmbient = sfx.ambient();
    document.body.classList.add('sound-on');
  });
}, { capture: true });

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (!go) return;
  audioReady ??= unlockAudio();
  show(go.dataset.go);
});

decorateHome();
