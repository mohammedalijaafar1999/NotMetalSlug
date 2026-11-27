// Themes: how a level looks. A theme supplies sky colors, parallax layers, terrain textures,
// platform/water styles, decor renderers and optional weather overlays. The ThemeRenderer
// bakes terrain into cached 256px tiles (crisp pixel-art, zero per-frame cost).

import { PixelArt } from '../engine/pixelart';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { Terrain, type Surface } from './terrain';
import type { DecorDef, LevelDef } from './level';
import { bandedGradient, brickTile, cloudLayer, darken, dirtTile, grassEdge, hillsLayer, mountainLayer } from '../art/textures';

export type DecorRenderer = (g: CanvasRenderingContext2D, d: DecorDef, time: number) => void;

export interface ParallaxLayer {
  /** Art for one horizontal period of the layer (tiled when repeat !== false). */
  art: () => PixelArt | HTMLCanvasElement;
  /** Horizontal scroll factor relative to the camera (0 = static, 1 = world speed). */
  factor: number;
  /** Screen y of the layer's top edge when the camera is at baseY. */
  y: number;
  /** Vertical scroll factor (default factor * 0.6). */
  yFactor?: number;
  /** Camera top-y the `y` value refers to (default: level.height - VIEW_H). */
  baseY?: number;
  /** Constant drift speed (clouds), px/s. */
  speed?: number;
  repeat?: boolean;
  alpha?: number;
}

export interface ThemeDef {
  id: string;
  /** Sky gradient stops (top -> bottom), drawn as retro bands. */
  sky: string[];
  layers?: ParallaxLayer[];
  /** Ground fill texture (tiled in world space). */
  groundTile: () => PixelArt;
  /** Ground top-edge strip (tiled horizontally, follows slopes). */
  groundEdge?: () => PixelArt;
  /** Rows of groundEdge drawn ABOVE the surface line (grass blades). */
  groundEdgeUp?: number;
  /** Solid block textures (default: bricks). */
  solidTile?: () => PixelArt;
  solidEdge?: () => PixelArt;
  solidEdgeUp?: number;
  /** Depth shading: [depth px, darken 0..1], ascending. */
  depthShade?: Array<[number, number]>;
  /** Custom platform drawing (world space). Default: wooden planks. */
  platform?: (g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, style: string) => void;
  water?: { color: string; surface: string; alpha?: number };
  /** Decor renderers by kind (world space; d.x/d.y = anchor, usually bottom-center on ground). */
  decor?: Record<string, DecorRenderer>;
  /** Fully custom background (screen space) - replaces sky+layers. */
  renderBackground?: (g: CanvasRenderingContext2D, camX: number, camY: number, time: number, level: LevelDef) => void;
  /** Weather / tint overlay (screen space) drawn after everything in the world. */
  renderOverlay?: (g: CanvasRenderingContext2D, camX: number, camY: number, time: number, level: LevelDef) => void;
}

const themes = new Map<string, ThemeDef>();

export function registerTheme(t: ThemeDef): void {
  themes.set(t.id, t);
}

export function getTheme(id: string): ThemeDef {
  const t = themes.get(id);
  if (t) return t;
  if (id !== 'default') console.warn(`[theme] unknown theme "${id}", using default`);
  return themes.get('default')!;
}

export function themeIds(): string[] {
  return [...themes.keys()];
}

const TILE = 256;
const MAX_TILES = 36;
const MAX_PLATFORMS = 64;

interface BakedPlatform {
  /** Geometry the bake was made for. */
  key: string;
  /** Baked art; null = the platform draws nothing; undefined = not cacheable (draw live). */
  c: HTMLCanvasElement | null | undefined;
  x: number;
  y: number;
}

function toCanvas(a: PixelArt | HTMLCanvasElement): HTMLCanvasElement {
  return a instanceof PixelArt ? a.toCanvas() : a;
}

export class ThemeRenderer {
  readonly def: ThemeDef;
  readonly level: LevelDef;
  readonly terrain: Terrain;
  private tiles = new Map<string, HTMLCanvasElement>();
  private tileOrder: string[] = [];
  private version = -1;
  private ground: PixelArt[] | null = null;
  private groundEdge: PixelArt | null = null;
  private solid: PixelArt[] | null = null;
  private solidEdge: PixelArt | null = null;
  private skyCanvas: HTMLCanvasElement | null = null;
  private layerCanvases: (HTMLCanvasElement | null)[] = [];
  private platformCache = new Map<Surface, BakedPlatform>();
  private decorBack: DecorDef[];
  private decorFront: DecorDef[];

  constructor(def: ThemeDef, level: LevelDef, terrain: Terrain) {
    this.def = def;
    this.level = level;
    this.terrain = terrain;
    const decor = (level.decor ?? []).slice().sort((a, b) => a.x - b.x);
    this.decorBack = decor.filter((d) => d.layer !== 'front');
    this.decorFront = decor.filter((d) => d.layer === 'front');
  }

  private ensureTextures(): void {
    if (this.ground) return;
    const shades = this.def.depthShade ?? [
      [56, 0.16],
      [120, 0.32],
    ];
    const g = this.def.groundTile();
    this.ground = [g, ...shades.map(([, a]) => darken(g, a))];
    this.groundEdge = this.def.groundEdge?.() ?? null;
    const s = this.def.solidTile?.() ?? brickTile();
    this.solid = [s, ...shades.map(([, a]) => darken(s, a))];
    this.solidEdge = this.def.solidEdge?.() ?? null;
  }

  private shadeIndex(depth: number): number {
    const shades = this.def.depthShade ?? [
      [56, 0.16],
      [120, 0.32],
    ];
    let k = 0;
    for (let i = 0; i < shades.length; i++) if (depth >= shades[i][0]) k = i + 1;
    return k;
  }

  /** Bake one terrain tile into pixels (exported for tests via bakeTilePixels). */
  bakeTilePixels(tx: number, ty: number): Uint32Array {
    this.ensureTextures();
    const S = TILE;
    const x0 = tx * S;
    const y0 = ty * S;
    const buf = new Uint32Array(S * S);
    const T = this.terrain;
    const edge = this.groundEdge;
    const up = edge ? (this.def.groundEdgeUp ?? 0) : 0;
    const eh = edge ? edge.h : 0;
    const mod = (a: number, m: number) => ((a % m) + m) % m;
    for (let i = 0; i < S; i++) {
      const wx = x0 + i;
      const top = T.groundTopAt(wx + 0.5);
      if (!isFinite(top)) continue;
      const topRow = Math.round(top);
      for (let j = 0; j < S; j++) {
        const wy = y0 + j;
        const depth = wy - topRow;
        if (depth < -up) continue;
        let c = 0;
        if (edge && depth < eh - up) {
          c = edge.data[(depth + up) * edge.w + mod(wx, edge.w)];
          if (!(c >>> 24)) {
            if (depth < 0) continue;
            c = 0;
          }
        }
        if (!c) {
          if (depth < 0) continue;
          const tex = this.ground![this.shadeIndex(depth)];
          c = tex.data[mod(wy, tex.h) * tex.w + mod(wx, tex.w)];
        }
        buf[j * S + i] = c;
      }
    }
    // Static solids.
    const sEdge = this.solidEdge;
    const sUp = sEdge ? (this.def.solidEdgeUp ?? 0) : 0;
    for (const s of T.staticSolids()) {
      if (s.x >= x0 + S || s.x + s.w <= x0 || s.y - sUp >= y0 + S || s.y + s.h <= y0) continue;
      const ix0 = Math.max(0, Math.floor(s.x - x0));
      const ix1 = Math.min(S, Math.ceil(s.x + s.w - x0));
      const iy0 = Math.max(0, Math.floor(s.y - sUp - y0));
      const iy1 = Math.min(S, Math.ceil(s.y + s.h - y0));
      for (let j = iy0; j < iy1; j++) {
        const wy = y0 + j;
        const depth = wy - Math.round(s.y);
        for (let i = ix0; i < ix1; i++) {
          const wx = x0 + i;
          let c = 0;
          if (sEdge && depth < sEdge.h - sUp) {
            if (depth + sUp >= 0) c = sEdge.data[(depth + sUp) * sEdge.w + mod(wx - Math.round(s.x), sEdge.w)];
            if (!(c >>> 24)) {
              if (depth < 0) continue;
              c = 0;
            }
          }
          if (!c) {
            if (depth < 0) continue;
            const tex = this.solid![Math.min(this.solid!.length - 1, this.shadeIndex(depth))];
            c = tex.data[mod(wy - Math.round(s.y), tex.h) * tex.w + mod(wx - Math.round(s.x), tex.w)];
          }
          buf[j * S + i] = c;
        }
      }
      // Side shading for a 3D-ish look.
      for (let j = Math.max(0, Math.floor(s.y - y0)); j < iy1; j++) {
        const lx = Math.floor(s.x + s.w - 1 - x0);
        if (lx >= 0 && lx < S && buf[j * S + lx]) buf[j * S + lx] = darkenPixel(buf[j * S + lx], 0.35);
        const fx = Math.floor(s.x - x0);
        if (fx >= 0 && fx < S && buf[j * S + fx]) buf[j * S + fx] = darkenPixel(buf[j * S + fx], -0.15);
      }
    }
    return buf;
  }

  private tile(tx: number, ty: number): HTMLCanvasElement {
    if (this.terrain.version !== this.version) {
      this.tiles.clear();
      this.tileOrder = [];
      this.version = this.terrain.version;
    }
    const key = tx + ',' + ty;
    let c = this.tiles.get(key);
    if (c) return c;
    const buf = this.bakeTilePixels(tx, ty);
    c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(TILE, TILE);
    new Uint32Array(img.data.buffer).set(buf);
    ctx.putImageData(img, 0, 0);
    this.tiles.set(key, c);
    this.tileOrder.push(key);
    if (this.tileOrder.length > MAX_TILES) {
      const old = this.tileOrder.shift()!;
      this.tiles.delete(old);
    }
    return c;
  }

  renderBackground(g: CanvasRenderingContext2D, camX: number, camY: number, time: number): void {
    if (this.def.renderBackground) {
      this.def.renderBackground(g, camX, camY, time, this.level);
      return;
    }
    if (!this.skyCanvas) this.skyCanvas = bandedGradient(4, VIEW_H, this.def.sky, 24).toCanvas();
    g.drawImage(this.skyCanvas, 0, 0, VIEW_W, VIEW_H);
    const layers = this.def.layers ?? [];
    const baseYDefault = Math.max(0, this.level.height - VIEW_H);
    layers.forEach((L, i) => {
      let c = this.layerCanvases[i];
      if (!c) {
        c = toCanvas(L.art());
        this.layerCanvases[i] = c;
      }
      const yF = L.yFactor ?? L.factor * 0.6;
      const y = Math.round(L.y - (camY - (L.baseY ?? baseYDefault)) * yF);
      let off = -(camX * L.factor + time * (L.speed ?? 0));
      if (L.alpha !== undefined) g.globalAlpha = L.alpha;
      if (L.repeat === false) {
        g.drawImage(c, Math.round(off), y);
      } else {
        off = ((off % c.width) + c.width) % c.width - c.width;
        for (let x = Math.round(off); x < VIEW_W; x += c.width) g.drawImage(c, x, y);
      }
      g.globalAlpha = 1;
    });
  }

  renderTerrain(g: CanvasRenderingContext2D, camX: number, camY: number, time: number): void {
    // Back decor first (behind terrain fill? no: decor stands on terrain, drawn after tiles).
    const tx0 = Math.floor(camX / TILE);
    const tx1 = Math.floor((camX + VIEW_W) / TILE);
    const ty0 = Math.floor(camY / TILE);
    const ty1 = Math.floor((camY + VIEW_H) / TILE);
    // Decor marked as 'far' sits behind the terrain fill.
    for (const d of this.decorBack) if (d.props?.behindTerrain) this.drawDecor(g, d, camX, time);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) g.drawImage(this.tile(tx, ty), tx * TILE, ty * TILE);
    // Pre-bake at most one upcoming tile per frame so scrolling never hitches.
    const ahead = tx1 + 1;
    if (ahead * TILE < this.level.width) {
      for (let ty = ty0; ty <= ty1; ty++) {
        if (!this.tiles.has(ahead + ',' + ty)) {
          this.tile(ahead, ty);
          break;
        }
      }
    }
    // Platforms (static ones are baked once: theme platform art is drawn pixel by pixel, up to
    // ~900 fillRect calls a frame for a screen of scaffolds).
    for (const p of this.terrain.platforms()) {
      if (p.x2 < camX - 8 || p.x1 > camX + VIEW_W + 8 || p.owner) continue;
      const baked = p.dynamic ? null : this.bakedPlatform(p);
      if (baked) {
        if (baked.c) g.drawImage(baked.c, baked.x, baked.y);
      } else (this.def.platform ?? defaultPlatform)(g, p.x1, p.y1, p.x2, p.y2, p.material);
    }
    for (const d of this.decorBack) if (!d.props?.behindTerrain) this.drawDecor(g, d, camX, time);
  }

  /**
   * A static platform rendered once into a tight canvas. The theme's platform function draws in
   * world space and has no time input, so its output never changes. It is drawn into a padded
   * scratch canvas and cropped to the pixels it touched. Returns null (draw live every frame)
   * when the art might not fit the scratch area or the canvas can't be read back.
   */
  private bakedPlatform(p: Surface): BakedPlatform | null {
    const key = `${p.x1},${p.y1},${p.x2},${p.y2},${p.material}`;
    const hit = this.platformCache.get(p);
    if (hit && hit.key === key) return hit.c === undefined ? null : hit;
    let baked: BakedPlatform = { key, c: undefined, x: 0, y: 0 };
    try {
      baked = this.bakePlatform(p, key) ?? baked;
    } catch {
      /* draw live */
    }
    this.platformCache.set(p, baked);
    if (this.platformCache.size > MAX_PLATFORMS) this.platformCache.delete(this.platformCache.keys().next().value!);
    return baked.c === undefined ? null : baked;
  }

  private bakePlatform(p: Surface, key: string): BakedPlatform | null {
    if (typeof document === 'undefined') return null;
    const PAD_X = 24;
    const UP = 64;
    const DOWN = 200;
    const x0 = Math.floor(Math.min(p.x1, p.x2)) - PAD_X;
    const top = Math.floor(Math.min(p.y1, p.y2)) - UP;
    const w = Math.ceil(Math.abs(p.x2 - p.x1)) + PAD_X * 2;
    const h = Math.ceil(Math.abs(p.y2 - p.y1)) + UP + DOWN;
    const scratch = document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
    const ctx = scratch.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.setTransform(1, 0, 0, 1, -x0, -top);
    (this.def.platform ?? defaultPlatform)(ctx, p.x1, p.y1, p.x2, p.y2, p.material);
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
    if (maxX < 0) return { key, c: null, x: 0, y: 0 }; // draws nothing (e.g. 'hidden' styles)
    // Art that reaches the scratch border may be cut off: keep drawing it live.
    if (minX === 0 || minY === 0 || maxX === w - 1 || maxY === h - 1) return null;
    const out = document.createElement('canvas');
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    const octx = out.getContext('2d');
    if (!octx) return null;
    octx.drawImage(scratch, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return { key, c: out, x: x0 + minX, y: top + minY };
  }

  private drawDecor(g: CanvasRenderingContext2D, d: DecorDef, camX: number, time: number): void {
    const margin = (d.props?.w as number) ?? 160;
    if (d.x < camX - margin || d.x > camX + VIEW_W + margin) return;
    const r = this.def.decor?.[d.kind] ?? DEFAULT_DECOR[d.kind];
    if (r) r(g, d, time);
  }

  renderFront(g: CanvasRenderingContext2D, camX: number, camY: number, time: number): void {
    // Water.
    const wdef = this.def.water ?? { color: '#2a6aa8', surface: '#9ad6ff', alpha: 0.55 };
    for (const w of this.terrain.water) {
      if (w.x + w.w < camX || w.x > camX + VIEW_W) continue;
      g.globalAlpha = wdef.alpha ?? 0.55;
      g.fillStyle = wdef.color;
      g.fillRect(Math.round(w.x), Math.round(w.y), Math.round(w.w), Math.round(w.h));
      g.globalAlpha = 1;
      g.fillStyle = wdef.surface;
      const x0 = Math.max(Math.round(w.x), Math.floor(camX));
      const x1 = Math.min(Math.round(w.x + w.w), Math.ceil(camX + VIEW_W));
      for (let x = x0; x < x1; x += 2) {
        const yy = Math.round(w.y + Math.sin(x * 0.15 + time * 4) * 1.2);
        g.fillRect(x, yy, 2, 1);
      }
    }
    for (const d of this.decorFront) this.drawDecor(g, d, camX, time);
  }

  renderOverlay(g: CanvasRenderingContext2D, camX: number, camY: number, time: number): void {
    this.def.renderOverlay?.(g, camX, camY, time, this.level);
  }
}

function darkenPixel(v: number, amt: number): number {
  const k = 1 - amt;
  const cl = (n: number) => Math.max(0, Math.min(255, Math.round(n * k)));
  const r = cl(v & 255);
  const gg = cl((v >>> 8) & 255);
  const b = cl((v >>> 16) & 255);
  return (((v >>> 24) << 24) | (b << 16) | (gg << 8) | r) >>> 0;
}

/** Default platform look: wooden planks with supports. */
export function defaultPlatform(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, style: string): void {
  const metal = style === 'metal';
  const top = metal ? '#a8b4c0' : '#d0a060';
  const body = metal ? '#6a7684' : '#8a5a2e';
  const dark = metal ? '#3a4450' : '#4a2c14';
  const xa = Math.round(x1);
  const xb = Math.round(x2);
  for (let x = xa; x < xb; x++) {
    const t = xb === xa ? 0 : (x - xa) / (xb - xa);
    const y = Math.round(y1 + (y2 - y1) * t);
    g.fillStyle = '#140c1c';
    g.fillRect(x, y - 1, 1, 7);
    g.fillStyle = top;
    g.fillRect(x, y, 1, 1);
    g.fillStyle = (x - xa) % 12 === 0 && !metal ? dark : body;
    g.fillRect(x, y + 1, 1, 3);
    g.fillStyle = dark;
    g.fillRect(x, y + 4, 1, 1);
  }
  // Supports.
  g.fillStyle = dark;
  for (let x = xa + 6; x < xb - 4; x += 40) {
    const t = (x - xa) / Math.max(1, xb - xa);
    const y = Math.round(y1 + (y2 - y1) * t);
    g.fillRect(x, y + 5, 2, 4);
    g.fillRect(x + 1, y + 9, 1, 2);
  }
}

// ------------------------------------------------------------ default decor kinds

const DEFAULT_DECOR: Record<string, DecorRenderer> = {
  /** A simple arrow signpost. */
  sign: (g, d) => {
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    g.fillStyle = '#140c1c';
    g.fillRect(x - 1, y - 18, 3, 18);
    g.fillRect(x - 9, y - 21, 19, 9);
    g.fillStyle = '#6a4a2a';
    g.fillRect(x, y - 17, 1, 17);
    g.fillStyle = '#c8a060';
    g.fillRect(x - 8, y - 20, 17, 7);
    g.fillStyle = '#5a2a10';
    g.fillRect(x - 5, y - 17, 9, 1);
    g.fillRect(x + 2, y - 19, 1, 5);
    g.fillRect(x + 3, y - 18, 1, 3);
  },
};

// ------------------------------------------------------------ default theme

registerTheme({
  id: 'default',
  sky: ['#3d7cc9', '#7cb8e8', '#c4e4f4'],
  layers: [
    { art: () => cloudLayer(320, 60, '#ffffff', '#cfe3f2', 7, 5), factor: 0.05, y: 6, speed: 3 },
    { art: () => mountainLayer(400, 90, '#7d93b8', { seed: 3, snow: '#e8f0f8', highlight: '#94a8c8' }), factor: 0.12, y: 70 },
    { art: () => hillsLayer(360, 80, '#4f8a5a', { seed: 5, trees: '#3a6e46' }), factor: 0.3, y: 120 },
  ],
  groundTile: () => dirtTile(32, 32),
  groundEdge: () => grassEdge(32, 3, 5),
  groundEdgeUp: 3,
});
