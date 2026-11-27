// Mission 2 terrain: sedimentary sand ground (bands show on every cliff face), a loose-sand crust
// edge with dry grass, red-rock strata solids and the platform styles (scaffold, ledge, ruin, metal).

import { PixelArt, mixColor, shade } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import type { LevelDef } from '../../../game/level';
import { C } from './palette';

const TAU = Math.PI * 2;

/** Sediment bands [thickness, color] for the ground fill (sums to 64). */
const GROUND_BANDS: Array<[number, string]> = [
  [6, '#d6ac74'],
  [2, '#c99c66'],
  [7, '#dcb47c'],
  [3, '#c69460'],
  [5, '#d2a46e'],
  [1, '#b8864f'],
  [8, '#d8ae76'],
  [2, '#e2bc86'],
  [6, '#cc9e68'],
  [3, '#c08e5a'],
  [9, '#d4a872'],
  [2, '#bc8a56'],
  [5, '#d8b07a'],
  [5, '#ca9a64'],
];

function bandColor(bands: Array<[number, string]>, y: number): string {
  const total = bands.reduce((s, b) => s + b[0], 0);
  let yy = ((y % total) + total) % total;
  for (const [t, c] of bands) {
    if (yy < t) return c;
    yy -= t;
  }
  return bands[0][1];
}

/**
 * World row where the red sandstone gives way to drifted sand. The ground texture is GT_H rows tall,
 * so (in levels up to GT_H px tall) its rows map 1:1 to world y: every cliff, mesa and step that
 * rises above the canyon floor (the m2 level's floor is at y 408) shows layered red rock under its
 * sand crust, and the floor itself stays sand.
 */
export const SAND_LINE = 386;
const GT_W = 128;
const GT_H = 512;

/** Per-row base colors of the sandstone beds (lit lip on top of each bed, undercut below). */
function rockRows(): string[] {
  const r = new Rng(717);
  const rows: string[] = [];
  const beds = [C.rockL, C.rock, C.rockL, C.rockM, '#c47a50', C.rock, '#d89868'];
  let prev = '';
  while (rows.length < GT_H) {
    let base = r.pick(beds);
    if (base === prev) base = r.pick(beds);
    prev = base;
    const t = r.int(4, 12);
    for (let i = 0; i < t; i++) {
      if (i === 0) rows.push(shade(base, -0.1));
      else if (i === t - 1 && t > 4) rows.push(shade(base, 0.16));
      else rows.push(base);
    }
    // Thin dark parting between some beds.
    if (r.chance(0.45)) rows.push(r.chance(0.5) ? C.rockD : C.rockDD);
  }
  return rows.slice(0, GT_H);
}

/** Sand drift line at texture column x (periodic over GT_W). */
function sandLineAt(x: number): number {
  const u = (x / GT_W) * TAU;
  return SAND_LINE + Math.round(Math.sin(u * 2 + 0.4) * 2.5 + Math.sin(u * 5 + 1.3) * 1.2);
}

/**
 * Ground fill: layered red sandstone (beds, partings, joints, varnish streaks, weathering pockets)
 * above SAND_LINE, wavy sediment sand below it. 128 x 512, rows = world y.
 */
export function groundTile(): PixelArt {
  const sand = sandTile();
  const rows = rockRows();
  const p = new PixelArt(GT_W, GT_H);
  const r = new Rng(818);
  const wave: number[] = [];
  for (let x = 0; x < GT_W; x++) {
    const u = (x / GT_W) * TAU;
    wave.push(Math.round(Math.sin(u + 0.9) * 1.6 + Math.sin(u * 3 + 2.2) * 0.8));
  }
  // Beds.
  for (let x = 0; x < GT_W; x++) {
    for (let y = 0; y < GT_H; y++) {
      const yy = Math.max(0, Math.min(GT_H - 1, y + wave[x]));
      p.px(x, y, rows[yy]);
    }
  }
  // Grain flecks.
  for (let i = 0; i < 900; i++) {
    const x = r.int(0, GT_W - 1);
    const y = r.int(0, SAND_LINE);
    p.px(x, y, r.chance(0.5) ? C.rockD : C.rockL);
  }
  // Desert-varnish streaks hanging down the face.
  for (let i = 0; i < 26; i++) {
    const x = r.int(0, GT_W - 1);
    const y0 = r.int(0, SAND_LINE - 30);
    const len = r.int(6, 24);
    for (let k = 0; k < len; k++) {
      if (k > len * 0.6 && r.chance(0.4)) continue;
      const v = p.getRaw(x, y0 + k);
      p.setRaw(x, y0 + k, (darkenRaw(v, 0.12) >>> 0));
    }
  }
  // Vertical joints (dark crack with a lit right lip), wrapped horizontally.
  for (let i = 0; i < 14; i++) {
    let x = r.int(0, GT_W - 1);
    const y0 = r.int(0, SAND_LINE - 24);
    const len = r.int(7, 22);
    for (let k = 0; k < len; k++) {
      const xx = ((x % GT_W) + GT_W) % GT_W;
      p.px(xx, y0 + k, C.rockDD);
      p.px((xx + 1) % GT_W, y0 + k, C.rockL);
      if (r.chance(0.18)) x += r.pick([-1, 1]);
    }
  }
  // Weathering pockets (dark hollow, lit lower rim).
  for (let i = 0; i < 16; i++) {
    const cx = r.int(4, GT_W - 5);
    const cy = r.int(4, SAND_LINE - 8);
    const rx = r.int(2, 3);
    p.rect(cx - rx, cy, rx * 2 + 1, 2, C.rockD);
    p.rect(cx - rx + 1, cy - 1, rx * 2 - 1, 1, C.rockDD);
    p.rect(cx - rx + 1, cy, rx * 2 - 1, 1, C.rockDD);
    p.rect(cx - rx + 1, cy + 2, rx * 2 - 1, 1, C.rockHi);
  }
  // Sand drift below the sand line (with a lit lip and grains dusted on the rock above it).
  for (let x = 0; x < GT_W; x++) {
    const yb = sandLineAt(x);
    for (let y = yb; y < GT_H; y++) p.setRaw(x, y, sand.getRaw(x % sand.w, y % sand.h));
    p.px(x, yb, C.sandHi);
    p.px(x, yb + 1, C.sandL);
    p.px(x, yb - 1, C.rockD);
    if (r.chance(0.45)) p.px(x, yb - 2 - r.int(0, 3), C.sandM);
  }
  return p;
}

function darkenRaw(v: number, amt: number): number {
  const k = 1 - amt;
  const r = Math.round((v & 255) * k);
  const g = Math.round(((v >>> 8) & 255) * k);
  const b = Math.round(((v >>> 16) & 255) * k);
  return ((v >>> 24) << 24) | (b << 16) | (g << 8) | r;
}

/** Sand fill: wavy sediment bands, flecks, pebbles and hairline cracks (tiles 64x64). */
function sandTile(): PixelArt {
  const W = 64;
  const H = 64;
  const p = new PixelArt(W, H);
  const r = new Rng(202);
  for (let x = 0; x < W; x++) {
    const wave = Math.round(Math.sin((x / W) * TAU * 2 + 0.7) * 1.2 + Math.sin((x / W) * TAU * 5 + 2.1) * 0.6);
    for (let y = 0; y < H; y++) p.px(x, y, bandColor(GROUND_BANDS, y + wave));
  }
  // Flecks.
  for (let i = 0; i < 230; i++) {
    const x = r.int(0, W - 1);
    const y = r.int(0, H - 1);
    p.px(x, y, r.chance(0.55) ? '#b88a58' : '#e8c890');
  }
  // Pebbles (wrap-safe: kept away from the edges).
  for (let i = 0; i < 14; i++) {
    const x = r.int(3, W - 4);
    const y = r.int(3, H - 4);
    const big = r.chance(0.35);
    const c = r.pick(['#a8825c', '#b89470', '#9c7454', '#c4a07a']);
    if (big) {
      p.rect(x - 1, y, 3, 2, c);
      p.px(x, y - 1, c);
      p.px(x - 1, y, shade(c, 0.25));
      p.rect(x - 1, y + 2, 3, 1, '#8c6644');
    } else {
      p.rect(x, y, 2, 1, c);
      p.px(x, y, shade(c, 0.25));
      p.px(x + 1, y + 1, '#8c6644');
    }
  }
  // Hairline cracks following the bands.
  for (let i = 0; i < 5; i++) {
    let x = r.int(0, W - 1);
    let y = r.int(4, H - 6);
    const len = r.int(5, 11);
    for (let k = 0; k < len; k++) {
      p.px(x % W, y, '#a87a4c');
      x++;
      if (r.chance(0.25)) y += r.pick([-1, 1]);
    }
  }
  return p;
}

/** Sand crust strip: 3 rows of tufts/ripples above the surface, bright lip, ripple band. */
export const GROUND_EDGE_UP = 3;
export function groundEdge(): PixelArt {
  const W = 64;
  const up = GROUND_EDGE_UP;
  const H = up + 8;
  const p = new PixelArt(W, H);
  const r = new Rng(303);
  // Sand body.
  for (let x = 0; x < W; x++) {
    p.px(x, up, C.sandHi);
    p.px(x, up + 1, C.sandL);
    p.px(x, up + 2, (x + 3) % 9 < 4 ? C.sandHi : C.sandL);
    p.px(x, up + 3, C.sand);
    p.px(x, up + 4, (x + 6) % 11 < 5 ? C.sandL : C.sand);
    if (r.chance(0.7)) p.px(x, up + 5, C.sand);
    if (r.chance(0.3)) p.px(x, up + 6, C.sandM);
  }
  // Ripple shadows.
  for (let x = 0; x < W; x += 9) p.rect(x + 1, up + 3, 3, 1, C.sandM);
  // Small mounds above the lip.
  for (let i = 0; i < 6; i++) {
    const x = r.int(2, W - 8);
    const w = r.int(4, 8);
    for (let k = 0; k < w; k++) {
      const h = Math.round(Math.sin((k / (w - 1)) * Math.PI) * 1.4);
      for (let y = 0; y < h; y++) p.px(x + k, up - 1 - y, y === h - 1 ? C.sandHi : C.sandL);
    }
  }
  // Dry grass tufts.
  for (let i = 0; i < 4; i++) {
    const x = r.int(2, W - 4);
    p.px(x, up - 1, C.dryD);
    p.px(x, up - 2, C.dry);
    p.px(x - 1, up - 2, C.dryD);
    p.px(x + 1, up - 1, C.dry);
    p.px(x + 1, up - 3, C.dry);
    p.px(x + 2, up - 2, C.dryD);
  }
  // Pebbles on the lip.
  for (let i = 0; i < 5; i++) {
    const x = r.int(1, W - 3);
    p.rect(x, up - 1, 2, 1, '#b49070');
    p.px(x, up - 1, '#d4b490');
  }
  return p;
}

/** Red-rock strata blocks (solids). */
const ROCK_BANDS: Array<[number, string]> = [
  [5, C.rock],
  [2, C.rockM],
  [6, C.rockL],
  [3, C.rock],
  [2, C.rockD],
  [5, C.rockM],
  [4, C.rock],
  [3, C.rockL],
];

export function solidTile(): PixelArt {
  const W = 48;
  const H = 30;
  const p = new PixelArt(W, H);
  const r = new Rng(404);
  for (let x = 0; x < W; x++) {
    const wave = Math.round(Math.sin((x / W) * TAU + 1.3) * 1.1);
    for (let y = 0; y < H; y++) p.px(x, y, bandColor(ROCK_BANDS, y + wave));
  }
  for (let i = 0; i < 120; i++) p.px(r.int(0, W - 1), r.int(0, H - 1), r.chance(0.5) ? C.rockD : C.rockL);
  // Vertical fractures.
  for (const fx of [9, 30, 41]) {
    let x = fx;
    const y0 = r.int(0, 10);
    for (let y = y0; y < y0 + r.int(8, 16); y++) {
      p.px(x, y % H, C.rockDD);
      p.px(x + 1, y % H, C.rockL);
      if (r.chance(0.3)) x += r.pick([-1, 1]);
    }
  }
  return p;
}

export const SOLID_EDGE_UP = 1;
export function solidEdge(): PixelArt {
  const W = 48;
  const p = new PixelArt(W, 5);
  const r = new Rng(505);
  for (let x = 0; x < W; x++) {
    if (r.chance(0.35)) p.px(x, 0, C.rockHi);
    p.px(x, 1, C.rockHi);
    p.px(x, 2, C.rockL);
    p.px(x, 3, r.chance(0.5) ? C.rock : C.rockL);
    if (r.chance(0.4)) p.px(x, 4, C.rockD);
  }
  return p;
}

// ------------------------------------------------------------------ level geometry helpers

/** Ground surface y at x from a LevelDef's polylines (Infinity over pits). */
export function levelGroundY(level: LevelDef, x: number): number {
  let best = Infinity;
  for (const line of level.ground) {
    if (x < line[0][0] || x > line[line.length - 1][0]) continue;
    for (let i = 0; i < line.length - 1; i++) {
      const [x1, y1] = line[i];
      const [x2, y2] = line[i + 1];
      if (x < x1 || x > x2) continue;
      const y = x2 === x1 ? Math.min(y1, y2) : y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
      if (y < best) best = y;
    }
  }
  return best;
}

/** First floor (ground or solid top) at or below y. */
export function levelFloorBelow(level: LevelDef, x: number, y: number): number {
  let best = levelGroundY(level, x);
  if (best < y) best = Infinity;
  for (const s of level.solids ?? []) {
    if (x >= s.x && x < s.x + s.w && s.y >= y && s.y < best) best = s.y;
  }
  return best;
}

// ------------------------------------------------------------------ platforms

/** The level being rendered (set by the backdrop each frame; platforms use it to find their footing). */
export const renderCtx: { level: LevelDef | null } = { level: null };

function px(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

/** Height of the post under a platform point (to the floor below, capped). */
function postLen(x: number, y: number, cap = 140): number {
  const L = renderCtx.level;
  if (!L) return 26;
  const f = levelFloorBelow(L, x, y + 6);
  if (!isFinite(f)) return 0;
  return Math.min(cap, Math.max(0, Math.round(f - y)));
}

function lineY(x1: number, y1: number, x2: number, y2: number, x: number): number {
  return Math.round(x2 === x1 ? y1 : y1 + ((y2 - y1) * (x - x1)) / (x2 - x1));
}

/** Wooden scaffold: lashed planks on a post-and-brace frame down to the floor. */
function scaffold(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  const xa = Math.round(x1);
  const xb = Math.round(x2);
  // Posts and braces first (behind the deck).
  const posts: number[] = [];
  const span = Math.max(1, xb - xa - 9);
  const n = Math.max(1, Math.round(span / 30));
  for (let i = 0; i <= n; i++) posts.push(Math.round(xa + 3 + (span * i) / n));
  let prev: { x: number; y: number; len: number } | null = null;
  for (const x of posts) {
    const y = lineY(x1, y1, x2, y2, x);
    const len = postLen(x + 1, y);
    if (len <= 4) {
      prev = null;
      continue;
    }
    px(g, x - 1, y + 4, 5, len - 4, C.ink);
    px(g, x, y + 4, 3, len - 4, C.wood);
    px(g, x, y + 4, 1, len - 4, C.woodL);
    px(g, x + 2, y + 4, 1, len - 4, C.woodD);
    // Lashing.
    px(g, x - 1, y + 7, 5, 2, '#c8b080');
    px(g, x - 1, y + 8, 5, 1, '#8c7450');
    if (prev && len > 18 && prev.len > 18) {
      // Diagonal brace between this and the previous post.
      const bx0 = prev.x + 2;
      const by0 = prev.y + 9;
      const bx1 = x;
      const by1 = y + Math.min(len, prev.len) - 4;
      const n = Math.max(1, bx1 - bx0);
      for (let i = 0; i <= n; i++) {
        const bx = bx0 + i;
        const by = Math.round(by0 + ((by1 - by0) * i) / n);
        px(g, bx, by - 1, 1, 4, C.ink);
        px(g, bx, by, 1, 2, i % 6 === 0 ? C.woodD : C.wood);
      }
    }
    prev = { x, y, len };
  }
  // Deck planks.
  for (let x = xa; x < xb; x++) {
    const y = lineY(x1, y1, x2, y2, x);
    px(g, x, y - 1, 1, 7, C.ink);
    const k = (x - xa) % 9;
    px(g, x, y, 1, 1, k === 0 ? C.woodL : C.woodHi);
    px(g, x, y + 1, 1, 3, k === 0 ? C.woodDD : k === 8 ? C.woodD : C.wood);
    px(g, x, y + 4, 1, 1, C.woodD);
  }
  // Nail heads.
  for (let x = xa + 4; x < xb - 2; x += 9) px(g, x, lineY(x1, y1, x2, y2, x) + 2, 1, 1, C.woodDD);
}

/** Natural rock ledge jutting out of a cliff (thick slab, rounded ends, no supports). */
function ledge(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  const xa = Math.round(x1);
  const xb = Math.round(x2);
  const w = Math.max(1, xb - xa);
  for (let x = xa - 1; x <= xb; x++) {
    const t = (x - xa) / w;
    const y = lineY(x1, y1, x2, y2, Math.min(xb, Math.max(xa, x)));
    // Underside tapers toward the ends; irregular.
    const edgeK = Math.min(x - xa + 1, xb - x);
    const thick = Math.max(3, Math.min(10, 3 + edgeK * 0.6 + Math.sin(x * 0.9) * 1.2 + Math.sin(x * 0.31) * 1.5));
    const yy = edgeK <= 1 ? y + 1 : y;
    px(g, x, yy - 1, 1, Math.round(thick) + 2, C.ink);
    px(g, x, yy, 1, 1, t < 0.02 || t > 0.98 ? C.rockL : C.rockHi);
    px(g, x, yy + 1, 1, 1, C.rockL);
    px(g, x, yy + 2, 1, Math.max(1, Math.round(thick) - 3), (x * 7) % 13 < 2 ? C.rockM : C.rock);
    px(g, x, yy + Math.round(thick) - 1, 1, 1, C.rockD);
  }
  // A couple of pebbles on top.
  for (let x = xa + 5; x < xb - 4; x += 17) px(g, x, lineY(x1, y1, x2, y2, x) - 1, 2, 1, C.rockD);
}

/** Carved sandstone lintel (ruins). */
function ruin(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  const xa = Math.round(x1);
  const xb = Math.round(x2);
  for (let x = xa; x < xb; x++) {
    const y = lineY(x1, y1, x2, y2, x);
    const k = (x - xa) % 16;
    px(g, x, y - 1, 1, 10, C.ink);
    px(g, x, y, 1, 1, C.stoneHi);
    px(g, x, y + 1, 1, 2, C.stoneL);
    px(g, x, y + 3, 1, 1, C.stoneM);
    // Frieze: little stepped motif.
    px(g, x, y + 4, 1, 3, k === 0 ? C.stoneD : C.stone);
    if (k === 4 || k === 11) px(g, x, y + 5, 1, 1, C.stoneD);
    if (k >= 5 && k <= 10) px(g, x, y + 4 + (k === 5 || k === 10 ? 1 : 0), 1, 1, C.stoneM);
    px(g, x, y + 7, 1, 1, C.stoneD);
    px(g, x, y + 8, 1, 1, C.stoneDD);
  }
  // Chipped ends.
  px(g, xa, lineY(x1, y1, x2, y2, xa), 2, 1, C.ink);
  px(g, xb - 1, lineY(x1, y1, x2, y2, xb - 1) + 7, 1, 2, C.ink);
}

/** Oil field steel catwalk: grating, pipe hand rail stubs and thin legs. */
function metal(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  const xa = Math.round(x1);
  const xb = Math.round(x2);
  for (let x = xa + 4; x < xb - 2; x += 30) {
    const y = lineY(x1, y1, x2, y2, x);
    const len = postLen(x + 1, y);
    if (len > 6) {
      px(g, x - 1, y + 5, 4, len - 5, C.ink);
      px(g, x, y + 5, 2, len - 5, C.steelD);
      px(g, x, y + 5, 1, len - 5, C.steel);
    }
  }
  for (let x = xa; x < xb; x++) {
    const y = lineY(x1, y1, x2, y2, x);
    px(g, x, y - 1, 1, 7, C.ink);
    px(g, x, y, 1, 1, C.steelHi);
    px(g, x, y + 1, 1, 1, x % 3 === 0 ? C.steelD : C.steelL);
    px(g, x, y + 2, 1, 1, x % 3 === 0 ? C.steelDD : C.steel);
    px(g, x, y + 3, 1, 1, C.rust);
    px(g, x, y + 4, 1, 1, C.steelD);
  }
  // Hazard stripes on the ends.
  for (const ex of [xa, xb - 4]) {
    const y = lineY(x1, y1, x2, y2, ex);
    for (let i = 0; i < 4; i++) px(g, ex + i, y + 1, 1, 2, i % 2 ? C.ink : '#e8b830');
  }
}

/** Plain plank deck (for platforms whose supports are drawn by decor, e.g. the watchtower). */
function plank(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  const xa = Math.round(x1);
  const xb = Math.round(x2);
  for (let x = xa; x < xb; x++) {
    const y = lineY(x1, y1, x2, y2, x);
    const k = (x - xa) % 7;
    px(g, x, y - 1, 1, 6, C.ink);
    px(g, x, y, 1, 1, k === 0 ? C.woodL : C.woodHi);
    px(g, x, y + 1, 1, 2, k === 0 ? C.woodDD : C.wood);
    px(g, x, y + 3, 1, 1, C.woodD);
  }
}

/** Platform renderer for the theme (style = PlatformDef.style). */
export function drawPlatform(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, style: string): void {
  if (style === 'ledge') ledge(g, x1, y1, x2, y2);
  else if (style === 'ruin') ruin(g, x1, y1, x2, y2);
  else if (style === 'metal') metal(g, x1, y1, x2, y2);
  else if (style === 'plank') plank(g, x1, y1, x2, y2);
  else scaffold(g, x1, y1, x2, y2);
}

/** Lighten/darken helper re-exported for decor code. */
export { mixColor, shade };
