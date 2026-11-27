// m1_bog - the muddy jungle river ford of Palm Harbor: the end of the BULLDOG beat.
// Soldiers wade through (shallow water just slows them), but a ground vehicle that rolls into the
// river sinks into the mud: its treads catch, it settles into a churning mud mound and spits mud,
// bubbles and smoke for BOG_TIME s (the driver can still bail out with DOWN+JUMP), then it gives up
// the ghost - the standard vehicle destruction throws the pilot clear (invulnerable) and the wreck
// blows up (the blast only hurts the Legion). A warning sign before the ford (decor 'sign' v 4,
// NO VEHICLES / MUD) announces it.
// Invisible trigger that draws the mud around caught vehicles; category misc (not hittable).
// props: w = width of the bog in px (default 150), centred on x; only vehicles standing in water
//        inside it are caught. Place it at the river (y omitted = the river bed).

import { fxRng } from '../../../engine/rng';
import { Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { registerEntity } from '../../../game/registry';
import type { Vehicle } from '../../../game/vehicle';

/** Seconds a caught vehicle struggles before it is wrecked. */
export const BOG_TIME = 1.1;
/** How deep (px) a caught vehicle settles into the mud. */
const SINK = 7;
const MUD = ['#6a5038', '#8a6a48', '#54402c', '#9c8a74'];

interface Caught {
  v: Vehicle;
  x: number;
  /** River-bed y under the vehicle. */
  bed: number;
  t: number;
  fx: number;
}

export class RiverBog extends Entity {
  /** Half-width of the bog. */
  readonly half: number;
  private caught: Caught[] = [];
  /** Vehicles wrecked by this bog (tests / debug). */
  wrecked = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.half = Math.max(8, (typeof props.w === 'number' ? props.w : 150) / 2);
    this.w = this.half * 2;
    this.h = 8;
    this.team = 'neutral';
    this.hittable = false;
    this.persistent = true;
    this.z = Z.VEHICLE + 1; // the mud mound covers the sunken treads
  }

  /** Is this vehicle stuck in the mud? */
  holds(v: Entity): boolean {
    return this.caught.some((c) => c.v === v);
  }

  override update(dt: number): void {
    // Catch vehicles that roll (or land) in the water inside the bog.
    for (const e of this.world.query((x) => (x as any).isVehicle === true)) {
      const v = e as Vehicle;
      if (v.dead || v.destroyed || v.flying || this.holds(v)) continue;
      if (Math.abs(v.x - this.x) > this.half || !v.inWater || !v.onGround) continue;
      this.caught.push({ v, x: v.x, bed: v.y, t: 0, fx: 0 });
      v.collideTerrain = false; // the bog holds it now (no snapping back onto the bed)
      this.world.particles.splash(v.x, v.inWater.y, 12, '#bfe6ff');
      this.world.particles.debris(v.x, v.y - 2, 8, MUD, 120);
      this.world.sfx('splash', v.x, { vol: 0.9, pitch: 0.7 });
      this.world.shake(2, 0.2);
    }
    for (const c of this.caught) {
      const v = c.v;
      if (v.dead) continue;
      c.t += dt;
      // Stuck fast and settling: the treads spin in the mud, it can neither drive nor hop out.
      const sink = Math.min(SINK, (c.t / BOG_TIME) * SINK);
      v.x = c.x + (v.destroyed ? 0 : Math.sin(c.t * 40) * 0.6);
      v.y = c.bed + sink;
      v.vx = 0;
      v.vy = 0;
      v.onGround = true;
      v.gravityScale = 0;
      c.fx -= dt;
      if (c.fx <= 0 && !v.destroyed) {
        c.fx = 0.07;
        const side = fxRng.chance(0.5) ? -1 : 1;
        const sx = v.x + side * fxRng.range(6, v.w / 2 + 2);
        this.world.particles.debris(sx, c.bed - 3, 2, MUD, 95);
        const wy = v.inWater ? v.inWater.y : c.bed - 12;
        if (fxRng.chance(0.55)) this.world.particles.splash(v.x + fxRng.range(-v.w / 2, v.w / 2), wy, 2, '#d8f4ff');
        if (fxRng.chance(0.25)) this.world.particles.smokePuffs(v.x - v.facing * v.w * 0.3, v.y - v.h, 1, 3, '#4a4a52', '#2a2a30');
      }
      if (!v.destroyed && Math.floor((c.t - dt) / 0.36) !== Math.floor(c.t / 0.36)) this.world.sfx('tank_tread', v.x, { vol: 0.6, pitch: 0.8 });
      if (!v.destroyed && c.t >= BOG_TIME) {
        this.wrecked++;
        this.world.sfx('splash', v.x, { vol: 1, pitch: 0.55 });
        this.world.particles.splash(v.x, v.inWater ? v.inWater.y : c.bed - 12, 16, '#bfe6ff');
        this.world.particles.debris(v.x, c.bed - 4, 14, MUD, 170);
        v.startDestruction();
      }
    }
    this.caught = this.caught.filter((c) => !c.v.dead);
  }

  override render(g: CanvasRenderingContext2D): void {
    // A churned mud mound around each caught vehicle, swallowing its treads.
    for (const c of this.caught) {
      const v = c.v;
      if (v.dead) continue;
      const grow = Math.min(1, c.t / 0.35);
      const half = Math.round(v.w / 2 + 6);
      const x0 = Math.round(c.x) - half;
      const bed = Math.round(c.bed);
      for (let i = 0; i <= half * 2; i++) {
        const u = Math.abs(i - half) / half; // 0 centre .. 1 rim
        // Mud shoved up into a lip on both sides of the hull, slumping off at the rim.
        const lip = u < 0.6 ? 2 : u < 0.88 ? 2 + (u - 0.6) * 9 : 4.5 * (1 - (u - 0.88) / 0.12);
        const rise = Math.round(grow * (lip + Math.sin(i * 1.7 + c.t * 3) * 0.6));
        const top = bed - rise;
        const depth = bed + SINK + 1 + ((i * 7) % 4) - top;
        if (depth <= 0) continue;
        g.fillStyle = '#54402c';
        g.fillRect(x0 + i, top, 1, depth);
        g.fillStyle = '#7a5e42';
        g.fillRect(x0 + i, top, 1, 1);
        if ((i * 7 + Math.floor(c.t * 9)) % 11 === 0) {
          g.fillStyle = '#a08868';
          g.fillRect(x0 + i, top + 1, 1, 1);
        }
        if ((i * 5) % 13 === 0) {
          g.fillStyle = '#3e3024';
          g.fillRect(x0 + i, top + 2 + (i % 3), 1, 1);
        }
      }
    }
  }
}

registerEntity(
  'm1_bog',
  'misc',
  (_w, s) => new RiverBog(s.props ?? {}),
  'Mission 1 river ford mud (invisible trigger): a ground vehicle that rolls into the water inside it sticks fast, sinks into a mud mound for ~1.1 s, then is wrecked (pilot thrown clear, invulnerable). Soldiers just wade. props.w = width (150), centred on x; y omitted = river bed.',
);
