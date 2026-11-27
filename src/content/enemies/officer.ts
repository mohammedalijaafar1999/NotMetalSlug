// Officer: a pompous Legion officer (peaked cap, sash, epaulettes, white gloves). When he spots you
// he blows his whistle: every Legion soldier within ~240 px wakes up, engages at once and fires
// faster for a while (rally). He points the charge, takes potshots with his pistol from behind his
// men and re-whistles now and then. 3 HP. Hurt, he panics and runs holding his cap; left alone, he
// whistles for help... then flees off-screen for good (taking his 500 points and his drop with him).
// props: behavior: guard (default) | patrol | idle | sleep | chat, facing,
//        drop (default 'points' = a random score item; 'none' for nothing), rally: radius px (default 240)

import { fxRng } from '../../engine/rng';
import { VIEW_W } from '../../engine/renderer';
import { defineSoldier, RUSTCOAT, SF, styleVariant, poseHand, poseShoulder } from '../../art/soldier';
import type { HumanPose } from '../../art/humanoid';
import type { Damage } from '../../game/constants';
import type { Entity } from '../../game/entity';
import { Enemy } from '../../game/enemy';
import { registerEntity } from '../../game/registry';
import { BUBBLE, Infantry } from './infantry';
import { MortarCrew } from './mortar';
import { uprightFrame } from './gear';

export const OFFICER_STYLE = styleVariant(RUSTCOAT, {
  skin: '#f0c4a0',
  hair: '#6a6a6a',
  shirt: '#6a2a26',
  pants: '#2e2a32',
  boots: '#1c161a',
  belt: '#1c161a',
  vest: undefined,
  strap: '#e0b030',
  gloves: '#ece4d4',
  headgear: 'officer',
  headgearColor: '#5e2622',
  headgearAccent: '#c8302a',
  mustache: '#d8d0c0',
  build: 1.1,
  gunColor: '#2a2a30',
});

defineSoldier('officer', OFFICER_STYLE, 'pistol', {
  throwItem: 'none',
  pose: (f, pose): HumanPose => {
    if (!uprightFrame(f)) return pose;
    // Hands clasped behind the back (idle), one hand behind while strutting.
    if (f < SF.WALK) return { ...pose, gun: 'none', handF: [-2.5, 7], handB: [-4, 7.5], lean: -0.5 };
    if (f < SF.AIM) {
      const s = Math.sin(((f - SF.WALK) / SF.WALK_N) * Math.PI * 2);
      return { ...pose, gun: 'none', handF: [1.5 - s * 3, 8], handB: [-4, 7], lean: -0.5 };
    }
    if (f === SF.THROW) return { ...pose, gun: 'none', handF: [4.5, -3.5], handB: [-3, 7], expr: 'shout', headDy: -0.5 };
    if (f === SF.THROW + 1) return { ...pose, gun: 'none', handF: [10, -5], handB: [-3, 7], lean: 1, expr: 'shout' };
    if (f === SF.PANIC || f === SF.PANIC + 1) return { ...pose, handF: [2, -11], handB: [-5, -5 + (f - SF.PANIC) * 3], lean: 1.5 };
    return pose;
  },
  decorate: (p, f, pose) => {
    if (!uprightFrame(f)) return;
    const [sx, sy] = poseShoulder(pose);
    // Gold epaulette and medals.
    p.rect(sx - 1, sy - 0.5, 4, 1.5, '#f0c040');
    p.px(sx + 2, sy + 1, '#f0c040');
    if (f < SF.SLEEP) {
      p.px(sx + 2, sy + 4, '#c8302a');
      p.px(sx + 3, sy + 4, '#3a6ad8');
      p.px(sx + 2, sy + 5, '#f0c040');
      p.px(sx + 3, sy + 5, '#f0c040');
    }
    if (f === SF.THROW) {
      // Brass whistle at the lips.
      const [hx, hy] = poseHand(pose, 'F');
      p.rect(hx + 1, hy - 1.5, 3, 1.5, '#e8c040');
      p.px(hx + 3, hy - 1.5, '#fff6c0');
    }
  },
});

export class Officer extends Infantry {
  rally: number;
  private whistleCd = 0;
  private fleeing = false;
  private offscreen = 0;
  private hurtFrom: Entity | null = null;
  private rallied = false;
  private calledForHelp = false;

  constructor(props: Record<string, any> = {}) {
    super('officer', { behavior: 'guard', ...props });
    this.hp = this.maxHp = 3;
    this.scoreValue = 500;
    this.firstAttack = 1.2;
    this.alertDelay = 0.25;
    this.panicProne = 0;
    this.sightRange = 240;
    this.rally = props.rally ?? 240;
    this.deathSfx = 'enemy_die2';
  }

  override spawned(): void {
    super.spawned();
    if (this.props.drop === undefined) this.props.drop = 'points';
    else if (this.props.drop === 'none' || this.props.drop === null) this.props.drop = undefined;
  }

  /** Legion foot soldiers near enough to rally (infantry and mortar crews; never machines). */
  private troops(): Enemy[] {
    return this.alliesNear(this.rally).filter((e) => (e instanceof Infantry || e instanceof MortarCrew) && !(e instanceof Officer));
  }

  override onDamaged(d: Damage): void {
    if (this.hp > 0 && !this.dying) {
      this.hurtFrom = (d.owner as Entity) ?? null;
      this.say(BUBBLE.SWEAT, { life: 0.5, rise: 12, dx: -this.facing * 6 });
      this.startPanic();
    }
  }

  private startPanic(): void {
    if (this.state === 'flee') return;
    const t = this.hurtFrom ?? this.target();
    this.panicDir = t ? (t.x < this.x ? 1 : -1) : ((-this.facing) as 1 | -1);
    this.setState('flee');
    this.sfx('enemy_alert', { vol: 0.6, pitch: 1.5, gap: 0.2 });
  }

  override notice(big = false): void {
    super.notice(big);
  }

  combat(dt: number): void {
    const t = this.target();
    if (this.whistleCd > 0) this.whistleCd -= dt;
    switch (this.state) {
      case 'engage': {
        if (!t) {
          this.setState('idle');
          break;
        }
        this.faceTarget(t);
        const troops = this.troops();
        if (!this.rallied || (this.whistleCd <= 0 && troops.length > 0 && this.canAttack())) {
          this.setState('whistle');
          break;
        }
        if (troops.length === 0 && this.rallied) {
          // Alone! Whistle once more for help... then run for it.
          if (!this.calledForHelp) {
            this.calledForHelp = true;
            this.setState('whistle');
          } else {
            this.fleeing = true;
            this.startPanic();
          }
          break;
        }
        // Stay behind the men.
        const dx = Math.abs(t.x - this.x);
        let move = 0;
        if (dx > 190) move = this.facing;
        else if (dx < 110) move = -this.facing;
        if (move !== 0 && !this.floorAhead(move)) move = 0;
        this.vx = move * 28;
        this.attackTimer -= dt;
        if (this.attackTimer <= 0 && this.canAttack()) this.setState('aim');
        break;
      }
      case 'whistle':
        this.vx = 0;
        if (this.stateTime < dt * 1.5) {
          this.world.sfx('whistle', this.x, { vol: 0.8 });
          this.say(BUBBLE.NOTE, { life: 0.9, rise: 10, dx: this.facing * 9, dy: 4 });
        }
        if (this.stateTime > 0.3 && this.stateTime - dt <= 0.3) {
          this.say(BUBBLE.NOTE, { life: 0.8, rise: 12, dx: this.facing * 14, dy: 0 });
          for (const e of this.troops()) {
            e.alert(this);
            e.buff(7);
          }
          this.rallied = true;
          this.whistleCd = this.world.rng.range(6, 9);
        }
        if (this.stateTime > 0.7) {
          if (this.troops().length === 0 && this.calledForHelp) {
            this.say(BUBBLE.QUESTION, { life: 0.7 });
            this.setState('dismay');
          } else this.setState('point');
        }
        break;
      case 'dismay':
        this.vx = 0;
        if (this.stateTime > 0.7) {
          this.fleeing = true;
          this.startPanic();
        }
        break;
      case 'point':
        // "CHARGE!"
        this.vx = 0;
        if (this.stateTime > 0.5) this.setState('engage');
        break;
      case 'aim':
        this.vx = 0;
        this.faceTarget(t);
        if (this.stateTime > 0.42) {
          this.fire();
          this.setState('fire');
        }
        break;
      case 'fire':
        this.vx = 0;
        if (this.stateTime > 0.25) {
          this.attackTimer = this.fireDelay(2.4);
          this.setState('engage');
        }
        break;
      case 'flee':
        this.flee(dt);
        break;
      default:
        this.setState('engage');
    }
  }

  private flee(dt: number): void {
    const dir = this.panicDir;
    this.facing = dir;
    const cam = this.world.camera;
    if (this.onGround && this.hitWall === dir) this.jump(260);
    this.vx = dir * 92;
    if (fxRng.chance(dt * 4)) this.say(BUBBLE.SWEAT, { life: 0.4, rise: 14, dx: -dir * 6, dy: 6 });
    if (!this.fleeing) {
      // Hurt but not alone: regain composure after a moment.
      const nx = this.x + dir * 14;
      if (nx < cam.x + 10 || nx > cam.x + VIEW_W - 10 || !this.floorAhead(dir)) this.vx = 0;
      if (this.stateTime > 1.4) {
        this.faceTarget();
        this.attackTimer = Math.min(this.attackTimer, 0.6);
        this.setState('engage');
      }
      return;
    }
    // Escaping for good.
    this.blocksProgress = false;
    if (!this.onScreen(0)) {
      this.offscreen += dt;
      if (this.offscreen > 0.8) this.remove();
    } else this.offscreen = 0;
  }

  private fire(): void {
    const t = this.target();
    const mx = this.x + this.facing * 13;
    const my = this.y - 21;
    let angle = this.facing > 0 ? 0 : Math.PI;
    if (t) {
      const dy = t.cy - my;
      const dx = Math.abs(t.cx - mx);
      if (Math.abs(dy) < dx * 0.7) angle = Math.atan2(dy, t.cx - mx);
    }
    this.shoot(mx, my, { angle, speed: 150 });
    this.world.effect('muzzle_flash', mx, my, { fps: 30, flip: this.facing < 0 });
    this.world.sfx('enemy_rifle', this.x, { vol: 0.5, pitch: 1.3 });
  }

  override aliveFrame(): number {
    switch (this.state) {
      case 'whistle':
        return SF.THROW;
      case 'point':
        return SF.THROW + 1;
      case 'dismay':
        return SF.FIDGET + (Math.floor(this.stateTime * 6) % 2);
      case 'aim':
        return SF.AIM;
      case 'fire':
        return this.stateTime < 0.08 ? SF.FIRE : SF.AIM;
      case 'flee':
        return this.vx !== 0 ? SF.PANIC + (Math.floor(this.age * 12) % 2) : SF.COWER + (Math.floor(this.age * 9) % 2);
    }
    return super.aliveFrame();
  }
}

registerEntity(
  'officer',
  'enemy',
  (_w, s) => new Officer(s.props),
  'Officer (500 pts, 3 HP): whistles to rally troops within ~240 px (they wake, engage and fire faster), points the charge, shoots a pistol; panics when hurt and flees off-screen when left alone. props.drop (default random score item, "none"), rally, behavior (default guard), facing',
);
