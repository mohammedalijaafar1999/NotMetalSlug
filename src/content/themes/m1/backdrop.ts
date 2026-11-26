// Palm Harbor backdrop: a custom renderBackground with hand-composed parallax panoramas that change
// along the level (they are as wide as the level needs, not repeating tiles):
//   sky (warm morning gradient) + sun + two drifting cloud decks + gulls
//   far: island chain and a smoking volcano (factor 0.05)
//   sea: turquoise bands with drifting wave streaks and twinkling glints
//   harbor: a lighthouse headland, fishing boats and a Legion gunboat on the horizon (0.12)
//   hills: hazy jungle hills that rise from the sea at the end of the village (0.22), with the
//          Legion stockade's chimneys and radio mast on them at the end
//   near: back beach with palms -> stilt huts on the lagoon -> jungle wall -> palisade (0.45)
// Everything is baked once per level into canvases (PixelArt -> canvas at first render).

import { PixelArt, shade, mixColor } from '../../../engine/pixelart';
import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import type { LevelDef } from '../../../game/level';
import { bandedGradient } from '../../../art/textures';
import { M1, PH, h01, noise1, ramp01 } from './layout';

// ------------------------------------------------------------------ layout (screen y at the bottom camera)

const HORIZON = 122;
const F_FAR = 0.05;
const F_SEA = 0.1;
const F_HARBOR = 0.12;
const F_HILLS = 0.22;
const F_NEAR = 0.45;
const Y_FAR = 50;
const FAR_H = HORIZON - Y_FAR;
const Y_HARBOR = 84;
const HARBOR_H = 64;
const Y_HILLS = 52;
const HILLS_H = VIEW_H - Y_HILLS + 40;
const Y_NEAR = 14;
const NEAR_H = VIEW_H - Y_NEAR + 48;
/** Vertical parallax factors (how much a layer moves when the camera moves up). */
const YF_SKYLINE = 0.04;
const YF_HILLS = 0.13;
const YF_NEAR = 0.27;

/** Panorama x (layer factor f) whose column sits at the screen centre when the view is centred on world x. */
export function pz(worldX: number, f: number): number {
  return (worldX - VIEW_W / 2) * f + VIEW_W / 2;
}

/** World x that the view is centred on when panorama column px (factor f) is at the screen centre. */
function wz(px: number, f: number): number {
  return (px - VIEW_W / 2) / f + VIEW_W / 2;
}

// ------------------------------------------------------------------ small art helpers

/** Lit cumulus cloud (flat, shaded base) blitted into p. */
function cumulus(p: PixelArt, cx: number, base: number, w: number, hgt: number, seed: number, body: string, shadow: string, hi: string): void {
  const n = Math.max(3, Math.round(w / 9));
  const cw = Math.ceil(w + 30);
  const ch = Math.ceil(hgt * 2 + 12);
  const t = new PixelArt(cw, ch);
  const ox = cw / 2;
  const by = ch - 2;
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const x = ox - w / 2 + k * w;
    const r = 3 + Math.sin(k * Math.PI) * hgt * (0.55 + h01(i, seed, 5) * 0.45);
    blobs.push([x, by - r * 0.55, r]);
  }
  for (const [x, y, r] of blobs) t.circle(x + 1, y + 1.5, r, shadow);
  for (const [x, y, r] of blobs) t.circle(x, y, r - 0.6, body);
  for (const [x, y, r] of blobs) if (r > 4) t.circle(x - r * 0.28, y - r * 0.3, r * 0.45, hi);
  // Flatten the base and shade its bottom rows.
  for (let x = 0; x < cw; x++) {
    for (let y = by + 1; y < ch; y++) t.setRaw(x, y, 0);
    for (let y = by - 2; y <= by; y++) if (t.opaque(x, y)) t.px(x, y, shadow);
  }
  p.blit(t, Math.round(cx - ox), Math.round(base - by));
}

/** Tileable strip of clouds. */
function cloudDeck(w: number, h: number, seed: number, count: number, body: string, shadow: string, hi: string, sizeK = 1): PixelArt {
  const p = new PixelArt(w, h);
  for (let i = 0; i < count; i++) {
    const cx = ((i + h01(i, 1, seed) * 0.6) / count) * w;
    const cw = (26 + h01(i, 2, seed) * 46) * sizeK;
    const ch = (6 + h01(i, 3, seed) * 8) * sizeK;
    const base = h * 0.45 + h01(i, 4, seed) * h * 0.4;
    for (const wrap of [-w, 0, w]) cumulus(p, cx + wrap, base, cw, ch, seed * 31 + i, body, shadow, hi);
  }
  return p;
}

/** Colours of a backdrop plant (hazier the further away). */
interface PlantCols {
  trunk: string;
  trunkL: string;
  trunkD: string;
  leaf: string;
  leafL: string;
  leafD: string;
}

/** Palm for the backdrop: curved ringed trunk, nine drooping fronds with hanging leaflets. */
function bgPalm(p: PixelArt, x: number, base: number, hgt: number, lean: number, c: PlantCols): void {
  const steps = Math.ceil(hgt);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x + lean * t * t;
    const cy = base - hgt * t;
    const r = 2.2 - t * 0.9;
    p.circle(cx, cy, r, c.trunk);
    p.px(cx - r + 0.5, cy, c.trunkL);
    if (i % 3 === 0) p.px(cx + r - 0.8, cy, c.trunkD);
  }
  const tx = x + lean;
  const ty = base - hgt;
  const len = hgt * 0.3 + 8;
  const n = 9;
  for (let k = 0; k < n; k++) {
    const side = k / (n - 1); // 0 = left, 1 = right
    const a = Math.PI + side * Math.PI; // left, over the top, right
    const dx = Math.cos(a);
    const lift = Math.abs(Math.sin(a)); // 1 for the top fronds
    const droop = 0.5 - lift * 0.35;
    const col = lift > 0.8 ? c.leafL : lift < 0.35 ? c.leafD : c.leaf;
    let px = tx;
    let py = ty;
    const segs = 5;
    for (let s = 1; s <= segs; s++) {
      const u = s / segs;
      const nx = tx + dx * len * u * (0.8 + lift * 0.2);
      const ny = ty - lift * len * 0.45 * u + droop * len * u * u * 1.3;
      p.line(px, py, nx, ny, col, s <= 2 ? 2 : 1);
      // Leaflets hanging under the frond.
      if (s >= 2) {
        p.px(nx - dx, ny + 1.5, col);
        p.px(nx - dx * 0.5, ny + 2.5, c.leafD);
      }
      px = nx;
      py = ny;
    }
  }
  p.circle(tx, ty + 1, 2.4, c.leafD);
  p.circle(tx - 0.6, ty, 1.7, c.leaf);
  p.circle(tx + 1.2, ty + 2.2, 1.1, c.trunkD); // coconuts
}

/** Leafy canopy clump (wider than tall, lit from the top-left). */
function leafClump(p: PixelArt, cx: number, cy: number, r: number, d: string, b: string, l: string, ll?: string): void {
  const parts: [number, number, number][] = [
    [0, 0, 1],
    [-0.78, 0.3, 0.7],
    [0.8, 0.26, 0.68],
    [-0.36, -0.42, 0.62],
    [0.42, -0.4, 0.56],
  ];
  for (const [dx, dy, s] of parts) p.ellipse(cx + dx * r + 1, cy + dy * r + 1.2, r * s * 1.15, r * s * 0.8, d);
  for (const [dx, dy, s] of parts) p.ellipse(cx + dx * r, cy + dy * r, r * s * 1.1, r * s * 0.72, b);
  for (const [dx, dy, s] of parts) {
    if (dy > 0.28) continue;
    p.ellipse(cx + dx * r - r * s * 0.32, cy + dy * r - r * s * 0.3, r * s * 0.55, r * s * 0.28, l);
  }
  if (ll) {
    p.px(cx - r * 0.55, cy - r * 0.72, ll);
    p.px(cx + r * 0.1, cy - r * 0.62, ll);
  }
}

/** Broadleaf tree for the backdrop: trunk with a fork and a crown of clumps. */
function bgTree(p: PixelArt, x: number, base: number, hgt: number, c: PlantCols, crownR: number): void {
  const top = base - hgt;
  p.rect(x - 2, top + crownR * 0.6, 4, hgt - crownR * 0.6, c.trunk);
  p.rect(x - 2, top + crownR * 0.6, 1, hgt - crownR * 0.6, c.trunkL);
  p.rect(x + 1, top + crownR * 0.6, 1, hgt - crownR * 0.6, c.trunkD);
  p.tri(x - 6, base, x - 1, base - 9, x, base, c.trunk);
  p.tri(x + 6, base, x + 1, base - 8, x + 1, base, c.trunkD);
  p.line(x, top + crownR, x - crownR * 0.6, top + crownR * 0.3, c.trunk, 2);
  p.line(x, top + crownR * 1.2, x + crownR * 0.7, top + crownR * 0.5, c.trunk, 2);
  leafClump(p, x - crownR * 0.65, top + crownR * 0.35, crownR * 0.75, c.leafD, c.leaf, c.leafL);
  leafClump(p, x + crownR * 0.7, top + crownR * 0.45, crownR * 0.7, c.leafD, c.leaf, c.leafL);
  leafClump(p, x, top, crownR, c.leafD, c.leaf, c.leafL);
}

/** Thatched stilt hut silhouette for the backdrop (on water). */
function bgHut(p: PixelArt, x: number, water: number, w: number, s: { wall: string; wallD: string; roof: string; roofL: string; roofD: string; post: string; dark: string }): void {
  const floor = water - 9;
  // Stilts.
  for (let k = 0; k < 4; k++) p.rect(x - w / 2 + 2 + (k * (w - 5)) / 3, floor, 1.5, 12, s.post);
  p.rect(x - w / 2 - 2, floor - 1, w + 4, 2, s.post);
  // Walls.
  const wh = Math.round(w * 0.42);
  p.rect(x - w / 2 + 1, floor - wh, w - 2, wh, s.wall);
  p.rect(x + w / 2 - 4, floor - wh, 3, wh, s.wallD);
  p.rect(x - 2, floor - wh + 3, 4, wh - 3, s.dark);
  // Roof (trapezoid with overhang).
  const rh = Math.round(w * 0.5);
  p.poly([x - w / 2 - 4, floor - wh + 1, x - w * 0.18, floor - wh - rh, x + w * 0.18, floor - wh - rh, x + w / 2 + 4, floor - wh + 1], s.roof);
  p.poly([x - w / 2 - 4, floor - wh + 1, x - w * 0.18, floor - wh - rh, x - w * 0.05, floor - wh - rh, x - w * 0.22, floor - wh + 1], s.roofL);
  p.rect(x - w / 2 - 4, floor - wh, w + 8, 1, s.roofD);
  p.rect(x - w * 0.18, floor - wh - rh, w * 0.36, 1, s.roofL);
}

// ------------------------------------------------------------------ far layer: islands + volcano

/** Panorama x of the volcano (crater centre) on the far layer. */
const VOLC_X = 268;
const VOLC_H = 60;

function farPanorama(W: number): PixelArt {
  const w = Math.ceil(W * F_FAR + VIEW_W + 8);
  const p = new PixelArt(w, FAR_H);
  const base = FAR_H; // bottom row sits on the horizon
  // Island chain: smooth bumps.
  const islands: [number, number, number][] = [
    [40, 70, 14],
    [118, 46, 9],
    [175, 34, 7],
    [380, 90, 16],
    [470, 60, 11],
    [560, 110, 20],
    [690, 80, 13],
    [790, 60, 10],
  ];
  const heightAt = (x: number): number => {
    let hgt = 0;
    for (const [ix, iw, ih] of islands) {
      const d = Math.abs(x - ix) / (iw / 2);
      if (d < 1) hgt = Math.max(hgt, ih * (0.5 + 0.5 * Math.cos(d * Math.PI)) * (0.85 + noise1(x * 0.15, ix) * 0.3));
    }
    return hgt;
  };
  for (let x = 0; x < w; x++) {
    const hgt = heightAt(x);
    if (hgt < 0.6) continue;
    const top = Math.round(base - hgt);
    const slopeL = heightAt(x + 2) - heightAt(x - 2) > 0.3; // rising to the right = lit (sun on the left)
    p.rect(x, top, 1, base - top, PH.isle);
    p.rect(x, top, 1, Math.max(1, Math.round((base - top) * (slopeL ? 0.45 : 0.15))), PH.isleL);
    if (!slopeL && hgt > 6) p.rect(x, top + 2, 1, base - top - 2, mixColor(PH.isle, PH.isleD, 0.5));
  }
  // The volcano: concave cone with a notched crater, lit left flank, ridge gullies.
  const vx = VOLC_X;
  const vH = VOLC_H;
  const halfBase = 92;
  for (let x = Math.floor(vx - halfBase); x <= vx + halfBase; x++) {
    const d = Math.abs(x - vx) / halfBase;
    if (d >= 1) continue;
    let hgt = vH * Math.pow(1 - d, 1.7) * (1 + 0.04 * Math.sin(x * 0.9));
    if (Math.abs(x - vx) < 6) hgt -= 2.2 * (1 - Math.abs(x - vx) / 6); // crater notch
    hgt += noise1(x * 0.4, 9) * 1.4;
    const top = Math.round(base - hgt);
    const left = x < vx;
    p.rect(x, top, 1, base - top, left ? PH.volcL : PH.volc);
    if (left) p.rect(x, top + Math.round((base - top) * 0.55), 1, base - top, PH.volc);
    else p.rect(x, top + Math.round((base - top) * 0.4), 1, base - top, PH.volcD);
    p.px(x, top, left ? shade(PH.volcL, 0.15) : PH.volc);
  }
  // Gullies (darker streaks running down the flanks).
  for (let k = -4; k <= 4; k++) {
    if (k === 0) continue;
    const x0 = vx + k * 7;
    const x1 = vx + k * 17;
    const y0 = base - vH * Math.pow(1 - Math.abs(x0 - vx) / halfBase, 1.7) + 3;
    p.line(x0, y0, x1, base - 3, k < 0 ? PH.volc : PH.volcD);
  }
  // A faint warm glow in the crater.
  p.rect(vx - 3, base - vH + 1, 6, 1, '#d8a090');
  return p;
}

// ------------------------------------------------------------------ sea strip (tileable)

const SEA_W = 256;
const SEA_H = VIEW_H - HORIZON + 40;

function seaStrip(): PixelArt {
  const p = new PixelArt(SEA_W, SEA_H);
  const bands: [number, string][] = [
    [0, PH.seaHorizon],
    [1, mixColor(PH.seaHorizon, PH.seaFar, 0.55)],
    [2, PH.seaFar],
    [9, mixColor(PH.seaFar, PH.seaMid, 0.5)],
    [18, PH.seaMid],
    [34, mixColor(PH.seaMid, PH.seaNear, 0.5)],
    [50, PH.seaNear],
  ];
  for (let i = 0; i < bands.length; i++) {
    const y0 = bands[i][0];
    const y1 = i + 1 < bands.length ? bands[i + 1][0] : SEA_H;
    p.rect(0, y0, SEA_W, y1 - y0, bands[i][1]);
  }
  // Wave streaks: longer and more frequent closer to the viewer.
  for (let y = 3; y < SEA_H; y++) {
    const near = Math.min(1, y / 60);
    const step = Math.max(5, Math.round(26 - near * 18));
    for (let x0 = 0; x0 < SEA_W; x0 += step) {
      if (h01(x0, y, 91) > 0.32) continue;
      const x = x0 + Math.floor(h01(x0, y, 92) * step);
      const len = 2 + Math.floor(near * 5 * h01(x, y, 93));
      const c = h01(x, y, 94) < 0.6 ? shade(bandAt(bands, y), 0.18) : shade(bandAt(bands, y), -0.08);
      for (let k = 0; k < len; k++) p.px((x + k) % SEA_W, y, c);
    }
  }
  return p;
}

function bandAt(bands: [number, string][], y: number): string {
  let c = bands[0][1];
  for (const [y0, col] of bands) if (y >= y0) c = col;
  return c;
}

// ------------------------------------------------------------------ harbor layer

/** Panorama x of the lighthouse (harbor layer) and its lamp offset above the waterline. */
const LIGHT_X = 312;
const HEAD_PALM: PlantCols = { trunk: '#86868c', trunkL: '#a0a0a6', trunkD: '#727278', leaf: '#76a090', leafL: '#8cb4a2', leafD: '#668e80' };
const LIGHT_TOP = 6;

function harborPanorama(W: number): PixelArt {
  const w = Math.ceil(W * F_HARBOR + VIEW_W + 8);
  const p = new PixelArt(w, HARBOR_H);
  const wl = HORIZON - Y_HARBOR + 6; // waterline row for the headland
  // Headland: rocky mound with a sandy foot and two palms.
  const hx0 = LIGHT_X - 62;
  const hx1 = LIGHT_X + 74;
  for (let x = hx0; x <= hx1; x++) {
    const t = (x - hx0) / (hx1 - hx0);
    let hgt = Math.sin(t * Math.PI) * 18 + Math.sin(t * Math.PI * 3) * 2 + noise1(x * 0.3, 4) * 2;
    if (t > 0.3 && t < 0.62) hgt += 6 * Math.sin(((t - 0.3) / 0.32) * Math.PI);
    if (hgt < 1) continue;
    const top = Math.round(wl - hgt);
    const lit = t < 0.45;
    p.rect(x, top, 1, wl - top, lit ? '#8f97a8' : '#7d8598');
    p.px(x, top, lit ? '#aab2c2' : '#8f97a8');
    if (hgt > 5) p.rect(x, top + 1, 1, Math.min(3, hgt - 3), lit ? '#86a27e' : '#748e70'); // scrub on top
  }
  p.rect(hx0 - 6, wl - 1, hx1 - hx0 + 12, 2, '#e6dcc0'); // foam at the foot
  bgPalm(p, hx0 + 22, wl - 10, 16, -5, HEAD_PALM);
  bgPalm(p, hx1 - 20, wl - 8, 13, 4, HEAD_PALM);
  // Lighthouse: tapered tower, red/white bands, gallery + lantern.
  const lb = wl - 22; // base row on the rocks
  const lt = LIGHT_TOP + 6;
  for (let y = lt; y <= lb; y++) {
    const t = (y - lt) / (lb - lt);
    const half = 2.5 + t * 2.2;
    const band = Math.floor((y - lt) / 6) % 2 === 0;
    const col = band ? '#e2dcd8' : '#c8786c';
    p.rect(LIGHT_X - half, y, half * 2, 1, col);
    p.rect(LIGHT_X + half - 1.5, y, 1.5, 1, band ? '#c0bcbc' : '#a8645c');
  }
  p.rect(LIGHT_X - 4, lt - 1, 8, 1, '#5e6270'); // gallery
  p.rect(LIGHT_X - 2, lt - 5, 4, 4, '#e8e4c8'); // lantern glass
  p.rect(LIGHT_X - 2.5, lt - 7, 5, 2, '#8a4a44'); // cap
  p.px(LIGHT_X, lt - 8, '#5e6270');
  p.rect(LIGHT_X - 6, lb, 12, 2, '#8f97a8');
  // Distant boats on the sea (sails catch the morning light).
  const boats: [number, number, 'sail' | 'gun' | 'skiff'][] = [
    [60, 30, 'sail'],
    [150, 34, 'skiff'],
    [205, 28, 'gun'],
    [470, 33, 'sail'],
    [540, 40, 'skiff'],
    [640, 31, 'sail'],
    [760, 36, 'skiff'],
  ];
  for (const [bx, by, kind] of boats) {
    if (bx > w - 20) continue;
    if (kind === 'sail') {
      p.poly([bx - 6, by, bx + 6, by, bx + 4, by + 3, bx - 4, by + 3], '#7a6a68');
      p.rect(bx - 0.5, by - 12, 1, 12, '#6a5a58');
      p.tri(bx + 0.5, by - 12, bx + 0.5, by - 1, bx + 7, by - 1, '#f2ece0');
      p.tri(bx - 0.5, by - 9, bx - 0.5, by - 1, bx - 5, by - 1, '#d8d0c4');
    } else if (kind === 'skiff') {
      p.poly([bx - 5, by, bx + 5, by, bx + 3, by + 2, bx - 3, by + 2], '#866e5e');
      p.rect(bx - 1, by - 3, 3, 3, '#a89a8c');
    } else {
      // The Legion gunboat, smoke curling from its funnel.
      p.poly([bx - 16, by, bx + 14, by, bx + 10, by + 4, bx - 13, by + 4], '#6c6a5c');
      p.rect(bx - 9, by - 4, 13, 4, '#7a7866');
      p.rect(bx - 6, by - 8, 6, 4, '#72705e');
      p.rect(bx - 2, by - 11, 3, 3, '#5c5a4e');
      p.rect(bx + 6, by - 3, 6, 1, '#5c5a4e'); // gun
      for (let k = 0; k < 4; k++) p.circle(bx + 1 + k * 3, by - 13 - k * 1.5, 1.5 + k * 0.5, k < 2 ? '#9a9ca6' : '#b4b6be');
    }
  }
  return p;
}

// ------------------------------------------------------------------ hills layer (jungle rising inland)

/** 0..1 hill presence for a world x (none on the beach, full in the jungle). */
function hillPresence(xw: number): number {
  return ramp01(xw, M1.villageEnd - 700, M1.villageEnd + 200);
}

/** Stockade chimney tops on the hills layer (panorama x, row), filled by hillsPanorama. */
let chimneys: [number, number][] = [];

function hillsPanorama(W: number): PixelArt {
  const w = Math.ceil(W * F_HILLS + VIEW_W + 8);
  const p = new PixelArt(w, HILLS_H);
  const bottom = HILLS_H;
  const heights: number[] = [];
  for (let x = 0; x < w; x++) {
    const pres = hillPresence(wz(x, F_HILLS));
    const roll = 0.5 + 0.3 * Math.sin(x * 0.019 + 1.3) + 0.2 * Math.sin(x * 0.051 + 0.4);
    const full = 150 + roll * 30;
    heights.push(pres > 0 ? full * Math.sqrt(pres) - (1 - pres) * 40 : 0);
  }
  for (let x = 0; x < w; x++) {
    const hgt = heights[x];
    if (hgt <= 0) continue;
    const top = Math.round(bottom - hgt);
    p.rect(x, top, 1, bottom - top, PH.hill);
  }
  // Fine canopy texture: small lit bumps along the ridge, a few soft crowns below it.
  for (let x = 0; x < w; x += 4) {
    const hgt = heights[x];
    if (hgt < 6) continue;
    const top = bottom - hgt;
    const r = 2.5 + h01(x, 0, 101) * 3;
    const cx = x + h01(x, 1, 101) * 3;
    p.ellipse(cx + 0.5, top + r * 0.6 + 0.8, r * 1.2, r * 0.8, PH.hillD);
    p.ellipse(cx, top + r * 0.45, r * 1.15, r * 0.75, PH.hill);
    p.ellipse(cx - r * 0.35, top + r * 0.25, r * 0.6, r * 0.35, PH.hillL);
  }
  for (let x = 0; x < w; x += 6) {
    const hgt = heights[x];
    if (hgt < 30) continue;
    for (let k = 0; k < 3; k++) {
      const yy = bottom - hgt + 12 + k * 14 + h01(x, k, 102) * 8;
      const r = 2.5 + h01(x, k, 103) * 3;
      const cx = x + h01(x, k, 104) * 5;
      p.ellipse(cx + 0.6, yy + 0.8, r * 1.2, r * 0.8, PH.hillDD);
      p.ellipse(cx, yy, r * 1.1, r * 0.7, PH.hillD);
    }
  }
  // Where the hills meet the sea: a pale strip of sand and foam at the foot.
  for (let x = 0; x < w; x++) {
    const pres = hillPresence(wz(x, F_HILLS));
    if (pres <= 0 || pres >= 0.99 || heights[x] <= 0) continue;
    const foot = Math.round(HORIZON - Y_HILLS + 10 + (1 - pres) * 6);
    if (bottom - heights[x] < foot) {
      p.px(x, foot, '#d6d0b0');
      p.px(x, foot + 1, '#eaf6ee');
    }
  }
  // Legion stockade on the far hills at the end: blockhouses, chimneys and a radio mast.
  const sx = pz(M1.stockade + 300, F_HILLS);
  const ridge = (x: number) => bottom - heights[Math.max(0, Math.min(w - 1, Math.round(x)))];
  const dk = '#62746a';
  const dkL = '#76887c';
  for (const [ox, hw, hh] of [
    [0, 30, 14],
    [36, 18, 20],
    [62, 26, 12],
  ] as const) {
    const x0 = sx + ox;
    const top = ridge(x0 + hw / 2) - hh + 4;
    p.rect(x0, top, hw, hh, dk);
    p.rect(x0, top, hw, 1, dkL);
    for (let k = 0; k < hw; k += 4) p.rect(x0 + k, top - 2, 2, 2, dk);
  }
  chimneys = [];
  for (const ox of [44, 52]) {
    const top = ridge(sx + ox) - 40;
    chimneys.push([sx + ox + 2, top]);
    p.rect(sx + ox, top, 4, 26, dk);
    p.rect(sx + ox, top, 1, 26, dkL);
    p.rect(sx + ox - 1, top, 6, 2, '#566860');
  }
  const mx = sx + 90;
  const mtop = ridge(mx) - 50;
  p.line(mx, mtop, mx - 5, ridge(mx) + 2, dk);
  p.line(mx, mtop, mx + 5, ridge(mx) + 2, dk);
  for (let y = mtop + 6; y < ridge(mx); y += 6) p.hline(mx - ((y - mtop) / 50) * 5, mx + ((y - mtop) / 50) * 5, y, dk);
  p.px(mx, mtop - 1, '#d05040');
  return p;
}

function nearPanorama(W: number): PixelArt {
  const w = Math.ceil(W * F_NEAR + VIEW_W + 8);
  const p = new PixelArt(w, NEAR_H);
  const bottom = NEAR_H;
  // Screen-y rows of this layer at the bottom camera.
  const row = (screenY: number) => screenY - Y_NEAR;
  const shoreRow = row(160);
  const beachPalm: PlantCols = { trunk: '#ab9a80', trunkL: '#c4b498', trunkD: '#8e7e66', leaf: '#74a886', leafL: '#90bf9a', leafD: '#5e8f72' };
  const jPlant: PlantCols = { trunk: PH.trunkBg, trunkL: PH.trunkBgL, trunkD: PH.trunkBgD, leaf: PH.jungle, leafL: PH.jungleL, leafD: PH.jungleD };

  // 1) Back beach (beach zone): sand with a wet band and a foam line, palms, rocks, a rowboat.
  const sandPres = (x: number) => 1 - ramp01(wz(x, F_NEAR), M1.beachEnd - 140, M1.beachEnd + 60);
  for (let x = 0; x < w; x++) {
    const s = sandPres(x);
    if (s <= 0.02) continue;
    const top = Math.round(shoreRow + (1 - s) * 34 + Math.sin(x * 0.05) * 1.2);
    p.rect(x, top, 1, bottom - top, '#dbc596');
    p.rect(x, top, 1, 3, '#c9b488'); // wet sand at the waterline
    p.px(x, top, '#e4d6b0');
    if (h01(x, 0, 111) < 0.14) p.px(x, top + 5 + Math.floor(h01(x, 1, 111) * 14), '#cdb98e');
    if (h01(x >> 1, 2, 111) < 0.85) p.px(x, top - 1, '#f2fbf6');
    if (h01(x >> 2, 3, 111) < 0.5) p.px(x, top - 2, '#d8f4ee');
  }
  for (let x = 24; x < w; x += 38) {
    const xw = wz(x, F_NEAR);
    if (xw > M1.beachEnd - 150) break;
    const r = h01(x, 0, 113);
    const base = shoreRow + 6 + Math.floor(h01(x, 1, 113) * 8);
    if (r < 0.5) {
      bgPalm(p, x + r * 16, base, 46 + h01(x, 2, 113) * 30, (h01(x, 3, 113) - 0.45) * 26, beachPalm);
      if (h01(x, 4, 113) < 0.5) bgPalm(p, x + r * 16 + 9, base + 2, 34 + h01(x, 5, 113) * 16, (h01(x, 6, 113) - 0.3) * 20, beachPalm);
    } else if (r < 0.72) {
      const rw = 6 + r * 7;
      p.ellipse(x, base - 2, rw, 4.5, '#8a8a8e');
      p.ellipse(x - 1.5, base - 3.2, rw - 2.5, 2.6, '#a6a6aa');
      p.rect(x - rw, base - 1, rw * 2, 1, '#bfae86');
    } else if (r < 0.8) {
      // Beached rowboat.
      p.poly([x - 9, base - 5, x + 9, base - 5, x + 6, base, x - 7, base], '#8e7a66');
      p.rect(x - 9, base - 5, 18, 1, '#b8a48a');
      p.rect(x - 6, base - 4, 12, 1, '#6e8eac');
    }
  }
  // 2) Village: lagoon with stilt huts and the odd palm.
  const hutStyle = { wall: '#c4ae88', wallD: '#a48e6e', roof: '#c4ac76', roofL: '#d8c492', roofD: '#a08a5c', post: '#86725a', dark: '#66584a' };
  for (let x = Math.ceil(pz(M1.beachEnd - 20, F_NEAR)); x < pz(M1.villageEnd - 260, F_NEAR); x += 58) {
    const jx = x + Math.floor(h01(x, 0, 121) * 22);
    if (h01(x, 3, 121) < 0.35) bgPalm(p, jx - 16, shoreRow + 10, 40 + h01(x, 4, 121) * 20, -8, beachPalm);
    bgHut(p, jx, shoreRow + 6 + Math.floor(h01(x, 2, 121) * 3), 22 + Math.floor(h01(x, 1, 121) * 8), hutStyle);
  }
  // 3) Jungle: canopy top line, rising out of the lagoon at the end of the village.
  const jPres = (x: number) => ramp01(wz(x, F_NEAR), M1.villageEnd - 80, M1.villageEnd + 260);
  const ct: number[] = [];
  for (let x = 0; x < w; x++) {
    const pres = jPres(x);
    if (pres <= 0.02) {
      ct.push(bottom + 20);
      continue;
    }
    const base = row(118) + (noise1(x * 0.03, 7) - 0.5) * 18 + (noise1(x * 0.11, 8) - 0.5) * 6;
    ct.push(Math.round(base + (1 - pres) * 70));
  }
  // Transition: lone palms and broadleaf trees ahead of the wall.
  for (let x = 0; x < w; x += 31) {
    const xw = wz(x, F_NEAR);
    const t = ramp01(xw, M1.villageEnd - 420, M1.villageEnd + 40);
    if (t <= 0 || t >= 1 || h01(x, 0, 125) > 0.75) continue;
    if (h01(x, 1, 125) < 0.5) bgPalm(p, x, row(170), 50 + h01(x, 2, 125) * 26, (h01(x, 3, 125) - 0.5) * 18, jPlant);
    else bgTree(p, x, row(172), 58 + h01(x, 2, 125) * 22, jPlant, 10 + h01(x, 4, 125) * 4);
  }
  // Back row of the canopy (darker), then the body of the wall.
  for (let x = 0; x < w; x += 8) {
    if (ct[x] >= bottom) continue;
    leafClump(p, x + h01(x, 0, 131) * 6, ct[x] - 3, 7 + h01(x, 1, 131) * 5, PH.jungleDD, PH.jungleD, PH.jungle);
  }
  for (let x = 0; x < w; x++) if (ct[x] < bottom) p.rect(x, ct[x] + 3, 1, bottom - ct[x] - 3, PH.jungleD);
  // Shadowy interior clumps.
  for (let x = 0; x < w; x += 10) {
    if (ct[x] >= bottom - 20) continue;
    for (let k = 0; k < 3; k++) {
      const yy = ct[x] + 20 + k * 17 + h01(x, k, 132) * 9;
      if (yy > row(150)) break;
      const r = 5 + h01(x, k, 133) * 5;
      leafClump(p, x + h01(x, k, 134) * 8, yy, r, PH.jungleDD, h01(x, k, 135) < 0.6 ? PH.jungleD : PH.jungle, PH.jungle);
    }
  }
  // Emergent giants (trunk rising above the canopy, crown up high).
  const emergents: number[] = [];
  for (let x = 40; x < w; x += 70 + Math.floor(h01(x, 0, 136) * 60)) {
    if (jPres(x) < 0.85 || h01(x, 1, 136) > 0.7) continue;
    emergents.push(x);
    const topRow = row(62 + h01(x, 2, 136) * 22);
    const tw = 5;
    p.rect(x - 2, topRow + 6, tw, ct[x] - topRow, PH.trunkBg);
    p.rect(x - 2, topRow + 6, 1, ct[x] - topRow, PH.trunkBgL);
    p.rect(x + 2, topRow + 6, 1, ct[x] - topRow, PH.trunkBgD);
    p.line(x, topRow + 14, x - 9, topRow + 6, PH.trunkBg, 2);
    p.line(x, topRow + 18, x + 10, topRow + 9, PH.trunkBg, 2);
    leafClump(p, x - 11, topRow + 6, 9, PH.jungleDD, PH.jungle, PH.jungleL, '#86b890');
    leafClump(p, x + 12, topRow + 8, 8, PH.jungleDD, PH.jungle, PH.jungleL);
    leafClump(p, x, topRow, 11, PH.jungleDD, PH.jungle, PH.jungleL, '#86b890');
  }
  // Trunks below the canopy, with buttress roots behind the playfield ground line.
  const gr = row(188);
  for (let x = 12; x < w; x += 34 + Math.floor(h01(x, 0, 141) * 30)) {
    if (ct[x] >= row(150) || jPres(x) < 0.5) continue;
    const tw = 5 + Math.floor(h01(x, 1, 141) * 5);
    const t0 = ct[x] + 10;
    p.rect(x, t0, tw, gr - t0, PH.trunkBg);
    p.rect(x, t0, 1, gr - t0, PH.trunkBgL);
    p.rect(x + tw - 1, t0, 1, gr - t0, PH.trunkBgD);
    for (let k = 0; k < 4; k++) p.px(x + 1 + Math.floor(h01(x, k, 142) * (tw - 2)), t0 + 8 + Math.floor(h01(x, k, 143) * (gr - t0 - 10)), PH.trunkBgD);
    p.tri(x - 7, gr, x, gr - 20, x + 1, gr, PH.trunkBg);
    p.tri(x - 7, gr, x - 1, gr - 14, x - 3, gr, PH.trunkBgL);
    p.tri(x + tw + 7, gr, x + tw - 1, gr - 18, x + tw - 1, gr, PH.trunkBgD);
  }
  // Main canopy edge (lit) over the trunk tops.
  for (let x = 0; x < w; x += 10) {
    if (ct[x] >= bottom) continue;
    leafClump(p, x + h01(x, 0, 137) * 6, ct[x] + 3, 7 + h01(x, 1, 137) * 5, PH.jungleD, PH.jungle, PH.jungleL, h01(x, 2, 137) < 0.4 ? '#86b890' : undefined);
  }
  // Hanging vines.
  for (let x = 4; x < w; x += 9) {
    if (ct[x] >= row(140) || h01(x, 0, 151) > 0.33) continue;
    const len = 18 + h01(x, 1, 151) * 46;
    const y0 = ct[x] + 6;
    for (let y = 0; y < len; y++) {
      const vx = x + Math.sin((y + x) * 0.15) * 1.2;
      p.px(vx, y0 + y, PH.jungleDD);
      if (y % 6 === 3) {
        p.px(vx - 1, y0 + y, PH.jungle);
        p.px(vx + 1, y0 + y + 1, PH.jungleL);
      }
    }
  }
  // Understorey: a darker band of big leaves right behind the playfield ground.
  for (let x = 0; x < w; x++) {
    if (jPres(x) < 0.3) continue;
    const top = row(166) + Math.round((noise1(x * 0.09, 11) - 0.5) * 8);
    p.rect(x, top, 1, bottom - top, PH.jungleDD);
  }
  for (let x = 0; x < w; x += 9) {
    if (jPres(x) < 0.3) continue;
    const by = row(170) + h01(x, 1, 161) * 10;
    const lw = 6 + h01(x, 2, 161) * 6;
    const ang = (h01(x, 3, 161) - 0.5) * 1.8;
    const ex = x + Math.sin(ang) * lw * 1.5;
    const ey = by - Math.cos(ang) * lw * 1.3;
    p.line(x, by + 10, (x + ex) / 2, (by + ey) / 2 + 2, PH.jungleDD, 1.5);
    p.ellipse((x + ex) / 2 + 0.8, (by + ey) / 2 + 0.8, lw * 0.78, lw * 0.46, PH.jungleDD);
    p.ellipse((x + ex) / 2, (by + ey) / 2, lw * 0.75, lw * 0.42, PH.jungleD);
    p.ellipse((x + ex) / 2 - lw * 0.2, (by + ey) / 2 - lw * 0.15, lw * 0.4, lw * 0.2, PH.jungle);
  }
  // 4) Stockade: palisade wall with watchtowers in front of the jungle.
  const palTop = row(146);
  for (let x = 0; x < w; x++) {
    const xw = wz(x, F_NEAR);
    if (xw < M1.stockade - 260) continue;
    const log = Math.floor(x / 5);
    const k = x % 5;
    const pal = palTop + (h01(log, 0, 171) < 0.5 ? 0 : 3);
    const col = k === 0 ? '#8e7e60' : k === 4 ? '#5c5240' : k === 3 ? '#6c604a' : '#7a6c52';
    p.rect(x, pal, 1, bottom - pal, col);
    if (k >= 1 && k <= 3) p.px(x, pal - 1, col);
    if (k === 2) p.px(x, pal - 2, '#8e7e60');
  }
  for (let x = 0; x < w; x++) {
    const xw = wz(x, F_NEAR);
    if (xw < M1.stockade - 260) continue;
    p.px(x, palTop + 12, '#4e4636');
    p.px(x, palTop + 26, '#4e4636');
    if (x % 5 === 2) p.rect(x, palTop + 11, 1, 3, '#a89870'); // rope lashings
  }
  for (let x = 0; x < w; x++) {
    const xw = wz(x, F_NEAR);
    if (xw < M1.stockade - 200 || x % 150 !== 40) continue;
    const tb = palTop + 4;
    const tt = row(88);
    p.rect(x - 9, tt + 16, 2, tb - tt - 16, '#6a5c44');
    p.rect(x + 8, tt + 16, 2, tb - tt - 16, '#5a4e3a');
    p.line(x - 8, tt + 18, x + 8, tb - 2, '#5a4e3a');
    p.line(x + 8, tt + 18, x - 8, tb - 2, '#6a5c44');
    p.rect(x - 12, tt + 8, 25, 9, '#7a6c50');
    p.rect(x - 12, tt + 8, 25, 1, '#948464');
    for (let k = -10; k <= 10; k += 4) p.rect(x + k, tt + 10, 2, 5, '#665a42');
    p.poly([x - 15, tt + 8, x, tt - 2, x + 15, tt + 8], '#8a7a56');
    p.poly([x - 15, tt + 8, x, tt - 2, x - 2, tt + 8], '#a0906a');
    p.rect(x - 4, tt + 17, 8, 12, '#a85a48');
    p.rect(x - 4, tt + 17, 8, 1, '#c07060');
    p.rect(x - 1, tt + 21, 2, 2, '#d4b060');
  }
  void emergents;
  return p;
}

// ------------------------------------------------------------------ cached bake per level

interface Baked {
  key: string;
  sky: HTMLCanvasElement;
  sun: HTMLCanvasElement;
  cloudsHi: HTMLCanvasElement;
  cloudsLo: HTMLCanvasElement;
  far: HTMLCanvasElement;
  sea: HTMLCanvasElement;
  harbor: HTMLCanvasElement;
  hills: HTMLCanvasElement;
  near: HTMLCanvasElement;
  puffs: HTMLCanvasElement[];
}

let cache: Baked | null = null;

function sunArt(): PixelArt {
  const p = new PixelArt(48, 48);
  p.circle(24, 24, 23, '#fbf0c818');
  p.circle(24, 24, 18, '#fbf0c830');
  p.circle(24, 24, 14, '#fcf2cc58');
  p.circle(24, 24, 10.5, '#fff8e0');
  p.circle(23, 23, 8, '#fffcf0');
  return p;
}

function puffArt(r: number, light: boolean): PixelArt {
  const n = Math.ceil(r * 2 + 4);
  const p = new PixelArt(n, n);
  const c = n / 2;
  p.circle(c + 0.6, c + 0.8, r, light ? PH.plume : '#b4b8c6');
  p.circle(c, c, r - 0.6, light ? PH.plumeL : PH.plume);
  p.circle(c - r * 0.3, c - r * 0.3, r * 0.45, light ? '#f4f4f8' : PH.plumeL);
  return p;
}

function bake(level: LevelDef): Baked {
  const key = `${level.id}:${level.width}`;
  if (cache && cache.key === key) return cache;
  const W = level.width;
  const c = (a: PixelArt) => a.toCanvas();
  cache = {
    key,
    sky: c(bandedGradient(4, VIEW_H, [...PH.sky], 30)),
    sun: c(sunArt()),
    cloudsHi: c(cloudDeck(420, 46, 7, 5, PH.cloudFar, PH.cloudFarShade, '#ffffff', 0.7)),
    cloudsLo: c(cloudDeck(520, 54, 11, 4, PH.cloud, PH.cloudShade, '#ffffff', 1.1)),
    far: c(farPanorama(W)),
    sea: c(seaStrip()),
    harbor: c(harborPanorama(W)),
    hills: c(hillsPanorama(W)),
    near: c(nearPanorama(W)),
    puffs: [3, 4, 5, 6.5, 8, 9.5].flatMap((r) => [c(puffArt(r, false)), c(puffArt(r, true))]),
  };
  return cache;
}

/** Draw a window of a non-repeating panorama. */
function pano(g: CanvasRenderingContext2D, img: HTMLCanvasElement, camX: number, f: number, y: number): void {
  const sx = Math.max(0, Math.min(img.width - VIEW_W, Math.round(camX * f)));
  g.drawImage(img, sx, 0, VIEW_W, img.height, 0, Math.round(y), VIEW_W, img.height);
}

/** Tile a repeating strip with a scroll offset. */
function strip(g: CanvasRenderingContext2D, img: HTMLCanvasElement, off: number, y: number): void {
  const w = img.width;
  let x = -((((off % w) + w) % w));
  for (; x < VIEW_W; x += w) g.drawImage(img, Math.round(x), Math.round(y));
}

// ------------------------------------------------------------------ runtime

export function renderM1Background(g: CanvasRenderingContext2D, camX: number, camY: number, time: number, level: LevelDef): void {
  const B = bake(level);
  // Camera rise above the bottom of the level (>= 0): layers sink by their vertical factor.
  const up = Math.max(0, level.height - VIEW_H - camY);
  const xw = camX + VIEW_W / 2;
  g.drawImage(B.sky, 0, 0, VIEW_W, VIEW_H);
  // Sun (barely moves) and its glare.
  g.drawImage(B.sun, Math.round(150 - camX * 0.004) - 24, Math.round(58 + up * 0.02) - 24);
  // Clouds.
  g.globalAlpha = 0.9;
  strip(g, B.cloudsHi, camX * 0.02 + time * 1.4, 26 + up * 0.03);
  g.globalAlpha = 1;
  strip(g, B.cloudsLo, camX * 0.035 + time * 2.6, 62 + up * 0.04);
  // Far islands + volcano and its plume.
  const skyY = up * YF_SKYLINE;
  pano(g, B.far, camX, F_FAR, Y_FAR + skyY);
  drawPlume(g, B, VOLC_X - Math.max(0, Math.min(B.far.width - VIEW_W, Math.round(camX * F_FAR))), Y_FAR + skyY + FAR_H - VOLC_H + 1, time);
  // Sea + glints.
  strip(g, B.sea, camX * F_SEA + time * 1.2, HORIZON + skyY);
  drawGlints(g, camX, HORIZON + skyY, time);
  // Harbor (lighthouse, boats) and its blinking lamp.
  pano(g, B.harbor, camX, F_HARBOR, Y_HARBOR + skyY);
  const lx = LIGHT_X - Math.max(0, Math.min(B.harbor.width - VIEW_W, Math.round(camX * F_HARBOR)));
  if (lx > -10 && lx < VIEW_W + 10 && Math.sin(time * 2.4) > 0.2) {
    g.fillStyle = '#fff8c8';
    g.fillRect(Math.round(lx) - 1, Math.round(Y_HARBOR + skyY + LIGHT_TOP + 2), 2, 2);
    g.globalAlpha = 0.35;
    g.fillRect(Math.round(lx) - 3, Math.round(Y_HARBOR + skyY + LIGHT_TOP + 3), 6, 1);
    g.globalAlpha = 1;
  }
  // Gulls over the sea (fade out inland).
  const gullK = 1 - ramp01(xw, M1.villageEnd - 300, M1.villageEnd + 300);
  if (gullK > 0.02) drawGulls(g, camX, time, gullK);
  // Jungle hills (+ Legion chimney smoke at the end).
  const hillsY = Y_HILLS + up * YF_HILLS;
  pano(g, B.hills, camX, F_HILLS, hillsY);
  const hx = Math.max(0, Math.min(B.hills.width - VIEW_W, Math.round(camX * F_HILLS)));
  for (const [cxp, row] of chimneys) {
    const sx = cxp - hx;
    if (sx < -30 || sx > VIEW_W + 10) continue;
    drawChimneySmoke(g, B, sx, hillsY + row, time);
  }
  // Near layer.
  pano(g, B.near, camX, F_NEAR, Y_NEAR + up * YF_NEAR);
}

function drawPlume(g: CanvasRenderingContext2D, B: Baked, cx: number, cy: number, time: number): void {
  if (cx < -80 || cx > VIEW_W + 20) return;
  const N = 9;
  for (let i = 0; i < N; i++) {
    const t = (time * 0.035 + i / N) % 1;
    const rise = t * 58;
    const x = cx + t * t * 46 + Math.sin(t * 6 + i) * 2;
    const y = cy - rise;
    const k = Math.min(5, Math.floor(t * 6));
    const img = B.puffs[k * 2 + (t > 0.35 ? 1 : 0)];
    g.globalAlpha = t < 0.08 ? t / 0.08 : t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1;
    g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
  }
  g.globalAlpha = 1;
}

function drawChimneySmoke(g: CanvasRenderingContext2D, B: Baked, cx: number, cy: number, time: number): void {
  const N = 5;
  for (let i = 0; i < N; i++) {
    const t = (time * 0.09 + i / N + cx * 0.01) % 1;
    const img = B.puffs[Math.min(3, Math.floor(t * 4)) * 2];
    g.globalAlpha = (t > 0.6 ? (1 - t) / 0.4 : 1) * 0.8;
    g.drawImage(img, Math.round(cx + t * 16 - img.width / 2), Math.round(cy - t * 26 - img.height / 2));
  }
  g.globalAlpha = 1;
}

function drawGlints(g: CanvasRenderingContext2D, camX: number, y0: number, time: number): void {
  g.fillStyle = PH.seaGlint;
  const off = camX * F_SEA + time * 1.2;
  for (let i = 0; i < 26; i++) {
    const depth = h01(i, 1, 201);
    const y = Math.round(y0 + 3 + depth * depth * 34);
    const period = 420;
    const x = Math.round((((h01(i, 2, 201) * period - off * (0.6 + depth)) % period) + period) % period) - 18;
    if (x < -4 || x > VIEW_W) continue;
    const s = Math.sin(time * (2 + h01(i, 3, 201) * 3) + i * 1.7);
    if (s < 0.55) continue;
    const len = s > 0.9 ? 3 : 1 + Math.round(depth * 2);
    g.fillRect(x, y, len, 1);
    if (s > 0.93) g.fillRect(x + Math.floor(len / 2), y - 1, 1, 3);
  }
}

function drawGulls(g: CanvasRenderingContext2D, camX: number, time: number, k: number): void {
  g.globalAlpha = k;
  for (let i = 0; i < 4; i++) {
    const period = 640 + i * 90;
    const speed = 9 + i * 3;
    const x = Math.round(((((h01(i, 0, 211) * period - time * speed - camX * 0.06) % period) + period) % period) - 60);
    if (x < -8 || x > VIEW_W + 8) continue;
    const y = Math.round(46 + i * 13 + Math.sin(time * 0.8 + i * 2) * 4);
    const flap = Math.floor(time * 5 + i) % 6;
    const up = flap < 2 ? 1 : 0;
    // Gliding gull: white body, grey wing tips, an "m" shape.
    g.fillStyle = '#f8f8f4';
    g.fillRect(x - 1, y, 3, 1);
    g.fillRect(x - 3, y - 1 - up, 2, 1);
    g.fillRect(x + 2, y - 1 - up, 2, 1);
    g.fillStyle = '#7a8494';
    g.fillRect(x - 4, y - up, 1, 1);
    g.fillRect(x + 4, y - up, 1, 1);
  }
  g.globalAlpha = 1;
}
