// R - ROCKET LAUNCHER: rockets leave the tube slowly, ignite and accelerate hard, gently home
// on enemies in front, trail smoke and blow up with splash damage. Heavy recoil + backblast.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { angleDiff, angleTo, rotateTowards } from '../../engine/math';
import { registerWeapon } from '../../game/weapons';
import { Projectile } from '../../game/projectile';
import { Z } from '../../game/constants';
import type { Entity } from '../../game/entity';
import type { Player } from '../../game/player';

sprites.define({
  name: 'rocket_player',
  w: 16,
  h: 7,
  ox: 8,
  oy: 3,
  frames: 3,
  draw: (p, f) => {
    // Exhaust flame (flickers).
    const fl = [3, 5, 4][f];
    p.poly([4, 1.5, 4 - fl, 3.5, 4, 5.5], '#ff8a20');
    p.poly([4, 2.5, 4 - fl * 0.6, 3.5, 4, 4.5], '#fff07a');
    // Fins.
    p.poly([4, 0, 7, 2, 4, 2], '#3e4a2a');
    p.poly([4, 7, 7, 5, 4, 5], '#3e4a2a');
    // Body.
    p.capsule(5, 3.5, 12, 3.5, 1.6, '#7e8e5a');
    p.rect(5, 2, 7, 1, '#a8b880');
    p.rect(5, 5, 7, 1, '#566238');
    // Warhead.
    p.poly([11.5, 1.8, 13.5, 2.3, 15.5, 3.5, 13.5, 4.7, 11.5, 5.2], '#c8402a');
    p.px(12, 2, '#f08060');
  },
});

sprites.define({
  name: 'muzzle_rocket',
  w: 12,
  h: 12,
  ox: 1,
  oy: 6,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    if (f === 0) {
      p.circle(5, 6, 5, '#ffd040');
      p.circle(4, 6, 3, '#ffffff');
    } else {
      p.ring(5 + f, 6, 3 + f * 1.5, f === 1 ? '#ff9a2e' : '#c8c8c8', 1.4);
    }
  },
});

sprites.define({
  name: 'rocket_backblast',
  w: 20,
  h: 14,
  ox: 0,
  oy: 7,
  frames: 4,
  outline: null,
  draw: (p, f) => {
    const L = [14, 18, 16, 12][f];
    const W = [4, 6, 6.5, 6][f];
    const cols = f < 2 ? ['#ff8a20', '#ffd040', '#ffffff'] : ['#8a8a92', '#b8b8c0', '#d8d8e0'];
    p.poly([0, 7, L * 0.5, 7 - W, L, 7, L * 0.5, 7 + W], cols[0]);
    p.poly([0, 7, L * 0.4, 7 - W * 0.6, L * 0.75, 7, L * 0.4, 7 + W * 0.6], cols[1]);
    p.poly([0, 7, L * 0.25, 7 - W * 0.3, L * 0.45, 7, L * 0.25, 7 + W * 0.3], cols[2]);
  },
});

/** Player rocket: slow launch, ignition, hard acceleration, light homing in a forward cone. */
export class PlayerRocket extends Projectile {
  ignited = false;
  smokeT = 0;
  target: Entity | null = null;

  constructor(owner: Player, x: number, y: number, angle: number) {
    super({
      team: 'player',
      owner,
      x,
      y,
      vx: Math.cos(angle) * 75,
      vy: Math.sin(angle) * 75,
      damage: 2,
      kind: 'explosion',
      w: 9,
      h: 6,
      sprite: 'rocket_player',
      rotate: true,
      fps: 18,
      life: 2.6,
      explode: { radius: 24, damage: 10, size: 'medium', shake: 3, sfx: 'explosion' },
    });
    this.offscreenMargin = 40;
    this.z = Z.PROJECTILE + 1;
  }

  private pickTarget(ang: number): Entity | null {
    let best: Entity | null = null;
    let bd = 230;
    for (const t of this.world.targets('player')) {
      if (t.team !== 'enemy' || t.dead || !t.onScreen(0)) continue;
      const a = angleTo(this.x, this.y, t.cx, t.cy);
      if (Math.abs(angleDiff(ang, a)) > 0.75) continue;
      const d = Math.hypot(t.cx - this.x, t.cy - this.y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  protected override move(dt: number): void {
    let ang = Math.atan2(this.vy, this.vx);
    let sp = Math.hypot(this.vx, this.vy);
    if (!this.ignited) {
      // Coasting out of the tube: slows and droops a little.
      sp = Math.max(55, sp - 120 * dt);
      this.vy += 90 * dt;
      ang = Math.atan2(this.vy, this.vx);
      if (this.age > 0.13) {
        this.ignited = true;
        this.world.particles.smokePuffs(this.x - Math.cos(ang) * 4, this.y - Math.sin(ang) * 4, 3, 2, '#d8d8d8', '#8a8a90');
        this.world.particles.sparks(this.x, this.y, 4, '#ffd060', 80);
      }
    } else {
      if (!this.target || this.target.dead || !this.target.hittable) this.target = this.pickTarget(ang);
      if (this.target) ang = rotateTowards(ang, angleTo(this.x, this.y, this.target.cx, this.target.cy), 2.4 * dt);
      sp = Math.min(440, sp + 1150 * dt);
    }
    this.vx = Math.cos(ang) * sp;
    this.vy = Math.sin(ang) * sp;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Smoke trail + exhaust embers.
    this.smokeT -= dt;
    if (this.ignited && this.smokeT <= 0) {
      this.smokeT = 0.022;
      const bx = this.x - Math.cos(ang) * 7;
      const by = this.y - Math.sin(ang) * 7;
      this.world.particles.add({ kind: 'smoke', x: bx, y: by, vx: fxRng.range(-10, 10), vy: fxRng.range(-14, 2), life: fxRng.range(0.35, 0.55), color: '#e0e0e0', color2: '#8a8a92', size: 1, size2: fxRng.range(3, 4.5), drag: 2 });
      if (fxRng.chance(0.5)) this.world.particles.add({ kind: 'px', x: bx, y: by, vx: -Math.cos(ang) * 40 + fxRng.range(-15, 15), vy: -Math.sin(ang) * 40 + fxRng.range(-15, 15), life: 0.15, color: '#ffd040', color2: '#ff7a20' });
    }
  }

  override detonate(): void {
    if (this.dead) return;
    this.world.particles.debris(this.x, this.y, 6, ['#5a6a3a', '#3a3a40', '#c8402a'], 170);
    super.detonate();
  }
}

registerWeapon({
  id: 'rocket',
  name: 'ROCKET LAUNCHER',
  letter: 'R',
  ammo: 30,
  auto: false,
  cooldown: 0.4,
  gun: 'rocket',
  color: '#ff6a3a',
  heavy: true,
  sfx: 'rocket_fire',
  flash: true,
  muzzle: 'muzzle_rocket',
  recoil: 2,
  fire(p, x, y, a) {
    const w = p.world;
    w.add(new PlayerRocket(p, x, y, a));
    // Backblast out of the rear of the tube.
    const bx = x - Math.cos(a) * 21;
    const by = y - Math.sin(a) * 21;
    const fx = w.effect('rocket_backblast', bx, by, { fps: 24, z: Z.PLAYER - 1 });
    fx.rot = a + Math.PI;
    for (let i = 0; i < 4; i++) {
      w.particles.add({
        kind: 'smoke',
        x: bx,
        y: by,
        vx: -Math.cos(a) * fxRng.range(30, 70) + fxRng.range(-12, 12),
        vy: -Math.sin(a) * fxRng.range(30, 70) + fxRng.range(-18, 4),
        life: fxRng.range(0.4, 0.7),
        color: '#d8d8d8',
        color2: '#7a7a82',
        size: 2,
        size2: fxRng.range(4, 6),
        drag: 3,
      });
    }
  },
});
