// Baking helpers for theme art that is drawn pixel by pixel with fillRect. A static decor piece
// (or the static part of an animated one) is drawn ONCE into a padded scratch canvas, cropped to
// the pixels it touched, cached and then blitted with a single drawImage. The world transform is
// an integer translation, so the blit is pixel-identical to drawing live. Where baking is not
// possible (no DOM in Node tests, a context without getImageData, or art reaching the scratch
// border) callers fall back to drawing live.

import type { DecorDef } from '../../game/level';
import type { DecorRenderer } from '../../game/theme';

export interface Baked {
  /** Cropped art, or null when the art draws nothing. */
  c: HTMLCanvasElement | null;
  /** World position of the crop's top-left corner. */
  x: number;
  y: number;
}

/** World box [x, y, w, h] the art is guaranteed to stay inside (generous is fine: it is cropped). */
export type Box = [number, number, number, number];

/**
 * Draw `draw` (which paints in world space) into a scratch canvas covering `box` and crop it.
 * Returns null when it cannot bake (callers then draw live).
 */
export function bakeBox(draw: (g: CanvasRenderingContext2D) => void, box: Box): Baked | null {
  if (typeof document === 'undefined') return null;
  const x0 = Math.floor(box[0]);
  const y0 = Math.floor(box[1]);
  const w = Math.max(1, Math.ceil(box[2]));
  const h = Math.max(1, Math.ceil(box[3]));
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx || typeof ctx.getImageData !== 'function') return null;
  ctx.setTransform(1, 0, 0, 1, -x0, -y0);
  draw(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  if (!img?.data || img.data.length < w * h * 4) return null;
  const a = img.data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4 + 3;
    for (let x = 0; x < w; x++) {
      if (a[row + x * 4] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { c: null, x: x0, y: y0 };
  // Art that reaches the scratch border may have been cut off: draw it live instead.
  if (minX === 0 || minY === 0 || maxX === w - 1 || maxY === h - 1) return null;
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const octx = out.getContext('2d');
  if (!octx) return null;
  octx.drawImage(scratch, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return { c: out, x: x0 + minX, y: y0 + minY };
}

/**
 * A cache of baked art by key object (a DecorDef, a platform...). `get` bakes on first use;
 * it returns null when the art must be drawn live.
 */
export class BakeCache<K extends object> {
  private map = new WeakMap<K, Baked | null>();

  get(key: K, draw: (g: CanvasRenderingContext2D) => void, box: () => Box): Baked | null {
    let b = this.map.get(key);
    if (b === undefined) {
      try {
        b = bakeBox(draw, box());
      } catch {
        b = null;
      }
      this.map.set(key, b);
    }
    return b;
  }

  /** Blit the baked art for key, or draw it live when it can't be baked. */
  draw(g: CanvasRenderingContext2D, key: K, draw: (g: CanvasRenderingContext2D) => void, box: () => Box): void {
    const b = this.get(key, draw, box);
    if (b === null) draw(g);
    else if (b.c) g.drawImage(b.c, b.x, b.y);
  }
}

/**
 * Wrap a decor renderer whose output does not depend on time: it is baked once per decor entry.
 * `box(d)` gives a world box that surely contains the art.
 */
export function staticDecor(r: DecorRenderer, box: (d: DecorDef) => Box): DecorRenderer {
  const cache = new BakeCache<DecorDef>();
  return (g, d) =>
    cache.draw(
      g,
      d,
      (ctx) => r(ctx, d, 0),
      () => box(d),
    );
}
