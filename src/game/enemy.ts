// Enemy base class with common AI helpers (targeting, firing, grenade lobbing, death handling).
// Subclasses implement think(dt) (alive behaviour) and render(); death is handled here
// (override onDeath/updateDeath/renderDeath for custom behaviour).

import { Actor, type Entity } from './entity';
import { Z, type Damage, type DamageKind } from './constants';
import { EnemyBullet, Grenade } from './projectile';
import { dropPickup } from './pickup';
import { fxRng } from '../engine/rng';

export abstract class Enemy extends Actor {
  state = 'idle';
  stateTime = 0;
  dying = false;
  deathTime = 0;
  deathKind: DamageKind = 'bullet';
  /** Remove this long after death starts. */
  deathDuration = 1.6;
  /** Scale HP by difficulty (bigger enemies). */
  scaleHp = true;
  /** Death scream sfx name. */
  deathSfx: string | null = 'enemy_die';

  constructor() {
    super();
    this.team = 'enemy';
    this.hittable = true;
    this.blocksProgress = true;
    this.z = Z.ENEMY;
    this.scoreValue = 100;
  }

  override spawned(): void {
    if (this.scaleHp && this.maxHp > 1) {
      this.maxHp = Math.max(1, Math.round(this.maxHp * this.world.difficulty.enemyHp));
      this.hp = this.maxHp;
    }
    if (this.props.facing === undefined) {
      const t = this.target();
      if (t) this.facing = t.x < this.x ? -1 : 1;
    }
  }

  setState(s: string): void {
    this.state = s;
    this.stateTime = 0;
  }

  override update(dt: number): void {
    this.stateTime += dt;
    if (this.dying) {
      this.deathTime += dt;
      this.updateDeath(dt);
      if (this.deathTime >= this.deathDuration) this.remove();
      return;
    }
    this.think(dt);
  }

  /** Alive behaviour. */
  abstract think(dt: number): void;

  // ---------------------------------------------------------------- helpers

  /** Nearest player-side target (player or the vehicle they drive). */
  target(maxDist = Infinity): Entity | null {
    return this.world.nearestPlayer(this.cx, this.cy, maxDist);
  }

  /** Horizontal distance to target (signed), or Infinity. */
  dxTo(t: Entity | null): number {
    return t ? t.x - this.x : Infinity;
  }

  faceTarget(t: Entity | null = this.target()): void {
    if (t) this.facing = t.x < this.x ? -1 : 1;
  }

  /** Only attack when (mostly) on screen. */
  canAttack(margin = -6): boolean {
    return this.onScreen(margin) && !this.dying;
  }

  /** Scale a base cooldown by difficulty with +-15% jitter. */
  fireDelay(base: number): number {
    return base * this.world.difficulty.enemyFireDelay * this.world.rng.range(0.85, 1.15);
  }

  /** Projectile speed scaled by difficulty. */
  shotSpeed(base: number): number {
    return base * this.world.difficulty.enemyShotSpeed;
  }

  /** Fire a standard enemy bullet from (x, y) toward the target (or at a fixed angle). */
  shoot(x: number, y: number, opts: { angle?: number; speed?: number; spread?: number; at?: Entity | null } = {}): EnemyBullet {
    let a = opts.angle;
    if (a === undefined) {
      const t = opts.at ?? this.target();
      a = t ? Math.atan2(t.cy - y, t.cx - x) : this.facing > 0 ? 0 : Math.PI;
    }
    if (opts.spread) a += this.world.rng.range(-opts.spread, opts.spread);
    const b = new EnemyBullet(this, x, y, a, this.shotSpeed(opts.speed ?? 150));
    this.world.add(b);
    return b;
  }

  /** Lob a grenade that lands near target x. */
  lob(x: number, y: number, tx: number, ty: number, opts: { vy?: number; radius?: number; damage?: number; sprite?: string } = {}): Grenade {
    const g = 560;
    const vy0 = opts.vy ?? -230;
    const dy = ty - y;
    const disc = vy0 * vy0 + 2 * g * dy;
    const t = disc > 0 ? (-vy0 + Math.sqrt(disc)) / g : 0.8;
    const vx = Math.max(-210, Math.min(210, (tx - x) / Math.max(0.2, t)));
    const gr = new Grenade({ team: 'enemy', owner: this, x, y, vx, vy: vy0, radius: opts.radius ?? 20, damage: opts.damage ?? 1, maxBounces: 0, sprite: opts.sprite });
    this.world.add(gr);
    return gr;
  }

  // ---------------------------------------------------------------- death

  override die(d?: Damage): void {
    if (this.dying) return;
    this.dying = true;
    this.deathTime = 0;
    this.hittable = false;
    this.blocksProgress = false;
    this.deathKind = d?.kind ?? 'bullet';
    const dir = d?.dir ?? -this.facing;
    if (this.deathKind === 'explosion') {
      this.vx = dir * 90;
      this.jump(220);
    } else if (this.deathKind !== 'fire') {
      this.vx = dir * 40;
    } else {
      this.vx = 0;
    }
    this.facing = (dir > 0 ? -1 : 1) as 1 | -1;
    if (this.deathSfx) this.world.sfx(this.deathSfx, this.x, { pitch: fxRng.range(0.9, 1.15) });
    if (this.props.drop) dropPickup(this.world, this.x, this.y - this.h / 2, this.props.drop);
    this.world.invalidateTargets();
    this.onDeath(d);
  }

  /** Hook for custom death effects. */
  onDeath(_d?: Damage): void {}

  /** Default death physics: slide/fall to the ground. */
  updateDeath(dt: number): void {
    if (this.onGround) this.vx *= Math.pow(0.02, dt);
    this.moveAndCollide(dt);
  }

  /** Blink before vanishing. */
  get deathBlinkHidden(): boolean {
    return this.dying && this.deathTime > this.deathDuration - 0.5 && Math.floor(this.deathTime * 20) % 2 === 0;
  }
}
