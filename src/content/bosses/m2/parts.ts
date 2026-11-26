// HORNET KING helpers: the aft rotor that tears off in phase 2 (tumbles, crashes, burns), a lock-on
// marker that lives exactly as long as the missile it marks, and the carpet bomb.

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { GroundMarker as FloorMarker } from '../common/fx';
import { Lobbed, FlyingPart, bsfxAt, flames, smoke, sparkBurst } from '../common/kit';
import { ROT_N, TILT0 } from './art';

/** Blinking lock-on brackets on the floor that stay until the watched projectile is gone. */
export class LockMark extends FloorMarker {
  watch: Entity | null = null;

  constructor(x: number, y: number, eta: number, radius = 9) {
    super(x, y, eta, 'cross', radius);
  }

  override update(dt: number): void {
    if (this.watch && this.watch.dead) {
      this.remove();
      return;
    }
    // Keep blinking at the "imminent" rate while the missile is still on its way.
    this.life = Math.max(0.06, this.life - dt);
    if (!this.watch && this.age > this.max + 0.2) this.remove();
  }
}

/** High-drag carpet bomb: falls almost straight down onto a shadow marker. */
export class CarpetBomb extends Lobbed {
  constructor(owner: Entity, x: number, y: number, tx: number, groundY: number, time: number, gravity: number) {
    super({
      owner,
      x,
      y,
      tx,
      ty: groundY - 1,
      time,
      gravity,
      radius: 14,
      size: 'medium',
      sprite: 'bm2_bomb',
      marker: true,
      rotate: false,
      shake: 2,
      trail: null,
    });
    this.fps = 10;
  }

  override render(g: CanvasRenderingContext2D): void {
    sprites.get('bm2_bomb').draw(g, this.x, this.y, Math.floor(this.age * this.fps) % 2);
  }
}

/** The aft rotor pylon ripped off in phase 2: spins away trailing fire, crashes, keeps burning. */
export class TornRotor extends Entity {
  rot = 0;
  vr: number;
  rotorA = 0;
  landed = false;
  groundY: number;
  private fxT = 0;
  private burnT = 0;

  constructor(x: number, y: number, vx: number, vy: number, vr: number, groundY: number) {
    super();
    this.anchor = 'center';
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.vr = vr;
    this.groundY = groundY;
    this.w = 40;
    this.h = 30;
    this.z = Z.BOSS + 1;
    this.persistent = true;
  }

  override update(dt: number): void {
    this.fxT -= dt;
    if (!this.landed) {
      this.vy += 330 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.vr * dt;
      this.rotorA += dt * 18;
      if (this.fxT <= 0) {
        this.fxT = 0.03;
        smoke(this.world, this.x, this.y, { n: 1, size: 3, size2: 9, life: 1.1, vy: -10, color: '#3a3438', color2: '#1e1a20' });
        flames(this.world, this.x + fxRng.range(-6, 6), this.y + fxRng.range(-4, 4), { n: 2, size: 2.5, life: 0.3 });
      }
      if (this.vy > 0 && this.y + 12 >= this.groundY) this.crash();
      if (this.y > this.groundY + 300) this.remove();
      return;
    }
    // Burning on the ground.
    this.burnT += dt;
    if (this.fxT <= 0) {
      this.fxT = this.burnT < 6 ? 0.07 : 0.16;
      smoke(this.world, this.x + fxRng.range(-10, 10), this.y - 8, { n: 1, size: 2.5, size2: 9, life: 1.6, vy: -24, color: '#3a3436', color2: '#242026' });
      if (fxRng.chance(0.7)) flames(this.world, this.x + fxRng.range(-12, 12), this.y - 4, { n: 2, size: 2.5, life: 0.4, spread: 4 });
      if (fxRng.chance(0.04)) sparkBurst(this.world, this.x, this.y - 6, 3, '#ffc060', 70);
    }
  }

  private crash(): void {
    this.landed = true;
    // Comes to rest flat (upright or on its back), half dug into the ground.
    this.rot = Math.round(this.rot / Math.PI) * Math.PI;
    this.y = this.groundY - 12;
    const w = this.world;
    w.explode(this.x, this.y - 4, { radius: 30, damage: 0, team: 'enemy', size: 'large', shake: 6, sfx: 'explosion_big' });
    w.particles.dust(this.x, this.groundY, 14, '#d8c8a0');
    w.particles.debris(this.x, this.y - 6, 16, ['#7d7343', '#5a522e', '#4c4e5a', '#e8c02a'], 220);
    for (let i = 0; i < 3; i++) {
      w.add(new FlyingPart('bm2_plate', i % 3, this.x, this.y - 8, fxRng.range(-120, 120), fxRng.range(-260, -140), { burn: i === 0, life: 2.6 }));
    }
    // Two blades snap off and cartwheel away.
    for (const s of [-1, 1]) {
      w.add(new FlyingPart('boss_debris', 3, this.x + s * 10, this.y - 10, s * fxRng.range(90, 150), fxRng.range(-240, -180), { life: 2.2, vr: s * 14 }));
    }
    bsfxAt(w, 'metal_hit', this.x, { vol: 0.8, pitch: 0.6 });
    w.hitstop(0.06);
  }

  override render(g: CanvasRenderingContext2D): void {
    if (!this.landed) {
      const k = Math.floor((this.rotorA / ((Math.PI * 2) / 3)) * ROT_N) % ROT_N;
      sprites.get('bm2_pylon').draw(g, this.x, this.y, 0, { rot: this.rot });
      const hx = this.x + Math.sin(this.rot) * 16;
      const hy = this.y - Math.cos(this.rot) * 16;
      sprites.get('bm2_rotor').draw(g, hx, hy, TILT0 * ROT_N + k, { rot: this.rot });
      sprites.get('bm2_hub').draw(g, hx, hy, k % 2, { rot: this.rot });
      return;
    }
    sprites.get('bm2_pylon').draw(g, this.x, this.y, 1, { rot: this.rot || undefined });
  }
}
