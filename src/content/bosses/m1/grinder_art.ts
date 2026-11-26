// GRINDER art: a steam-diesel war-dozer of the Rustcoat Legion, built from separate sprites so the
// pieces can animate, recoil and break off. Everything faces RIGHT (front = +x) and is drawn in
// "local" coordinates: origin (0, 0) = ground under the hull centre, -y = up. Light from top-left.
//
//   grinder_tracks  6 scroll phases + charred        grinder_body    hull+boiler: intact / battered / stripped / charred
//   grinder_turret  intact / battered / burning / charred (recoils, blows off at death)
//   grinder_barrel  elevation frames                 grinder_hatch   closed / half / open
//   grinder_stack   normal / hot / cracked / stub    grinder_blade   raised|mid|lowered x normal|battered|charred
//   grinder_drum    toothed grinder roller (6 spin frames + charred)
//   grinder_piston  pumping engine piston rod        grinder_glow    firebox grate glow (dim / lit / white hot)
//   grinder_flame   flame-jet strip (4 flicker)      grinder_shell, grinder_lamp, grinder_parts (debris)

import { sprites } from '../../../engine/sprites';
import { PixelArt } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { BC, Pen, plate, rivet, rivetRow, hazardStripes, cog, charr } from '../common/kit';

/** Geometry shared by the art and the boss logic (local coordinates, facing right). */
export const GR = {
  /** Body sprite canvas (hull, boiler, rear engine). */
  BODY_W: 166,
  BODY_H: 84,
  BODY_OX: 100,
  BODY_OY: 88,
  /** Tracks sprite canvas. */
  TRACK_W: 138,
  TRACK_H: 30,
  TRACK_OX: 78,
  TRACK_OY: 29,
  TRACK_FRAMES: 6,
  /** Turret sprite: origin = turret ring base centre at local (TURRET_X, TURRET_Y). */
  TURRET_W: 60,
  TURRET_H: 44,
  TURRET_OX: 30,
  TURRET_OY: 40,
  TURRET_X: -40,
  TURRET_Y: -50,
  /** Smoke stack base (centre) on the boiler, and its crown. */
  STACK_X: 40,
  STACK_Y: -63,
  STACK_TOP: -113,
  /** Turret gun trunnion. */
  BARREL_X: -18,
  BARREL_Y: -66,
  BARREL_LEN: 42,
  BARREL_MIN: 0.15,
  BARREL_STEP: 0.1,
  BARREL_N: 9,
  /** Commander hatch hinge (rear edge of the hatch ring) and ring centre. */
  HATCH_X: -50,
  HATCH_Y: -82,
  HATCH_CX: -43,
  /** Blade push-arm pivot, blade back x (relative to the pivot), travel of the bottom edge (local y). */
  BLADE_PX: 28,
  BLADE_PY: -15,
  BLADE_BX: 34,
  BLADE_RAISED: -14,
  BLADE_LOWERED: 0,
  /** Blade tip (front-most x, local) and height. */
  BLADE_TIP: 86,
  BLADE_H: 38,
  /** Grinder drum centre relative to the blade's bottom-back corner, radius incl. teeth. */
  DRUM_DX: 15,
  DRUM_DY: -9,
  DRUM_R: 9,
  DRUM_FRAMES: 6,
  /** Headlamp lens (front of the boiler). */
  LAMP_FX: 60,
  LAMP_FY: -68,
  /** Exhaust pipe mouths (rear). */
  EXHAUST: [
    [-97, -79],
    [-91, -81],
  ] as [number, number][],
  /** Engine pistons (housing top centre). */
  PISTONS: [
    [-78, -63],
    [-70, -63],
  ] as [number, number][],
  /** Firebox grate (top-left of the glow overlay). */
  FIREBOX_X: -32,
  FIREBOX_Y: -47,
  /** Beacon lamp on the turret. */
  LAMP_X: -58,
  LAMP_Y: -84,
  /** Flame jet sprite length. */
  FLAME_LEN: 120,
  /** Extents for hit zones / death area. */
  REAR: -96,
  FRONT: 86,
} as const;

// ------------------------------------------------------------------ small art helpers

/** Rust streak running down from a rivet / seam. */
function streak(d: Pen, x: number, y: number, len: number): void {
  d.rect(x, y, 1, len, BC.rust);
  d.px(x, y + len - 1, BC.rustD);
  d.px(x, y, BC.rustL);
}

function dent(d: Pen, x: number, y: number, r: number, base: string, dark: string, light: string): void {
  d.circle(x, y, r, dark);
  d.circle(x + 0.6, y + 0.6, r * 0.65, base);
  d.px(x + r * 0.6, y + r * 0.6, light);
}

/** Bullet pock: dark pit with a bright lip below-right. */
function pock(d: Pen, x: number, y: number, light: string = BC.oliveLL): void {
  d.px(x, y, BC.ironDD);
  d.px(x + 1, y + 1, light);
}

function soot(d: Pen, pts: number[]): void {
  d.poly(pts, BC.soot);
}

// ------------------------------------------------------------------ tracks

interface PathPt {
  x: number;
  y: number;
  nx: number;
  ny: number;
  s: number;
}

/** Belt centre-line as a closed loop (clockwise on screen = top run moves forward). */
function beltPath(): { pts: PathPt[]; len: number } {
  const S = { x: -61, y: -13, r: 12.5 };
  const I = { x: 46, y: -14, r: 10.5 };
  const raw: [number, number][] = [];
  const arc = (c: { x: number; y: number; r: number }, a0: number, a1: number) => {
    const n = Math.max(4, Math.ceil((Math.abs(a1 - a0) * c.r) / 2));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      raw.push([c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r]);
    }
  };
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
    for (let i = 1; i <= n; i++) raw.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  };
  const D = Math.PI / 180;
  raw.push([S.x, S.y - S.r]);
  line(S.x, S.y - S.r, I.x, I.y - I.r);
  arc(I, -90 * D, 55 * D);
  const fx = I.x + Math.cos(55 * D) * I.r;
  const fy = I.y + Math.sin(55 * D) * I.r;
  line(fx, fy, 30, -1.5);
  line(30, -1.5, -44, -1.5);
  const rx = S.x + Math.cos(125 * D) * S.r;
  const ry = S.y + Math.sin(125 * D) * S.r;
  line(-44, -1.5, rx, ry);
  arc(S, 125 * D, 270 * D);
  const pts: PathPt[] = [];
  let s = 0;
  for (let i = 0; i < raw.length; i++) {
    const [x, y] = raw[i];
    const [px, py] = raw[(i - 1 + raw.length) % raw.length];
    const [qx, qy] = raw[(i + 1) % raw.length];
    if (i > 0) s += Math.hypot(x - px, y - py);
    let tx = qx - px;
    let ty = qy - py;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    pts.push({ x, y, nx: ty, ny: -tx, s });
  }
  const [lx, ly] = raw[raw.length - 1];
  const len = s + Math.hypot(raw[0][0] - lx, raw[0][1] - ly);
  return { pts, len };
}

const BELT = beltPath();

function pointAt(s: number): PathPt {
  const L = BELT.len;
  s = ((s % L) + L) % L;
  const pts = BELT.pts;
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pts[mid].s <= s) lo = mid;
    else hi = mid - 1;
  }
  return pts[lo];
}

function drawTracks(p: PixelArt, phase: number, charred: boolean): void {
  const d = new Pen(p, GR.TRACK_OX, GR.TRACK_OY);
  const S = { x: -61, y: -13 };
  const I = { x: 46, y: -14 };
  for (const q of BELT.pts) d.circle(q.x, q.y, 2.2, BC.treadD);
  d.poly([S.x, S.y - 10, I.x, I.y - 8, I.x + 6, I.y + 4, 28, -4, -42, -4, S.x - 6, S.y + 6], BC.steelDD);
  // Inner suspension beam.
  d.rect(-52, -20, 96, 4, BC.steel);
  d.rect(-52, -20, 96, 1, BC.steelL);
  d.rect(-52, -17, 96, 1, BC.steelD);
  for (const q of BELT.pts) d.circle(q.x, q.y, 1.6, BC.tread);
  // Links (move with phase): grouser blocks along the outside + pin highlights.
  const step = 6;
  for (let s = phase; s < BELT.len + step; s += step) {
    const q = pointAt(s);
    d.rect(q.x + q.nx * 1.4 - 1, q.y + q.ny * 1.4 - 1, 2, 2, BC.treadL);
    d.px(q.x - q.nx * 0.5, q.y - q.ny * 0.5, BC.treadLL);
    const q2 = pointAt(s + 3);
    d.px(q2.x + q2.nx * 1.2, q2.y + q2.ny * 1.2, BC.treadD);
  }
  // Return rollers on top.
  for (const x of [-34, -4, 26]) {
    d.circle(x, -22.5, 2.6, BC.steelD);
    d.circle(x - 0.5, -23, 1.4, BC.steelL);
  }
  // Road wheels (hub bolts turn with the belt).
  const rot = (phase / step) * (Math.PI / 3);
  for (const x of [-42, -24, -6, 12, 28]) {
    d.circle(x, -9, 7, BC.steelDD);
    d.circle(x, -9, 6, BC.steel);
    d.circle(x - 1, -10, 4.4, BC.steelL);
    d.circle(x, -9, 3.6, BC.steel);
    for (let k = 0; k < 3; k++) {
      const a = rot + (k * Math.PI * 2) / 3;
      d.px(x + Math.cos(a) * 2.6, -9 + Math.sin(a) * 2.6, BC.steelDD);
    }
    d.circle(x, -9, 1.6, BC.brassD);
    d.px(x - 1, -10, BC.brassL);
    d.px(x - 3, -13, BC.steelLL);
  }
  // Drive sprocket (rear) with teeth that turn with the belt.
  const teeth = 14;
  const srot = (phase / step) * ((Math.PI * 2) / teeth);
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2 + srot;
    d.circle(S.x + Math.cos(a) * 10.5, S.y + Math.sin(a) * 10.5, 1.7, BC.steelD);
  }
  d.circle(S.x, S.y, 10, BC.steelD);
  d.circle(S.x, S.y, 9, BC.steel);
  d.circle(S.x - 1, S.y - 1, 6.5, BC.steelL);
  d.circle(S.x, S.y, 5.5, BC.steel);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + srot;
    d.px(S.x + Math.cos(a) * 7.2, S.y + Math.sin(a) * 7.2, BC.steelDD);
  }
  d.circle(S.x, S.y, 3, BC.brassD);
  d.circle(S.x - 0.6, S.y - 0.6, 1.8, BC.brass);
  // Idler (front).
  d.circle(I.x, I.y, 9, BC.steelD);
  d.circle(I.x, I.y, 8, BC.steel);
  d.circle(I.x - 1, I.y - 1, 5.5, BC.steelL);
  d.circle(I.x, I.y, 4.5, BC.steel);
  for (let k = 0; k < 4; k++) {
    const a = rot * 1.4 + (k * Math.PI) / 2;
    d.px(I.x + Math.cos(a) * 3.2, I.y + Math.sin(a) * 3.2, BC.steelDD);
  }
  d.circle(I.x, I.y, 2.4, BC.brassD);
  d.px(I.x - 1, I.y - 1, BC.brassL);
  // Mud caked on the lower run.
  const rng = new Rng(9);
  for (let i = 0; i < 14; i++) {
    const x = -44 + rng.range(0, 74);
    d.px(x, -1 - rng.int(0, 1), rng.chance(0.5) ? '#5e4430' : '#7a5a3c');
  }
  if (charred) charr(p, 3);
}

sprites.define({
  name: 'grinder_tracks',
  w: GR.TRACK_W,
  h: GR.TRACK_H,
  ox: GR.TRACK_OX,
  oy: GR.TRACK_OY,
  frames: GR.TRACK_FRAMES + 1,
  draw: (p, f) => drawTracks(p, f < GR.TRACK_FRAMES ? f : 2, f >= GR.TRACK_FRAMES),
});

// ------------------------------------------------------------------ body (hull, boiler, rear engine)

/** state: 0 intact, 1 battered, 2 stripped, 3 charred wreck. */
function drawBody(p: PixelArt, state: number): void {
  const d = new Pen(p, GR.BODY_OX, GR.BODY_OY);
  const battered = state >= 1;
  const stripped = state >= 2;

  // ---------------- rear: exhaust stacks (bent back), engine deck, piston housings
  for (const [mx, my] of GR.EXHAUST) {
    const bx = mx + 5;
    d.cap(bx, -58, bx, my + 4, 2.3, BC.ironD);
    d.cap(bx, my + 4, mx, my, 2.3, BC.ironD);
    d.cap(bx - 0.7, -58, bx - 0.7, my + 4, 1.1, BC.ironL);
    d.circle(mx, my, 2.3, BC.rustD);
    d.px(mx - 1, my - 1, BC.ironDD);
    d.px(mx, my - 1, BC.ironDD);
    d.rect(bx - 2, -66, 5, 2, BC.brassD);
    d.rect(bx - 2, -66, 5, 1, BC.brass);
  }
  d.poly([-96, -26, -96, -52, -90, -59, -64, -59, -64, -26], BC.oliveD);
  d.poly([-95, -52, -90, -58, -66, -58, -66, -56, -90, -56], BC.olive);
  d.rect(-90, -57, 24, 1, BC.oliveL);
  // Radiator grille on the rear face.
  d.rect(-94, -52, 11, 22, BC.ironDD);
  for (let y = -51; y < -31; y += 2) d.rect(-93, y, 9, 1, battered && y > -40 ? BC.rustD : BC.ironL);
  d.rect(-94, -52, 11, 1, BC.oliveL);
  d.rect(-83, -52, 1, 22, BC.oliveDD);
  // Piston housings (the rods are a separate sprite drawn behind the body).
  for (const [hx, hy] of GR.PISTONS) {
    d.rect(hx - 3, hy, 7, 5, BC.ironD);
    d.rect(hx - 3, hy, 7, 1, BC.ironL);
    d.rect(hx - 3, hy, 1, 5, BC.ironL);
    d.rect(hx - 3, hy - 1, 7, 1, BC.brassD);
    d.px(hx - 2, hy - 1, BC.brass);
    d.rect(hx - 1, hy + 1, 3, 1, BC.ironDD);
  }

  // ---------------- hull side
  d.poly([-86, -24, -86, -50, 40, -50, 58, -36, 58, -24], BC.olive);
  d.rect(-86, -51, 126, 2, BC.oliveL);
  d.rect(-86, -51, 126, 1, BC.oliveLL);
  d.poly([40, -51, 58, -37, 58, -35, 40, -49], BC.oliveL);
  d.rect(-86, -40, 126, 1, BC.oliveL);
  d.rect(-86, -39, 126, 1, BC.oliveD);
  d.rect(-86, -27, 144, 3, BC.oliveD);
  d.rect(-86, -25, 144, 1, BC.oliveDD);
  // Panel seams.
  for (const x of [-52, -14, 22]) {
    d.rect(x, -49, 1, 22, BC.oliveDD);
    d.rect(x + 1, -49, 1, 22, BC.oliveL);
  }
  rivetRow(d, -82, 36, -47, 6);
  rivetRow(d, -82, 52, -29, 6);
  // Hazard chevrons on the glacis.
  for (let i = 0; i < 3; i++) {
    const x = 44 + i * 4;
    d.poly([x, -46 + i * 3, x + 2, -46 + i * 3, x + 5, -42 + i * 3, x + 3, -42 + i * 3], i % 2 ? BC.black : BC.hazard);
  }
  // Rust streaks under rivets.
  for (const [x, y, l] of [
    [-76, -46, 5],
    [-58, -46, 3],
    [-40, -28, 3],
    [6, -46, 4],
    [30, -46, 6],
    [-10, -28, 3],
  ] as const)
    streak(d, x, y, l);
  // Stencilled cog (symmetric, reads the same when flipped).
  d.ring(-66, -44, 3.5, BC.oliveLL, 1);
  for (let i = 0; i < 6; i++) d.px(-66 + Math.cos((i * Math.PI) / 3) * 4.8, -44 + Math.sin((i * Math.PI) / 3) * 4.8, BC.oliveLL);

  // Firebox door (its grate glow is the grinder_glow overlay).
  const fx = GR.FIREBOX_X;
  const fy = GR.FIREBOX_Y;
  d.rect(fx - 2, fy - 2, 14, 11, BC.ironD);
  d.rect(fx - 2, fy - 2, 14, 1, BC.ironL);
  d.rect(fx - 2, fy - 2, 1, 11, BC.ironL);
  d.rect(fx - 1, fy - 1, 12, 9, BC.ironDD);
  for (const y of [0, 3, 6]) d.rect(fx, fy + y, 10, 2, BC.rustD);
  d.rect(fx + 11, fy + 1, 2, 2, BC.brassD);
  d.rect(fx + 11, fy + 5, 2, 2, BC.brassD);
  d.px(fx + 11, fy + 1, BC.brassL);

  if (stripped) {
    // Torn-off side plates expose glowing machinery.
    d.poly([-62, -48, -40, -49, -38, -30, -64, -29], BC.ironDD);
    d.rect(-60, -46, 20, 3, BC.steelD);
    d.cap(-60, -40, -42, -40, 1.6, BC.brassD);
    d.cap(-58, -34, -42, -36, 1.2, BC.rustD);
    d.circle(-50, -40, 4, BC.hot);
    d.circle(-50, -40, 2.4, BC.hotL);
    d.circle(-50, -40, 1, BC.white);
    d.poly([-62, -48, -58, -49, -61, -45], BC.oliveL);
    d.poly([-40, -49, -38, -46, -42, -48], BC.oliveL);
    d.poly([6, -47, 26, -47, 28, -31, 8, -30], BC.ironDD);
    d.rect(8, -45, 18, 2, BC.steelD);
    d.circle(17, -38, 3, BC.hot);
    d.circle(17, -38, 1.6, BC.hotL);
    d.cap(8, -34, 26, -34, 1.2, BC.steel);
    d.line(9, -44, 12, -40, BC.hotL);
  }

  // ---------------- skirt plates (over the top of the tracks)
  const skirts: [number, number][] = [
    [-82, -44],
    [-44, -6],
    [-6, 32],
  ];
  skirts.forEach(([x0, x1], i) => {
    if (stripped) return;
    if (battered && i === 1) return;
    plate(d, x0, -36, x1 - x0, 13, BC.olive, BC.oliveL, BC.oliveDD);
    d.rect(x0 + 1, -35, x1 - x0 - 2, 1, BC.oliveLL);
    d.rect(x0 + 1, -27, x1 - x0 - 2, 1, BC.oliveD);
    rivet(d, x0 + 2, -34);
    rivet(d, x1 - 4, -34);
    rivet(d, x0 + 2, -27);
    rivet(d, x1 - 4, -27);
    d.rect(x0 + 1, -25, x1 - x0 - 2, 1, BC.oliveD);
    streak(d, x0 + 10 + i * 4, -33, 4);
    streak(d, x1 - 12, -33, 3);
    if (battered) {
      dent(d, x0 + 20, -31, 2.5, BC.olive, BC.oliveDD, BC.oliveL);
      pock(d, x0 + 8, -30);
      pock(d, x1 - 10, -33);
    }
  });
  if (!stripped) {
    // Sloped front skirt.
    d.poly([32, -36, 46, -36, 54, -26, 54, -23, 32, -23], BC.olive);
    d.poly([32, -36, 46, -36, 47, -35, 32, -35], BC.oliveL);
    d.rect(32, -24, 22, 1, BC.oliveDD);
    rivet(d, 35, -33);
    rivet(d, 35, -27);
  } else {
    // Bare suspension arms where the skirts were.
    for (const x of [-60, -30, 0, 26]) d.cap(x, -34, x + 6, -24, 1.2, BC.steelD);
  }
  if (battered && !stripped) {
    // Hanging bent brackets where the middle skirt was torn off.
    d.cap(-44, -36, -40, -30, 1, BC.steelD);
    d.cap(-6, -36, -9, -31, 1, BC.steelD);
    d.rect(-43, -36, 36, 1, BC.oliveDD);
  }
  if (battered) {
    dent(d, -28, -32, 2, BC.olive, BC.oliveDD, BC.oliveL);
    pock(d, -70, -44);
    pock(d, -2, -45);
    pock(d, 18, -31);
  }

  // ---------------- boiler
  const by0 = -64;
  d.rect(-12, by0, 68, 26, BC.iron);
  d.rect(-12, by0, 68, 1, BC.ironLL);
  d.rect(-12, by0 + 1, 68, 6, BC.ironL);
  d.rect(-12, by0 + 2, 68, 1, BC.ironLL);
  d.rect(-12, by0 + 18, 68, 5, BC.ironD);
  d.rect(-12, by0 + 23, 68, 3, BC.ironDD);
  // Smokebox (front end): rounded cap behind a brass rim, headlamp on top.
  d.ellipse(57, -51, 4.5, 13, BC.ironD);
  d.ellipse(56.5, -53, 3, 9, BC.iron);
  d.px(56, -60, BC.ironL);
  d.px(56, -59, BC.ironL);
  d.rect(51, -64, 3, 26, BC.brassD);
  d.rect(51, -64, 2, 26, BC.brass);
  d.rect(51, -64, 1, 9, BC.brassL);
  d.rect(48, -73, 11, 9, BC.ironD);
  d.rect(48, -73, 11, 2, BC.ironL);
  d.rect(49, -70, 8, 5, BC.brassD);
  d.rect(49, -70, 8, 1, BC.brass);
  d.rect(58, -71, 3, 6, BC.brassL);
  d.rect(59, -70, 2, 4, BC.glassL);
  d.rect(52, -76, 2, 3, BC.ironD);
  // Brass boiler bands.
  for (const x of [-2, 18, 38]) {
    if (stripped && x === 18) continue;
    d.rect(x, by0, 4, 26, BC.brass);
    d.rect(x, by0, 4, 7, BC.brassL);
    d.rect(x, by0 + 18, 4, 8, BC.brassD);
    d.rect(x + 3, by0, 1, 26, BC.brassD);
    for (let y = by0 + 3; y < by0 + 24; y += 5) d.px(x + 1, y, BC.white);
  }
  // Steam dome + whistle.
  d.ellipse(9, -64, 8, 5.5, BC.brassD);
  d.ellipse(9, -65, 7, 5, BC.brass);
  d.ellipse(7, -66, 4, 2.5, BC.brassL);
  d.rect(1, -64, 16, 1, BC.brassD);
  d.rect(25, -70, 2, 7, BC.brassD);
  d.rect(24, -73, 4, 3, BC.brass);
  d.px(24, -73, BC.brassL);
  // Pressure gauge.
  d.circle(-6, -55, 2.6, BC.brassD);
  d.circle(-6, -55, 1.8, BC.white);
  d.line(-6, -55, -5, -57, BC.red);
  // Feed pipe along the boiler.
  d.cap(-10, -43, 52, -43, 1.1, BC.rustD);
  d.cap(-10, -43.5, 52, -43.5, 0.5, BC.rustL);
  for (const x of [4, 30]) {
    d.rect(x - 1, -45, 3, 4, BC.brassD);
    d.px(x, -45, BC.brassL);
  }
  // Saddles.
  for (const x of [2, 30]) d.poly([x - 6, -38, x + 6, -38, x + 8, -50, x - 8, -50], BC.oliveD);
  if (battered) {
    soot(d, [30, -63, 50, -63, 46, -56, 34, -58]);
    pock(d, 12, -52, BC.ironLL);
    pock(d, -6, -49, BC.ironLL);
    pock(d, 44, -48, BC.ironLL);
    dent(d, 26, -50, 2.4, BC.iron, BC.ironDD, BC.ironLL);
  }
  if (stripped) {
    // Cracked, glowing boiler seams.
    d.line(14, -63, 20, -55, BC.hot);
    d.line(20, -55, 16, -47, BC.hot);
    d.line(15, -62, 19, -56, BC.hotL);
    d.line(46, -60, 42, -52, BC.hot);
    d.line(42, -52, 48, -44, BC.hot);
    d.rect(-12, by0, 6, 3, BC.ironDD);
  }

  if (state === 3) charr(p, 5);
}

sprites.define({
  name: 'grinder_body',
  w: GR.BODY_W,
  h: GR.BODY_H,
  ox: GR.BODY_OX,
  oy: GR.BODY_OY,
  frames: 4,
  draw: (p, f) => drawBody(p, f),
});

// ------------------------------------------------------------------ turret

/** state: 0 intact, 1 battered, 2 burning (holed), 3 charred. Drawn in body-local coordinates. */
function drawTurret(p: PixelArt, state: number): void {
  const d = new Pen(p, GR.TURRET_OX - GR.TURRET_X, GR.TURRET_OY - GR.TURRET_Y);
  // Ring skirt.
  d.rect(-64, -52, 48, 3, BC.ironD);
  d.rect(-64, -52, 48, 1, BC.ironL);
  // Dome.
  d.poly([-66, -51, -66, -72, -60, -80, -30, -83, -20, -79, -14, -69, -14, -56, -18, -51], BC.olive);
  d.poly([-65, -72, -60, -79, -30, -82, -21, -78, -24, -76, -31, -79, -59, -77], BC.oliveL);
  d.poly([-60, -80, -30, -83, -29, -82, -59, -79], BC.oliveLL);
  d.poly([-66, -57, -14, -57, -14, -56, -18, -51, -66, -51], BC.oliveD);
  d.rect(-66, -58, 52, 1, BC.oliveDD);
  // Highlight on the upper-left shoulder.
  d.poly([-64, -71, -59, -77, -50, -78, -60, -73], BC.oliveLL);
  // Rust band with the Legion cog.
  d.rect(-66, -70, 52, 3, BC.rust);
  d.rect(-66, -70, 52, 1, BC.rustL);
  d.rect(-66, -68, 52, 1, BC.rustD);
  cog(d, -42, -62, 4.6);
  rivetRow(d, -62, -22, -74, 8);
  rivetRow(d, -62, -22, -54, 8);
  streak(d, -54, -66, 4);
  streak(d, -28, -66, 3);
  // Vision block + periscope.
  d.rect(-28, -86, 6, 4, BC.ironD);
  d.rect(-27, -85, 4, 1, BC.glass);
  d.px(-26, -85, BC.glassL);
  // Commander hatch ring (lid is a separate sprite).
  d.rect(GR.HATCH_X, -84, 15, 2, BC.ironD);
  d.rect(GR.HATCH_X, -84, 15, 1, BC.ironL);
  // Mantlet.
  d.ellipse(-16, -64, 5.5, 8, BC.ironD);
  d.ellipse(-17, -65, 4, 6.5, BC.iron);
  d.px(-19, -69, BC.ironLL);
  d.px(-19, -68, BC.ironL);
  // Grab rail.
  d.rect(-62, -76, 1, 3, BC.ironD);
  d.rect(-62, -77, 10, 1, BC.ironD);
  d.rect(-53, -76, 1, 3, BC.ironD);
  if (state >= 1) {
    dent(d, -56, -61, 2.2, BC.olive, BC.oliveDD, BC.oliveL);
    pock(d, -30, -64);
    pock(d, -48, -56);
    pock(d, -24, -74);
    soot(d, [-34, -79, -26, -80, -24, -74, -30, -72]);
  }
  if (state >= 2) {
    // Shell hole with glowing innards, scorched plating.
    d.poly([-64, -66, -50, -64, -52, -56, -64, -57], BC.ironDD);
    d.cap(-62, -60, -54, -61, 1, BC.hot);
    d.px(-57, -62, BC.hotL);
    soot(d, [-66, -68, -46, -68, -48, -64, -60, -62]);
    soot(d, [-40, -84, -30, -84, -32, -80, -40, -79]);
  }
  if (state === 3) charr(p, 6);
}

sprites.define({
  name: 'grinder_turret',
  w: GR.TURRET_W,
  h: GR.TURRET_H,
  ox: GR.TURRET_OX,
  oy: GR.TURRET_OY,
  frames: 4,
  draw: (p, f) => drawTurret(p, f),
});

// ------------------------------------------------------------------ smoke stack

/** frame: 0 normal, 1 hot, 2 cracked & glowing, 3 broken stub. Origin = base centre. */
sprites.define({
  name: 'grinder_stack',
  w: 26,
  h: 54,
  ox: 13,
  oy: 52,
  frames: 4,
  draw: (p, f) => {
    const d = new Pen(p, 13, 52);
    const hot = f === 1 || f === 2;
    // Base flange.
    d.rect(-10, -4, 20, 5, BC.brassD);
    d.rect(-10, -4, 20, 2, BC.brass);
    d.rect(-10, -4, 20, 1, BC.brassL);
    rivetRow(d, -8, 7, -2, 5, BC.white, BC.brassD);
    if (f === 3) {
      // Ragged stub, glowing inside.
      d.poly([-6, -4, -6, -14, -3, -11, 0, -16, 3, -10, 6, -15, 6, -4], BC.ironD);
      d.poly([-5, -4, -5, -12, -3, -10, -3, -4], BC.ironL);
      d.poly([-4, -11, 0, -14, 4, -10, 0, -9], BC.hot);
      d.poly([-2, -11, 0, -13, 2, -11, 0, -10], BC.hotL);
      d.cap(-7, -12, -10, -16, 1, BC.ironD);
      d.cap(6, -13, 10, -15, 1, BC.ironD);
      return;
    }
    // Shaft (slight taper).
    d.poly([-6, -4, -5, -40, 5, -40, 6, -4], BC.iron);
    d.poly([-6, -4, -5, -40, -3, -40, -4, -4], BC.ironL);
    d.poly([-5, -4, -4.6, -40, -4, -40, -4.4, -4], BC.ironLL);
    d.poly([3, -4, 3, -40, 5, -40, 6, -4], BC.ironD);
    // Bands.
    for (const y of [-16, -30]) {
      d.rect(-6, y, 12, 3, hot ? BC.hot : BC.brassD);
      d.rect(-6, y, 12, 1, hot ? BC.hotL : BC.brass);
    }
    if (hot) {
      // Heat glow creeping up the shaft.
      d.rect(-3, -14, 5, 10, BC.rustD);
      d.rect(-2, -12, 3, 6, BC.rust);
      d.rect(-2, -28, 4, 9, BC.rust);
      d.rect(-1, -26, 2, 5, BC.hot);
    }
    // Crown.
    d.poly([-5, -40, 5, -40, 10, -47, -10, -47], BC.ironD);
    d.poly([-5, -40, -2, -40, -6, -47, -10, -47], BC.ironL);
    d.rect(-11, -50, 22, 3, BC.brass);
    d.rect(-11, -50, 22, 1, BC.brassL);
    d.rect(-11, -48, 22, 1, BC.brassD);
    d.rect(-8, -51, 16, 1, BC.soot);
    if (f === 2) {
      d.line(-3, -38, 1, -32, BC.hot);
      d.line(1, -32, -2, -24, BC.hot);
      d.line(-2, -24, 2, -18, BC.hotL);
      d.line(3, -10, 0, -6, BC.hot);
      d.circle(1, -22, 1.6, BC.hotL);
    }
  },
});

// ------------------------------------------------------------------ cannon barrel

sprites.define({
  name: 'grinder_barrel',
  w: 52,
  h: 50,
  ox: 6,
  oy: 45,
  frames: GR.BARREL_N,
  draw: (p, f) => {
    const elev = GR.BARREL_MIN + f * GR.BARREL_STEP;
    const d = new Pen(p, 6, 45, -elev);
    d.cap(0, 0, 11, 0, 4, BC.ironD);
    d.cap(0, -1, 11, -1, 2.4, BC.iron);
    d.cap(10, 0, 35, 0, 2.6, BC.oliveD);
    d.cap(10, -0.6, 35, -0.6, 1.6, BC.olive);
    d.cap(10, -1.6, 35, -1.6, 0.5, BC.oliveL);
    d.rect(18, -3, 2, 6, BC.rust);
    d.rect(35, -4, 8, 8, BC.ironD);
    d.rect(35, -4, 8, 2, BC.ironL);
    d.rect(37, -2, 1, 4, BC.ironDD);
    d.rect(40, -2, 1, 4, BC.ironDD);
    d.rect(42, -1, 1, 2, BC.black);
  },
});

// ------------------------------------------------------------------ hatch lid

sprites.define({
  name: 'grinder_hatch',
  w: 26,
  h: 20,
  ox: 8,
  oy: 16,
  frames: 3,
  draw: (p, f) => {
    const ang = [0, -0.8, -1.75][f];
    const d = new Pen(p, 8, 16, ang);
    d.rect(0, -3, 15, 3, BC.oliveD);
    d.rect(0, -3, 15, 1, BC.oliveL);
    d.rect(5, -4, 5, 1, BC.ironD);
    d.circle(0, -1.5, 1.6, BC.ironL);
  },
});

// ------------------------------------------------------------------ blade + push arms

/** Blade bottom (relative to the pivot) for a lowered fraction 0..1. */
export function bladeBottomRel(lower: number): number {
  return GR.BLADE_RAISED - GR.BLADE_PY + lower * (GR.BLADE_LOWERED - GR.BLADE_RAISED);
}

/** Blade bottom (relative to the pivot) of baked blade position frame 0 raised, 1 mid, 2 lowered. */
export function bladeFrameBottomRel(pos: number): number {
  return bladeBottomRel(pos / 2);
}

function drawBlade(p: PixelArt, pos: number, cond: number): void {
  const d = new Pen(p, 5, 40);
  const bx = GR.BLADE_BX;
  const by = bladeFrameBottomRel(pos);
  const P = (x: number, y: number) => [bx + x, by + y];
  const poly = (pts: number[][], c: string) => d.poly(pts.flat(), c);
  // Hydraulic ram from the hull front to the top of the blade back.
  d.cap(20, -25, bx - 2, by - 28, 2.8, BC.ironD);
  d.cap(20, -25.6, bx - 10, by - 28.4, 1.6, BC.iron);
  d.cap(bx - 10, by - 28, bx - 2, by - 28, 1.1, BC.chrome);
  // Push arms (box section) + diagonal brace.
  d.cap(0, 0, bx - 1, by - 10, 4.2, BC.steelDD);
  d.cap(0, -0.8, bx - 1, by - 10.8, 3, BC.steel);
  d.cap(0.5, -2.4, bx - 2, by - 12.4, 0.8, BC.steelL);
  d.cap(5, -5, bx - 1, by - 24, 1.9, BC.steelD);
  d.circle(0, 0, 4.2, BC.ironDD);
  d.circle(0, 0, 2.8, BC.iron);
  d.circle(-0.5, -0.5, 1.4, BC.brass);
  // Blade slab: raked back face, curled top lip, concave moldboard.
  poly([P(-2, -36), P(9, -39), P(16, -37), P(13, -32), P(9, -26), P(7, -17), P(8, -10), P(12, -4), P(20, -1), P(20, 0), P(0, 0)], BC.steel);
  poly([P(13, -32), P(9, -26), P(7, -17), P(8, -10), P(12, -4), P(18, -2), P(10, -3), P(4, -10), P(3, -18), P(6, -27)], BC.steelD);
  poly([P(-2, -36), P(4, -37), P(4, 0), P(0, 0)], BC.steelL);
  poly([P(-2, -36), P(9, -39), P(10, -38), P(-1, -35)], BC.steelLL);
  // Hazard band across the upper back.
  hazardStripes(d, bx - 1, by - 34, 6, 24);
  d.rect(bx - 1, by - 34, 6, 1, BC.hazardL);
  // Drum side bracket (the drum itself is a separate spinning sprite).
  poly([P(3, -20), P(10, -21), P(GR.DRUM_DX + 3, GR.DRUM_DY - 2), P(GR.DRUM_DX, GR.DRUM_DY + 3), P(4, -6)], BC.steelD);
  poly([P(4, -19), P(9, -20), P(GR.DRUM_DX + 1, GR.DRUM_DY - 3), P(6, -12)], BC.steel);
  // Rust streaks.
  d.cap(bx + 9, by - 29, bx + 8, by - 24, 0.6, BC.rustD);
  d.px(bx + 1, by - 6, BC.rust);
  d.px(bx + 1, by - 5, BC.rustD);
  // Flame vents in the moldboard.
  for (const vy of [-26, -18]) {
    d.rect(bx + 7, by + vy, 3, 3, BC.ironDD);
    d.px(bx + 8, by + vy + 1, cond === 0 ? BC.rustD : BC.hot);
  }
  // Bolts on the back.
  for (const vy of [-30, -19, -8]) rivet(d, bx + 1, by + vy, BC.steelLL, BC.steelDD);
  if (cond >= 1) {
    d.circle(bx + 8, by - 31, 1.6, BC.steelDD);
    d.px(bx + 9, by - 30, BC.steelLL);
    d.line(bx + 1, by - 17, bx + 3, by - 12, BC.steelLL);
    d.circle(bx + 11, by - 24, 1.3, BC.steelDD);
    d.poly([P(15, -37), P(16, -37), P(13, -33)].flat(), BC.steelDD);
  }
  if (cond === 2) charr(p, 7);
}

sprites.define({
  name: 'grinder_blade',
  w: 64,
  h: 64,
  ox: 5,
  oy: 40,
  frames: 9,
  draw: (p, f) => drawBlade(p, f % 3, Math.floor(f / 3)),
});

// ------------------------------------------------------------------ grinder drum

/** Toothed grinder roller. Frames 0..5 spin (15 deg steps, period 90 deg), frame 6 charred. Origin = axle. */
function drawDrum(p: PixelArt, rot: number, charred: boolean): void {
  const d = new Pen(p, 11, 11);
  const R = 6.5;
  // Teeth hooked against the spin direction.
  for (let k = 0; k < 8; k++) {
    const a = rot + (k * Math.PI) / 4;
    const a0 = a - 0.26;
    const a1 = a + 0.24;
    const at = a - 0.14;
    d.tri(Math.cos(a0) * (R - 0.5), Math.sin(a0) * (R - 0.5), Math.cos(a1) * (R - 0.5), Math.sin(a1) * (R - 0.5), Math.cos(at) * GR.DRUM_R, Math.sin(at) * GR.DRUM_R, BC.steelL);
    d.px(Math.cos(at) * (GR.DRUM_R - 1), Math.sin(at) * (GR.DRUM_R - 1), BC.chrome);
  }
  d.circle(0, 0, R, BC.steelD);
  d.circle(-0.6, -0.6, R - 1, BC.steel);
  d.circle(-1.6, -1.6, R - 3.4, BC.steelL);
  d.circle(0, 0, 3.2, BC.ironD);
  // Hub with 4 spokes.
  for (let k = 0; k < 4; k++) {
    const a = rot + (k * Math.PI) / 2;
    d.cap(0, 0, Math.cos(a) * 4.6, Math.sin(a) * 4.6, 0.8, BC.ironDD);
  }
  d.circle(0, 0, 2.2, BC.brass);
  d.px(-1, -1, BC.brassL);
  d.px(0, 0, BC.brassD);
  if (charred) charr(p, 9);
}

sprites.define({
  name: 'grinder_drum',
  w: 22,
  h: 22,
  ox: 11,
  oy: 11,
  frames: GR.DRUM_FRAMES + 1,
  draw: (p, f) => drawDrum(p, f < GR.DRUM_FRAMES ? -f * (Math.PI / 12) : 0.2, f >= GR.DRUM_FRAMES),
});

// ------------------------------------------------------------------ engine piston + firebox glow

sprites.define({
  name: 'grinder_piston',
  w: 5,
  h: 13,
  ox: 2,
  oy: 13,
  draw: (p) => {
    p.rect(1, 3, 2, 10, BC.chrome);
    p.rect(2, 3, 1, 10, BC.steelL);
    p.rect(0, 0, 5, 3, BC.brass);
    p.rect(0, 0, 5, 1, BC.brassL);
    p.rect(4, 1, 1, 2, BC.brassD);
  },
});

sprites.define({
  name: 'grinder_glow',
  w: 10,
  h: 8,
  ox: 0,
  oy: 0,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    const base = [BC.amberD, BC.hot, BC.hotL][f];
    const core = [BC.rust, BC.hotL, BC.white][f];
    for (const y of [0, 3, 6]) {
      p.rect(0, y, 10, 2, base);
      p.rect(2, y, 6, 1, core);
    }
  },
});

// ------------------------------------------------------------------ flame jet (from the blade vents)

sprites.define({
  name: 'grinder_flame',
  w: GR.FLAME_LEN,
  h: 32,
  ox: 0,
  oy: 13,
  frames: 4,
  outline: null,
  draw: (p, f) => {
    const L = GR.FLAME_LEN - 12;
    const layers: [string, number, number][] = [
      ['#8a2418', 1, 1],
      ['#d8402a', 0.84, 1],
      ['#ff8a2a', 0.64, 0.95],
      ['#ffd060', 0.42, 0.7],
      ['#fff6c0', 0.22, 0.35],
    ];
    for (const [c, k, reach] of layers) {
      for (let x = 1; x <= L * reach; x += 1.5) {
        const t = x / L;
        const r = (1.8 + t * 8.2 + Math.sin(x * 0.33 + f * 1.7) * (0.5 + t * 1.2)) * k;
        const y = 13 + t * 6 + Math.sin(x * 0.19 - f * 2.3) * t * 1.6;
        p.circle(x, Math.min(y, 30 - r * 0.5), r, c);
      }
    }
    // Rolling head of the jet + licks and embers.
    const rng = new Rng(100 + f * 17);
    for (let i = 0; i < 7; i++) {
      const x = L * rng.range(0.55, 1.02);
      const y = rng.range(5, 24);
      p.circle(x, y, rng.range(1.2, 2.8), i % 3 === 0 ? '#ffd060' : '#ff8a2a');
    }
    for (let i = 0; i < 6; i++) p.px(rng.range(L * 0.3, L + 10), rng.range(2, 26), rng.chance(0.5) ? '#ffe070' : '#ff8a2a');
  },
});

// ------------------------------------------------------------------ small sprites

sprites.define({
  name: 'grinder_shell',
  w: 11,
  h: 6,
  ox: 5,
  oy: 3,
  frames: 2,
  draw: (p, f) => {
    p.rect(1, 1, 6, 4, BC.ironD);
    p.rect(1, 1, 6, 1, BC.ironL);
    p.rect(4, 1, 1, 4, BC.brass);
    p.poly([7, 1, 10, 3, 7, 5], f ? BC.redL : BC.red);
    p.rect(0, 2, 1, 2, f ? BC.hotL : BC.hot);
  },
});

sprites.define({
  name: 'grinder_lamp',
  w: 5,
  h: 5,
  ox: 2,
  oy: 4,
  frames: 4,
  draw: (p, f) => {
    const on = f % 2 === 1;
    const amber = f >= 2;
    p.rect(0, 3, 5, 2, BC.ironD);
    p.circle(2.5, 3, 2.2, on ? (amber ? BC.amberL : BC.redL) : amber ? BC.amberD : BC.redD);
    if (on) p.px(1, 2, BC.white);
  },
});

/**
 * Debris pieces: 0 skirt plate, 1 stack crown, 2 hatch lid, 3 armour plate, 4 barrel, 5 jerrycan,
 * 6 track links, 7 road wheel.
 */
sprites.define({
  name: 'grinder_parts',
  w: 40,
  h: 16,
  ox: 20,
  oy: 8,
  frames: 8,
  draw: (p, f) => {
    const d = new Pen(p, 20, 8);
    switch (f) {
      case 0:
        plate(d, -19, -6, 38, 13, BC.olive, BC.oliveL, BC.oliveDD);
        rivet(d, -17, -4);
        rivet(d, 15, -4);
        rivet(d, -17, 3);
        rivet(d, 15, 3);
        streak(d, 4, -3, 4);
        break;
      case 1:
        d.poly([-5, 4, 5, 4, 10, -3, -10, -3], BC.ironD);
        d.rect(-11, -6, 22, 3, BC.brass);
        d.rect(-11, -6, 22, 1, BC.brassL);
        d.rect(-6, 4, 12, 4, BC.iron);
        break;
      case 2:
        d.rect(-8, -2, 15, 3, BC.oliveD);
        d.rect(-8, -2, 15, 1, BC.oliveL);
        d.rect(-3, -3, 5, 1, BC.ironD);
        break;
      case 3:
        plate(d, -8, -6, 16, 12, BC.olive, BC.oliveL, BC.oliveDD);
        rivet(d, -6, -4);
        rivet(d, 4, 2);
        break;
      case 4:
        d.cap(-18, 0, 12, 0, 2.6, BC.oliveD);
        d.cap(-18, -0.6, 12, -0.6, 1.4, BC.olive);
        d.rect(12, -4, 7, 8, BC.ironD);
        break;
      case 5:
        plate(d, -5, -7, 10, 13, BC.olive, BC.oliveL, BC.oliveDD);
        d.line(-4, -6, 3, 4, BC.oliveD);
        break;
      case 6:
        for (let i = 0; i < 6; i++) {
          const x = -15 + i * 5;
          const y = Math.round(Math.sin(i * 0.9) * 2);
          d.rect(x, y - 2, 5, 4, BC.tread);
          d.rect(x, y - 2, 5, 1, BC.treadL);
          d.px(x + 2, y, BC.treadLL);
        }
        break;
      default:
        d.circle(0, 0, 7, BC.steelDD);
        d.circle(0, 0, 6, BC.steel);
        d.circle(-1, -1, 4.4, BC.steelL);
        d.circle(0, 0, 3.6, BC.steel);
        d.circle(0, 0, 1.6, BC.brassD);
        break;
    }
  },
});
