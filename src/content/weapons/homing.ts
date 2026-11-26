// C - CHASER MISSILES: every shot launches a pair of small missiles that pop out at an angle,
// ignite, and hunt down enemies with strong homing (the pair splits between two targets).

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { angleDiff, angleTo, rotateTowards } from '../../engine/math';
import { registerWeapon } from '../../game/weapons';
import { Projectile } from '../../game/projectile';
import { Z } from '../../game/constants';
import type { Entity } from '../../game/entity';
import type { World } from '../../game/world';
import type { Player } from '../../game/player';

sprites.define({
  name: 'chaser_missile',
  w: 12,
  h: 5,
  ox: 6,
  oy: 2,
  frames: 2,
  draw: (p, f) => {
    p.poly([3, 1, 3 - (f ? 3 : 2), 2.5, 3, 4], f ? '#ffd040' : '#ff9a2e');
    p.capsule(4, 2.5, 8.5, 2.5, 1.25, '#e4e4ec');
    p.rect(4, 1.5, 4, 1, '#ffffff');
    p.poly([8.5, 1.2, 11.5, 2.5, 8.5, 3.8], '#d8402a');
    p.px(4, 0, '#7a7a8a');
    p.px(4, 4, '#7a7a8a');
  },
});

sprites.define({
  name: 'muzzle_homing',
  w: 10,
  h: 10,
  ox: 0,
  oy: 5,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    p.circle(3.5, 3, f ? 2 : 2.8, f ? '#ff9a2e' : '#ffd040');
    p.circle(3.5, 7, f ? 2 : 2.8, f ? '#ff9a2e' : '#ffd040');
    if (!f) {
      p.px(3, 3, '#ffffff');
      p.px(3, 7, '#ffffff');
    }
  },
});

/** Enemies worth chasing, best first (near, in front, on screen). */
export function chaserTargets(world: World, x: number, y: number, a: number): Entity[] {
  const scored: [Entity, number][] = [];
  for (const t of world.targets('player')) {
    if (t.team !== 'enemy' || t.dead || !t.onScreen(12)) continue;
    const d = Math.hypot(t.cx - x, t.cy - y);
    const behind = Math.abs(angleDiff(a, angleTo(x, y, t.cx, t.cy))) > Math.PI / 2;
    scored.push([t, d + (behind ? 160 : 0)]);
  }
  scored.sort((p, q) => p[1] - q[1]);
  return scored.map((s) => s[0]);
}

export class ChaserMissile extends Projectile {
  target: Entity | null;
  private smokeT = 0;

  constructor(owner: Player, x: number, y: number, angle: number, target: Entity | null) {
    super({
      team: 'player',
      owner,
      x,
      y,
      vx: Math.cos(angle) * 140,
      vy: Math.sin(angle) * 140,
      damage: 1,
      kind: 'explosion',
      w: 6,
      h: 5,
      sprite: 'chaser_missile',
      rotate: true,
      fps: 20,
      life: 3.2,
      explode: { radius: 13, damage: 5, size: 'small', shake: 1, sfx: 'explosion_small' },
    });
    this.target = target;
    this.offscreenMargin = 60;
    this.z = Z.PROJECTILE + 1;
  }

  protected override move(dt: number): void {
    let ang = Math.atan2(this.vy, this.vx);
    let sp = Math.hypot(this.vx, this.vy);
    if (this.age < 0.16) {
      sp = Math.max(40, sp * Math.pow(0.02, dt));
    } else {
      if (!this.target || this.target.dead || !this.target.hittable) this.target = chaserTargets(this.world, this.x, this.y, ang)[0] ?? null;
      if (this.target) ang = rotateTowards(ang, angleTo(this.x, this.y, this.target.cx, this.target.cy), 7.5 * dt);
      sp = Math.min(330, sp + 950 * dt);
    }
    this.vx = Math.cos(ang) * sp;
    this.vy = Math.sin(ang) * sp;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.smokeT -= dt;
    if (this.smokeT <= 0 && this.age >= 0.16) {
      this.smokeT = 0.03;
      this.world.particles.add({ kind: 'smoke', x: this.x - Math.cos(ang) * 5, y: this.y - Math.sin(ang) * 5, vx: fxRng.range(-6, 6), vy: fxRng.range(-8, 2), life: fxRng.range(0.25, 0.4), color: '#f0f0f0', color2: '#9a9aa2', size: 1, size2: 2.5, drag: 2 });
    }
  }
}

registerWeapon({
  id: 'homing',
  name: 'CHASER MISSILES',
  letter: 'C',
  ammo: 40,
  auto: false,
  cooldown: 0.32,
  gun: 'homing',
  color: '#e8c040',
  heavy: true,
  sfx: 'homing_fire',
  flash: true,
  muzzle: 'muzzle_homing',
  recoil: 1,
  fire(p, x, y, a) {
    const w = p.world;
    const ts = chaserTargets(w, x, y, a);
    const t1 = ts[0] ?? null;
    const t2 = ts[1] ?? t1;
    w.add(new ChaserMissile(p, x, y - 1, a - 0.5, t1));
    w.add(new ChaserMissile(p, x, y + 1, a + 0.5, t2));
    w.particles.smokePuffs(x, y, 2, 2, '#e0e0e0', '#9a9aa2');
  },
});
