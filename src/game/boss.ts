// Boss base class: health bar registration, phases, a dramatic multi-explosion death sequence
// that completes the mission, and BossPart for destructible / damage-forwarding sub-parts.

import { Entity } from './entity';
import { Z, type Damage } from './constants';
import { fxRng } from '../engine/rng';
import type { Rect } from '../engine/math';

export abstract class Boss extends Entity {
  bossName: string;
  phase = 0;
  dying = false;
  deathTime = 0;
  /** Seconds of explosions before the mission completes. */
  deathDuration = 3.4;
  stateTime = 0;
  state = 'intro';
  private boomTimer = 0;

  constructor(name: string, hp: number) {
    super();
    this.bossName = name;
    this.team = 'enemy';
    this.hittable = true;
    this.persistent = true;
    this.blocksProgress = true;
    this.z = Z.BOSS;
    this.hp = this.maxHp = hp;
    this.scoreValue = 20000;
    this.anchor = 'bottom';
  }

  override spawned(): void {
    this.maxHp = Math.round(this.maxHp * this.world.difficulty.enemyHp);
    this.hp = this.maxHp;
    this.world.boss = this;
    this.world.bossName = this.bossName;
    this.world.emit({ type: 'bossStart', boss: this, name: this.bossName });
  }

  /** Fraction of health remaining 0..1. */
  get hpFrac(): number {
    return this.maxHp > 0 ? this.hp / this.maxHp : 0;
  }

  setState(s: string): void {
    this.state = s;
    this.stateTime = 0;
  }

  override update(dt: number): void {
    this.stateTime += dt;
    if (this.dying) {
      this.deathTime += dt;
      this.deathSequence(dt);
      return;
    }
    this.think(dt);
  }

  abstract think(dt: number): void;

  override die(_d?: Damage): void {
    if (this.dying) return;
    this.dying = true;
    this.deathTime = 0;
    this.hittable = false;
    this.world.hitstop(0.15);
    this.world.flash('#ffffff', 0.7);
    this.world.sfx('boss_die', this.x);
    // Clear enemy bullets for fairness.
    for (const e of this.world.query((x) => x.team === 'enemy' && (x as any).damageAmount !== undefined)) e.remove();
    this.onDeathStart();
  }

  onDeathStart(): void {}

  /** Area used to place death explosions (default: hitbox). */
  deathArea(): Rect {
    return { ...this.box };
  }

  deathSequence(dt: number): void {
    this.boomTimer -= dt;
    if (this.boomTimer <= 0 && this.deathTime < this.deathDuration - 0.4) {
      this.boomTimer = 0.12 + fxRng.next() * 0.12;
      const a = this.deathArea();
      const x = a.x + fxRng.next() * a.w;
      const y = a.y + fxRng.next() * a.h;
      this.world.explode(x, y, { radius: 22, damage: 0, team: 'enemy', size: fxRng.chance(0.3) ? 'large' : 'medium', shake: 3, sfx: 'explosion' });
    }
    if (this.deathTime >= this.deathDuration) {
      const a = this.deathArea();
      this.world.explode(a.x + a.w / 2, a.y + a.h / 2, { radius: 60, damage: 0, team: 'enemy', size: 'huge', shake: 9, sfx: 'explosion_big' });
      this.world.flash('#ffffff', 0.8);
      this.world.particles.debris(a.x + a.w / 2, a.y + a.h / 2, 40, ['#5a5a6a', '#3a3a44', '#8a6a4a', '#c08040'], 320);
      this.onDestroyed();
      this.world.boss = null;
      this.remove();
      this.world.level.bossDefeated();
    }
  }

  /** Hook after the final explosion (spawn wreckage decor etc). */
  onDestroyed(): void {}

  /** Shake/flash while dying (call from render to wobble). */
  get deathShakeX(): number {
    return this.dying ? Math.round((fxRng.next() - 0.5) * 3) : 0;
  }
}

/**
 * A separately-hittable piece of a boss (turret, weak point, armor plate).
 * Damage is applied to the part's own hp (if destructible) and/or forwarded to the boss.
 */
export class BossPart extends Entity {
  parent: Boss;
  /** Multiplier for damage forwarded to the boss (0 = none). */
  forward: number;
  /** Has its own hp and can be destroyed. */
  destructible: boolean;
  /** Called when destroyed. */
  onDestroyed: ((p: BossPart) => void) | null = null;
  /** Position relative to parent (x, y) — call sync() in parent update. */
  ox = 0;
  oy = 0;

  constructor(parent: Boss, w: number, h: number, opts: { hp?: number; forward?: number; destructible?: boolean } = {}) {
    super();
    this.parent = parent;
    this.w = w;
    this.h = h;
    this.anchor = 'center';
    this.team = 'enemy';
    this.hittable = true;
    this.persistent = true;
    this.forward = opts.forward ?? 1;
    this.destructible = opts.destructible ?? false;
    this.hp = this.maxHp = opts.hp ?? 1;
    this.z = Z.BOSS + 1;
  }

  /** Place relative to parent's (x, y). */
  sync(): void {
    this.x = this.parent.x + this.ox * this.parent.facing;
    this.y = this.parent.y + this.oy;
  }

  override damage(d: Damage): boolean {
    if (this.dead || !this.hittable || this.parent.dying) return false;
    this.flash = 0.07;
    if (this.forward > 0) this.parent.damage({ ...d, amount: d.amount * this.forward });
    if (this.destructible) {
      this.hp -= d.amount;
      if (this.hp <= 0) {
        this.hp = 0;
        this.hittable = false;
        this.world.invalidateTargets();
        this.world.explode(this.x, this.y, { radius: 16, damage: 0, team: 'enemy', size: 'medium' });
        this.onDestroyed?.(this);
        this.remove();
      }
    }
    return true;
  }

  override update(): void {
    if (this.parent.dead || this.parent.dying) {
      this.hittable = false;
      if (this.parent.dead) this.remove();
    }
  }
}
