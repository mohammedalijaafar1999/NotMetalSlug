// LEVIATHAN (boss_m4) art: every sprite of the Legion submarine, baked procedurally.
// All parts are authored facing RIGHT (bow on the right) and flipped at draw time.
//
// Sub-local coordinates used throughout m4/: x = 0 at the conning tower centre (+x = toward the bow),
// y = 0 at the hull waterline (negative = up). The hull sprite's origin is that point.
//
//  bm4_hull    hull + monster head (frames = damage level 0..3)
//  bm4_jaw     hinged lower jaw (frames = opening angle 0..3)
//  bm4_eye     glowing eye lens (0 normal, 1 bright, 2 flicker-dim, 3 white-hot)
//  bm4_tower   conning tower / sail (frames = damage level 0..3)
//  bm4_flag    Legion pennant on the tower (3 wave frames)
//  bm4_scope   periscope head (0 dark, 1 red, 2 charging, 3 firing)
//  bm4_pod     missile pod (0 closed, 1 light on, 2 half open, 3 open, 4 destroyed)
//  bm4_hatch   claw hatch on the head (0 closed, 1 blown open)
//  bm4_shoulder claw arm turret mount, bm4_joint hydraulic hub
//  bm4_claw    three-fingered claw (0 open, 1 half, 2 closed, 3 spread wide)
//  bm4_torpedo skimming torpedo (3 propeller frames), bm4_missile pod missile (2 flame frames)
//  bm4_tube    torpedo tube glow (2 frames), bm4_flare laser impact (3 frames)
//  bm4_debris  hull plate / rust plate / porthole / pipe / tooth / hatch cover

import { sprites } from '../../../engine/sprites';
import { parseColor, type PixelArt } from '../../../engine/pixelart';
import { BC, Pen, plate, rivet, rivetRow, hazardStripes, cog, hash2 } from '../common/kit';

// ------------------------------------------------------------------ palette

export const LV = {
  // hull plating (Legion olive, a shade darker than the light machines: it is huge and wet)
  hTop: BC.oliveLL,
  h0: BC.oliveL,
  h1: BC.olive,
  h2: '#6a6238',
  h3: BC.oliveD,
  h4: BC.oliveDD,
  h5: '#2a2616',
  wet: '#8e8c6a',
  // anti-fouling paint below the waterline
  r0: '#b85a34',
  r1: BC.rust,
  r2: '#88401f',
  r3: BC.rustD,
  r4: '#4a2012',
  boot: '#1a1614',
  bootL: '#e8e0c8',
  // black-iron head armour
  i0: BC.ironLL,
  i1: BC.ironL,
  i2: BC.iron,
  i3: BC.ironD,
  i4: BC.ironDD,
  tooth: '#ece6d0',
  toothS: '#aaa38c',
  toothD: '#6e6858',
  mouth: '#2a0a0c',
  mouthL: '#5a1414',
  mouthG: '#a8281a',
  // glows
  eye: '#ff4a26',
  eyeL: '#ffb050',
  eyeLL: '#fff4c0',
  port: '#ffb040',
  portL: '#fff0a0',
  portD: '#a85a18',
  // claw / arm steel
  s0: BC.steelLL,
  s1: BC.steelL,
  s2: BC.steel,
  s3: BC.steelD,
  s4: BC.steelDD,
  chrome: BC.chrome,
  // scorch
  soot: '#262220',
  sootL: '#3c3632',
  ember: '#ff7a2a',
  emberL: '#ffd060',
  hole: '#120e10',
  rib: '#6a3a22',
} as const;

const MARK = '#ff00fe';

/** Draw a shape in a marker colour, then recolour its pixels by local position. */
function shadeFill(p: PixelArt, shape: (c: string) => void, colorAt: (x: number, y: number) => string): void {
  shape(MARK);
  const m = parseColor(MARK);
  const ox = p.ox;
  const oy = p.oy;
  p.mapPixels((v, x, y) => (v === m ? parseColor(colorAt(x - ox, y - oy)) : v));
}

/** Dithered rust streak running down from (x, y). */
function rustStreak(d: Pen, x: number, y: number, len: number, seed: number): void {
  for (let i = 0; i < len; i++) {
    const k = hash2(x, y + i, seed);
    if (i < 2 || k < 0.7 - i * 0.08) d.px(x, y + i, i < 2 ? BC.rust : BC.rustD);
  }
}

/** Bullet dent: dark pit with a bright rim pixel. */
function dent(d: Pen, x: number, y: number): void {
  d.px(x, y, LV.h5);
  d.px(x + 1, y, LV.h4);
  d.px(x, y + 1, LV.h4);
  d.px(x - 1, y - 1, LV.h0);
}

/** Scorch blotch (dither of soot). */
function scorch(d: Pen, cx: number, cy: number, rx: number, ry: number, seed: number, clip?: (x: number, y: number) => boolean): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (q > 1) continue;
      if (clip && !clip(x, y)) continue;
      const n = hash2(x, y, seed);
      if (n < 0.75 - q * 0.55) d.px(x, y, q < 0.35 && n < 0.3 ? LV.soot : LV.sootL);
    }
  }
}

/** Torn hole showing the dark interior with ribs (and optional fire glow). */
function tornHole(d: Pen, x: number, y: number, w: number, h: number, seed: number, fire: boolean): void {
  // Jagged outline: per-column random top/bottom inset.
  for (let i = 0; i < w; i++) {
    const t0 = Math.floor(hash2(x + i, y, seed) * 3);
    const b0 = Math.floor(hash2(x + i, y + h, seed + 7) * 3);
    for (let j = t0; j < h - b0; j++) {
      const edge = j === t0 || j === h - b0 - 1;
      const rib = (i + seed) % 6 === 0;
      let c: string = LV.hole;
      if (rib) c = LV.rib;
      if (fire && j > h * 0.45 && hash2(x + i, y + j, seed + 3) < 0.55) c = j > h * 0.7 ? LV.emberL : LV.ember;
      if (edge) c = LV.h0;
      d.px(x + i, y + j, c);
    }
  }
}

// ------------------------------------------------------------------ hull (+ monster head)

/** Hull sprite geometry: local (0,0) = canvas (HULL_OX, HULL_OY). */
export const HULL_OX = 160;
export const HULL_OY = 36;
const HULL_W = 264;
const HULL_H = 62;
/** Bow tip (snout) local x, deck local y, keel. */
export const BOW_X = 101;
export const DECK_Y = -22;
/** Hinge of the lower jaw (sub-local). */
export const JAW_HX = 60;
export const JAW_HY = -12;
/** Torpedo tube mouths (sub-local). */
export const TUBE_X = 66;
export const TUBE_Y = -7;
/** Eye centre (sub-local). */
export const EYE_X = 80;
export const EYE_Y = -23;
/** Claw shoulder mount on top of the head (sub-local). */
export const SHOULDER_X = 72;
export const SHOULDER_Y = -33;
/** Missile pod centres (sub-local x) on the deck. */
export const POD_F_X = 44;
export const POD_A_X = -50;
/** Stern exhaust vent. */
export const VENT_X = -104;

function hullTop(lx: number): number {
  if (lx < -112) {
    const t = (-112 - lx) / 46;
    return Math.round(-21 + 17 * Math.pow(Math.min(1, t), 1.6));
  }
  return DECK_Y;
}

function hullBot(lx: number): number {
  if (lx < -126) {
    const t = Math.max(0, (lx + 158) / 32);
    return Math.round(3 + 19 * Math.sqrt(t));
  }
  if (lx > 26) {
    const t = Math.min(1, (lx - 26) / 38);
    return Math.round(22 - 15 * t * t);
  }
  return 22;
}

const PORTS = [-132, -112, -92, -72, -30, -10, 10, 28];
const SEAMS = [-136, -110, -84, -58, -32, -6, 20];

function drawHull(p: PixelArt, dmg: number): void {
  const d = new Pen(p, HULL_OX, HULL_OY);
  // ---- body (stern .. jaw hinge), per-pixel shaded
  shadeFill(
    p,
    (c) => {
      for (let lx = -158; lx <= 62; lx++) {
        const t = hullTop(lx);
        const b = hullBot(lx);
        d.rect(lx, t, 1, b - t + 1, c);
      }
    },
    (x, y) => {
      const lx = x - HULL_OX;
      const ly = y - HULL_OY;
      const t = hullTop(lx);
      const b = hullBot(lx);
      if (ly <= t) return LV.hTop;
      if (ly === t + 1) return LV.h0;
      if (ly < 0) {
        // Upper hull: lit band near the deck, darker toward the waterline.
        if (ly === -8) return LV.h4; // horizontal plate seam
        if (ly === -7) return LV.h1;
        if (ly <= t + 4) return LV.h1;
        if (ly <= -13) return ((lx + ly) & 1) === 0 && ly === t + 5 ? LV.h1 : LV.h2;
        if (ly <= -9) return LV.h2;
        if (ly >= -2) return LV.h4;
        return LV.h3;
      }
      if (ly <= 1) return ly === 0 ? LV.boot : LV.boot;
      // Anti-fouling paint.
      if (ly >= b) return LV.r4;
      if (ly >= b - 3) return LV.r3;
      if (ly <= 3) return LV.r1;
      if (ly === 9) return LV.r3; // ballast tank seam
      if (ly === 10) return LV.r0;
      return LV.r2;
    },
  );
  // Waterline wet sheen just above the boot-top.
  for (let lx = -150; lx <= 60; lx += 1) if (hash2(lx, 3, 1) < 0.35) d.px(lx, -1, LV.wet);
  // Vertical plate seams with rivets on the upper hull.
  for (const sx of SEAMS) {
    const t = hullTop(sx);
    for (let y = t + 2; y <= -2; y++) {
      if (y === -8) continue;
      d.px(sx, y, LV.h4);
      d.px(sx + 1, y, y < -8 ? LV.h1 : LV.h2);
    }
    for (let y = t + 3; y <= -3; y += 3) rivet(d, sx - 2, y, LV.h0, LV.h4);
  }
  // Rivet rows along the seams.
  for (let x = -150; x <= 56; x += 4) {
    if (hullTop(x) <= -12) rivet(d, x, -10, LV.h0, LV.h4);
    rivet(d, x + 2, -5, LV.h1, LV.h5);
  }
  // Ballast seam rivets (below waterline).
  for (let x = -122; x <= 30; x += 5) d.px(x, 7, LV.r0);
  // Limber holes along the keel.
  for (let x = -116; x <= 20; x += 9) d.rect(x, 15, 4, 2, LV.r4);
  // Portholes: brass rims, warm glow.
  PORTS.forEach((px, i) => {
    const broken = (dmg >= 1 && i === 5) || (dmg >= 2 && i === 1) || (dmg >= 3 && (i === 3 || i === 7));
    d.circle(px + 1.5, -14.5, 2.6, BC.brassD);
    d.circle(px + 1.2, -14.8, 2.1, BC.brass);
    d.rect(px, -16, 3, 3, broken ? LV.hole : LV.port);
    if (!broken) {
      d.px(px, -16, LV.portL);
      d.px(px + 2, -14, LV.portD);
    } else d.px(px + 1, -15, LV.soot);
    if (hash2(px, 4, 2) < 0.7) rustStreak(d, px + 1, -11, 4 + Math.floor(hash2(px, 5, 2) * 4), px);
  });
  // Rust streaks from the deck edge and rivets.
  for (let x = -146; x <= 52; x += 7) {
    if (hash2(x, 9, 3) < 0.45) rustStreak(d, x, hullTop(x) + 2, 3 + Math.floor(hash2(x, 8, 3) * 5), x + 11);
  }
  // Hazard chevrons behind the head (symmetric so the flipped sprite reads the same).
  for (let i = 0; i < 3; i++) {
    const cx = 32 + i * 5;
    d.poly([cx, -6, cx + 2, -6, cx + 4, -4, cx + 2, -2, cx, -2, cx + 2, -4], BC.hazard);
  }
  // ---- deck furniture
  // Stern rudder fin (upper) and lower fin.
  d.poly([-157, -5, -152, -19, -143, -19, -139, -8, -146, -3], LV.h2);
  d.poly([-152, -19, -143, -19, -144, -17, -151, -17], LV.h0);
  d.rect(-149, -15, 1, 8, LV.h4);
  d.poly([-157, 4, -146, 4, -142, 14, -152, 14], LV.r2);
  d.poly([-156, 4, -147, 4, -146, 6, -155, 6], LV.r0);
  // Propeller (hub + blades) behind the stern.
  d.rect(-161, 1, 4, 5, BC.brassD);
  d.rect(-161, 1, 3, 2, BC.brass);
  d.poly([-160, -3, -158, -3, -158, 2, -160, 2], BC.brassD);
  d.poly([-160, 5, -158, 5, -158, 11, -160, 11], BC.brassD);
  // Exhaust vent box near the stern.
  plate(d, VENT_X - 4, -26, 9, 4, LV.h2, LV.h0, LV.h4);
  d.rect(VENT_X - 3, -25, 7, 1, LV.h5);
  // Deck hatch and bollards.
  d.rect(-84, -24, 10, 2, LV.h3);
  d.rect(-84, -24, 10, 1, LV.h0);
  d.px(-80, -25, LV.h1);
  for (const bx of [-122, -20, 30]) {
    d.rect(bx, -25, 3, 3, LV.h4);
    d.rect(bx, -25, 2, 1, LV.h0);
  }
  // Anti-skid deck walkway texture.
  for (let x = -110; x <= 40; x += 3) if (hash2(x, 1, 5) < 0.5) d.px(x, DECK_Y + 1, LV.h1);

  // ---- monster head (black iron armour over the bow)
  drawHead(d, p, dmg);

  // ---- damage overlays
  if (dmg >= 1) {
    for (const [x, y] of [[-66, -17], [-38, -12], [4, -18], [-118, -14], [36, -15]] as const) dent(d, x, y);
    scorch(d, -60, -14, 9, 5, 11, (x, y) => y > hullTop(x) && y < -1);
  }
  if (dmg >= 2) {
    tornHole(d, -78, -20, 16, 10, 4, false);
    // Hanging bent plate below the hole.
    d.poly([-79, -10, -63, -10, -66, -3, -80, -5], LV.h2);
    d.poly([-79, -10, -63, -10, -64, -9, -79, -9], LV.h0);
    rivetRow(d, -77, -66, -7, 4, LV.h0, LV.h5);
    scorch(d, 6, -12, 12, 6, 13, (x, y) => y > hullTop(x) && y < -1);
    for (const [x, y] of [[-100, -18], [-50, -6], [18, -19], [-8, -6]] as const) dent(d, x, y);
  }
  if (dmg >= 3) {
    tornHole(d, -30, -21, 22, 15, 9, true);
    tornHole(d, -134, -18, 10, 8, 5, true);
    scorch(d, -110, -12, 14, 7, 17, (x, y) => y > hullTop(x) && y < -1);
    scorch(d, 40, -14, 10, 6, 19, (x, y) => y > hullTop(x) && y < -1);
    // Peeled deck plates.
    d.poly([-100, -22, -88, -22, -86, -27, -98, -25], LV.h1);
    d.poly([-100, -22, -88, -22, -88, -23, -100, -23], LV.h4);
  }
}

function drawHead(d: Pen, p: PixelArt, dmg: number): void {
  // Mouth cavity behind the jaw (visible when the jaw opens).
  d.poly([56, -13, 98, -13, 100, -2, 94, 6, 60, 6, 56, 0], LV.mouth);
  d.poly([58, -12, 94, -12, 92, -9, 60, -9], LV.mouthL);
  d.rect(56, -12, 6, 16, LV.i3);
  // Torpedo tube mouths on the back wall.
  for (const ty of [TUBE_Y - 1, TUBE_Y + 5]) {
    d.circle(TUBE_X - 1, ty, 2.6, LV.i2);
    d.circle(TUBE_X - 1, ty, 1.7, LV.hole);
    d.px(TUBE_X - 2, ty - 2, LV.i0);
  }
  // Upper skull: black iron, shaded top-left.
  const skull = [44, -22, 52, -27, 62, -32, 74, -35, 86, -33, 94, -29, 100, -23, 102, -17, 101, -13, 60, -13, 48, -16];
  shadeFill(
    p,
    (c) => d.poly(skull, c),
    (x, y) => {
      const lx = x - HULL_OX;
      const ly = y - HULL_OY;
      // Brow ridge band.
      const brow = -33 + (lx - 74) * (lx < 74 ? -0.08 : 0.17);
      if (ly < brow + 1.5) return LV.i0;
      if (ly < brow + 3) return LV.i1;
      if (ly > -16) return LV.i3;
      if (lx > 96) return LV.i3;
      return lx < 64 && ly < -24 ? LV.i1 : LV.i2;
    },
  );
  // Brow plate rivets.
  for (let x = 56; x <= 92; x += 4) rivet(d, x, Math.round(-31 + (x - 74) * (x < 74 ? -0.08 : 0.17)) + 3, LV.i0, LV.i4);
  // Snout plate seam.
  d.line(96, -27, 99, -15, LV.i4);
  d.line(95, -27, 98, -15, LV.i1);
  // Gill vents behind the eye.
  for (let i = 0; i < 3; i++) {
    const gx = 52 + i * 5;
    d.poly([gx, -24, gx + 2, -24, gx + 4, -17, gx + 2, -17], LV.i4);
    d.px(gx, -25, LV.i0);
  }
  // Eye socket: brass rim around a dark well (lens drawn by bm4_eye).
  d.ellipse(EYE_X, EYE_Y, 6.4, 5, BC.brassD);
  d.ellipse(EYE_X - 0.4, EYE_Y - 0.4, 5.4, 4, BC.brass);
  d.ellipse(EYE_X, EYE_Y, 4.4, 3.2, LV.hole);
  d.px(EYE_X - 4, EYE_Y - 3, BC.brassL);
  // Angry brow over the eye.
  d.poly([71, -30, 90, -26, 89, -24, 72, -28], LV.i4);
  // Upper teeth hanging along the mouth line.
  for (let i = 0; i < 6; i++) {
    const tx = 66 + i * 6;
    const big = i === 4;
    const len = big ? 6 : 4;
    d.tri(tx, -13, tx + 4, -13, tx + 2, -13 + len, LV.tooth);
    d.px(tx + 3, -12, LV.toothS);
    d.px(tx + 2, -13 + len - 1, LV.toothS);
  }
  d.rect(60, -14, 41, 1, LV.i4);
  // Claw hatch outline on the skull top (the hatch sprite is drawn over it).
  d.rect(SHOULDER_X - 7, SHOULDER_Y + 1, 14, 1, LV.i4);
  if (dmg >= 2) {
    // Cracked brow plate.
    d.line(86, -32, 90, -27, LV.i4);
    d.line(90, -27, 88, -24, LV.i4);
    d.px(87, -31, LV.i0);
  }
  if (dmg >= 3) scorch(d, 66, -26, 9, 5, 23);
}

sprites.define({
  name: 'bm4_hull',
  w: HULL_W,
  h: HULL_H,
  ox: HULL_OX,
  oy: HULL_OY,
  frames: 4,
  draw: (p, f) => drawHull(p, f),
});

// ------------------------------------------------------------------ lower jaw

/** Jaw sprite origin = the hinge. Frames = opening angles. */
export const JAW_ANGLES = [0, 0.15, 0.3, 0.44];

sprites.define({
  name: 'bm4_jaw',
  w: 50,
  h: 36,
  ox: 6,
  oy: 6,
  frames: 4,
  draw: (p, f) => {
    const d = new Pen(p, 6, 6, JAW_ANGLES[f]);
    // Jaw body (hinge at 0,0; extends forward to x=40).
    d.poly([-3, -2, 38, -2, 42, 1, 40, 7, 30, 11, 8, 13, -2, 11, -5, 4], LV.i2);
    d.poly([-3, -2, 38, -2, 40, 0, -3, 1], LV.i1);
    d.poly([8, 13, 30, 11, 40, 7, 40, 9, 30, 13, 8, 15, -2, 13], LV.i3);
    // Chin plate + rivets.
    d.poly([26, 2, 40, 1, 39, 6, 28, 8], LV.i1);
    d.poly([27, 3, 39, 2, 39, 3, 27, 4], LV.i0);
    for (let x = 2; x <= 34; x += 5) d.px(x, 5, LV.i0);
    for (let x = 4; x <= 30; x += 5) d.px(x, 9, LV.i4);
    // Hinge boss.
    d.circle(0, 2, 3.4, LV.i3);
    d.circle(-0.4, 1.6, 2.4, LV.i1);
    d.circle(0, 2, 1, LV.i4);
    // Lower teeth pointing up.
    for (let i = 0; i < 5; i++) {
      const tx = 9 + i * 6;
      d.tri(tx, -2, tx + 4, -2, tx + 2, -6, LV.tooth);
      d.px(tx + 3, -3, LV.toothS);
    }
    // Hazard chevrons on the lip.
    for (let i = 0; i < 3; i++) {
      d.px(12 + i * 8, 1, BC.hazard);
      d.px(13 + i * 8, 2, BC.hazard);
    }
  },
});

// ------------------------------------------------------------------ eye

sprites.define({
  name: 'bm4_eye',
  w: 10,
  h: 8,
  ox: 5,
  oy: 4,
  frames: 4,
  outline: null,
  draw: (p, f) => {
    const d = new Pen(p, 5, 4);
    const base = f === 2 ? '#7a1a10' : f === 3 ? '#ffe0a0' : LV.eye;
    const mid = f === 2 ? '#b03018' : f === 3 ? '#ffffff' : LV.eyeL;
    d.ellipse(0, 0, 4.3, 3.1, base);
    d.ellipse(0.6, 0, 2.6, 1.8, mid);
    // Slit pupil.
    if (f !== 3) d.rect(0, -2, 1, 4, f === 2 ? '#3a0a08' : '#5a0a06');
    d.px(-2, -2, f === 2 ? '#c04020' : LV.eyeLL);
    if (f === 1) {
      d.px(-1, -2, LV.eyeLL);
      d.px(2, 1, LV.eyeLL);
    }
  },
});

// ------------------------------------------------------------------ conning tower

/** Tower sprite origin = base centre on the deck (sub-local (0, DECK_Y)). */
export const TOWER_TOP = -64;
/** Periscope housing (tower-local). */
export const SCOPE_X = 5;
export const SCOPE_Y = -68;
export const FLAG_X = -15;
export const FLAG_Y = -84;
export const RADAR_X = -7;
export const RADAR_Y = -75;
export const LAMP_X = 15;
export const LAMP_Y = -60;

function drawTower(p: PixelArt, dmg: number): void {
  const d = new Pen(p, 28, 92);
  const body = [-22, 0, -17, TOWER_TOP, 12, TOWER_TOP, 17, -61, 20, -55, 22, -44, 22, 0];
  shadeFill(
    p,
    (c) => d.poly(body, c),
    (x, y) => {
      const lx = x - 28;
      const ly = y - 92;
      if (ly <= TOWER_TOP + 1) return BC.oliveLL;
      // Rounded leading edge highlight / trailing edge shade.
      const back = -22 + (ly / TOWER_TOP) * 5;
      if (lx <= back + 1) return BC.oliveL;
      if (lx >= 20 || (ly < -52 && lx >= 15)) return BC.oliveDD;
      if (lx >= 17) return BC.oliveD;
      if (ly === -44 || ly === -14) return BC.oliveDD; // plate seams
      if (ly === -43 || ly === -13) return BC.oliveL;
      if (lx < -12) return BC.olive;
      return ly > -6 ? LV.h2 : BC.olive;
    },
  );
  // Vertical seams + rivets.
  for (const sx of [-8, 9]) {
    for (let y = -43; y <= -15; y++) {
      d.px(sx, y, BC.oliveDD);
      d.px(sx + 1, y, BC.oliveL);
    }
  }
  rivetRow(d, -19, 19, -46, 4, BC.oliveLL, BC.oliveDD);
  rivetRow(d, -20, 19, -16, 4, BC.oliveLL, BC.oliveDD);
  // Ladder rungs on the trailing edge.
  for (let y = -6; y >= -56; y -= 5) {
    const bx = -22 + (y / TOWER_TOP) * 5;
    d.rect(bx + 2, y, 3, 1, BC.oliveDD);
  }
  // Legion cog emblem on a dark badge.
  d.circle(1, -29, 9.5, BC.oliveDD);
  d.circle(1, -29, 8.6, LV.h4);
  cog(d, 1, -29, 6.2);
  // Bridge windows with a warm glow (the crew).
  const wins: [number, number][] = [
    [-11, -56],
    [-4, -56],
    [3, -56],
  ];
  wins.forEach(([wx, wy], i) => {
    const broken = (dmg >= 1 && i === 2) || (dmg >= 3 && i === 0);
    d.rect(wx - 1, wy - 1, 7, 6, BC.oliveDD);
    d.rect(wx, wy, 5, 4, broken ? LV.hole : '#ffb040');
    if (!broken) {
      d.rect(wx, wy, 5, 1, '#fff0a0');
      d.px(wx + 4, wy + 3, '#a85a18');
    } else {
      d.line(wx, wy, wx + 4, wy + 3, '#ffb040');
    }
  });
  // Slanted front window.
  d.poly([10, -57, 15, -57, 18, -52, 10, -52], BC.oliveDD);
  d.poly([11, -56, 15, -56, 17, -53, 11, -53], dmg >= 2 ? LV.hole : BC.glass);
  if (dmg < 2) d.line(11, -56, 14, -56, BC.glassL);
  // Bridge cockpit rail.
  d.rect(-15, TOWER_TOP - 3, 26, 1, BC.oliveD);
  for (let x = -15; x <= 10; x += 5) d.rect(x, TOWER_TOP - 3, 1, 3, BC.oliveD);
  // Periscope housing.
  plate(d, SCOPE_X - 3, TOWER_TOP - 4, 7, 4, BC.steel, BC.steelLL, BC.steelD);
  // Radar mast.
  d.rect(RADAR_X, RADAR_Y + 2, 1, TOWER_TOP - RADAR_Y - 2, BC.steelD);
  d.rect(RADAR_X - 1, RADAR_Y + 1, 3, 2, BC.steel);
  // Flag pole.
  d.rect(FLAG_X, FLAG_Y, 1, TOWER_TOP - FLAG_Y, BC.steelD);
  d.px(FLAG_X, FLAG_Y - 1, BC.brassL);
  // Searchlight lamp on the leading edge top.
  d.rect(LAMP_X - 2, LAMP_Y - 2, 4, 4, BC.steelD);
  d.rect(LAMP_X - 1, LAMP_Y - 1, 3, 3, '#fff2b0');
  // Fairwater plane (diving fin): short swept airfoil on the leading edge.
  if (dmg < 2) {
    d.poly([18, -43, 25, -42, 30, -39, 29, -37, 18, -35], BC.oliveD);
    d.poly([18, -43, 25, -42, 29, -39.5, 18, -39], BC.oliveL);
    d.px(27, -38, BC.oliveDD);
  } else {
    // Bent and drooping.
    d.poly([18, -43, 24, -40, 28, -33, 26, -32, 22, -36, 18, -35], BC.oliveD);
    d.poly([18, -43, 24, -40, 23, -39, 18, -39], BC.oliveL);
  }
  // Rust streaks under the windows / rivets.
  for (const [x, y] of [[-9, -51], [-2, -51], [6, -51], [-14, -42], [12, -42], [-4, -12]] as const) rustStreak(d, x, y, 4 + Math.floor(hash2(x, y, 7) * 4), x * 3 + y);
  // Damage.
  if (dmg >= 1) {
    for (const [x, y] of [[-13, -36], [14, -24], [-5, -20], [6, -40]] as const) dent(d, x, y);
  }
  if (dmg >= 2) {
    tornHole(d, -18, -12, 12, 9, 21, false);
    scorch(d, 8, -22, 8, 9, 25, (x, y) => y < -1);
    for (const [x, y] of [[-16, -50], [17, -30], [0, -8]] as const) dent(d, x, y);
  }
  if (dmg >= 3) {
    tornHole(d, 4, -48, 13, 11, 27, true);
    scorch(d, -10, -40, 9, 12, 29, (x, y) => y < -1);
    scorch(d, 1, -29, 7, 6, 31);
  }
}

sprites.define({
  name: 'bm4_tower',
  w: 64,
  h: 96,
  ox: 28,
  oy: 92,
  frames: 4,
  draw: (p, f) => drawTower(p, f),
});

// Legion pennant (origin = pole attachment, left middle).
sprites.define({
  name: 'bm4_flag',
  w: 16,
  h: 11,
  ox: 0,
  oy: 2,
  frames: 4,
  draw: (p, f) => {
    const d = new Pen(p, 0, 2);
    if (f === 3) {
      // Burnt rag.
      d.poly([0, -1, 7, 0, 5, 3, 8, 5, 0, 5], '#5a2418');
      d.px(3, 1, LV.ember);
      return;
    }
    const w = [0, 1, -1][f];
    d.poly([0, -1, 14, 0 + w, 12, 3, 14, 6 - w, 0, 6], BC.red);
    d.poly([0, -1, 14, 0 + w, 13.5, 1, 0, 1], BC.redL);
    d.poly([0, 5, 14, 6 - w, 13, 7 - w, 0, 7], BC.redD);
    cog(d, 5.5, 2.6, 1.9);
  },
});

// ------------------------------------------------------------------ periscope head

sprites.define({
  name: 'bm4_scope',
  w: 16,
  h: 12,
  ox: 6,
  oy: 11,
  frames: 4,
  draw: (p, f) => {
    const d = new Pen(p, 6, 11);
    plate(d, -4, -9, 9, 9, BC.steel, BC.steelLL, BC.steelD);
    d.rect(-4, -10, 9, 1, BC.steelL);
    d.rect(-2, -11, 5, 1, BC.steelD);
    // Lens housing (faces forward).
    d.rect(4, -8, 4, 6, BC.steelD);
    d.rect(4, -8, 4, 1, BC.steelL);
    const lens = [ '#5a1410', '#ff3a2a', '#ffb060', '#ffffff'][f];
    const lensL = ['#8a2a20', '#ffb080', '#ffffff', '#ffffff'][f];
    d.rect(8, -7, 2, 4, lens);
    d.px(8, -7, lensL);
    // Bands.
    d.rect(-4, -4, 9, 1, BC.steelDD);
    rivet(d, -2, -7, BC.steelLL, BC.steelDD);
    if (f >= 2) {
      d.px(10, -5, '#ffd0a0');
      d.px(10, -6, f === 3 ? '#ffffff' : '#ff8060');
    }
  },
});

// ------------------------------------------------------------------ missile pod

sprites.define({
  name: 'bm4_pod',
  w: 30,
  h: 26,
  ox: 15,
  oy: 25,
  frames: 5,
  draw: (p, f) => {
    const d = new Pen(p, 15, 25);
    if (f === 4) {
      // Destroyed: blackened torn box, embers inside.
      d.rect(-10, -4, 20, 4, LV.i3);
      d.poly([-13, -4, -12, -13, -8, -10, -5, -15, -1, -11, 3, -16, 7, -11, 11, -14, 13, -4], LV.soot);
      d.poly([-11, -5, -10, -11, -7, -8, -4, -12, 0, -8, 4, -13, 7, -9, 10, -11, 11, -5], LV.hole);
      for (const [x, y] of [[-6, -7], [1, -9], [6, -7], [-2, -6]] as const) d.px(x, y, LV.ember);
      d.px(4, -8, LV.emberL);
      d.poly([-13, -4, -11, -8, -9, -4], LV.sootL);
      return;
    }
    // Pedestal.
    d.rect(-10, -4, 20, 4, LV.i3);
    d.rect(-10, -4, 20, 1, LV.i1);
    rivetRow(d, -8, 8, -2, 4, LV.i0, LV.i4);
    // Box body.
    plate(d, -13, -17, 26, 13, BC.olive, BC.oliveL, BC.oliveD);
    d.rect(-12, -16, 24, 1, BC.oliveLL);
    // Front hazard band (forward = right).
    hazardStripes(d, 8, -15, 4, 10, BC.hazard, BC.black, 4);
    // Launch cell outlines on the side.
    d.rect(-11, -12, 8, 6, BC.oliveD);
    d.rect(-1, -12, 8, 6, BC.oliveD);
    d.rect(-10, -11, 6, 4, BC.olive);
    d.rect(0, -11, 6, 4, BC.olive);
    rivet(d, -11, -6, BC.oliveLL, BC.oliveDD);
    rivet(d, 5, -6, BC.oliveLL, BC.oliveDD);
    // Warning light.
    d.rect(-13, -21, 3, 3, BC.steelD);
    d.rect(-12, -20, 1, 1, f === 1 || f >= 2 ? '#ff3a2a' : '#6a1a14');
    if (f === 1 || f >= 2) d.px(-12, -21, '#ffb0a0');
    // Hatch doors: flush, 45 degrees, or standing up.
    if (f <= 1) {
      d.rect(-12, -18, 11, 2, BC.oliveD);
      d.rect(0, -18, 11, 2, BC.oliveD);
      d.rect(-12, -18, 11, 1, BC.oliveL);
      d.rect(0, -18, 11, 1, BC.oliveL);
    } else if (f === 2) {
      d.poly([-12, -17, -10, -17, -3, -24, -5, -25], BC.oliveD);
      d.poly([10, -17, 12, -17, 5, -25, 3, -24], BC.oliveD);
      d.line(-12, -18, -6, -24, BC.oliveL);
      d.line(11, -18, 5, -24, BC.oliveL);
      // Missile noses peeking.
      for (const mx of [-6, 3]) {
        d.rect(mx, -19, 3, 2, '#c82a1a');
        d.px(mx + 1, -20, '#ff7a5a');
      }
    } else {
      d.rect(-13, -26, 2, 9, BC.oliveD);
      d.rect(11, -26, 2, 9, BC.oliveD);
      d.rect(-13, -26, 1, 9, BC.oliveL);
      d.rect(11, -26, 1, 9, BC.oliveL);
      for (const mx of [-7, 3]) {
        d.rect(mx, -21, 4, 4, '#c82a1a');
        d.rect(mx + 1, -22, 2, 1, '#ff7a5a');
        d.rect(mx, -18, 4, 1, BC.white);
      }
    }
  },
});

// ------------------------------------------------------------------ claw hatch, shoulder, joint

sprites.define({
  name: 'bm4_hatch',
  w: 18,
  h: 7,
  ox: 9,
  oy: 6,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p, 9, 6);
    if (f === 0) {
      d.ellipse(0, -1, 8, 4, LV.i2);
      d.rect(-8, -1, 17, 2, LV.i3);
      d.ellipse(-1, -2.5, 6, 2.2, LV.i1);
      hazardStripes(d, -8, 0, 17, 1, BC.hazard, BC.black, 4);
      rivet(d, -5, -2, LV.i0, LV.i4);
      rivet(d, 4, -2, LV.i0, LV.i4);
    } else {
      // Blown open: dark hole with a jagged rim.
      d.rect(-8, -2, 17, 3, LV.i3);
      d.rect(-6, -2, 13, 2, LV.hole);
      d.poly([-8, -2, -6, -4, -5, -2], LV.i1);
      d.poly([5, -2, 7, -5, 8, -2], LV.i1);
    }
  },
});

sprites.define({
  name: 'bm4_shoulder',
  w: 26,
  h: 16,
  ox: 13,
  oy: 15,
  draw: (p) => {
    const d = new Pen(p, 13, 15);
    d.rect(-12, -4, 24, 4, LV.i3);
    hazardStripes(d, -12, -4, 24, 2, BC.hazard, BC.black, 4);
    d.ellipse(0, -8, 10, 7, LV.s2);
    d.ellipse(-2, -10, 7, 4.5, LV.s1);
    d.ellipse(-3, -11.5, 3, 1.6, LV.s0);
    d.rect(-10, -5, 20, 1, LV.s3);
    rivetRow(d, -8, 8, -6, 4, LV.s0, LV.s4);
  },
});

sprites.define({
  name: 'bm4_joint',
  w: 14,
  h: 14,
  ox: 7,
  oy: 7,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p, 7, 7);
    const r = f === 0 ? 6 : 4.6;
    d.circle(0, 0, r, LV.s3);
    d.circle(-0.6, -0.6, r - 1.2, LV.s2);
    d.circle(-1.4, -1.6, r * 0.42, LV.s1);
    d.circle(0, 0, r * 0.38, LV.s4);
    d.rect(-1, -1, 2, 2, BC.brass);
    d.px(-1, -1, BC.brassL);
  },
});

// ------------------------------------------------------------------ claw

/** Claw sprite origin = wrist pivot (top centre); fingers point down. Height to the tips. */
export const CLAW_H = 34;

function finger(d: Pen, x0: number, y0: number, x1: number, y1: number, tx: number, ty: number, dark: boolean): void {
  const base = dark ? LV.s3 : LV.s2;
  const lit = dark ? LV.s2 : LV.s1;
  d.cap(x0, y0, x1, y1, 3, base);
  d.cap(x1, y1, tx, ty, 2.2, base);
  d.cap(x0 - 0.8, y0 - 0.6, x1 - 0.8, y1 - 0.6, 1.4, lit);
  // Knuckle with a hazard dot.
  d.circle(x1, y1, 2.6, dark ? LV.s4 : LV.s3);
  d.px(Math.round(x1 - 1), Math.round(y1 - 1), BC.hazard);
  // Sharp tip.
  d.cap(tx + (x1 - tx) * 0.35, ty + (y1 - ty) * 0.35, tx, ty, 1.1, dark ? LV.s1 : LV.s0);
  d.px(Math.round(tx), Math.round(ty), BC.white);
}

sprites.define({
  name: 'bm4_claw',
  w: 46,
  h: 40,
  ox: 23,
  oy: 3,
  frames: 4,
  draw: (p, f) => {
    const d = new Pen(p, 23, 3);
    // Spread per frame: 0 open, 1 half, 2 closed, 3 spread wide.
    const s = [1, 0.55, 0.05, 1.3][f];
    // Middle (far) finger first, darker.
    finger(d, 0, 12, 1 + s * 2, 22, 0 + s * 2, CLAW_H - 1, true);
    // Back finger (left) and front finger (right).
    finger(d, -6, 11, -9 - s * 7, 21, -5 - s * 12, CLAW_H - 2, false);
    finger(d, 6, 11, 9 + s * 7, 21, 5 + s * 12, CLAW_H - 2, false);
    // Palm block.
    plate(d, -9, 4, 18, 9, LV.s2, LV.s1, LV.s3);
    hazardStripes(d, -8, 10, 16, 2, BC.hazard, BC.black, 4);
    rivet(d, -6, 6, LV.s0, LV.s4);
    rivet(d, 5, 6, LV.s0, LV.s4);
    // Wrist cylinder.
    d.rect(-5, -2, 10, 7, LV.s3);
    d.rect(-5, -2, 10, 2, LV.s1);
    d.rect(-3, -3, 6, 1, LV.chrome);
  },
});

// ------------------------------------------------------------------ projectiles

sprites.define({
  name: 'bm4_torpedo',
  w: 26,
  h: 9,
  ox: 13,
  oy: 4,
  frames: 3,
  draw: (p, f) => {
    const d = new Pen(p, 13, 4);
    // Body.
    d.rect(-9, -3, 17, 6, '#3e4250');
    d.rect(-9, -3, 17, 1, '#7a8090');
    d.rect(-9, -2, 17, 1, '#5a6070');
    d.rect(-9, 2, 17, 1, '#262830');
    // Warhead (forward = right): red with a hazard band.
    d.poly([8, -3, 11, -2, 12, 0, 11, 2, 8, 3], '#c8301e');
    d.poly([8, -3, 11, -2, 11.5, -1, 8, -1], '#ff7a50');
    d.rect(6, -3, 2, 6, BC.hazard);
    d.px(6, 2, BC.hazardD);
    d.px(7, -2, BC.black);
    // Tail cone + fins + brass propeller (spins).
    d.poly([-9, -3, -12, -2, -12, 2, -9, 3], '#30343e');
    d.rect(-12, -4, 3, 1, '#262830');
    d.rect(-12, 3, 3, 1, '#262830');
    const bl = [
      [-1, 1],
      [-2, 2],
      [0, 0],
    ][f];
    d.rect(-13, -1, 1, 3, BC.brassD);
    d.rect(-14, -2 + bl[0], 1, 2 + (bl[1] - bl[0]), BC.brass);
    d.rect(-14, 1 - bl[0], 1, 1 + bl[1], BC.brassL);
    // Rivets.
    d.px(-5, -1, '#9aa0b0');
    d.px(1, -1, '#9aa0b0');
  },
});

sprites.define({
  name: 'bm4_missile',
  w: 16,
  h: 7,
  ox: 8,
  oy: 3,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p, 8, 3);
    d.rect(-4, -2, 9, 4, BC.olive);
    d.rect(-4, -2, 9, 1, BC.oliveL);
    d.rect(-4, 1, 9, 1, BC.oliveD);
    d.poly([5, -2, 7, -1, 7.5, 0, 7, 1, 5, 2], '#c82a1a');
    d.px(5, -2, '#ff7a5a');
    d.rect(3, -2, 1, 4, BC.white);
    // Fins.
    d.poly([-4, -2, -6, -3, -5, -1], BC.oliveD);
    d.poly([-4, 1, -6, 3, -5, 0], BC.oliveD);
    // Exhaust.
    if (f === 0) {
      d.rect(-7, -1, 2, 2, '#ffe070');
      d.px(-8, 0, '#ff8a30');
    } else {
      d.rect(-8, -1, 3, 2, '#ffe070');
      d.rect(-8, -1, 1, 2, '#ff8a30');
      d.px(-6, -1, '#ffffff');
    }
  },
});

sprites.define({
  name: 'bm4_tube',
  w: 7,
  h: 7,
  ox: 3,
  oy: 3,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    const d = new Pen(p, 3, 3);
    d.circle(0, 0, 2.6, f ? '#ff7a30' : '#c8301e');
    d.circle(0, 0, 1.4, f ? '#fff0a0' : '#ff8a40');
  },
});

sprites.define({
  name: 'bm4_flare',
  w: 15,
  h: 15,
  ox: 7,
  oy: 7,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    const d = new Pen(p, 7, 7);
    const r = [5, 6.5, 4.5][f];
    d.circle(0, 0, r, '#ff3a50');
    d.circle(0, 0, r * 0.7, '#ff9aa0');
    d.circle(0, 0, r * 0.4, '#ffffff');
    const L = r + 2 + f;
    d.rect(-L, 0, L * 2 + 1, 1, '#ffd0d8');
    d.rect(0, -L, 1, L * 2 + 1, '#ffd0d8');
    if (f === 1) {
      d.line(-4, -4, 4, 4, '#ffe0e8');
      d.line(-4, 4, 4, -4, '#ffe0e8');
    }
  },
});

// ------------------------------------------------------------------ debris

sprites.define({
  name: 'bm4_debris',
  w: 16,
  h: 12,
  ox: 8,
  oy: 6,
  frames: 6,
  draw: (p, f) => {
    const d = new Pen(p, 8, 6);
    switch (f) {
      case 0: // olive hull plate
        d.poly([-7, -3, 6, -5, 7, 2, -6, 4], LV.h2);
        d.poly([-7, -3, 6, -5, 6, -3, -7, -1], LV.h0);
        rivet(d, -4, 0, LV.hTop, LV.h4);
        rivet(d, 3, -1, LV.hTop, LV.h4);
        break;
      case 1: // anti-fouling plate
        d.poly([-6, -4, 7, -2, 5, 4, -7, 2], LV.r2);
        d.poly([-6, -4, 7, -2, 7, -1, -6, -2], LV.r0);
        d.px(0, 1, LV.r4);
        break;
      case 2: // porthole ring
        d.circle(0, 0, 4, BC.brassD);
        d.circle(-0.4, -0.4, 3.2, BC.brass);
        d.circle(0, 0, 1.8, LV.hole);
        d.px(-2, -2, BC.brassL);
        break;
      case 3: // pipe section
        d.rect(-7, -2, 14, 4, LV.s2);
        d.rect(-7, -2, 14, 1, LV.s0);
        d.rect(-7, 1, 14, 1, LV.s3);
        d.rect(-8, -3, 2, 6, LV.s3);
        d.rect(6, -3, 2, 6, LV.s3);
        break;
      case 4: // broken tooth
        d.tri(-3, -4, 4, -4, 0, 5, LV.tooth);
        d.px(2, -3, LV.toothS);
        d.rect(-3, -5, 7, 1, LV.i2);
        break;
      default: // hatch cover
        d.ellipse(0, 0, 7, 3.4, LV.i2);
        d.ellipse(-1, -1, 5, 2, LV.i1);
        d.rect(-7, 1, 14, 1, BC.hazard);
        rivet(d, -3, 0, LV.i0, LV.i4);
        break;
    }
  },
});
