// Projectiles: a flexible base class plus the common bullets/grenades/rockets/shells used by
// both players and enemies. Hit detection is swept (segment vs hurtbox) so fast bullets never tunnel.

import { sprites } from '../engine/sprites';
import { segmentRect, angleTo, rotateTowards, type Rect } from '../engine/math';
import { fxRng } from '../engine/rng';
import { Entity } from './entity';
import { Z, type DamageKind, type Team } from './constants';
import type { ExplosionSize } from './effects';

export interface ProjectileOpts {
  team: Team;
  owner?: Entity | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage?: number;
  kind?: DamageKind;
  w?: number;
  h?: number;
  life?: number;
  gravity?: number;
  /** Number of extra targets it can pass through. */
  pierce?: number;
  hitsTerrain?: boolean;
  sprite?: string;
  fps?: number;
  /** Rotate sprite to velocity. */
  rotate?: boolean;
  /** Explode on impact. */
  explode?: { radius: number; damage: number; size?: ExplosionSize; shake?: number; sfx?: string | null };
}

export class Projectile extends Entity {
  damageAmount: number;
  kind: DamageKind;
  life: number;
  gravity: number;
  pierce: number;
  hitsTerrain: boolean;
  spriteName: string | null;
  fps: number;
  rotateSprite: boolean;
  explodeOpts: ProjectileOpts['explode'] | null;
  private hitIds = new Set<number>();
  protected px = 0;
  protected py = 0;
  /** Remove when this far outside the camera view. */
  offscreenMargin = 48;

  constructor(o: ProjectileOpts) {
    super();
    this.anchor = 'center';
    this.team = o.team;
    this.owner = o.owner ?? null;
    this.x = o.x;
    this.y = o.y;
    this.vx = o.vx;
    this.vy = o.vy;
    this.damageAmount = o.damage ?? 1;
    this.kind = o.kind ?? 'bullet';
    this.w = o.w ?? 4;
    this.h = o.h ?? 4;
    this.life = o.life ?? 2.5;
    this.gravity = o.gravity ?? 0;
    this.pierce = o.pierce ?? 0;
    this.hitsTerrain = o.hitsTerrain ?? true;
    this.spriteName = o.sprite ?? null;
    this.fps = o.fps ?? 12;
    this.rotateSprite = o.rotate ?? false;
    this.explodeOpts = o.explode ?? null;
    this.z = Z.PROJECTILE;
    this.facing = o.vx < 0 ? -1 : 1;
    this.persistent = true;
  }

  override update(dt: number): void {
    this.px = this.x;
    this.py = this.y;
    this.vy += this.gravity * dt;
    this.move(dt);
    this.life -= dt;
    if (this.life <= 0) {
      this.expire();
      return;
    }
    if (!this.world.isVisible(this.x, this.y, this.offscreenMargin)) {
      this.remove();
      return;
    }
    if (this.hitsTerrain && this.sweepTerrain()) {
      this.onHitTerrain();
      if (this.dead) return;
    }
    this.checkHits();
  }

  /**
   * Did this frame's path enter solid terrain? Sampled every 3 px (a fast bullet moves 8 px a
   * frame and would skip through a thin deck plate); stops the shot at the first solid point.
   */
  private sweepTerrain(): boolean {
    const T = this.world.terrain;
    const dx = this.x - this.px;
    const dy = this.y - this.py;
    const n = Math.min(32, Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3)));
    for (let i = 1; i <= n; i++) {
      const x = this.px + (dx * i) / n;
      const y = this.py + (dy * i) / n;
      if (T.isSolidPoint(x, y)) {
        this.x = x;
        this.y = y;
        return true;
      }
    }
    return false;
  }

  /** Integrate position (override for homing/sine motion). */
  protected move(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  protected checkHits(): void {
    const hw = this.w / 2;
    const hh = this.h / 2;
    for (const t of this.world.targets(this.team)) {
      if (t.dead || this.hitIds.has(t.id) || t === this.owner) continue;
      let hit = false;
      for (const hb of t.hurtboxes()) {
        const r: Rect = { x: hb.x - hw, y: hb.y - hh, w: hb.w + this.w, h: hb.h + this.h };
        if (segmentRect(this.px, this.py, this.x, this.y, r) >= 0) {
          hit = true;
          break;
        }
      }
      if (!hit) continue;
      this.hitIds.add(t.id);
      const connected = t.damage({ amount: this.damageAmount, kind: this.kind, owner: this.owner ?? this, x: this.x, y: this.y, dir: Math.sign(this.vx) || this.facing });
      if (!connected) continue;
      this.onHitTarget(t);
      if (this.dead) return;
      if (this.pierce > 0) this.pierce--;
      else {
        this.remove();
        return;
      }
    }
  }

  /** Hook: hit something. Default: explode if explosive, else spark. */
  protected onHitTarget(_t: Entity): void {
    if (this.explodeOpts) this.detonate();
    else this.impactFx();
  }

  protected onHitTerrain(): void {
    if (this.explodeOpts) this.detonate();
    else {
      this.impactFx();
      this.remove();
    }
  }

  protected expire(): void {
    if (this.explodeOpts) this.detonate();
    else this.remove();
  }

  protected impactFx(): void {
    if (this.team === 'player') {
      this.world.effect('impact_spark', this.x, this.y, { fps: 30 });
    } else {
      this.world.particles.sparks(this.x, this.y, 3, '#ffb060', 70);
    }
  }

  detonate(): void {
    if (this.dead) return;
    const e = this.explodeOpts!;
    this.world.explode(this.x, this.y, {
      radius: e.radius,
      damage: e.damage,
      team: this.team,
      owner: this.owner ?? this,
      size: e.size,
      shake: e.shake,
      sfx: e.sfx,
    });
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (!this.spriteName) {
      g.fillStyle = this.team === 'player' ? '#ffe070' : '#ff7040';
      g.fillRect(Math.round(this.x - this.w / 2), Math.round(this.y - this.h / 2), this.w, this.h);
      return;
    }
    const s = sprites.get(this.spriteName);
    const frame = Math.floor(this.age * this.fps);
    if (this.rotateSprite) s.draw(g, this.x, this.y, frame, { rot: Math.atan2(this.vy, this.vx) });
    else s.draw(g, this.x, this.y, frame, { flip: this.vx < 0 });
  }
}

// ------------------------------------------------------------------ common sprites

sprites.fallback({
  name: 'bullet_player',
  w: 7,
  h: 3,
  ox: 3,
  oy: 1,
  outline: null,
  draw: (p) => {
    p.rect(0, 0, 7, 3, '#ffa020');
    p.rect(1, 1, 6, 1, '#fff6a0');
    p.px(6, 1, '#ffffff');
  },
});

sprites.fallback({
  name: 'bullet_enemy',
  w: 5,
  h: 5,
  ox: 2,
  oy: 2,
  frames: 2,
  outline: '#3a0a0a',
  draw: (p, f) => {
    p.circle(2.5, 2.5, 2.5, f ? '#ff5a2a' : '#ff8a3a');
    p.circle(2.2, 2.2, 1.2, '#fff0a0');
  },
});

sprites.fallback({
  name: 'grenade',
  w: 6,
  h: 6,
  ox: 3,
  oy: 3,
  frames: 4,
  draw: (p, f) => {
    p.circle(3, 3.2, 2.6, '#4a6a2a');
    p.px(2, 2, '#7aa04a');
    const a = (f / 4) * Math.PI * 2;
    p.px(Math.round(3 + Math.cos(a) * 2.5), Math.round(3 + Math.sin(a) * 2.5), '#c0c0c0');
  },
});

sprites.fallback({
  name: 'enemy_grenade',
  w: 6,
  h: 6,
  ox: 3,
  oy: 3,
  frames: 4,
  draw: (p, f) => {
    p.circle(3, 3.2, 2.6, '#5a4a3a');
    p.px(2, 2, '#8a7a5a');
    const a = (f / 4) * Math.PI * 2;
    p.px(Math.round(3 + Math.cos(a) * 2.5), Math.round(3 + Math.sin(a) * 2.5), '#d84a2a');
  },
});

sprites.fallback({
  name: 'rocket',
  w: 12,
  h: 5,
  ox: 6,
  oy: 2,
  frames: 2,
  draw: (p, f) => {
    p.rect(2, 1, 8, 3, '#7a8a6a');
    p.rect(9, 1, 2, 3, '#c04030');
    p.px(11, 2, '#c04030');
    p.rect(2, 0, 2, 5, '#4a5a3a');
    p.rect(0, 1, 2, 3, f ? '#ffd040' : '#ff8a20');
    p.px(3, 2, '#aab8a0');
  },
});

sprites.fallback({
  name: 'shell',
  w: 6,
  h: 6,
  ox: 3,
  oy: 3,
  draw: (p) => {
    p.circle(3, 3, 2.6, '#3a3a44');
    p.px(2, 2, '#8a8a9a');
  },
});

// ------------------------------------------------------------------ common projectile types

/** Player bullet (pistol / heavy machine gun). */
export class Bullet extends Projectile {
  constructor(owner: Entity, x: number, y: number, angle: number, speed = 430, damage = 1) {
    super({ team: 'player', owner, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, w: 4, h: 3, sprite: 'bullet_player', rotate: true, life: 1.2 });
  }
}

/** Standard slow enemy bullet (dodgeable). */
export class EnemyBullet extends Projectile {
  constructor(owner: Entity | null, x: number, y: number, angle: number, speed = 150, damage = 1) {
    super({ team: 'enemy', owner, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, w: 4, h: 4, sprite: 'bullet_enemy', fps: 10, life: 4 });
  }
}

/** Bouncing grenade (player bombs and enemy grenadiers). Explodes on contact or after bounces. */
export class Grenade extends Projectile {
  bounces = 0;
  maxBounces: number;
  radius: number;
  dmg: number;

  constructor(o: { team: Team; owner: Entity | null; x: number; y: number; vx: number; vy: number; radius?: number; damage?: number; maxBounces?: number; sprite?: string }) {
    super({
      team: o.team,
      owner: o.owner,
      x: o.x,
      y: o.y,
      vx: o.vx,
      vy: o.vy,
      gravity: 560,
      w: 6,
      h: 6,
      sprite: o.sprite ?? (o.team === 'player' ? 'grenade' : 'enemy_grenade'),
      fps: 14,
      life: 4,
      hitsTerrain: false,
      explode: { radius: o.radius ?? 26, damage: o.damage ?? 8, size: 'medium' },
    });
    this.maxBounces = o.maxBounces ?? 1;
    this.radius = o.radius ?? 26;
    this.dmg = o.damage ?? 8;
    this.offscreenMargin = 120;
  }

  protected override move(dt: number): void {
    const T = this.world.terrain;
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;
    // Walls.
    if (T.isSolidPoint(nx, this.y) && !T.isSolidPoint(this.x, this.y)) {
      this.vx = -this.vx * 0.5;
    } else {
      this.x = nx;
    }
    // Floors (incl. platforms) while falling.
    if (this.vy > 0) {
      const hit = T.floorAt(this.x, this.y - 1, ny + 2, { solidTolerance: 6 });
      if (hit) {
        this.y = hit.y - 2;
        if (this.bounces >= this.maxBounces) {
          this.detonate();
          return;
        }
        this.bounces++;
        this.vy = -Math.abs(this.vy) * 0.42;
        this.vx *= 0.6;
        this.world.sfx('grenade_bounce', this.x, { vol: 0.5 });
        return;
      }
    } else if (T.isSolidPoint(this.x, ny)) {
      this.vy = 0;
      return;
    }
    this.y = ny;
  }
}

/** Straight-flying rocket. Optional homing toward targets of the opposing team. */
export class Rocket extends Projectile {
  accel: number;
  maxSpeed: number;
  homing: number;
  smokeTimer = 0;

  constructor(o: { team: Team; owner: Entity | null; x: number; y: number; angle: number; speed?: number; accel?: number; maxSpeed?: number; homing?: number; radius?: number; damage?: number; sprite?: string }) {
    const sp = o.speed ?? 80;
    super({
      team: o.team,
      owner: o.owner,
      x: o.x,
      y: o.y,
      vx: Math.cos(o.angle) * sp,
      vy: Math.sin(o.angle) * sp,
      w: 8,
      h: 5,
      sprite: o.sprite ?? 'rocket',
      rotate: true,
      fps: 16,
      life: 3.5,
      explode: { radius: o.radius ?? 22, damage: o.damage ?? 6, size: 'medium' },
    });
    this.accel = o.accel ?? 500;
    this.maxSpeed = o.maxSpeed ?? 330;
    this.homing = o.homing ?? 0;
  }

  protected override move(dt: number): void {
    let ang = Math.atan2(this.vy, this.vx);
    let sp = Math.hypot(this.vx, this.vy);
    if (this.homing > 0) {
      let best: Entity | null = null;
      let bd = 260;
      for (const t of this.world.targets(this.team)) {
        if (t.team === 'neutral' || t.dead) continue;
        const d = Math.hypot(t.cx - this.x, t.cy - this.y);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      if (best) ang = rotateTowards(ang, angleTo(this.x, this.y, best.cx, best.cy), this.homing * dt);
    }
    sp = Math.min(this.maxSpeed, sp + this.accel * dt);
    this.vx = Math.cos(ang) * sp;
    this.vy = Math.sin(ang) * sp;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.03;
      this.world.particles.add({ kind: 'smoke', x: this.x - Math.cos(ang) * 6, y: this.y - Math.sin(ang) * 6, vx: fxRng.range(-8, 8), vy: fxRng.range(-12, 0), life: 0.4, color: '#c8c8c8', color2: '#808080', size: 1, size2: 3 });
    }
  }
}

/** Arcing cannon shell (tanks, mortars). Explodes on terrain. */
export class Shell extends Projectile {
  constructor(o: { team: Team; owner: Entity | null; x: number; y: number; vx: number; vy: number; radius?: number; damage?: number; gravity?: number; sprite?: string }) {
    super({
      team: o.team,
      owner: o.owner,
      x: o.x,
      y: o.y,
      vx: o.vx,
      vy: o.vy,
      gravity: o.gravity ?? 400,
      w: 6,
      h: 6,
      sprite: o.sprite ?? 'shell',
      life: 5,
      explode: { radius: o.radius ?? 20, damage: o.damage ?? 1, size: 'medium' },
    });
    this.offscreenMargin = 200;
  }
}
