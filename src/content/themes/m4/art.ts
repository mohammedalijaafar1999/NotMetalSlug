// Mission 4 (RUSTWATER DOCKS) theme art: palette, terrain textures, parallax layers and the
// platform renderer. Everything here is pure PixelArt (no DOM) except the platform renderer,
// which draws straight onto the world canvas.
//
// Look: a ruined harbour city at dusk in the rain. Far = rosy haze and purple silhouettes with
// lit windows; mid = moored freighters and gantry cranes over a glinting basin; near = dark
// warehouse roofs, lamp posts and container stacks. The playfield is wet granite quays topped
// with a concrete curb, brick warehouses and steel catwalks; actors (olive, khaki, colourful
// players) stay the brightest, most saturated things on screen.

import { PixelArt, mixColor, shade, parseColor } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';

// ------------------------------------------------------------------ palette

export const P4 = {
  // Sky (top -> horizon).
  sky: ['#1a1430', '#2a1c46', '#43275a', '#6a3262', '#9c4460', '#cc6052', '#ec8a52', '#f6b062'],
  haze: '#b06070',
  // Clouds.
  cloudD: '#2a2040',
  cloud: '#3a2c50',
  cloudM: '#4c3a62',
  cloudL: '#624a74',
  cloudRim: '#a0566c',
  cloudGlow: '#d47a5c',
  // Far skyline.
  city: '#46305e',
  cityL: '#5a3e6e',
  cityD: '#3a2850',
  win: '#f2b866',
  winD: '#c88a52',
  winL: '#ffe0a0',
  // Mid harbour.
  harb: '#2e2444',
  harbL: '#43345a',
  harbD: '#241c38',
  sea: '#271e3c',
  seaGlint: '#c0705a',
  seaGlint2: '#e0a070',
  // Near.
  near: '#1e1828',
  nearL: '#3a2a46',
  nearRim: '#6a3c58',
  lamp: '#ffd690',
  lampGlow: '#ffb868',
  red: '#ff4038',
  // Terrain.
  mortar: '#1c1826',
  stone: '#423e56',
  algae: '#2e3e3c',
  curb: '#a8a4c0',
  pave: '#6c6884',
  paveD: '#4e4a64',
  joint: '#34304a',
  reflect: '#e0a878',
  reflect2: '#9a88b8',
  brick: '#6a3c38',
  brickMortar: '#2a2030',
  coping: '#8a8498',
  // Wood / steel.
  wood: '#6a4e3a',
  woodL: '#9a7656',
  woodD: '#3e2c24',
  steel: '#6a7488',
  steelL: '#a4aec0',
  steelD: '#3a4052',
  rust: '#8a4a2e',
  // Water.
  water: '#0f1c2a',
  waterSurf: '#7090b4',
} as const;

const T0 = 'transparent';

/** Deterministic 0..1 hash of two ints. */
export function hash01(a: number, b = 0, seed = 0): number {
  let h = (a * 374761393 + b * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ terrain textures

/** Granite quay-wall masonry (ground fill). Tileable 32x32. */
export function quayTile(): PixelArt {
  const W = 32;
  const H = 32;
  const p = new PixelArt(W, H);
  p.rect(0, 0, W, H, P4.mortar);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 8 : 0;
    for (let col = -1; col < 2; col++) {
      const x = col * 16 + off;
      const y = row * 8;
      // Key the colour by the wrapped brick so tiles have no seam.
      const key = (((x % W) + W) % W) / 8;
      const r = new Rng(row * 31 + key * 7 + 5);
      const c = shade(P4.stone, r.range(-0.12, 0.08));
      p.rect(x + 1, y + 1, 15, 7, c);
      p.rect(x + 1, y + 1, 15, 1, shade(c, 0.16));
      p.rect(x + 1, y + 2, 1, 5, shade(c, 0.07));
      p.rect(x + 1, y + 7, 15, 1, shade(c, -0.22));
      p.rect(x + 15, y + 2, 1, 5, shade(c, -0.12));
      for (let i = 0; i < 4; i++) p.px(x + r.int(2, 14), y + r.int(2, 6), shade(c, r.chance(0.5) ? -0.14 : 0.1));
      if (r.chance(0.35)) {
        // Wet algae stain creeping down from the joint.
        const ax = x + r.int(3, 12);
        p.rect(ax, y + 1, r.int(2, 4), 1, P4.algae);
        p.px(ax + 1, y + 2, P4.algae);
      }
      if (r.chance(0.25)) {
        // Crack.
        const cx = x + r.int(4, 12);
        p.px(cx, y + 2, shade(c, -0.35));
        p.px(cx + 1, y + 3, shade(c, -0.35));
        p.px(cx + 1, y + 4, shade(c, -0.3));
      }
    }
  }
  return p;
}

/** Ground top edge: weeds/debris above, a wet concrete curb with puddle glints, pavement, joint. */
export const EDGE_UP = 2;
export function curbEdge(): PixelArt {
  const W = 64;
  const H = EDGE_UP + 9;
  const p = new PixelArt(W, H);
  const r = new Rng(77);
  const u = EDGE_UP;
  for (let x = 0; x < W; x++) {
    // Surface row: wet curb highlight with puddle stretches.
    const puddle = (x >= 9 && x < 17) || (x >= 40 && x < 51);
    p.px(x, u, puddle ? (x % 5 === 2 ? P4.reflect : P4.reflect2) : P4.curb);
    const c1 = shade(P4.pave, r.range(-0.06, 0.06));
    p.px(x, u + 1, puddle ? shade(P4.paveD, -0.2) : shade(P4.curb, -0.18));
    p.px(x, u + 2, c1);
    p.px(x, u + 3, c1);
    p.px(x, u + 4, shade(P4.paveD, r.range(-0.05, 0.05)));
    p.px(x, u + 5, P4.joint);
    // Ragged transition into the masonry below.
    if (r.chance(0.55)) p.px(x, u + 6, P4.mortar);
    if (r.chance(0.2)) p.px(x, u + 7, shade(P4.stone, -0.25));
  }
  // Slab joints.
  for (const jx of [0, 23, 47]) {
    p.px(jx, u + 1, P4.joint);
    p.px(jx, u + 2, P4.joint);
    p.px(jx, u + 3, P4.joint);
    p.px(jx + 1, u + 2, shade(P4.pave, 0.12));
  }
  // Specks and puddle sheen.
  for (let i = 0; i < 18; i++) p.px(r.int(0, W - 1), u + r.int(2, 4), shade(P4.pave, r.chance(0.5) ? 0.16 : -0.16));
  for (const [x0, x1] of [
    [9, 17],
    [40, 51],
  ]) {
    for (let x = x0 + 1; x < x1 - 1; x += 2) p.px(x, u + 2, shade(P4.reflect2, -0.25));
    p.px(x0 + 2, u + 3, P4.reflect);
  }
  // Debris above the line: pebbles and a couple of weed tufts.
  for (let i = 0; i < 5; i++) {
    const x = r.int(1, W - 2);
    p.px(x, u - 1, shade(P4.pave, -0.1));
  }
  for (const wx of [30, 58]) {
    p.px(wx, u - 1, '#4a5a44');
    p.px(wx + 1, u - 2, '#5e7052');
    p.px(wx + 2, u - 1, '#4a5a44');
  }
  return p;
}

/** Warehouse brick (solid blocks). Tileable 32x16. */
export function warehouseBrick(): PixelArt {
  const W = 32;
  const H = 16;
  const p = new PixelArt(W, H);
  p.rect(0, 0, W, H, P4.brickMortar);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 4 : 0;
    for (let col = -1; col < 4; col++) {
      const x = col * 8 + off;
      const y = row * 4;
      const key = (((x % W) + W) % W) / 4;
      const r = new Rng(row * 13 + key * 3 + 9);
      let c = shade(P4.brick, r.range(-0.14, 0.08));
      if (r.chance(0.12)) c = shade(c, -0.3); // soot-dark brick
      p.rect(x + 1, y + 1, 7, 3, c);
      p.rect(x + 1, y + 1, 7, 1, shade(c, 0.14));
      p.px(x + 7, y + 3, shade(c, -0.2));
    }
  }
  return p;
}

/** Concrete coping on top of solid blocks. */
export function copingEdge(): PixelArt {
  const p = new PixelArt(32, 5);
  for (let x = 0; x < 32; x++) {
    p.px(x, 0, shade(P4.coping, 0.25));
    p.px(x, 1, P4.coping);
    p.px(x, 2, shade(P4.coping, -0.12));
    p.px(x, 3, shade(P4.coping, -0.38));
    if (x % 2 === 0) p.px(x, 4, P4.brickMortar);
  }
  p.px(0, 1, shade(P4.coping, -0.3));
  p.px(16, 1, shade(P4.coping, -0.3));
  return p;
}

// ------------------------------------------------------------------ parallax layers

export interface LightSpot {
  x: number;
  y: number;
  /** Blink phase offset (s) and period (s). */
  phase: number;
  period: number;
  color: string;
}

export interface LayerArt {
  art: PixelArt;
  lights: LightSpot[];
}

function wrapRect(p: PixelArt, x: number, y: number, w: number, h: number, c: string): void {
  p.rect(x, y, w, h, c);
  if (x + w > p.w) p.rect(x - p.w, y, w, h, c);
  if (x < 0) p.rect(x + p.w, y, w, h, c);
}

function wrapPx(p: PixelArt, x: number, y: number, c: string): void {
  p.px(((Math.floor(x) % p.w) + p.w) % p.w, y, c);
}

/** Heavy rain clouds with sunset-lit undersides. `lit` = lightning-lit variant. */
export function cloudArt(lit = false): PixelArt {
  const W = 480;
  const H = 96;
  const p = new PixelArt(W, H);
  const r = new Rng(404);
  const tone = (c: string) => (lit ? mixColor(c, '#d8d0f0', 0.42) : c);
  // Overcast band across the top.
  const blobs: [number, number, number, number][] = [];
  for (let i = 0; i < 22; i++) blobs.push([r.int(0, W - 1), r.int(-6, 16), r.range(26, 52), r.range(12, 20)]);
  // Lower, separate cloud banks.
  for (let i = 0; i < 7; i++) blobs.push([r.int(0, W - 1), r.int(36, 62), r.range(18, 40), r.range(6, 11)]);
  const ell = (cx: number, cy: number, rx: number, ry: number, c: string) => {
    for (const o of [-W, 0, W]) p.ellipse(cx + o, cy, rx, ry, c);
  };
  // Rim (underlit) first, offset down; then the body over it.
  for (const [cx, cy, rx, ry] of blobs) ell(cx, cy + 3, rx, ry, tone(cy > 30 ? P4.cloudGlow : P4.cloudRim));
  for (const [cx, cy, rx, ry] of blobs) ell(cx, cy + 1, rx, ry, tone(P4.cloudM));
  for (const [cx, cy, rx, ry] of blobs) ell(cx, cy, rx - 1, ry - 1, tone(P4.cloud));
  for (const [cx, cy, rx, ry] of blobs) ell(cx - rx * 0.25, cy - ry * 0.45, rx * 0.5, ry * 0.35, tone(P4.cloudL));
  // Dithered dark cores give the clouds weight.
  for (const [cx, cy, rx, ry] of blobs) {
    if (cy > 30) continue;
    for (let y = Math.floor(cy - ry * 0.2); y < cy + ry * 0.4; y++)
      for (let x = Math.floor(cx - rx * 0.6); x < cx + rx * 0.6; x++) if ((x + y) % 2 === 0) wrapPx(p, x, y, tone(P4.cloudD));
  }
  // Ragged rain curtains hanging from the lower banks.
  for (let i = 0; i < 26; i++) {
    const x = r.int(0, W - 1);
    const y0 = r.int(56, 72);
    const len = r.int(6, 18);
    for (let y = y0; y < Math.min(H, y0 + len); y += 2) wrapPx(p, x + (y - y0) * -0.3, y, tone(P4.cloudM) + '88');
  }
  return p;
}

/** Far ruined skyline with lit windows, water towers and antennas (red beacons blink). */
export function skylineArt(): LayerArt {
  const W = 512;
  const H = 112;
  const p = new PixelArt(W, H);
  const lights: LightSpot[] = [];
  const r = new Rng(9001);
  let x = 0;
  while (x < W) {
    const bw = r.int(14, 40);
    const tall = r.chance(0.18);
    const bh = tall ? r.int(70, 100) : r.int(26, 64);
    const top = H - bh;
    const c = shade(P4.city, r.range(-0.06, 0.05));
    wrapRect(p, x, top, bw, bh, c);
    // Lit left edge (rim from the sunset glow).
    wrapRect(p, x, top, 1, bh, shade(c, 0.12));
    // Roof furniture.
    const roof = r.int(0, 5);
    if (roof === 0 && bw > 18) {
      // Water tower on stilts.
      const tx = x + r.int(3, bw - 12);
      wrapRect(p, tx + 1, top - 5, 1, 5, c);
      wrapRect(p, tx + 7, top - 5, 1, 5, c);
      wrapRect(p, tx, top - 11, 9, 6, c);
      wrapRect(p, tx + 1, top - 13, 7, 2, c);
    } else if (roof === 1 || tall) {
      // Antenna with a red beacon.
      const ax = x + Math.floor(bw / 2);
      const ah = r.int(8, 16);
      wrapRect(p, ax, top - ah, 1, ah, c);
      lights.push({ x: ax, y: top - ah - 1, phase: r.range(0, 2), period: r.range(1.4, 2.2), color: P4.red });
    } else if (roof === 2) {
      // Ruined: bites out of the roofline.
      for (let k = 0; k < 3; k++) {
        const bx = x + r.int(0, bw - 6);
        const d = r.int(3, 9);
        for (let yy = 0; yy < d; yy++) wrapRect(p, bx + yy, top + yy, r.int(3, 6), 1, T0);
      }
    } else if (roof === 3) {
      // Chimney.
      wrapRect(p, x + bw - 6, top - 9, 3, 9, c);
    }
    // Windows (some floors dark - power is out across half the city).
    const big = bw > 24;
    for (let wy = top + 4; wy < H - 4; wy += 4) {
      const floorLit = r.chance(0.55);
      for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
        if (floorLit && r.chance(0.32)) {
          const wc = r.pick([P4.win, P4.win, P4.winD, P4.winL]);
          wrapPx(p, wx, wy, wc);
          if (big) wrapPx(p, wx, wy + 1, shade(wc, -0.25));
        } else if (r.chance(0.3)) wrapPx(p, wx, wy, P4.cityD);
      }
    }
    x += bw + (r.chance(0.3) ? r.int(1, 4) : 0);
  }
  // A clock tower and a spire as landmarks.
  const ct = 300;
  wrapRect(p, ct, H - 92, 12, 92, P4.cityL);
  wrapRect(p, ct + 1, H - 100, 10, 8, P4.cityL);
  p.tri(ct, H - 100, ct + 12, H - 100, ct + 6, H - 110, P4.cityL);
  p.circle(ct + 6, H - 84, 3, P4.winD);
  p.px(ct + 6, H - 85, P4.cityD);
  p.px(ct + 7, H - 84, P4.cityD);
  lights.push({ x: ct + 6, y: H - 111, phase: 0.6, period: 1.8, color: P4.red });
  // Haze: fade the lower part toward the glowing horizon.
  const haze = parseColor(P4.haze);
  p.mapPixels((v, _x, y) => {
    const t = Math.max(0, (y - (H - 34)) / 34) * 0.42;
    if (t <= 0) return v;
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
    const rr = mix(v & 255, haze & 255);
    const gg = mix((v >>> 8) & 255, (haze >>> 8) & 255);
    const bb = mix((v >>> 16) & 255, (haze >>> 16) & 255);
    return ((v >>> 24) << 24) | (bb << 16) | (gg << 8) | rr;
  });
  return { art: p, lights };
}

/** Mid layer: freighters at berth, a ship-to-shore gantry crane, a jib crane, a tug, the basin. */
export function harbourArt(): LayerArt {
  const W = 640;
  const H = 124;
  const p = new PixelArt(W, H);
  const lights: LightSpot[] = [];
  const r = new Rng(777);
  const C = P4.harb;
  const L = P4.harbL;
  const D = P4.harbD;
  const SEA = H - 14;
  // Distant warehouses along the far quay.
  for (let x = 0; x < W; ) {
    const bw = r.int(20, 54);
    const bh = r.int(8, 18);
    wrapRect(p, x, SEA - bh, bw, bh, D);
    if (r.chance(0.5)) for (let k = x + 3; k < x + bw - 3; k += 4) wrapPx(p, k, SEA - bh + 3, P4.winD);
    x += bw + r.int(0, 6);
  }
  // Freighter 1 (bow to the right).
  const ship = (sx: number, len: number, seed: number) => {
    const sr = new Rng(seed);
    const hullTop = SEA - 20;
    p.poly([sx, hullTop, sx + len, hullTop - 4, sx + len - 10, SEA + 2, sx + 6, SEA + 2], C);
    p.rect(sx + 2, hullTop + 2, len - 8, 1, L);
    // Waterline stripe.
    p.rect(sx + 6, SEA - 3, len - 16, 2, shade(P4.rust, -0.45));
    // Superstructure at the stern.
    p.rect(sx + 8, hullTop - 26, 26, 26, C);
    p.rect(sx + 6, hullTop - 30, 32, 4, C);
    p.rect(sx + 8, hullTop - 26, 1, 26, L);
    for (let wy = hullTop - 22; wy < hullTop - 4; wy += 5)
      for (let wx = sx + 11; wx < sx + 32; wx += 4) if (sr.chance(0.55)) p.px(wx, wy, sr.chance(0.7) ? P4.win : P4.winL);
    // Funnel.
    p.rect(sx + 18, hullTop - 40, 9, 10, C);
    p.rect(sx + 18, hullTop - 36, 9, 2, shade(P4.rust, -0.3));
    // Containers on deck.
    const cols = ['#4a3444', '#3a3854', '#4c3c3c', '#36404a', '#4a4038'];
    for (let cx = sx + 44; cx < sx + len - 26; cx += 13) {
      const n = sr.int(1, 4);
      for (let k = 0; k < n; k++) {
        const cc = sr.pick(cols);
        p.rect(cx, hullTop - 6 - k * 6, 12, 6, cc);
        p.rect(cx, hullTop - 6 - k * 6, 12, 1, shade(cc, 0.15));
      }
    }
    // Masts with lights.
    p.rect(sx + len - 18, hullTop - 34, 1, 32, C);
    p.rect(sx + len - 22, hullTop - 26, 9, 1, C);
    lights.push({ x: sx + len - 18, y: hullTop - 35, phase: sr.range(0, 2), period: 2.4, color: P4.red });
    lights.push({ x: sx + 22, y: hullTop - 41, phase: sr.range(0, 2), period: 3.1, color: '#ffffff' });
    p.px(sx + len - 12, hullTop - 6, P4.winL);
  };
  ship(18, 230, 31);
  ship(430, 170, 57);
  // Ship-to-shore gantry crane straddling the berth.
  const gx = 270;
  const legTop = SEA - 78;
  for (const lx of [gx, gx + 46]) {
    p.rect(lx, legTop, 4, 78, C);
    p.rect(lx, legTop, 1, 78, L);
    for (let y = legTop + 6; y < SEA - 4; y += 12) {
      p.line(lx + 1, y, lx + 3, y + 10, D);
    }
  }
  p.rect(gx - 2, SEA - 44, 54, 3, C); // portal beam
  p.rect(gx - 2, legTop, 54, 4, C);
  // Boom out over the water (raised forward boom) and the back girder.
  p.rect(gx - 120, legTop - 4, 200, 4, C);
  p.rect(gx - 120, legTop - 4, 200, 1, L);
  for (let x = gx - 118; x < gx + 78; x += 8) p.line(x, legTop - 3, x + 4, legTop - 1, D);
  // Apex frame + stays.
  p.rect(gx + 20, legTop - 30, 4, 26, C);
  p.line(gx + 22, legTop - 30, gx - 112, legTop - 4, C);
  p.line(gx + 22, legTop - 30, gx + 74, legTop - 4, C);
  lights.push({ x: gx + 22, y: legTop - 32, phase: 0.2, period: 1.6, color: P4.red });
  lights.push({ x: gx - 118, y: legTop - 6, phase: 0.9, period: 1.6, color: P4.red });
  // Trolley + hanging spreader.
  p.rect(gx - 60, legTop, 10, 4, D);
  p.rect(gx - 56, legTop + 4, 1, 24, D);
  p.rect(gx - 62, legTop + 28, 14, 3, C);
  // Cabin glow.
  p.rect(gx - 4, legTop + 4, 8, 6, C);
  p.rect(gx - 3, legTop + 5, 5, 3, P4.win);
  // Jib (luffing) crane.
  const jx = 405;
  p.rect(jx, SEA - 58, 6, 58, C);
  p.rect(jx, SEA - 58, 1, 58, L);
  p.rect(jx - 4, SEA - 64, 14, 8, C);
  p.line(jx + 6, SEA - 62, jx + 70, SEA - 104, C, 2);
  p.line(jx + 2, SEA - 64, jx + 8, SEA - 80, C);
  p.line(jx + 8, SEA - 80, jx + 70, SEA - 104, D);
  p.rect(jx + 68, SEA - 104, 1, 30, D);
  lights.push({ x: jx + 70, y: SEA - 106, phase: 1.3, period: 1.9, color: P4.red });
  // Tug.
  const tx = 600;
  p.poly([tx, SEA - 6, tx + 30, SEA - 7, tx + 26, SEA + 1, tx + 3, SEA + 1], C);
  p.rect(tx + 8, SEA - 14, 12, 8, C);
  p.rect(tx + 10, SEA - 12, 3, 2, P4.win);
  p.rect(tx + 14, SEA - 19, 3, 5, C);
  // The basin: dark water with sunset glints.
  p.rect(0, SEA, W, H - SEA, P4.sea);
  for (let i = 0; i < 70; i++) {
    const y = SEA + 1 + Math.floor(Math.pow(r.next(), 1.6) * (H - SEA - 2));
    const x = r.int(0, W - 1);
    const len = r.int(2, 9);
    wrapRect(p, x, y, len, 1, r.chance(0.3) ? P4.seaGlint2 : P4.seaGlint);
  }
  for (let i = 0; i < 40; i++) wrapRect(p, r.int(0, W - 1), SEA + r.int(1, H - SEA - 2), r.int(3, 8), 1, shade(P4.sea, 0.12));
  return { art: p, lights };
}

/** Near layer: warehouse roofs (sawtooth + gable), lamp posts, container stacks, power poles. */
export function nearArt(): LayerArt {
  const W = 448;
  const H = 100;
  const p = new PixelArt(W, H);
  const lights: LightSpot[] = [];
  const r = new Rng(2024);
  const C = P4.near;
  const L = P4.nearL;
  const RIM = P4.nearRim;
  const base = H - 30;
  // Continuous low wall at the bottom.
  p.rect(0, base, W, H - base, C);
  let x = 0;
  while (x < W) {
    const kind = r.int(0, 3);
    if (kind === 0) {
      // Sawtooth-roof warehouse.
      const bw = r.int(70, 110);
      const bh = r.int(26, 40);
      const top = base - bh;
      wrapRect(p, x, top, bw, bh + 2, C);
      for (let sx = x; sx < x + bw - 10; sx += 14) {
        for (let k = 0; k < 10; k++) wrapRect(p, sx + k, top - k, 1, k + 1, C);
        wrapRect(p, sx + 9, top - 10, 1, 10, RIM); // lit glazing edge
        for (let k = 0; k < 10; k++) wrapPx(p, sx + k, top - k, RIM);
      }
      for (let wx = x + 6; wx < x + bw - 8; wx += 12) {
        if (r.chance(0.45)) {
          wrapRect(p, wx, top + 10, 5, 4, r.chance(0.5) ? P4.winD : P4.win);
          wrapRect(p, wx + 2, top + 10, 1, 4, C);
        }
      }
      x += bw + r.int(4, 16);
    } else if (kind === 1) {
      // Gable-roof shed with a big painted door.
      const bw = r.int(46, 70);
      const bh = r.int(20, 30);
      const top = base - bh;
      wrapRect(p, x, top, bw, bh + 2, C);
      const half = Math.floor(bw / 2);
      for (let k = 0; k < half; k++) {
        const hh = Math.floor(k * 0.45);
        wrapRect(p, x + k, top - hh, 1, hh, C);
        wrapRect(p, x + bw - 1 - k, top - hh, 1, hh, C);
        wrapPx(p, x + k, top - hh - 1, RIM);
      }
      wrapRect(p, x + half - 9, base - 18, 18, 18, L);
      for (let k = 0; k < 6; k++) wrapRect(p, x + half - 9, base - 17 + k * 3, 18, 1, C);
      x += bw + r.int(4, 14);
    } else if (kind === 2) {
      // Container stack.
      const n = r.int(2, 4);
      const cw = r.chance(0.5) ? 40 : 22;
      for (let k = 0; k < n; k++) {
        const cy = base - 11 * (k + 1);
        const off = r.int(-6, 6);
        wrapRect(p, x + off, cy, cw, 11, L);
        for (let rx = x + off + 2; rx < x + off + cw - 1; rx += 3) wrapRect(p, rx, cy + 2, 1, 8, C);
        wrapRect(p, x + off, cy, cw, 1, RIM);
      }
      x += cw + r.int(10, 24);
    } else {
      // Fence run with a power pole.
      const fw = r.int(40, 70);
      for (let fx = x; fx < x + fw; fx += 2) for (let fy = base - 12; fy < base; fy += 2) wrapPx(p, fx + (fy % 4 ? 1 : 0), fy, L);
      wrapRect(p, x, base - 13, fw, 1, L);
      const px = x + Math.floor(fw / 2);
      wrapRect(p, px, base - 58, 2, 58, C);
      wrapRect(p, px - 6, base - 54, 14, 2, C);
      x += fw + r.int(6, 16);
    }
  }
  // Lamp posts with glow pools (glow is translucent so the sky shows through).
  for (let lx = 30; lx < W; lx += 112) {
    const top = base - 46;
    wrapRect(p, lx, top, 2, 46, C);
    wrapRect(p, lx - 3, top, 8, 2, C);
    for (let gr = 9; gr >= 3; gr -= 3) {
      const a = gr === 9 ? '22' : gr === 6 ? '38' : '60';
      for (const o of [-W, 0, W]) p.circle(lx + 1 + o, top + 3, gr, P4.lampGlow + a);
    }
    wrapRect(p, lx - 2, top + 2, 6, 2, P4.lamp);
    lights.push({ x: lx + 1, y: top + 2, phase: r.range(0, 5), period: 0, color: P4.lamp });
  }
  // Power lines sagging between the poles.
  return { art: p, lights };
}

// ------------------------------------------------------------------ platforms

function columnY(x: number, xa: number, xb: number, y1: number, y2: number): number {
  const t = xb === xa ? 0 : (x - xa) / (xb - xa);
  return Math.round(y1 + (y2 - y1) * t);
}

/** Platform styles: 'pier' (planks on pilings), 'catwalk'/'metal' (steel grating), default boards. */
export function m4Platform(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, style: string): void {
  const xa = Math.round(x1);
  const xb = Math.round(x2);
  if (style === 'catwalk' || style === 'metal') {
    // Back railing first (behind the walkway).
    for (let x = xa; x < xb; x++) {
      const y = columnY(x, xa, xb, y1, y2);
      g.fillStyle = P4.steelD;
      g.fillRect(x, y - 11, 1, 1);
      if ((x - xa) % 16 === 2 || x === xb - 2) g.fillRect(x, y - 11, 1, 11);
      if ((x - xa) % 2 === 0) {
        g.fillStyle = '#2a2e3c';
        g.fillRect(x, y - 5, 1, 1);
      }
    }
    for (let x = xa; x < xb; x++) {
      const y = columnY(x, xa, xb, y1, y2);
      g.fillStyle = '#140c1c';
      g.fillRect(x, y - 1, 1, 7);
      g.fillStyle = P4.steelL;
      g.fillRect(x, y, 1, 1);
      g.fillStyle = (x - xa) % 3 === 0 ? P4.steelD : P4.steel;
      g.fillRect(x, y + 1, 1, 2);
      g.fillStyle = (x - xa) % 2 === 0 ? '#2a2e3c' : P4.steelD;
      g.fillRect(x, y + 3, 1, 1);
      g.fillStyle = P4.steel;
      g.fillRect(x, y + 4, 1, 1);
    }
    // Truss under the walkway.
    g.fillStyle = P4.steelD;
    for (let x = xa + 2; x < xb - 6; x += 12) {
      const y = columnY(x, xa, xb, y1, y2);
      for (let k = 0; k < 6; k++) g.fillRect(x + k, y + 6 + Math.floor(k / 1.5), 1, 1);
      g.fillRect(x, y + 6, 1, 5);
    }
    return;
  }
  const pier = style === 'pier';
  for (let x = xa; x < xb; x++) {
    const y = columnY(x, xa, xb, y1, y2);
    g.fillStyle = '#140c1c';
    g.fillRect(x, y - 1, 1, 7);
    g.fillStyle = (x - xa) % 11 === 0 ? P4.woodD : P4.woodL;
    g.fillRect(x, y, 1, 1);
    g.fillStyle = (x - xa) % 11 === 0 ? P4.woodD : P4.wood;
    g.fillRect(x, y + 1, 1, 3);
    g.fillStyle = P4.woodD;
    g.fillRect(x, y + 4, 1, 1);
    if ((x * 7) % 13 === 0) {
      g.fillStyle = shade(P4.wood, 0.12);
      g.fillRect(x, y + 2, 1, 1);
    }
  }
  // Supports: pilings into the water for piers, brackets for boards.
  for (let x = xa + 4; x < xb - 3; x += pier ? 30 : 40) {
    const y = columnY(x, xa, xb, y1, y2);
    const len = pier ? 80 : 7;
    g.fillStyle = '#140c1c';
    g.fillRect(x - 1, y + 5, 5, len);
    g.fillStyle = P4.woodD;
    g.fillRect(x, y + 5, 3, len);
    g.fillStyle = P4.wood;
    g.fillRect(x, y + 5, 1, len);
    if (pier) {
      g.fillStyle = '#2e3e3c';
      g.fillRect(x, y + 14, 3, 3);
    }
  }
}
