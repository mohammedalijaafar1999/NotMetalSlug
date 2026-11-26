// Grenadier: lobs grenades in high arcs after a clear wind-up, keeps its distance and backs
// away when players get close.
// props: behavior: patrol|guard|idle|sleep|chat|charge (default patrol), facing, drop,
//        range: preferred distance to the target in px (default 130)

import { defineSoldier, RUSTCOAT, SF, styleVariant } from '../../art/soldier';
import { registerEntity } from '../../game/registry';
import { Infantry } from './infantry';
import { armSwing, drawGrenade, poseHand, strapPoints, uprightFrame } from './gear';

export const GRENADIER_STYLE = styleVariant(RUSTCOAT, {
  vest: '#5e6a38',
  headgear: 'beanie',
  headgearColor: '#a8442a',
  headgearAccent: '#f0e0c0',
  mustache: '#4a2e1a',
  strap: '#4a3420',
  sleeves: 'short',
  skin: '#e0a47c',
});

defineSoldier('grenadier', GRENADIER_STYLE, 'none', {
  pose: (f, pose) => {
    const q = armSwing(f, pose);
    // Front hand holds a grenade forward, ready to throw.
    if (f < SF.WALK) return { ...q, handF: [5, 3.5 + (f % 2) * 0.5] };
    if (f < SF.AIM) return { ...q, handF: [5, 4 + Math.abs(Math.sin(((f - SF.WALK) / SF.WALK_N) * Math.PI * 2)) * 0.8] };
    if (f === SF.THROW) return { ...q, handF: [-7, -6], lean: -1.6 };
    if (f === SF.THROW + 1) return { ...q, handF: [8, -3], lean: 2 };
    return q;
  },
  decorate: (p, f, pose) => {
    if (!uprightFrame(f)) return;
    // Bandolier grenades.
    if (f !== SF.SLEEP && f !== SF.SLEEP + 1) for (const [x, y] of strapPoints(pose, [0.32, 0.6])) drawGrenade(p, x, y, 1.4);
    // Grenade in hand while walking / standing.
    if (f < SF.AIM) {
      const [hx, hy] = poseHand(pose, 'F');
      drawGrenade(p, hx + 1, hy - 1.5, 2);
    }
  },
});

export class Grenadier extends Infantry {
  range: number;

  constructor(props: Record<string, any> = {}) {
    super('grenadier', props);
    this.scoreValue = 100;
    this.firstAttack = 1.1;
    this.range = props.range ?? 130;
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
        if (dx > this.range + 50) move = this.facing;
        else if (dx < 68) move = -this.facing; // back off
        if (move !== 0 && !this.floorAhead(move)) move = 0;
        this.vx = move * (move === -this.facing ? 40 : 32);
        this.attackTimer -= dt;
        if (this.attackTimer <= 0 && this.canAttack() && dx > 26) {
          this.vx = 0;
          this.setState('windup');
        }
        break;
      }
      case 'windup':
        // Pulls the pin and cocks the arm back (telegraph).
        this.vx = 0;
        this.faceTarget(t);
        if (this.stateTime > 0.5) {
          this.throwGrenade();
          this.setState('throw');
        }
        break;
      case 'throw':
        this.vx = 0;
        if (this.stateTime > 0.28) {
          this.attackTimer = this.fireDelay(2.3);
          this.setState('engage');
        }
        break;
      default:
        this.setState('engage');
    }
  }

  private throwGrenade(): void {
    const t = this.target();
    const hx = this.x + this.facing * 8;
    const hy = this.y - 26;
    const rng = this.world.rng;
    const tx = t ? t.x + rng.range(-14, 14) : this.x + this.facing * 110;
    const ty = t ? t.y - 2 : this.y;
    const dist = Math.abs(tx - hx);
    this.lob(hx, hy, tx, ty, { vy: -(205 + Math.min(1, dist / 220) * 85), radius: 20, damage: 1 });
    this.sfx('enemy_throw', { vol: 0.6 });
  }

  override aliveFrame(): number {
    if (this.state === 'windup') return SF.THROW;
    if (this.state === 'throw') return SF.THROW + 1;
    return super.aliveFrame();
  }

  override render(g: CanvasRenderingContext2D): void {
    super.render(g);
    // Pin spark during the wind-up so the throw is readable.
    if (!this.dying && this.state === 'windup' && Math.floor(this.stateTime * 12) % 2 === 0) {
      g.fillStyle = '#fff6a0';
      g.fillRect(Math.round(this.x - this.facing * 6), Math.round(this.y - 33), 1, 1);
    }
  }
}

registerEntity(
  'grenadier',
  'enemy',
  (_w, s) => new Grenadier(s.props),
  'Lobs arcing grenades after a 0.5 s wind-up, keeps ~130 px away, backs off when you get close. props.behavior: patrol|guard|idle|sleep|chat|charge, range (px), facing, drop',
);
