// JUGGERNAUT legs: reverse-jointed walker legs composed at runtime from angle-baked segments.
//   bm6_thigh_n / _f  frame = angle index (THIGH_A0 + i * SEG_STEP), origin = hip joint
//   bm6_shin_n / _f   frame = angle index (SHIN_A0 + i * SEG_STEP), origin = knee joint
//   bm6_foot_n / _f   frame = FOOT_TILTS index, origin = ankle joint (sole ANKLE px below)
//   bm6_hip_n/_f, bm6_knee_n/_f  joint caps drawn over the segment ends
// "_n" = near leg (full colour), "_f" = far leg (dimmed for depth). Lit from the top-left in world
// space: each baked angle works out which side of the segment faces the light.

import { sprites } from '../../../engine/sprites';
import { mixColor, type PixelArt } from '../../../engine/pixelart';
import { cog, hazardStripes } from '../common/kit';
import { FOOT_TILTS, JC, JPen, LS, LT, SEG_STEP, SHIN_A0, SHIN_N, THIGH_A0, THIGH_N, bolt } from './art';

interface LegPal {
  mr: string;
  mrL: string;
  mrLL: string;
  mrD: string;
  mrDD: string;
  st: string;
  stL: string;
  stLL: string;
  stD: string;
  stDD: string;
  br: string;
  brL: string;
  brD: string;
  ir: string;
  irD: string;
  hz: string;
  bk: string;
  chrome: string;
}

const NEAR: LegPal = {
  mr: JC.mr,
  mrL: JC.mrL,
  mrLL: JC.mrLL,
  mrD: JC.mrD,
  mrDD: JC.mrDD,
  st: JC.steel,
  stL: JC.steelL,
  stLL: JC.steelLL,
  stD: JC.steelD,
  stDD: JC.steelDD,
  br: JC.brass,
  brL: JC.brassL,
  brD: JC.brassD,
  ir: JC.iron,
  irD: JC.ironDD,
  hz: JC.hazard,
  bk: JC.black,
  chrome: JC.chrome,
};

const dim = (c: string) => mixColor(c, '#16121e', 0.4);
const FAR: LegPal = Object.fromEntries(Object.entries(NEAR).map(([k, v]) => [k, dim(v)])) as unknown as LegPal;

/** Which local side (-1 = -y, +1 = +y) of a segment pointing along `a` faces the top-left light. */
function litSide(a: number): number {
  return Math.cos(a) - Math.sin(a) > 0 ? -1 : 1;
}

// ------------------------------------------------------------------ thigh

const SEG_C = 50;

function drawThigh(p: PixelArt, a: number, P: LegPal): void {
  const d = new JPen(p, SEG_C, SEG_C, a);
  const s = litSide(a);
  // hydraulic "hamstring" piston on the +y side
  d.cap(4, 13, 19, 13, 3.4, P.stD);
  d.cap(4, 12.4, 19, 12.4, 2.3, P.st);
  d.cap(19, 12.5, LT - 2, 8, 1.5, P.chrome);
  d.px(21, 11, P.stLL);
  // inner strut
  d.cap(0, 0, LT, 0, 7, P.stD);
  // armour shell
  const shell = [-5, -12, 10, -14, LT - 9, -10, LT - 2, -6, LT - 2, 6, LT - 9, 10, 10, 14, -5, 12];
  d.poly(shell, P.mr);
  d.shape(-6, -15, LT, 15, P.mrL, (x, y) => inShell(shell, x, y) && y * s > 5);
  d.shape(-6, -15, LT, 15, P.mrLL, (x, y) => inShell(shell, x, y) && y * s > 9.5 && x > 0 && x < LT - 11);
  d.shape(-6, -15, LT, 15, P.mrD, (x, y) => inShell(shell, x, y) && y * s < -5);
  d.shape(-6, -15, LT, 15, P.mrDD, (x, y) => inShell(shell, x, y) && y * s < -10);
  // centre ridge + rivets
  d.rect(0, -0.5, LT - 8, 1, P.mrDD);
  for (let x = 2; x < LT - 8; x += 6) {
    d.px(x, -4 * s, P.mrLL);
    d.px(x, 4 * s, P.mrD);
  }
  // brass band
  d.rect(20, -11, 4, 22, P.brD);
  d.rect(20, -11, 2, 22, P.br);
  d.rect(20, s < 0 ? -11 : 10, 2, 1, P.brL);
  // knee end cap
  d.circle(LT, 0, 7.5, P.stD);
}

function inShell(shell: number[], x: number, y: number): boolean {
  let inside = false;
  const n = shell.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = shell[i * 2];
    const yi = shell[i * 2 + 1];
    const xj = shell[j * 2];
    const yj = shell[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ------------------------------------------------------------------ shin

function drawShin(p: PixelArt, a: number, P: LegPal): void {
  const d = new JPen(p, SEG_C, SEG_C, a);
  const s = litSide(a);
  // shock absorber with a coil spring on the +y side
  d.cap(6, 9.5, 24, 9.5, 3.2, P.stD);
  for (let x = 7; x < 24; x += 2) {
    d.rect(x, 6.5, 1, 6, P.stL);
    d.rect(x + 1, 6.5, 1, 6, P.stDD);
  }
  d.cap(24, 9, LS - 6, 5, 1.5, P.chrome);
  // strut
  d.cap(0, 0, LS, 0, 6, P.stD);
  d.cap(0, -0.5, LS, -0.5, 4.2, P.st);
  d.rect(2, -3.5 * s - 0.5, LS - 6, 1, P.stL);
  // armoured shin guard on the -y side
  const guard = [0, -11, LS - 13, -10, LS - 4, -5, LS - 4, -1, 0, -2];
  d.poly(guard, P.mr);
  d.shape(-1, -12, LS, 0, s < 0 ? P.mrL : P.mrD, (x, y) => inShell(guard, x, y) && y < -7);
  if (s < 0) d.shape(-1, -12, LS, 0, P.mrLL, (x, y) => inShell(guard, x, y) && y < -9.2 && x > 3 && x < LS - 15);
  d.shape(-1, -12, LS, 0, P.mrDD, (x, y) => inShell(guard, x, y) && y > -3.5);
  for (let x = 5; x < LS - 12; x += 7) d.px(x, -6, s < 0 ? P.mrLL : P.mrL);
  // hazard band above the ankle
  hazardStripes(d, LS - 12, -8, 5, 7, P.hz, P.bk, 4);
  // ankle end
  d.circle(LS, 0, 5.5, P.stD);
}

// ------------------------------------------------------------------ foot

const FOOT_C = 44;

function drawFoot(p: PixelArt, tilt: number, P: LegPal): void {
  // Authored at 1x, scaled up 1.25 x 1.17 around the ankle (the sole ends ANKLE px below it).
  const base = new JPen(p, FOOT_C, FOOT_C, tilt);
  const K = 1.25;
  const KY = 1.17;
  const d = {
    poly: (pts: number[], c: string) => base.poly(pts.map((v, i) => v * (i % 2 ? KY : K)), c),
    rect: (x: number, y: number, w: number, h: number, c: string) => base.poly([x * K, y * KY, (x + w) * K, y * KY, (x + w) * K, (y + h) * KY, x * K, (y + h) * KY], c),
    px: (x: number, y: number, c: string) => base.px(x * K, y * KY, c),
    circle: (x: number, y: number, r: number, c: string) => base.circle(x * K, y * KY, r * K, c),
    shape: (x0: number, y0: number, x1: number, y1: number, c: string, f: (x: number, y: number) => boolean) => base.shape(x0 * K, y0 * KY, x1 * K, y1 * KY, c, (x, y) => f(x / K, y / KY)),
  };
  // far toe (behind)
  d.poly([6, 3, 20, 5, 25, 8, 22, 10, 8, 9], P.stDD);
  d.poly([20, 5, 25, 8, 27, 11, 23, 9], P.stD);
  // heel spur
  d.poly([-10, 5, -20, 10, -21, 12, -9, 12], P.stD);
  d.poly([-10, 5, -19, 9.5, -12, 9], P.st);
  d.px(-20, 11, P.stLL);
  // foot body
  const body = [-12, 1, 8, 1, 16, 5, 18, 12, -14, 12, -15, 6];
  d.poly(body, P.mr);
  d.shape(-16, 0, 19, 13, P.mrL, (x, y) => inShell(body, x, y) && y < 3.5);
  d.shape(-16, 0, 19, 13, P.mrLL, (x, y) => inShell(body, x, y) && y < 2.2 && x < 6);
  d.shape(-16, 0, 19, 13, P.mrD, (x, y) => inShell(body, x, y) && y > 7.5);
  for (let y = 6; y < 10; y++)
    for (let x = -13; x < -7; x++) d.px(x, y, ((x + y) & 3) < 2 ? P.hz : P.bk);
  // near toe with a steel claw
  d.poly([9, 5, 22, 7, 28, 10, 26, 12, 10, 12], P.mrD);
  d.poly([9, 5, 22, 7, 24, 8.5, 10, 8], P.mr);
  d.px(12, 6, P.mrLL);
  d.poly([24, 7.5, 29, 9, 31, 13, 26, 12], P.stL);
  d.px(29, 10, P.stLL);
  d.px(30, 12, P.chrome);
  // sole tread
  d.rect(-15, 11, 41, 1.6, P.irD);
  for (let x = -13; x < 24; x += 4) d.px(x, 11, P.ir);
  // ankle housing + joint
  d.poly([-6, 1, 6, 1, 4, -3, -4, -3], P.stD);
  d.circle(0, 0, 5.2, P.stD);
  d.circle(-0.6, -0.6, 3.6, P.st);
  d.circle(0, 0, 1.6, P.br);
  d.px(-2, -2, P.stLL);
  for (const x of [-8, -2, 4]) bolt(base, x * K, 3 * KY, P.stLL, P.stDD);
}

// ------------------------------------------------------------------ joints

function drawJoint(p: PixelArt, r: number, P: LegPal, hip: boolean): void {
  const d = new JPen(p, r + 1, r + 1, 0);
  d.circle(0, 0, r, P.stD);
  d.circle(-0.5, -0.5, r - 1.2, P.st);
  d.circle(-1.2, -1.2, r - 3, P.stL);
  if (hip) {
    d.circle(0, 0, r - 2.5, P.mr);
    d.circle(-0.7, -0.7, r - 4, P.mrL);
    cog(d, 0, 0, 2.6);
  } else {
    d.circle(0, 0, 2.6, P.brD);
    d.circle(-0.5, -0.5, 1.8, P.br);
    d.px(-1, -1, P.brL);
  }
  const nb = hip ? 6 : 4;
  for (let i = 0; i < nb; i++) {
    const ang = (i / nb) * Math.PI * 2 + 0.4;
    d.px(Math.round(Math.cos(ang) * (r - 1.6)), Math.round(Math.sin(ang) * (r - 1.6)), P.stLL);
  }
}

// ------------------------------------------------------------------ registration

for (const [suffix, P] of [
  ['n', NEAR],
  ['f', FAR],
] as const) {
  sprites.define({
    name: `bm6_thigh_${suffix}`,
    w: SEG_C * 2,
    h: SEG_C * 2,
    ox: SEG_C,
    oy: SEG_C,
    frames: THIGH_N,
    draw: (p, f) => drawThigh(p, THIGH_A0 + f * SEG_STEP, P),
  });
  sprites.define({
    name: `bm6_shin_${suffix}`,
    w: SEG_C * 2,
    h: SEG_C * 2,
    ox: SEG_C,
    oy: SEG_C,
    frames: SHIN_N,
    draw: (p, f) => drawShin(p, SHIN_A0 + f * SEG_STEP, P),
  });
  sprites.define({
    name: `bm6_foot_${suffix}`,
    w: FOOT_C * 2,
    h: FOOT_C * 2,
    ox: FOOT_C,
    oy: FOOT_C,
    frames: FOOT_TILTS.length,
    draw: (p, f) => drawFoot(p, FOOT_TILTS[f], P),
  });
  sprites.define({ name: `bm6_hip_${suffix}`, w: 24, h: 24, ox: 12, oy: 12, draw: (p) => drawJoint(p, 11, P, true) });
  sprites.define({ name: `bm6_knee_${suffix}`, w: 20, h: 20, ox: 10, oy: 10, draw: (p) => drawJoint(p, 9, P, false) });
}
