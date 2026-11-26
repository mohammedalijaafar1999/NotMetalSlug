// PixelArt: a tiny software rasterizer that draws crisp, non-antialiased pixel art
// into a Uint32Array. Used to procedurally "bake" every sprite in the game.
//
// Coordinates are in pixels; (0,0) is the top-left. Shapes use pixel-center sampling,
// so fractional centers are allowed (e.g. circle(7.5, 7.5, 4) is perfectly symmetric
// in a 15x15 box). Colors are CSS hex strings ('#rgb', '#rrggbb', '#rrggbbaa') or 0xRRGGBB numbers.
// A fully transparent color ('#0000' or 'transparent') erases.

export type ColorLike = string | number;

const colorCache = new Map<string, number>();

/** Convert a color to the ABGR uint32 layout used by ImageData on little-endian machines. */
export function parseColor(c: ColorLike): number {
  if (typeof c === 'number') {
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  const cached = colorCache.get(c);
  if (cached !== undefined) return cached;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 255;
  if (c === 'transparent') {
    a = 0;
  } else if (c[0] === '#') {
    const h = c.slice(1);
    if (h.length === 3 || h.length === 4) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
      if (h.length === 4) a = parseInt(h[3] + h[3], 16);
    } else if (h.length === 6 || h.length === 8) {
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
      if (h.length === 8) a = parseInt(h.slice(6, 8), 16);
    } else {
      throw new Error(`Bad color ${c}`);
    }
  } else {
    throw new Error(`Unsupported color format ${c} (use #hex)`);
  }
  const v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  colorCache.set(c, v);
  return v;
}

/** Convert ABGR uint32 back to '#rrggbb'. */
export function colorToHex(v: number): string {
  const r = v & 255;
  const g = (v >>> 8) & 255;
  const b = (v >>> 16) & 255;
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Mix two hex colors. t=0 -> a, t=1 -> b. Returns '#rrggbb'. */
export function mixColor(a: string, b: string, t: number): string {
  const va = parseColor(a);
  const vb = parseColor(b);
  const ch = (v: number, s: number) => (v >>> s) & 255;
  const m = (s: number) => Math.round(ch(va, s) + (ch(vb, s) - ch(va, s)) * t);
  return '#' + [m(0), m(8), m(16)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Lighten (amt>0) or darken (amt<0) a hex color by mixing with white/black. */
export function shade(c: string, amt: number): string {
  return amt >= 0 ? mixColor(c, '#ffffff', amt) : mixColor(c, '#000000', -amt);
}

export class PixelArt {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;
  /** Optional translation applied to every primitive (for drawing sub-parts). */
  ox = 0;
  oy = 0;
  /** When true, horizontal coordinates are mirrored around the canvas center (after offset). */
  mirror = false;

  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.data = new Uint32Array(this.w * this.h);
  }

  clear(): this {
    this.data.fill(0);
    return this;
  }

  /** Set a pixel in raw (untransformed) integer coordinates. */
  setRaw(x: number, y: number, v: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = v;
  }

  getRaw(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }

  /** Is the raw pixel opaque? */
  opaque(x: number, y: number): boolean {
    return (this.getRaw(x, y) >>> 24) > 0;
  }

  /** Plot a single pixel (transformed). */
  px(x: number, y: number, c: ColorLike): this {
    const v = parseColor(c);
    let X = Math.floor(x + this.ox);
    if (this.mirror) X = this.w - 1 - X;
    this.setRaw(X, Math.floor(y + this.oy), v);
    return this;
  }

  /** Filled axis-aligned rectangle. */
  rect(x: number, y: number, w: number, h: number, c: ColorLike): this {
    const v = parseColor(c);
    let x0 = Math.round(x + this.ox);
    let x1 = Math.round(x + w + this.ox);
    if (this.mirror) {
      const a = this.w - x1;
      const b = this.w - x0;
      x0 = a;
      x1 = b;
    }
    const y0 = Math.round(y + this.oy);
    const y1 = Math.round(y + h + this.oy);
    for (let yy = Math.max(0, y0); yy < Math.min(this.h, y1); yy++) {
      for (let xx = Math.max(0, x0); xx < Math.min(this.w, x1); xx++) {
        this.data[yy * this.w + xx] = v;
      }
    }
    return this;
  }

  /** 1px rectangle border. */
  box(x: number, y: number, w: number, h: number, c: ColorLike): this {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
    return this;
  }

  hline(x0: number, x1: number, y: number, c: ColorLike): this {
    const a = Math.min(x0, x1);
    const b = Math.max(x0, x1);
    return this.rect(a, y, b - a + 1, 1, c);
  }

  vline(x: number, y0: number, y1: number, c: ColorLike): this {
    const a = Math.min(y0, y1);
    const b = Math.max(y0, y1);
    return this.rect(x, a, 1, b - a + 1, c);
  }

  /**
   * Generic shape fill: calls `inside(px, py)` with pixel-center coordinates in the
   * *untransformed* space for every pixel in the given bounding box.
   */
  fillShape(bx0: number, by0: number, bx1: number, by1: number, c: ColorLike, inside: (x: number, y: number) => boolean): this {
    const v = parseColor(c);
    const x0 = Math.floor(bx0) - 1;
    const x1 = Math.ceil(bx1) + 1;
    const y0 = Math.floor(by0) - 1;
    const y1 = Math.ceil(by1) + 1;
    for (let y = y0; y <= y1; y++) {
      const Y = y + this.oy;
      if (Y < 0 || Y >= this.h) continue;
      for (let x = x0; x <= x1; x++) {
        if (!inside(x + 0.5, y + 0.5)) continue;
        let X = x + this.ox;
        if (this.mirror) X = this.w - 1 - X;
        if (X < 0 || X >= this.w) continue;
        this.data[Y * this.w + X] = v;
      }
    }
    return this;
  }

  /** Filled circle. */
  circle(cx: number, cy: number, r: number, c: ColorLike): this {
    const r2 = r * r;
    return this.fillShape(cx - r, cy - r, cx + r, cy + r, c, (x, y) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2);
  }

  /** Circle outline of thickness t. */
  ring(cx: number, cy: number, r: number, c: ColorLike, t = 1): this {
    const ro = r * r;
    const ri = Math.max(0, r - t) * Math.max(0, r - t);
    return this.fillShape(cx - r, cy - r, cx + r, cy + r, c, (x, y) => {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      return d <= ro && d > ri;
    });
  }

  /** Filled ellipse. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: ColorLike): this {
    if (rx <= 0 || ry <= 0) return this;
    return this.fillShape(cx - rx, cy - ry, cx + rx, cy + ry, c, (x, y) => {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      return dx * dx + dy * dy <= 1;
    });
  }

  /** Filled polygon from flat point list [x0,y0,x1,y1,...] (even-odd rule). */
  poly(pts: number[], c: ColorLike): this {
    if (pts.length < 6) return this;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]);
      maxX = Math.max(maxX, pts[i]);
      minY = Math.min(minY, pts[i + 1]);
      maxY = Math.max(maxY, pts[i + 1]);
    }
    const n = pts.length / 2;
    return this.fillShape(minX, minY, maxX, maxY, c, (x, y) => {
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = pts[i * 2];
        const yi = pts[i * 2 + 1];
        const xj = pts[j * 2];
        const yj = pts[j * 2 + 1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    });
  }

  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: ColorLike): this {
    return this.poly([x0, y0, x1, y1, x2, y2], c);
  }

  /** Thick rounded segment (great for limbs, barrels, cables). r = radius in px. */
  capsule(x0: number, y0: number, x1: number, y1: number, r: number, c: ColorLike): this {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const r2 = r * r;
    return this.fillShape(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, c, (x, y) => {
      let t = len2 > 0 ? ((x - x0) * dx + (y - y0) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = x0 + dx * t - x;
      const py = y0 + dy * t - y;
      return px * px + py * py <= r2;
    });
  }

  /** 1px Bresenham line (thick > 1 uses a capsule). */
  line(x0: number, y0: number, x1: number, y1: number, c: ColorLike, thick = 1): this {
    if (thick > 1) return this.capsule(x0, y0, x1, y1, thick / 2, c);
    let ax = Math.floor(x0);
    let ay = Math.floor(y0);
    const bx = Math.floor(x1);
    const by = Math.floor(y1);
    const dx = Math.abs(bx - ax);
    const dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 4096; guard++) {
      this.px(ax, ay, c);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ax += sx;
      }
      if (e2 <= dx) {
        err += dx;
        ay += sy;
      }
    }
    return this;
  }

  /** Rotated rectangle centered at (cx,cy) with half-sizes hw,hh and angle a (radians). */
  rotRect(cx: number, cy: number, hw: number, hh: number, a: number, c: ColorLike): this {
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const pts: number[] = [];
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const lx = sx * hw;
      const ly = sy * hh;
      pts.push(cx + lx * cs - ly * sn, cy + lx * sn + ly * cs);
    }
    return this.poly(pts, c);
  }

  /** Checkerboard dither fill inside rect (only pixels where (x+y)%2==phase). */
  dither(x: number, y: number, w: number, h: number, c: ColorLike, phase = 0): this {
    for (let yy = Math.floor(y); yy < y + h; yy++) {
      for (let xx = Math.floor(x); xx < x + w; xx++) {
        if (((xx + yy) & 1) === phase) this.px(xx, yy, c);
      }
    }
    return this;
  }

  /** Replace every pixel of exactly color `from` with `to` (raw buffer, ignores transform). */
  replace(from: ColorLike, to: ColorLike): this {
    const f = parseColor(from);
    const t = parseColor(to);
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === f) this.data[i] = t;
    return this;
  }

  /** Apply a function to every opaque pixel. */
  mapPixels(fn: (v: number, x: number, y: number) => number): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.data[i] >>> 24) this.data[i] = fn(this.data[i], x, y) >>> 0;
      }
    }
    return this;
  }

  /**
   * Add a 1px outline around all opaque pixels (in currently transparent pixels).
   * `diagonal` also fills diagonal neighbours (thicker look).
   */
  outline(c: ColorLike = '#000000', diagonal = false): this {
    const v = parseColor(c);
    const src = this.data.slice();
    const w = this.w;
    const h = this.h;
    const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (op(x, y)) continue;
        let hit = op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1);
        if (!hit && diagonal) hit = op(x - 1, y - 1) || op(x + 1, y - 1) || op(x - 1, y + 1) || op(x + 1, y + 1);
        if (hit) this.data[y * w + x] = v;
      }
    }
    return this;
  }

  /** Copy another PixelArt onto this one (transparent pixels skipped). */
  blit(src: PixelArt, dx: number, dy: number, flipX = false): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const v = src.data[y * src.w + (flipX ? src.w - 1 - x : x)];
        if (v >>> 24) this.setRaw(Math.floor(dx + this.ox) + x, Math.floor(dy + this.oy) + y, v);
      }
    }
    return this;
  }

  /** Returns a horizontally flipped copy. */
  flippedX(): PixelArt {
    const out = new PixelArt(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) out.data[y * this.w + (this.w - 1 - x)] = this.data[y * this.w + x];
    }
    return out;
  }

  /** Count opaque pixels (handy in tests: "did this sprite draw anything?"). */
  opaqueCount(): number {
    let n = 0;
    for (let i = 0; i < this.data.length; i++) if (this.data[i] >>> 24) n++;
    return n;
  }

  /** Create a canvas with this image (browser only). */
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}
