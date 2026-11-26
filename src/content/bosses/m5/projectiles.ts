// THUNDERHEAD (boss_m5) projectiles and effects:
//  - SkyMine: parachute aerial mine (shootable). Pops its chute at the apex of its throw, drifts
//    down-wind, blinks; arms when a player gets close (0.4 s beep + visible blast ring) or when its
//    fuse runs out, then bursts. A shot pops it harmlessly.
//  - BroadsideShell: slow heavy shell fired by the gondola's gun ports (explodes on contact).
//  - LightningStrike: storm-core bolt. Tracks the target with a flickering dotted aim line, locks
//    (blinks), then strikes along the locked line for a moment (electric damage).
//  - WreckHalf: a burning half of the destroyed airship tumbling down out of the sky.
// Sounds go through s5()/s5At(), typed against canonical names (docs/DESIGN.md).

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { VIEW_H, VIEW_W } from '../../../engine/renderer';
import { angleTo, distToRect, rotateTowards, segmentRect } from '../../../engine/math';
import type { PlayOpts } from '../../../engine/audio';
import { Entity } from '../../../game/entity';
import { Projectile } from '../../../game/projectile';
import { Z, type Damage } from '../../../game/constants';
import type { World } from '../../../game/world';
import { flames, smoke, sparkBurst } from '../common/kit';
import { pixelLine, dottedLine } from '../common/fx';
import { T5 } from './art';

// ------------------------------------------------------------------ sound

/** Canonical SFX names (docs/DESIGN.md) used by THUNDERHEAD. */
export const M5_SFX = [
  'boss_roar',
  'boss_die',
  'warning',
  'boss_charge',
  'boss_laser',
  'boss_hit',
  'metal_hit',
  'engine',
  'heli_gun',
  'tank_cannon',
  'mortar_fire',
  'mine_beep',
  'parachute',
  'enemy_alert',
  'shell_casing',
  'explosion_small',
  'explosion',
  'explosion_big',
  'fire_burst',
  'glass_break',
  'robot_shot',
] as const;
export type M5Sfx = (typeof M5_SFX)[number];

export function s5(e: Entity, name: M5Sfx, opts: PlayOpts = {}): void {
  e.world.sfx(name, e.x, opts);
}

export function s5At(w: World, name: M5Sfx, x: number, opts: PlayOpts = {}): void {
  w.sfx(name, x, opts);
}

// ------------------------------------------------------------------ sky mine

const MINE_TRIGGER = 22;
const MINE_BLAST = 19;

export class SkyMine extends Entity {
  phase: 'thrown' | 'chute' | 'armed' = 'thrown';
  private t = 0;
  private armT = 0;
  private fuse: number;
  private wind: number;
  private chuteT = 0;
  private beepT = 0;
  private sway = fxRng.range(0, 6);

  constructor(owner: Entity, x: number, y: number, vx: number, vy: number, fuse = 6, wind = -20) {
    super();
    this.owner = owner;
    this.anchor = 'center';
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.w = 9;
    this.h = 9;
    this.team = 'enemy';
    this.hittable = true;
    this.hp = this.maxHp = 1;
    this.scoreValue = 100;
    this.z = Z.PROJECTILE - 2;
    this.persistent = true;
    this.fuse = fuse;
    this.wind = wind;
  }

  override update(dt: number): void {
    this.t += dt;
    if (this.phase === 'thrown') {
      this.vy += 300 * dt;
      this.vx *= Math.pow(0.75, dt);
      if (this.vy > 10 && this.t > 0.25) {
        this.phase = 'chute';
        this.chuteT = 0;
        s5(this, 'parachute', { vol: 0.35, pitch: 1.3 });
      }
    } else {
      this.chuteT += dt;
      const k = Math.min(1, dt * 3);
      this.vx += (this.wind + Math.sin((this.t + this.sway) * 2.2) * 10 - this.vx) * k;
      this.vy += (24 - this.vy) * k;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.phase !== 'armed') {
      if (this.t > this.fuse || this.nearTarget(MINE_TRIGGER)) this.arm();
    } else {
      this.armT += dt;
      this.beepT -= dt;
      if (this.beepT <= 0) {
        this.beepT = 0.12;
        s5(this, 'mine_beep', { vol: 0.45, pitch: 1.4 });
      }
      if (this.armT >= 0.42) {
        this.burst();
        return;
      }
    }
    const c = this.world.camera;
    if (this.y > c.y + VIEW_H + 24 || this.x < c.x - 40 || this.x > c.x + VIEW_W + 60) this.remove();
  }

  private nearTarget(r: number): boolean {
    for (const t of this.world.targets('enemy')) {
      if (t.dead) continue;
      for (const hb of t.hurtboxes()) if (distToRect(this.x, this.y, hb) <= r) return true;
    }
    return false;
  }

  arm(): void {
    if (this.phase === 'armed') return;
    this.phase = 'armed';
    this.armT = 0;
    this.beepT = 0;
  }

  /** Blow up as an attack (hurts players). */
  burst(): void {
    if (this.dead) return;
    this.world.explode(this.x, this.y, { radius: MINE_BLAST, damage: 1, team: 'enemy', owner: this.owner, size: 'medium', shake: 2, sfx: 'explosion' });
    this.remove();
  }

  /** Harmless pop (shot down, or the boss died). */
  pop(): void {
    if (this.dead) return;
    this.world.explode(this.x, this.y, { radius: 8, damage: 0, team: 'enemy', size: 'small', shake: 0, sfx: 'explosion_small' });
    this.world.particles.debris(this.x, this.y, 5, [T5.cream, '#a8502a', '#3c3834'], 90);
    this.remove();
  }

  override die(_d?: Damage): void {
    this.pop();
  }

  override render(g: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const armed = this.phase === 'armed';
    if (armed) {
      // Blast radius ring (blinks faster as it goes off).
      if (Math.floor(this.armT * 18) % 2 === 0) {
        g.fillStyle = '#ff4030';
        const n = 28;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + this.armT * 2;
          g.fillRect(Math.round(x + Math.cos(a) * MINE_BLAST), Math.round(y + Math.sin(a) * MINE_BLAST), 1, 1);
        }
      }
    }
    if (this.phase !== 'thrown' || this.t > 0.18) {
      const f = this.phase === 'thrown' ? 0 : this.chuteT < 0.15 ? 1 : 2 + (Math.floor((this.t + this.sway) * 2.2) % 2);
      sprites.get('bm5_chute').draw(g, x, y - 3, f);
    }
    const lit = armed ? Math.floor(this.armT * 14) % 2 === 0 : Math.floor(this.t * 2.5) % 2 === 0;
    sprites.get('bm5_mine').draw(g, x, y, lit ? 1 : 0, { flash: this.flash > 0 || (armed && lit) });
  }
}

// ------------------------------------------------------------------ broadside shell

export class BroadsideShell extends Projectile {
  private trailT = 0;

  constructor(owner: Entity, x: number, y: number, angle: number, speed: number) {
    super({
      team: 'enemy',
      owner,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 6,
      h: 5,
      sprite: 'bm5_shell',
      rotate: true,
      fps: 14,
      life: 5,
      explode: { radius: 11, damage: 1, size: 'small', shake: 1, sfx: 'explosion_small' },
    });
    this.offscreenMargin = 30;
  }

  override update(dt: number): void {
    super.update(dt);
    if (this.dead) return;
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.05;
      this.world.particles.add({ kind: 'smoke', x: this.x - this.vx * 0.03, y: this.y - this.vy * 0.03, vx: fxRng.range(-5, 5), vy: fxRng.range(-8, 0), life: 0.35, color: '#bdb4a8', color2: '#6a6462', size: 1, size2: 3, drag: 2 });
    }
  }
}

// ------------------------------------------------------------------ lightning

export interface StrikeOpts {
  /** Live origin (the storm core moves with the ship). */
  origin: () => { x: number; y: number };
  /** Seconds tracking the target, then seconds locked (blinking) before the bolt. */
  track: number;
  lock: number;
  /** Max aim turn rate while tracking (rad/s). */
  turn: number;
  /** Seconds the bolt stays live. */
  bolt?: number;
  /** Initial aim angle. */
  angle: number;
}

/** Storm-core lightning: dotted tracking line -> locked blinking line -> jagged bolt. */
export class LightningStrike extends Entity {
  angle: number;
  stage: 'track' | 'lock' | 'bolt' = 'track';
  private st = 0;
  private o: StrikeOpts;
  private hitIds = new Set<number>();
  private jag: number[] = [];
  private jagT = 0;

  constructor(owner: Entity, o: StrikeOpts) {
    super();
    this.owner = owner;
    this.o = o;
    this.angle = o.angle;
    this.anchor = 'center';
    this.z = Z.FX - 1;
    this.persistent = true;
    const p = o.origin();
    this.x = p.x;
    this.y = p.y;
  }

  /** Point where the aim line leaves the camera view. */
  end(): { x: number; y: number } {
    const c = this.world.camera;
    const cs = Math.cos(this.angle);
    const sn = Math.sin(this.angle);
    let t = 900;
    if (cs < -1e-6) t = Math.min(t, (c.x - 4 - this.x) / cs);
    if (cs > 1e-6) t = Math.min(t, (c.x + VIEW_W + 4 - this.x) / cs);
    if (sn < -1e-6) t = Math.min(t, (c.y - 4 - this.y) / sn);
    if (sn > 1e-6) t = Math.min(t, (c.y + VIEW_H + 4 - this.y) / sn);
    t = Math.max(8, t);
    return { x: this.x + cs * t, y: this.y + sn * t };
  }

  override update(dt: number): void {
    const p = this.o.origin();
    this.x = p.x;
    this.y = p.y;
    this.st += dt;
    const owner = this.owner;
    if (!owner || owner.dead || (owner as any).dying) {
      this.remove();
      return;
    }
    if (this.stage === 'track') {
      const t = this.world.nearestPlayer(this.x, this.y);
      if (t) this.angle = rotateTowards(this.angle, angleTo(this.x, this.y, t.cx, t.cy), this.o.turn * dt);
      if (fxRng.chance(dt * 25)) sparkBurst(this.world, this.x + fxRng.range(-8, 8), this.y + fxRng.range(-8, 8), 1, '#bfefff', 60);
      if (this.st >= this.o.track) {
        this.stage = 'lock';
        this.st = 0;
      }
    } else if (this.stage === 'lock') {
      if (this.st >= this.o.lock) {
        this.stage = 'bolt';
        this.st = 0;
        s5(this, 'boss_laser', { vol: 0.85, pitch: 1.35 });
        s5(this, 'explosion', { vol: 0.5, pitch: 1.6 });
        this.world.flash('#c8f0ff', 0.3);
        this.world.shake(3, 0.25);
        const e = this.end();
        sparkBurst(this.world, e.x, e.y, 8, '#e0f8ff', 140);
      }
    } else {
      const e = this.end();
      // One hit per target per bolt.
      for (const t of this.world.targets('enemy').slice()) {
        if (t.dead || !t.hittable || this.hitIds.has(t.id)) continue;
        for (const hb of t.hurtboxes()) {
          const r = { x: hb.x - 4, y: hb.y - 4, w: hb.w + 8, h: hb.h + 8 };
          if (segmentRect(this.x, this.y, e.x, e.y, r) < 0) continue;
          this.hitIds.add(t.id);
          const veh = (t as { isVehicle?: boolean }).isVehicle === true;
          t.damage({ amount: veh ? 2 : 1, kind: 'electric', owner: this.owner, x: t.cx, y: t.cy, dir: Math.sign(t.cx - this.x) || -1 });
          sparkBurst(this.world, t.cx, t.cy, 6, '#d8f6ff', 120);
          break;
        }
      }
      if (fxRng.chance(dt * 40)) {
        const k = fxRng.next();
        sparkBurst(this.world, this.x + (e.x - this.x) * k, this.y + (e.y - this.y) * k, 2, '#d8f6ff', 90);
      }
      if (this.st >= (this.o.bolt ?? 0.32)) this.remove();
    }
  }

  private rebuildJag(len: number): void {
    const n = Math.max(2, Math.floor(len / 14));
    this.jag = [];
    for (let i = 0; i <= n; i++) this.jag.push(i === 0 || i === n ? 0 : fxRng.range(-7, 7));
  }

  override render(g: CanvasRenderingContext2D): void {
    const e = this.end();
    const x0 = this.x;
    const y0 = this.y;
    if (this.stage === 'track') {
      const ph = this.world.time * 40;
      dottedLine(g, x0, y0, e.x, e.y, '#1c2a7a', 6, 3, -ph, 3);
      dottedLine(g, x0, y0, e.x, e.y, Math.floor(this.st * 12) % 2 ? '#e8fbff' : '#8ce0ff', 6, 3, -ph);
      return;
    }
    if (this.stage === 'lock') {
      const on = Math.floor(this.st * 20) % 2 === 0;
      dottedLine(g, x0, y0, e.x, e.y, '#3a0a10', 4, 3, 0, 3);
      dottedLine(g, x0, y0, e.x, e.y, on ? '#ffffff' : '#ff5a4a', 4, 3, 0, on ? 1 : 2);
      return;
    }
    // Bolt: jagged polyline, rebuilt every few frames, with a cyan glow and a white core.
    const len = Math.hypot(e.x - x0, e.y - y0);
    this.jagT -= 1 / 60;
    if (this.jagT <= 0 || !this.jag.length) {
      this.jagT = 0.05;
      this.rebuildJag(len);
    }
    const n = this.jag.length - 1;
    const nx = -(e.y - y0) / Math.max(1, len);
    const ny = (e.x - x0) / Math.max(1, len);
    const pts: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(x0 + (e.x - x0) * t + nx * this.jag[i], y0 + (e.y - y0) * t + ny * this.jag[i]);
    }
    const fade = this.st > (this.o.bolt ?? 0.32) * 0.7;
    const seg = (w: number, c: string) => {
      for (let i = 0; i < n; i++) pixelLine(g, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], c, w);
      // Forks off every other joint.
      for (let i = 2; i < n; i += 2) {
        const fx = pts[i * 2] + nx * this.jag[i] * 1.6 + (e.x - x0) * 0.04;
        const fy = pts[i * 2 + 1] + ny * this.jag[i] * 1.6 + (e.y - y0) * 0.04;
        pixelLine(g, pts[i * 2], pts[i * 2 + 1], fx, fy, c, Math.max(1, w - 2));
      }
    };
    if (!fade) seg(5, T5.coreDD);
    seg(3, fade ? T5.coreD : T5.coreM);
    seg(1, fade ? T5.core : T5.coreW);
  }
}

// ------------------------------------------------------------------ falling wreck

export interface WreckPart {
  sprite: string;
  frame: number;
  /** Offset from the wreck pivot (art space, before the flip). */
  dx: number;
  dy: number;
}

/**
 * Half of the destroyed airship: falls and rotates around its pivot, trailing fire and smoke,
 * clipped to its half of the hull (art-space x range). Pure decoration.
 */
export class WreckHalf extends Entity {
  parts: WreckPart[];
  rot = 0;
  vr: number;
  clipX0: number;
  clipX1: number;
  emitters: [number, number][];
  private fxT = 0;

  constructor(x: number, y: number, facing: 1 | -1, parts: WreckPart[], clip: [number, number], emitters: [number, number][], vx: number, vy: number, vr: number) {
    super();
    this.x = x;
    this.y = y;
    this.facing = facing;
    this.parts = parts;
    this.clipX0 = clip[0];
    this.clipX1 = clip[1];
    this.emitters = emitters;
    this.vx = vx;
    this.vy = vy;
    this.vr = vr;
    this.anchor = 'center';
    this.z = Z.BOSS - 1;
    this.persistent = true;
  }

  /** World position of an art-space point after rotation. */
  pt(ax: number, ay: number): { x: number; y: number } {
    const lx = ax * this.facing;
    const cs = Math.cos(this.rot);
    const sn = Math.sin(this.rot);
    return { x: this.x + lx * cs - ay * sn, y: this.y + lx * sn + ay * cs };
  }

  override update(dt: number): void {
    this.vy = Math.min(this.vy + 120 * dt, 150);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vr * dt;
    this.fxT -= dt;
    if (this.fxT <= 0) {
      this.fxT = 0.05;
      const [ex, ey] = this.emitters[Math.floor(fxRng.next() * this.emitters.length)];
      const p = this.pt(ex, ey);
      smoke(this.world, p.x, p.y, { n: 1, size: 3, size2: 10, life: 1.4, vy: -40, color: '#3a3436', color2: '#1e1a1e' });
      flames(this.world, p.x, p.y, { n: 2, size: 3, life: 0.35, spread: 5, vy: -60 });
    }
    if (this.y > this.world.camera.y + VIEW_H + 140) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    g.save();
    g.translate(Math.round(this.x), Math.round(this.y));
    g.rotate(this.rot);
    g.beginPath();
    const a = Math.min(this.clipX0 * this.facing, this.clipX1 * this.facing);
    const b = Math.max(this.clipX0 * this.facing, this.clipX1 * this.facing);
    g.rect(a, -80, b - a, 180);
    g.clip();
    for (const P of this.parts) sprites.get(P.sprite).draw(g, P.dx * this.facing, P.dy, P.frame, { flip: this.facing < 0 });
    g.restore();
  }
}
