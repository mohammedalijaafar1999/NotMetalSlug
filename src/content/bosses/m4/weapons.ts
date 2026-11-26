// LEVIATHAN weapons: the skimming torpedo and the periscope laser beam (telegraph + sweep visuals).

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import type { SfxName } from '../../sfx/canonical';
import type { PlayOpts } from '../../../engine/audio';
import { Entity } from '../../../game/entity';
import { Projectile } from '../../../game/projectile';
import { Z } from '../../../game/constants';
import type { World } from '../../../game/world';
import { pixelLine, dottedLine, pixelEllipse } from '../common/fx';

/** Positional sound with a canonical name. */
export function m4sfx(w: World, name: SfxName, x: number, opts: PlayOpts = {}): void {
  w.sfx(name, x, opts);
}

// ------------------------------------------------------------------ torpedo

export type TorpedoMode = 'drop' | 'deep' | 'water' | 'hop' | 'deck';

/**
 * Torpedo: leaves the bow tube (or an underwater tube), skims along the water surface with a foam
 * wake, rides up onto the dock where the ground rises above the water and slides along the deck
 * with sparks until it leaves the screen. Low (7 px) and slow: jump over it. Two hits pop it.
 */
export class Torpedo extends Projectile {
  mode: TorpedoMode;
  readonly dir: 1 | -1;
  speed: number;
  waterY: number;
  private fxT = 0;
  private sndT = 0;

  constructor(owner: Entity, x: number, y: number, dir: 1 | -1, speed: number, waterY: number, deep = false) {
    super({
      team: 'enemy',
      owner,
      x,
      y,
      vx: dir * (deep ? speed * 0.85 : 55),
      vy: deep ? 0 : 25,
      w: 16,
      h: 6,
      damage: 10,
      kind: 'explosion',
      sprite: 'bm4_torpedo',
      fps: 18,
      life: 9,
      hitsTerrain: false,
      explode: { radius: 12, damage: 1, size: 'small', shake: 2, sfx: 'explosion' },
    });
    this.dir = dir;
    this.speed = speed;
    this.waterY = waterY;
    this.mode = deep ? 'deep' : 'drop';
    this.facing = dir;
    this.hp = this.maxHp = 2;
    this.scoreValue = 200;
    this.hittable = !deep;
    this.offscreenMargin = 40;
  }

  /** Riding on the dock (the part the player has to jump). */
  get onDeck(): boolean {
    return this.mode === 'deck';
  }

  private setMode(m: TorpedoMode): void {
    this.mode = m;
    const want = m !== 'deep';
    if (want !== this.hittable) {
      this.hittable = want;
      this.world.invalidateTargets();
    }
  }

  protected override move(dt: number): void {
    const T = this.world.terrain;
    const want = this.dir * this.speed;
    this.fxT -= dt;
    this.sndT -= dt;
    switch (this.mode) {
      case 'drop': {
        this.vy += 620 * dt;
        this.vx += (want - this.vx) * Math.min(1, dt * 2.5);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.y >= this.waterY - 2) {
          this.y = this.waterY - 2;
          this.vy = 0;
          this.setMode('water');
          this.world.particles.splash(this.x, this.waterY, 10, '#d8f0ff');
          m4sfx(this.world, 'splash', this.x, { vol: 0.7 });
        }
        break;
      }
      case 'deep': {
        // Underwater run (phase 2): rises to the surface while closing in.
        this.vx = want * 0.9;
        this.x += this.vx * dt;
        this.y = Math.max(this.waterY - 2, this.y - 34 * dt);
        if (this.fxT <= 0) {
          this.fxT = 0.05;
          this.world.particles.add({ kind: 'px', x: this.x - this.dir * 8, y: this.y, vx: fxRng.range(-6, 6), vy: -fxRng.range(20, 40), life: 0.5, color: '#c8ecff', size: 1 });
        }
        // Never run into the dock's submerged face: pop up to the surface first.
        const wall = T.groundTopAt(this.x + this.dir * (this.w / 2 + 14)) < this.y + 3;
        if (wall) this.y = this.waterY - 2;
        if (this.y <= this.waterY - 2) {
          this.setMode('water');
          this.world.particles.splash(this.x, this.waterY, 8, '#d8f0ff');
          m4sfx(this.world, 'splash', this.x, { vol: 0.6 });
        }
        break;
      }
      case 'water': {
        this.vx += (want - this.vx) * Math.min(1, dt * 3);
        this.x += this.vx * dt;
        this.y = this.waterY - 2 + Math.sin(this.age * 13) * 0.6;
        if (this.fxT <= 0) {
          this.fxT = 0.03;
          const bx = this.x - this.dir * 10;
          this.world.particles.add({ kind: 'px', x: bx, y: this.waterY - 1, vx: -this.dir * fxRng.range(10, 40), vy: -fxRng.range(20, 70), life: 0.35, color: fxRng.chance(0.5) ? '#ffffff' : '#bfe6ff', gravity: 400, size: fxRng.pick([1, 2]) });
        }
        // The dock rises above the water ahead: ride up onto it.
        const lead = this.x + this.dir * (this.w / 2 + 6);
        if (T.groundTopAt(lead) < this.y + 3) {
          this.setMode('hop');
          this.vy = -165;
          this.world.particles.splash(this.x, this.waterY, 8, '#d8f0ff');
          this.world.particles.sparks(lead, this.y, 6, '#ffd070', 110);
          m4sfx(this.world, 'ricochet', this.x, { vol: 0.6, pitch: 0.7 });
        }
        break;
      }
      case 'hop': {
        this.vy += 900 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        const fy = T.groundTopAt(this.x) - 3;
        if (this.vy > 0 && this.y >= fy) {
          this.y = fy;
          this.vy = 0;
          this.setMode('deck');
          this.world.particles.dust(this.x, fy + 3, 4, '#a89878');
          this.world.particles.sparks(this.x, fy + 2, 8, '#ffd070', 120);
          m4sfx(this.world, 'land', this.x, { vol: 0.6, pitch: 0.6 });
        } else if (this.y > this.waterY + 4 && fy > this.waterY) {
          // Fell back into the water.
          this.y = this.waterY - 2;
          this.vy = 0;
          this.setMode('water');
        }
        break;
      }
      case 'deck': {
        this.vx += (want * 0.92 - this.vx) * Math.min(1, dt * 2);
        this.x += this.vx * dt;
        const gy = T.groundTopAt(this.x);
        if (gy > this.y + 12) {
          this.setMode('hop');
          this.vy = 0;
        } else this.y = gy - 3;
        if (this.fxT <= 0) {
          this.fxT = 0.04;
          const bx = this.x - this.dir * 8;
          this.world.particles.add({ kind: 'spark', x: bx, y: this.y + 3, vx: -this.dir * fxRng.range(40, 120), vy: -fxRng.range(20, 90), life: 0.25, color: fxRng.chance(0.5) ? '#ffe080' : '#ff9a40', gravity: 300 });
        }
        if (this.sndT <= 0) {
          this.sndT = 0.36;
          m4sfx(this.world, 'tank_tread', this.x, { vol: 0.3, pitch: 1.4 });
        }
        break;
      }
    }
  }

  override die(): void {
    // Shot down: harmless pop.
    this.world.explode(this.x, this.y, { radius: 10, damage: 0, team: 'enemy', size: 'small', shake: 1, sfx: 'explosion_small' });
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const s = sprites.get('bm4_torpedo');
    const frame = Math.floor(this.age * 18);
    if (this.mode === 'deep') {
      s.draw(g, this.x, this.y, frame, { flip: this.dir < 0, alpha: 0.55 });
      return;
    }
    s.draw(g, this.x, this.y, frame, { flip: this.dir < 0, flash: this.flash > 0 });
    if (this.mode === 'water') {
      // Bow wave hugging the hull at the waterline.
      g.fillStyle = '#ffffff';
      const fx = Math.round(this.x + this.dir * 11);
      g.fillRect(fx - (this.dir < 0 ? 2 : 0), Math.round(this.waterY) - 2, 3, 1);
      g.fillStyle = '#bfe6ff';
      g.fillRect(Math.round(this.x - this.dir * 13) - 1, Math.round(this.waterY) - 1, 4, 1);
    }
  }
}

// ------------------------------------------------------------------ pod missile

export type PodMissilePhase = 'up' | 'wait' | 'down';

/**
 * Pod missile: blasts straight up out of the launcher and off the top of the screen, then drops
 * vertically onto its locked spot on the dock (a landing marker shows the spot the whole time), so
 * the only danger is right at the marker. Shootable on the way up and on the way down.
 */
export class PodMissile extends Projectile {
  phase: PodMissilePhase = 'up';
  readonly tx: number;
  readonly ty: number;
  private waitT: number;
  private fall: number;
  private smokeT = 0;

  constructor(owner: Entity, x: number, y: number, tx: number, ty: number, wait: number, fall: number) {
    super({
      team: 'enemy',
      owner,
      x,
      y,
      vx: 0,
      vy: -70,
      w: 6,
      h: 10,
      damage: 1,
      kind: 'explosion',
      sprite: 'bm4_missile',
      rotate: true,
      fps: 16,
      life: 8,
      hitsTerrain: false,
      explode: { radius: 12, damage: 1, size: 'small', shake: 2, sfx: 'explosion' },
    });
    this.tx = tx;
    this.ty = ty;
    this.waitT = wait;
    this.fall = fall;
    this.hittable = true;
    this.hp = this.maxHp = 1;
    this.scoreValue = 100;
    this.offscreenMargin = 400;
  }

  /** Seconds from launch to impact (for the landing marker), from a launch at y0. */
  static flightTime(y0: number, camY: number, ty: number, wait: number, fall: number): number {
    const up = Math.max(0, y0 - (camY - 24));
    const tUp = (-70 + Math.sqrt(70 * 70 + 4 * 450 * up)) / 900;
    const down = ty - 2 - (camY - 16);
    const tAcc = (fall - 80) / 520;
    const dAcc = 80 * tAcc + 260 * tAcc * tAcc;
    const tDown = down <= dAcc ? (-80 + Math.sqrt(80 * 80 + 4 * 260 * down)) / 520 : tAcc + (down - dAcc) / fall;
    return tUp + wait + tDown;
  }

  protected override move(dt: number): void {
    const cam = this.world.camera;
    if (this.phase === 'up') {
      this.vy -= 900 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y < cam.y - 24) {
        this.phase = 'wait';
        this.hittable = false;
        this.world.invalidateTargets();
      }
    } else if (this.phase === 'wait') {
      this.waitT -= dt;
      if (this.waitT <= 0) {
        this.phase = 'down';
        this.x = this.tx;
        this.y = cam.y - 16;
        this.vx = 0;
        this.vy = 80;
        this.hittable = true;
        this.world.invalidateTargets();
        m4sfx(this.world, 'mortar_whistle', this.x, { vol: 0.5, pitch: 1.3 });
      }
      return;
    } else {
      this.vy = Math.min(this.fall, this.vy + 520 * dt);
      this.y += this.vy * dt;
      if (this.y >= this.ty - 2) {
        this.y = this.ty - 2;
        this.detonate();
        return;
      }
    }
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.03;
      const by = this.y - Math.sign(this.vy) * 6;
      this.world.particles.add({ kind: 'smoke', x: this.x + fxRng.range(-1, 1), y: by, vx: fxRng.range(-6, 6), vy: fxRng.range(-6, 6), life: 0.4, color: '#d8d0c8', color2: '#7a7470', size: 1, size2: 3, drag: 2 });
      if (this.phase === 'up') this.world.particles.add({ kind: 'px', x: this.x, y: by, vx: 0, vy: 40, life: 0.08, color: fxRng.chance(0.5) ? '#ffe070' : '#ff8a30', size: 2 });
    }
  }

  override die(): void {
    this.world.explode(this.x, this.y, { radius: 8, damage: 0, team: 'enemy', size: 'small', shake: 0, sfx: 'explosion_small' });
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.phase === 'wait') return;
    const s = sprites.get('bm4_missile');
    s.draw(g, this.x, this.y, Math.floor(this.age * 16), { rot: this.vy < 0 ? -Math.PI / 2 : Math.PI / 2, flash: this.flash > 0 });
  }
}

// ------------------------------------------------------------------ laser beam (visual)

export type BeamMode = 'off' | 'aim' | 'fire';

/**
 * Periscope laser visuals, driven every frame by the boss (which also does the damage):
 * 'aim'  = thin blinking line from the lens to the sweep start + a dotted guide along the swept path;
 * 'fire' = the beam itself with a burning impact flare.
 */
export class LaserBeam extends Entity {
  mode: BeamMode = 'off';
  /** Emitter (lens). */
  ex = 0;
  ey = 0;
  /** Current target / impact point. */
  ix = 0;
  iy = 0;
  /** Swept path guide (polyline x,y,x,y...). */
  path: number[] = [];
  /** 0..1 telegraph progress (blinks faster near 1). */
  charge = 0;
  /** Direction the sweep travels (for the guide's scrolling dots). */
  sweepDir = -1;
  private fade = 0;
  readonly boss: Entity;

  constructor(boss: Entity) {
    super();
    this.boss = boss;
    this.anchor = 'center';
    this.z = Z.FX - 1;
    this.persistent = true;
  }

  fire(): void {
    this.mode = 'fire';
    this.fade = 1;
  }

  stop(): void {
    if (this.mode === 'fire') this.fade = 1;
    this.mode = 'off';
  }

  override update(dt: number): void {
    if (this.boss.dead) {
      this.remove();
      return;
    }
    if (this.mode !== 'fire' && this.fade > 0) this.fade = Math.max(0, this.fade - dt * 8);
  }

  override render(g: CanvasRenderingContext2D): void {
    const t = this.world.time;
    if (this.mode === 'aim') {
      const rate = 6 + this.charge * 22;
      const on = Math.floor(t * rate) % 2 === 0;
      const prev = g.globalAlpha;
      g.globalAlpha = on ? 0.95 : 0.45;
      pixelLine(g, this.ex, this.ey, this.ix, this.iy, this.charge > 0.75 ? '#ffffff' : '#ff3a3a', 1);
      // Swept path: chevron dots racing along the surface in the sweep direction.
      const ph = -this.sweepDir * t * 40;
      for (let i = 0; i + 3 < this.path.length; i += 2) {
        g.globalAlpha = 0.55;
        dottedLine(g, this.path[i], this.path[i + 1] - 1, this.path[i + 2], this.path[i + 3] - 1, '#7a0a14', 8, 4, ph, 2);
        g.globalAlpha = 0.95;
        dottedLine(g, this.path[i], this.path[i + 1] - 1, this.path[i + 2], this.path[i + 3] - 1, on ? '#ff6a4a' : '#ffb080', 8, 3, ph, 1);
      }
      g.globalAlpha = prev;
      // Lens glint and a target pip at the start point.
      g.fillStyle = on ? '#ffffff' : '#ff7a6a';
      g.fillRect(Math.round(this.ix) - 1, Math.round(this.iy) - 1, 3, 3);
      return;
    }
    if (this.mode === 'fire' || this.fade > 0) {
      const k = this.mode === 'fire' ? 1 : this.fade;
      const prev = g.globalAlpha;
      const wob = Math.floor(t * 40) % 2;
      g.globalAlpha = 0.45 * k;
      pixelLine(g, this.ex, this.ey, this.ix, this.iy, '#c0102a', 5 + wob);
      g.globalAlpha = 0.9 * k;
      pixelLine(g, this.ex, this.ey, this.ix, this.iy, '#ff4a5a', 3);
      g.globalAlpha = k;
      pixelLine(g, this.ex, this.ey, this.ix, this.iy, '#ffffff', 1);
      g.globalAlpha = prev;
      if (this.mode === 'fire') {
        pixelEllipse(g, this.ix, this.iy, 9 + wob, 3, '#ff4a3a', 0.35);
        sprites.get('bm4_flare').draw(g, this.ix, this.iy - 1, Math.floor(t * 24));
        sprites.get('bm4_flare').draw(g, this.ex, this.ey, Math.floor(t * 24) + 1, { alpha: 0.9 });
      }
    }
  }
}
