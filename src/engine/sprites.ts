// Sprite registry. Every sprite in the game is defined procedurally with a draw
// function that paints into a PixelArt buffer; frames are baked lazily into
// canvases on first use (or eagerly via sprites.bakeAll()).
//
//   sprites.define({ name: 'crate', w: 16, h: 16, draw: (p) => p.rect(0, 0, 16, 16, '#a0522d') });
//   sprites.get('crate').draw(g, x, y, 0, { flip: true });
//
// Conventions:
//  - Origin (ox, oy) defaults to bottom-center (w/2, h): drawing at an entity's (x, y)
//    feet position lines the sprite up.
//  - An automatic 1px outline (default near-black) is added around the art. The baked canvas is
//    padded by 1px on every side so the outline is never clipped; origin is adjusted accordingly.

import { PixelArt, parseColor, type ColorLike } from './pixelart';

export interface SpriteDef {
  name: string;
  /** Frame width/height in pixels (art area, outline padding is added automatically). */
  w: number;
  h: number;
  /** Origin inside the frame (default bottom-center). */
  ox?: number;
  oy?: number;
  /** Number of animation frames (default 1). */
  frames?: number;
  /** Outline color, or null for no outline. Default '#140c1c'. */
  outline?: string | null;
  /** Use 8-neighbour outline (thicker). */
  outlineDiagonal?: boolean;
  /** Paint frame `frame` into `p` (p is w x h, already offset for padding). */
  draw: (p: PixelArt, frame: number) => void;
}

export interface DrawOpts {
  /** Mirror horizontally around the origin. */
  flip?: boolean;
  /** Draw as a solid white silhouette (hit flash). */
  flash?: boolean;
  /** Global alpha 0..1. */
  alpha?: number;
  /** Rotation in radians around the origin. */
  rot?: number;
  /** Uniform scale (keep to integers for crisp pixels). */
  scale?: number;
  /** Vertical mirror. */
  flipY?: boolean;
}

export const OUTLINE_COLOR = '#140c1c';

type Canvasish = HTMLCanvasElement;

export class Sprite {
  readonly name: string;
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oy: number;
  readonly frameCount: number;
  readonly def: SpriteDef;
  private baked: (Canvasish | null)[];
  private flashBaked: (Canvasish | null)[];
  private pixels: (PixelArt | null)[];

  constructor(def: SpriteDef) {
    this.def = def;
    this.name = def.name;
    this.w = def.w;
    this.h = def.h;
    this.ox = def.ox ?? Math.floor(def.w / 2);
    this.oy = def.oy ?? def.h;
    this.frameCount = Math.max(1, def.frames ?? 1);
    this.baked = new Array(this.frameCount).fill(null);
    this.flashBaked = new Array(this.frameCount).fill(null);
    this.pixels = new Array(this.frameCount).fill(null);
  }

  /** Rasterize a frame into a PixelArt (no DOM needed — usable from tests). */
  pixelArt(frame: number): PixelArt {
    const f = this.wrap(frame);
    const cached = this.pixels[f];
    if (cached) return cached;
    const p = new PixelArt(this.w + 2, this.h + 2);
    p.ox = 1;
    p.oy = 1;
    this.def.draw(p, f);
    p.ox = 0;
    p.oy = 0;
    p.mirror = false;
    const outline = this.def.outline === undefined ? OUTLINE_COLOR : this.def.outline;
    if (outline) p.outline(outline, !!this.def.outlineDiagonal);
    this.pixels[f] = p;
    return p;
  }

  private wrap(frame: number): number {
    const n = this.frameCount;
    const f = Math.floor(frame) % n;
    return f < 0 ? f + n : f;
  }

  /** Baked canvas for a frame. */
  canvas(frame: number): Canvasish {
    const f = this.wrap(frame);
    let c = this.baked[f];
    if (!c) {
      c = this.pixelArt(f).toCanvas();
      this.baked[f] = c;
      // Free the CPU-side copy once baked (keep memory low).
      this.pixels[f] = null;
    }
    return c;
  }

  flashCanvas(frame: number): Canvasish {
    const f = this.wrap(frame);
    let c = this.flashBaked[f];
    if (!c) {
      const src = this.canvas(f);
      c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(src, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      this.flashBaked[f] = c;
    }
    return c;
  }

  /** Bake all frames now (avoid hitches later). */
  bake(): void {
    for (let i = 0; i < this.frameCount; i++) this.canvas(i);
  }

  /**
   * Draw frame at world/screen position (x, y) = where the origin lands.
   * Coordinates are rounded to whole pixels for crispness.
   */
  draw(g: CanvasRenderingContext2D, x: number, y: number, frame = 0, opts?: DrawOpts): void {
    const img = opts?.flash ? this.flashCanvas(frame) : this.canvas(frame);
    const px = Math.round(x);
    const py = Math.round(y);
    // Padded canvas: origin shifts by +1.
    const ox = this.ox + 1;
    const oy = this.oy + 1;
    const alpha = opts?.alpha ?? 1;
    if (alpha <= 0) return;
    const simple = !opts || (!opts.flip && !opts.rot && !opts.scale && !opts.flipY);
    if (simple) {
      if (alpha !== 1) {
        const prev = g.globalAlpha;
        g.globalAlpha = prev * alpha;
        g.drawImage(img, px - ox, py - oy);
        g.globalAlpha = prev;
      } else {
        g.drawImage(img, px - ox, py - oy);
      }
      return;
    }
    g.save();
    if (alpha !== 1) g.globalAlpha *= alpha;
    g.translate(px, py);
    if (opts!.rot) g.rotate(opts!.rot);
    const s = opts!.scale ?? 1;
    g.scale(opts!.flip ? -s : s, opts!.flipY ? -s : s);
    g.drawImage(img, -ox, -oy);
    g.restore();
  }
}

class SpriteRegistry {
  private map = new Map<string, Sprite>();

  define(def: SpriteDef): Sprite {
    if (this.map.has(def.name)) {
      // Later definitions override earlier ones (lets content modules replace placeholder art).
      console.warn(`[sprites] redefining sprite "${def.name}"`);
    }
    const s = new Sprite(def);
    this.map.set(def.name, s);
    return s;
  }

  /** Define only if not already present (for placeholder/fallback art). */
  fallback(def: SpriteDef): Sprite {
    return this.map.get(def.name) ?? this.define(def);
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  get(name: string): Sprite {
    const s = this.map.get(name);
    if (s) return s;
    return this.missing(name);
  }

  tryGet(name: string): Sprite | undefined {
    return this.map.get(name);
  }

  all(): Sprite[] {
    return [...this.map.values()];
  }

  names(): string[] {
    return [...this.map.keys()];
  }

  /**
   * Create a palette-swapped copy of a sprite. `map` maps exact source colors to new colors.
   */
  recolor(srcName: string, newName: string, map: Record<string, ColorLike>, shape?: { w: number; h: number; ox?: number; oy?: number; frames?: number }): Sprite {
    // The source is resolved lazily at bake time, so definition order doesn't matter.
    // Its geometry must be known now: pass `shape` if the source may not be defined yet.
    const srcNow = this.map.get(srcName);
    const geo = shape ?? (srcNow ? { w: srcNow.w, h: srcNow.h, ox: srcNow.ox, oy: srcNow.oy, frames: srcNow.frameCount } : null);
    if (!geo) throw new Error(`recolor: source sprite "${srcName}" not defined yet; pass its shape`);
    const pairs = Object.entries(map).map(([a, b]) => [parseColor(a), parseColor(b)] as const);
    return this.define({
      name: newName,
      w: geo.w,
      h: geo.h,
      ox: geo.ox,
      oy: geo.oy,
      frames: geo.frames,
      outline: srcNow?.def.outline,
      outlineDiagonal: srcNow?.def.outlineDiagonal,
      draw: (p, f) => {
        this.get(srcName).def.draw(p, f);
        // Palette swap on raw buffer.
        for (let i = 0; i < p.data.length; i++) {
          const v = p.data[i];
          for (const [a, b] of pairs) {
            if (v === a) {
              p.data[i] = b;
              break;
            }
          }
        }
      },
    });
  }

  bakeAll(filter?: (s: Sprite) => boolean): void {
    for (const s of this.map.values()) if (!filter || filter(s)) s.bake();
  }

  private missingWarned = new Set<string>();

  /** Magenta checker placeholder so missing art is obvious but never crashes. */
  private missing(name: string): Sprite {
    if (!this.missingWarned.has(name)) {
      this.missingWarned.add(name);
      console.warn(`[sprites] missing sprite "${name}" - using placeholder`);
    }
    const s = new Sprite({
      name,
      w: 12,
      h: 12,
      outline: null,
      draw: (p) => {
        for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) p.px(x, y, (x >> 2) % 2 === (y >> 2) % 2 ? '#ff00ff' : '#000000');
      },
    });
    this.map.set(name, s);
    return s;
  }
}

export const sprites = new SpriteRegistry();
