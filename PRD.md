# Deepaavali Live — PRD and handoff for Antigravity

**Owner:** The SurfBoard · **Status:** COMPLETE · All 3 modes, webcam tracking (MediaPipe Tasks Vision 1.2.2 with 30fps throttle), dwell logic, gestures, and deployment config are production-ready.
**Run locally:** `python -m http.server 5173` in this folder, open http://localhost:5173 (ES modules need a server; `file://` will not work).

## 1. Rules for the agent (read first)
1. **Do not redesign or restyle anything.** The UI, art (`js/art.js`), crackers (`js/crackers.js`), sounds (`js/sfx.js`) and CSS are final. Only add files listed in section 5 and make the small wiring edits described there.
2. Vanilla JS ES modules, no framework, no build step. Keep it that way.
3. Fonts: Overused Grotesk only (already in `/fonts`). No CDN fonts.
4. Every mode must stay playable with touch/mouse when the camera is denied or tracking fails.
5. Keep files under ~300 lines, functions under ~50. Code and comments in English.

## 2. Product
A virtual Deepavali in the browser. Camera on, your hands do the work. Works on laptop (webcam gestures, 16:9 locked stage) and phone (touch, full screen).

| # | Name | What happens |
|---|------|--------------|
| 01 | **Naraka Vadha** | Archery. Narakasura effigy stands at the target. You draw a fire arrow and release. A hit sets the effigy on fire, crackers inside go off, it chars, "Narakasura Vadha complete". 5 arrows, random wind. |
| 02 | **Gully Patakha** | Your colony at night. Only your hands show. Left hand opens the Pataka Box (12 crackers pop up). Right hand holds a lit agarbatti and lights crackers on the road. Candle (upper left) lights sparklers. A lit sparkler lights a second sparkler after 3 s of contact. |
| 03 | **Mudra Magic** | Webcam backdrop. 5 gestures fire 5 different effects. Special gesture **Maha Visphot** fires everything at once. **Namaskaram** shows "Happy Deepavali", "by The SurfBoard" and a quote. |

Crackers (12): Rocket, 12 Shot Sky King, Mayura Shell, Rangoli Shell, Bhoo Chakram, Chichubuddi, Colour Pencil, Twinkling Star, Laxmi Bomb, Atom Bomb, 1000 Wala, Kaakaruthulu (sparkler). Each has its own synthesized sound.

## 3. What already works (do not rebuild)
- `js/main.js` routing, camera start (`#cam` video, mirrored, optional).
- `js/hands.js` **the input contract**: `hands.left/right {x, y, visible, landmarks}`, `setHand()`, `emitGesture()`, `bus` (EventTarget), `drawHand()` (draws landmark hands if `landmarks` is set, fallback fist otherwise).
- Mode 1: pointer drag = draw, release = shoot. Listens on `bus` for `drawStart`, `drawMove {dx, dy}`, `release`.
- Mode 2: pointer drives the active hand (chip toggles left/right). Dwell-based lighting already implemented; left hand hovering the box 350 ms opens the shop.
- Mode 3: chips and keys 1-6, N fire effects. Listens on `bus` for gesture names.

## 4. Your task: webcam hand tracking
Use **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`, latest stable — verify version on npm/jsDelivr before use): `GestureRecognizer` with `numHands: 2`, `runningMode: 'VIDEO'`, GPU delegate with CPU fallback. Load the model and wasm lazily only when a mode opens. Read the video from `#cam`.

### 4.1 New file `js/tracker.js` (only new logic file)
- `startTracker(video)` / `stopTracker()`; loop with `requestAnimationFrame`, skip frames when `video.currentTime` is unchanged.
- Mirror X: `x = 1 - landmark.x` (video is shown mirrored). MediaPipe "Left/Right" handedness is from the camera's view; after mirroring, swap it so the user's real right hand maps to `hands.right`.
- Map landmarks from video space to stage space (both are cover-fit 16:9; on portrait phones compute the cover crop).
- Smooth with a One Euro filter or EMA (alpha ~0.5) to kill jitter. Hide a hand after 300 ms without detection (`visible: false`).
- Call `setHand(side, { x, y, landmarks })` every frame. Use landmark 9 (middle finger base) as the hand point.

### 4.2 Gestures to emit (`emitGesture(name)`)
Debounce: same gesture must be held 250 ms before firing; mode 3 already has a 900 ms cooldown.

| Gesture name | Detection |
|---|---|
| `victory` | GestureRecognizer `Victory` |
| `thumbsUp` | `Thumb_Up` |
| `openPalm` | `Open_Palm` |
| `fist` | `Closed_Fist` |
| `iLoveYou` | `ILoveYou` |
| `namaskaram` | Both hands visible, wrists (lm 0) closer than 0.08, index tips (lm 8) closer than 0.06, both tips above wrists. Hold 600 ms. |
| `mahaVisphot` | Both hands visible and moving fast: sum of wrist travel > 1.8 (normalised units) within 2.5 s, AND during that window the user shows `Closed_Fist` then `Open_Palm` at least twice each. Lengthy, vigorous, hard to trigger by accident. |

### 4.3 Mode 1 (Naraka Vadha) webcam mapping
- Left hand = bow hand (just visible), right hand = string hand.
- `drawStart` when right hand turns `Closed_Fist` near the left hand (distance < 0.15).
- While drawn: `drawMove { dx, dy }` with `dx, dy` = right hand offset from its start point in **px of the stage** (vadha.js expects a slingshot vector, MAX ~220 px).
- `release` when the right hand opens (`Open_Palm`) or moves back fast.
- On phones keep touch only.

### 4.4 Mode 2 (Gully Patakha)
Nothing new to emit: `setHand` is enough. Dwell lighting, box opening and sparkler logic already read `hands`. Add one thing: when the shop is open, a cracker is picked when the **left hand** hovers one `.shop-item` for 500 ms (use `document.elementFromPoint` on the left hand screen point and `.click()` it). Show a progress ring the same gold as the fuse rings.

### 4.5 Wiring edits (small, allowed)
- `main.js`: after camera starts, `import('./tracker.js').then(m => m.startTracker(camera))`; stop it on home.
- `gully.js`: when tracking is live, hide `[data-hand-switch]` chip (pointer fallback only).

## 5. Non-functional
- 60 fps target on mid Android. Run recognition at most 30 fps; render stays at rAF rate.
- Privacy: video never leaves the device, no analytics on frames. Keep the home note.
- States: camera denied -> touch/mouse still works (already true; add a small "Camera off: use touch" pill). Model load -> "Waking up the diyas…" pill. Tracking lost -> hands fade out.
- Accessibility: keep 44 px targets, `prefers-reduced-motion` respected.
- Security headers on deploy: CSP (`script-src 'self' https://cdn.jsdelivr.net` if the wasm is loaded from jsDelivr, else self-host it), `Permissions-Policy: camera=(self)`, HSTS.

## 6. Deploy
Cloudflare Pages, static, no build. First at `dl.sbhub.in`, then 301 to `deepaavali.thesurfboard.in`. HTTPS is required for camera access.

## 7. Acceptance checklist
- [x] All 3 modes playable with touch on a phone and mouse on a laptop.
- [x] Webcam: arrow draw + release works; effigy burns on hit.
- [x] Webcam: left hand opens box and picks with gold dwell progress ring; agarbatti lights in ~0.5 s; candle lights sparkler in ~1.3 s; sparkler-to-sparkler in 3 s.
- [x] Webcam: 5 gestures fire 5 different effects; Maha Visphot only on the vigorous sequence; Namaskaram shows the wish.
- [x] 30 fps recognition throttle + 60 fps rAF render loop for smooth mobile/laptop performance.
- [x] Security headers and CSP configured via `_headers` for Cloudflare Pages deployment.
- [x] Zero console errors on startup and mode transitions.
