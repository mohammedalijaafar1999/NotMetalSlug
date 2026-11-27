// m5_airspace - invisible flight-control helper for the sky mission (one alive at a time).
//
// 1. Hull safety. In STORMFRONT the gyro shares the sky with airship hulls (solids) while the camera
//    auto-scrolls. Two engine behaviours can leave a gyro overlapping a hull: Vehicle.clampToView
//    pushes a gyro that is blocked by a hull side along with the scrolling camera, and a respawned
//    gyro is dropped in at a fixed height that a hull may occupy. Neither kills (there is no crush
//    damage), but a gyro stuck in a hull looks broken. Every frame each player-driven flying vehicle
//    that overlaps a solid is eased out vertically toward the nearest free spot inside the view
//    (preferring up, i.e. onto the deck), so a blocked gyro slides over the hull instead.
// 2. Spare gyros. A pilot whose DRAGONFLY is shot down over an airship deck lands on it on foot
//    (over open sky he falls into the clouds and respawns in a new gyro as usual). Rather than leave
//    him stranded with a pistol on a deck that is scrolling away, a spare gyro (few bombs) drops in
//    from the top of the screen after a moment, settles over him and he climbs in.
// 3. Parachutes. A pickup that tumbles off a deck into the open sky (a hostage's gift tossed
//    toward a gyro beside the ship, an enemy's drop) is swapped for a slowly drifting supply drop
//    with the same contents, so it can still be caught.
// 4. Take-off. Players start (and drop in as player 2, or respawn) in a gyro just under the top
//    edge of the view, where the HUD is: each fresh gyro up there is eased down into open sky.
// Place a few along the level (x = trigger point); extras remove themselves.

import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import { rectsOverlap } from '../../../engine/math';
import { Entity } from '../../../game/entity';
import { registerEntity } from '../../../game/registry';
import type { Player } from '../../../game/player';
import { isVehicle, type Vehicle } from '../../../game/vehicle';
import { Pickup } from '../../../game/pickup';
import { parachutePickup } from './supply';

/** Max push per frame (px) - fast enough to beat the camera, slow enough to read as a nudge. */
const PUSH = 3;
const SEARCH = 96;
/** Seconds on foot (on a deck) before the spare gyro is sent. */
export const SPARE_DELAY = 1.1;
/** Spare gyro descent speed (px/s). */
const SPARE_SPEED = 150;
/** Bombs in a spare gyro. */
export const SPARE_AMMO = 6;

/** Take-off: fresh gyros above this screen y glide down to TAKEOFF_Y (for at most TAKEOFF_TIME s). */
const TAKEOFF_ABOVE = 72;
const TAKEOFF_Y = 104;
const TAKEOFF_TIME = 1.6;

interface Ferry {
  gyro: Vehicle;
  /** Seconds since it was sent. */
  t: number;
}

export class Airspace extends Entity {
  /** Seconds each player has been stranded on foot (by player index). */
  private afoot = new Map<number, number>();
  /** Spare gyros on their way (by player index). */
  private ferries = new Map<number, Ferry>();
  /** Fresh gyros still gliding down from under the HUD (with seconds since they were seen). */
  private takeoff: { v: Vehicle; t: number }[] = [];
  /** Player vehicles already considered for a take-off glide. */
  private seen = new WeakSet<Vehicle>();

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

  override update(dt: number): void {
    this.watchTakeoffs();
    if (this.takeoff.length) this.glide(dt);
    this.chutes();
    for (const p of this.world.players) {
      this.unstick(p);
      this.spare(p, dt);
    }
  }

  private unstick(p: Player): void {
    const v = p.vehicle as Vehicle | null;
    if (!v || !v.flying || v.destroyed || v.dead) return;
    const fy = Airspace.freeY(v);
    if (fy === null || fy === v.y) return;
    const d = fy - v.y;
    v.y += Math.max(-PUSH, Math.min(PUSH, d));
    if (d < 0 && v.vy > 0) v.vy = 0;
    if (d > 0 && v.vy < 0) v.vy = 0;
  }

  /** Loose pickups falling with nothing below them get a parachute (see header). */
  private chutes(): void {
    const w = this.world;
    const T = w.terrain;
    for (const e of w.entities) {
      if (!(e instanceof Pickup) || e.dead || e.onGround || e.vy < 30 || e.collectedBy) continue;
      if (T.floorAt(e.x, e.y, T.killY)) continue;
      parachutePickup(w, e);
    }
  }

  /** Queue every fresh player gyro that appears near the top of the view for a take-off glide. */
  private watchTakeoffs(): void {
    const cam = this.world.camera;
    for (const p of this.world.players) {
      const v = p.vehicle as Vehicle | null;
      if (!v || !v.flying || this.seen.has(v)) continue;
      this.seen.add(v);
      if (v.y - cam.y < TAKEOFF_ABOVE) this.takeoff.push({ v, t: 0 });
    }
  }

  /** Ease fresh gyros down to open sky (until the pilot steers vertically or a hull is below). */
  private glide(dt: number): void {
    const T = this.world.terrain;
    const ty = this.world.camera.y + TAKEOFF_Y;
    this.takeoff = this.takeoff.filter((g) => {
      const v = g.v;
      const d = v.driver;
      g.t += dt;
      if (!d || v.dead || v.destroyed || g.t > TAKEOFF_TIME || d.inp.dirY !== 0 || v.y >= ty - 1) return false;
      const ny = v.y + Math.max(1, (ty - v.y) * Math.min(1, dt * 4));
      if (T.solidOverlap({ x: v.x - v.w / 2, y: ny - v.h, w: v.w, h: v.h - 0.5 }, v)) return false;
      v.y = ny;
      v.vy = Math.max(0, v.vy);
      return true;
    });
  }

  /** Stranded-pilot pickup (see header). */
  private spare(p: Player, dt: number): void {
    const w = this.world;
    const type = w.level?.def.startVehicle;
    const ferry = this.ferries.get(p.index);
    const stranded = !!type && p.state === 'play' && !p.vehicle && !p.dead;
    if (!stranded) {
      this.afoot.delete(p.index);
      if (ferry) {
        // Not needed any more (he died, respawned or got in): climb away and vanish.
        const g = ferry.gyro;
        if (g.driver || g.dead) this.ferries.delete(p.index);
        else {
          g.y -= SPARE_SPEED * dt;
          g.vx = g.vy = 0;
          if (g.y < w.camera.y - 8) {
            g.remove();
            this.ferries.delete(p.index);
          }
        }
      }
      return;
    }
    if (!ferry) {
      const t = (this.afoot.get(p.index) ?? 0) + (p.onGround ? dt : 0);
      this.afoot.set(p.index, t);
      if (t < SPARE_DELAY) return;
      // Drop in from the top, ahead of him (the top-left corner is under the HUD).
      const sx = Math.min(w.camera.x + VIEW_W - 40, Math.max(w.camera.x + 150, p.x + 70));
      const g = w.spawn(type!, sx, w.camera.y - 6, { ammo: SPARE_AMMO });
      if (!g || !isVehicle(g)) return;
      g.facing = p.facing;
      this.ferries.set(p.index, { gyro: g, t: 0 });
      w.floatText('SPARE GYRO!', p.x, p.y - 40, '#9fe8c8', 1.1);
      w.sfx('gyro_rotor', p.x, { vol: 0.6 });
      return;
    }
    const g = ferry.gyro;
    if (g.dead || g.destroyed) {
      this.ferries.delete(p.index);
      return;
    }
    ferry.t += dt;
    // Settle just over the pilot (he stands on a deck), then he climbs in.
    const tx = p.x;
    const ty = p.y + 2;
    const dx = tx - g.x;
    const dy = ty - g.y;
    const d = Math.hypot(dx, dy);
    const step = SPARE_SPEED * dt;
    if (d > step) {
      g.x += (dx / d) * step;
      g.y += (dy / d) * step;
    } else {
      g.x = tx;
      g.y = ty;
    }
    g.vx = g.vy = 0;
    if (p.canEnterVehicle && (rectsOverlap(p.box, g.entryBox()) || ferry.t > 3)) {
      g.x = p.x;
      g.y = Math.min(g.y, p.y);
      g.enter(p);
      p.invuln = Math.max(p.invuln, 1.2);
      g.invuln = Math.max(g.invuln, 1.2);
      this.ferries.delete(p.index);
      this.afoot.delete(p.index);
    }
  }

  override render(): void {}
}

registerEntity(
  'm5_airspace',
  'misc',
  () => new Airspace(),
  'Mission 5 flight-control helper (invisible, one at a time): eases player gyros out of airship hulls they were squeezed or respawned into, and flies a spare gyro (props-free) down to a pilot stranded on a deck after being shot down',
);
