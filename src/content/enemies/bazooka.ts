// Bazooka trooper: keeps his distance, kneels, aims (launcher glints) and fires a slow rocket that
// accelerates in a straight line (no homing). Jump over it - or shoot it down for points.
// props: behavior: patrol|guard|idle|sleep|chat|charge (default patrol), facing, drop,
//        range: preferred distance in px (default 150)

import { fxRng } from '../../engine/rng';
import { defineSoldier, RUSTCOAT, SF, styleVariant, poseShoulder } from '../../art/soldier';
import { registerEntity } from '../../game/registry';
import { Infantry } from './infantry';
import { uprightFrame } from './gear';
import { LegionRocket } from './projectiles';

export const BAZOOKA_STYLE = styleVariant(RUSTCOAT, {
  vest: '#6e4a2a',
  headgear: 'goggles',
  headgearColor: '#6e6236',
  strap: '#3a2a1a',
  gloves: '#4a3a2a',
  beard: '#5a3a22',
});

defineSoldier('bazooka', BAZOOKA_STYLE, 'rocket', {
  underlay: (p, f, pose) => {
    if (!uprightFrame(f)) return;
    const [sx, sy] = poseShoulder(pose);
    // Frame pack with two spare rockets poking up behind the shoulder.
    p.poly([sx - 9, sy + 1, sx - 3, sy, sx - 3, sy + 10, sx - 9.5, sy + 10], '#4e5a32');
    p.rect(sx - 9, sy + 1, 1, 9, '#6e7c48');
    p.rect(sx - 8, sy + 5, 5, 1, '#36401e');
    for (const [rx, h] of [
      [sx - 7.5, 5],
      [sx - 5, 6.5],
    ] as const) {
      p.rect(rx - 1, sy - h + 2, 2, h, '#6a7a44');
      p.tri(rx - 1.2, sy - h + 2.2, rx + 1.2, sy - h + 2.2, rx, sy - h - 0.8, '#c0442a');
      p.px(rx - 0.5, sy - h + 1, '#ec7a52');
    }
  },
});

export class Bazooka extends Infantry {
  range: number;

  constructor(props: Record<string, any> = {}) {
    super('bazooka', props);
    this.scoreValue = 150;
    this.firstAttack = 1.3;
    this.range = props.range ?? 150;
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
        if (dx > this.range + 60) move = this.facing;
        else if (dx < this.range - 60) move = -this.facing;
        if (move !== 0 && !this.floorAhead(move)) move = 0;
        this.vx = move * 30;
        this.attackTimer -= dt;
        if (this.attackTimer <= 0 && this.canAttack() && dx > 40) {
          this.vx = 0;
          this.setState('kneel');
        }
        break;
      }
      case 'kneel':
        this.vx = 0;
        this.faceTarget(t);
        if (this.stateTime > 0.18) this.setState('aim');
        break;
      case 'aim':
        this.vx = 0;
        if (this.stateTime > 0.6) {
          this.fire();
          this.setState('recoil');
        }
        break;
      case 'recoil':
        this.vx = 0;
        if (this.stateTime > 0.5) this.setState('rise');
        break;
      case 'rise':
        if (this.stateTime > 0.15) {
          this.attackTimer = this.fireDelay(3.2);
          this.setState('engage');
        }
        break;
      default:
        this.setState('engage');
    }
  }

  /** Launcher mouth (kneeling). */
  private muzzle(): { x: number; y: number } {
    return { x: this.x + this.facing * 15, y: this.y - 16.5 };
  }

  private fire(): void {
    const t = this.target();
    const m = this.muzzle();
    let angle = this.facing > 0 ? 0 : Math.PI;
    if (t) {
      const dy = t.cy - m.y;
      const dx = Math.abs(t.cx - m.x);
      // Only tilt toward targets clearly above/below (never steeper than ~25 degrees).
      if (Math.abs(dy) > 22) {
        const a = Math.max(-0.45, Math.min(0.45, Math.atan2(dy, dx)));
        angle = this.facing > 0 ? a : Math.PI - a;
      }
    }
    const k = this.world.difficulty.enemyShotSpeed;
    this.world.add(new LegionRocket(this, m.x, m.y, angle, { speed: 60 * k, accel: 200, maxSpeed: 160 * k }));
    this.world.effect('muzzle_flash', m.x, m.y, { fps: 24, flip: this.facing < 0 });
    // Backblast.
    const bx = this.x - this.facing * 11;
    const by = this.y - 15;
    this.world.particles.smokePuffs(bx, by, 4, 3, '#b8b0a0', '#7a7468');
    for (let i = 0; i < 5; i++) {
      this.world.particles.add({ kind: 'smoke', x: bx, y: by, vx: -this.facing * fxRng.range(40, 90), vy: fxRng.range(-20, 10), life: fxRng.range(0.3, 0.6), color: '#d8d0c0', color2: '#8a8478', size: 1, size2: 4, drag: 3 });
    }
    this.world.particles.sparks(bx, by, 4, '#ffd060', 80);
    this.sfx('enemy_rocket', { vol: 0.7 });
  }

  override aliveFrame(): number {
    switch (this.state) {
      case 'kneel':
      case 'aim':
      case 'rise':
        return SF.CROUCH_AIM;
      case 'recoil':
        return this.stateTime < 0.1 ? SF.CROUCH_FIRE : SF.CROUCH_AIM;
    }
    return super.aliveFrame();
  }

  override render(g: CanvasRenderingContext2D): void {
    super.render(g);
    if (this.dying || this.state !== 'aim') return;
    // Glint at the launcher mouth while aiming (faster just before firing).
    const rate = this.stateTime > 0.4 ? 16 : 8;
    if (Math.floor(this.stateTime * rate) % 2 === 0) {
      const m = this.muzzle();
      g.fillStyle = '#fff6c0';
      g.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 1, 3, 1);
      g.fillRect(Math.round(m.x), Math.round(m.y) - 2, 1, 3);
    }
  }
}

registerEntity(
  'bazooka',
  'enemy',
  (_w, s) => new Bazooka(s.props),
  'Kneels, aims 0.6 s (launcher glints), fires a slow straight rocket (60 -> 160 px/s, no homing, can be shot down). Keeps ~150 px away. props.behavior, range, facing, drop',
);
