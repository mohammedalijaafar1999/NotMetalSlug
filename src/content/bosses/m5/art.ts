// THUNDERHEAD (boss_m5) art: the Rustcoat Legion's flagship airship, as procedural pixel art.
// Everything is authored facing RIGHT (nose to the right), lit from the top-left, and flipped by the
// boss at draw time. Most part sprites share ONE origin - the envelope centre ("ship origin") - so
// they are all drawn at the same point and line up automatically (a flip mirrors around it).
//
// Art-space layout (x toward the nose, +y down, origin = envelope centre):
//   envelope  x -97..96, half-height 28 (nose cap x >= 64, storm core housed inside it)
//   fins      x -106..-50, up to y +-40; stabilizer along the centre line
//   gondola   x 8..87, y 33..58 (bridge windows at the front, broadside ports, bomb bay, struts)
//   turrets   dorsal fore (60,-36), dorsal aft (-12,-36), chin (70,66)  (ball centres)
//   engines   upper pod (-71,-8), lower pod (-71,25); propellers at x -88
//   hatch     drone hangar x 12..40, y 3..22 ;  bomb bay x 28..50, y 56

import { sprites } from '../../../engine/sprites';
import { colorToHex, type PixelArt } from '../../../engine/pixelart';
import { BC, Pen, cog, hash2, charr, hazardStripes } from '../common/kit';

// ------------------------------------------------------------------ palette

export const T5 = {
  env: BC.olive,
  envL: BC.oliveL,
  envLL: BC.oliveLL,
  envD: BC.oliveD,
  envDD: BC.oliveDD,
  envX: '#2a2614',
  hole: '#1a1512',
  girder: '#5a4a36',
  girderL: '#86704f',
  cream: '#e6d8aa',
  creamD: '#b4a472',
  cavity: '#120e1c',
  cavityL: '#221a34',
  coreW: '#ffffff',
  coreL: '#d4f6ff',
  core: '#8ce0ff',
  coreM: '#44b2f2',
  coreD: '#2766cc',
  coreDD: '#1c2a7a',
  arc: '#eefaff',
  arcB: '#86dcff',
  arcV: '#ae96ff',
  lamp: '#ff3a24',
  lampL: '#ffb090',
  lampOff: '#6a1c14',
} as const;

/** One step darker for the palette ramps (seams, scorch). */
const DARK: Record<string, string> = {
  [T5.envLL]: T5.envL,
  [T5.envL]: T5.env,
  [T5.env]: T5.envD,
  [T5.envD]: T5.envDD,
  [T5.envDD]: T5.envX,
  [T5.envX]: '#1e1b10',
  [BC.steelLL]: BC.steelL,
  [BC.steelL]: BC.steel,
  [BC.steel]: BC.steelD,
  [BC.steelD]: BC.steelDD,
  [BC.steelDD]: '#18171c',
  [BC.brassL]: BC.brass,
  [BC.brass]: BC.brassD,
  [BC.brassD]: '#5a3e12',
  [BC.rustL]: BC.rust,
  [BC.rust]: BC.rustD,
  [BC.rustD]: '#4a2010',
  [T5.cream]: T5.creamD,
  [T5.creamD]: '#857850',
};

const LIGHT: Record<string, string> = {};
for (const [k, v] of Object.entries(DARK)) if (!LIGHT[v]) LIGHT[v] = k;

type Stops = readonly (readonly [number, string])[];

/** Burnt-out wreck recolour: like the kit's charr() but with sparse embers (big sprites). */
export function scorch(p: PixelArt, seed: number): void {
  p.mapPixels((v, x, y) => {
    const r = v & 255;
    const g = (v >>> 8) & 255;
    const b = (v >>> 16) & 255;
    const lum = (r * 0.3 + g * 0.55 + b * 0.15) / 255;
    const n = hash2(x >> 1, y >> 1, seed);
    if (n < 0.005 && lum > 0.25) return n < 0.002 ? 0xff40b0ff : 0xff1a4ad8;
    const k = Math.round(26 + lum * 66 + (n - 0.5) * 12);
    const rr = Math.max(0, Math.min(255, k + 10));
    const gg = Math.max(0, Math.min(255, k + 3));
    const bb = Math.max(0, Math.min(255, k - 4));
    return ((255 << 24) | (bb << 16) | (gg << 8) | rr) >>> 0;
  });
}

/** Colour band lookup with a checkerboard dither just past each boundary. */
function band(v: number, x: number, y: number, stops: Stops, d = 0.07): string {
  for (let i = 0; i < stops.length; i++) {
    if (v < stops[i][0]) {
      if (i > 0 && v < stops[i - 1][0] + d && ((x + y) & 1) === 1) return stops[i - 1][1];
      return stops[i][1];
    }
  }
  return stops[stops.length - 1][1];
}

/** Pixel writer in art space (translation into the sprite canvas). */
class Art {
  constructor(
    readonly p: PixelArt,
    readonly tx: number,
    readonly ty: number,
  ) {}
  put(x: number, y: number, c: string): void {
    this.p.px(Math.floor(x) + this.tx, Math.floor(y) + this.ty, c);
  }
  get(x: number, y: number): string | null {
    const X = Math.floor(x) + this.tx + this.p.ox;
    const Y = Math.floor(y) + this.ty + this.p.oy;
    const v = this.p.getRaw(X, Y);
    return v >>> 24 ? colorToHex(v) : null;
  }
  darken(x: number, y: number, steps = 1): void {
    let c = this.get(x, y);
    if (!c) return;
    for (let i = 0; i < steps; i++) c = DARK[c] ?? c;
    this.put(x, y, c);
  }
  lighten(x: number, y: number): void {
    const c = this.get(x, y);
    if (c && LIGHT[c]) this.put(x, y, LIGHT[c]);
  }
  pen(): Pen {
    return new Pen(this.p, this.tx, this.ty);
  }
}

// ------------------------------------------------------------------ envelope geometry

/** Envelope half-height at art x (0 outside the hull). */
export function hullHalf(x: number): number {
  if (x > 96 || x < -97) return 0;
  if (x >= 52) {
    const t = (x - 52) / 44;
    return 28 * Math.sqrt(Math.max(0, 1 - t * t));
  }
  if (x >= -34) return 28;
  const t = Math.min(1, (-34 - x) / 62);
  return 28 - 23 * Math.pow(t, 1.6);
}

/** Envelope sprite frame: art x -110..97, y -42..42. */
const HX = 110;
const HY = 42;

/** Holes torn into the envelope (art x, y, radius): phase 1, then phase 2 adds more. */
export const HOLES1: readonly (readonly [number, number, number])[] = [
  [16, -13, 6],
  [-28, 10, 5],
  [-62, -7, 4],
];
export const HOLES2: readonly (readonly [number, number, number])[] = [
  [42, 13, 6],
  [-6, -17, 5],
  [-44, 15, 5],
  [54, -11, 4],
];

const HULL_STOPS: Stops = [
  [-0.8, T5.envL],
  [-0.46, T5.envLL],
  [-0.1, T5.envL],
  [0.38, T5.env],
  [0.72, T5.envD],
  [Infinity, T5.envDD],
];
const CAP_STOPS: Stops = [
  [-0.78, BC.steelL],
  [-0.4, BC.steelLL],
  [-0.02, BC.steelL],
  [0.44, BC.steel],
  [0.76, BC.steelD],
  [Infinity, BC.steelDD],
];
const RUST_STOPS: Stops = [
  [-0.5, BC.rustL],
  [0.4, BC.rust],
  [Infinity, BC.rustD],
];
const BRASS_STOPS: Stops = [
  [-0.45, BC.brassL],
  [0.35, BC.brass],
  [Infinity, BC.brassD],
];

/** Shading coordinate (-1 top .. 1 bottom), bent darker toward the nose and lighter at the tail. */
function hullV(x: number, yc: number, hh: number): number {
  let v = yc / hh;
  if (x > 52) v += Math.pow((x - 52) / 44, 2) * 0.6;
  if (x < -34) v -= ((-34 - x) / 62) * 0.2;
  return v;
}

function drawFins(a: Art, wreck: number): void {
  const d = a.pen();
  // Top fin (lit) and bottom fin (shadowed), drawn first so the envelope overlaps their roots.
  for (const s of [-1, 1]) {
    const pts = [-48, 25 * s, -82, 40 * s, -105, 40 * s, -105, 5 * s, -92, 4 * s];
    d.poly(pts, s < 0 ? T5.env : T5.envD);
    // Leading edge highlight and a dark spar line.
    for (let x = -82; x <= -49; x++) {
      const t = (x + 82) / 33;
      const y = Math.round((40 - 15 * t) * s);
      a.put(x, y + (s < 0 ? 1 : -1), s < 0 ? T5.envLL : T5.env);
    }
    for (let x = -100; x <= -60; x++) a.put(x, Math.round(22 * s - (x + 60) * 0.12 * s), s < 0 ? T5.envD : T5.envDD);
    // Rudder / elevator section with the Legion tail livery (rust + cream bands).
    for (let y = 5; y <= 40; y++) {
      for (let x = -105; x <= -96; x++) {
        const k = Math.floor((y - 5) / 6) % 2;
        let c: string = k ? T5.cream : BC.rust;
        if (x === -105) c = DARK[c];
        if (s > 0) c = DARK[c];
        a.put(x, y * s, c);
      }
    }
    for (let y = 5; y <= 40; y++) a.put(-95, y * s, s < 0 ? T5.envDD : T5.envX);
    // Tip rib.
    for (let x = -104; x <= -84; x++) a.put(x, 40 * s - s, s < 0 ? T5.envL : T5.envD);
  }
  if (wreck >= 2) {
    // A bite blown out of the top fin.
    for (let y = -40; y <= -30; y++) for (let x = -92; x <= -80; x++) if ((x + 92) * 0.8 + (y + 40) < 9 + hash2(x, y, 3) * 3) a.p.px(x + a.tx, y + a.ty, 0);
  }
}

function drawStabilizer(a: Art): void {
  const d = a.pen();
  d.poly([-56, -2, -106, -4, -110, -4, -110, 3, -106, 3, -56, 2], T5.env);
  for (let x = -108; x <= -57; x++) a.put(x, x < -100 ? -4 : -2 - Math.round((-56 - x) * 0.04), T5.envLL);
  for (let x = -108; x <= -57; x++) a.put(x, 2, T5.envD);
  for (let x = -109; x <= -100; x++) for (let y = -3; y <= 1; y++) a.put(x, y, y === -3 ? BC.rustL : y === 1 ? BC.rustD : BC.rust);
  for (let y = -3; y <= 2; y++) a.put(-99, y, T5.envX);
}

/** Torn hole: dark interior with girder lattice, ragged lit canvas edge and a scorch ring. */
function drawHole(a: Art, cx: number, cy: number, r: number, seed: number): void {
  const inHole = (x: number, y: number): boolean => {
    const d1 = Math.hypot(x - cx, (y - cy) * 1.15);
    const d2 = Math.hypot(x - (cx + r * 0.55), (y - (cy - r * 0.35)) * 1.15);
    const n = hash2(x, y, seed) * 1.1;
    return d1 < r - 0.6 + n || d2 < r * 0.62 + n;
  };
  const R = Math.ceil(r * 2.2);
  // Scorch ring first.
  for (let y = cy - R; y <= cy + R; y++) {
    for (let x = cx - R; x <= cx + R; x++) {
      if (!a.get(x, y) || inHole(x, y)) continue;
      const dd = Math.hypot(x - cx, y - cy);
      if (dd < r + 3.2 && ((x + y) & 1) === 0) a.darken(x, y, 2);
      else if (dd < r + 2) a.darken(x, y, 1);
    }
  }
  for (let y = cy - R; y <= cy + R; y++) {
    for (let x = cx - R; x <= cx + R; x++) {
      if (!a.get(x, y) || !inHole(x, y)) continue;
      let c: string = T5.hole;
      if ((x - y + 64) % 5 === 0) c = T5.girder;
      if (y === Math.round(cy) || (x + 64) % 7 === 0) c = (x + y) & 1 ? T5.girder : T5.girderL;
      // Ragged canvas edge: hole pixels touching hull pixels.
      const edge = !inHole(x - 1, y) || !inHole(x + 1, y) || !inHole(x, y - 1) || !inHole(x, y + 1);
      if (edge) c = !inHole(x, y - 1) && y < cy ? T5.envLL : T5.envDD;
      a.put(x, y, c);
    }
  }
}

function drawCapSeams(a: Art, glow: boolean): void {
  // Petal seams converging on the docking probe at the tip.
  for (const yk of [-21, -8, 6, 19]) {
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = 67 + (95 - 67) * t;
      const y = yk * (1 - t);
      const hh = hullHalf(x + 0.5);
      if (Math.abs(y) > hh - 1) continue;
      if (glow) {
        a.put(x, y, t > 0.2 && t < 0.9 && hash2(Math.floor(x), Math.floor(y), 9) < 0.7 ? T5.core : T5.coreD);
      } else {
        a.darken(x, y);
        a.lighten(x, y - 1);
      }
    }
  }
}

function drawEnvelope(p: PixelArt, frame: number): void {
  const a = new Art(p, HX, HY);
  const dmg = Math.min(frame, 2);
  drawFins(a, dmg);
  // Base fill.
  for (let x = -97; x <= 96; x++) {
    const hh = hullHalf(x + 0.5);
    if (hh <= 0.5) continue;
    for (let y = Math.floor(-hh); y <= Math.ceil(hh); y++) {
      const yc = y + 0.5;
      if (Math.abs(yc) > hh) continue;
      const v = hullV(x, yc, hh);
      let c: string;
      if (x >= 66) c = band(v, x, y, CAP_STOPS);
      else if (x >= 63) c = band(yc / hh, x, y, BRASS_STOPS);
      else if ((x >= -53 && x <= -47) || x === -44) c = x === -44 ? band(v, x, y, [[-0.4, T5.cream], [Infinity, T5.creamD]]) : band(v, x, y, RUST_STOPS);
      else c = band(v, x, y, HULL_STOPS);
      a.put(x, y, c);
    }
  }
  // Ring frames (vertical ribs) and their rivets.
  for (let rx = 58; rx > -92; rx -= 13) {
    if (rx >= -53 && rx <= -44) continue;
    const hh = hullHalf(rx + 0.5);
    for (let y = Math.floor(-hh) + 1; y < Math.ceil(hh) - 1; y++) {
      a.darken(rx, y);
      if ((y & 3) === 0 && Math.abs(y + 0.5) < hh - 3) a.lighten(rx + 1, y);
    }
  }
  // Longitudinal seams (follow the curvature) with a rivet line on the middle one.
  for (const sv of [-0.62, -0.14, 0.46]) {
    for (let x = -92; x <= 62; x++) {
      const hh = hullHalf(x + 0.5);
      const y = Math.round(sv * hh - 0.5);
      a.darken(x, y);
      if (sv < 0) a.lighten(x, y - 1);
      if (sv === -0.14 && (x & 3) === 0) a.put(x, y - 2, T5.envLL);
    }
  }
  // Brass ring rivets and the nose cap (seams, probe).
  for (let y = -24; y <= 24; y += 4) if (Math.abs(y) < hullHalf(64) - 2) a.put(64, y, BC.brassL);
  // Legion roundel: rust disc, cream ring, brass cog.
  const d = a.pen();
  d.circle(33.5, -2.5, 9.6, BC.rustD);
  d.circle(33.5, -2.5, 8.8, BC.rust);
  d.circle(32.5, -3.5, 6, BC.rustL);
  d.circle(33.5, -2.5, 6.6, T5.cream);
  d.circle(33.5, -2.5, 5.6, T5.creamD);
  cog(d, 33.5, -2.5, 4.1);
  // Radio mast with a beacon (the beacon blinks at runtime) near the nose.
  for (let y = -33; y <= -24; y++) a.put(74, y, y < -30 ? BC.steelL : BC.steel);
  for (let x = 72; x <= 77; x++) a.put(x, -30, BC.steelD);
  a.put(74, -34, T5.lamp);
  // Nose: cap seams (frames 0/1) or the blown-open storm-core cavity (frame 2+).
  if (dmg < 2) {
    drawCapSeams(a, dmg === 1);
    d.circle(94.6, 0, 2.6, BC.steelD);
    d.circle(94.2, -0.4, 1.7, BC.steel);
    a.put(93, -1, BC.steelLL);
    a.put(96, 0, BC.brass);
  } else {
    for (let x = 67; x <= 96; x++) {
      const hh = hullHalf(x + 0.5);
      for (let y = Math.floor(-hh); y <= Math.ceil(hh); y++) {
        const yc = y + 0.5;
        if (Math.abs(yc) > hh) continue;
        const stub = 2 + Math.floor(hash2(x >> 1, y > 0 ? 1 : 0, 11) * 3.2) - (x > 90 ? 1 : 0);
        if (Math.abs(yc) > hh - stub) continue;
        a.put(x, y, Math.abs(yc) > hh - stub - 1.2 ? T5.coreDD : T5.cavity);
      }
    }
    // Inner girders of the housing.
    for (const ang of [-1.1, -0.4, 0.4, 1.1]) {
      for (let r = 4; r < 22; r++) {
        const x = 80 - Math.cos(ang) * r * 0.6;
        const y = Math.sin(ang) * r;
        if (a.get(x, y) === T5.cavity) a.put(x, y, T5.cavityL);
      }
    }
  }
  // Battle damage.
  if (dmg >= 1) {
    HOLES1.forEach(([x, y, r], i) => drawHole(a, x, y, r, 21 + i));
    // Soot streaks blown back from the holes.
    for (const [hx, hy] of HOLES1) for (let k = 2; k < 18; k++) if (hash2(k, hy, 5) < 0.6) a.darken(hx - 4 - k, hy - 2 + (k & 1), 1);
  }
  if (dmg >= 2) {
    HOLES2.forEach(([x, y, r], i) => drawHole(a, x, y, r, 41 + i));
    for (const [hx, hy] of HOLES2) for (let k = 2; k < 22; k++) if (hash2(k, hy, 7) < 0.7) a.darken(hx - 4 - k, hy - 1 + (k % 3), 1);
  }
  drawStabilizer(a);
  // Tail cap.
  d.circle(-97.5, -0.5, 4.2, BC.steelD);
  d.circle(-98, -1, 3, BC.steel);
  a.put(-99, -2, BC.steelL);
  if (frame >= 3) scorch(p, 7);
}

sprites.define({
  name: 'bm5_envelope',
  w: 208,
  h: 85,
  ox: HX,
  oy: HY,
  frames: 4,
  draw: drawEnvelope,
});

// ------------------------------------------------------------------ gondola

/** Gondola sprite: art x 6..89, y 22..59 (sprite = art + (GX, GY); the ship origin lands at (GX, GY)). */
const GX = -6;
const GY = -22;

export const GONDOLA_POLY = [12, 33, 76, 33, 82, 35, 86, 40, 87, 46, 84, 52, 78, 56, 16, 57, 10, 52, 8, 44, 10, 36];
/** Broadside gun ports on the gondola side (art space). */
export const PORTS: readonly (readonly [number, number])[] = [
  [28, 49.5],
  [39, 49.5],
  [50, 49.5],
];
const G_STOPS: Stops = [
  [0.08, BC.steelLL],
  [0.3, BC.steelL],
  [0.72, BC.steel],
  [0.88, BC.steelD],
  [Infinity, BC.steelDD],
];

function drawGondola(p: PixelArt, frame: number): void {
  const a = new Art(p, GX, GY);
  const d = a.pen();
  const dmg = Math.min(frame, 2);
  // Struts and bracing cables up to the envelope.
  for (const sx of [16, 42, 68]) {
    const top = Math.floor(hullHalf(sx + 1)) - 2;
    for (let y = top; y <= 34; y++) {
      a.put(sx, y, BC.steel);
      a.put(sx + 1, y, BC.steelD);
    }
  }
  for (const [x0, x1] of [
    [18, 41],
    [44, 67],
  ])
    d.line(x0, 27, x1, 32, BC.steelD);
  // Hull fill.
  const tmp = new Pen(p, GX, GY);
  tmp.poly(GONDOLA_POLY, '#ffffff');
  for (let y = 30; y <= 58; y++) {
    for (let x = 6; x <= 88; x++) {
      if (a.get(x, y) !== '#ffffff') continue;
      let v = (y + 0.5 - 33) / 24;
      if (x > 81) v += 0.25;
      if (x < 11) v -= 0.12;
      a.put(x, y, band(v, x, y, G_STOPS));
    }
  }
  // Plate seams.
  for (const sx of [22, 34, 46, 58]) for (let y = 35; y <= 54; y++) a.darken(sx, y);
  for (let x = 10; x <= 85; x++) {
    a.put(x, 44, x % 4 === 0 ? BC.brassL : BC.brass);
    a.darken(x, 45);
  }
  // Keel band with rivets and the bomb-bay seams.
  for (let x = 12; x <= 80; x++) {
    a.put(x, 55, BC.steelDD);
    if (x % 4 === 1) a.put(x, 54, BC.steelL);
  }
  for (const bx of [28, 39, 50]) for (let y = 54; y <= 57; y++) a.put(bx, y, '#18171c');
  // Rear portholes.
  for (const px of [16, 24, 32, 40, 48]) {
    d.circle(px + 0.5, 39.5, 1.9, BC.brassD);
    a.put(px, 39, dmg >= 2 && px === 32 ? T5.hole : BC.amberD);
    a.put(px, 38, BC.brass);
  }
  // Bridge windows with crew silhouettes; the slanted windscreen at the nose.
  for (let x = 55; x <= 80; x++) {
    a.put(x, 35, BC.steelDD);
    a.put(x, 41, BC.steelDD);
  }
  const panes = [55, 61, 67, 73];
  panes.forEach((x0, i) => {
    const broken = (dmg >= 2 && (i === 1 || i === 3)) || (dmg >= 1 && i === 3 && false);
    for (let y = 36; y <= 40; y++) {
      for (let x = x0; x < x0 + 5; x++) {
        let c: string = y === 36 ? BC.amberL : y === 40 ? BC.amberD : BC.amber;
        if (x === x0 && y > 36) c = BC.amberL;
        if (broken) c = (x + y) % 3 === 0 ? T5.cream : T5.hole;
        a.put(x, y, c);
      }
    }
    if (!broken && (i === 1 || i === 2)) {
      // Crew: helmet + shoulders.
      a.put(x0 + 2, 38, BC.ironD);
      a.put(x0 + 3, 38, BC.ironD);
      a.put(x0 + 2, 39, BC.ironD);
      a.put(x0 + 3, 39, BC.ironD);
      for (let x = x0 + 1; x <= x0 + 4; x++) a.put(x, 40, BC.ironDD);
    }
    a.put(x0 + 5, 37, BC.steelD);
    a.put(x0 + 5, 38, BC.steelD);
    a.put(x0 + 5, 39, BC.steelD);
    a.put(x0 + 5, 40, BC.steelD);
  });
  d.poly([79, 35, 82, 35, 86, 41, 82, 41], dmg >= 2 ? T5.hole : BC.amber);
  a.put(80, 36, dmg >= 2 ? T5.cream : BC.amberL);
  if (dmg >= 1) {
    // Cracked pane.
    for (const [x, y] of [
      [56, 37],
      [57, 38],
      [58, 38],
      [59, 39],
      [57, 40],
    ] as const)
      a.put(x, y, T5.cream);
  }
  // Gun port covers (closed).
  for (const [px, py] of PORTS) {
    d.circle(px, py, 3.3, BC.steelDD);
    d.circle(px - 0.3, py - 0.3, 2.5, dmg >= 2 && px === 39 ? T5.hole : BC.steelD);
    a.put(px - 1, py - 1, BC.steelL);
  }
  // Brass name plate + cog on the rear section.
  d.rect(13, 47, 9, 4, BC.brassD);
  d.rect(14, 48, 7, 2, BC.brass);
  a.put(14, 48, BC.brassL);
  // Chin turret ring under the bridge.
  d.rect(64, 56, 13, 2, BC.steelD);
  // Running lights.
  a.put(85, 50, T5.lamp);
  // Damage: scorch + holes with hot rims.
  if (dmg >= 1) {
    for (let y = 46; y <= 56; y++) for (let x = 60; x <= 74; x++) if (hash2(x, y, 31) < 0.35) a.darken(x, y);
    for (let y = 34; y <= 43; y++) for (let x = 12; x <= 22; x++) if (hash2(x, y, 33) < 0.3) a.darken(x, y);
  }
  if (dmg >= 2) {
    for (const [hx, hy] of [
      [30, 38],
      [64, 50],
      [18, 52],
    ] as const) {
      d.circle(hx, hy, 2.6, BC.rustD);
      d.circle(hx, hy, 1.8, T5.hole);
      a.put(hx - 1, hy - 2, BC.hot);
    }
  }
  if (frame >= 3) scorch(p, 8);
}

sprites.define({
  name: 'bm5_gondola',
  w: 84,
  h: 38,
  ox: GX,
  oy: GY,
  frames: 4,
  draw: drawGondola,
});

// ------------------------------------------------------------------ engines & propellers

/** Engine nacelle (pod centre = origin). Frame 0 normal, 1 shot up / burning. */
sprites.define({
  name: 'bm5_engine',
  w: 36,
  h: 20,
  ox: 18,
  oy: 11,
  frames: 2,
  draw: (p, f) => {
    const a = new Art(p, 18, 11);
    const d = a.pen();
    // Pylon stub.
    d.rect(-4, -10, 7, 5, BC.steelD);
    d.rect(-4, -10, 7, 1, BC.steel);
    // Body capsule (white mask, then shaded).
    d.cap(-11, 0, 10, 0, 5.4, '#ffffff');
    d.tri(-11, -4.5, -11, 4.5, -16, 0, '#ffffff');
    for (let y = -6; y <= 6; y++) {
      for (let x = -17; x <= 17; x++) {
        if (a.get(x, y) !== '#ffffff') continue;
        const v = (y + 0.5) / 5.5;
        a.put(x, y, band(v, x, y, CAP_STOPS));
      }
    }
    // Cowling ring + spinner at the front (right).
    for (let y = -5; y <= 5; y++) {
      a.put(9, y, band((y + 0.5) / 5, 9, y, BRASS_STOPS));
      a.put(10, y, band((y + 0.5) / 5, 10, y, BRASS_STOPS));
    }
    d.tri(11, -4, 11, 4, 16, 0, BC.steelD);
    d.tri(11, -4, 11, 0, 15, 0, BC.steel);
    // Radiator grille.
    for (let x = 3; x <= 7; x += 2) for (let y = -2; y <= 2; y++) a.put(x, y, BC.steelDD);
    // Exhaust stacks.
    for (const ex of [-7, -3]) {
      a.put(ex, -6, BC.ironD);
      a.put(ex, -7, BC.iron);
      a.put(ex + 1, -6, BC.ironD);
      a.put(ex + 1, -7, BC.ironDD);
    }
    // Rivet line + red band.
    for (let x = -10; x <= 2; x += 3) a.put(x, -1, BC.steelLL);
    for (let y = -4; y <= 4; y++) a.put(-12, y, y < 0 ? BC.rustL : BC.rust);
    // Prop hub shaft.
    d.rect(-18, -1, 3, 2, BC.steelD);
    if (f === 1) {
      for (let y = -5; y <= 5; y++) for (let x = -12; x <= 10; x++) if (hash2(x, y, 51) < 0.4) a.darken(x, y, 2);
      d.circle(-2, 1, 2.2, T5.hole);
      a.put(-3, -1, BC.hot);
    }
  },
});

/** Pusher propeller seen edge-on: a blurred disc with a sweeping blade (frames 0-3), 4 = stopped. */
sprites.define({
  name: 'bm5_prop',
  w: 9,
  h: 34,
  ox: 4,
  oy: 17,
  frames: 5,
  outline: null,
  draw: (p, f) => {
    if (f === 4) {
      // Stopped: one bent blade.
      p.rect(4, 2, 2, 30, BC.steelD);
      p.rect(4, 2, 1, 30, BC.steel);
      p.rect(3, 15, 4, 4, BC.ironD);
      return;
    }
    for (let y = 0; y < 34; y++) {
      const dy = (y - 16.5) / 16.5;
      const half = Math.sqrt(Math.max(0, 1 - dy * dy)) * 3.6;
      for (let x = 0; x < 9; x++) {
        if (Math.abs(x - 4) > half) continue;
        const edge = Math.abs(x - 4) > half - 1.2;
        if (edge || (x + y + f) % 2 === 0) p.px(x, y, edge ? '#8a93a2' : (y + f) % 6 === 0 ? '#ffffff' : '#d2d8e2');
      }
    }
    const yb = [2, 9, 21, 27][f];
    p.rect(3, yb, 3, 5, BC.steelD);
    p.rect(3, yb, 1, 5, BC.steelL);
    p.rect(2, 15, 5, 4, BC.ironD);
    p.rect(3, 15, 3, 1, BC.steel);
  },
});

// ------------------------------------------------------------------ turrets

export const BALL_DIRS = 16;

/** Ball turret with twin barrels (frame k aims at k/16 turns; frame 16 = wrecked). Origin = ball centre. */
sprites.define({
  name: 'bm5_ball',
  w: 34,
  h: 34,
  ox: 17,
  oy: 17,
  frames: BALL_DIRS + 1,
  draw: (p, f) => {
    const d = new Pen(p, 17, 17);
    const wrecked = f >= BALL_DIRS;
    const a = ((wrecked ? 6 : f) / BALL_DIRS) * Math.PI * 2;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const len = wrecked ? 9 : 14;
    for (const s of [1.9, -1.9]) {
      const far = s > 0 === sn >= 0;
      d.cap(cs * 4 - sn * s, sn * 4 + cs * s, cs * len - sn * s, sn * len + cs * s, 1.1, far ? BC.steelDD : BC.steelD);
      d.cap(cs * (len - 1) - sn * s, sn * (len - 1) + cs * s, cs * len - sn * s, sn * len + cs * s, 1.5, far ? BC.steelD : BC.steel);
    }
    d.circle(0, 0, 7.6, BC.steelDD);
    d.circle(-0.3, -0.3, 6.9, BC.steelD);
    d.circle(-0.9, -0.9, 5.6, BC.steel);
    d.circle(-2.2, -2.3, 3, BC.steelL);
    d.px(-4, -4, BC.steelLL);
    d.px(-3, -5, BC.steelLL);
    // Brass collar.
    d.rect(-7, 1, 14, 2, BC.brass);
    d.rect(-7, 1, 3, 1, BC.brassL);
    d.rect(-7, 2, 14, 1, BC.brassD);
    // Gunner's vision slit (faces the aim).
    if (!wrecked) {
      d.circle(cs * 3.6, sn * 3.6 - 1, 1.5, BC.black);
      d.px(Math.floor(cs * 3.6), Math.floor(sn * 3.6 - 1), T5.lamp);
    } else {
      d.circle(1, -1, 2.6, T5.hole);
      charr(p, 12);
    }
  },
});

/** Turret mounts: 0 dorsal (base below the ball), 1 ventral (hanging above). Origin = ball centre. */
sprites.define({
  name: 'bm5_mount',
  w: 22,
  h: 30,
  ox: 11,
  oy: 15,
  frames: 2,
  draw: (p, f) => {
    const a = new Art(p, 11, 15);
    const s = f === 0 ? 1 : -1;
    const d = a.pen();
    d.poly([-6, 4 * s, 6, 4 * s, 9, 11 * s, -9, 11 * s], BC.steelD);
    d.poly([-5, 5 * s, 5, 5 * s, 7, 9 * s, -7, 9 * s], BC.steel);
    for (let x = -8; x <= 8; x++) a.put(x, 11 * s, BC.brassD);
    for (let x = -4; x <= 4; x++) a.put(x, 5 * s, BC.steelL);
    for (const x of [-6, -2, 2, 6]) a.put(x, 8 * s, BC.steelLL);
  },
});

// ------------------------------------------------------------------ hatch, bay, ports

/** Dorsal drone launch tube (origin = base centre on the envelope top): 0 capped, 1 open (red-lit), 2 firing. */
sprites.define({
  name: 'bm5_tube',
  w: 15,
  h: 17,
  ox: 7,
  oy: 14,
  frames: 3,
  draw: (p, f) => {
    const a = new Art(p, 7, 14);
    const d = a.pen();
    // Flange on the envelope.
    d.rect(-6, -2, 13, 3, BC.steelD);
    d.rect(-6, -2, 13, 1, BC.steel);
    // Barrel.
    for (let y = -11; y <= -2; y++)
      for (let x = -3; x <= 3; x++) a.put(x, y, x <= -2 ? BC.steelL : x >= 2 ? BC.steelD : BC.steel);
    for (let x = -3; x <= 3; x++) {
      a.put(x, -7, x <= -2 ? BC.brassL : BC.brass);
      a.put(x, -6, BC.brassD);
    }
    a.put(-1, -10, BC.steelLL);
    if (f === 0) {
      // Domed cap.
      d.rect(-4, -13, 9, 2, BC.steelD);
      d.rect(-3, -14, 7, 1, BC.steel);
      a.put(-3, -13, BC.steelL);
      hazardStripes(d, -3, -12, 7, 1, BC.hazard, BC.black, 4);
    } else {
      // Cap flipped back, red-lit mouth.
      d.rect(-4, -12, 9, 1, BC.steelDD);
      d.rect(-3, -12, 7, 1, f === 2 ? BC.hotL : '#8a1c14');
      a.put(0, -12, f === 2 ? '#ffffff' : T5.lamp);
      d.rect(-7, -16, 2, 5, BC.steelD);
      a.put(-7, -16, BC.steel);
    }
  },
});

/** Bomb-bay doors under the gondola: 0 closed, 1 swinging, 2 open with a mine in the rack. */
sprites.define({
  name: 'bm5_bay',
  w: 28,
  h: 14,
  ox: -26,
  oy: -55,
  frames: 3,
  draw: (p, f) => {
    const a = new Art(p, -26, -55);
    const d = a.pen();
    if (f === 0) {
      d.rect(28, 56, 23, 2, BC.steelD);
      hazardStripes(d, 28, 57, 23, 1, BC.hazard, BC.black, 4);
      return;
    }
    d.rect(29, 56, 21, 3, '#24100e');
    d.rect(30, 56, 19, 1, '#5a1c16');
    if (f === 2) {
      d.circle(39.5, 58.5, 2.6, BC.ironD);
      a.put(38, 57, BC.ironLL);
      a.put(39, 56, T5.lamp);
    }
    if (f === 1) {
      d.cap(29, 57, 35, 63, 1, BC.steelD);
      d.cap(50, 57, 44, 63, 1, BC.steelD);
      a.put(34, 62, BC.hazard);
      a.put(45, 62, BC.hazard);
    } else {
      d.rect(28, 57, 2, 11, BC.steelD);
      d.rect(49, 57, 2, 11, BC.steelD);
      a.put(28, 57, BC.steel);
      a.put(49, 57, BC.steel);
      for (let y = 59; y < 68; y += 2) {
        a.put(28, y, BC.hazard);
        a.put(50, y, BC.hazard);
      }
    }
  },
});

/** Broadside gun port: 0 closed iris, 1 open with a run-out barrel, 2 glowing (about to fire). Origin = centre. */
sprites.define({
  name: 'bm5_port',
  w: 14,
  h: 11,
  ox: 5,
  oy: 5,
  frames: 3,
  draw: (p, f) => {
    const d = new Pen(p, 5, 5);
    d.circle(0, 0, 4.2, BC.steelDD);
    if (f === 0) {
      d.circle(-0.3, -0.3, 3.3, BC.steelD);
      d.line(-2, 0, 2, 0, BC.steel);
      d.line(0, -2, 0, 2, BC.steel);
      d.px(-2, -2, BC.steelL);
      return;
    }
    d.circle(0, 0, 3.4, BC.brassD);
    d.circle(-0.3, -0.3, 2.6, BC.brass);
    // Barrel run out toward the nose (screen: toward the player).
    d.rect(1, -2, 5, 4, BC.steelDD);
    d.rect(1, -2, 5, 1, BC.steelL);
    d.rect(1, -1, 5, 2, BC.steel);
    d.rect(5, -3, 3, 6, BC.steelD);
    d.rect(5, -3, 3, 1, BC.steel);
    d.px(7, -1, f === 2 ? BC.glow : '#0e0a10');
    d.px(7, 0, f === 2 ? BC.hot : '#0e0a10');
    if (f === 2) {
      d.px(8, -1, BC.hotL);
      d.px(8, 0, BC.hot);
    }
    d.px(-2, -2, BC.brassL);
  },
});

// ------------------------------------------------------------------ storm core

/** Exposed storm core in the nose cavity: 0-3 crackling idle, 4 charged. Origin = core centre. */
export const CORE_POS = [80, 0] as const;
sprites.define({
  name: 'bm5_core',
  w: 40,
  h: 48,
  ox: 20,
  oy: 24,
  frames: 5,
  outline: null,
  draw: (p, f) => {
    const d = new Pen(p, 20, 24);
    const charged = f === 4;
    // Brass electrodes reaching in from the housing (top, bottom, rear-top, rear-bottom).
    const prongs = [
      [-1.75, 22],
      [1.75, 22],
      [-2.5, 19],
      [2.5, 19],
    ] as const;
    for (const [ang, len] of prongs) {
      const cx = Math.cos(ang);
      const sy = Math.sin(ang);
      d.cap(cx * len, sy * len, cx * 13, sy * 13, 1.6, BC.brassD);
      d.cap(cx * len, sy * len, cx * 14, sy * 14, 0.9, BC.brass);
      d.circle(cx * 13, sy * 13, 1.8, charged ? T5.coreL : BC.brassL);
    }
    // Halo.
    const R = charged ? 12.5 : 11;
    for (let y = -17; y <= 17; y++)
      for (let x = -17; x <= 17; x++) {
        const r = Math.hypot(x + 0.5, y + 0.5);
        if (r > R && r < R + 3.2 && ((x + y + f) & 1) === 0) d.px(x, y, r < R + 1.6 ? T5.coreM : T5.coreD);
      }
    d.circle(0, 0, R + 0.6, T5.coreDD);
    d.circle(0, 0, R, T5.coreD);
    d.circle(-0.6, -0.6, R - 1.6, T5.coreM);
    d.circle(-1.4, -1.4, R - 4, T5.core);
    d.circle(-2, -2, R - 6.5, T5.coreL);
    d.circle(-2.6, -2.6, charged ? 4 : 2.4, T5.coreW);
    // Swirling filaments.
    for (let k = 0; k < 3; k++) {
      const a0 = f * 0.9 + k * 2.1;
      for (let t = 0; t < 1; t += 0.05) {
        const rr = 2 + t * (R - 3);
        const aa = a0 + t * 2.4;
        d.px(Math.round(Math.cos(aa) * rr), Math.round(Math.sin(aa) * rr), k === 0 ? T5.coreW : T5.coreL);
      }
    }
    // Arcs jumping to one or two electrodes.
    const arcs = charged ? [0, 1, 2, 3] : [[0], [2], [1, 3], [3]][f];
    for (const i of arcs) {
      const [ang] = prongs[i];
      let px = Math.cos(ang) * (R - 1);
      let py = Math.sin(ang) * (R - 1);
      const tx = Math.cos(ang) * 13;
      const ty = Math.sin(ang) * 13;
      for (let s = 1; s <= 4; s++) {
        const t = s / 4;
        const jx = Math.cos(ang) * (R - 1 + (14 - R) * t) + (s < 4 ? (hash2(i, s, f) - 0.5) * 3 : 0);
        const jy = Math.sin(ang) * (R - 1 + (14 - R) * t) + (s < 4 ? (hash2(s, i, f + 7) - 0.5) * 3 : 0);
        d.line(px, py, s === 4 ? tx : jx, s === 4 ? ty : jy, T5.arc);
        px = jx;
        py = jy;
      }
    }
  },
});

// ------------------------------------------------------------------ projectiles

/** Aerial contact mine (spiked ball): 0 lamp dark, 1 lamp lit. Origin = centre. */
sprites.define({
  name: 'bm5_mine',
  w: 13,
  h: 13,
  ox: 6,
  oy: 6,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p, 6, 6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      d.line(Math.cos(a) * 3, Math.sin(a) * 3, Math.cos(a) * 5.4, Math.sin(a) * 5.4, BC.steelD);
      d.px(Math.round(Math.cos(a) * 5.4), Math.round(Math.sin(a) * 5.4), BC.brass);
    }
    d.circle(0, 0, 4, BC.rustD);
    d.circle(-0.4, -0.4, 3.3, BC.rust);
    d.circle(-1.3, -1.3, 1.6, BC.rustL);
    d.px(-2, -2, '#ffc890');
    d.rect(-3, 1, 7, 1, BC.hazard);
    d.px(-3, 1, BC.hazardD);
    d.px(0, -3, f ? T5.lampL : T5.lampOff);
    d.px(1, -3, f ? T5.lamp : T5.lampOff);
  },
});

/** Mine parachute: 0 packed, 1 opening, 2/3 open (sway). Origin = the mine attach point. */
sprites.define({
  name: 'bm5_chute',
  w: 19,
  h: 14,
  ox: 9,
  oy: 14,
  frames: 4,
  draw: (p, f) => {
    const d = new Pen(p, 9, 14);
    if (f === 0) {
      d.rect(-2, -6, 4, 4, T5.creamD);
      d.rect(-2, -6, 4, 1, T5.cream);
      d.line(0, -2, 0, -1, BC.ironD);
      return;
    }
    const w = f === 1 ? 4 : 8;
    const sway = f === 3 ? 1 : 0;
    const top = f === 1 ? -11 : -13;
    // Shroud lines.
    d.line(-w + sway, top + 4, 0, -1, BC.ironLL);
    d.line(w + sway, top + 4, 0, -1, BC.ironLL);
    if (f > 1) d.line(sway, top + 4, 0, -1, BC.ironLL);
    // Canopy with alternating gores.
    for (let x = -w; x <= w; x++) {
      const hgt = Math.round(Math.sqrt(Math.max(0, 1 - (x / (w + 0.6)) ** 2)) * (f === 1 ? 4 : 5));
      for (let y = 0; y <= hgt; y++) {
        const gore = Math.floor((x + w) / 3) % 2;
        let c: string = gore ? BC.rust : T5.cream;
        if (y === hgt) c = gore ? BC.rustL : '#fff6d8';
        if (y === 0) c = gore ? BC.rustD : T5.creamD;
        d.px(x + sway, top + 4 - y, c);
      }
    }
  },
});

/** Heavy broadside shell (points right): 2 frames of tail flicker. Origin = centre. */
sprites.define({
  name: 'bm5_shell',
  w: 13,
  h: 7,
  ox: 6,
  oy: 3,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p, 6, 3);
    d.rect(-3, -2, 7, 5, BC.brassD);
    d.rect(-3, -2, 7, 1, BC.brassL);
    d.rect(-3, -1, 7, 2, BC.brass);
    d.poly([4, -2, 7, 0, 7, 1, 4, 3], BC.hot);
    d.px(5, -1, BC.glow);
    d.rect(-4, -2, 1, 5, BC.rustD);
    d.rect(-6, -1, 2, 3, f ? BC.hotL : BC.hot);
    if (f) d.px(-7, 0, BC.glow);
  },
});

// ------------------------------------------------------------------ debris

/** Breakaway pieces: 0-1 envelope canvas + girder, 2-3 nose-cap petals, 4 gondola plate. */
sprites.define({
  name: 'bm5_debris',
  w: 14,
  h: 12,
  ox: 7,
  oy: 6,
  frames: 5,
  draw: (p, f) => {
    const d = new Pen(p, 7, 6);
    if (f === 0) {
      d.poly([-6, -3, 5, -5, 6, 2, -2, 5, -6, 2], T5.env);
      d.poly([-5, -3, 4, -4, 4, -2, -5, -1], T5.envLL);
      d.line(-4, 4, 4, -4, T5.girder);
    } else if (f === 1) {
      d.rect(-6, -1, 13, 3, T5.girder);
      d.rect(-6, -1, 13, 1, T5.girderL);
      for (let x = -5; x < 6; x += 3) d.line(x, 1, x + 2, -1, T5.envDD);
    } else if (f === 2 || f === 3) {
      const s = f === 2 ? 1 : -1;
      d.poly([-6, -4 * s, 6, -2 * s, 4, 4 * s, -5, 3 * s], BC.steel);
      d.poly([-5, -3 * s, 5, -1.5 * s, 4, 0, -5, 0], BC.steelL);
      d.px(-3, -2 * s, BC.steelLL);
      d.line(-5, 3 * s, 4, 4 * s, BC.brass);
    } else {
      d.rect(-6, -4, 12, 8, BC.steelD);
      d.rect(-6, -4, 12, 2, BC.steel);
      d.px(-4, -3, BC.steelLL);
      d.px(3, 1, BC.steelL);
      d.rect(-6, 2, 12, 1, BC.brass);
    }
  },
});
