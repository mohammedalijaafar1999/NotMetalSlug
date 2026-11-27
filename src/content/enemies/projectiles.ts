// Projectiles and attack effects used by Rustcoat infantry. All are dodgeable and telegraphed:
//   LegionRocket  slow-starting bazooka rocket (no homing); players can shoot it down
//   Harpoon       thrown frogman harpoon (arcs, sticks into walls/ground)
//   SniperRound   fast sniper tracer (only fired after a laser-sight telegraph)
//   EnergyBolt    robot plasma orb (electric)
//   MortarShell   lobbed off-screen; a blinking marker shows where it lands
//   FlameJet      short flamethrower burst attached to a flametrooper's nozzle

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { Entity } from '../../game/entity';
import { Projectile, Rocket } from '../../game/projectile';
import { ExplosionEffect } from '../../game/effects';
import { Z, type Damage } from '../../game/constants';
import { rectsOverlap, type Rect } from '../../engine/math';

// ------------------------------------------------------------------ sprites

sprites.define({
  name: 'legion_rocket',
  w: 15,
  h: 7,
  ox: 8,
  oy: 3,
  frames: 2,
  draw: (p, f) => {
    // Exhaust.
    p.poly([0, 3.5, 3.5, 1.5, 3.5, 5.5], f ? '#ffd040' : '#ff8a20');
    p.px(1 + f, 3, '#fff6a0');
    // Tail fins.
    p.poly([3, 0, 6.5, 2, 6.5, 5, 3, 7], '#3a4426');
    // Body.
    p.rect(4.5, 2, 6, 3, '#6a7a44');
    p.rect(4.5, 2, 6, 1, '#94a466');
    p.rect(4.5, 4, 6, 1, '#4a5a2e');
    p.rect(8.5, 2, 1, 3, '#d8c070');
    // Warhead.
    p.poly([10.5, 1.5, 12.5, 2, 15, 3.5, 12.5, 5, 10.5, 5.5], '#c0442a');
    p.rect(11, 2, 2, 1, '#ec7a52');
  },
});

sprites.define({
  name: 'harpoon',
  w: 19,
  h: 5,
  ox: 10,
  oy: 2,
  draw: (p) => {
    // Rope tail + shaft.
    p.rect(0, 2, 2, 1, '#d8c890');
    p.rect(1, 1.5, 2, 2, '#c04030');
    p.rect(3, 2, 10, 1, '#9a7a44');
    p.px(5, 2, '#c8a868');
    p.px(9, 2, '#c8a868');
    // Barbed steel head.
    p.poly([12, 1, 14, 1.2, 19, 2.5, 14, 3.8, 12, 4], '#b8c2cc');
    p.px(14, 1, '#ffffff');
    p.px(15, 2, '#ffffff');
    p.tri(12, 0, 14, 1.5, 12, 2, '#8a949e');
    p.tri(12, 5, 14, 3.5, 12, 3, '#8a949e');
  },
});

sprites.define({
  name: 'sniper_round',
  w: 13,
  h: 3,
  ox: 7,
  oy: 1,
  outline: '#5a1408',
  draw: (p) => {
    p.rect(0, 1, 7, 1, '#ff7a3a');
    p.rect(4, 0.5, 4, 2, '#ffb060');
    p.rect(7, 0, 6, 3, '#ffe0a0');
    p.rect(8, 1, 5, 1, '#ffffff');
  },
});

sprites.define({
  name: 'energy_bolt',
  w: 13,
  h: 13,
  ox: 6,
  oy: 6,
  frames: 3,
  outline: '#0a2a3a',
  draw: (p, f) => {
    const c = 6.5;
    // Crackling spikes rotate each frame.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + f * 0.55;
      p.line(c, c, c + Math.cos(a) * 6, c + Math.sin(a) * 6, i % 2 ? '#7af0ff' : '#c8ffff');
    }
    p.circle(c, c, 4.2 - (f % 2) * 0.4, '#1ab8e8');
    p.circle(c, c, 3, '#7af0ff');
    p.circle(c - 0.5, c - 0.5, 1.6, '#ffffff');
  },
});

sprites.define({
  name: 'mortar_shell',
  w: 7,
  h: 13,
  ox: 3,
  oy: 6,
  draw: (p) => {
    // Nose up (flip vertically when falling).
    p.ellipse(3.5, 4.5, 3, 4.5, '#3c3a44');
    p.ellipse(2.8, 3.5, 1.2, 2.5, '#6a6874');
    p.rect(2.5, 8, 2, 2, '#2a2830');
    p.poly([0.5, 13, 3.5, 9.5, 6.5, 13], '#4a4852');
    p.rect(1, 6, 5, 1, '#c8a040');
    p.px(3, 0, '#c0442a');
  },
});

/** Mortar shell blast radius (px). Its landing marker ring is drawn exactly this wide. */
export const MORTAR_RADIUS = 22;

sprites.define({
  name: 'mortar_marker',
  w: MORTAR_RADIUS * 2 + 1,
  h: 11,
  ox: MORTAR_RADIUS,
  oy: 6,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    const c = f ? '#ff3a2a' : '#ffd040';
    const d = f ? '#8a1a10' : '#a07010';
    const R = MORTAR_RADIUS;
    // Perspective ring on the ground covering the whole blast + crosshair ticks.
    p.ellipse(R + 0.5, 6, R - 0.5, 3.6, d);
    p.ellipse(R + 0.5, 6, R - 1.7, 2.6, 'transparent');
    p.ellipse(R + 0.5, 5.5, R - 0.5, 3.6, c);
    p.ellipse(R + 0.5, 5.5, R - 1.7, 2.6, 'transparent');
    p.rect(0, 5, 3, 1, c);
    p.rect(2 * R - 2, 5, 3, 1, c);
    p.rect(R, 0, 1, 3, c);
    p.rect(R, 8, 1, 3, c);
    p.rect(R - 0.5, 5, 2, 1, c);
  },
});

/** Flame blob: frame 0 (small, hot) .. 5 (big, fading). */
sprites.define({
  name: 'flame_puff',
  w: 15,
  h: 15,
  ox: 7,
  oy: 7,
  frames: 6,
  outline: null,
  draw: (p, f) => {
    const c = 7.5;
    const r = 2.2 + f * 1.0;
    const cols = ['#c8281a', '#ff6a1a', '#ffb030', '#fff2a0'];
    if (f >= 4) {
      // Fading tip: dithered dark-red/smoky edge.
      for (let y = 0; y < 15; y++)
        for (let x = 0; x < 15; x++) {
          const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
          if (d <= r && d > r - 1.6 && (x + y + f) % 2 === 0) p.px(x, y, f === 5 ? '#5a3a36' : '#a02a18');
        }
    }
    p.circle(c, c, r * (f >= 4 ? 0.78 : 1), cols[0]);
    p.circle(c - 0.3, c - 0.4, r * 0.72, cols[1]);
    if (f < 5) p.circle(c - 0.6, c - 0.6, r * 0.46, cols[2]);
    if (f < 3) p.circle(c - 0.6, c - 0.8, r * 0.24, cols[3]);
  },
});

// ------------------------------------------------------------------ projectiles

/** Bazooka rocket: starts slow, accelerates, flies straight. Shooting it makes it fizzle. */
export class LegionRocket extends Rocket {
  constructor(owner: Entity | null, x: number, y: number, angle: number, o: { speed?: number; accel?: number; maxSpeed?: number } = {}) {
    super({ team: 'enemy', owner, x, y, angle, speed: o.speed ?? 60, accel: o.accel ?? 200, maxSpeed: o.maxSpeed ?? 160, homing: 0, radius: 16, damage: 1, sprite: 'legion_rocket' });
    this.w = 8;
    this.h = 6;
    this.hittable = true;
  }

  override damage(d: Damage): boolean {
    if (this.dead || !this.hittable) return false;
    // Shot down by the players: harmless puff (+ a few points).
    this.hittable = false;
    this.world.add(new ExplosionEffect(this.x, this.y, 'small'));
    this.world.particles.sparks(this.x, this.y, 6, '#ffd060', 120);
    this.world.particles.debris(this.x, this.y, 3, ['#6a7a44', '#c0442a'], 90);
    this.world.sfx('explosion_small', this.x, { vol: 0.7 });
    this.world.addScore(d.owner, 50, { x: this.x, y: this.y - 8 });
    this.world.invalidateTargets();
    this.remove();
    return true;
  }
}

/** Thrown harpoon: arcs, hurts players, sticks into terrain for a moment. */
export class Harpoon extends Projectile {
  stuck = false;
  stuckTime = 0;

  constructor(owner: Entity | null, x: number, y: number, vx: number, vy: number) {
    super({ team: 'enemy', owner, x, y, vx, vy, gravity: 190, w: 6, h: 4, sprite: 'harpoon', rotate: true, life: 3.5, damage: 1 });
  }

  override update(dt: number): void {
    if (this.stuck) {
      this.stuckTime += dt;
      if (this.stuckTime > 1.2) this.remove();
      return;
    }
    super.update(dt);
  }

  protected override onHitTerrain(): void {
    this.stuck = true;
    // Embed the tip: back off along the flight path until just outside the solid.
    const sp = Math.hypot(this.vx, this.vy) || 1;
    for (let i = 0; i < 8 && this.world.terrain.isSolidPoint(this.x, this.y); i++) {
      this.x -= (this.vx / sp) * 1.5;
      this.y -= (this.vy / sp) * 1.5;
    }
    this.x += (this.vx / sp) * 4;
    this.y += (this.vy / sp) * 4;
    this.world.particles.dust(this.x, this.y, 3, '#b8a888');
    this.world.sfx('ricochet', this.x, { vol: 0.35, pitch: 0.7 });
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.stuck && this.stuckTime > 0.9 && Math.floor(this.stuckTime * 20) % 2 === 0) return;
    super.render(g);
  }
}

/** Fast sniper tracer (240 px/s base). */
export class SniperRound extends Projectile {
  constructor(owner: Entity | null, x: number, y: number, angle: number, speed: number) {
    super({ team: 'enemy', owner, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage: 1, w: 4, h: 3, sprite: 'sniper_round', rotate: true, life: 3 });
  }
}

/** Robot plasma orb. */
export class EnergyBolt extends Projectile {
  constructor(owner: Entity | null, x: number, y: number, angle: number, speed: number) {
    super({ team: 'enemy', owner, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage: 1, kind: 'electric', w: 6, h: 6, sprite: 'energy_bolt', fps: 14, life: 4 });
  }

  override update(dt: number): void {
    super.update(dt);
    if (!this.dead && fxRng.chance(dt * 30)) {
      this.world.particles.add({ kind: 'px', x: this.x - Math.sign(this.vx) * 4 + fxRng.range(-1, 1), y: this.y + fxRng.range(-2, 2), vx: -this.vx * 0.1, vy: fxRng.range(-10, 10), life: 0.25, color: '#7af0ff', color2: '#1a78a8' });
    }
  }

  protected override impactFx(): void {
    this.world.particles.sparks(this.x, this.y, 6, '#7af0ff', 110);
  }
}

// ------------------------------------------------------------------ mortar shell

/**
 * Mortar shell. Leaves the tube upward, disappears off-screen, then falls onto (tx, ty).
 * A blinking marker sits on the impact point from launch until impact (`impactAt` seconds).
 */
export class MortarShell extends Entity {
  readonly tx: number;
  readonly ty: number;
  readonly impactAt: number;
  readonly fallTime = 0.5;
  /** Height the shell drops in from (set when it starts falling). */
  private sy: number;
  private whistled = false;
  phase: 'up' | 'wait' | 'down' | 'done' = 'up';
  /** Blast radius: the 'mortar_marker' ring is baked this wide, so keep them in step. */
  readonly radius = MORTAR_RADIUS;

  constructor(owner: Entity, x: number, y: number, tx: number, ty: number, impactAt: number) {
    super();
    this.owner = owner;
    this.team = 'enemy';
    this.anchor = 'center';
    this.x = x;
    this.y = y;
    this.sy = y;
    this.tx = tx;
    this.ty = ty;
    this.impactAt = impactAt;
    this.vx = (tx - x) * 0.25;
    this.vy = -330;
    this.w = 6;
    this.h = 8;
    this.z = Z.PROJECTILE;
    this.persistent = true;
  }

  /** Seconds until impact (<= 0 after). */
  get timeLeft(): number {
    return this.impactAt - this.age;
  }

  override update(dt: number): void {
    const left = this.timeLeft;
    if (this.phase === 'up') {
      this.vy += 260 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y < this.world.camera.y - 20 || this.age > 0.55) this.phase = 'wait';
    }
    if (this.phase !== 'down' && left <= this.fallTime) {
      this.phase = 'down';
      this.sy = Math.max(this.world.camera.y - 16, this.ty - 230);
    }
    if (!this.whistled && left <= this.fallTime + 0.2) {
      this.whistled = true;
      this.world.sfx('mortar_whistle', this.tx, { vol: 0.6 });
    }
    if (this.phase === 'down') {
      const k = Math.min(1, 1 - left / this.fallTime);
      this.x = this.tx;
      this.y = this.sy + (this.ty - this.sy) * k * k;
      // Direct hits on the way down.
      const r: Rect = { x: this.x - 3, y: this.y - 4, w: 6, h: 8 };
      let direct = false;
      for (const t of this.world.targets('enemy')) {
        for (const hb of t.hurtboxes()) if (rectsOverlap(r, hb)) direct = true;
      }
      if (k >= 1 || direct) this.detonate();
    }
  }

  detonate(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.world.explode(this.x, Math.min(this.y, this.ty - 3), { radius: this.radius, damage: 1, team: 'enemy', owner: this.owner, size: 'medium', shake: 3 });
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const left = this.timeLeft;
    // Marker: blinks faster as the shell gets close.
    const rate = left < 0.45 ? 16 : left < 0.9 ? 10 : 6;
    const blink = Math.floor(this.age * rate) % 2;
    const m = sprites.get('mortar_marker');
    m.draw(g, this.tx, this.ty - 1, blink);
    if (left < 0.9) {
      // Growing shadow under the incoming shell.
      const k = 1 - Math.max(0, left) / 0.9;
      const w = Math.round(3 + k * 6);
      g.globalAlpha = 0.35 + k * 0.3;
      g.fillStyle = '#140c1c';
      g.fillRect(Math.round(this.tx - w), Math.round(this.ty - 1), w * 2, 1);
      g.fillRect(Math.round(this.tx - w + 2), Math.round(this.ty - 2), w * 2 - 4, 1);
      g.globalAlpha = 1;
    }
    if (this.phase === 'up' || this.phase === 'down') {
      sprites.get('mortar_shell').draw(g, this.x, this.y, 0, { flipY: this.phase === 'down' });
    }
  }
}

// ------------------------------------------------------------------ flame jet

/**
 * Flamethrower burst attached to an owner's nozzle. Grows out to `maxLen`, burns players inside
 * (kind 'fire'), then dies down. The owner moves it via setOrigin() every frame.
 */
export class FlameJet extends Entity {
  ox = 0;
  oy = 0;
  dir: 1 | -1 = 1;
  len = 0;
  maxLen: number;
  duration: number;
  private hitCd = 0;
  /** Stop early (owner died / interrupted). */
  stopping = false;
  private stopT = 0;

  constructor(owner: Entity, maxLen = 62, duration = 0.95) {
    super();
    this.owner = owner;
    this.team = 'enemy';
    this.anchor = 'center';
    this.maxLen = maxLen;
    this.duration = duration;
    this.z = Z.PROJECTILE;
    this.persistent = true;
  }

  setOrigin(x: number, y: number, dir: 1 | -1): void {
    this.ox = x;
    this.oy = y;
    this.dir = dir;
    this.x = x + (dir * this.len) / 2;
    this.y = y;
  }

  stop(): void {
    if (!this.stopping) {
      this.stopping = true;
      this.stopT = 0;
    }
  }

  /** The burning area. */
  hitRect(): Rect {
    const x0 = this.dir > 0 ? this.ox : this.ox - this.len;
    return { x: x0, y: this.oy - 6, w: this.len, h: 12 };
  }

  override update(dt: number): void {
    if (this.age > this.duration) this.stop();
    if (this.stopping) {
      this.stopT += dt;
      this.len = Math.max(0, this.len - dt * 260);
      if (this.len <= 0 || this.stopT > 0.4) {
        this.remove();
        return;
      }
    } else {
      this.len = Math.min(this.maxLen, this.len + dt * 330);
    }
    // Burn the target and stop at walls.
    const T = this.world.terrain;
    for (let d = 6; d < this.len; d += 4) {
      if (T.isSolidPoint(this.ox + this.dir * d, this.oy)) {
        this.len = d;
        break;
      }
    }
    this.hitCd -= dt;
    if (this.hitCd <= 0 && this.len > 8) {
      this.hitCd = 0.1;
      const r = this.hitRect();
      for (const t of this.world.targets('enemy').slice()) {
        let hit = false;
        for (const hb of t.hurtboxes()) if (rectsOverlap(r, hb)) hit = true;
        if (hit) t.damage({ amount: 1, kind: 'fire', owner: this.owner, x: t.cx, y: t.cy, dir: this.dir });
      }
    }
    if (fxRng.chance(dt * 14) && this.len > 20) {
      this.world.particles.add({ kind: 'smoke', x: this.ox + this.dir * this.len, y: this.oy - 3, vx: this.dir * 14, vy: -26, life: 0.6, color: '#4a4048', color2: '#2a2630', size: 2, size2: 5, drag: 1 });
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.len < 2) return;
    const s = sprites.get('flame_puff');
    const t = this.world.time;
    const n = Math.max(1, Math.floor(this.len / 5));
    for (let i = n; i >= 0; i--) {
      // Puffs stream outward; size grows with distance from the nozzle.
      const d = ((i * 5 + t * 140) % (this.len + 5)) - 2;
      if (d < 0 || d > this.len) continue;
      const k = d / this.maxLen;
      const frame = Math.min(5, Math.floor(k * 5.2 + (this.stopping ? 1 : 0)));
      const wob = Math.sin(t * 23 + i * 1.7) * (1 + k * 2.5);
      s.draw(g, this.ox + this.dir * d, this.oy + wob - k * 3, frame);
    }
    // White-hot core at the nozzle.
    s.draw(g, this.ox + this.dir * 2, this.oy, 0);
  }
}
