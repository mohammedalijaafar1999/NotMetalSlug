// F - FLAME SHOT: rolling fireballs that grow as they travel, pass through every enemy
// (damage kind 'fire' - victims die burnt) and leave short-lived burning puffs on the ground.

import { sprites } from '../../engine/sprites';
import { Rng, fxRng } from '../../engine/rng';
import { registerWeapon } from '../../game/weapons';
import { Projectile } from '../../game/projectile';
import { Z } from '../../game/constants';
import type { Entity } from '../../game/entity';
import type { Player } from '../../game/player';
import { GroundFire, floorNear } from './fx';

const FLAME_COLS = ['#c8301a', '#f07a1e', '#ffd23c', '#fff6b0'];

sprites.define({
  name: 'fireball',
  w: 24,
  h: 20,
  ox: 14,
  oy: 10,
  frames: 8,
  outline: '#5a1208',
  draw: (p, f) => {
    const R = [3.6, 4.6, 5.6, 6.2, 6.9, 7.2, 6.9, 7.3][f];
    const cx = 14;
    const cy = 10;
    const rng = new Rng(900 + f * 7);
    const ks = [1, 0.78, 0.56, 0.3];
    for (let li = 0; li < 4; li++) {
      const k = ks[li];
      const col = FLAME_COLS[li];
      p.circle(cx, cy, R * k, col);
      // Tongues trailing behind (art points right; drawn rotated to velocity).
      for (let j = 1; j <= 3; j++) {
        const tx = cx - j * R * 0.62;
        const ty = cy + Math.sin(f * 1.3 + j * 2.1) * R * 0.38;
        const r = R * k * (1 - j * 0.24);
        if (r > 0.5) p.circle(tx, ty, r, col);
      }
    }
    for (let i = 0; i < 3; i++) p.px(Math.round(cx + rng.range(-R, R * 0.6)), Math.round(cy + rng.range(-R, R)), '#ffffff');
  },
});

sprites.define({
  name: 'muzzle_flame',
  w: 12,
  h: 10,
  ox: 0,
  oy: 5,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    p.circle(4, 5, f ? 3.2 : 4.2, f ? '#f07a1e' : '#ffd23c');
    p.circle(3, 5, f ? 1.8 : 2.4, '#fff6b0');
    p.px(9, 3, '#ffd23c');
    p.px(8, 7, '#f07a1e');
  },
});

/** Rolling fireball: slows down, grows, rises a touch, pierces, leaves burning puffs. */
export class Fireball extends Projectile {
  private puffDist = 6;
  private trailT = 0;
  private readonly maxLife: number;

  constructor(owner: Player, x: number, y: number, angle: number) {
    const sp = 285;
    super({
      team: 'player',
      owner,
      x,
      y,
      vx: Math.cos(angle) * sp,
      vy: Math.sin(angle) * sp,
      damage: 4,
      kind: 'fire',
      w: 10,
      h: 10,
      pierce: 999,
      sprite: 'fireball',
      rotate: true,
      life: 0.85,
    });
    this.maxLife = 0.85;
    this.offscreenMargin = 24;
    this.z = Z.PROJECTILE + 1;
  }

  protected override move(dt: number): void {
    const k = Math.pow(0.4, dt);
    this.vx *= k;
    this.vy = this.vy * k - 22 * dt;
    const grow = Math.min(1, this.age / 0.35);
    this.w = this.h = 10 + grow * 9;
    const sp = Math.hypot(this.vx, this.vy);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Burning puffs left on the ground under the path.
    this.puffDist -= sp * dt;
    if (this.puffDist <= 0) {
      this.puffDist = 24;
      const fy = floorNear(this.world, this.x, this.y + 4, 4, 30);
      if (fy !== null) this.world.add(new GroundFire({ owner: this.owner, x: this.x + fxRng.range(-3, 3), y: fy, life: 0.5, damage: 1, tick: 0.3 }));
    }
    // Flame licks and smoke trailing.
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.03;
      const r = this.w * 0.4;
      this.world.particles.add({
        kind: 'px',
        x: this.x + fxRng.range(-r, r),
        y: this.y + fxRng.range(-r, r),
        vx: -this.vx * 0.2 + fxRng.range(-15, 15),
        vy: fxRng.range(-50, -15),
        life: fxRng.range(0.2, 0.4),
        color: fxRng.pick(['#ffd23c', '#f07a1e', '#fff6b0']),
        color2: '#c8301a',
        size: fxRng.pick([1, 2]),
      });
      if (this.age > 0.3 && fxRng.chance(0.4)) this.world.particles.add({ kind: 'smoke', x: this.x, y: this.y - r, vx: fxRng.range(-8, 8), vy: -22, life: 0.5, color: '#5a4a48', color2: '#3a3030', size: 1.5, size2: 4, drag: 1 });
    }
  }

  protected override onHitTarget(t: Entity): void {
    this.world.particles.sparks(t.cx, t.cy, 3, '#ffd040', 90);
  }

  protected override onHitTerrain(): void {
    this.burst();
  }

  protected override expire(): void {
    this.world.particles.smokePuffs(this.x, this.y, 2, 4, '#6a5a58', '#3a3030');
    this.remove();
  }

  private burst(): void {
    const fy = floorNear(this.world, this.x, this.y, 12, 24);
    if (fy !== null) this.world.add(new GroundFire({ owner: this.owner, x: this.x, y: fy, life: 0.55, damage: 1, tick: 0.3 }));
    for (let i = 0; i < 6; i++) this.world.particles.add({ kind: 'px', x: this.x, y: this.y, vx: fxRng.range(-70, 70), vy: fxRng.range(-90, -10), life: fxRng.range(0.2, 0.45), color: fxRng.pick(['#ffd23c', '#f07a1e']), color2: '#c8301a', gravity: 120 });
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const s = sprites.get('fireball');
    const f = this.age < 0.28 ? Math.floor(this.age / 0.07) : 4 + (Math.floor(this.age * 16) % 4);
    const fade = this.maxLife - this.age;
    s.draw(g, this.x, this.y, f, { rot: Math.atan2(this.vy, this.vx), alpha: fade < 0.12 ? Math.max(0.2, fade / 0.12) : 1 });
  }
}

registerWeapon({
  id: 'flame',
  name: 'FLAME SHOT',
  letter: 'F',
  ammo: 30,
  auto: false,
  cooldown: 0.26,
  gun: 'flamer',
  color: '#ff8a2a',
  heavy: true,
  sfx: 'flame',
  flash: true,
  muzzle: 'muzzle_flame',
  fire(p, x, y, a) {
    p.world.add(new Fireball(p, x + Math.cos(a) * 3, y + Math.sin(a) * 3, a));
  },
});
