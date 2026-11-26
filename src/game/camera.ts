// Camera: forward-only horizontal scrolling (classic run-and-gun), vertical follow within
// level-defined bounds, camera locks (arenas) and auto-scroll sections.

import { VIEW_H, VIEW_W } from '../engine/renderer';
import { clamp, smoothing } from '../engine/math';

export interface CameraKey {
  /** Camera left x where this key applies. */
  x: number;
  /** Min/max camera top y. */
  minY: number;
  maxY: number;
}

export interface AutoScroll {
  x1: number;
  x2: number;
  speed: number;
}

export class Camera {
  x = 0;
  y = 0;
  readonly w = VIEW_W;
  readonly h = VIEW_H;
  /** Lowest x the camera may return to (never scrolls back). */
  minX = 0;
  /** When set, the camera eases to and holds this x (arena). */
  lockX: number | null = null;
  levelW = VIEW_W;
  levelH = VIEW_H;
  keys: CameraKey[] = [];
  autoScroll: AutoScroll[] = [];
  /** Max horizontal follow speed px/s. */
  followSpeed = 260;
  /** Where the lead player sits horizontally (0..1 of the view). */
  leadFrac = 0.42;
  /** True while an auto-scroll section is pushing the camera. */
  autoScrolling = false;

  setLevel(w: number, h: number, keys: CameraKey[], auto: AutoScroll[]): void {
    this.levelW = w;
    this.levelH = h;
    this.keys = keys.slice().sort((a, b) => a.x - b.x);
    this.autoScroll = auto;
  }

  /** Vertical bounds for camera-left x (interpolated between keys). */
  boundsAt(x: number): { minY: number; maxY: number } {
    const maxTop = Math.max(0, this.levelH - VIEW_H);
    if (!this.keys.length) return { minY: maxTop, maxY: maxTop };
    if (x <= this.keys[0].x) return { minY: this.keys[0].minY, maxY: this.keys[0].maxY };
    for (let i = 0; i < this.keys.length - 1; i++) {
      const a = this.keys[i];
      const b = this.keys[i + 1];
      if (x >= a.x && x <= b.x) {
        const t = b.x === a.x ? 1 : (x - a.x) / (b.x - a.x);
        return { minY: a.minY + (b.minY - a.minY) * t, maxY: a.maxY + (b.maxY - a.maxY) * t };
      }
    }
    const l = this.keys[this.keys.length - 1];
    return { minY: l.minY, maxY: l.maxY };
  }

  /** Snap to a position immediately (level start / respawn at checkpoint). */
  snapTo(px: number, py: number): void {
    this.x = clamp(px - this.w * this.leadFrac, 0, Math.max(0, this.levelW - this.w));
    this.minX = this.x;
    const b = this.boundsAt(this.x);
    this.y = clamp(py - this.h * 0.62, b.minY, b.maxY);
  }

  /**
   * targets: positions of living players (feet). `leadX` = the furthest-right player x.
   */
  update(dt: number, targets: { x: number; y: number }[]): void {
    const maxX = Math.max(0, this.levelW - this.w);
    this.autoScrolling = false;
    if (this.lockX !== null) {
      const tx = clamp(this.lockX, 0, maxX);
      const d = tx - this.x;
      const step = this.followSpeed * dt;
      this.x = Math.abs(d) <= step ? tx : this.x + Math.sign(d) * step;
    } else {
      const auto = this.autoScroll.find((a) => this.x >= a.x1 && this.x < a.x2);
      if (auto) {
        this.x = Math.min(this.x + auto.speed * dt, auto.x2);
        this.autoScrolling = true;
      } else if (targets.length) {
        const lead = Math.max(...targets.map((t) => t.x));
        const tx = clamp(lead - this.w * this.leadFrac, this.minX, maxX);
        if (tx > this.x) this.x = Math.min(tx, this.x + this.followSpeed * dt);
      }
    }
    this.x = clamp(this.x, 0, maxX);
    if (this.lockX === null) this.minX = Math.max(this.minX, this.x);

    const b = this.boundsAt(this.x);
    if (targets.length) {
      const avgY = targets.reduce((s, t) => s + t.y, 0) / targets.length;
      const ty = clamp(avgY - this.h * 0.64, b.minY, b.maxY);
      this.y += (ty - this.y) * smoothing(5, dt);
    }
    this.y = clamp(this.y, b.minY, b.maxY);
    this.y = clamp(this.y, 0, Math.max(0, this.levelH - this.h));
  }

  get right(): number {
    return this.x + this.w;
  }

  get bottom(): number {
    return this.y + this.h;
  }
}
