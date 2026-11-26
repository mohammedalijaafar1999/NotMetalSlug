// Terrain: line-segment surfaces (ground polylines + one-way platforms), solid boxes and water.
//
// - Ground surfaces (ground=true) are the top edge of solid earth: everything below them is solid.
//   They come from LevelDef.ground polylines and may slope. Gaps between polylines are pits.
// - One-way surfaces (oneWay=true) are platforms you can jump up through and drop down through.
// - Solids are axis-aligned boxes that block movement from every side (walls, crates, bunkers).
//   Their top acts as a floor. Solids/surfaces with an owner entity can be moved or removed
//   (destructible walls, elevators, rafts).

import type { Rect } from '../engine/math';
import type { Entity } from './entity';

export interface Surface {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  oneWay: boolean;
  /** Everything below this surface is solid earth. */
  ground: boolean;
  owner: Entity | null;
  material: string;
  disabled: boolean;
  dynamic: boolean;
  /** Movement applied this step (dynamic only) - riders are carried by it. */
  dx: number;
  dy: number;
}

export interface Solid {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  owner: Entity | null;
  material: string;
  disabled: boolean;
  dynamic: boolean;
  dx: number;
  dy: number;
}

export interface Water {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Deep water kills players who fall in (otherwise it is wadeable). */
  deadly: boolean;
}

export interface FloorHit {
  y: number;
  surface: Surface | null;
  solid: Solid | null;
}

export interface FloorQuery {
  /** Surface to ignore (drop-through). */
  ignore?: Surface | null;
  /** Ignore one-way platforms entirely. */
  noOneWay?: boolean;
  /** Extra upward tolerance for ground surfaces and solid tops (they are never passable). */
  solidTolerance?: number;
}

const BUCKET = 64;
let nextId = 1;

export class Terrain {
  readonly width: number;
  readonly height: number;
  killY: number;
  surfaces: Surface[] = [];
  solids: Solid[] = [];
  water: Water[] = [];
  private sBuckets: Surface[][] = [];
  private oBuckets: Solid[][] = [];
  private dynSurfaces: Surface[] = [];
  private dynSolids: Solid[] = [];
  /** Incremented whenever static geometry changes (renderers use it to re-bake). */
  version = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.killY = height + 80;
    const n = Math.ceil(width / BUCKET) + 2;
    for (let i = 0; i < n; i++) {
      this.sBuckets.push([]);
      this.oBuckets.push([]);
    }
  }

  private bucketRange(x0: number, x1: number): [number, number] {
    const n = this.sBuckets.length;
    const a = Math.max(0, Math.min(n - 1, Math.floor(x0 / BUCKET)));
    const b = Math.max(0, Math.min(n - 1, Math.floor(x1 / BUCKET)));
    return [a, b];
  }

  addSurface(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opts: { oneWay?: boolean; ground?: boolean; owner?: Entity | null; material?: string; dynamic?: boolean } = {},
  ): Surface {
    if (x2 < x1) {
      [x1, x2] = [x2, x1];
      [y1, y2] = [y2, y1];
    }
    const s: Surface = {
      id: nextId++,
      x1,
      y1,
      x2,
      y2,
      oneWay: opts.oneWay ?? !opts.ground,
      ground: !!opts.ground,
      owner: opts.owner ?? null,
      material: opts.material ?? 'dirt',
      disabled: false,
      dynamic: !!opts.dynamic,
      dx: 0,
      dy: 0,
    };
    this.surfaces.push(s);
    if (s.dynamic) this.dynSurfaces.push(s);
    else {
      const [a, b] = this.bucketRange(x1, x2);
      for (let i = a; i <= b; i++) this.sBuckets[i].push(s);
      this.version++;
    }
    return s;
  }

  addSolid(x: number, y: number, w: number, h: number, opts: { owner?: Entity | null; material?: string; dynamic?: boolean } = {}): Solid {
    const s: Solid = {
      id: nextId++,
      x,
      y,
      w,
      h,
      owner: opts.owner ?? null,
      material: opts.material ?? 'stone',
      disabled: false,
      dynamic: !!opts.dynamic,
      dx: 0,
      dy: 0,
    };
    this.solids.push(s);
    if (s.dynamic) this.dynSolids.push(s);
    else {
      const [a, b] = this.bucketRange(x, x + w);
      for (let i = a; i <= b; i++) this.oBuckets[i].push(s);
      this.version++;
    }
    return s;
  }

  addWater(x: number, y: number, w: number, h: number, deadly = false): Water {
    const wt = { x, y, w, h, deadly };
    this.water.push(wt);
    return wt;
  }

  /** Remove (disable) a surface or solid. */
  remove(o: Surface | Solid): void {
    o.disabled = true;
    if (!o.dynamic) this.version++;
    if ('x1' in o) this.dynSurfaces = this.dynSurfaces.filter((s) => s !== o);
    else this.dynSolids = this.dynSolids.filter((s) => s !== o);
  }

  /** Move a dynamic surface (records dx/dy for riders). */
  moveSurface(s: Surface, x1: number, y1: number, x2: number, y2: number): void {
    s.dx = x1 - s.x1;
    s.dy = y1 - s.y1;
    s.x1 = x1;
    s.y1 = y1;
    s.x2 = x2;
    s.y2 = y2;
  }

  /** Move a dynamic solid (records dx/dy for riders). */
  moveSolid(s: Solid, x: number, y: number): void {
    s.dx = x - s.x;
    s.dy = y - s.y;
    s.x = x;
    s.y = y;
  }

  /** Call once per step before entity updates so stale deltas don't carry riders twice. */
  clearDeltas(): void {
    for (const s of this.dynSurfaces) {
      s.dx = 0;
      s.dy = 0;
    }
    for (const s of this.dynSolids) {
      s.dx = 0;
      s.dy = 0;
    }
  }

  static surfaceY(s: Surface, x: number): number {
    if (s.x2 === s.x1) return Math.min(s.y1, s.y2);
    let t = (x - s.x1) / (s.x2 - s.x1);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return s.y1 + (s.y2 - s.y1) * t;
  }

  private forSurfacesAt(x: number, fn: (s: Surface) => void): void {
    const i = Math.floor(x / BUCKET);
    const b = this.sBuckets[Math.max(0, Math.min(this.sBuckets.length - 1, i))];
    for (const s of b) if (!s.disabled && x >= s.x1 && x <= s.x2) fn(s);
    for (const s of this.dynSurfaces) if (!s.disabled && x >= s.x1 && x <= s.x2) fn(s);
  }

  private forSolidsNear(x0: number, x1: number, fn: (s: Solid) => boolean | void): void {
    const [a, b] = this.bucketRange(x0, x1);
    const seen = a === b ? null : new Set<number>();
    for (let i = a; i <= b; i++) {
      for (const s of this.oBuckets[i]) {
        if (s.disabled) continue;
        if (seen) {
          if (seen.has(s.id)) continue;
          seen.add(s.id);
        }
        if (fn(s) === true) return;
      }
    }
    for (const s of this.dynSolids) if (!s.disabled && fn(s) === true) return;
  }

  /**
   * Highest floor (smallest y) at x whose y lies within [yMin, yMax].
   * Ground surfaces and solid tops accept an extra upward tolerance (they're never passable).
   */
  floorAt(x: number, yMin: number, yMax: number, q: FloorQuery = {}): FloorHit | null {
    let best: FloorHit | null = null;
    const tol = q.solidTolerance ?? 0;
    this.forSurfacesAt(x, (s) => {
      if (s === q.ignore) return;
      if (s.oneWay && q.noOneWay) return;
      const y = Terrain.surfaceY(s, x);
      const lo = s.oneWay ? yMin : yMin - tol;
      if (y >= lo && y <= yMax && (!best || y < best.y)) best = { y, surface: s, solid: null };
    });
    this.forSolidsNear(x, x, (o) => {
      if (x < o.x || x >= o.x + o.w) return;
      const y = o.y;
      if (y >= yMin - tol && y <= yMax && (!best || y < best.y)) best = { y, surface: null, solid: o };
    });
    return best;
  }

  /** First floor at or below y (for placing spawns). */
  groundBelow(x: number, y: number): number | null {
    const h = this.floorAt(x, y, Infinity);
    return h ? h.y : null;
  }

  /** Highest floor at x anywhere (top-most platform/ground). */
  topFloorAt(x: number): number | null {
    const h = this.floorAt(x, -Infinity, Infinity);
    return h ? h.y : null;
  }

  /** Top of solid earth at x (ground surfaces only). Infinity over pits. */
  groundTopAt(x: number): number {
    let best = Infinity;
    this.forSurfacesAt(x, (s) => {
      if (!s.ground) return;
      const y = Terrain.surfaceY(s, x);
      if (y < best) best = y;
    });
    return best;
  }

  /** First solid box overlapping rect (strict), or null. */
  solidOverlap(r: Rect, ignoreOwner?: Entity | null): Solid | null {
    let hit: Solid | null = null;
    this.forSolidsNear(r.x, r.x + r.w, (o) => {
      if (ignoreOwner && o.owner === ignoreOwner) return;
      if (r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y) {
        hit = o;
        return true;
      }
    });
    return hit;
  }

  /** Is the point inside a solid box or below solid ground? (bullets, explosions) */
  isSolidPoint(x: number, y: number): boolean {
    if (y > this.groundTopAt(x)) return true;
    let hit = false;
    this.forSolidsNear(x, x, (o) => {
      if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) {
        hit = true;
        return true;
      }
    });
    return hit;
  }

  /** Solid box containing the point (if any). */
  solidAt(x: number, y: number): Solid | null {
    let hit: Solid | null = null;
    this.forSolidsNear(x, x, (o) => {
      if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) {
        hit = o;
        return true;
      }
    });
    return hit;
  }

  /** March along a segment; returns first solid point hit or null. */
  raycast(x0: number, y0: number, x1: number, y1: number, step = 2): { x: number; y: number } | null {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (this.isSolidPoint(x, y)) return { x, y };
    }
    return null;
  }

  waterAt(x: number, y: number): Water | null {
    for (const w of this.water) if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return w;
    return null;
  }

  /** All static solids (for renderers). */
  staticSolids(): Solid[] {
    return this.solids.filter((s) => !s.dynamic && !s.disabled);
  }

  groundSurfaces(): Surface[] {
    return this.surfaces.filter((s) => s.ground && !s.disabled);
  }

  platforms(): Surface[] {
    return this.surfaces.filter((s) => s.oneWay && !s.disabled);
  }
}
