// STORMFRONT terrain textures: riveted gunmetal hull plating (solids), a steel deck edge with a
// brass railing above and a lit porthole band below (solidEdge), cloud-bank ground (the kill floor
// far below is never in view, but the textures still read as cloud if it ever is) and catwalk /
// gangway / girder platforms. Everything tiles seamlessly (period 32 px).

import { PixelArt, shade } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { P5 } from './palette';
import { bayer } from './sky';

/** Riveted hull plating: 8 px strakes with staggered seams, rivet rows and light weathering. */
export function hullTile(): PixelArt {
  const W = 32;
  const H = 32;
  const p = new PixelArt(W, H);
  const r = new Rng(505);
  for (let row = 0; row < H / 8; row++) {
    const y0 = row * 8;
    const off = row % 2 ? 8 : 0;
    for (let col = -1; col < 3; col++) {
      const x0 = col * 16 + off;
      const base = shade(P5.hull, r.range(-0.05, 0.05));
      for (let y = y0; y < y0 + 8; y++) {
        for (let x = x0; x < x0 + 16; x++) {
          const xx = ((x % W) + W) % W;
          let c = base;
          if (y === y0) c = shade(base, 0.2);
          else if (y === y0 + 7) c = P5.hullD;
          else if (x === x0) c = P5.hullDD;
          else if (x === x0 + 1) c = shade(base, 0.12);
          else if (y === y0 + 6) c = shade(base, -0.12);
          p.px(xx, y, c);
        }
      }
      // Rivets along the strake's upper edge and the seam.
      for (let x = x0 + 3; x < x0 + 16; x += 4) {
        const xx = ((x % W) + W) % W;
        p.px(xx, y0 + 2, shade(base, 0.42));
        p.px((xx + 1) % W, y0 + 3, P5.hullDD);
      }
      // Weathering streak under a rivet now and then.
      if (r.chance(0.35)) {
        const sx = (((x0 + r.int(3, 13)) % W) + W) % W;
        for (let y = y0 + 3; y < y0 + 3 + r.int(2, 4); y++) p.px(sx, y, shade(base, -0.18));
      }
    }
  }
  return p;
}

/**
 * Deck edge strip for solids: 5 rows of railing above the surface (brass handrail on posts),
 * then the steel deck plate, a brass trim line and a band of lit portholes.
 */
export const DECK_UP = 5;
export function deckEdge(): PixelArt {
  const W = 32;
  const p = new PixelArt(W, DECK_UP + 16);
  const U = DECK_UP;
  // Railing.
  for (let x = 0; x < W; x++) {
    p.px(x, 0, x % 2 ? P5.brass : P5.brassL);
    p.px(x, 1, P5.brassD);
  }
  for (let x = 3; x < W; x += 8) {
    for (let y = 2; y < U; y++) p.px(x, y, P5.brassD);
    p.px(x, 2, P5.brass);
  }
  // Mid rail (thin).
  for (let x = 0; x < W; x++) if (x % 8 !== 3) p.px(x, 3, '#6e5020a0');
  // Deck plate (tread pattern).
  for (let x = 0; x < W; x++) {
    p.px(x, U, P5.hullLL);
    p.px(x, U + 1, (x + 1) % 4 === 0 ? P5.hullLL : P5.hullL);
    p.px(x, U + 2, (x + 3) % 4 === 0 ? P5.hullL : shade(P5.hullL, -0.1));
    p.px(x, U + 3, P5.hullD);
    // Brass trim with rivets.
    p.px(x, U + 4, x % 6 === 1 ? P5.brassL : P5.brass);
    p.px(x, U + 5, P5.brassD);
  }
  // Porthole band.
  for (let x = 0; x < W; x++) {
    for (let y = U + 6; y < U + 15; y++) p.px(x, y, y === U + 6 ? shade(P5.hull, 0.15) : P5.hull);
    p.px(x, U + 15, P5.hullDD);
  }
  for (const cx of [7.5, 23.5]) {
    const cy = U + 10.5;
    p.circle(cx, cy, 3.2, P5.brassD);
    p.circle(cx - 0.3, cy - 0.3, 2.6, P5.brass);
    p.circle(cx, cy, 1.9, P5.windowD);
    p.circle(cx - 0.2, cy - 0.2, 1.3, P5.window);
    p.px(Math.floor(cx) - 1, Math.floor(cy) - 1, '#fff4c8');
  }
  return p;
}

/** Cloud-bank fill (kill floor; normally far out of view). */
export function cloudGroundTile(): PixelArt {
  const p = new PixelArt(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) p.px(x, y, bayer(x, y) < 0.35 ? P5.seaShade : P5.seaDeep);
  return p;
}

/** Billowy cloud-top edge (4 rows of puffs above the surface line). */
export const CLOUD_UP = 4;
export function cloudGroundEdge(): PixelArt {
  const p = new PixelArt(32, CLOUD_UP + 7);
  for (const [cx, rad] of [
    [4, 4],
    [12, 5],
    [21, 4.5],
    [29, 4],
  ] as const) {
    for (const o of [-32, 0, 32]) {
      p.circle(cx + o, CLOUD_UP + 3, rad, P5.seaBody);
      p.circle(cx + o - 1, CLOUD_UP + 2, rad - 1.5, P5.seaLight);
    }
  }
  for (let x = 0; x < 32; x++) {
    for (let y = 0; y < p.h; y++) {
      if (!p.opaque(x, y)) continue;
      p.px(x, y, P5.seaRim);
      break;
    }
  }
  return p;
}

// ------------------------------------------------------------------ platforms

function px(g: CanvasRenderingContext2D, c: string, x: number, y: number, w = 1, h = 1): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

/**
 * Platform styles (one-way):
 *  'catwalk' (default): steel grating walkway with a truss underneath
 *  'gangway': wooden boarding planks with rope hand-lines
 *  'girder': riveted brass-trimmed I-beam (crane arms, mast yards)
 */
export function stormPlatform(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, style: string): void {
  const xa = Math.round(x1);
  const xb = Math.round(x2);
  const yAt = (x: number) => Math.round(y1 + (y2 - y1) * ((x - xa) / Math.max(1, xb - xa)));
  if (style === 'gangway') {
    for (let x = xa; x < xb; x++) {
      const y = yAt(x);
      px(g, P5.dark, x, y - 1, 1, 6);
      const plank = Math.floor((x - xa) / 6) % 2;
      px(g, plank ? P5.woodL : '#c08a54', x, y);
      px(g, plank ? P5.wood : '#94643c', x, y + 1, 1, 2);
      px(g, (x - xa) % 6 === 0 ? P5.woodDD : P5.woodD, x, y + 3);
    }
    // Rope hand-line on posts.
    for (let x = xa + 3; x < xb - 1; x += 14) {
      const y = yAt(x);
      px(g, P5.dark, x - 1, y - 9, 3, 9);
      px(g, P5.woodD, x, y - 8, 1, 8);
    }
    for (let x = xa + 3; x < xb - 2; x++) {
      const y = yAt(x);
      const sag = Math.round(Math.sin(((x - xa - 3) % 14) / 14 * Math.PI) * 2);
      px(g, P5.rope, x, y - 8 + sag);
    }
    return;
  }
  if (style === 'girder') {
    for (let x = xa; x < xb; x++) {
      const y = yAt(x);
      px(g, P5.dark, x, y - 1, 1, 8);
      px(g, P5.brassL, x, y);
      px(g, P5.brass, x, y + 1);
      px(g, (x - xa) % 8 < 4 ? P5.hullL : P5.hull, x, y + 2, 1, 3);
      px(g, (x - xa) % 8 === 2 ? P5.hullLL : P5.hullD, x, y + 3);
      px(g, P5.brassD, x, y + 5);
    }
    return;
  }
  // Catwalk.
  for (let x = xa; x < xb; x++) {
    const y = yAt(x);
    px(g, P5.dark, x, y - 1, 1, 6);
    px(g, P5.hullLL, x, y);
    px(g, (x - xa) % 2 ? P5.hullL : P5.hullD, x, y + 1);
    px(g, (x - xa) % 2 ? P5.hullD : P5.hullL, x, y + 2);
    px(g, P5.hullDD, x, y + 3);
  }
  // Truss underneath (zigzag), only on longer spans.
  if (xb - xa >= 40) {
    for (let x = xa + 2; x < xb - 2; x++) {
      const y = yAt(x);
      const k = (x - xa - 2) % 12;
      const d = k < 6 ? k : 12 - k;
      px(g, P5.dark, x, y + 4, 1, 1);
      px(g, P5.hullD, x, y + 4 + d);
      px(g, P5.dark, x, y + 5 + d);
      if (k === 0) px(g, P5.hull, x, y + 4, 1, 6);
    }
    for (let x = xa + 2; x < xb - 2; x++) px(g, P5.hullD, x, yAt(x) + 10);
  }
}
