// B - BOUNCER: lobs explosive balls that hop along the ground (and off walls) a few times,
// blowing up on the first enemy they touch or after the last bounce.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { registerWeapon } from '../../game/weapons';
import { Projectile } from '../../game/projectile';
import { Z } from '../../game/constants';
import type { Player } from '../../game/player';
import { wsfx } from './fx';

export const BOUNCER_MAX_BOUNCES = 4;

sprites.define({
  name: 'bouncer_ball',
  w: 9,
  h: 9,
  ox: 4,
  oy: 4,
  frames: 4,
  draw: (p, f) => {
    p.circle(4.5, 4.5, 3.9, '#e8642a');
    const a = (f * Math.PI) / 4;
    p.capsule(4.5 - Math.cos(a) * 3.4, 4.5 - Math.sin(a) * 3.4, 4.5 + Math.cos(a) * 3.4, 4.5 + Math.sin(a) * 3.4, 0.75, '#2a1a1a');
    p.circle(3.2, 3.2, 1.2, '#ffb070');
    p.px(2, 2, '#ffe0c0');
    p.px(Math.round(4.5 + Math.cos(a + Math.PI / 2) * 2.2), Math.round(4.5 + Math.sin(a + Math.PI / 2) * 2.2), '#ffe040');
  },
});

sprites.define({
  name: 'muzzle_bouncer',
  w: 14,
  h: 14,
  ox: 1,
  oy: 7,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    if (f === 0) {
      p.circle(5, 7, 5, '#ffb040');
      p.circle(5, 7, 3, '#ffffff');
    } else p.ring(5 + f, 7, 3.5 + f * 1.6, f === 1 ? '#ff9a2e' : '#d8d8d8', 1.3);
  },
});

export class BouncerBall extends Projectile {
  bounces = 0;

  constructor(owner: Player, x: number, y: number, angle: number) {
    const sp = 175;
    let vx = Math.cos(angle) * sp;
    let vy = Math.sin(angle) * sp;
    if (Math.abs(vy) < 70) vy -= 120; // forward shots get a low lob
    if (vy > 0) vx *= 0.8;
    super({
      team: 'player',
      owner,
      x,
      y,
      vx,
      vy,
      gravity: 620,
      damage: 1,
      kind: 'explosion',
      w: 7,
      h: 7,
      sprite: 'bouncer_ball',
      fps: 16,
      life: 3.2,
      hitsTerrain: false,
      explode: { radius: 19, damage: 8, size: 'small', shake: 2, sfx: 'explosion' },
    });
    this.offscreenMargin = 24;
    this.z = Z.PROJECTILE + 1;
  }

  private bounceFx(): void {
    wsfx(this.world, 'bouncer_bounce', this.x, { vol: 0.55, pitch: 1 + this.bounces * 0.06 });
    this.world.particles.dust(this.x, this.y + 3, 2);
  }

  protected override move(dt: number): void {
    const T = this.world.terrain;
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    // Walls: bounce back.
    if (T.isSolidPoint(nx + Math.sign(this.vx) * 3, this.y) && !T.isSolidPoint(this.x, this.y)) {
      this.vx = -this.vx * 0.85;
      this.bounceFx();
    } else this.x = nx;
    if (this.vy > 0) {
      const hit = T.floorAt(this.x, this.y - 1, ny + 3.5, { solidTolerance: 6 });
      if (hit) {
        this.y = hit.y - 3.5;
        this.bounces++;
        if (this.bounces > BOUNCER_MAX_BOUNCES) {
          this.detonate();
          return;
        }
        // Keep a lively, consistent hop.
        this.vy = -Math.max(165, Math.min(250, Math.abs(this.vy) * 0.78));
        this.bounceFx();
        return;
      }
    } else if (T.isSolidPoint(this.x, ny - 3.5)) {
      this.vy = Math.abs(this.vy) * 0.3;
      return;
    }
    this.y = ny;
    if (fxRng.chance(0.3)) this.world.particles.add({ kind: 'px', x: this.x, y: this.y, vx: 0, vy: 0, life: 0.18, color: '#ffb070', color2: '#c8501a' });
  }

  override detonate(): void {
    if (this.dead) return;
    this.world.particles.sparks(this.x, this.y, 6, '#ffb040', 150);
    super.detonate();
  }
}

registerWeapon({
  id: 'bouncer',
  name: 'BOUNCER',
  letter: 'B',
  ammo: 30,
  auto: false,
  cooldown: 0.34,
  gun: 'bouncer',
  color: '#ff7a3a',
  heavy: true,
  sfx: 'bouncer_fire',
  flash: true,
  muzzle: 'muzzle_bouncer',
  recoil: 1.2,
  fire(p, x, y, a) {
    p.world.add(new BouncerBall(p, x, y, a));
  },
});
