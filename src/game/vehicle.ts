// Player vehicles base class (tank, mech, gyrocopter...). A vehicle stands empty until a player
// enters it (press DOWN while overlapping, or drop onto its hatch). While driven it is the target
// enemies shoot at; it has an HP gauge. Press JUMP while holding DOWN to eject. When destroyed the
// pilot is thrown clear and the wreck explodes, damaging nearby enemies.

import type { ActionState } from '../engine/input';
import type { Rect } from '../engine/math';
import { Actor } from './entity';
import { Z, type Damage } from './constants';
import type { Player } from './player';

export abstract class Vehicle extends Actor {
  readonly isVehicle = true;
  driver: Player | null = null;
  vehicleName = 'VEHICLE';
  /** Can a player get in right now? */
  canBeEntered = true;
  destroyed = false;
  destroyTimer = 0;
  /** Secondary ammo (cannon shells / missiles) shown on the HUD; -1 hides it. */
  secondaryAmmo = -1;
  /** Seconds after eject before the same vehicle can be entered again. */
  private reenter = 0;

  constructor() {
    super();
    this.team = 'neutral';
    this.hittable = false;
    this.persistent = true;
    this.z = Z.VEHICLE;
    this.hp = this.maxHp = 60;
  }

  /** Area a player must overlap to get in. */
  entryBox(): Rect {
    const b = this.box;
    return { x: b.x + 2, y: b.y - 6, w: b.w - 4, h: b.h + 4 };
  }

  enter(p: Player): void {
    if (this.driver || this.destroyed || this.reenter > 0) return;
    this.driver = p;
    p.enterVehicle(this);
    this.team = 'player';
    this.hittable = true;
    this.facing = p.facing;
    this.world.invalidateTargets();
    this.world.sfx('vehicle_enter', this.x);
    this.onEnter(p);
  }

  /** Called by Player.exitVehicle. */
  onDriverExit(_p: Player): void {
    this.team = 'neutral';
    this.hittable = false;
    this.reenter = 0.6;
    this.world.invalidateTargets();
  }

  onEnter(_p: Player): void {}

  /** Driven update: read input, move, fire. Call moveAndCollide yourself. */
  abstract drive(inp: ActionState, dt: number): void;

  /** Empty update (default: sit still under gravity). */
  idle(dt: number): void {
    this.vx = 0;
    this.moveAndCollide(dt);
  }

  override update(dt: number): void {
    if (this.reenter > 0) this.reenter -= dt;
    if (this.destroyed) {
      this.destroyTimer += dt;
      this.vx *= 0.9;
      this.moveAndCollide(dt);
      if (this.destroyTimer > 0.9) this.explodeWreck();
      return;
    }
    const d = this.driver;
    if (d) {
      const inp = d.inp;
      if (inp.held('down') && inp.pressed('jump')) {
        d.exitVehicle(true);
        this.idle(dt);
        return;
      }
      this.drive(inp, dt);
    } else {
      this.idle(dt);
    }
  }

  override damage(d: Damage): boolean {
    if (!this.driver || this.destroyed) return false;
    if (d.amount <= 0) return true;
    this.hp -= d.amount;
    this.flash = 0.08;
    this.world.sfx('vehicle_hit', this.x, { vol: 0.6 });
    if (this.hp <= 0) {
      this.hp = 0;
      this.startDestruction();
    }
    return true;
  }

  /** Repair (fuel can pickup). */
  repair(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  startDestruction(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.destroyTimer = 0;
    this.hittable = false;
    const d = this.driver;
    if (d) {
      d.exitVehicle(true);
      d.invuln = Math.max(d.invuln, 1.6);
    }
    this.team = 'neutral';
    this.world.invalidateTargets();
    this.world.sfx('alarm', this.x);
  }

  protected explodeWreck(): void {
    this.world.explode(this.cx, this.cy, { radius: 46, damage: 20, team: 'player', owner: null, size: 'huge', shake: 6 });
    this.world.particles.debris(this.cx, this.cy, 20, ['#4a5a3a', '#2a2a2a', '#7a7a6a'], 260);
    this.onWrecked();
    this.remove();
  }

  /** Hook after the wreck explodes. */
  onWrecked(): void {}

  /** Blink while about to explode. */
  protected get warningBlink(): boolean {
    return this.destroyed && Math.floor(this.destroyTimer * 14) % 2 === 0;
  }
}
