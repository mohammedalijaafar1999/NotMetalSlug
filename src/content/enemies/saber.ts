// Saber trooper: a swaggering swordsman who charges at you (jumping small gaps), raises his
// cutlass (wind-up + blade glint) and slashes. His blade only hurts during the slash itself.
// Sometimes he crouches and leaps in with a flying slash (also telegraphed).
// props: behavior: patrol|guard|idle|sleep|chat|charge (default patrol), facing, drop,
//        leap: allow leaping slashes (default true)

import { sprites } from '../../engine/sprites';
import { defineSoldier, RUSTCOAT, SF, styleVariant, poseHand } from '../../art/soldier';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import type { Rect } from '../../engine/math';
import { Infantry } from './infantry';
import { uprightFrame } from './gear';

export const SABER_STYLE = styleVariant(RUSTCOAT, {
  skin: '#d89a6a',
  hair: '#1e1410',
  hairStyle: 'ponytail',
  shirt: '#d8c49a',
  vest: '#7e1e1c',
  pants: '#3e3a4a',
  boots: '#2a201a',
  belt: '#c89a32',
  headgear: 'bandana',
  headgearColor: '#9a2420',
  headgearAccent: '#d84a32',
  mustache: '#1e1410',
  sleeves: 'short',
  build: 0.95,
});

/** Blade angle per frame (radians, 0 = forward, negative = up). null = no saber in hand. */
function bladeAngle(f: number): number | null {
  if (f < SF.WALK) return 0.75;
  if (f < SF.AIM) return -0.95;
  switch (f) {
    case SF.AIM:
      return -0.35;
    case SF.FIRE:
      return 0.2;
    case SF.CROUCH_AIM:
      return 1.15;
    case SF.CROUCH_FIRE:
      return -2.2;
    case SF.THROW:
      return -2.5;
    case SF.THROW + 1:
      return 0.45;
    case SF.ALERT:
      return -1.55;
    case SF.PANIC:
    case SF.PANIC + 1:
      return -1.35;
    case SF.CHAT:
      return -1.2;
    case SF.FIDGET:
    case SF.FIDGET + 1:
      return 1.3;
  }
  return null;
}

function drawSaber(p: PixelArt, hx: number, hy: number, a: number): void {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy;
  const py = dx;
  // Grip and brass guard.
  p.capsule(hx - dx * 2.2, hy - dy * 2.2, hx, hy, 0.8, '#3a2418');
  p.capsule(hx + dx * 0.8 + px * 1.9, hy + dy * 0.8 + py * 1.9, hx + dx * 0.8 - px * 1.6, hy + dy * 0.8 - py * 1.6, 0.75, '#d8a030');
  // Curved blade: bends toward its back edge near the tip.
  const L = 11;
  let lx = hx + dx;
  let ly = hy + dy;
  for (let i = 1; i <= L; i++) {
    const t = i / L;
    const bend = t * t * 2.2;
    const x = hx + dx * (1 + i) - px * bend;
    const y = hy + dy * (1 + i) - py * bend;
    p.capsule(lx, ly, x, y, i < L - 1 ? 0.95 : 0.6, '#c4ccd8');
    lx = x;
    ly = y;
  }
  // Edge highlight.
  for (let i = 2; i < L; i += 1) {
    const t = i / L;
    const bend = t * t * 2.2;
    p.px(hx + dx * (1 + i) - px * (bend - 0.6), hy + dy * (1 + i) - py * (bend - 0.6), '#ffffff');
  }
}

defineSoldier('saber', SABER_STYLE, 'none', {
  throwItem: 'none',
  pose: (f, pose) => {
    if (!uprightFrame(f)) return pose;
    const P = (handF: [number, number], extra: Partial<typeof pose> = {}) => ({ ...pose, handF, ...extra });
    if (f < SF.WALK) return P([4, 6], { handB: [-1.5, 8] });
    if (f < SF.AIM) {
      const s = Math.sin(((f - SF.WALK) / SF.WALK_N) * Math.PI * 2);
      return P([5, 0.5], { handB: [-2 + s * 3.5, 7.5], lean: 1.5, expr: 'shout' });
    }
    switch (f) {
      case SF.AIM:
        return P([6, 2], { handB: [-3, 4], lean: 1 });
      case SF.FIRE:
        return P([8, 1], { handB: [-4, 3], lean: 2 });
      case SF.CROUCH_AIM:
        return P([7, 7], { handB: [-3, 5], lean: 2.5, expr: 'normal' });
      case SF.CROUCH_FIRE:
        return P([-2, -7], { handB: [3, 3], lean: -1, expr: 'shout' });
      case SF.THROW:
        return P([-3, -8], { handB: [3, 4], lean: -1.5, expr: 'shout' });
      case SF.THROW + 1:
        return P([9, 2], { handB: [-4, 2], lean: 2.5, expr: 'shout' });
      case SF.ALERT:
        return P([3, -7], { handB: [-2, 7] });
    }
    return pose;
  },
  decorate: (p, f, pose) => {
    if (!uprightFrame(f)) return;
    const a = bladeAngle(f);
    if (a === null) return;
    const [hx, hy] = poseHand(pose, 'F');
    drawSaber(p, hx, hy, a);
  },
});

/** Slash arc (origin: the swordsman's feet, facing right). */
sprites.define({
  name: 'saber_swoosh',
  w: 34,
  h: 32,
  ox: 4,
  oy: 30,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    const cx = 4 + 5;
    const cy = 30 - 17;
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 34; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        if (a < -1.6 + f * 0.3 || a > 0.95) continue;
        const outer = 20.5 - f;
        const inner = 14 + f * 2;
        if (r > outer || r < inner) continue;
        const edge = r > outer - 2;
        if (f === 2 && (x + y) % 2) continue;
        p.px(x, y, edge ? '#ffffff' : f === 0 ? '#d8f0ff' : '#9ad0f0');
      }
  },
});

export class Saber extends Infantry {
  leap: boolean;
  private swooshed = false;
  /** Targets already hit by the current swing. */
  private swingHits = new Set<number>();

  constructor(props: Record<string, any> = {}) {
    super('saber', props);
    this.scoreValue = 150;
    this.firstAttack = 0.4;
    this.panicProne = 0.3;
    this.alertDelay = 0.3;
    this.leap = props.leap ?? true;
  }

  /** Blade reach while slashing. */
  slashRect(): Rect {
    const x0 = this.facing > 0 ? this.x + 2 : this.x - 32;
    return { x: x0, y: this.y - 30, w: 30, h: 28 };
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
        const dy = t.y - this.y;
        this.attackTimer -= dt;
        if (dx < 34 && Math.abs(dy) < 26 && this.onGround) {
          this.vx = 0;
          if (this.attackTimer <= 0 && this.canAttack()) this.setState('windup');
          break;
        }
        if (this.leap && this.onGround && dx > 56 && dx < 96 && Math.abs(dy) < 20 && this.attackTimer <= 0 && this.canAttack() && this.world.rng.chance(dt * 1.6)) {
          this.vx = 0;
          this.setState('crouch');
          break;
        }
        // Charge! (jump small gaps and low ledges)
        let dir: number = dx < 6 ? 0 : this.facing;
        if (this.onGround && dir !== 0) {
          if (!this.floorAhead(dir, 4, 30)) {
            if (this.floorAhead(dir, 44, 40)) this.jump(250);
            else dir = 0;
          } else if (this.hitWall === dir) this.jump(270);
          else if (dy < -30 && dx < 70) this.jump(300);
        }
        this.vx = dir * 80;
        break;
      }
      case 'windup':
        this.vx = 0;
        this.faceTarget(t);
        if (this.stateTime > 0.38) {
          this.setState('slash');
          this.swingHits.clear();
          this.vx = this.facing * 70;
          this.world.effect('saber_swoosh', this.x, this.y, { fps: 22, flip: this.facing < 0 }).follow = this;
          this.sfx('saber_swing', { vol: 0.7 });
        }
        break;
      case 'slash':
        this.vx *= 0.85;
        this.hitPlayers(this.slashRect(), 1, 'melee', this.swingHits);
        if (this.stateTime > 0.16) this.setState('recover');
        break;
      case 'crouch':
        this.vx = 0;
        this.faceTarget(t);
        if (this.stateTime > 0.4) {
          this.setState('leap');
          this.swingHits.clear();
          this.jump(215);
          this.vx = this.facing * 125;
          this.sfx('saber_swing', { vol: 0.5, pitch: 0.8 });
        }
        break;
      case 'leap':
        if (this.vy > -60) {
          this.hitPlayers(this.slashRect(), 1, 'melee', this.swingHits);
          if (this.stateTime < 0.5 && !this.swooshed) {
            this.swooshed = true;
            this.world.effect('saber_swoosh', this.x, this.y, { fps: 18, flip: this.facing < 0 }).follow = this;
          }
        }
        if (this.onGround && this.stateTime > 0.1) {
          this.swooshed = false;
          this.vx = 0;
          this.world.particles.dust(this.x, this.y, 4);
          this.setState('recover');
        }
        break;
      case 'recover':
        this.vx *= 0.8;
        if (this.stateTime > 0.55) {
          this.attackTimer = this.fireDelay(0.5);
          this.setState('engage');
        }
        break;
      default:
        this.setState('engage');
    }
  }

  override aliveFrame(): number {
    switch (this.state) {
      case 'windup':
        return SF.THROW;
      case 'slash':
        return SF.THROW + 1;
      case 'crouch':
        return SF.CROUCH_FIRE;
      case 'leap':
        return this.vy < -60 ? SF.CROUCH_FIRE : SF.THROW + 1;
      case 'recover':
        return SF.CROUCH_AIM;
      case 'engage':
        if (!this.onGround) return SF.WALK + 2;
        return this.vx !== 0 ? this.walkFrame() : SF.AIM;
    }
    return super.aliveFrame();
  }

  override render(g: CanvasRenderingContext2D): void {
    super.render(g);
    if (this.dying) return;
    if ((this.state === 'windup' || this.state === 'crouch') && Math.floor(this.stateTime * 14) % 2 === 0) {
      // Glint on the raised blade tip.
      const tipX = this.state === 'windup' ? -15 : -12;
      const tipY = this.state === 'windup' ? -36 : -33;
      const x = Math.round(this.x + this.facing * tipX);
      const y = Math.round(this.y + tipY);
      g.fillStyle = '#ffffff';
      g.fillRect(x - 1, y, 3, 1);
      g.fillRect(x, y - 1, 1, 3);
    }
  }
}

registerEntity(
  'saber',
  'enemy',
  (_w, s) => new Saber(s.props),
  'Swordsman: charges (jumps small gaps), 0.38 s wind-up with blade glint, then a slash that only hurts during the swing; sometimes a telegraphed leaping slash. props.behavior, leap (default true), facing, drop',
);
