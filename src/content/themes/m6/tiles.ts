// IRON CITADEL terrain textures (pure PixelArt, tileable) and the catwalk platform renderer.
//  - ground: riveted steel deck plates (diamond-tread on every other plate) over a darker sub-floor
//  - ground edge: a worn bright steel lip with bolt heads (1 row above the surface line)
//  - solids: soot-stained firebrick bound by riveted iron straps, capped with an iron rim
//  - platforms: grated steel catwalks ('grate', default) and riveted I-beam girders ('girder'),
//    baked once per platform into a cached canvas (drawn at zero per-frame cost)

import { PixelArt, shade } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { M6, hash01 } from './palette';

const mod = (a: number, m: number) => ((a % m) + m) % m;

/** Steel deck plates, 64 x 32 (two staggered rows of 32 x 16 plates). */
export function floorTile(): PixelArt {
  const W = 64;
  const H = 32;
  const p = new PixelArt(W, H);
  p.rect(0, 0, W, H, M6.steel);
  const r = new Rng(61);
  for (let row = 0; row < 2; row++) {
    const off = row ? 16 : 0;
    for (let col = -1; col < 3; col++) {
      const x0 = col * 32 + off;
      const y0 = row * 16;
      const tread = (col + row) % 2 === 0;
      const base = shade(M6.steel, r.range(-0.06, 0.05));
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 32; x++) {
          const X = mod(x0 + x, W);
          const Y = y0 + y;
          let c: string = base;
          if (y === 0 || x === 0) c = M6.steelL;
          else if (y === 15 || x === 31) c = M6.steelD;
          else if (tread && x > 2 && x < 29 && y > 2 && y < 13) {
            // diamond tread: short alternating diagonal dashes
            const cell = ((x >> 2) + (y >> 2)) & 1;
            const u = x & 3;
            const v = y & 3;
            if (cell ? u === v : u === 3 - v) c = (u + v) % 3 === 0 ? M6.steelL : shade(base, 0.1);
          }
          p.px(X, Y, c);
        }
      }
      for (const [rx, ry] of [
        [2, 2],
        [29, 2],
        [2, 13],
        [29, 13],
      ]) {
        p.px(mod(x0 + rx, W), y0 + ry, M6.steelLL);
        p.px(mod(x0 + rx + 1, W), y0 + ry + 1, M6.steelDD);
      }
    }
  }
  // grime and scuffs
  for (let i = 0; i < 46; i++) {
    const x = r.int(0, W - 1);
    const y = r.int(0, H - 1);
    p.px(x, y, r.chance(0.6) ? shade(M6.steel, -0.18) : shade(M6.steel, 0.12));
  }
  return p;
}

/** Surface lip for the steel deck (use with groundEdgeUp = 1). 64 x 7. */
export function floorEdge(): PixelArt {
  const W = 64;
  const p = new PixelArt(W, 7);
  for (let x = 0; x < W; x++) {
    // row 0 (above the surface): bolt heads every 16 px
    const b = x % 16;
    if (b === 6 || b === 7) p.px(x, 0, b === 6 ? M6.steelLLL : M6.steelLL);
    p.px(x, 1, hash01(x, 1, 7) < 0.12 ? M6.steelLL : M6.steelLLL);
    p.px(x, 2, M6.steelLL);
    p.px(x, 3, hash01(x, 3, 7) < 0.2 ? M6.steelL : shade(M6.steelL, 0.06));
    p.px(x, 4, M6.steelD);
    p.px(x, 5, M6.steelDD);
    if (b === 6 || b === 7) {
      p.px(x, 2, b === 6 ? M6.steelLLL : M6.steelL);
      p.px(x, 3, M6.steelD);
    }
  }
  // scuff marks on the lip
  const r = new Rng(17);
  for (let i = 0; i < 5; i++) {
    const x = r.int(0, W - 6);
    for (let k = 0; k < r.int(2, 5); k++) p.px(x + k, 2, M6.steelL);
  }
  return p;
}

/** Soot-stained firebrick with riveted iron straps every 32 px. 32 x 32. */
export function brickSolidTile(): PixelArt {
  const W = 32;
  const H = 32;
  const p = new PixelArt(W, H);
  const r = new Rng(23);
  p.rect(0, 0, W, H, M6.mortar);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 8 : 0;
    for (let col = -1; col < 3; col++) {
      const x = col * 16 + off;
      const y = row * 8;
      const c = shade(M6.brick, r.range(-0.14, 0.08));
      for (let yy = 1; yy < 8; yy++) {
        for (let xx = 1; xx < 16; xx++) {
          let cc = c;
          if (yy === 1) cc = shade(c, 0.16);
          else if (yy === 7) cc = shade(c, -0.22);
          else if (hash01(x + xx, y + yy, 5) < 0.08) cc = shade(c, -0.2);
          p.px(mod(x + xx, W), y + yy, cc);
        }
      }
    }
  }
  // iron strap (vertical) with rivets
  for (let y = 0; y < H; y++) {
    p.px(0, y, M6.ironL);
    p.px(1, y, M6.iron);
    p.px(2, y, M6.iron);
    p.px(3, y, M6.ironD);
    if (y % 8 === 3) {
      p.px(1, y, M6.steelLL);
      p.px(2, y + 1, M6.ironD);
    }
  }
  // soot streaks
  for (let i = 0; i < 4; i++) {
    const x = r.int(6, W - 2);
    const y0 = r.int(0, H - 8);
    for (let k = 0; k < r.int(4, 9); k++) p.px(x, mod(y0 + k, H), shade(M6.brickD, -0.25));
  }
  return p;
}

/** Iron cap on top of solids. 32 x 6 (use with solidEdgeUp = 1). */
export function solidEdge(): PixelArt {
  const W = 32;
  const p = new PixelArt(W, 6);
  for (let x = 0; x < W; x++) {
    if (x % 8 === 4) p.px(x, 0, M6.steelLL);
    p.px(x, 1, M6.steelLL);
    p.px(x, 2, M6.ironL);
    p.px(x, 3, x % 8 === 4 ? M6.steelLL : M6.iron);
    p.px(x, 4, M6.ironD);
    p.px(x, 5, M6.steelDD);
  }
  return p;
}

// ------------------------------------------------------------------ platforms

const platCache = new Map<string, HTMLCanvasElement>();

/** Bake a platform (grated catwalk / girder) into PixelArt. Exported for previews and tests. */
export function platformArt(x1: number, y1: number, x2: number, y2: number, style: string): { art: PixelArt; ox: number; oy: number } {
  const w = Math.max(1, Math.round(x2 - x1));
  const dy = Math.round(y2 - y1);
  const top = Math.min(0, dy);
  const girder = style === 'girder';
  const depth = girder ? 9 : 7;
  const hang = 10; // room for braces under the deck
  const H = Math.abs(dy) + depth + hang + 2;
  const p = new PixelArt(w + 2, H);
  const oy = 1 - top; // canvas row of platform y at x1
  const yAt = (i: number) => Math.round(oy + (w <= 1 ? 0 : (dy * i) / w));
  const o = M6.outline;
  for (let i = 0; i < w; i++) {
    const X = i + 1;
    const y = yAt(i);
    p.px(X, y - 1, o);
    if (girder) {
      // riveted I-beam: flange, web with lightening holes, flange
      p.px(X, y, M6.steelLLL);
      p.px(X, y + 1, M6.steelLL);
      p.px(X, y + 2, M6.ironD);
      const hole = i % 12 >= 4 && i % 12 <= 7;
      p.px(X, y + 3, hole ? M6.steelDD : M6.iron);
      p.px(X, y + 4, hole ? M6.steelDD : M6.iron);
      p.px(X, y + 5, M6.ironD);
      p.px(X, y + 6, M6.ironL);
      p.px(X, y + 7, M6.ironD);
      p.px(X, y + 8, o);
      if (i % 12 === 1) p.px(X, y + 1, M6.steelLLL);
    } else {
      // grated catwalk: bright tread, grate bars (see-through holes), bottom stringer
      p.px(X, y, M6.steelLLL);
      p.px(X, y + 1, M6.steelLL);
      const bar = i % 3 === 0;
      if (bar) {
        p.px(X, y + 2, M6.steelL);
        p.px(X, y + 3, M6.steelD);
      }
      p.px(X, y + 4, M6.steelL);
      p.px(X, y + 5, M6.ironD);
      p.px(X, y + 6, o);
      if (!bar) {
        // outline the holes faintly so the grate reads against bright backgrounds
        p.px(X, y + 2, M6.steelDD);
      }
    }
  }
  // end caps
  for (const i of [0, w - 1]) {
    const X = i + 1;
    const y = yAt(i);
    for (let k = 0; k < depth - 1; k++) if (!p.opaque(X, y + k)) p.px(X, y + k, M6.ironD);
    p.px(i === 0 ? 0 : w + 1, y, o);
    for (let k = 0; k < depth; k++) p.px(i === 0 ? 0 : w + 1, y - 1 + k, o);
  }
  // braces / hangers every ~40 px
  const n = Math.max(1, Math.round(w / 40));
  for (let k = 0; k < n; k++) {
    const i = Math.round(((k + 0.5) * w) / n);
    if (i < 3 || i > w - 4) continue;
    const X = i + 1;
    const y = yAt(i) + depth - 1;
    for (let j = 0; j < hang - 2; j++) {
      p.px(X - Math.floor(j / 2), y + j, o);
      p.px(X - Math.floor(j / 2) + 1, y + j, M6.iron);
      p.px(X - Math.floor(j / 2) + 2, y + j, o);
    }
  }
  return { art: p, ox: 1, oy };
}

/** ThemeDef.platform: draw a baked, cached catwalk/girder. */
export function drawPlatform(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, style: string): void {
  const key = `${Math.round(x1)},${Math.round(y1)},${Math.round(x2)},${Math.round(y2)},${style}`;
  let c = platCache.get(key);
  const { ox, oy } = { ox: 1, oy: 1 - Math.min(0, Math.round(y2 - y1)) };
  if (!c) {
    c = platformArt(x1, y1, x2, y2, style).art.toCanvas();
    if (platCache.size > 400) platCache.clear();
    platCache.set(key, c);
  }
  g.drawImage(c, Math.round(x1) - ox, Math.round(y1) - oy);
}
