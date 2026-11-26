// JUGGERNAUT attack / effect entities:
//   JugShockwave  ground wave from a stomp (jump it); a Projectile so the boss's death clears it
//   RainMissile   falls straight onto a ground marker (shootable), from the missile-rain attack
//   LaunchTrail   cosmetic missile streaking up out of the missile box
//   EscapePod     Gristle's cockpit rocketing away and drifting off under a parachute (cosmetic)
//   JugOverlay    draws the boss's laser / targeting line / vent glow above the actors

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import { Entity } from '../../../game/entity';
import { Projectile } from '../../../game/projectile';
import { Z } from '../../../game/constants';
import { flames, smoke } from '../common/kit';
import { GroundMarker } from '../common/fx';

// ------------------------------------------------------------------ shockwave

export class JugShockwave extends Projectile {
  /** World x where the wave dies (arena edge). */
  limit: number;
  private dustT = 0;
  groundY: number;

  constructor(owner: Entity, x: number, groundY: number, dir: 1 | -1, speed: number, limit: number) {
    super({ team: 'enemy', owner, x, y: groundY - 6, vx: dir * speed, vy: 0, w: 14, h: 12, damage: 1, kind: 'explosion', hitsTerrain: false, pierce: 99, life: 6, sprite: 'bm6_wave' });
    this.limit = limit;
    this.groundY = groundY;
    this.offscreenMargin = 60;
    this.z = Z.PROJECTILE - 1;
  }

  protected override move(dt: number): void {
    this.x += this.vx * dt;
    const gy = this.world.terrain.groundTopAt(this.x);
    if (isFinite(gy) && Math.abs(gy - this.groundY) < 20) this.groundY = gy;
    this.y = this.groundY - 6;
    this.dustT -= dt;
    if (this.dustT <= 0) {
      this.dustT = 0.035;
      this.world.particles.add({ kind: 'smoke', x: this.x - Math.sign(this.vx) * 6, y: this.groundY - 2, vx: -this.vx * 0.15 + fxRng.range(-10, 10), vy: fxRng.range(-26, -8), life: fxRng.range(0.3, 0.55), color: '#a88a64', color2: '#6a5640', size: 2, size2: 5, drag: 2 });
      if (fxRng.chance(0.5)) this.world.particles.add({ kind: 'px', x: this.x, y: this.groundY - 4, vx: fxRng.range(-30, 30), vy: fxRng.range(-120, -60), life: 0.4, color: fxRng.chance(0.5) ? '#ffd060' : '#8a6a4a', gravity: 500, size: 1 });
    }
    if ((this.vx > 0 && this.x >= this.limit) || (this.vx < 0 && this.x <= this.limit)) {
      this.world.particles.dust(this.x, this.groundY, 6, '#a88a64');
      this.remove();
    }
  }

  protected override onHitTarget(): void {
    // Keeps rolling (pierce).
  }

  override render(g: CanvasRenderingContext2D): void {
    sprites.get('bm6_wave').draw(g, this.x, this.groundY, Math.floor(this.age * 16), { flip: this.vx < 0 });
  }
}

// ------------------------------------------------------------------ missile rain

export class RainMissile extends Projectile {
  marker: GroundMarker | null = null;
  private smokeT = 0;

  constructor(owner: Entity, x: number, y: number, speed: number, radius: number) {
    super({ team: 'enemy', owner, x, y, vx: 0, vy: speed, w: 6, h: 10, sprite: 'bm6_missile', rotate: true, fps: 16, life: 4, explode: { radius, damage: 1, size: 'medium', shake: 2 } });
    this.hittable = true;
    this.hp = this.maxHp = 1;
    this.scoreValue = 50;
    this.offscreenMargin = 120;
  }

  protected override move(dt: number): void {
    this.y += this.vy * dt;
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.03;
      this.world.particles.add({ kind: 'smoke', x: this.x + fxRng.range(-1, 1), y: this.y - 8, vx: fxRng.range(-6, 6), vy: fxRng.range(-12, 0), life: 0.4, color: '#d8d0c8', color2: '#7a7470', size: 1, size2: 3, drag: 2 });
    }
  }

  protected override onHitTerrain(): void {
    const gy = this.world.terrain.groundTopAt(this.x);
    if (isFinite(gy) && this.y > gy) this.y = gy - 2;
    this.detonate();
  }

  override die(): void {
    // Shot down in mid-air: harmless pop.
    this.world.explode(this.x, this.y, { radius: 10, damage: 0, team: 'enemy', size: 'small', shake: 0, sfx: 'explosion_small' });
    this.remove();
  }

  override remove(): void {
    this.marker?.remove();
    super.remove();
  }
}

/** Cosmetic missile launched straight up out of the box (the real ones fall later). */
export class LaunchTrail extends Entity {
  private smokeT = 0;

  constructor(x: number, y: number) {
    super();
    this.anchor = 'center';
    this.x = x;
    this.y = y;
    this.vx = fxRng.range(-8, 8);
    this.vy = -90;
    this.z = Z.PROJECTILE;
    this.persistent = true;
  }

  override update(dt: number): void {
    this.vy = Math.max(-340, this.vy - 900 * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.02;
      this.world.particles.add({ kind: 'smoke', x: this.x, y: this.y + 7, vx: fxRng.range(-8, 8), vy: fxRng.range(0, 14), life: 0.55, color: '#e8e0d8', color2: '#8a8480', size: 1.5, size2: 4, drag: 2 });
    }
    if (this.y < this.world.camera.y - 30) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    sprites.get('bm6_missile').draw(g, this.x, this.y, Math.floor(this.age * 16), { rot: -Math.PI / 2 });
  }
}

// ------------------------------------------------------------------ escape pod

/** Gristle's cockpit blasting free: rocket burn, sputter, parachute, drifts off shaking his fist. */
export class EscapePod extends Entity {
  private dir: number;
  private fxT = 0;
  chute = false;
  private popped = 0;
  private landed = false;

  constructor(x: number, y: number, away: number) {
    super();
    this.x = x;
    this.y = y;
    this.dir = away;
    this.vx = away * 55;
    this.vy = -290;
    this.z = Z.FX - 4;
    this.persistent = true;
  }

  override spawned(): void {
    this.world.sfx('enemy_rocket', this.x, { vol: 0.9, pitch: 0.8 });
    this.world.sfx('glass_break', this.x, { vol: 0.5, pitch: 0.7 });
  }

  override update(dt: number): void {
    const t = this.age;
    if (t < 0.85) {
      this.vy += 230 * dt;
      this.fxT -= dt;
      if (this.fxT <= 0) {
        this.fxT = 0.02;
        flames(this.world, this.x, this.y + 10, { n: 1, vy: 120, size: 2.5, life: 0.25, spread: 2 });
        smoke(this.world, this.x, this.y + 14, { n: 1, vy: 40, size: 2, size2: 7, life: 0.8, color: '#c8c0b8', color2: '#6a6668' });
      }
    } else if (t < 1.15) {
      this.vy += 420 * dt;
      if (fxRng.chance(dt * 20)) smoke(this.world, this.x, this.y + 10, { n: 1, vy: 10, size: 2, size2: 5, life: 0.6, color: '#5a5458', color2: '#3a3438' });
    } else {
      if (!this.chute) {
        this.chute = true;
        this.world.sfx('parachute', this.x, { vol: 0.9 });
      }
      this.popped += dt;
      this.vy += (20 - this.vy) * Math.min(1, dt * 3);
      this.vx += (this.dir * 26 + Math.sin(t * 2.2) * 14 - this.vx) * Math.min(1, dt * 2);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const gy = this.world.terrain.groundTopAt(this.x);
    if (this.chute && isFinite(gy) && this.y >= gy) {
      this.y = gy;
      if (!this.landed) {
        this.landed = true;
        this.world.particles.dust(this.x, gy, 6);
      }
      this.vx = this.dir * 30;
      this.vy = 0;
    }
    const c = this.world.camera;
    if (t > 2 && (this.x < c.x - 60 || this.x > c.x + VIEW_W + 60 || this.y > c.y + VIEW_H + 60)) this.remove();
    if (t > 16) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const t = this.age;
    const flip = this.dir > 0;
    const wob = this.chute ? Math.sin(t * 2.2) * 0.12 : Math.sin(t * 30) * 0.08;
    if (this.chute) {
      const f = this.popped < 0.18 ? 0 : Math.floor(t * 1.6) % 2 === 0 ? 1 : 2;
      sprites.get('bm6_chute').draw(g, this.x, this.y - 22, f, { flip, rot: wob * 0.5 || undefined });
    }
    if (t < 0.85) sprites.get('bm6_flame').draw(g, this.x, this.y + 10, Math.floor(t * 20));
    const face = this.chute ? (Math.floor(t * 5) % 2 === 0 ? 0 : 1) : 2;
    sprites.get('bm6_eject').draw(g, this.x, this.y, face, { flip, rot: wob || undefined });
  }
}

// ------------------------------------------------------------------ overlay

/** Something that can paint above the actors (the boss's beam & telegraphs). */
export interface OverlayPainter extends Entity {
  renderOverlay(g: CanvasRenderingContext2D): void;
}

export class JugOverlay extends Entity {
  readonly host: OverlayPainter;

  constructor(host: OverlayPainter) {
    super();
    this.host = host;
    this.z = Z.FX - 1;
    this.persistent = true;
  }

  override update(): void {
    if (this.host.dead) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (!this.host.dead) this.host.renderOverlay(g);
  }
}
