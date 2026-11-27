// Entity base classes.
//
// Coordinate convention: (x, y) is the BOTTOM-CENTER of the entity (its feet) when
// anchor === 'bottom' (default), or the CENTER when anchor === 'center' (projectiles, effects).
// Hitbox is w x h around that anchor. +y is down. Units are pixels and seconds.

import { MAX_FALL, GRAVITY, type Damage, type Team } from './constants';
import type { Rect } from '../engine/math';
import type { Surface, Solid, Water } from './terrain';
import type { World } from './world';
import { VIEW_W, VIEW_H } from '../engine/renderer';

export abstract class Entity {
  static nextId = 1;
  readonly id: number = Entity.nextId++;
  world!: World;
  /** Registry type name (set by spawn()). */
  type = 'entity';
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  w = 8;
  h = 8;
  anchor: 'bottom' | 'center' = 'bottom';
  facing: 1 | -1 = 1;
  /** Render order (see Z in constants). */
  z = 0;
  team: Team = 'neutral';
  /** Can be damaged by projectiles/explosions of the opposing team. */
  hittable = false;
  hp = 1;
  maxHp = 1;
  /** Marked for removal at the end of the step. */
  dead = false;
  /** Seconds since spawned. */
  age = 0;
  /** Hit-flash timer (render white while > 0). */
  flash = 0;
  /** Invulnerability timer. */
  invuln = 0;
  /** Never auto-despawn when far off-screen. */
  persistent = false;
  /** Camera-lock waves wait until all of these are dead. */
  blocksProgress = false;
  /** Points awarded to the killer. */
  scoreValue = 0;
  /** Players use the knife on this instead of shooting when adjacent. */
  meleeable = false;
  /** Who spawned/fired this (for scoring and friendly-fire rules). */
  owner: Entity | null = null;
  /** Camera-lock wave this entity belongs to (-1 none). Set by the level runtime. */
  waveId = -1;
  /** Arbitrary spawn properties from the level definition. */
  props: Record<string, any> = {};
  private _box: Rect = { x: 0, y: 0, w: 0, h: 0 };

  get left(): number {
    return this.x - this.w / 2;
  }
  get right(): number {
    return this.x + this.w / 2;
  }
  get top(): number {
    return this.anchor === 'bottom' ? this.y - this.h : this.y - this.h / 2;
  }
  get bottom(): number {
    return this.anchor === 'bottom' ? this.y : this.y + this.h / 2;
  }
  /** Center x/y. */
  get cx(): number {
    return this.x;
  }
  get cy(): number {
    return this.anchor === 'bottom' ? this.y - this.h / 2 : this.y;
  }
  get alive(): boolean {
    return !this.dead && this.hp > 0;
  }

  /** Hitbox (returns a shared object - copy it if you need to keep it). */
  get box(): Rect {
    const b = this._box;
    b.x = this.x - this.w / 2;
    b.y = this.top;
    b.w = this.w;
    b.h = this.h;
    return b;
  }

  /** Damageable regions. Override for odd shapes (default: the hitbox). */
  hurtboxes(): Rect[] {
    return [this.box];
  }

  /** Called after being added to the world. */
  spawned(): void {}

  update(_dt: number): void {}

  /** Draw in world coordinates (camera transform already applied). */
  render(_g: CanvasRenderingContext2D): void {}

  /**
   * Apply damage. Returns true if the hit "connected" (used by projectiles to decide whether
   * to stop). Handles flash, hp, scoring and calls die() once when hp reaches 0.
   */
  damage(d: Damage): boolean {
    if (this.dead || !this.hittable) return false;
    if (this.invuln > 0) return true; // absorbs the hit but takes no damage
    this.hp -= d.amount;
    this.flash = 0.07;
    this.onDamaged(d);
    if (this.hp <= 0) {
      this.hp = 0;
      this.hittable = false;
      this.world?.onKilled(this, d);
      this.die(d);
    }
    return true;
  }

  /** Hook: took damage but may still be alive. */
  onDamaged(_d: Damage): void {}

  /** Hook: hp reached 0 (or killed by script). Default removes immediately. */
  die(_d?: Damage): void {
    this.dead = true;
  }

  /** Remove without dying (despawn). */
  remove(): void {
    this.dead = true;
  }

  /** Is the hitbox within the camera view (+margin)? */
  onScreen(margin = 0): boolean {
    const c = this.world.camera;
    return this.right > c.x - margin && this.left < c.x + VIEW_W + margin && this.bottom > c.y - margin && this.top < c.y + VIEW_H + margin;
  }

  distanceTo(e: Entity): number {
    return Math.hypot(e.cx - this.cx, e.cy - this.cy);
  }
}

/** An entity with platformer physics against the terrain. */
export abstract class Actor extends Entity {
  onGround = false;
  groundSurface: Surface | null = null;
  groundSolid: Solid | null = null;
  gravityScale = 1;
  maxFall = MAX_FALL;
  /** Max height it can walk up onto (slopes/steps). */
  stepUp = 6;
  /** Max height it sticks to when walking down. */
  stepDown = 8;
  /** A fall that meets a ledge at most this far above the feet lands on it (see hopOnto). */
  ledgeAssist = 6;
  collideTerrain = true;
  /** Set to true to stop at ledges (AI helper reads this). */
  hitWall: -1 | 0 | 1 = 0;
  hitCeiling = false;
  /** Landed this step. */
  landed = false;
  /** Vertical speed at the moment of landing. */
  landVy = 0;
  inWater: Water | null = null;
  private dropTimer = 0;
  private dropSurface: Surface | null = null;

  /** Standing on a one-way platform? */
  get onPlatform(): boolean {
    return this.onGround && !!this.groundSurface && this.groundSurface.oneWay;
  }

  /** Start dropping through the one-way platform underfoot. Returns false if not possible. */
  dropThrough(): boolean {
    if (!this.onPlatform) return false;
    this.dropSurface = this.groundSurface;
    this.dropTimer = 0.3;
    this.onGround = false;
    this.groundSurface = null;
    this.groundSolid = null;
    this.y += 1;
    this.vy = Math.max(this.vy, 40);
    return true;
  }

  /** Leave the ground with an upward speed (positive number). */
  jump(speed: number): void {
    this.vy = -Math.abs(speed);
    this.onGround = false;
    this.groundSurface = null;
    this.groundSolid = null;
  }

  /** Called when falling below the level. Default: remove. */
  onFallOut(): void {
    this.remove();
  }

  /**
   * Does the body standing at feet (x, y) overlap solid terrain: a solid box (other than its own)
   * or the ground mass (with slope tolerance at the edges)?
   */
  bodyBlocked(x = this.x, y = this.y): boolean {
    const T = this.world.terrain;
    const hw = this.w / 2;
    if (T.solidOverlap({ x: x - hw + 0.5, y: y - this.h + 0.5, w: this.w - 1, h: this.h - 1.5 }, this)) return true;
    if (T.groundTopAt(x) < y - this.stepUp) return true;
    const edgeTol = Math.max(this.stepUp, hw + 2);
    return T.groundTopAt(x - hw + 0.5) < y - edgeTol || T.groundTopAt(x + hw - 0.5) < y - edgeTol;
  }

  /**
   * Shoved sideways (direction `dir`) into terrain by something that ignores walls, e.g. the
   * scrolling screen edge: step up onto the obstacle when its top is at most `maxUp` px above the
   * feet and there is room on it. Returns false when it is too high or there is no room.
   */
  climbOnto(dir: number, maxUp: number): boolean {
    const T = this.world.terrain;
    const hw = this.w / 2;
    for (let dx = 0; dx <= hw + 2; dx++) {
      const nx = this.x + dir * dx;
      const f = T.floorAt(nx, this.y - maxUp, this.y - 1, { noOneWay: true });
      if (!f || this.bodyBlocked(nx, f.y)) continue;
      this.x = nx;
      this.y = f.y;
      this.vy = 0;
      this.onGround = true;
      this.groundSurface = f.surface;
      this.groundSolid = f.solid;
      return true;
    }
    return false;
  }

  /**
   * Ledge assist: falling against the side of a ledge (cliff top or box) whose top is at most
   * `ledgeAssist` px above the feet lands on it instead, the centre nudged just onto it.
   */
  private hopOnto(dir: number, nx: number, top: number): boolean {
    const T = this.world.terrain;
    for (let i = 0; i <= this.w / 2 + 1; i++) {
      const cx = nx + dir * i;
      const f = T.floorAt(cx, top - 0.5, top + 2, { noOneWay: true });
      if (!f || this.bodyBlocked(cx, f.y)) continue;
      this.x = cx;
      this.y = f.y;
      this.landVy = this.vy;
      this.vy = 0;
      this.onGround = true;
      this.landed = true;
      this.groundSurface = f.surface;
      this.groundSolid = f.solid;
      return true;
    }
    return false;
  }

  /** Is there floor ahead at distance `ahead` in direction dir (for ledge-aware AI)? */
  floorAhead(dir: number, ahead = 10, maxDrop = 24): boolean {
    const T = this.world.terrain;
    const x = this.x + dir * (this.w / 2 + ahead);
    return !!T.floorAt(x, this.y - this.stepUp - 2, this.y + maxDrop, { solidTolerance: 0 });
  }

  /** Integrate velocity and resolve against terrain. Call from update(). */
  moveAndCollide(dt: number): void {
    const T = this.world.terrain;
    this.landed = false;
    this.hitWall = 0;
    this.hitCeiling = false;
    if (this.dropTimer > 0) {
      this.dropTimer -= dt;
      if (this.dropTimer <= 0) this.dropSurface = null;
    }
    if (!this.collideTerrain) {
      this.vy = Math.min(this.vy + GRAVITY * this.gravityScale * dt, this.maxFall);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }
    // Ride moving ground.
    if (this.onGround) {
      const gd = this.groundSurface ?? this.groundSolid;
      if (gd && gd.dynamic) {
        this.x += gd.dx;
        this.y += gd.dy;
      }
    }
    if (!this.onGround) this.vy = Math.min(this.vy + GRAVITY * this.gravityScale * dt, this.maxFall);

    // ---- Horizontal
    const hw = this.w / 2;
    if (this.vx !== 0) {
      let nx = this.x + this.vx * dt;
      const dir = this.vx > 0 ? 1 : -1;
      // Ground mass (cliffs in the ground polyline).
      const lead = nx + dir * hw;
      const gy = T.groundTopAt(lead);
      const tol = this.onGround ? this.stepUp : 2;
      if (gy < this.y - tol && !this.onGround && this.vy >= 0 && gy >= this.y - this.ledgeAssist && this.hopOnto(dir, nx, gy)) {
        // Ledge assist: a jump that comes down with the feet just below the far ledge lands on it.
        nx = this.x;
      } else if (gy < this.y - tol) {
        // Slide up to the cliff face instead of stopping short.
        let ok = this.x;
        const steps = Math.ceil(Math.abs(nx - this.x));
        for (let i = 1; i <= steps; i++) {
          const tx = this.x + dir * Math.min(i, Math.abs(nx - this.x));
          if (T.groundTopAt(tx + dir * hw) < this.y - tol) break;
          ok = tx;
        }
        nx = ok;
        this.hitWall = dir;
        this.vx = 0;
      }
      const r = { x: nx - hw, y: this.y - this.h, w: this.w, h: this.h - 0.5 };
      const s = T.solidOverlap(r, this);
      if (s) {
        const canStep = this.onGround && s.y >= this.y - this.stepUp && !T.solidOverlap({ x: nx - hw, y: s.y - this.h, w: this.w, h: this.h - 0.5 }, this);
        if (canStep) {
          this.y = s.y;
          this.groundSolid = s;
          this.groundSurface = null;
        } else if (!this.onGround && this.vy >= 0 && s.y >= this.y - this.ledgeAssist && this.hopOnto(dir, nx, s.y)) {
          nx = this.x;
        } else if ((this.x < s.x + s.w / 2 ? -1 : 1) === dir) {
          // Already past the middle of the box, moving away from it (walking or falling off its far
          // edge clips the top corner): slide out on that side instead of being thrown back across.
          nx = dir > 0 ? Math.max(nx, s.x + s.w + hw + 0.01) : Math.min(nx, s.x - hw - 0.01);
        } else {
          nx = dir > 0 ? s.x - hw - 0.01 : s.x + s.w + hw + 0.01;
          // Never get pushed backwards through other geometry because of the clamp.
          if ((dir > 0 && nx < this.x) || (dir < 0 && nx > this.x)) {
            if (!T.solidOverlap({ x: this.x - hw, y: this.y - this.h, w: this.w, h: this.h - 0.5 }, this)) nx = this.x;
          }
          this.hitWall = dir;
          this.vx = 0;
        }
      }
      this.x = nx;
    }

    // ---- Vertical
    if (this.onGround) {
      if (this.vy >= 0) {
        const hit = T.floorAt(this.x, this.y - this.stepUp, this.y + this.stepDown, { ignore: this.dropSurface });
        if (hit) {
          this.y = hit.y;
          this.vy = 0;
          this.groundSurface = hit.surface;
          this.groundSolid = hit.solid;
        } else {
          this.onGround = false;
          this.groundSurface = null;
          this.groundSolid = null;
        }
      } else {
        this.onGround = false;
        this.groundSurface = null;
        this.groundSolid = null;
      }
    }
    if (!this.onGround) {
      const ny = this.y + this.vy * dt;
      if (this.vy >= 0) {
        const hit = T.floorAt(this.x, this.y - 2, ny, { ignore: this.dropSurface, solidTolerance: 10 });
        if (hit) {
          this.landVy = this.vy;
          this.y = hit.y;
          this.vy = 0;
          this.onGround = true;
          this.landed = true;
          this.groundSurface = hit.surface;
          this.groundSolid = hit.solid;
        } else {
          this.y = ny;
        }
      } else {
        const r = { x: this.x - hw + 0.5, y: ny - this.h, w: this.w - 1, h: this.h - 1 };
        const s = T.solidOverlap(r, this);
        if (s && s.y + s.h <= this.y - this.h + 1) {
          this.y = s.y + s.h + this.h;
          this.vy = 0;
          this.hitCeiling = true;
        } else {
          this.y = ny;
        }
      }
    }
    this.unstickSides();
    this.inWater = T.waterAt(this.x, this.y - 2);
    if (this.y - this.h > T.killY) this.onFallOut();
  }

  /**
   * Stepping off the edge of a box (or of a cliff top) and stopping, or dropping in right beside
   * one, leaves the body hanging into its side by up to half its width: the horizontal pass only
   * resolves walls while moving. Slide out to the side the centre is on.
   */
  private unstickSides(): void {
    const T = this.world.terrain;
    const hw = this.w / 2;
    const s = T.solidOverlap({ x: this.x - hw + 0.5, y: this.y - this.h + 0.5, w: this.w - 1, h: this.h - 1.5 }, this);
    if (s) {
      const inside = this.x >= s.x && this.x < s.x + s.w;
      // A centre inside a static box is level geometry we cannot judge; a moving one (press head,
      // cable car) that ran into us shoves us out to its nearer side.
      if (inside && !(s.dynamic && (s.dx !== 0 || s.dy !== 0))) return;
      const left = inside ? this.x - s.x < s.x + s.w - this.x : this.x < s.x;
      const nx = left ? s.x - hw : s.x + s.w + hw;
      if (!this.bodyBlocked(nx, this.y)) this.x = nx;
      return;
    }
    // Ground mass: stepping off a cliff top leaves an infantry-sized body hanging into the cliff
    // face (vehicles are wide enough to straddle slopes, leave them be).
    if (hw > 8 || T.groundTopAt(this.x) < this.y - this.stepUp) return;
    const tol = 2 * hw;
    const lBuried = T.groundTopAt(this.x - hw + 0.5) < this.y - tol;
    const rBuried = T.groundTopAt(this.x + hw - 0.5) < this.y - tol;
    if (lBuried === rBuried) return;
    const dir = lBuried ? 1 : -1;
    for (let d = 1; d <= hw; d++) {
      const nx = this.x + dir * d;
      if (!this.bodyBlocked(nx, this.y)) {
        this.x = nx;
        return;
      }
    }
  }
}
