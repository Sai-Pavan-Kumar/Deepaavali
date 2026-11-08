// Master First-Person FPS Archery Rig (Olympic Recurve / Vedic Agneyastra Style)
// Inspired directly by high-end archery simulations (Archery Game.mp4):
// In first-person perspective:
// - The bow and sight pin are held in the player's hands.
// - The sight scope ring is centered on the aiming point (aim.x, aim.y).
// - The bow riser is mounted to the right of the sight scope ring with a horizontal bracket.
// - The arrow rests on the riser shelf, pointing straight forward through the sight scope into 3D space.
// - Moving the mouse pans the entire bow & sight assembly across the target.

const WOOD_DARK = '#1a0e06';
const WOOD_MID = '#5c2d12';
const WOOD_LIGHT = '#9c5423';
const BRASS_GOLD = '#d4af37';
const BRIGHT_GOLD = '#ffe066';
const METAL_DARK = '#15181e';
const METAL_MID = '#282f3b';
const METAL_BLUE = '#1e3a5f';
const METAL_BLUE_HIGHLIGHT = '#3b6998';
const SKIN_TONE = '#c28559';
const SKIN_SHADOW = '#8a5332';

/** Compute all first-person rig anchor points based on viewport and aim */
export function rigGeometry(w, h, aim, power = 0) {
  // Proportional reference unit (scales gracefully across all screen sizes)
  const u = Math.min(h, w * 0.75);

  // 1. Sight scope center is locked directly to player's aim point:
  const sight = { x: aim.x, y: aim.y };

  // 2. Bow Riser position: vertical column offset to the right of the sight ring
  // Offset matches professional recurve sight mounting distance:
  const riserX = aim.x + u * 0.145;
  const riserY = aim.y + u * 0.08;
  const grip = { x: riserX, y: riserY + u * 0.08 };

  // 3. Arrow Shelf cutout on the left edge of the riser, just below the sight pin:
  const shelf = {
    x: riserX - u * 0.022,
    y: aim.y + u * 0.042,
  };

  // 4. Recurve Bow Limbs flex dynamically under tension:
  const flexX = power * u * 0.025;
  const flexY = power * u * 0.022;
  const top = {
    x: riserX + u * 0.065 - flexX,
    y: riserY - u * 0.82 + flexY,
  };
  const bottom = {
    x: riserX + u * 0.065 - flexX,
    y: riserY + u * 0.82 - flexY,
  };

  // 5. Nock point on the bowstring:
  // Starts in lower-right foreground at rest, pulls back and down under draw:
  const restNockX = riserX + u * 0.17;
  const restNockY = riserY + u * 0.36;
  const nock = {
    x: restNockX + power * u * 0.10,
    y: restNockY + power * u * 0.11,
  };

  return { grip, top, bottom, nock, shelf, sight, riserX, riserY, u, power };
}

/** Draw the bow limbs, riser, string, and metallic sight scope assembly */
export function drawBow(ctx, w, h, g) {
  const { u, power, grip, top, bottom, nock, shelf, sight, riserX, riserY } = g;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ----------------------------------------------------
  // 1. Bowstring (connects top limb -> nock -> bottom limb)
  // ----------------------------------------------------
  ctx.strokeStyle = '#fbf7ee';
  ctx.lineWidth = Math.max(2, u * 0.0038);
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(nock.x, nock.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.stroke();

  // Bowstring center serving wrap (heavy protective thread around nock):
  ctx.strokeStyle = '#3a332a';
  ctx.lineWidth = Math.max(4, u * 0.007);
  ctx.beginPath();
  ctx.moveTo(nock.x - (nock.x - top.x) * 0.09, nock.y - (nock.y - top.y) * 0.09);
  ctx.lineTo(nock.x + (bottom.x - nock.x) * 0.09, nock.y + (bottom.y - nock.y) * 0.09);
  ctx.stroke();

  // ----------------------------------------------------
  // 2. Bow Limbs (Laminated Vedic Recurve Wood & Carbon)
  // ----------------------------------------------------
  const bulge = u * 0.095;
  const limbGrad = ctx.createLinearGradient(riserX - bulge, 0, riserX + 40, 0);
  limbGrad.addColorStop(0, WOOD_DARK);
  limbGrad.addColorStop(0.35, WOOD_MID);
  limbGrad.addColorStop(0.65, WOOD_LIGHT);
  limbGrad.addColorStop(1, WOOD_DARK);

  ctx.strokeStyle = limbGrad;
  ctx.lineWidth = u * 0.028;

  // Upper limb curve:
  ctx.beginPath();
  ctx.moveTo(riserX, riserY - u * 0.22);
  const midUpperY = (riserY - u * 0.22 + top.y) / 2;
  ctx.bezierCurveTo(riserX - bulge, midUpperY, top.x - bulge * 0.55, top.y + u * 0.12, top.x, top.y);
  ctx.stroke();

  // Lower limb curve:
  ctx.beginPath();
  ctx.moveTo(riserX, riserY + u * 0.26);
  const midLowerY = (riserY + u * 0.26 + bottom.y) / 2;
  ctx.bezierCurveTo(riserX - bulge, midLowerY, bottom.x - bulge * 0.55, bottom.y - u * 0.12, bottom.x, bottom.y);
  ctx.stroke();

  // Gold limb-tip nock reinforcement cups:
  ctx.fillStyle = BRASS_GOLD;
  for (const tip of [top, bottom]) {
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, u * 0.015, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = BRIGHT_GOLD;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ----------------------------------------------------
  // 3. Central Olympic / Vedic Riser
  // ----------------------------------------------------
  const riserW = u * 0.042;
  const riserTopY = riserY - u * 0.26;
  const riserBottomY = riserY + u * 0.32;
  const riserH = riserBottomY - riserTopY;

  // Metallic deep blue / carbon composite riser body:
  const riserGrad = ctx.createLinearGradient(riserX - riserW * 0.5, 0, riserX + riserW * 0.5, 0);
  riserGrad.addColorStop(0, '#101c2c');
  riserGrad.addColorStop(0.35, METAL_BLUE);
  riserGrad.addColorStop(0.7, METAL_BLUE_HIGHLIGHT);
  riserGrad.addColorStop(1, '#0e1824');

  ctx.fillStyle = riserGrad;
  ctx.beginPath();
  ctx.roundRect(riserX - riserW * 0.5, riserTopY, riserW, riserH, u * 0.015);
  ctx.fill();

  // Chased Gold bevel border around riser:
  ctx.strokeStyle = BRASS_GOLD;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Weight-reduction cutouts (like professional Olympic recurve risers):
  const cutouts = [
    { y: riserTopY + u * 0.05, h: u * 0.065 },
    { y: riserTopY + u * 0.13, h: u * 0.055 },
    { y: riserBottomY - u * 0.16, h: u * 0.06 },
    { y: riserBottomY - u * 0.08, h: u * 0.045 },
  ];
  ctx.fillStyle = '#0a0d14'; // Cutout interior showing dark night backdrop
  cutouts.forEach((c) => {
    ctx.beginPath();
    ctx.roundRect(riserX - riserW * 0.26, c.y, riserW * 0.52, c.h, u * 0.009);
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Ergonomic Central Grip Handle (leather-wrapped):
  const gripY = grip.y;
  const gripH = u * 0.12;
  ctx.fillStyle = '#1c1512';
  ctx.beginPath();
  ctx.roundRect(riserX - riserW * 0.52, gripY - gripH * 0.5, riserW * 1.04, gripH, u * 0.012);
  ctx.fill();

  // Leather grip cord wraps:
  ctx.strokeStyle = '#4a2d1d';
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 5; i++) {
    const wy = gripY - gripH * 0.38 + i * (gripH * 0.18);
    ctx.beginPath();
    ctx.moveTo(riserX - riserW * 0.48, wy);
    ctx.lineTo(riserX + riserW * 0.48, wy);
    ctx.stroke();
  }

  // Arrow Shelf (Arrow Rest Extension):
  ctx.fillStyle = '#2c1e14';
  ctx.beginPath();
  ctx.roundRect(riserX - u * 0.042, shelf.y - u * 0.007, u * 0.042, u * 0.018, u * 0.004);
  ctx.fill();
  ctx.fillStyle = BRASS_GOLD;
  ctx.fillRect(riserX - u * 0.042, shelf.y + u * 0.007, u * 0.042, u * 0.004);

  // ----------------------------------------------------
  // 4. Sight Bracket & Circular Scope Assembly
  // ----------------------------------------------------
  // Horizontal mounting rod from riser to sight ring:
  ctx.strokeStyle = METAL_DARK;
  ctx.lineWidth = Math.max(3.5, u * 0.008);
  ctx.beginPath();
  ctx.moveTo(riserX - riserW * 0.35, sight.y);
  ctx.lineTo(sight.x + u * 0.05, sight.y);
  ctx.stroke();

  // Sight elevation adjustment screw block on riser:
  ctx.fillStyle = METAL_MID;
  ctx.fillRect(riserX - riserW * 0.42, sight.y - u * 0.015, u * 0.018, u * 0.03);
  ctx.fillStyle = BRASS_GOLD;
  ctx.fillRect(riserX - riserW * 0.46, sight.y - u * 0.008, u * 0.007, u * 0.016);

  // Circular Sight Scope Ring (The First-Person Reticle):
  const scopeR = u * 0.048;

  // Subtle dark lens tint inside scope:
  ctx.fillStyle = 'rgba(10, 15, 25, 0.22)';
  ctx.beginPath();
  ctx.arc(sight.x, sight.y, scopeR, 0, Math.PI * 2);
  ctx.fill();

  // Outer heavy metallic scope ring:
  ctx.lineWidth = Math.max(4.5, u * 0.009);
  ctx.strokeStyle = METAL_DARK;
  ctx.beginPath();
  ctx.arc(sight.x, sight.y, scopeR, 0, Math.PI * 2);
  ctx.stroke();

  // Inner beveled brass reflection ring:
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = BRASS_GOLD;
  ctx.beginPath();
  ctx.arc(sight.x, sight.y, scopeR - 1.8, 0, Math.PI * 2);
  ctx.stroke();

  // Fine Crosshairs:
  // Horizontal crossline:
  ctx.strokeStyle = 'rgba(255, 220, 100, 0.75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(sight.x - scopeR + 4, sight.y);
  ctx.lineTo(sight.x + scopeR - 4, sight.y);
  ctx.stroke();

  // Vertical aiming pin from bottom of ring to center:
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(sight.x, sight.y + scopeR - 3);
  ctx.lineTo(sight.x, sight.y);
  ctx.stroke();

  // Fiber-Optic Aiming Needle & Bead:
  ctx.strokeStyle = '#ff3333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sight.x, sight.y + scopeR - 5);
  ctx.lineTo(sight.x, sight.y);
  ctx.stroke();

  // Bright glowing red / gold bead at center:
  ctx.fillStyle = '#ff2222';
  ctx.beginPath();
  ctx.arc(sight.x, sight.y, Math.max(3, u * 0.0055), 0, Math.PI * 2);
  ctx.fill();

  // Incandescent core dot:
  ctx.fillStyle = BRIGHT_GOLD;
  ctx.beginPath();
  ctx.arc(sight.x, sight.y, Math.max(1.4, u * 0.0028), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Draw the Agneyastra fire arrow resting on the shelf and aimed through the sight */
export function drawNockedArrow(ctx, g, aim, u, time) {
  // Arrow vector goes from string nock (bottom-right) through arrow shelf (up-left):
  const dx = g.shelf.x - g.nock.x;
  const dy = g.shelf.y - g.nock.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const nx = -uy;
  const ny = ux;

  // Arrow length in foreshortened first-person perspective:
  // At rest, tip extends forward past shelf by u * 0.09.
  // When drawn to full power (1.0), tip pulls back right to shelf edge (u * 0.015 past shelf).
  const drawBack = g.power * u * 0.075;
  const totalArrowLen = dist + u * 0.095 - drawBack;

  const nockPt = { x: g.nock.x, y: g.nock.y };
  const tipPt = {
    x: nockPt.x + ux * (totalArrowLen - u * 0.024),
    y: nockPt.y + uy * (totalArrowLen - u * 0.024),
  };
  const headPt = {
    x: nockPt.x + ux * totalArrowLen,
    y: nockPt.y + uy * totalArrowLen,
  };

  ctx.save();

  // 1. Polished Bamboo/Teak Wooden Shaft (tapers into depth):
  const shaftGrad = ctx.createLinearGradient(
    nockPt.x - nx * 4, nockPt.y - ny * 4,
    nockPt.x + nx * 4, nockPt.y + ny * 4
  );
  shaftGrad.addColorStop(0, '#4a2510');
  shaftGrad.addColorStop(0.45, '#8c4e23');
  shaftGrad.addColorStop(0.75, '#b87640');
  shaftGrad.addColorStop(1, '#4a2510');

  // Foreground shaft near nock is thicker (~8px), near tip is ~4.5px:
  ctx.beginPath();
  ctx.moveTo(nockPt.x + nx * (u * 0.0055), nockPt.y + ny * (u * 0.0055));
  ctx.lineTo(tipPt.x + nx * (u * 0.0035), tipPt.y + ny * (u * 0.0035));
  ctx.lineTo(tipPt.x - nx * (u * 0.0035), tipPt.y - ny * (u * 0.0035));
  ctx.lineTo(nockPt.x - nx * (u * 0.0055), nockPt.y - ny * (u * 0.0055));
  ctx.closePath();
  ctx.fillStyle = shaftGrad;
  ctx.fill();

  // Shaft highlight line:
  ctx.strokeStyle = '#d49b6a';
  ctx.lineWidth = Math.max(1.2, u * 0.002);
  ctx.beginPath();
  ctx.moveTo(nockPt.x + nx * 1.5, nockPt.y + ny * 1.5);
  ctx.lineTo(tipPt.x + nx * 0.8, tipPt.y + ny * 0.8);
  ctx.stroke();

  // 2. Ceremonial Royal Gold Cresting Bands along shaft:
  [0.15, 0.45, 0.82].forEach((r) => {
    const rx = nockPt.x + ux * (totalArrowLen * r);
    const ry = nockPt.y + uy * (totalArrowLen * r);
    const rw = u * 0.0065;
    ctx.strokeStyle = BRIGHT_GOLD;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(rx - nx * rw, ry - ny * rw);
    ctx.lineTo(rx + nx * rw, ry + ny * rw);
    ctx.stroke();
  });

  // 3. Fletchings (Pankh) - Large, detailed in foreground near nock:
  const fStart = u * 0.012;
  const fEnd = u * 0.085;
  const fSpan = fEnd - fStart;
  const fWidth = u * 0.018;

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(nockPt.x + ux * fStart, nockPt.y + uy * fStart);
    const cX = nockPt.x + ux * (fStart + fSpan * 0.65) + nx * side * fWidth;
    const cY = nockPt.y + uy * (fStart + fSpan * 0.65) + ny * side * fWidth;
    const endX = nockPt.x + ux * fEnd;
    const endY = nockPt.y + uy * fEnd;
    ctx.quadraticCurveTo(cX, cY, endX, endY);
    ctx.lineTo(nockPt.x + ux * fStart, nockPt.y + uy * fStart);
    ctx.closePath();

    const featherGrad = ctx.createLinearGradient(
      nockPt.x + ux * fStart, nockPt.y + uy * fStart,
      endX, endY
    );
    featherGrad.addColorStop(0, '#c62828'); // Deep crimson
    featherGrad.addColorStop(0.5, '#f57c00'); // Saffron
    featherGrad.addColorStop(1, '#ffeb3b'); // Festive gold
    ctx.fillStyle = featherGrad;
    ctx.fill();

    // Quill edge:
    ctx.strokeStyle = '#7f0000';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // 4. Carved Bone Nock on the string:
  ctx.beginPath();
  ctx.arc(nockPt.x, nockPt.y, Math.max(3, u * 0.0055), 0, Math.PI * 2);
  ctx.fillStyle = '#f8f4ea';
  ctx.fill();
  ctx.strokeStyle = '#8a7a60';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 5. Golden Broadhead Blade at front (Agneyastra Head):
  const headLen = u * 0.032;
  const headHalfW = u * 0.013;
  const barbX = tipPt.x - ux * headLen * 0.25;
  const barbY = tipPt.y - uy * headLen * 0.25;

  // Left facet (bronze shaded):
  ctx.beginPath();
  ctx.moveTo(headPt.x, headPt.y);
  ctx.lineTo(barbX + nx * headHalfW, barbY + ny * headHalfW);
  ctx.lineTo(tipPt.x, tipPt.y);
  ctx.closePath();
  ctx.fillStyle = '#b8860b';
  ctx.fill();

  // Right facet (bright sun gold):
  ctx.beginPath();
  ctx.moveTo(headPt.x, headPt.y);
  ctx.lineTo(barbX - nx * headHalfW, barbY - ny * headHalfW);
  ctx.lineTo(tipPt.x, tipPt.y);
  ctx.closePath();
  ctx.fillStyle = BRIGHT_GOLD;
  ctx.fill();

  // Center golden spine:
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(tipPt.x, tipPt.y);
  ctx.lineTo(headPt.x, headPt.y);
  ctx.stroke();

  // 6. Sacred Fire (Agni) at the arrowhead:
  drawFlame(ctx, tipPt.x, tipPt.y, u * 0.026, time, ux, uy, nx, ny);

  ctx.restore();
  return headPt;
}

/** Gloved bow hand on riser and drawing hand on string */
export function drawArcherHands(ctx, g, u, drawing) {
  const { riserX, riserY, grip, nock } = g;
  const s = u / 800;
  ctx.save();

  // Left hand gripping the riser just below arrow shelf:
  const handY = grip.y;
  ctx.fillStyle = '#1c2026'; // Archery glove dark matte leather
  ctx.beginPath();
  ctx.roundRect(riserX - 22 * s, handY - 26 * s, 44 * s, 56 * s, 14 * s);
  ctx.fill();

  // Glove gold-embroidered tension straps:
  ctx.strokeStyle = BRASS_GOLD;
  ctx.lineWidth = 2 * s;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(riserX - 18 * s, handY - 14 * s + i * 14 * s);
    ctx.lineTo(riserX + 16 * s, handY - 14 * s + i * 14 * s);
    ctx.stroke();
  }

  // Right drawing hand (holding string tab/nock when drawing):
  if (drawing) {
    ctx.fillStyle = SKIN_TONE;
    ctx.beginPath();
    ctx.ellipse(nock.x + 12 * s, nock.y + 10 * s, 18 * s, 24 * s, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Finger leather tab:
    ctx.fillStyle = '#4a2d1d';
    ctx.beginPath();
    ctx.ellipse(nock.x + 3 * s, nock.y + 4 * s, 8 * s, 11 * s, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/** Sacred Fire Flame on Agneyastra Arrow */
export function drawFlame(ctx, x, y, r, time, ux = 0, uy = -1, nx = 1, ny = 0) {
  const flick = 1 + Math.sin(time / 45) * 0.12 + Math.cos(time / 28) * 0.08;
  const flickX = Math.sin(time / 35) * r * 0.15;
  const flickY = Math.cos(time / 40) * r * 0.15;

  ctx.save();

  // 1. Warm radiant outer glow:
  const aura = ctx.createRadialGradient(x, y, 0, x, y, r * flick * 2.4);
  aura.addColorStop(0, 'rgba(255, 245, 180, 0.95)');
  aura.addColorStop(0.3, 'rgba(255, 140, 30, 0.75)');
  aura.addColorStop(0.65, 'rgba(255, 50, 10, 0.35)');
  aura.addColorStop(1, 'rgba(255, 30, 0, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(x, y, r * flick * 2.4, 0, Math.PI * 2);
  ctx.fill();

  // 2. Trailing flame tongue licking backwards along shaft:
  ctx.fillStyle = 'rgba(255, 160, 30, 0.85)';
  ctx.beginPath();
  ctx.moveTo(x + nx * r * 0.35, y + ny * r * 0.35);
  ctx.quadraticCurveTo(
    x - ux * r * 1.3 + nx * flickX,
    y - uy * r * 1.3 + ny * flickY,
    x - ux * r * 1.9,
    y - uy * r * 1.9
  );
  ctx.quadraticCurveTo(
    x - ux * r * 0.9 - nx * flickX,
    y - uy * r * 0.9 - ny * flickY,
    x - nx * r * 0.35,
    y - ny * r * 0.35
  );
  ctx.closePath();
  ctx.fill();

  // 3. Incandescent white-hot center core:
  const core = ctx.createRadialGradient(x, y, 0, x, y, r * flick * 0.55);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.4, '#ffe082');
  core.addColorStop(0.8, '#ff9800');
  core.addColorStop(1, 'rgba(255, 87, 34, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r * flick * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
