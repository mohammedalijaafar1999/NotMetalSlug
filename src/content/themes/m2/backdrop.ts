// Mission 2 backdrop: a time-of-day sky (noon at the canyon mouth -> sunset over the salt flat,
// driven by camera progress), a sun, drifting haze, circling vultures and three parallax layers:
//  - FAR: tiled hazy mesas and buttes on the horizon (with heat shimmer near the horizon),
//  - MID: a level-long panorama of canyon walls whose shape follows the level's regions
//         (desert buttes, a ruined temple, tall strata walls with an arch, the gorge, mesas,
//         oil derricks with nodding pumps and a flare stack, the open salt flat),
//  - NEAR: a panorama of dunes, saguaros, rubble, telegraph poles, pipelines and tanks.
// Regions come from level decor markers { kind: 'm2_bg', x, props: { region } } (sorted by x).
// Every layer is baked once per time-of-day keyframe (lazily) and crossfaded.

import { PixelArt, mixColor, shade } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import type { LevelDef } from '../../../game/level';
import { TODS, todAt, type Tod } from './palette';
import { renderCtx } from './terrain';

export type Region = 'desert' | 'ruins' | 'canyon' | 'gorge' | 'mesa' | 'oil' | 'salt';
const REGIONS: Region[] = ['desert', 'ruins', 'canyon', 'gorge', 'mesa', 'oil', 'salt'];

interface Mark {
  x: number;
  region: Region;
}

/** Region markers of a level (defaults spread evenly when a level has none). */
export function regionMarks(level: LevelDef): Mark[] {
  const marks = (level.decor ?? [])
    .filter((d) => d.kind === 'm2_bg' && REGIONS.includes(d.props?.region))
    .map((d) => ({ x: d.x, region: d.props!.region as Region }))
    .sort((a, b) => a.x - b.x);
  if (marks.length) return marks;
  return REGIONS.map((region, i) => ({ x: (i / REGIONS.length) * level.width, region }));
}

const BLEND = 220;

/** Region weights at world x (linear crossfade over +-BLEND around each boundary). */
export function regionWeights(marks: Mark[], x: number): Map<Region, number> {
  const w = new Map<Region, number>();
  let i = 0;
  while (i + 1 < marks.length && x >= marks[i + 1].x) i++;
  const cur = marks[i];
  const next = marks[i + 1];
  const prev = marks[i - 1];
  const add = (r: Region, v: number) => w.set(r, (w.get(r) ?? 0) + v);
  if (next && x > next.x - BLEND) {
    const t = (x - (next.x - BLEND)) / (2 * BLEND);
    add(cur.region, 1 - t);
    add(next.region, t);
  } else if (prev && x < cur.x + BLEND) {
    const t = (x - (cur.x - BLEND)) / (2 * BLEND);
    add(prev.region, 1 - t);
    add(cur.region, t);
  } else add(cur.region, 1);
  return w;
}

// ------------------------------------------------------------------ layer geometry

/** Screen-space placement when the camera sits at the level bottom. */
const FAR = { top: 88, h: 128, f: 0.08, yf: 0.03, period: 512 };
const MID = { top: 44, h: 172, f: 0.2, yf: 0.45 };
const NEAR = { top: 126, h: 90, f: 0.4, yf: 0.7 };
const HAZE = { top: 14, h: 78, f: 0.03, yf: 0.05, period: 640, speed: 4 };

const TAU = Math.PI * 2;

function stripWidth(levelW: number, f: number): number {
  return Math.ceil(VIEW_W + Math.max(0, levelW - VIEW_W) * f) + 4;
}

/** World x seen at the screen center when strip column u is there. */
function worldOfStrip(u: number, f: number): number {
  return (u - VIEW_W / 2) / f + VIEW_W / 2;
}

function noise1(x: number, seed: number, comps: Array<[number, number]>): number {
  let v = 0;
  for (const [freq, amp] of comps) v += Math.sin(x * freq + seed * 1.7 + freq * 13.1) * amp;
  return v;
}

// ------------------------------------------------------------------ FAR layer

function bakeFar(t: Tod): PixelArt {
  const W = FAR.period;
  const H = FAR.h;
  const p = new PixelArt(W, H);
  const r = new Rng(77);
  const plain = 64;
  const base = mixColor(t.far.base, t.haze, 0.25);
  const lit = mixColor(t.far.lit, t.haze, 0.2);
  const sh = mixColor(t.far.shadow, t.haze, 0.25);
  const plainC = mixColor(t.far.base, t.haze, 0.45);
  // Distant plain.
  p.rect(0, plain, W, H - plain, plainC);
  p.rect(0, plain, W, 1, mixColor(plainC, t.haze, 0.5));
  for (let y = plain + 6; y < H; y += 7) p.rect(0, y, W, 1, mixColor(plainC, t.far.shadow, 0.25));
  // Mesas and buttes: [cx, topW, baseW, height]
  const shapes: Array<[number, number, number, number]> = [];
  let x = 10;
  while (x < W - 10) {
    const kind = r.weighted([
      ['mesa', 3],
      ['butte', 2],
      ['spire', 1],
    ] as const);
    const h = kind === 'mesa' ? r.int(22, 40) : kind === 'butte' ? r.int(30, 52) : r.int(34, 50);
    const topW = kind === 'mesa' ? r.int(40, 90) : kind === 'butte' ? r.int(12, 24) : r.int(3, 6);
    const baseW = topW + (kind === 'spire' ? r.int(10, 16) : r.int(16, 30));
    shapes.push([x + baseW / 2, topW, baseW, h]);
    x += baseW + r.int(-12, 30);
  }
  const heights = new Float32Array(W);
  const owner = new Int16Array(W).fill(-1);
  shapes.forEach(([cx, topW, baseW, h], i) => {
    for (let k = -baseW; k <= baseW; k++) {
      const xx = Math.round(cx + k);
      const d = Math.abs(k);
      let hh = 0;
      if (d <= topW / 2) hh = h;
      else if (d <= baseW / 2) {
        const s = (d - topW / 2) / Math.max(1, (baseW - topW) / 2);
        // Steep cliff band then a talus slope.
        hh = s < 0.45 ? h * (1 - s * 0.35) : h * (0.84 - (s - 0.45) * 1.5);
      }
      const wx = ((xx % W) + W) % W;
      if (hh > heights[wx]) {
        heights[wx] = hh;
        owner[wx] = i;
      }
    }
  });
  for (let xx = 0; xx < W; xx++) {
    const h = Math.round(heights[xx]);
    if (h <= 0) continue;
    const top = plain - h;
    const left = heights[(xx - 1 + W) % W];
    const right = heights[(xx + 1) % W];
    const c = right < h - 0.5 && left >= h - 0.5 ? sh : left < h - 0.5 ? lit : base;
    p.rect(xx, top, 1, h, c);
    p.px(xx, top, lit);
    // Faint strata lines.
    for (let y = top + 4; y < plain - 2; y += 5) if ((xx + y) % 11 !== 0) p.px(xx, y, mixColor(c, t.far.shadow, 0.35));
  }
  return p;
}

// ------------------------------------------------------------------ MID layer (panorama)

interface MidCol {
  top: number;
  canyon: number;
  oil: number;
  salt: number;
  ruins: number;
  gorge: number;
}

function midProfile(marks: Mark[], u: number): MidCol {
  const wx = worldOfStrip(u, MID.f);
  const w = regionWeights(marks, wx);
  const g = (r: Region) => w.get(r) ?? 0;
  const n = (seed: number, comps: Array<[number, number]>) => noise1(u, seed, comps);
  const tops: Record<Region, number> = {
    desert: 96 + n(1, [[0.021, 9], [0.057, 4], [0.13, 1.5]]),
    ruins: 100 + n(2, [[0.025, 6], [0.07, 3]]),
    canyon: 26 + n(3, [[0.017, 12], [0.045, 7], [0.11, 3], [0.29, 1]]),
    gorge: 58 + n(4, [[0.02, 8], [0.06, 4], [0.2, 1]]),
    mesa: 34 + n(5, [[0.015, 10], [0.05, 5], [0.17, 1.5]]),
    oil: 104 + n(6, [[0.03, 5], [0.09, 2]]),
    salt: 126 + n(7, [[0.05, 1.5], [0.013, 2]]),
  };
  let top = 0;
  for (const rg of REGIONS) top += tops[rg] * g(rg);
  // Mesa / canyon tops are flattened (cap rock) in steps.
  const flat = g('canyon') + g('mesa');
  if (flat > 0.5) top = Math.round(top / 6) * 6 * flat + top * (1 - flat);
  return { top, canyon: g('canyon') + g('mesa') * 0.8, oil: g('oil'), salt: g('salt'), ruins: g('ruins'), gorge: g('gorge') };
}

function bakeMid(t: Tod, marks: Mark[], levelW: number): PixelArt {
  const W = stripWidth(levelW, MID.f);
  const H = MID.h;
  const p = new PixelArt(W, H);
  const haze = (c: string, k = 0.22) => mixColor(c, t.haze, k);
  const bands = t.mid.bands.map((c) => haze(c));
  const lit = haze(t.mid.lit, 0.15);
  const shadow = haze(t.mid.shadow);
  const dark = haze(t.mid.dark, 0.18);
  const cols: MidCol[] = [];
  for (let u = 0; u < W; u++) cols.push(midProfile(marks, u));
  for (let u = 0; u < W; u++) {
    const c = cols[u];
    const top = Math.round(c.top);
    const prevTop = Math.round(cols[Math.max(0, u - 1)].top);
    const nextTop = Math.round(cols[Math.min(W - 1, u + 1)].top);
    // Strata body: band index by layer y (wavy), grooves darken.
    const groove = (Math.sin(u * 0.19) + Math.sin(u * 0.053 + 1.1)) > 1.35 || (u % 37 < 2 && c.canyon > 0.4);
    for (let y = top; y < H; y++) {
      const wave = Math.round(Math.sin(u * 0.03 + y * 0.02) * 1.5);
      let col = bands[Math.floor((y + wave) / 5) % bands.length];
      if (groove) col = mixColor(col, shadow, 0.55);
      // Undercut shadow under ledges every ~22 px.
      if ((y + wave) % 22 === 0) col = mixColor(col, dark, 0.5);
      // Faces exposed by a drop: lit on the left (light from the top-left), shaded on the right.
      if (y < nextTop + 1) col = mixColor(col, shadow, 0.5);
      else if (y < prevTop) col = mixColor(col, lit, 0.45);
      // Ground haze toward the bottom.
      if (y > H - 36) col = mixColor(col, t.haze, Math.min(0.55, (y - (H - 36)) / 70));
      p.px(u, y, col);
    }
    // Lit rim.
    p.px(u, top, lit);
    // Gorge interior: a dark cleft band.
    if (c.gorge > 0.3) {
      const k = (c.gorge - 0.3) / 0.7;
      for (let y = H - 44; y < H; y++) p.px(u, y, mixColor(dark, shade(dark, -0.2), Math.min(1, k * ((y - (H - 44)) / 44))));
    }
  }
  const r = new Rng(91);
  // ---- features
  for (let u = 20; u < W - 40; u++) {
    const c = cols[u];
    // Natural arch in the canyon walls.
    if (c.canyon > 0.95 && u % 520 === 140) drawArch(p, u, Math.round(c.top), t);
    // Desert hoodoos.
    if ((c.top > 80 && c.salt < 0.2 && c.oil < 0.2 && c.ruins < 0.3 && u % 97 === 13) || (c.ruins > 0.2 && u % 211 === 31)) {
      drawHoodoo(p, u, Math.round(c.top), r.int(16, 28), t, bands);
    }
    // Ruined temple.
    if (c.ruins > 0.8 && u % 400 === 200) drawTemple(p, u, Math.round(c.top), t);
    // Oil derricks and tanks.
    if (c.oil > 0.6 && u % 61 === 7) drawFarDerrick(p, u, Math.round(c.top), r.int(36, 56), t);
    if (c.oil > 0.6 && u % 173 === 40) drawFarTank(p, u, Math.round(c.top), t);
  }
  return p;
}

function drawArch(p: PixelArt, u: number, top: number, t: Tod): void {
  const sky = mixColor(t.sky[2], t.sky[3], 0.5);
  const lit = mixColor(t.mid.lit, t.haze, 0.15);
  const sh = mixColor(t.mid.shadow, t.haze, 0.2);
  // Punch an arch opening through the wall (sky shows through), shade its rim.
  const cx = u + 26;
  const cy = top + 46;
  const inside = (x: number, y: number) => ((x - cx) / 18) ** 2 + ((y - cy) / 26) ** 2 < 1;
  for (let y = top + 16; y < top + 46; y++) {
    for (let x = u + 6; x < u + 46; x++) {
      if (!inside(x, y)) continue;
      p.px(x, y, sky);
      if (!inside(x, y - 1)) p.px(x, y - 1, sh);
      if (!inside(x - 1, y)) p.px(x - 1, y, sh);
      if (!inside(x + 1, y)) p.px(x + 1, y, lit);
    }
  }
}

function drawHoodoo(p: PixelArt, u: number, top: number, h: number, t: Tod, bands: string[]): void {
  const base = mixColor(bands[2], t.haze, 0.1);
  const sh = mixColor(t.mid.shadow, t.haze, 0.2);
  const lit = mixColor(t.mid.lit, t.haze, 0.1);
  const y0 = top - h;
  // Column with a cap rock.
  for (let y = y0 + 4; y <= top + 2; y++) {
    const k = (y - y0) / h;
    const w = 3 + Math.round(Math.sin(k * 9) * 0.8 + k * 3);
    p.rect(u - w, y, w * 2 + 1, 1, base);
    p.px(u - w, y, lit);
    p.rect(u + w - 1, y, 2, 1, sh);
  }
  p.rect(u - 6, y0, 13, 4, mixColor(bands[0], t.mid.dark, 0.2));
  p.rect(u - 6, y0, 13, 1, lit);
  p.rect(u - 5, y0 + 3, 11, 1, sh);
}

function drawTemple(p: PixelArt, u: number, top: number, t: Tod): void {
  const stone = mixColor('#d6b68a', t.mid.bands[0], 0.45);
  const base = mixColor(stone, t.haze, 0.3);
  const lit = mixColor(shade(stone, 0.18), t.haze, 0.25);
  const sh = mixColor(shade(stone, -0.25), t.haze, 0.25);
  const dark = mixColor(t.mid.dark, t.haze, 0.2);
  const y = top + 6;
  // Stepped base.
  for (let s = 0; s < 4; s++) {
    const w = 96 - s * 16;
    const yy = y - (s + 1) * 7;
    p.rect(u - w / 2, yy, w, 7, base);
    p.rect(u - w / 2, yy, w, 1, lit);
    p.rect(u + w / 2 - 3, yy, 3, 7, sh);
  }
  // Colonnade on top (some columns broken).
  const ty = y - 28;
  const heights = [22, 22, 9, 22, 15, 22];
  for (let i = 0; i < 6; i++) {
    const cx = u - 25 + i * 10;
    const hh = heights[i];
    p.rect(cx - 2, ty - hh, 5, hh, base);
    p.rect(cx - 2, ty - hh, 1, hh, lit);
    p.rect(cx + 2, ty - hh, 1, hh, sh);
    if (hh === 22) p.rect(cx - 3, ty - hh - 2, 7, 2, lit);
  }
  // Remaining lintel over the first columns + dark doorway.
  p.rect(u - 29, ty - 26, 34, 3, base);
  p.rect(u - 29, ty - 26, 34, 1, lit);
  p.rect(u - 5, y - 13, 10, 13, dark);
}

function drawFarDerrick(p: PixelArt, u: number, top: number, h: number, t: Tod): void {
  const c = mixColor(t.near.metalD, t.haze, 0.35);
  const y0 = top + 4;
  for (let y = 0; y < h; y++) {
    const half = 1 + Math.round((y / h) * 5);
    p.px(u - half, y0 - y, c);
    p.px(u + half, y0 - y, c);
    if (y % 6 === 0) p.rect(u - half, y0 - y, half * 2 + 1, 1, c);
    if (y % 6 === 3) {
      p.px(u - half + 1, y0 - y, c);
      p.px(u + half - 1, y0 - y, c);
    }
  }
  p.rect(u - 2, y0 - h - 2, 5, 2, c);
  p.rect(u, y0 - h - 5, 1, 3, c);
}

function drawFarTank(p: PixelArt, u: number, top: number, t: Tod): void {
  const c = mixColor(t.near.metal, t.haze, 0.35);
  const sh = mixColor(t.near.metalD, t.haze, 0.3);
  const y = top + 6;
  p.rect(u - 14, y - 16, 28, 16, c);
  p.rect(u - 13, y - 18, 26, 2, c);
  p.rect(u + 8, y - 16, 6, 16, sh);
  p.rect(u - 14, y - 9, 28, 1, sh);
}

// ------------------------------------------------------------------ NEAR layer (panorama)

function bakeNear(t: Tod, marks: Mark[], levelW: number): PixelArt {
  const W = stripWidth(levelW, NEAR.f);
  const H = NEAR.h;
  const p = new PixelArt(W, H);
  const base = mixColor(t.near.base, t.haze, 0.12);
  const lit = mixColor(t.near.lit, t.haze, 0.1);
  const sh = mixColor(t.near.shadow, t.haze, 0.12);
  const tops = new Float32Array(W);
  const regs: Map<Region, number>[] = [];
  for (let u = 0; u < W; u++) {
    const w = regionWeights(marks, worldOfStrip(u, NEAR.f));
    regs.push(w);
    const g = (r: Region) => w.get(r) ?? 0;
    const n = (seed: number, comps: Array<[number, number]>) => noise1(u, seed, comps);
    const v: Record<Region, number> = {
      desert: 34 + n(11, [[0.018, 7], [0.05, 3], [0.15, 0.8]]),
      ruins: 38 + n(12, [[0.03, 4], [0.09, 2]]),
      canyon: 28 + n(13, [[0.026, 6], [0.07, 4], [0.21, 1.5]]),
      gorge: 34 + n(14, [[0.03, 5], [0.11, 2]]),
      mesa: 30 + n(15, [[0.024, 6], [0.08, 3]]),
      oil: 44 + n(16, [[0.02, 3], [0.06, 1.5]]),
      salt: 56 + n(17, [[0.04, 0.8]]),
    };
    let top = 0;
    for (const rg of REGIONS) top += v[rg] * g(rg);
    tops[u] = top;
  }
  for (let u = 0; u < W; u++) {
    const top = Math.round(tops[u]);
    const nt = Math.round(tops[Math.min(W - 1, u + 1)]);
    const pt = Math.round(tops[Math.max(0, u - 1)]);
    for (let y = top; y < H; y++) {
      let c = base;
      if (y < top + 2) c = lit;
      else if ((u * 3 + y * 7) % 23 === 0) c = sh;
      if (y > H - 26) c = mixColor(c, t.haze, Math.min(0.4, (y - (H - 26)) / 50));
      p.px(u, y, c);
    }
    if (nt > top) for (let y = top; y < Math.min(H, nt + 3); y++) p.px(u, y, sh);
    if (pt > top) for (let y = top; y < Math.min(H, pt); y++) p.px(u, y, lit);
  }
  const r = new Rng(133);
  for (let u = 10; u < W - 30; u++) {
    const w = regs[u];
    const g = (rg: Region) => w.get(rg) ?? 0;
    const top = Math.round(tops[u]);
    if ((g('desert') > 0.6 || g('canyon') > 0.6 || g('mesa') > 0.6) && u % 83 === 17) drawSaguaroSil(p, u, top + 1, r.int(18, 30), r.int(0, 2), t);
    if ((g('desert') > 0.5 || g('gorge') > 0.5 || g('mesa') > 0.5) && u % 47 === 5) drawBoulders(p, u, top + 1, t);
    if (g('ruins') > 0.6 && u % 71 === 9) drawRuinSil(p, u, top + 1, r.int(0, 3), t);
    if (g('ruins') > 0.6 && u % 109 === 50) drawPalmSil(p, u, top + 1, t);
    if (g('canyon') > 0.7 && u % 131 === 60) drawPoleSil(p, u, top + 1, t, (tops[Math.min(W - 1, u + 131)] ?? top) + 1);
    if (g('oil') > 0.6 && u % 157 === 30) drawTankSil(p, u, top + 1, t);
    if (g('salt') > 0.6 && u % 151 === 70) drawBoulders(p, u, top + 1, t, true);
  }
  // Oil field pipeline running along the near layer.
  for (let u = 0; u < W; u++) {
    const o = regs[u].get('oil') ?? 0;
    if (o < 0.55) continue;
    const y = Math.round(tops[u]) - 8;
    const pipe = mixColor(t.near.metal, t.haze, 0.1);
    const pipeD = mixColor(t.near.metalD, t.haze, 0.1);
    p.px(u, y, shade(pipe, 0.15));
    p.px(u, y + 1, pipe);
    p.px(u, y + 2, pipeD);
    if (u % 40 === 0) p.rect(u - 1, y + 3, 2, 6, pipeD);
    if (u % 40 === 20) p.rect(u - 1, y - 1, 3, 5, pipeD);
  }
  return p;
}

function drawSaguaroSil(p: PixelArt, u: number, base: number, h: number, arms: number, t: Tod): void {
  const c = mixColor(t.near.plant, t.near.shadow, 0.35);
  const d = mixColor(t.near.plantD, t.near.shadow, 0.35);
  p.rect(u - 2, base - h, 4, h, c);
  p.rect(u + 1, base - h + 1, 1, h - 1, d);
  p.rect(u - 1, base - h - 1, 2, 1, c);
  if (arms >= 1) {
    const ay = base - Math.round(h * 0.55);
    p.rect(u + 2, ay, 4, 3, c);
    p.rect(u + 4, ay - 8, 3, 10, c);
    p.rect(u + 6, ay - 8, 1, 10, d);
  }
  if (arms >= 2 || arms === 0) {
    const ay = base - Math.round(h * 0.4);
    p.rect(u - 6, ay, 4, 3, c);
    p.rect(u - 7, ay - 6, 3, 8, c);
  }
}

function drawBoulders(p: PixelArt, u: number, base: number, t: Tod, small = false): void {
  const c = mixColor(t.near.base, t.near.lit, 0.3);
  const s = small ? 0.6 : 1;
  p.ellipse(u, base - 4 * s, 7 * s, 5 * s, c);
  p.ellipse(u + 8 * s, base - 3 * s, 5 * s, 3.5 * s, c);
  p.ellipse(u - 1, base - 6 * s, 4 * s, 2.5 * s, mixColor(c, t.near.lit, 0.5));
}

function drawRuinSil(p: PixelArt, u: number, base: number, v: number, t: Tod): void {
  const stone = mixColor('#c8a878', t.near.base, 0.55);
  const lit = mixColor(stone, t.near.lit, 0.4);
  const sh = mixColor(stone, t.near.shadow, 0.5);
  if (v === 0 || v === 2) {
    // Broken column.
    const h = v === 0 ? 30 : 18;
    p.rect(u - 3, base - h, 7, h, stone);
    p.rect(u - 3, base - h, 1, h, lit);
    p.rect(u + 3, base - h, 1, h, sh);
    for (let y = base - h + 6; y < base; y += 7) p.rect(u - 3, y, 7, 1, sh);
    p.rect(u - 4, base - 3, 9, 3, stone);
  } else {
    // Wall fragment with a window.
    p.rect(u - 14, base - 22, 28, 22, stone);
    p.rect(u - 14, base - 22, 28, 1, lit);
    p.rect(u - 3, base - 16, 6, 9, sh);
    p.rect(u + 6, base - 26, 8, 4, stone);
    for (let y = base - 18; y < base; y += 6) p.rect(u - 14, y, 28, 1, mixColor(stone, sh, 0.5));
  }
}

function drawPalmSil(p: PixelArt, u: number, base: number, t: Tod): void {
  const trunk = mixColor('#8a6a48', t.near.shadow, 0.4);
  const leaf = mixColor(t.near.plant, t.near.shadow, 0.3);
  for (let y = 0; y < 30; y++) p.rect(u + Math.round(Math.sin(y / 14) * 3), base - y, 2, 1, trunk);
  const tx = u + Math.round(Math.sin(30 / 14) * 3);
  const ty = base - 30;
  for (const [dx, dy] of [
    [-12, 4],
    [-9, -4],
    [0, -6],
    [9, -3],
    [12, 5],
  ]) p.line(tx, ty, tx + dx, ty + dy, leaf, 2);
}

function drawPoleSil(p: PixelArt, u: number, base: number, t: Tod, nextBase: number): void {
  const c = mixColor(t.near.shadow, t.near.metalD, 0.3);
  p.rect(u, base - 34, 2, 34, c);
  p.rect(u - 4, base - 31, 10, 1, c);
  // Sagging wires to the next pole (131 px on).
  for (const dy of [-31, -28]) {
    for (let k = 0; k <= 131; k++) {
      const sag = Math.sin((k / 131) * Math.PI) * 7;
      const y = Math.round(base + dy + ((nextBase - base) * k) / 131 + sag);
      p.px(u + k, y, mixColor(c, t.haze, 0.3));
    }
  }
}

function drawTankSil(p: PixelArt, u: number, base: number, t: Tod): void {
  const c = mixColor(t.near.metal, t.near.base, 0.2);
  const lit = mixColor(c, t.near.lit, 0.4);
  const sh = mixColor(t.near.metalD, t.near.shadow, 0.3);
  p.rect(u - 18, base - 22, 36, 22, c);
  p.ellipse(u, base - 22, 18, 3, c);
  p.rect(u - 18, base - 22, 2, 22, lit);
  p.rect(u + 12, base - 22, 6, 22, sh);
  p.rect(u - 18, base - 12, 36, 1, sh);
  p.rect(u - 8, base - 28, 2, 6, sh);
  // Ladder.
  for (let y = base - 22; y < base; y += 3) p.rect(u + 4, y, 4, 1, sh);
}

// ------------------------------------------------------------------ HAZE layer (tiled)

function bakeHaze(t: Tod): PixelArt {
  const W = HAZE.period;
  const p = new PixelArt(W, HAZE.h);
  const r = new Rng(55);
  for (let i = 0; i < 14; i++) {
    const y = r.int(4, HAZE.h - 6);
    const x0 = r.int(0, W - 1);
    const len = r.int(30, 110);
    const c = r.chance(0.5) ? t.haze : t.hazeD;
    for (let k = 0; k < len; k++) {
      const x = (x0 + k) % W;
      const thick = k > 4 && k < len - 6 && r.chance(0.6) ? 2 : 1;
      p.rect(x, y, 1, thick, c);
      if (k > 10 && k < len - 12 && (k + i) % 9 === 0) p.px(x, y - 1, c);
    }
  }
  return p;
}

// ------------------------------------------------------------------ renderer state

interface Baked {
  far: (HTMLCanvasElement | null)[];
  mid: (HTMLCanvasElement | null)[];
  near: (HTMLCanvasElement | null)[];
  haze: (HTMLCanvasElement | null)[];
}

let cache: { level: LevelDef; marks: Mark[]; baked: Baked } | null = null;

function state(level: LevelDef) {
  if (!cache || cache.level !== level) {
    const n = TODS.length;
    cache = { level, marks: regionMarks(level), baked: { far: Array(n).fill(null), mid: Array(n).fill(null), near: Array(n).fill(null), haze: Array(n).fill(null) } };
  }
  return cache;
}

type LayerKey = keyof Baked;

function bake(level: LevelDef, layer: LayerKey, k: number): HTMLCanvasElement {
  const s = state(level);
  const got = s.baked[layer][k];
  if (got) return got;
  const t = TODS[k];
  const art = layer === 'far' ? bakeFar(t) : layer === 'mid' ? bakeMid(t, s.marks, level.width) : layer === 'near' ? bakeNear(t, s.marks, level.width) : bakeHaze(t);
  const c = art.toCanvas();
  s.baked[layer][k] = c;
  return c;
}

/** Bake at most one missing upcoming keyframe per call (spreads the work over frames). */
function prebake(level: LevelDef, k: number): void {
  const s = state(level);
  for (const kk of [k, k + 1, k + 2]) {
    if (kk >= TODS.length) continue;
    for (const L of ['haze', 'far', 'mid', 'near'] as LayerKey[]) {
      if (!s.baked[L][kk]) {
        bake(level, L, kk);
        return;
      }
    }
  }
}

/** Progress 0..1 through the level for the time of day. */
export function progressAt(level: LevelDef, camX: number): number {
  return Math.max(0, Math.min(1, camX / Math.max(1, level.width - VIEW_W - 160)));
}

function drawTiled(g: CanvasRenderingContext2D, c: HTMLCanvasElement, off: number, y: number): void {
  const w = c.width;
  let x = ((off % w) + w) % w - w;
  for (; x < VIEW_W; x += w) g.drawImage(c, Math.round(x), y);
}

/** Heat shimmer: redraw the horizon rows of a tiled layer with small sideways wobble. */
function drawShimmer(g: CanvasRenderingContext2D, c: HTMLCanvasElement, off: number, y: number, rows: [number, number], amp: number, time: number): void {
  const w = c.width;
  for (let ry = rows[0]; ry < rows[1]; ry += 2) {
    const dx = Math.round(Math.sin(time * 5.3 + ry * 0.83) * amp + Math.sin(time * 3.1 + ry * 0.37) * amp * 0.5);
    if (!dx) continue;
    let x = ((off % w) + w) % w - w + dx;
    for (; x < VIEW_W; x += w) g.drawImage(c, 0, ry, w, 2, Math.round(x), y + ry, w, 2);
  }
}

function layerY(top: number, yf: number, camY: number, level: LevelDef): number {
  const base = Math.max(0, level.height - VIEW_H);
  return Math.round(top - (camY - base) * yf);
}

// Vultures circling: [center x, center y, radius x, radius y, period, phase]
const VULTURES: Array<[number, number, number, number, number, number]> = [
  [118, 40, 26, 9, 11, 0],
  [146, 50, 20, 7, 9, 2.1],
  [312, 34, 30, 10, 13, 4.2],
];

function drawVulture(g: CanvasRenderingContext2D, x: number, y: number, flap: boolean, dir: number, color: string): void {
  g.fillStyle = color;
  const X = Math.round(x);
  const Y = Math.round(y);
  g.fillRect(X - 1, Y, 3, 1);
  if (flap) {
    g.fillRect(X - 4, Y - 1, 3, 1);
    g.fillRect(X + 2, Y - 1, 3, 1);
    g.fillRect(X - 5, Y - 2, 1, 1);
    g.fillRect(X + 5, Y - 2, 1, 1);
  } else {
    g.fillRect(X - 4, Y, 3, 1);
    g.fillRect(X + 2, Y, 3, 1);
    g.fillRect(X - 5, Y + 1, 1, 1);
    g.fillRect(X + 5, Y + 1, 1, 1);
  }
  g.fillRect(X + dir * 2, Y - 1, 1, 1);
}

function drawSun(g: CanvasRenderingContext2D, t: Tod, sx: number, sy: number): void {
  const r = t.sun.r;
  g.globalAlpha = 0.16;
  g.fillStyle = t.sun.glow;
  for (const rr of [r + 18, r + 11, r + 6]) {
    circle(g, sx, sy, rr);
  }
  g.globalAlpha = 1;
  // Disc, with retro gaps across the lower half at sunset.
  const rows = Math.ceil(r);
  for (let dy = -rows; dy <= rows; dy++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (half <= 0) continue;
    if (t.sun.stripes && dy > 1) {
      const gap = Math.floor((dy - 1) / 3);
      if ((dy - 1) % 4 < Math.min(3, gap * 0.5 + 0.5)) continue;
    }
    g.fillStyle = dy < -r * 0.35 ? t.sun.core : mixColor(t.sun.core, t.sun.rim, Math.min(1, (dy + r * 0.35) / (r * 1.35)));
    g.fillRect(Math.round(sx - half), Math.round(sy + dy), half * 2 + 1, 1);
  }
}

function circle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

// Background pumpjacks in the MID layer's oil region: strip u positions are derived at bake time.
let pumpCache: { level: LevelDef; us: number[]; flares: number[]; tops: number[]; ftops: number[] } | null = null;

function oilProps(level: LevelDef) {
  if (pumpCache && pumpCache.level === level) return pumpCache;
  const marks = state(level).marks;
  const W = stripWidth(level.width, MID.f);
  const us: number[] = [];
  const tops: number[] = [];
  const flares: number[] = [];
  const ftops: number[] = [];
  for (let u = 0; u < W; u++) {
    const c = midProfile(marks, u);
    if (c.oil > 0.7 && u % 53 === 26) {
      us.push(u);
      tops.push(Math.round(c.top));
    }
    if (c.oil > 0.8 && u % 240 === 120) {
      flares.push(u);
      ftops.push(Math.round(c.top));
    }
  }
  pumpCache = { level, us, flares, tops, ftops };
  return pumpCache;
}

function drawBgPump(g: CanvasRenderingContext2D, x: number, y: number, time: number, color: string, phase: number): void {
  const a = Math.sin(time * 2.2 + phase);
  g.fillStyle = color;
  // A-frame.
  g.fillRect(x - 3, y - 1, 7, 1);
  g.fillRect(x - 2, y - 4, 1, 3);
  g.fillRect(x + 2, y - 4, 1, 3);
  g.fillRect(x - 1, y - 6, 3, 2);
  // Walking beam rocking around (x, y - 7).
  for (let k = -6; k <= 6; k++) g.fillRect(x + k, Math.round(y - 7 - k * a * 0.25), 1, 1);
  // Horse head and the rod.
  const hy = Math.round(y - 7 + 6 * a * 0.25);
  g.fillRect(x - 8, hy - 1, 2, 3);
  g.fillRect(x - 7, hy + 2, 1, Math.max(1, y - hy - 2));
  // Counterweight.
  g.fillRect(x + 4, Math.round(y - 5 - 4 * a * 0.25), 2, 2);
}

function drawFlare(g: CanvasRenderingContext2D, x: number, y: number, time: number, t: Tod): void {
  const stack = mixColor(t.near.metalD, t.haze, 0.35);
  g.fillStyle = stack;
  g.fillRect(x, y - 30, 2, 30);
  g.fillRect(x - 1, y - 31, 4, 2);
  const f = Math.floor(time * 12) % 3;
  g.fillStyle = '#ffd070';
  g.fillRect(x, y - 34 - f, 2, 3 + f);
  g.fillStyle = '#ff8a3a';
  g.fillRect(x - 1, y - 33, 1, 2);
  g.fillRect(x + 2, y - 32 - (f & 1), 1, 2);
  g.globalAlpha = 0.5;
  g.fillStyle = mixColor(t.haze, '#5a5060', 0.5);
  for (let i = 0; i < 4; i++) {
    const k = (time * 0.6 + i * 0.25) % 1;
    g.fillRect(Math.round(x - 1 - k * 14), Math.round(y - 37 - k * 16), 3 + Math.round(k * 3), 2);
  }
  g.globalAlpha = 1;
}

/** Full background render (screen space). */
export function renderBackdrop(g: CanvasRenderingContext2D, camX: number, camY: number, time: number, level: LevelDef): void {
  renderCtx.level = level;
  const prog = progressAt(level, camX);
  const t = todAt(prog);
  const kf = prog * (TODS.length - 1);
  const k0 = Math.min(TODS.length - 2, Math.floor(kf));
  const fr = kf - k0;
  // Sky bands.
  const bands = 27;
  for (let i = 0; i < bands; i++) {
    const s = i / (bands - 1);
    const seg = s * (t.sky.length - 1);
    const k = Math.min(t.sky.length - 2, Math.floor(seg));
    g.fillStyle = mixColor(t.sky[k], t.sky[k + 1], seg - k);
    const y0 = Math.floor((i / bands) * VIEW_H);
    const y1 = Math.floor(((i + 1) / bands) * VIEW_H);
    g.fillRect(0, y0, VIEW_W, y1 - y0);
  }
  const base = Math.max(0, level.height - VIEW_H);
  const lift = base - camY; // > 0 when the camera is above the level bottom
  drawSun(g, t, t.sun.x - camX * 0.004, t.sun.y + lift * 0.12);
  // Layers (crossfaded keyframes).
  const pass = (draw: (k: number) => void) => {
    draw(k0);
    if (fr > 0.02) {
      g.globalAlpha = fr;
      draw(k0 + 1);
      g.globalAlpha = 1;
    }
  };
  pass((k) => drawTiled(g, bake(level, 'haze', k), -(camX * HAZE.f + time * HAZE.speed), layerY(HAZE.top, HAZE.yf, camY, level)));
  // Vultures.
  const vc = mixColor(t.mid.dark, t.sky[1], 0.25);
  for (const [cx, cy, rx, ry, per, ph] of VULTURES) {
    const a = (time / per) * TAU + ph;
    const x = cx + Math.cos(a) * rx - camX * 0.01;
    const vx = ((x % (VIEW_W + 40)) + VIEW_W + 40) % (VIEW_W + 40) - 20;
    drawVulture(g, vx, cy + Math.sin(a) * ry + lift * 0.1, Math.floor(time * 3 + ph) % 4 === 0, -Math.sin(a) >= 0 ? 1 : -1, vc);
  }
  const farY = layerY(FAR.top, FAR.yf, camY, level);
  const farOff = -camX * FAR.f;
  pass((k) => drawTiled(g, bake(level, 'far', k), farOff, farY));
  if (t.shimmer > 0.15) pass((k) => drawShimmer(g, bake(level, 'far', k), farOff, farY, [40, 70], t.shimmer, time));
  const midY = layerY(MID.top, MID.yf, camY, level);
  const midX = Math.round(-camX * MID.f);
  pass((k) => g.drawImage(bake(level, 'mid', k), midX, midY));
  // Animated oil field silhouettes on the mid layer.
  const op = oilProps(level);
  const pumpC = mixColor(t.near.metalD, t.haze, 0.3);
  op.us.forEach((u, i) => {
    const x = midX + u;
    if (x < -20 || x > VIEW_W + 20) return;
    drawBgPump(g, x, midY + op.tops[i] + 3, time, pumpC, i * 1.7);
  });
  op.flares.forEach((u, i) => {
    const x = midX + u;
    if (x < -20 || x > VIEW_W + 20) return;
    drawFlare(g, x, midY + op.ftops[i] + 4, time, t);
  });
  const nearY = layerY(NEAR.top, NEAR.yf, camY, level);
  const nearX = Math.round(-camX * NEAR.f);
  pass((k) => g.drawImage(bake(level, 'near', k), nearX, nearY));
  prebake(level, k0);
}
