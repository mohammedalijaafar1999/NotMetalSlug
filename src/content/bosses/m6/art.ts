// JUGGERNAUT (boss_m6) art: Marshal Gristle's crimson-and-brass war walker. Every sprite is authored
// facing RIGHT and lit from the top-left; the boss flips them at draw time.
//
// The walker is composed at runtime from separately baked parts:
//   bm6_hull       boiler hull, 4 damage states x 5 tilts (frame = state * 5 + tilt index)
//   bm6_thigh_n/f  thigh segment baked at many angles (near / far leg palettes), origin = hip
//   bm6_shin_n/f   shin segment baked at many angles, origin = knee
//   bm6_foot_n/f   clawed foot at 7 tilts, origin = ankle
//   bm6_hip/knee   joint caps, bm6_cannon (twin artillery barrels by elevation), bm6_pod (missile box),
//   bm6_hatch (drone bay), bm6_dome (cockpit with Gristle, 7 expressions), bm6_crack (glass cracks),
//   bm6_armor (chest plate), bm6_core (reactor), projectiles, eject pod, parachute, debris, wreck.
//
// Local coordinates: origin = the hip pivot under the hull centre, +x forward, +y down.

import { sprites } from '../../../engine/sprites';
import { mixColor, parseColor, shade, type PixelArt } from '../../../engine/pixelart';
import { drawHuman, type HumanPose, type HumanoidStyle } from '../../../art/humanoid';
import { BC, Pen, cog, charr, hash2, hazardStripes, rivet } from '../common/kit';

// ------------------------------------------------------------------ palette & geometry

/** Marshal red (the walker's paint) plus the shared boss palette. */
export const JC = {
  ...BC,
  mr: '#7c2420',
  mrL: '#a3362a',
  mrLL: '#cc5a3e',
  mrD: '#561a1a',
  mrDD: '#3a1215',
} as const;

/** Thigh / shin lengths and the ankle height above the sole. */
export const LT = 36;
export const LS = 38;
export const ANKLE = 14;
/** Hip height above the ground: standing and squatting (laser pose). */
export const HIP_STAND = 80;
export const HIP_SQUAT = 24;

/** Reactor core (centre, local to the hip pivot) - at ground-25 when squatting. */
export const CORE = { x: 45, y: -1, r: 9 };
/** Cockpit dome base centre. */
export const DOME = { x: 21, y: -58 };
/** Artillery pivot and barrel length. */
export const CANNON = { x: -9, y: -63, len: 31 };
/** Missile box (top rear deck) and its launch tubes (local x of each tube mouth, y). */
export const POD = { x: -35, y: -58, tubes: [-41, -35, -29], tubeY: -70 };
/** Drone bay hatch on the rear face. */
export const HATCH = { x: -53, y: -30 };
/** Smokestack tops. */
export const STACKS = [
  { x: -52, y: -82 },
  { x: -45, y: -77 },
];
/** Running lights (local), drawn blinking by the boss. */
export const LIGHTS = [
  { x: -44, y: -55, c: '#ff3a2a' },
  { x: 34, y: -56, c: '#ffb030' },
  { x: -22, y: 7, c: '#ff3a2a' },
  { x: 14, y: 7, c: '#ff3a2a' },
];
/** Hull silhouette (local). */
export const HULL_PTS = [-46, 4, -53, -6, -55, -24, -53, -44, -47, -53, -38, -57, 30, -58, 42, -53, 51, -42, 55, -26, 55, -10, 50, 1, 40, 7, -34, 8];
/** Hull tilt angles baked (radians, + = nose down). */
export const TILTS = [-0.16, -0.08, 0, 0.08, 0.16];

/** Thigh / shin angle range and step (radians) for the baked segment frames. */
export const SEG_STEP = (6 * Math.PI) / 180;
export const THIGH_A0 = (-10 * Math.PI) / 180;
export const THIGH_N = 38; // -10 .. 212 deg
export const SHIN_A0 = (-60 * Math.PI) / 180;
export const SHIN_N = 38; // -60 .. 162 deg
export const FOOT_TILTS = [-0.5, -0.33, -0.17, 0, 0.17, 0.33, 0.5];
/** Cannon elevation frames: 25..70 deg. */
export const CANNON_A0 = (25 * Math.PI) / 180;
export const CANNON_STEP = (5 * Math.PI) / 180;
export const CANNON_N = 10;

/** Frame for an angle in a baked range (clamped; angles wrap to the nearest end of the range). */
export function angleFrame(a: number, a0: number, step: number, n: number): number {
  const TAU = Math.PI * 2;
  let x = (((a - a0) % TAU) + TAU) % TAU;
  const span = (n - 1) * step;
  if (x > span + (TAU - span) / 2) x -= TAU;
  return Math.max(0, Math.min(n - 1, Math.round(x / step)));
}

/** Nearest baked foot tilt frame. */
export function footFrame(tilt: number): number {
  let best = 0;
  for (let i = 1; i < FOOT_TILTS.length; i++) if (Math.abs(FOOT_TILTS[i] - tilt) < Math.abs(FOOT_TILTS[best] - tilt)) best = i;
  return best;
}

/** Nearest baked hull tilt index. */
export function tiltIndex(t: number): number {
  let best = 0;
  for (let i = 1; i < TILTS.length; i++) if (Math.abs(TILTS[i] - t) < Math.abs(TILTS[best] - t)) best = i;
  return best;
}

// ------------------------------------------------------------------ drawing helpers

/** Pen that can also fill arbitrary local-space shapes (bands clipped to polygons, rotated). */
export class JPen extends Pen {
  private c2: number;
  private s2: number;

  constructor(p: PixelArt, ox = 0, oy = 0, angle = 0) {
    super(p, ox, oy, angle);
    this.c2 = Math.cos(angle);
    this.s2 = Math.sin(angle);
  }

  /** Fill every pixel whose centre (in local coords) satisfies `inside`, within a local bbox. */
  shape(x0: number, y0: number, x1: number, y1: number, c: string, inside: (lx: number, ly: number) => boolean): this {
    const pts = [this.t(x0, y0), this.t(x1, y0), this.t(x1, y1), this.t(x0, y1)];
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const cs = this.c2;
    const sn = this.s2;
    this.p.fillShape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), c, (X, Y) => {
      const dx = X - this.ox;
      const dy = Y - this.oy;
      return inside(dx * cs + dy * sn, -dx * sn + dy * cs);
    });
    return this;
  }
}

export function inPoly(pts: number[], x: number, y: number): boolean {
  let inside = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2];
    const yi = pts[i * 2 + 1];
    const xj = pts[j * 2];
    const yj = pts[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function bbox(pts: number[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]);
    x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]);
    y1 = Math.max(y1, pts[i + 1]);
  }
  return [x0, y0, x1, y1];
}

/** Fill polygon ∩ predicate. */
export function polyWhere(d: JPen, pts: number[], c: string, where: (x: number, y: number) => boolean): void {
  const [x0, y0, x1, y1] = bbox(pts);
  d.shape(x0, y0, x1, y1, c, (x, y) => inPoly(pts, x, y) && where(x, y));
}

/** Steel bolt head. */
export function bolt(d: Pen, x: number, y: number, light: string = BC.steelLL, dark: string = BC.steelDD): void {
  d.px(x, y, light);
  d.px(x + 1, y, BC.steel);
  d.px(x, y + 1, BC.steel);
  d.px(x + 1, y + 1, dark);
}

// ------------------------------------------------------------------ hull

const HULL_W = 136;
const HULL_H = 112;
const HULL_OX = 68;
const HULL_OY = 92;

/** Boiler cylinder axis / radius, rear cap and armoured prow. */
const YC = -25;
const RC = 33;
const CAP_X = -44;
const CAP_RX = 11;
export const PROW = [36, -58, 44, -55, 51, -46, 56, -30, 56, -12, 52, 0, 45, 7, 36, 8];
const CYL = [JC.mrLL, JC.mrL, JC.mr, JC.mrD, JC.mrDD];

function inCap(x: number, y: number): boolean {
  return x < CAP_X && ((x - CAP_X) / CAP_RX) ** 2 + ((y - YC) / RC) ** 2 <= 1;
}
function inCyl(x: number, y: number): boolean {
  return x >= CAP_X && x <= 36.5 && y >= YC - RC && y <= YC + RC;
}
/** Is a local point inside the hull body? */
export function inHull(x: number, y: number): boolean {
  return inCyl(x, y) || inCap(x, y) || inPoly(PROW, x, y);
}
/** Cylinder shading band 0 (highlight) .. 4 (darkest) for a local point. */
function band(x: number, y: number): number {
  if (x < CAP_X) {
    const nx = (x - CAP_X) / CAP_RX;
    const ny = (y - YC) / RC;
    const b = -0.55 * nx - 0.85 * ny;
    return b > 0.78 ? 0 : b > 0.32 ? 1 : b > -0.3 ? 2 : b > -0.66 ? 3 : 4;
  }
  const n = (y - YC) / RC;
  const k = n < -0.84 ? 0 : n < -0.5 ? 1 : n < 0.28 ? 2 : n < 0.68 ? 3 : 4;
  if (x > 36.5) return Math.min(4, k + (y < -50 ? 0 : 1));
  return k;
}

/** Hull damage states: 0 intact, 1 dented, 2 chest armour gone (core socket), 3 wrecked. */
export function drawHull(p: PixelArt, state: number, tilt: number, ox = HULL_OX, oy = HULL_OY): void {
  const d = new JPen(p, ox, oy, tilt);
  const all = (c: string, where: (x: number, y: number) => boolean) => d.shape(-56, -59, 57, 9, c, (x, y) => inHull(x, y) && where(x, y));

  // --- smokestacks (behind the hull)
  const stack = (x: number, top: number, w: number, broken: boolean) => {
    const t = broken ? top + 10 : top;
    d.rect(x, t + 2, w, -t - 46, BC.ironL);
    d.rect(x, t + 2, 2, -t - 46, BC.ironLL);
    d.rect(x + w - 2, t + 2, 2, -t - 46, BC.ironD);
    if (broken) {
      d.poly([x - 1, t + 4, x + 2, t - 1, x + 4, t + 3, x + 6, t - 2, x + w + 1, t + 4], BC.ironD);
      d.px(x + 3, t + 2, BC.hot);
      d.px(x + 2, t + 3, BC.amber);
    } else {
      d.poly([x - 2, t, x + w + 2, t, x + w + 1, t + 4, x - 1, t + 4], BC.brass);
      d.rect(x - 2, t, w + 4, 1, BC.brassL);
      d.rect(x - 1, t + 3, w + 2, 1, BC.brassD);
      d.rect(x, t - 1, w, 1, BC.soot);
    }
    d.rect(x - 1, t + 13, w + 2, 2, BC.brass);
    d.rect(x - 1, t + 14, w + 2, 1, BC.brassD);
  };
  stack(-56, -83, 7, false);
  stack(-48, -78, 7, state >= 3);

  // --- body with cylinder shading
  for (let b = 0; b < 5; b++) all(CYL[b], (x, y) => band(x, y) === b);
  // armoured skirt along the bottom
  all(BC.ironD, (x, y) => y > 1.5 && x > -46);
  all(BC.ironL, (x, y) => y > 1.5 && y < 2.5 && x > -46);
  for (let x = -40; x <= 44; x += 6) d.px(x, 4, BC.ironLL);
  // rear cap ring seam and prow seam
  all(JC.mrDD, (x, y) => (x >= CAP_X - 1 && x < CAP_X) || (x >= 36 && x < 37 && y < 1));
  for (let y = -52; y <= -4; y += 6) {
    rivet(d, CAP_X + 2, y, JC.mrLL, JC.mrDD);
    rivet(d, 38, y, JC.mrLL, JC.mrDD);
  }
  // inner ring on the cap
  d.shape(-56, -59, CAP_X, 9, JC.mrD, (x, y) => {
    const e = ((x - CAP_X) / (CAP_RX - 4)) ** 2 + ((y - YC) / (RC - 4)) ** 2;
    return x < CAP_X - 0.5 && e > 0.92 && e < 1.0;
  });
  // panel seams on the boiler
  for (const sx of [-21, 6]) {
    all(JC.mrDD, (x, y) => x >= sx && x < sx + 1 && (y < -31 || y > -25) && y < 1);
    for (let y = -53; y <= -3; y += 6) if (y < -32 || y > -24) rivet(d, sx + 2, y, JC.mrLL, JC.mrDD);
  }
  // top deck rivets
  for (let x = -40; x <= 34; x += 5) rivet(d, x, -56, '#e88a66', JC.mrD);

  // --- brass belt band around the boiler
  all(BC.brass, (_x, y) => y >= -31 && y < -25);
  all(BC.brassL, (_x, y) => y >= -31 && y < -30);
  all(BC.brassD, (_x, y) => y >= -26 && y < -25);
  for (let x = -50; x <= 54; x += 5) {
    if (!inHull(x, -28)) continue;
    d.px(x, -29, BC.brassL);
    d.px(x + 1, -28, BC.brassD);
  }

  // --- legion cog emblem and a brass name plate
  cog(d, -11, -43, 6.5);
  d.rect(14, -44, 16, 7, BC.brassD);
  d.rect(14, -44, 16, 6, BC.brass);
  d.rect(15, -43, 14, 1, BC.brassL);
  for (let x = 16; x < 29; x += 3) d.rect(x, -41, 2, 2, BC.brassD);

  // --- furnace portholes (amber glow)
  for (const [px, py] of [
    [-35, -12],
    [-23, -12],
  ]) {
    d.circle(px, py, 3.6, BC.steelD);
    d.ring(px, py, 3.6, BC.steelL, 1);
    d.circle(px, py, 2.4, state >= 3 ? BC.hotL : BC.amber);
    d.circle(px - 0.7, py - 0.7, 1.1, BC.amberL);
  }

  // --- rear exhaust grille with hazard stripes (on the cap)
  hazardStripes(d, -54, -19, 5, 12, BC.hazard, BC.black, 4);
  d.rect(-55, -20, 7, 1, BC.steelD);
  d.rect(-55, -7, 7, 1, BC.steelD);

  // --- belly grille (vent)
  d.rect(-30, 5, 52, 3, BC.ironDD);
  for (let x = -28; x < 20; x += 4) d.rect(x, 5, 2, 2, BC.ironL);

  // --- hip mount recess
  d.circle(0, 0, 10, BC.ironDD);
  d.ring(0, 0, 10, BC.steelD, 1.5);

  // --- turret ring for the artillery and the dome collar base
  d.rect(-21, -63, 24, 6, BC.steelD);
  d.rect(-21, -63, 24, 1, BC.steelL);
  d.rect(-20, -61, 22, 1, BC.steel);
  bolt(d, -18, -60);
  bolt(d, -2, -60);
  d.poly([5, -58, 37, -58, 39, -55, 3, -55], BC.steelD);
  d.rect(5, -58, 32, 1, BC.steelL);

  // --- chest (front face)
  if (state <= 1) {
    d.rect(53, -44, 3, 46, JC.mrDD);
  } else {
    // Armour blown off: dark cavity, ribs, pipes and the core socket.
    const cav = [36, -44, 48, -48, 56, -30, 56, -12, 52, 3, 40, 8, 33, -6, 33, -30];
    d.poly(cav, BC.ironDD);
    polyWhere(d, cav, BC.soot, (x, y) => (Math.floor(x) + Math.floor(y)) % 3 === 0);
    for (const ry of [-38, -26]) {
      d.rect(34, ry, 21, 2, BC.steel);
      d.rect(34, ry, 21, 1, BC.steelL);
    }
    d.cap(37, -44, 40, -14, 1.6, BC.brassD);
    d.cap(38, -44, 41, -15, 0.6, BC.brass);
    d.cap(53, -40, 51, -14, 1.4, BC.steelD);
    d.circle(CORE.x, CORE.y, CORE.r + 3.5, BC.steelD);
    d.ring(CORE.x, CORE.y, CORE.r + 3.5, BC.steelL, 1);
    d.circle(CORE.x, CORE.y, CORE.r + 0.5, BC.black);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      bolt(d, CORE.x + Math.cos(a) * (CORE.r + 2.2) - 0.5, CORE.y + Math.sin(a) * (CORE.r + 2.2) - 0.5);
    }
    for (const [mx, my] of [
      [54, -42],
      [56, -24],
      [54, -6],
    ]) {
      d.px(mx, my, BC.chrome);
      d.px(mx + 1, my + 1, BC.steelL);
    }
  }

  // --- damage
  if (state >= 1) {
    const dents: [number, number, number][] = [
      [-34, -47, 3],
      [-2, -36, 2.5],
      [24, -16, 3],
      [-49, -32, 2],
    ];
    for (const [x, y, r] of dents) {
      d.ellipse(x, y, r + 0.5, r * 0.7, JC.mrDD);
      d.ellipse(x + 0.6, y + 0.4, r * 0.55, r * 0.35, JC.mrD);
      d.px(x - r, y - 1, JC.mrLL);
    }
    for (let i = 0; i < 10; i++) {
      const x = -40 + Math.floor(hash2(i, 3, 7) * 72);
      const y = -50 + Math.floor(hash2(i, 9, 7) * 44);
      if (!inHull(x, y)) continue;
      d.px(x, y, BC.soot);
      d.px(x - 1, y - 1, JC.mrLL);
    }
    all(BC.soot, (x, y) => (x + 6) ** 2 / 260 + (y + 52) ** 2 / 30 < 1 && hash2(x, y, 3) < 0.45);
  }
  if (state >= 3) {
    // scorch patches (dithered edges, not noise)
    const scorch = (cx: number, cy: number, rx: number, ry: number) => {
      all(BC.char, (x, y) => {
        const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        return e < 0.55 || (e < 1 && (Math.floor(x) + Math.floor(y)) % 2 === 0);
      });
    };
    scorch(-22, -44, 18, 12);
    scorch(20, -10, 12, 9);
    // Torn plating: jagged holes showing girders and the glowing furnace inside.
    const hole1 = [-36, -50, -28, -54, -20, -50, -14, -52, -9, -45, -12, -37, -19, -34, -28, -36, -34, -41];
    d.poly(hole1, BC.ironDD);
    polyWhere(d, hole1, BC.amberD, (x, y) => (x + 22) ** 2 / 70 + (y + 43) ** 2 / 22 < 1);
    polyWhere(d, hole1, BC.hot, (x, y) => (x + 22) ** 2 / 40 + (y + 42) ** 2 / 12 < 1);
    polyWhere(d, hole1, BC.hotL, (x, y) => (x + 22) ** 2 / 12 + (y + 42) ** 2 / 4 < 1);
    d.rect(-35, -46, 26, 2, BC.steel);
    d.rect(-35, -46, 26, 1, BC.steelL);
    d.rect(-25, -52, 2, 17, BC.steelD);
    d.poly([-36, -50, -40, -57, -34, -56, -30, -53], JC.mrL);
    d.px(-39, -56, JC.mrLL);
    const hole2 = [10, -14, 18, -18, 26, -15, 27, -8, 20, -4, 12, -6];
    d.poly(hole2, BC.ironDD);
    d.rect(12, -12, 14, 1, BC.steelD);
    polyWhere(d, hole2, BC.amber, (x, y) => (x - 19) ** 2 / 14 + (y + 10) ** 2 / 5 < 1);
    d.rect(-6, -31, 5, 6, JC.mrDD);
    d.px(-6, -30, BC.brassL);
    d.px(-2, -26, BC.brassD);
  }
}

sprites.define({
  name: 'bm6_hull',
  w: HULL_W,
  h: HULL_H,
  ox: HULL_OX,
  oy: HULL_OY,
  frames: 4 * TILTS.length,
  draw: (p, f) => drawHull(p, Math.floor(f / TILTS.length), TILTS[f % TILTS.length]),
});

// ------------------------------------------------------------------ cockpit dome + Marshal Gristle

/** Marshal Vortigern Gristle: maroon greatcoat, brass everything, a magnificent white mustache. */
export const GRISTLE: HumanoidStyle = {
  skin: '#f2bc96',
  hair: '#8e8a94',
  hairStyle: 'bald',
  shirt: '#5a1c22',
  pants: '#2a1e28',
  boots: '#1c161a',
  belt: '#2a1e28',
  strap: '#d4a23a',
  gloves: '#f4f0e6',
  headgear: 'officer',
  headgearColor: '#3e1418',
  headgearAccent: '#d4a23a',
  mustache: '#f0ece4',
  build: 1.3,
  eye: '#1a1420',
};

/** Dome expression frames. */
export const DOMEF = { idle: 0, idle2: 1, shout: 2, laugh: 3, panic: 4, panic2: 5, flinch: 6, fist: 7 } as const;
export type DomeExpr = keyof typeof DOMEF;
const DOME_EXPRS: DomeExpr[] = ['idle', 'idle2', 'shout', 'laugh', 'panic', 'panic2', 'flinch', 'fist'];

export const DOME_W = 38;
export const DOME_H = 33;
export const DOME_OX = 19;
export const DOME_OY = 30;
const DRX = 15;
const DRY = 20;
const DCY = -5;
const GLASS_TINT = '#7cc4e4';

function inGlass(x: number, y: number): boolean {
  return y <= DCY + 0.5 && (x / DRX) ** 2 + ((y - DCY) / DRY) ** 2 <= 1;
}

function gristlePose(e: DomeExpr): HumanPose {
  const base: HumanPose = { hip: [0, -13], footB: [-2, 0], footF: [2, 0], gun: 'none', noGun: true, handF: [6.5, 6.5], handB: [4.5, 8], part: 'upper', expr: 'normal' };
  switch (e) {
    case 'idle2':
      return { ...base, headDy: 0.6, handF: [6.5, 7.5] };
    case 'shout':
      return { ...base, expr: 'shout', lean: 1, handF: [4, -9], headDx: 0.5 };
    case 'fist':
      return { ...base, expr: 'shout', lean: 0.6, handF: [6, -6.5], headDx: 0.5, headDy: 0.4 };
    case 'laugh':
      return { ...base, expr: 'happy', headDx: -1, headDy: -0.6, lean: -0.8, handF: [5, 3], handB: [3.5, 6] };
    case 'panic':
      return { ...base, expr: 'hurt', handF: [3.5, -8.5], handB: [-2.5, -8.5] };
    case 'panic2':
      return { ...base, expr: 'hurt', handF: [4, -7.5], handB: [-2, -9.5], headDy: 0.5 };
    case 'flinch':
      return { ...base, expr: 'hurt', lean: -1.6, handF: [6, -2], handB: [5, 0] };
    default:
      return base;
  }
}

/** Mix an ABGR pixel toward a hex colour. */
function tintPx(v: number, hex: string, t: number): number {
  const c = parseColor(hex);
  const m = (s: number) => Math.round(((v >>> s) & 255) + (((c >>> s) & 255) - ((v >>> s) & 255)) * t);
  return ((255 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)) >>> 0;
}

/** Gristle with his decorations, drawn so his feet sit at (fx, fy) of `p`. */
function drawGristle(p: PixelArt, fx: number, fy: number, e: DomeExpr): void {
  const pose = gristlePose(e);
  drawHuman(p, fx, fy, pose, GRISTLE);
  const b = GRISTLE.build ?? 1;
  const sx = fx + pose.hip[0] + (pose.lean ?? 0);
  const sy = fy + pose.hip[1] - (pose.torso ?? 10);
  const hx = sx + 0.5 + (pose.headDx ?? 0);
  const hy = sy - 5.5 + (pose.headDy ?? 0);
  // Brass epaulette with fringe on the near shoulder.
  p.rect(sx - 2.5 * b + 1, sy - 1.2, 5, 2, BC.brass);
  p.px(Math.floor(sx - 2.5 * b + 1), Math.floor(sy - 1.2), BC.brassL);
  for (let i = 0; i < 5; i++) p.px(Math.floor(sx - 2.5 * b + 1 + i), Math.floor(sy + 0.8), i % 2 ? BC.brassD : BC.brass);
  // Medals.
  p.px(Math.floor(sx + 1.5), Math.floor(sy + 3), '#d83a2a');
  p.px(Math.floor(sx + 2.5), Math.floor(sy + 3), '#3a6ad8');
  p.px(Math.floor(sx + 1.5), Math.floor(sy + 4), BC.brassL);
  p.px(Math.floor(sx + 2.5), Math.floor(sy + 4), BC.brass);
  // Grey sideburns under the cap.
  p.px(Math.floor(hx - 1), Math.floor(hy - 0.5), GRISTLE.hair);
  p.px(Math.floor(hx - 1), Math.floor(hy + 0.5), GRISTLE.hair);
  p.px(Math.floor(hx - 2), Math.floor(hy - 1.5), GRISTLE.hair);
  // The magnificent handlebar mustache.
  const mc = GRISTLE.mustache!;
  p.capsule(hx + 1.6, hy + 2.3, hx + 5.2, hy + 2.3, 1, mc);
  p.px(Math.floor(hx + 6), Math.floor(hy + 1.6), mc);
  p.px(Math.floor(hx + 6.5), Math.floor(hy + 0.8), mc);
  p.px(Math.floor(hx + 1), Math.floor(hy + 3), mc);
  p.px(Math.floor(hx + 0.4), Math.floor(hy + 2.2), shade(mc, -0.15));
  if (e === 'laugh' || e === 'shout' || e === 'fist') {
    p.px(Math.floor(hx + 3.5), Math.floor(hy + 3.6), '#5a1a1a');
    p.px(Math.floor(hx + 4.5), Math.floor(hy + 3.6), '#5a1a1a');
  }
  if (e === 'panic' || e === 'panic2') {
    const k = e === 'panic' ? 0 : 1;
    p.px(Math.floor(hx - 4), Math.floor(hy - 2 + k), '#bfe8ff');
    p.px(Math.floor(hx - 4), Math.floor(hy - 1 + k), '#8ad0f4');
    p.px(Math.floor(hx + 6), Math.floor(hy - 3 - k), '#bfe8ff');
    p.px(Math.floor(hx - 5), Math.floor(hy + 2 - k), '#8ad0f4');
  }
}

/** The cockpit dome (also the escape pod's upper half). */
export function drawDome(p: PixelArt, e: DomeExpr): void {
  const d = new JPen(p, DOME_OX, DOME_OY, 0);
  // interior: dark cabin, lighter towards the top, console glow at the bottom
  d.shape(-DRX - 1, DCY - DRY - 1, DRX + 1, DCY + 1, '#1a2a36', inGlass);
  d.shape(-DRX - 1, DCY - DRY - 1, DRX + 1, DCY + 1, '#22384a', (x, y) => inGlass(x, y) && y < DCY - 11);
  d.rect(-11, DCY - 3, 22, 3, '#2a2a34');
  for (const [cx, c] of [
    [-8, '#ffb030'],
    [-5, '#40e070'],
    [7, '#ff4030'],
    [9, '#ffb030'],
  ] as const)
    d.px(cx, DCY - 2, c);
  // control levers
  d.rect(7, DCY - 6, 1, 4, BC.steelL);
  d.px(7, DCY - 7, '#e83a2a');
  d.rect(10, DCY - 5, 1, 3, BC.steelL);
  d.px(10, DCY - 6, '#e83a2a');
  // Gristle (clipped to the glass)
  const tmp = new (p.constructor as new (w: number, h: number) => PixelArt)(p.w, p.h);
  tmp.ox = p.ox;
  tmp.oy = p.oy;
  drawGristle(tmp, DOME_OX - 1, DOME_OY + 13.5, e);
  for (let Y = 0; Y < p.h; Y++)
    for (let X = 0; X < p.w; X++) {
      const v = tmp.data[Y * p.w + X];
      if (!(v >>> 24)) continue;
      const lx = X - p.ox - DOME_OX + 0.5;
      const ly = Y - p.oy - DOME_OY + 0.5;
      if (inGlass(lx, ly)) p.data[Y * p.w + X] = v;
    }
  // glass tint
  p.mapPixels((v, X, Y) => (inGlass(X - p.ox - DOME_OX + 0.5, Y - p.oy - DOME_OY + 0.5) ? tintPx(v, GLASS_TINT, 0.2) : v));
  // rim shading: dark lower-right edge, bright upper-left edge
  d.shape(-DRX - 1, DCY - DRY - 1, DRX + 1, DCY + 1, '#3a6a86', (x, y) => {
    const e2 = (x / DRX) ** 2 + ((y - DCY) / DRY) ** 2;
    return inGlass(x, y) && e2 > 0.8 && (x > 3 || y > DCY - 4);
  });
  d.shape(-DRX - 1, DCY - DRY - 1, DRX + 1, DCY + 1, '#c8ecfa', (x, y) => {
    const e2 = (x / DRX) ** 2 + ((y - DCY) / DRY) ** 2;
    return inGlass(x, y) && e2 > 0.84 && x < -2 && y < DCY - 6;
  });
  // specular streak hugging the upper-left edge
  for (let a = 3.75; a < 4.25; a += 0.05) d.px(Math.cos(a) * DRX * 0.82, DCY + Math.sin(a) * DRY * 0.84, '#f2fcff');
  d.rect(-8, DCY - 15, 1, 2, '#ffffff');
  // brass collar
  d.poly([-17, 0, 17, 0, 16, -5, -16, -5], BC.brass);
  d.rect(-16, -5, 32, 1, BC.brassL);
  d.rect(-17, -1, 34, 1, BC.brassD);
  for (let x = -14; x <= 14; x += 4) {
    d.px(x, -3, BC.brassD);
    d.px(x - 1, -4, BC.brassL);
  }
}

sprites.define({
  name: 'bm6_dome',
  w: DOME_W,
  h: DOME_H,
  ox: DOME_OX,
  oy: DOME_OY,
  frames: DOME_EXPRS.length,
  draw: (p, f) => drawDome(p, DOME_EXPRS[f]),
});

/** Glass cracks overlay for the dome (0 = first crack, 1 = shattered star). */
sprites.define({
  name: 'bm6_crack',
  w: DOME_W,
  h: DOME_H,
  ox: DOME_OX,
  oy: DOME_OY,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    const d = new Pen(p, DOME_OX, DOME_OY, 0);
    const c = '#e8f8ff';
    const crack = (pts: number[]) => {
      for (let i = 0; i + 3 < pts.length; i += 2) d.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c);
    };
    crack([9, -19, 6, -15, 7, -12, 4, -9]);
    crack([6, -15, 10, -12]);
    if (f >= 1) {
      crack([-3, -22, -2, -18, -5, -15, -4, -11]);
      crack([-2, -18, 2, -17, 5, -19]);
      crack([-5, -15, -10, -13, -12, -9]);
      crack([-4, -11, 0, -9, 3, -10]);
      d.px(-2, -18, '#ffffff');
    }
  },
});

// ------------------------------------------------------------------ artillery (twin barrels)

const CAN_C = 40;

function drawCannon(p: PixelArt, elev: number): void {
  const d = new JPen(p, CAN_C, CAN_C, -elev);
  const L = CANNON.len;
  // far barrel (behind, darker, a bit shorter)
  d.cap(2, -3.5, L - 2, -3.5, 2.1, BC.steelDD);
  d.rect(L - 6, -6, 5, 5, BC.steelD);
  // near barrel
  d.cap(2, 1.5, L, 1.5, 2.4, BC.steelD);
  d.cap(2, 1, L, 1, 1.6, BC.steel);
  d.rect(4, -0.5, L - 6, 1, BC.steelL);
  // recoil sleeve bands
  d.rect(11, -1.5, 2, 6, BC.brassD);
  d.rect(11, -1.5, 1, 6, BC.brass);
  d.rect(19, -1, 2, 5, BC.brassD);
  d.rect(19, -1, 1, 5, BC.brass);
  // muzzle brake
  d.rect(L - 4, -2, 6, 7, BC.steelD);
  d.rect(L - 4, -2, 6, 1, BC.steelL);
  d.rect(L - 2, 0, 2, 3, BC.black);
  // breech block / mantlet with armour plate
  d.poly([-10, -7, 6, -8, 9, -4, 9, 6, -10, 7], BC.steelD);
  d.poly([-9, -6, 5, -7, 8, -3, 8, 1, -9, 1], JC.mr);
  d.poly([-9, -6, 5, -7, 6, -5, -9, -4], JC.mrL);
  d.px(-7, -5, JC.mrLL);
  d.rect(-9, 2, 17, 4, BC.steel);
  bolt(d, -6, 3);
  bolt(d, 3, 3);
  // trunnion pivot
  d.circle(0, 0, 3, BC.steelDD);
  d.circle(-0.5, -0.5, 2, BC.brass);
  d.px(-1, -1, BC.brassL);
}

sprites.define({
  name: 'bm6_cannon',
  w: CAN_C * 2,
  h: CAN_C * 2,
  ox: CAN_C,
  oy: CAN_C,
  frames: CANNON_N,
  draw: (p, f) => drawCannon(p, CANNON_A0 + f * CANNON_STEP),
});

// ------------------------------------------------------------------ missile box

sprites.define({
  name: 'bm6_pod',
  w: 30,
  h: 32,
  ox: 15,
  oy: 30,
  frames: 3,
  draw: (p, f) => {
    const d = new JPen(p, 15, 30, 0);
    // box body
    d.rect(-11, -13, 22, 13, BC.steelD);
    d.rect(-10, -12, 20, 11, JC.mr);
    d.rect(-10, -12, 20, 2, JC.mrL);
    d.rect(-10, -3, 20, 2, JC.mrD);
    hazardStripes(d, -10, -6, 20, 2, BC.hazard, BC.black, 4);
    for (const x of [-8, -1, 6]) bolt(d, x, -10, JC.mrLL, JC.mrDD);
    // launch tubes
    for (const tx of [-6, 0, 6]) {
      d.rect(tx - 2, -15, 4, 3, BC.steel);
      d.rect(tx - 2, -15, 4, 1, BC.steelL);
      if (f >= 1) {
        // missile noses peeking out
        d.rect(tx - 1, -17 - f, 2, 3 + f, BC.steelLL);
        d.px(tx - 1, -18 - f, '#e83a2a');
        d.px(tx, -18 - f, '#c02a1a');
      } else d.rect(tx - 1, -15, 2, 1, BC.black);
    }
    // hinged lid (hinge at the rear, -11, -15)
    if (f === 0) {
      d.rect(-12, -18, 24, 3, BC.steelD);
      d.rect(-12, -18, 24, 1, BC.steelL);
      d.px(9, -17, '#ff3a2a');
    } else {
      const a = f === 1 ? -0.8 : -1.45;
      const lid = new JPen(p, 15 - 11, 30 - 16, a);
      lid.rect(0, -2, 24, 3, BC.steelD);
      lid.rect(0, -2, 24, 1, BC.steelL);
      lid.px(20, -1, '#ff3a2a');
    }
    d.circle(-11, -16, 1.5, BC.steelDD);
  },
});

// ------------------------------------------------------------------ drone bay hatch (rear face)

sprites.define({
  name: 'bm6_hatch',
  w: 12,
  h: 18,
  ox: 6,
  oy: 9,
  frames: 2,
  draw: (p, f) => {
    const d = new JPen(p, 6, 9, 0);
    if (f === 0) {
      d.rect(-3, -7, 7, 14, BC.steelD);
      d.rect(-2, -6, 5, 12, BC.steel);
      d.rect(-2, -6, 1, 12, BC.steelL);
      hazardStripes(d, -2, 3, 5, 3, BC.hazard, BC.black, 4);
      d.px(1, -4, '#ff3a2a');
    } else {
      d.rect(-3, -7, 7, 14, BC.ironDD);
      d.rect(-2, -6, 5, 12, '#0e0c12');
      d.px(0, 0, '#ff3a2a');
      // door swung down/out
      d.rect(-5, 6, 9, 2, BC.steel);
      d.rect(-5, 6, 9, 1, BC.steelL);
    }
  },
});

// ------------------------------------------------------------------ chest armour plate

/** Plate outline in hull-local coords (covers the prow front and the core socket). */
const ARMOR_PTS = [34, -47, 47, -51, 58, -30, 58, -11, 54, 5, 41, 10, 33, -6, 33, -30];
export const ARMOR_ORIGIN = { x: 46, y: -20 };

function drawArmor(p: PixelArt): void {
  const ox = ARMOR_ORIGIN.x;
  const oy = ARMOR_ORIGIN.y;
  const d = new JPen(p, 15, 33, 0);
  const pts = ARMOR_PTS.map((v, i) => (i % 2 === 0 ? v - ox : v - oy));
  const [x0, y0, x1, y1] = bbox(pts);
  d.poly(pts, BC.steelD);
  const inner = (x: number, y: number) => inPoly(pts, x, y) && inPoly(pts, x - 1.5, y) && inPoly(pts, x + 1.5, y) && inPoly(pts, x, y + 1.5) && inPoly(pts, x, y - 1.5);
  d.shape(x0, y0, x1, y1, JC.mr, inner);
  d.shape(x0, y0, x1, y1, JC.mrL, (x, y) => inner(x, y) && y < -20);
  d.shape(x0, y0, x1, y1, JC.mrLL, (x, y) => inner(x, y) && y < -25 && x < 0);
  d.shape(x0, y0, x1, y1, JC.mrD, (x, y) => inner(x, y) && (y > 14 || x > 9));
  // heavy brass Legion cog right over the reactor
  const cx = CORE.x - ox;
  const cy = CORE.y - oy;
  cog(d, cx, cy, 7.5);
  d.ring(cx, cy, 9.5, BC.steelD, 1);
  // rivets around the edge
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    for (let t = 0.25; t < 1; t += 0.5) {
      const x = pts[i] + (pts[j] - pts[i]) * t;
      const y = pts[i + 1] + (pts[j + 1] - pts[i + 1]) * t;
      const mx = x + (cx - x) * 0.14;
      const my = y + (cy - 5 - y) * 0.1;
      bolt(d, Math.round(mx), Math.round(my), BC.steelLL, JC.mrDD);
    }
  }
  // vision slit
  d.rect(-6, -22, 9, 2, BC.black);
  d.px(1, -22, '#ff4030');
}

sprites.define({ name: 'bm6_armor', w: 30, h: 66, ox: 15, oy: 33, draw: (p) => drawArmor(p) });

// ------------------------------------------------------------------ reactor core

/** 0-3 idle pulse, 4-5 charging (white hot, crackling). */
sprites.define({
  name: 'bm6_core',
  w: 28,
  h: 28,
  ox: 14,
  oy: 14,
  frames: 6,
  outline: '#2a0808',
  draw: (p, f) => {
    const d = new Pen(p, 14, 14, 0);
    const charging = f >= 4;
    const k = charging ? 1 : [0, 0.35, 0.7, 0.35][f];
    const R = CORE.r;
    d.circle(0, 0, R, '#a01e14');
    d.circle(-0.3, -0.3, R - 1.5, '#e04418');
    d.circle(-0.6, -0.6, R - 3 + k, '#ff8a20');
    d.circle(-0.8, -0.8, R - 5 + k * 1.4, charging ? '#fff4c0' : '#ffd040');
    d.circle(-1, -1, R - 7 + k * 1.6, charging ? '#ffffff' : '#fff6d0');
    d.circle(-3, -3, 1.4, '#ffffff');
    // containment cage bars
    for (const a of [0.6, 2.2, 3.8, 5.4]) {
      d.line(Math.cos(a) * (R - 2), Math.sin(a) * (R - 2), Math.cos(a) * (R + 1), Math.sin(a) * (R + 1), BC.steelL);
    }
    if (charging) {
      const rays = f === 4 ? [0.3, 1.9, 3.4, 4.9] : [1.1, 2.6, 4.1, 5.7];
      for (const a of rays) {
        const x1 = Math.cos(a) * (R + 3);
        const y1 = Math.sin(a) * (R + 3);
        d.line(Math.cos(a) * (R - 1), Math.sin(a) * (R - 1), x1, y1, '#fff8c0');
        d.px(x1 + Math.cos(a + 0.8), y1 + Math.sin(a + 0.8), '#ffe070');
      }
    }
  },
});

