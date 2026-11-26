// Rifleman: the Rustcoat Legion's basic infantry. REFERENCE IMPLEMENTATION for enemy modules:
//  - art via defineSoldier() (humanoid rig) with standard SF.* frames
//  - behaviour as a small state machine in think()
//  - registered with registerEntity() so levels can spawn { type: 'rifleman', x, props }
// props: behavior: 'patrol' | 'guard' | 'charge' | 'idle' (default 'patrol'), facing: 1|-1, drop: pickup spec

import { sprites } from '../../engine/sprites';
import { defineSoldier, RUSTCOAT, SF } from '../../art/soldier';
import { Enemy } from '../../game/enemy';
import { registerEntity } from '../../game/registry';
import { fxRng } from '../../engine/rng';

defineSoldier('rifleman', RUSTCOAT, 'rifle');

export class Rifleman extends Enemy {
  behavior: string;
  homeX = 0;
  fireTimer = 0;
  burst = 0;
  crouchShot = false;
  walkPhase = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.w = 12;
    this.h = 26;
    this.hp = this.maxHp = 1;
    this.scoreValue = 100;
    this.meleeable = true;
    this.behavior = props.behavior ?? 'patrol';
  }

  override spawned(): void {
    super.spawned();
    this.homeX = this.x;
    this.fireTimer = this.fireDelay(0.9);
    this.setState(this.behavior === 'charge' ? 'engage' : this.behavior === 'idle' ? 'idle' : this.behavior === 'guard' ? 'idle' : 'patrol');
  }

  private notices(): boolean {
    const t = this.target(260);
    if (!t) return false;
    return Math.abs(t.x - this.x) < 220 && Math.abs(t.y - this.y) < 90 && this.onScreen(-10);
  }

  think(dt: number): void {
    const t = this.target();
    switch (this.state) {
      case 'idle':
        this.vx = 0;
        if (this.notices()) this.setState('alert');
        break;
      case 'patrol': {
        const dir = Math.sin(this.age * 0.9 + this.id) > 0 ? 1 : -1;
        this.facing = dir;
        this.vx = this.floorAhead(dir) && Math.abs(this.x + dir * 2 - this.homeX) < 48 ? dir * 22 : 0;
        if (this.notices()) this.setState('alert');
        break;
      }
      case 'alert':
        this.vx = 0;
        this.faceTarget(t);
        if (this.stateTime > 0.35) this.setState('engage');
        break;
      case 'engage': {
        if (!t) {
          this.setState('patrol');
          break;
        }
        this.faceTarget(t);
        const dx = Math.abs(t.x - this.x);
        let move = 0;
        if (dx > 170) move = this.facing;
        else if (dx < 56 && this.floorAhead(-this.facing)) move = -this.facing;
        if (move !== 0 && !this.floorAhead(move)) move = 0;
        this.vx = move * (this.behavior === 'charge' && dx > 120 ? 70 : 34);
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && this.canAttack()) {
          this.crouchShot = fxRng.chance(0.3);
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
          if (--this.burst > 0) {
            this.fire();
            this.stateTime = 0;
          } else {
            this.fireTimer = this.fireDelay(1.7);
            this.setState('engage');
          }
        }
        break;
    }
    this.moveAndCollide(dt);
    if (this.vx !== 0) this.walkPhase += dt * 10;
  }

  private fire(): void {
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

  override render(g: CanvasRenderingContext2D): void {
    if (this.deathBlinkHidden) return;
    const s = sprites.get('rifleman');
    let f: number = SF.IDLE;
    if (this.dying) {
      if (this.deathKind === 'fire') f = SF.BURNT;
      else if (this.deathTime < 0.12) f = SF.DIE;
      else if (!this.onGround) f = this.vy < 0 ? SF.DIE + 1 : SF.DIE + 2;
      else f = this.deathTime < 0.7 ? SF.DIE + 3 : SF.DIE + 4;
    } else {
      switch (this.state) {
        case 'alert':
          f = SF.ALERT;
          break;
        case 'aim':
          f = this.crouchShot ? SF.CROUCH_AIM : SF.AIM;
          break;
        case 'fire':
          f = this.crouchShot ? (this.stateTime < 0.08 ? SF.CROUCH_FIRE : SF.CROUCH_AIM) : this.stateTime < 0.08 ? SF.FIRE : SF.AIM;
          break;
        case 'idle':
          f = this.behavior === 'idle' ? SF.FIDGET + (Math.floor(this.age * 1.5) % 2) : SF.IDLE + (Math.floor(this.age * 2) % 2);
          break;
        default:
          f = this.vx !== 0 ? SF.WALK + (Math.floor(this.walkPhase) % SF.WALK_N) : SF.IDLE + (Math.floor(this.age * 2) % 2);
      }
    }
    s.draw(g, this.x, this.y, f, { flip: this.facing < 0, flash: this.flash > 0 });
  }
}

registerEntity('rifleman', 'enemy', (_w, s) => new Rifleman(s.props), 'Basic rifle infantry. props.behavior: patrol|guard|charge|idle');
