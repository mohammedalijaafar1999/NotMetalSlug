// HORNET KING (boss_m2) art: procedural pixel art for the Legion's twin-rotor heavy gunship.
// Everything is authored facing RIGHT (nose to the right), lit from the top-left, and baked at a
// few tilt angles (TILTS) so the hull can bank crisply. Local part coordinates are relative to the
// fuselage pivot (0, 0); the boss maps them to the world with the same quantized tilt.
//
// Sprites:
//   bm2_hull      hull at NT tilts x 4 damage states (frame = dmg * NT + tilt). Damage 0/1 carry the
//                 aft rotor pylon, 2/3 show the torn stump (the pylon flies off in phase 2).
//   bm2_rotor     3-blade rotor (blades only) NT tilts x ROT_N spin phases (frame = tilt * ROT_N + k)
//   bm2_blur      translucent rotor disc (draw with alpha) per tilt
//   bm2_hub       rotor hub cap (2 frames)
//   bm2_gun       chin "stinger" rotary cannon: GUN_N angles x 2 spin frames (world angle)
//   bm2_pod       wing missile pod: NT tilts x 4 states (closed, opening, open, empty)
//   bm2_bay       bomb-bay doors: NT tilts x 3 states (closed, ajar, open)
//   bm2_missile / bm2_bomb   projectiles;   bm2_pylon (torn aft rotor pylon, normal / charred)
//   bm2_plate     armour plates that break off;   bm2_glow (exhaust / breach glow);  bm2_wreck

import { sprites } from '../../../engine/sprites';
import type { PixelArt } from '../../../engine/pixelart';
import { BC, Pen, cog, rivet, charr, hash2 } from '../common/kit';

// ------------------------------------------------------------------ geometry contract

export const TILTS = [-0.12, -0.06, 0, 0.06, 0.12];
export const NT = TILTS.length;
export const TILT0 = 2;

/** Hull canvas and pivot (canvas coords of local (0, 0)). */
export const HULL_W = 204;
export const HULL_H = 102;
export const HULL_PX = 108;
export const HULL_PY = 62;

/** Local anchor points (facing right, relative to the pivot). */
export const P = {
  hubF: [34, -40] as const,
  hubR: [-66, -50] as const,
  gun: [64, 15] as const,
  pod: [11, 8] as const,
  podMouth: [26, 14] as const,
  bay: [-21, 15] as const,
  exhaust: [-91, -31] as const,
  beacon: [34, -34] as const,
  tailLight: [-104, -5] as const,
  stump: [-64, -26] as const,
  breach: [-64, 11] as const,
  nacelle: [-70, -31] as const,
  eye: [66, -6] as const,
  door: [-16, -3] as const,
};

/** Rotor radius (px) and perspective squash of the disc. */
export const ROTOR_R = 58;
export const ROTOR_K = 0.11;
export const ROT_N = 6;

export const GUN_N = 9;
export const GUN_MAX = 1.45;

export const POD_N = 4; // closed, opening, open, empty
export const BAY_N = 3; // closed, ajar, open

// ------------------------------------------------------------------ helpers

function hl(d: Pen, x0: number, x1: number, y: number, c: string): void {
  d.line(x0, y, x1, y, c);
}

function vl(d: Pen, x: number, y0: number, y1: number, c: string): void {
  d.line(x, y0, x, y1, c);
}

/** Fuselage bottom y at local x (belly + rear loading ramp). */
function bellyAt(x: number): number {
  if (x >= -58) return 16;
  return 16 - ((-58 - x) * 14) / 32;
}

/** Scattered pixels inside a local rect (dither / soot / scorch), only over already-painted art. */
function speckle(d: Pen, x: number, y: number, w: number, h: number, c: string, density: number, seed: number): void {
  const p = d.p;
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      if (hash2(x + xx, y + yy, seed) >= density) continue;
      const [X, Y] = d.t(x + xx + 0.5, y + yy + 0.5);
      if (!p.opaque(Math.floor(X + p.ox), Math.floor(Y + p.oy))) continue;
      d.px(x + xx, y + yy, c);
    }
}

/** Checker dither over already-painted art (soft gradients on the hull). */
function dith(d: Pen, x: number, y: number, w: number, h: number, c: string, phase = 0): void {
  const p = d.p;
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      if ((xx + yy + phase) % 2) continue;
      const [X, Y] = d.t(x + xx + 0.5, y + yy + 0.5);
      if (!p.opaque(Math.floor(X + p.ox), Math.floor(Y + p.oy))) continue;
      d.px(x + xx, y + yy, c);
    }
}

/** Exposed internals where an armour plate is missing: dark cavity, ribs, a cable. */
function hole(d: Pen, x: number, y: number, w: number, h: number, seed: number): void {
  d.rect(x, y, w, h, BC.ironD);
  d.rect(x + 1, y + 1, w - 2, h - 2, BC.ironDD);
  for (let xx = x + 2; xx < x + w - 1; xx += 3) vl(d, xx, y + 1, y + h - 2, BC.iron);
  hl(d, x + 1, x + w - 2, y + Math.floor(h / 2), BC.rustD);
  // Torn edge pixels (bent plate lips catch the light).
  for (let xx = x; xx < x + w; xx++) if (hash2(xx, y, seed) < 0.45) d.px(xx, y, BC.oliveLL);
  for (let yy = y; yy < y + h; yy++) if (hash2(x, yy, seed + 3) < 0.4) d.px(x, yy, BC.oliveL);
  d.px(x + w - 2, y + h - 2, BC.hot);
}

function bulletHole(d: Pen, x: number, y: number): void {
  d.px(x, y, BC.ironDD);
  d.px(x + 1, y, BC.ironD);
  d.px(x, y + 1, BC.ironD);
  d.px(x - 1, y - 1, BC.oliveLL);
}

// ------------------------------------------------------------------ hull

function drawHull(p: PixelArt, tilt: number, dmg: number, wreck = false): void {
  const d = new Pen(p, HULL_PX, HULL_PY, tilt);
  const pylon = dmg < 2;

  // ---- far side (behind the fuselage): far stub wing + pod, far wheels
  d.poly([-8, 2, 20, 0, 22, 3, -6, 5], BC.oliveDD);
  d.cap(-8, 11, 14, 11, 4, BC.steelD);
  d.circle(-51, 19, 4, BC.treadD);
  d.circle(36, 19, 4, BC.treadD);

  // ---- aft rotor pylon + engine nacelle (behind the fuselage top edge)
  if (pylon) {
    d.poly([-84, -20, -78, -40, -54, -40, -46, -20], BC.olive);
    d.poly([-84, -20, -78, -40, -76, -40, -81, -20], BC.oliveL);
    d.poly([-52, -40, -54, -40, -48, -20, -46, -20], BC.oliveD);
    hl(d, -77, -55, -40, BC.oliveLL);
    // Mast.
    d.rect(-69, -48, 6, 8, BC.steel);
    vl(d, -69, -48, -41, BC.steelL);
    vl(d, -64, -48, -41, BC.steelD);
    hl(d, -71, -61, -42, BC.steelD);
    // Swash plate.
    d.rect(-72, -44, 12, 2, BC.steelD);
    hl(d, -72, -61, -44, BC.steelL);
    // Pylon panel line + rivets + hornet stripe on the fairing.
    hl(d, -80, -50, -30, BC.oliveD);
    for (let x = -78; x <= -52; x += 5) rivet(d, x, -37, BC.oliveLL, BC.oliveDD);
    d.poly([-76, -26, -72, -36, -66, -36, -70, -26], BC.hazard);
    d.poly([-66, -26, -62, -36, -58, -36, -62, -26], BC.hazard);
  }

  // ---- fuselage body
  const body = [
    46, -20, 40, -21, -40, -21, -46, -22, -82, -22, -90, -14, -92, -4, -90, 2, -58, 16, 46, 16,
  ];
  d.poly(body, BC.olive);
  // Cylinder shading: top light band, lower shade, belly shadow.
  d.poly([46, -20, 40, -21, -40, -21, -46, -22, -82, -22, -86, -18, -40, -18, 46, -17], BC.oliveL);
  hl(d, -80, 44, -21, BC.oliveLL);
  d.poly([-62, 9, 46, 9, 46, 16, -58, 16, -71, 10], BC.oliveD);
  hl(d, -56, 44, 15, BC.oliveDD);
  d.poly([-90, 2, -58, 16, -62, 16, -91, 4], BC.oliveDD);
  // Rear end (dark, in shadow) + loading ramp hinge.
  d.poly([-90, -14, -92, -4, -90, 2, -86, 1, -86, -12], BC.oliveD);
  d.line(-88, 0, -60, 13, BC.oliveDD);

  // ---- hornet "abdomen" stripes on the tail section
  const stripes: [number, number][] = [
    [-82, -76],
    [-70, -64],
    [-58, -53],
  ];
  for (const [a, b] of stripes) {
    const sl = 5;
    d.poly([a + sl, -21, b + sl, -21, b, bellyAt(b) - 1, a, bellyAt(a) - 1], BC.hazard);
    d.line(a + sl, -21, b + sl - 1, -21, BC.hazardL);
    d.line(a + sl, -20, a + 1, bellyAt(a) - 2, BC.hazardL);
    d.poly([a + 1, bellyAt(a) - 6, b, bellyAt(b) - 6, b, bellyAt(b) - 1, a, bellyAt(a) - 1], BC.hazardD);
  }
  for (const [a, b] of [
    [-76, -70],
    [-64, -58],
  ] as [number, number][]) {
    const sl = 5;
    d.poly([a + sl, -21, b + sl, -21, b, bellyAt(b) - 1, a, bellyAt(a) - 1], BC.ironDD);
    d.line(a + sl, -21, b + sl - 1, -21, BC.steelD);
  }

  // ---- volume: soft mid-shade band (dither) between the lit top and the dark belly
  dith(d, -50, 4, 96, 1, BC.oliveD, 0);
  dith(d, -50, 6, 96, 1, BC.oliveD, 1);
  d.poly([-50, 7, 46, 7, 46, 9, -54, 9], BC.oliveD);

  // ---- panel seams, rivets, windows, door, emblem
  for (const x of [-46, -26, 28]) {
    vl(d, x, -19, 14, BC.oliveD);
    vl(d, x + 1, -19, 14, BC.oliveL);
  }
  for (let x = -44; x <= 42; x += 6) rivet(d, x, -17, BC.oliveLL, BC.oliveDD);
  for (let x = -54; x <= 42; x += 6) rivet(d, x, 13, BC.oliveL, BC.oliveDD);
  // Cabin windows.
  for (const x of [-42, -34, 1, 8]) {
    d.rect(x, -12, 5, 4, BC.steelDD);
    d.rect(x + 1, -11, 3, 2, BC.glassD);
    d.px(x + 1, -11, BC.glassL);
  }
  // Crew door with porthole and handle.
  d.rect(-24, -13, 15, 20, BC.oliveD);
  d.rect(-23, -12, 13, 18, BC.olive);
  hl(d, -23, -11, -12, BC.oliveL);
  vl(d, -23, -12, 5, BC.oliveL);
  d.circle(-16.5, -5, 3, BC.steelD);
  d.circle(-16.5, -5, 2.2, BC.glassD);
  d.px(-18, -6, BC.glassL);
  d.rect(-13, 0, 2, 3, BC.steelL);
  // Rub strake (steel rail) along the lower fuselage.
  d.rect(-56, 8, 100, 2, BC.steelD);
  hl(d, -56, 43, 8, BC.steelL);
  for (let x = -52; x <= 40; x += 8) d.px(x, 9, BC.steelLL);
  // Legion brass cog emblem.
  cog(d, 20, -8, 4);
  // Hornet collar band behind the head.
  d.poly([36, -21, 42, -21, 40, 8, 34, 8], BC.hazard);
  d.line(36, -21, 41, -21, BC.hazardL);
  d.line(36, -20, 34, 7, BC.hazardL);
  d.poly([42, -21, 45, -21, 43, 8, 40, 8], BC.ironDD);
  d.poly([30, -21, 33, -21, 31, 8, 28, 8], BC.ironDD);
  // Rust drips under rivets.
  for (const [x, l] of [
    [-38, 4],
    [-14, 3],
    [22, 5],
    [-50, 3],
  ] as [number, number][]) {
    vl(d, x, 12, 12 + l, BC.rustD);
    d.px(x, 12, BC.rust);
  }
  // Exhaust soot on the upper rear.
  speckle(d, -86, -20, 24, 6, BC.oliveDD, 0.35, 11);

  // ---- front rotor pylon (always attached)
  d.poly([20, -21, 25, -31, 44, -31, 48, -21], BC.olive);
  d.poly([20, -21, 25, -31, 27, -31, 23, -21], BC.oliveL);
  d.poly([42, -31, 44, -31, 48, -21, 46, -21], BC.oliveD);
  hl(d, 26, 43, -31, BC.oliveLL);
  d.rect(31, -38, 6, 7, BC.steel);
  vl(d, 31, -38, -32, BC.steelL);
  vl(d, 36, -38, -32, BC.steelD);
  d.rect(28, -34, 12, 2, BC.steelD);
  hl(d, 28, 39, -34, BC.steelL);
  for (let x = 26; x <= 42; x += 4) rivet(d, x, -28, BC.oliveLL, BC.oliveDD);
  // Intake grille on the front pylon.
  d.rect(38, -28, 6, 5, BC.steelDD);
  for (let x = 39; x < 44; x += 2) vl(d, x, -27, -25, BC.steel);

  // ---- engine nacelle on the aft pylon (near side)
  if (pylon) {
    d.cap(-86, -31, -54, -31, 6.5, BC.oliveD);
    d.cap(-86, -32, -54, -32, 5.5, BC.olive);
    d.cap(-84, -35, -56, -35, 1.6, BC.oliveL);
    hl(d, -82, -58, -37, BC.oliveLL);
    // Intake (front) and nozzle (rear).
    d.circle(-53, -31, 5, BC.steelD);
    d.circle(-53, -31, 3.6, BC.steelDD);
    for (let k = 0; k < 3; k++) vl(d, -55 + k * 2, -34, -28, BC.steel);
    d.rect(-92, -36, 5, 10, BC.steelD);
    vl(d, -92, -35, -27, BC.steelL);
    d.rect(-91, -34, 2, 6, BC.ironDD);
    // Bands.
    vl(d, -76, -37, -25, BC.oliveDD);
    vl(d, -64, -37, -25, BC.oliveDD);
    d.rect(-74, -34, 8, 3, BC.hazard);
    hl(d, -74, -67, -34, BC.hazardL);
  } else {
    // Torn stump: jagged plates, dark cavity, broken pipes.
    d.poly([-84, -21, -80, -27, -76, -24, -72, -30, -67, -25, -62, -31, -57, -26, -52, -29, -46, -21], BC.steelD);
    d.poly([-82, -21, -78, -25, -74, -23, -70, -27, -66, -23, -61, -27, -56, -24, -52, -26, -48, -21], BC.ironDD);
    d.line(-80, -27, -76, -24, BC.steelLL);
    d.line(-72, -30, -67, -25, BC.steelLL);
    d.line(-62, -31, -57, -26, BC.steelL);
    d.cap(-70, -22, -74, -31, 1, BC.steel);
    d.cap(-60, -22, -55, -32, 0.9, BC.rust);
    d.px(-74, -32, BC.hot);
    d.px(-55, -33, BC.hotL);
    speckle(d, -88, -24, 44, 8, BC.char, 0.45, 23);
  }

  // ---- stub wing (near) - the missile pod hangs below it (separate sprite)
  // Root fairing (in shadow), lit top surface, front face, dark underside, wingtip light.
  d.poly([-4, 0, 4, 3, 4, 9, -4, 7], BC.oliveD);
  d.poly([-4, 0, 18, -2, 26, 1, 4, 3], BC.oliveL);
  d.line(-3, 0, 18, -2, BC.oliveLL);
  d.poly([4, 3, 26, 1, 26, 6, 4, 8], BC.olive);
  d.line(5, 4, 25, 2, BC.oliveL);
  d.poly([4, 8, 26, 6, 26, 7, 4, 9], BC.oliveDD);
  d.rect(25, 1, 2, 5, BC.steelD);
  d.px(26, 2, BC.red);
  d.rect(9, 8, 6, 2, BC.steelD);

  // ---- landing gear sponsons + wheels
  for (const [sx, wx] of [
    [-58, -48],
    [30, 39],
  ] as [number, number][]) {
    d.poly([sx, 8, sx + 16, 8, sx + 18, 12, sx + 16, 16, sx, 16, sx - 2, 12], BC.oliveD);
    hl(d, sx, sx + 15, 8, BC.olive);
    d.rect(wx - 1, 15, 3, 3, BC.steelD);
    d.circle(wx, 20, 4.5, BC.tread);
    d.circle(wx - 0.5, 19.5, 2.2, BC.steel);
    d.px(wx - 1, 19, BC.steelLL);
    d.px(wx - 3, 18, BC.treadLL);
  }

  // ---- belly: bomb-bay seam (doors are a separate sprite) + chin turret ring
  hl(d, -39, -3, 16, BC.oliveDD);

  // ---- the head: armoured hornet head with a compound eye
  d.poly([40, -21, 58, -22, 70, -19, 79, -11, 84, -2, 84, 6, 80, 12, 72, 16, 40, 16], BC.olive);
  d.poly([40, -21, 58, -22, 70, -19, 74, -16, 58, -19, 40, -18], BC.oliveL);
  hl(d, 44, 64, -22, BC.oliveLL);
  d.poly([60, 9, 84, 4, 84, 6, 80, 12, 72, 16, 56, 16], BC.oliveD);
  // Head seam.
  d.line(46, -20, 48, 15, BC.oliveD);
  d.line(47, -20, 49, 15, BC.oliveL);
  // Compound eye: dark rim, amber dome with facets, glint.
  d.ellipse(66, -6, 13.5, 11, BC.steelDD);
  d.ellipse(66, -6, 12, 9.5, BC.amberD);
  d.ellipse(66.5, -6.5, 11, 8.5, BC.amber);
  for (let y = -14; y <= 2; y += 2) {
    for (let x = 55 + ((y / 2) & 1); x <= 78; x += 2) {
      const nx = (x - 66.5) / 10.5;
      const ny = (y - -6.5) / 8;
      if (nx * nx + ny * ny > 1) continue;
      const lit = nx + ny < -0.2;
      d.px(x, y, lit ? BC.amberL : nx + ny > 0.6 ? BC.amberD : '#c8701e');
    }
  }
  d.ellipse(60, -11, 3, 1.8, BC.amberL);
  d.rect(58, -12, 3, 1, BC.white);
  d.px(64, -13, BC.white);
  // Brow armour over the eye.
  d.poly([52, -18, 64, -20, 74, -16, 66, -15, 54, -15], BC.oliveD);
  d.line(53, -18, 64, -20, BC.oliveL);
  // Mandible jaw plates + gunner sight slit.
  d.poly([56, 6, 82, 2, 84, 7, 78, 13, 70, 16, 56, 16], BC.steel);
  d.line(57, 6, 81, 2, BC.steelL);
  d.poly([70, 16, 78, 13, 84, 7, 84, 9, 79, 15, 72, 17], BC.steelD);
  d.rect(66, 8, 12, 2, BC.steelDD);
  hl(d, 67, 76, 8, BC.amberL);
  // Wasp stripes on the jaw.
  d.poly([57, 8, 60, 7, 58, 15, 56, 15], BC.hazard);
  d.poly([61, 7, 64, 7, 62, 15, 59, 15], BC.ironDD);
  d.poly([64, 7, 66, 6, 65, 15, 62, 15], BC.hazard);
  rivet(d, 60, 11, BC.steelLL, BC.steelDD);
  rivet(d, 74, 12, BC.steelLL, BC.steelDD);
  // Turret ring under the chin.
  d.rect(58, 15, 12, 3, BC.steelD);
  hl(d, 58, 69, 15, BC.steel);
  // Antennae (hornet feelers).
  d.line(56, -21, 60, -28, BC.steelL);
  d.line(60, -28, 69, -31, BC.steelL);
  d.px(70, -31, BC.red);
  d.line(50, -21, 52, -29, BC.steel);
  d.line(52, -29, 58, -33, BC.steel);
  d.px(59, -33, BC.redD);

  // ---- tail stinger
  d.poly([-90, -12, -105, -5, -90, -1], BC.steel);
  d.line(-90, -12, -104, -5, BC.steelL);
  d.poly([-104, -5, -90, -1, -90, -3], BC.steelD);
  d.rect(-92, -11, 3, 10, BC.steelD);

  // ---- damage layers
  if (dmg >= 1) {
    hole(d, -24, -15, 11, 8, 5);
    hole(d, 30, -3, 9, 7, 9);
    for (const [x, y] of [
      [-6, -8],
      [-34, 4],
      [18, -15],
      [52, 2],
      [-42, -6],
      [40, 10],
    ] as [number, number][])
      bulletHole(d, x, y);
    speckle(d, -30, -18, 18, 14, BC.char, 0.18, 31);
    speckle(d, 26, -6, 16, 14, BC.char, 0.16, 37);
    // Cracked eye.
    d.line(62, -14, 66, -9, BC.glassL);
    d.line(66, -9, 64, -4, BC.glassL);
    d.line(66, -9, 71, -7, BC.white);
  }
  if (dmg >= 2) {
    hole(d, -2, 9, 10, 6, 13);
    // Belly breach: torn plating around a glowing fuel cell (weak point).
    d.poly([-74, 6, -66, 3, -56, 7, -54, 14, -60, 16, -72, 14], BC.ironDD);
    d.circle(-64, 11, 3.6, BC.hot);
    d.circle(-64.5, 10.5, 2, BC.hotL);
    d.px(-65, 10, BC.white);
    d.line(-74, 6, -66, 3, BC.steelL);
    d.line(-66, 3, -56, 7, BC.oliveLL);
    d.px(-70, 13, BC.hot);
    d.px(-58, 9, BC.amberL);
    for (const [x, y] of [
      [-48, -12],
      [-8, 4],
      [24, -18],
      [58, -1],
    ] as [number, number][])
      bulletHole(d, x, y);
    speckle(d, -60, -6, 30, 18, BC.char, 0.22, 41);
    d.line(60, -12, 58, -6, BC.white);
    d.line(70, -10, 75, -3, BC.glassL);
  }
  if (dmg >= 3) {
    hole(d, -44, -14, 12, 9, 17);
    hole(d, 52, -20, 8, 5, 19);
    speckle(d, -92, -20, 50, 34, BC.charD, 0.25, 51);
    speckle(d, -20, -20, 70, 30, BC.char, 0.14, 53);
    speckle(d, 50, -18, 30, 26, BC.char, 0.12, 57);
    // Door hanging loose: dark gap at its edge.
    vl(d, 2, -12, 9, BC.ironDD);
    vl(d, 3, -12, 9, BC.ironD);
  }
  if (wreck) speckle(d, -100, -40, 200, 70, BC.charD, 0.1, 61);
}

sprites.define({
  name: 'bm2_hull',
  w: HULL_W,
  h: HULL_H,
  ox: HULL_PX,
  oy: HULL_PY,
  frames: NT * 4,
  draw: (p, f) => drawHull(p, TILTS[f % NT], Math.floor(f / NT)),
});

/** Crashed, burnt-out hull lying on the ground (origin = pivot, nose-down tilt). */
sprites.define({
  name: 'bm2_wreck',
  w: HULL_W,
  h: HULL_H,
  ox: HULL_PX,
  oy: HULL_PY,
  frames: 1,
  draw: (p) => {
    drawHull(p, 0.06, 3, true);
    charr(p, 13);
  },
});

// ------------------------------------------------------------------ head-on view (mid yaw turn)

/** Front hub / rear hub positions in the head-on view (relative to the pivot). */
export const FRONT_HUB_F = [0, -38] as const;
export const FRONT_HUB_R = [0, -50] as const;

function drawEye(d: Pen, cx: number, cy: number, cracked: boolean): void {
  d.ellipse(cx, cy, 8.5, 9.5, BC.steelDD);
  d.ellipse(cx, cy, 7.2, 8.2, BC.amberD);
  d.ellipse(cx + 0.4, cy - 0.4, 6.4, 7.4, BC.amber);
  for (let y = cy - 7; y <= cy + 7; y += 2)
    for (let x = cx - 6 + ((Math.round(y - cy) / 2) & 1); x <= cx + 6; x += 2) {
      const nx = (x - cx) / 6.2;
      const ny = (y - cy) / 7.2;
      if (nx * nx + ny * ny > 1) continue;
      d.px(x, y, nx + ny < -0.3 ? BC.amberL : nx + ny > 0.6 ? BC.amberD : '#c8701e');
    }
  d.ellipse(cx - 2.5, cy - 4, 2, 1.5, BC.amberL);
  d.px(cx - 3, cy - 5, BC.white);
  d.px(cx - 2, cy - 5, BC.white);
  if (cracked) {
    d.line(cx - 3, cy - 6, cx, cy - 1, BC.glassL);
    d.line(cx, cy - 1, cx + 4, cy + 1, BC.white);
  }
}

function drawFront(p: PixelArt, dmg: number): void {
  const d = new Pen(p, 44, 54);
  const pylon = dmg < 2;
  // Rear pylon + twin engine intakes (behind the head).
  if (pylon) {
    d.poly([-9, -22, -6, -42, 6, -42, 9, -22], BC.oliveD);
    d.rect(-2, -48, 4, 7, BC.steel);
    d.rect(-2, -48, 1, 7, BC.steelL);
    d.rect(-6, -44, 12, 2, BC.steelD);
    for (const s of [-1, 1]) {
      d.circle(s * 15, -31, 7, BC.oliveD);
      d.circle(s * 15 - 0.5, -31.5, 6, BC.olive);
      d.circle(s * 15, -31, 4.3, BC.steelD);
      d.circle(s * 15, -31, 3, BC.steelDD);
      d.line(s * 15 - 3, -31, s * 15 + 3, -31, BC.steel);
      d.line(s * 15, -34, s * 15, -28, BC.steel);
    }
    d.px(-18, -35, BC.oliveLL);
  } else {
    d.poly([-10, -22, -7, -28, -3, -25, 2, -30, 6, -26, 10, -22], BC.steelD);
    d.poly([-8, -22, -5, -25, -1, -23, 3, -27, 7, -23, 8, -22], BC.ironDD);
    d.px(2, -31, BC.hot);
  }
  // Fuselage cross-section.
  d.poly([-22, -16, -16, -22, 16, -22, 22, -16, 22, 12, 16, 18, -16, 18, -22, 12], BC.olive);
  d.poly([-22, -16, -16, -22, 16, -22, 14, -20, -15, -20, -20, -15, -20, 12, -22, 12], BC.oliveL);
  d.poly([20, -15, 22, -16, 22, 12, 16, 18, 14, 16, 20, 11], BC.oliveD);
  d.line(-15, -22, 15, -22, BC.oliveLL);
  // Hornet collar stripes around the head.
  d.rect(-22, -6, 3, 6, BC.hazard);
  d.rect(19, -6, 3, 6, BC.hazardD);
  // Stub wings + pods (both sides).
  for (const s of [-1, 1]) {
    d.poly([s * 22, 1, s * 40, 2, s * 40, 6, s * 22, 7], s < 0 ? BC.olive : BC.oliveD);
    d.line(s * 22, 1, s * 40, 2, BC.oliveL);
    d.rect(s * 31 - 1, 6, 2, 3, BC.steelD);
    d.circle(s * 31, 13, 5.5, BC.oliveD);
    d.circle(s * 31 - 0.5, 12.5, 4.6, BC.olive);
    d.circle(s * 31, 13, 3.4, BC.steelDD);
    d.circle(s * 31 - 1.2, 12, 1.1, BC.red);
    d.circle(s * 31 + 1.4, 14, 1.1, BC.red);
    d.px(s * 31 + 2, 9, BC.hazard);
    d.px(s * 31 - 3, 9, BC.hazard);
  }
  // Landing gear (front sponsons).
  for (const s of [-1, 1]) {
    d.rect(s * 18 - 3, 14, 6, 4, BC.oliveD);
    d.rect(s * 18 - 2, 17, 4, 8, BC.tread);
    d.rect(s * 18 - 2, 18, 1, 6, BC.treadLL);
  }
  // Front pylon + mast.
  d.poly([-9, -21, -7, -30, 7, -30, 9, -21], BC.olive);
  d.poly([-9, -21, -7, -30, -5, -30, -7, -21], BC.oliveL);
  d.rect(-2, -38, 4, 8, BC.steel);
  d.rect(-2, -38, 1, 8, BC.steelL);
  d.rect(-6, -34, 12, 2, BC.steelD);
  d.px(0, -31, BC.red);
  // The head: brow, twin compound eyes, mandibles, chin gun.
  d.poly([-19, -14, -12, -20, 12, -20, 19, -14, 19, 8, 12, 15, -12, 15, -19, 8], BC.olive);
  d.poly([-19, -14, -12, -20, 12, -20, 10, -18, -11, -18, -17, -13], BC.oliveL);
  drawEye(d, -9, -5, dmg >= 1);
  drawEye(d, 9, -5, dmg >= 2);
  d.poly([-18, -14, -10, -17, -2, -13, -10, -13], BC.oliveD);
  d.poly([18, -14, 10, -17, 2, -13, 10, -13], BC.oliveD);
  d.rect(-1, -14, 2, 14, BC.oliveD);
  // Mandible jaw with stripes and the sight slit.
  d.poly([-15, 5, 15, 5, 12, 15, -12, 15], BC.steel);
  d.line(-14, 5, 14, 5, BC.steelL);
  d.rect(-8, 7, 16, 2, BC.steelDD);
  d.line(-7, 7, 6, 7, BC.amberL);
  for (const x of [-13, -9, 6, 10]) d.poly([x, 10, x + 2, 10, x + 1, 15, x - 1, 15], BC.hazard);
  // Chin "stinger": rotary barrels facing the viewer.
  d.circle(0, 18, 5.5, BC.steelD);
  d.circle(-0.6, 17.4, 4.5, BC.steel);
  d.circle(0, 18, 3, BC.steelDD);
  d.px(-1, 17, BC.ironDD);
  d.px(1, 17, BC.ironDD);
  d.px(0, 19, BC.ironDD);
  d.px(-2, 15, BC.steelLL);
  // Antennae (feelers).
  d.line(-6, -20, -10, -27, BC.steelL);
  d.line(-10, -27, -16, -29, BC.steelL);
  d.px(-17, -29, BC.red);
  d.line(6, -20, 10, -27, BC.steel);
  d.line(10, -27, 16, -29, BC.steel);
  d.px(17, -29, BC.redD);
  if (dmg >= 2) {
    speckle(d, -22, -22, 44, 40, BC.char, 0.12, 71);
    d.rect(12, -18, 5, 4, BC.ironDD);
  }
  if (dmg >= 3) speckle(d, -22, -22, 44, 40, BC.charD, 0.12, 73);
}

/** Head-on view used at the middle of a yaw turn (frame = damage state 0..3). */
sprites.define({
  name: 'bm2_front',
  w: 88,
  h: 82,
  ox: 44,
  oy: 54,
  frames: 4,
  draw: (p, f) => drawFront(p, f),
});

// ------------------------------------------------------------------ rotors

const ROT_W = ROTOR_R * 2 + 8;
const ROT_H = 32;
const ROT_OX = ROT_W / 2;
const ROT_OY = ROT_H / 2;

function bladeTip(phi: number): [number, number] {
  return [Math.cos(phi) * ROTOR_R, Math.sin(phi) * ROTOR_R * ROTOR_K];
}

sprites.define({
  name: 'bm2_rotor',
  w: ROT_W,
  h: ROT_H,
  ox: ROT_OX,
  oy: ROT_OY,
  frames: NT * ROT_N,
  outline: null,
  draw: (p, f) => {
    const tilt = TILTS[Math.floor(f / ROT_N)];
    const k = f % ROT_N;
    const d = new Pen(p, ROT_OX, ROT_OY, tilt);
    for (let b = 0; b < 3; b++) {
      const phi = (k / ROT_N) * ((Math.PI * 2) / 3) + (b * Math.PI * 2) / 3;
      const [tx, ty] = bladeTip(phi);
      const back = Math.sin(phi) < 0;
      const len = Math.hypot(tx, ty);
      if (len < 4) continue;
      const ux = tx / len;
      const uy = ty / len;
      // Blade body (dark edge + lighter top), hazard-striped tip.
      d.cap(0, 0, tx, ty, 1.15, BC.steelDD);
      d.line(ux * 3, uy * 3 - 1, tx - ux * 2, ty - uy * 2 - 1, back ? BC.steelD : BC.steelL);
      const t0 = Math.max(4, len - 7);
      d.cap(ux * t0, uy * t0, tx, ty, 1.15, BC.hazard);
      d.cap(ux * (t0 + 2.5), uy * (t0 + 2.5), ux * (t0 + 4), uy * (t0 + 4), 1.15, BC.ironDD);
    }
  },
});

sprites.define({
  name: 'bm2_blur',
  w: ROT_W,
  h: ROT_H,
  ox: ROT_OX,
  oy: ROT_OY,
  frames: NT,
  outline: null,
  draw: (p, f) => {
    const d = new Pen(p, ROT_OX, ROT_OY, TILTS[f]);
    d.ellipse(0, 0, ROTOR_R, ROTOR_R * ROTOR_K + 0.6, '#c8ccd8');
    d.ellipse(0, 0, ROTOR_R - 5, ROTOR_R * ROTOR_K - 1.2, '#9ea4b4');
    // Tip ring (hazard tips blur into a yellow band at the rim).
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      d.px(Math.cos(a) * (ROTOR_R - 1), Math.sin(a) * (ROTOR_R * ROTOR_K), BC.hazardL);
    }
  },
});

sprites.define({
  name: 'bm2_hub',
  w: 12,
  h: 7,
  ox: 6,
  oy: 4,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p);
    d.rect(1, 2, 10, 4, BC.steelD);
    d.rect(2, 1, 8, 3, BC.steel);
    d.rect(3, 1, 4, 1, BC.steelLL);
    d.rect(5, 0, 2, 1, BC.steelL);
    d.px(f ? 3 : 8, 3, BC.brassL);
    d.px(f ? 8 : 3, 3, BC.brassD);
  },
});

// ------------------------------------------------------------------ chin gun ("stinger")

const GUN_W = 34;
const GUN_H = 34;
const GUN_OX = 11;
const GUN_OY = 10;

sprites.define({
  name: 'bm2_gun',
  w: GUN_W,
  h: GUN_H,
  ox: GUN_OX,
  oy: GUN_OY,
  frames: GUN_N * 2,
  draw: (p, f) => {
    const a = (Math.floor(f / 2) / (GUN_N - 1)) * GUN_MAX;
    const spin = f % 2;
    const d = new Pen(p, GUN_OX, GUN_OY, a);
    // Barrel cluster (3 barrels, the middle one alternates highlight to read as spinning).
    d.rect(4, -3, 7, 6, BC.steelD);
    d.rect(4, -3, 7, 1, BC.steelL);
    for (let i = -1; i <= 1; i++) {
      const lit = (i + 1 + spin) % 3 === 0;
      d.rect(10, i * 1.6 - 0.7, 11, 1.5, lit ? BC.steelL : BC.steel);
    }
    d.rect(20, -2.6, 3, 5.2, BC.steelDD);
    d.rect(14, -2.4, 2, 4.8, BC.hazard);
    d.px(20, -2, BC.steelL);
    // Ball mount with an amber sensor.
    const b = new Pen(p, GUN_OX, GUN_OY, 0);
    b.circle(0, 0, 5.5, BC.steelD);
    b.circle(-0.6, -0.8, 4.4, BC.steel);
    b.circle(-1.6, -2, 1.6, BC.steelL);
    b.px(-2, -3, BC.steelLL);
    const [sx, sy] = [Math.cos(a) * 2.6, Math.sin(a) * 2.6 + 2.2];
    b.circle(sx - 1, sy, 1.3, BC.amber);
    b.px(Math.round(sx - 1.5), Math.round(sy - 0.5), BC.amberL);
  },
});

// ------------------------------------------------------------------ missile pod & bomb bay

const POD_W = 34;
const POD_H = 22;
const POD_OX = 16;
const POD_OY = 6;

sprites.define({
  name: 'bm2_pod',
  w: POD_W,
  h: POD_H,
  ox: POD_OX,
  oy: POD_OY,
  frames: NT * POD_N,
  draw: (p, f) => {
    const tilt = TILTS[f % NT];
    const st = Math.floor(f / NT);
    const d = new Pen(p, POD_OX, POD_OY, tilt);
    // Hanger pylon.
    d.rect(-3, -1, 6, 3, BC.steelD);
    // Pod tube (origin = attach point; tube runs local x -12..14, y 2..10).
    d.cap(-11, 6, 12, 6, 4.6, BC.oliveD);
    d.cap(-11, 5.5, 12, 5.5, 3.8, BC.olive);
    d.line(-11, 2, 11, 2, BC.oliveL);
    d.line(-9, 3, 9, 3, BC.oliveLL);
    d.line(-11, 9, 12, 9, BC.oliveDD);
    // Bands + hornet stripes.
    d.rect(-6, 2, 1, 8, BC.oliveDD);
    d.rect(-4, 2, 3, 8, BC.hazard);
    d.rect(-4, 2, 3, 1, BC.hazardL);
    d.rect(-1, 2, 2, 8, BC.ironDD);
    // Rear fairing cone.
    d.poly([-11, 2, -16, 4, -16, 8, -11, 10], BC.oliveD);
    // Front: cover (closed) / cover lifting (opening) / tubes.
    if (st === 0) {
      d.rect(12, 2, 3, 8, BC.steel);
      d.rect(12, 2, 3, 1, BC.steelL);
      d.rect(14, 3, 1, 6, BC.steelD);
    } else {
      d.rect(12, 2, 4, 8, BC.steelDD);
      for (const ty of [4, 8]) {
        d.circle(14, ty, 1.6, BC.ironDD);
        if (st <= 2) {
          d.circle(14.6, ty, 1.3, BC.red);
          d.px(14, ty - 1, BC.redL);
        }
      }
      if (st === 1) {
        // Cover swung half up.
        d.poly([12, 2, 15, -3, 17, -2, 14, 2], BC.steel);
      } else {
        d.poly([12, 2, 13, -5, 15, -5, 14, 2], BC.steel);
        d.px(13, -4, BC.steelL);
      }
    }
  },
});

const BAY_W = 44;
const BAY_H = 22;
const BAY_OX = 22;
const BAY_OY = 3;

sprites.define({
  name: 'bm2_bay',
  w: BAY_W,
  h: BAY_H,
  ox: BAY_OX,
  oy: BAY_OY,
  frames: NT * BAY_N,
  draw: (p, f) => {
    const tilt = TILTS[f % NT];
    const st = Math.floor(f / NT);
    const d = new Pen(p, BAY_OX, BAY_OY, tilt);
    // Bay is 32 px long (local x -16..16), belly line at y 0.
    if (st === 0) {
      d.rect(-16, -1, 32, 3, BC.oliveD);
      d.line(-16, -1, 15, -1, BC.olive);
      d.line(0, -1, 0, 1, BC.oliveDD);
      for (const x of [-12, -6, 6, 12]) d.px(x, 0, BC.oliveL);
      // Hazard edge so the bay reads as a hatch.
      for (let x = -15; x <= 15; x += 4) d.rect(x, 1, 2, 1, BC.hazardD);
      return;
    }
    // Dark interior with racked bombs + red bay light.
    d.rect(-15, -2, 30, 5, BC.ironDD);
    for (const x of [-10, -3, 4, 11]) {
      d.rect(x - 1.5, -1, 3, 4, BC.olive);
      d.px(x - 1, -1, BC.oliveL);
      d.rect(x - 1.5, 2, 3, 1, BC.hazard);
    }
    d.px(-14, -1, BC.redL);
    d.px(14, -1, BC.redL);
    if (st === 1) {
      // Doors ajar (45 deg).
      d.poly([-16, 0, -1, 0, -5, 9, -18, 8], BC.oliveD);
      d.line(-16, 0, -18, 8, BC.olive);
      d.poly([1, 0, 16, 0, 18, 8, 5, 9], BC.oliveD);
      d.line(16, 0, 18, 8, BC.oliveL);
    } else {
      // Doors hanging straight down.
      d.rect(-17, 0, 3, 15, BC.oliveD);
      d.line(-17, 0, -17, 14, BC.olive);
      d.rect(14, 0, 3, 15, BC.oliveD);
      d.line(16, 0, 16, 14, BC.oliveL);
      for (let y = 3; y < 15; y += 4) {
        d.px(-16, y, BC.hazard);
        d.px(15, y, BC.hazard);
      }
    }
  },
});

// ------------------------------------------------------------------ projectiles

/** Guided missile (faces right, rotated to velocity by the projectile). */
sprites.define({
  name: 'bm2_missile',
  w: 16,
  h: 7,
  ox: 8,
  oy: 3,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p);
    d.rect(3, 2, 10, 3, BC.olive);
    d.rect(3, 2, 10, 1, BC.oliveLL);
    d.rect(3, 4, 10, 1, BC.oliveD);
    d.poly([13, 2, 16, 3.5, 13, 5], BC.red);
    d.px(13, 2, BC.redL);
    d.rect(7, 2, 2, 3, BC.hazard);
    d.poly([2, 0, 6, 2, 3, 2], BC.steel);
    d.poly([2, 7, 6, 5, 3, 5], BC.steelD);
    d.rect(0, 2.5, 3, 2, f ? BC.hotL : BC.hot);
  },
});

/** High-drag carpet bomb: nose down, retarder fins, yellow band (2 wobble frames). */
sprites.define({
  name: 'bm2_bomb',
  w: 10,
  h: 15,
  ox: 5,
  oy: 9,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p);
    const w = f ? 1 : 0;
    // Retarder fins (top).
    d.poly([1 - w, 0, 4, 4, 2, 5], BC.steel);
    d.poly([9 + w, 0, 6, 4, 8, 5], BC.steelD);
    d.rect(4, 1, 2, 4, BC.steelD);
    // Body.
    d.ellipse(5, 9, 3.6, 5.2, BC.oliveD);
    d.ellipse(4.6, 8.6, 2.8, 4.6, BC.olive);
    d.rect(3, 6, 1, 4, BC.oliveLL);
    d.rect(1.5, 7, 7, 2, BC.hazard);
    d.rect(1.5, 7, 3, 1, BC.hazardL);
    d.circle(5, 13, 1.4, BC.steelD);
  },
});

// ------------------------------------------------------------------ torn pylon, plates, glow

/** The aft rotor pylon with its engine nacelle, torn off in phase 2 (origin = centre). */
sprites.define({
  name: 'bm2_pylon',
  w: 48,
  h: 37,
  ox: 24,
  oy: 18,
  frames: 2,
  draw: (p, f) => {
    // Re-use the hull's pylon drawing offsets: pylon spans local x -92..-46, y -50..-20.
    const d = new Pen(p, 94, 50);
    d.poly([-84, -20, -78, -40, -54, -40, -46, -20], BC.olive);
    d.poly([-84, -20, -78, -40, -76, -40, -81, -20], BC.oliveL);
    hl(d, -77, -55, -40, BC.oliveLL);
    d.rect(-69, -48, 6, 8, BC.steel);
    vl(d, -69, -48, -41, BC.steelL);
    d.rect(-72, -44, 12, 2, BC.steelD);
    d.poly([-76, -26, -72, -36, -66, -36, -70, -26], BC.hazard);
    d.poly([-66, -26, -62, -36, -58, -36, -62, -26], BC.hazard);
    d.cap(-86, -31, -54, -31, 6.5, BC.oliveD);
    d.cap(-86, -32, -54, -32, 5.5, BC.olive);
    hl(d, -82, -58, -37, BC.oliveLL);
    d.circle(-53, -31, 4.5, BC.steelDD);
    d.rect(-91, -36, 4, 10, BC.steelD);
    d.rect(-74, -34, 8, 3, BC.hazard);
    // Torn bottom edge.
    d.poly([-84, -20, -80, -24, -76, -21, -71, -25, -66, -20, -60, -24, -54, -20, -50, -23, -46, -20, -46, -18, -84, -18], BC.ironDD);
    d.line(-80, -24, -76, -21, BC.steelLL);
    d.line(-71, -25, -66, -20, BC.steelL);
    d.cap(-66, -20, -68, -15, 0.9, BC.rust);
    if (f === 1) charr(p, 29);
  },
});

/** Armour plates that break off the hull (olive, striped, steel). */
sprites.define({
  name: 'bm2_plate',
  w: 14,
  h: 10,
  ox: 7,
  oy: 5,
  frames: 3,
  draw: (p, f) => {
    const d = new Pen(p);
    if (f === 0) {
      d.poly([0, 2, 11, 0, 14, 4, 12, 9, 1, 8], BC.olive);
      d.line(1, 2, 11, 0, BC.oliveLL);
      rivet(d, 4, 4, BC.oliveLL, BC.oliveDD);
      rivet(d, 9, 3, BC.oliveLL, BC.oliveDD);
      d.line(1, 8, 12, 9, BC.oliveD);
    } else if (f === 1) {
      d.poly([1, 1, 12, 2, 13, 8, 2, 9], BC.hazard);
      d.poly([5, 1.4, 8, 1.7, 9, 8.6, 6, 8.8], BC.ironDD);
      d.line(1, 1, 12, 2, BC.hazardL);
    } else {
      d.poly([0, 3, 6, 0, 13, 2, 12, 8, 4, 9], BC.steel);
      d.line(1, 3, 6, 0, BC.steelLL);
      d.line(6, 0, 13, 2, BC.steelL);
      d.px(7, 5, BC.steelDD);
    }
  },
});

/** Exhaust / breach glow (3 flicker frames). */
sprites.define({
  name: 'bm2_glow',
  w: 9,
  h: 9,
  frames: 3,
  ox: 4,
  oy: 4,
  outline: null,
  draw: (p, f) => {
    const r = [3.2, 4, 3.6][f];
    p.circle(4.5, 4.5, r, BC.hot);
    p.circle(4.5, 4.5, r - 1.3, BC.hotL);
    p.circle(4.5, 4.5, Math.max(0.8, r - 2.6), BC.white);
  },
});
