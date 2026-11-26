// Rifleman: the Rustcoat Legion's basic infantry. REFERENCE IMPLEMENTATION for enemy modules:
//  - art via defineSoldier() (humanoid rig) with standard SF.* frames
//  - behaviour as a small state machine (shared calm/alert/panic states live in Infantry)
//  - registered with registerEntity() so levels can spawn { type: 'rifleman', x, props }
// props: behavior: 'patrol' | 'guard' | 'charge' | 'idle' | 'sleep' | 'chat' (default 'patrol'),
//        facing: 1|-1, drop: pickup spec

import { defineSoldier, RUSTCOAT, SF } from '../../art/soldier';
import { registerEntity } from '../../game/registry';
import { Infantry } from './infantry';

defineSoldier('rifleman', RUSTCOAT, 'rifle');

export class Rifleman extends Infantry {
  burst = 0;
  crouchShot = false;

  constructor(props: Record<string, any> = {}, sprite = 'rifleman') {
    super(sprite, props);
    this.scoreValue = 100;
  }

  combat(dt: number): void {
    const t = this.target();
    switch (this.state) {
      case 'engage': {
        if (!t) {
          this.setState('patrol');
          break;
        }
        this.faceTarget(t);
        if (this.checkPanic(dt)) break;
        const dx = Math.abs(t.x - this.x);
        let move = 0;
        if (dx > 170) move = this.facing;
        else if (dx < 56 && this.floorAhead(-this.facing)) move = -this.facing;
        if (move !== 0 && !this.floorAhead(move)) move = 0;
        this.vx = move * (this.behavior === 'charge' && dx > 120 ? 70 : 34);
        this.attackTimer -= dt;
        if (this.attackTimer <= 0 && this.canAttack()) {
          this.crouchShot = this.world.rng.chance(0.3);
          this.burst = this.world.rng.chance(0.3 * this.world.difficulty.aggression) ? 2 : 1;
          this.setState('aim');
        }
        break;
      }
      case 'aim':
        this.vx = 0;
        this.faceTarget(t);
        if (this.stateTime > 0.32) {
          this.fire();
          this.setState('fire');
        }
        break;
      case 'fire':
        this.vx = 0;
        if (this.stateTime > 0.18) {
          if (--this.burst > 0 && this.canAttack()) {
            this.fire();
            this.stateTime = 0;
          } else {
            this.attackTimer = this.fireDelay(1.7);
            this.setState('engage');
          }
        }
        break;
      default:
        this.setState('engage');
    }
  }

  protected fire(): void {
    const mx = this.x + this.facing * 16;
    const my = this.y - (this.crouchShot ? 16 : 21);
    const t = this.target();
    // Rifle shots fly straight (slight vertical aim only toward targets roughly level).
    let angle = this.facing > 0 ? 0 : Math.PI;
    if (t) {
      const dy = t.cy - my;
      const dx = Math.abs(t.cx - mx);
      if (Math.abs(dy) < dx * 0.6) angle = Math.atan2(dy, t.cx - mx);
    }
    this.shoot(mx, my, { angle, speed: 150 });
    this.world.effect('muzzle_flash', mx, my, { fps: 30, flip: this.facing < 0 });
    this.world.sfx('enemy_rifle', this.x, { vol: 0.6 });
  }

  override aliveFrame(): number {
    switch (this.state) {
      case 'aim':
        return this.crouchShot ? SF.CROUCH_AIM : SF.AIM;
      case 'fire':
        return this.crouchShot ? (this.stateTime < 0.08 ? SF.CROUCH_FIRE : SF.CROUCH_AIM) : this.stateTime < 0.08 ? SF.FIRE : SF.AIM;
    }
    return super.aliveFrame();
  }
}

registerEntity(
  'rifleman',
  'enemy',
  (_w, s) => new Rifleman(s.props),
  'Basic rifle infantry: patrols, notices you ("!"), shoots slow straight bullets (sometimes crouched, sometimes 2-round bursts), panics near heavy weapons. props.behavior: patrol|guard|idle|sleep|chat|charge, facing, drop',
);
