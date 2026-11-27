// Palm Harbor terrain textures. The ground fill and edge are "panorama" textures as wide as the
// level (the theme renderer indexes them with world x modulo their width), so the surface can change
// along the level: dry beach sand with shells and dune grass, a gravel river bed, red jungle soil
// under a grass edge, and a trampled dirt road at the Legion depot and stockade.
// Pure PixelArt (no DOM).

import { PixelArt, parseColor, shade } from '../../../engine/pixelart';
import { M1, PH, h01, noise1, ramp01 } from './layout';

/** Texture width: >= the level width, so every world column is unique. */
export const WIDE = 8192;
/** Rows of the edge strip drawn above the surface line. */
export const EDGE_UP = 4;
const EDGE_H = 14;
const FILL_H = 32;

/** 1 = sand, 0 = jungle soil (blend band around the end of the village). */
export function sandness(x: number): number {
  return 1 - ramp01(x, M1.villageEnd - 70, M1.villageEnd + 110);
}

function riverBed(x: number): boolean {
  return x >= M1.riverX0 - 4 && x <= M1.riverX1 + 4;
}

/** 0..1: how trampled the jungle floor is (dirt road at the depot plateau and the stockade). */
function trampled(x: number): number {
  const depot = ramp01(x, M1.plateauX0 + 20, M1.plateauX0 + 80) * (1 - ramp01(x, M1.plateauX1 - 40, M1.plateauX1 + 20));
  const stock = ramp01(x, M1.stockade - 120, M1.stockade + 120);
  return Math.max(depot * 0.75, stock * 0.6);
}

/** Wide ground fill (WIDE x 32, tiles vertically). */
export function m1GroundTile(): PixelArt {
  const p = new PixelArt(WIDE, FILL_H);
  const d = p.data;
  const sandCols = [PH.sand, PH.sandD, PH.sandL, PH.sandDD, PH.shell, PH.shellP];
  const soilCols = [PH.soil, PH.soilD, PH.soilL, PH.soilDD];
  const gravCols = [PH.gravel, PH.gravelD, PH.gravelL];
  const sandV = sandCols.map((c) => parseColor(c));
  const soilV = soilCols.map((c) => parseColor(c));
  const gravV = gravCols.map((c) => parseColor(c));
  for (let x = 0; x < WIDE; x++) {
    const s = sandness(x);
    const river = riverBed(x);
    for (let y = 0; y < FILL_H; y++) {
      const r = h01(x, y, 7);
      const r2 = h01(x, y, 19);
      let v: number;
      if (river) {
        v = r < 0.22 ? gravV[1] : r < 0.34 ? gravV[2] : gravV[0];
      } else if (r2 < s) {
        // Sand: fine speckle with faint horizontal strata and the odd shell fragment.
        const strata = noise1(y * 0.35 + Math.floor(x / 23) * 0.05, 3) > 0.62;
        v = r < 0.09 ? sandV[1] : r < 0.13 ? sandV[2] : r < 0.135 ? sandV[4] : r < 0.138 ? sandV[5] : strata && r < 0.4 ? sandV[1] : sandV[0];
        if (r > 0.995) v = sandV[3];
      } else {
        v = r < 0.12 ? soilV[1] : r < 0.2 ? soilV[2] : r < 0.215 ? soilV[3] : soilV[0];
      }
      d[y * WIDE + x] = v;
    }
  }
  // Pebbles / shells: small lit ellipses, wrapped vertically.
  for (let cx = 0; cx < WIDE; cx += 9) {
    for (let cy = 0; cy < FILL_H; cy += 11) {
      const r = h01(cx, cy, 31);
      if (r > 0.42) continue;
      const x = cx + Math.floor(h01(cx, cy, 32) * 8);
      const y = cy + Math.floor(h01(cx, cy, 33) * 10);
      const s = sandness(x);
      const river = riverBed(x);
      const big = h01(cx, cy, 34) < 0.3;
      let base: string;
      if (river) base = h01(x, y, 2) < 0.5 ? PH.gravelL : '#8a8a84';
      else if (h01(x, y, 3) < s) {
        if (r > 0.16) continue;
        base = h01(x, y, 4) < 0.5 ? PH.shell : PH.sandDD;
      } else base = r < 0.2 ? PH.pebble : '#9a7a5c';
      for (const oy of [0, -FILL_H, FILL_H]) {
        const rx = big ? 1.6 : 1.1;
        const ry = big ? 1.1 : 0.8;
        p.ellipse(x + 0.5, y + 0.6 + oy, rx + 0.4, ry + 0.4, shade(base, -0.38));
        p.ellipse(x + 0.2, y + 0.3 + oy, rx, ry, base);
        p.px(x - 1 + (big ? 0 : 1), y - (big ? 1 : 0) + oy, shade(base, 0.35));
      }
    }
  }
  // Roots in the jungle soil (short dark wiggles).
  for (let x0 = 0; x0 < WIDE; x0 += 37) {
    if (sandness(x0) > 0.5 || riverBed(x0) || h01(x0, 1, 41) > 0.45) continue;
    let x = x0 + Math.floor(h01(x0, 2, 41) * 20);
    let y = 3 + Math.floor(h01(x0, 3, 41) * 24);
    const n = 6 + Math.floor(h01(x0, 4, 41) * 8);
    for (let i = 0; i < n; i++) {
      p.px(x, ((y % FILL_H) + FILL_H) % FILL_H, PH.root);
      x += 1;
      if (h01(x, y, 42) < 0.4) y += h01(x, y, 43) < 0.5 ? 1 : -1;
    }
  }
  return p;
}

/** Wide edge strip: EDGE_UP rows above the surface (grass blades, tufts, shells) + the top band. */
export function m1GroundEdge(): PixelArt {
  const p = new PixelArt(WIDE, EDGE_H);
  const U = EDGE_UP;
  for (let x = 0; x < WIDE; x++) {
    const sandy = h01(x, 0, 51) < sandness(x);
    if (riverBed(x)) {
      // Gravel bed: light top, a few stones.
      p.px(x, U, PH.gravelL);
      p.px(x, U + 1, h01(x, 1, 52) < 0.5 ? PH.gravel : PH.gravelL);
      if (h01(x, 2, 52) < 0.25) p.px(x, U - 1, PH.gravelD);
      continue;
    }
    if (sandy) {
      // Sunlit rim + a wind-swept lighter band; wet/dark speckles below.
      p.px(x, U, PH.sandLL);
      p.px(x, U + 1, h01(x, 3, 53) < 0.25 ? PH.sandLL : PH.sandL);
      p.px(x, U + 2, h01(x, 4, 53) < 0.5 ? PH.sandL : PH.sand);
      if (h01(x, 5, 53) < 0.12) p.px(x, U + 3, PH.sandD);
      // Shells sitting on the surface.
      if (h01(x, 6, 53) < 0.025) {
        p.px(x, U - 1, h01(x, 7, 53) < 0.5 ? PH.shell : PH.shellP);
        p.px(x + 1, U - 1, PH.whiteD);
      }
      continue;
    }
    // Jungle grass (thinner and patchier where it is trampled).
    const tr = trampled(x);
    const bare = h01(x >> 3, 9, 54) < tr * 0.8;
    const band = bare ? 2 : 4 + Math.floor(h01(x, 10, 54) * 2);
    for (let y = U; y < U + band; y++) {
      const top = y === U;
      let c: string = top ? PH.grassL : h01(x, y, 55) < 0.22 ? PH.grassD : PH.grass;
      if (bare) c = top ? '#b4825a' : h01(x, y, 56) < 0.4 ? PH.soilL : '#9a6a46';
      p.px(x, y, c);
    }
    if (!bare) {
      const drip = Math.floor(h01(x, 11, 54) * 4);
      for (let y = U + band; y < U + band + drip; y++) p.px(x, y, y === U + band + drip - 1 ? PH.grassDD : PH.grassD);
      // Blades above the surface.
      const blade = Math.floor(h01(x, 12, 54) * (U + 1) * (1 - tr * 0.7));
      for (let y = U - blade; y < U; y++) p.px(x, y, y === U - blade ? PH.grassL : PH.grass);
    }
  }
  // Tufts: dune grass on the beach, fern-like clumps in the jungle, flowers here and there.
  for (let x0 = 4; x0 < WIDE - 8; x0 += 13) {
    const r = h01(x0, 0, 61);
    const x = x0 + Math.floor(h01(x0, 1, 61) * 8);
    if (riverBed(x)) continue;
    const s = sandness(x);
    if (h01(x, 2, 61) < s) {
      // Dune grass tuft (sparser near the waterline at the start of the beach).
      if (r > 0.16 || x < 180 || (x > M1.lagoonX0 - 30 && x < M1.lagoonX1 + 30)) continue;
      const hgt = 3 + Math.floor(h01(x, 3, 61) * 2);
      for (let k = -2; k <= 2; k++) {
        const bh = hgt - Math.abs(k);
        for (let y = U - bh; y < U + 1; y++) p.px(x + k + (y < U - 2 ? Math.sign(k) : 0), y, y === U - bh ? PH.beachGrass : PH.beachGrassD);
      }
    } else if (r < 0.1 * (1 - trampled(x))) {
      // Tiny flowers in the grass.
      const col = h01(x, 4, 61) < 0.5 ? '#f4e46a' : '#f2a0c0';
      p.px(x, U - 2, col);
      p.px(x, U - 1, PH.grassD);
    }
  }
  return p;
}

/** Basalt boulder blocks with moss (static solids). */
export function m1SolidTile(): PixelArt {
  const W = 32;
  const H = 24;
  const p = new PixelArt(W, H);
  p.rect(0, 0, W, H, PH.rockD);
  // Irregular stones (rows offset like rough masonry).
  const rows = [
    [0, 0, 12, 10],
    [12, 0, 11, 10],
    [23, 0, 9, 10],
    [-5, 10, 13, 14],
    [8, 10, 12, 14],
    [20, 10, 12, 14],
    [32 - 5, 10, 13, 14],
  ];
  rows.forEach(([x, y, w, h], i) => {
    const c = shade(PH.rock, (h01(i, 0, 71) - 0.5) * 0.16);
    p.rect(x + 1, y + 1, w - 1, h - 1, c);
    p.rect(x + 1, y + 1, w - 1, 1, shade(c, 0.25));
    p.rect(x + 1, y + 1, 1, h - 1, shade(c, 0.12));
    p.rect(x + 1, y + h - 1, w - 1, 1, shade(c, -0.22));
    for (let k = 0; k < 3; k++) p.px(x + 2 + Math.floor(h01(i, k, 72) * (w - 4)), y + 2 + Math.floor(h01(i, k, 73) * (h - 4)), shade(c, -0.18));
  });
  return p;
}

/** Moss cap on top of solids. */
export function m1SolidEdge(): PixelArt {
  const W = 32;
  const p = new PixelArt(W, 7);
  for (let x = 0; x < W; x++) {
    const hgt = 1 + Math.floor(h01(x, 0, 81) * 2);
    for (let y = 2 - hgt + 1; y < 2; y++) p.px(x, y, PH.mossL);
    p.px(x, 2, PH.mossL);
    p.px(x, 3, PH.moss);
    if (h01(x, 1, 81) < 0.6) p.px(x, 4, PH.moss);
    if (h01(x, 2, 81) < 0.25) p.px(x, 5, '#4e7a38');
  }
  return p;
}
