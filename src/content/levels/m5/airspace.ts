// m5_airspace - invisible flight-safety helper for the sky mission (one alive at a time).
//
// In STORMFRONT the gyro shares the sky with airship hulls (solids) while the camera auto-scrolls.
// Two engine behaviours can leave a gyro overlapping a hull: Vehicle.clampToView pushes a gyro that
// is blocked by a hull side along with the scrolling camera, and a respawned gyro is dropped in at a
// fixed height that a hull may occupy. Neither kills (there is no crush damage), but a gyro stuck
// in a hull looks broken. This helper checks every player-driven flying vehicle each frame and, if
// it overlaps a solid, eases it out vertically toward the nearest free spot inside the view
// (preferring up, i.e. onto the deck), so a blocked gyro slides over the hull instead.
// Place a few along the level (x = trigger point); extras remove themselves.

import { VIEW_H } from '../../../engine/renderer';
import { Entity } from '../../../game/entity';
import { registerEntity } from '../../../game/registry';
import type { Vehicle } from '../../../game/vehicle';

/** Max push per frame (px) - fast enough to beat the camera, slow enough to read as a nudge. */
const PUSH = 3;
const SEARCH = 96;

export class Airspace extends Entity {
  constructor() {
    super();
    this.team = 'neutral';
    this.hittable = false;
    this.persistent = true;
    this.w = 1;
    this.h = 1;
  }

  override spawned(): void {
    const others = this.world.query((e) => e !== this && e instanceof Airspace);
    if (others.length) this.remove();
  }

  /** Free y (feet) for vehicle v near its current y, inside the camera's flying band; null if none. */
  static freeY(v: Vehicle): number | null {
    const T = v.world.terrain;
    const cam = v.world.camera;
    const lo = cam.y + v.h + 14;
    const hi = cam.y + VIEW_H - 6;
    const hw = v.w / 2;
    const fits = (y: number) => y >= lo && y <= hi && !T.solidOverlap({ x: v.x - hw, y: y - v.h, w: v.w, h: v.h - 0.5 }, v);
    if (fits(v.y)) return v.y;
    for (let d = 1; d <= SEARCH; d++) {
      if (fits(v.y - d)) return v.y - d;
      if (d <= SEARCH * 0.6 && fits(v.y + d)) return v.y + d;
    }
    return null;
  }

  override update(_dt: number): void {
    for (const p of this.world.players) {
      const v = p.vehicle as Vehicle | null;
      if (!v || !v.flying || v.destroyed || v.dead) continue;
      const fy = Airspace.freeY(v);
      if (fy === null || fy === v.y) continue;
      const d = fy - v.y;
      v.y += Math.max(-PUSH, Math.min(PUSH, d));
      if (d < 0 && v.vy > 0) v.vy = 0;
      if (d > 0 && v.vy < 0) v.vy = 0;
    }
  }

  override render(): void {}
}

registerEntity('m5_airspace', 'misc', () => new Airspace(), 'Mission 5 flight-safety helper (invisible, one at a time): eases player gyros out of airship hulls they were squeezed or respawned into');
