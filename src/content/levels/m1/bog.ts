// m1_bog - the muddy jungle river ford of Palm Harbor: the end of the BULLDOG beat.
// Soldiers wade through (shallow water just slows them), but a ground vehicle that rolls into the
// river sinks into the mud: its treads catch, it lurches to a stop and churns up mud and bubbles
// for BOG_TIME s (the driver can still bail out with DOWN+JUMP), then it gives up the ghost - the
// standard vehicle destruction throws the pilot clear (invulnerable) and the wreck blows up (the
// blast only hurts the Legion). A warning sign before the ford (decor 'sign' v 4) shows it.
// Invisible trigger, category misc (not hittable).
// props: w = width of the bog in px (default 150), centred on x; only vehicles standing in water
//        inside it are caught. Place it at the river (y omitted = the river bed).

import { fxRng } from '../../../engine/rng';
import { Entity } from '../../../game/entity';
import { registerEntity } from '../../../game/registry';
import type { Vehicle } from '../../../game/vehicle';

/** Seconds a caught vehicle struggles before it is wrecked. */
export const BOG_TIME = 1.1;
const MUD = ['#6a5038', '#8a6a48', '#54402c', '#9c8a74'];

interface Caught {
  v: Vehicle;
  x: number;
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
  }

  override update(dt: number): void {
    // Catch vehicles that roll (or land) in the water inside the bog.
    for (const e of this.world.query((x) => (x as any).isVehicle === true)) {
      const v = e as Vehicle;
      if (v.dead || v.destroyed || v.flying || this.caught.some((c) => c.v === v)) continue;
      if (Math.abs(v.x - this.x) > this.half || !v.inWater || !v.onGround) continue;
      this.caught.push({ v, x: v.x, t: 0, fx: 0 });
      this.world.particles.splash(v.x, v.inWater.y, 12, '#bfe6ff');
      this.world.particles.debris(v.x, v.y - 2, 8, MUD, 120);
      this.world.sfx('splash', v.x, { vol: 0.9, pitch: 0.7 });
      this.world.shake(2, 0.2);
    }
    for (const c of this.caught) {
      const v = c.v;
      if (v.dead || v.destroyed) continue;
      c.t += dt;
      // Stuck fast: the treads spin in the mud, it can neither drive nor hop out.
      const wob = Math.sin(c.t * 40) * 0.6;
      v.x = c.x + wob;
      v.vx = 0;
      if (v.vy < 0 || !v.onGround) {
        const fl = this.world.terrain.floorAt(c.x, v.y - 20, v.y + 20);
        if (fl) v.y = fl.y;
        v.vy = 0;
        v.onGround = true;
      }
      c.fx -= dt;
      if (c.fx <= 0) {
        c.fx = 0.07;
        const side = fxRng.chance(0.5) ? -1 : 1;
        const sx = v.x + side * fxRng.range(6, v.w / 2);
        this.world.particles.debris(sx, v.y - 3, 2, MUD, 90);
        const wy = v.inWater ? v.inWater.y : v.y - 6;
        if (fxRng.chance(0.5)) this.world.particles.splash(v.x + fxRng.range(-v.w / 2, v.w / 2), wy, 2, '#d8f4ff');
        if (fxRng.chance(0.25)) this.world.particles.smokePuffs(v.x - v.facing * v.w * 0.3, v.y - v.h, 1, 3, '#4a4a52', '#2a2a30');
      }
      if (Math.floor((c.t - dt) / 0.36) !== Math.floor(c.t / 0.36)) this.world.sfx('tank_tread', v.x, { vol: 0.6, pitch: 0.8 });
      if (c.t >= BOG_TIME) {
        this.wrecked++;
        this.world.sfx('splash', v.x, { vol: 1, pitch: 0.55 });
        this.world.particles.splash(v.x, v.inWater ? v.inWater.y : v.y - 6, 16, '#bfe6ff');
        this.world.particles.debris(v.x, v.y - 4, 14, MUD, 170);
        v.startDestruction();
      }
    }
    this.caught = this.caught.filter((c) => !c.v.dead && !c.v.destroyed);
  }

  override render(): void {}
}

registerEntity(
  'm1_bog',
  'misc',
  (_w, s) => new RiverBog(s.props ?? {}),
  'Mission 1 river ford mud (invisible trigger): a ground vehicle that rolls into the water inside it sticks fast, churns mud for ~1.1 s, then is wrecked (pilot thrown clear, invulnerable). Soldiers just wade. props.w = width (150), centred on x; y omitted = river bed.',
);
