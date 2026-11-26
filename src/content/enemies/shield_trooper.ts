// Shield trooper: advances slowly behind a riveted riot shield that blocks bullets from the front
// (sparks + metal_hit). Bullets from behind or from above, shots over the shield's top edge,
// explosions, fire and the knife all get through. The shield dents, cracks and finally breaks
// (it absorbs `props.shield` bullet damage); after that he fights on with just his pistol.
// He peeks his pistol over the shield to fire (telegraphed), and turns around slowly - get behind him!
// props: behavior: patrol|guard|idle|sleep|chat|charge (default patrol), facing, drop,
//        shield: shield hit points (default 14, scaled by difficulty)

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { defineSoldier, RUSTCOAT, SF, styleVariant } from '../../art/soldier';
import { Entity } from '../../game/entity';
import { Z, type Damage } from '../../game/constants';
import { registerEntity } from '../../game/registry';
import { BUBBLE, Infantry } from './infantry';
import { uprightFrame } from './gear';

export const SHIELD_STYLE = styleVariant(RUSTCOAT, {
  shirt: '#4e5866',
  pants: '#3c4452',
  boots: '#22262e',
  vest: '#66707e',
  belt: '#1c1e24',
  headgear: 'helmet',
  headgearColor: '#40464f',
  headgearAccent: '#a8442a',
  gloves: '#2a2a30',
  build: 1.12,
  gunColor: '#2c2c34',
});

const SHIELD_H = 23;

// Body holding the shield (front hand forward behind it; no gun in hand).
defineSoldier('shield_trooper', SHIELD_STYLE, 'none', {
  pose: (f, pose) => {
    if (!uprightFrame(f) || f === SF.PANIC || f === SF.PANIC + 1 || (f >= SF.COWER && f < SF.COWER + SF.COWER_N)) return pose;
    if (f >= SF.SLEEP && f < SF.CHAT + SF.CHAT_N) return pose;
    return { ...pose, lean: (pose.lean ?? 0) + 1, handF: [6, 5], handB: [4, 7], headDx: (pose.headDx ?? 0) + 0.5 };
  },
  decorate: (p, f, pose) => {
    if (!uprightFrame(f)) return;
    // Visor glass over the face.
    const hx = 26 + pose.hip[0] + (pose.lean ?? 0) + 0.5 + (pose.headDx ?? 0);
    const hy = 46 + pose.hip[1] - (pose.torso ?? 10) - 5.5 + (pose.headDy ?? 0);
    p.rect(hx + 1, hy - 1, 5, 3, '#7aa4c4');
    p.rect(hx + 1, hy - 1, 5, 1, '#b8d8ee');
    p.px(hx + 5, hy + 1, '#4a6a8a');
  },
});
// After the shield is gone: a plain pistol trooper.
defineSoldier('shield_trooper_bare', SHIELD_STYLE, 'pistol', {
  decorate: (p, f, pose) => {
    if (!uprightFrame(f)) return;
    const hx = 26 + pose.hip[0] + (pose.lean ?? 0) + 0.5 + (pose.headDx ?? 0);
    const hy = 46 + pose.hip[1] - (pose.torso ?? 10) - 5.5 + (pose.headDy ?? 0);
    p.rect(hx + 1, hy - 1, 5, 3, '#7aa4c4');
    p.rect(hx + 1, hy - 1, 5, 1, '#b8d8ee');
  },
});

/** Riot shield (origin: bottom of the inner edge). Frames: intact, dented, cracked, broken half. */
sprites.define({
  name: 'riot_shield',
  w: 10,
  h: SHIELD_H + 1,
  ox: 1,
  oy: SHIELD_H,
  frames: 4,
  draw: (p, f) => {
    const H = SHIELD_H;
    const face = '#6a707a';
    const hi = '#a4acb6';
    const lo = '#454a54';
    if (f === 3) {
      // Broken top half.
      p.poly([1, 0, 9, 1, 9, 7, 6, 9, 3, 7, 1, 10], face);
      p.rect(1, 0, 2, 10, lo);
      p.rect(3, 1, 6, 1, hi);
      p.rect(4, 3, 4, 2, '#22303c');
      p.px(5, 3, '#9ac0dc');
      return;
    }
    // Rim (the edge toward the trooper) and the face.
    p.rect(0, 1, 3, H - 1, lo);
    p.rect(2, 0, 8, H, face);
    p.rect(2, 0, 8, 1, hi);
    p.rect(2, 0, 1, H, hi);
    p.rect(9, 1, 1, H - 1, lo);
    p.rect(3, H - 1, 7, 1, lo);
    // Viewport.
    p.rect(4, 3, 4, 3, '#22303c');
    p.rect(4, 3, 4, 1, '#5a7a96');
    p.px(5, 4, '#9ac0dc');
    // Legion cog emblem.
    p.circle(6, 13, 2.6, '#a8442a');
    p.circle(6, 13, 1.1, face);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.px(6 + Math.cos(a) * 3.2, 13 + Math.sin(a) * 3.2, '#a8442a');
    }
    // Rivets.
    for (const y of [2, 8, 18, H - 3]) {
      p.px(3, y, '#c8ccd4');
      p.px(8, y, '#2e3238');
    }
    if (f >= 1) {
      // Dents and scratches.
      p.px(7, 8, '#3a3e46');
      p.px(5, 18, '#3a3e46');
      p.px(4, 9, '#c8ccd4');
      p.line(7, 16, 9, 18, '#3a3e46');
    }
    if (f >= 2) {
      // Cracks + cracked viewport.
      p.line(9, 4, 6, 9, '#22262c');
      p.line(6, 9, 7, 12, '#22262c');
      p.line(3, 15, 6, 20, '#22262c');
      p.px(6, 4, '#e8f4ff');
      p.px(7, 5, '#e8f4ff');
    }
  },
});

/** Pistol arm reaching over the shield (origin: feet). Frames: aim, fire. */
sprites.define({
  name: 'shield_trooper_arm',
  w: 24,
  h: 12,
  ox: 4,
  oy: 30,
  frames: 2,
  draw: (p, f) => {
    // Coordinates: origin (4, 30) is the trooper's feet.
    const sx = 4 + 2;
    const sy = 30 - 23;
    const r = f ? -1 : 0;
    const ex = 4 + 7 + r;
    const ey = 30 - 22;
    const hx = 4 + 11 + r;
    const hy = 30 - 26;
    // Upper arm, forearm (lit on top), glove.
    p.capsule(sx, sy, ex, ey, 2, SHIELD_STYLE.shirt);
    p.capsule(ex, ey, hx, hy, 1.7, SHIELD_STYLE.shirt);
    p.capsule(sx + 1, sy - 1.2, ex - 0.5, ey - 1.4, 0.5, '#7a8698');
    p.capsule(ex + 0.5, ey - 1.5, hx - 1, hy - 1.2, 0.5, '#7a8698');
    // Pistol (steel blue, highlighted so it reads against the shield).
    p.rect(hx - 1, hy - 2.5, 8, 2.5, '#3a3e4c');
    p.rect(hx - 1, hy - 2.5, 8, 1, '#9aa6b8');
    p.rect(hx - 1, hy, 2, 3, '#3a3e4c');
    p.circle(hx, hy + 0.5, 1.6, '#24242a');
    if (f) {
      p.circle(hx + 8.5, hy - 1.2, 1.7, '#fff2a0');
      p.px(hx + 10, hy - 1, '#ffd040');
    }
  },
});

/** The broken shield tumbling away. */
class ShieldDebris extends Entity {
  rot = 0;
  vr: number;

  constructor(x: number, y: number, dir: number) {
    super();
    this.anchor = 'center';
    this.x = x;
    this.y = y;
    this.vx = dir * fxRng.range(70, 110);
    this.vy = -fxRng.range(160, 220);
    this.vr = dir * fxRng.range(9, 14);
    this.z = Z.FX;
  }

  override update(dt: number): void {
    this.vy += 600 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vr * dt;
    if (this.age > 1.6) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.age > 1.2 && Math.floor(this.age * 20) % 2 === 0) return;
    const a = Math.round(this.rot / (Math.PI / 4)) * (Math.PI / 4);
    sprites.get('riot_shield').draw(g, this.x, this.y, 3, { rot: a });
  }
}

export class ShieldTrooper extends Infantry {
  shieldHp: number;
  shieldMax: number;
  shieldUp = true;
  /** Recoil from blocked hits (render offset, px). */
  private shieldKick = 0;
  private shieldFlash = 0;
  private turnTimer = 0;
  private shots = 0;
  private hitSfxCd = 0;

  constructor(props: Record<string, any> = {}) {
    super('shield_trooper', props);
    this.scoreValue = 200;
    this.firstAttack = 1.2;
    this.panicProne = 0.4;
    this.patrolSpeed = 16;
    this.shieldMax = this.shieldHp = props.shield ?? 14;
  }

  override spawned(): void {
    super.spawned();
    this.shieldMax = this.shieldHp = Math.max(1, Math.round(this.shieldMax * this.world.difficulty.enemyHp));
  }

  /** Would the riot shield stop this hit? */
  blocks(d: Damage): boolean {
    if (!this.shieldUp || this.dying) return false;
    if (d.kind !== 'bullet' && d.kind !== 'laser') return false;
    const o = d.owner;
    if (o) {
      if ((o.x - this.x) * this.facing <= 0) return false; // from behind
      if (o.bottom < this.top - 1) return false; // from above
    } else if (d.dir !== undefined && d.dir === this.facing) return false;
    if (d.y !== undefined && d.y < this.y - 24) return false; // over the top: head shot
    return true;
  }

  override damage(d: Damage): boolean {
    if (this.dead || !this.hittable) return false;
    if (this.blocks(d)) {
      this.shieldHp -= d.amount;
      this.shieldKick = 1.5;
      this.shieldFlash = 0.06;
      const fx = this.x + this.facing * 11;
      const fy = d.y ?? this.y - 14;
      this.world.particles.sparks(fx, fy, 4, '#fff0b0', 120);
      if (this.hitSfxCd <= 0) {
        this.hitSfxCd = 0.07;
        this.world.sfx('metal_hit', this.x, { vol: 0.45, pitch: fxRng.range(0.9, 1.15) });
      }
      if (this.shieldHp <= 0) this.breakShield(d);
      return true;
    }
    return super.damage(d);
  }

  private breakShield(d: Damage): void {
    this.shieldUp = false;
    this.sprite = 'shield_trooper_bare';
    const dir = -this.facing;
    this.world.add(new ShieldDebris(this.x + this.facing * 8, this.y - 16, dir));
    this.world.particles.debris(this.x + this.facing * 8, this.y - 14, 7, ['#6a707a', '#a4acb6', '#a8442a'], 140);
    this.world.particles.sparks(this.x + this.facing * 8, this.y - 14, 8, '#ffffff', 160);
    this.world.sfx('glass_break', this.x, { vol: 0.6 });
    this.world.addScore(d.owner, 100, { x: this.x, y: this.y - 34 });
    this.vx = dir * 40;
    this.panicProne = 1.6;
    this.panic(null, 0.7);
  }

  combat(dt: number): void {
    const t = this.target();
    switch (this.state) {
      case 'engage': {
        if (!t) {
          this.setState('patrol');
          break;
        }
        // Turns around slowly: players who get behind him have a moment to shoot his back.
        const behind = (t.x - this.x) * this.facing < -4;
        if (behind) {
          if (this.turnTimer === 0) this.say(BUBBLE.QUESTION, { life: 0.5, rise: 4 });
          this.turnTimer += dt;
          if (this.turnTimer > (this.shieldUp ? 0.55 : 0.2)) {
            this.faceTarget(t);
            this.turnTimer = 0;
          }
        } else this.turnTimer = 0;
        if (!this.shieldUp && this.checkPanic(dt)) break;
        const dx = Math.abs(t.x - this.x);
        let move = 0;
        if (!behind) {
          if (dx > (this.shieldUp ? 70 : 150)) move = this.facing;
          else if (!this.shieldUp && dx < 50) move = -this.facing;
        }
        if (move !== 0 && !this.floorAhead(move)) move = 0;
        this.vx = move * (this.shieldUp ? 18 : 32);
        this.attackTimer -= dt;
        if (this.attackTimer <= 0 && this.canAttack() && !behind) {
          this.shots = this.world.rng.chance(0.35 * this.world.difficulty.aggression) ? 2 : 1;
          this.setState('aim');
        }
        break;
      }
      case 'aim':
        this.vx = 0;
        if (this.stateTime > (this.shieldUp ? 0.45 : 0.35)) {
          this.fire();
          this.setState('fire');
        }
        break;
      case 'fire':
        this.vx = 0;
        if (this.stateTime > 0.22) {
          if (--this.shots > 0 && this.canAttack()) {
            this.fire();
            this.stateTime = 0;
          } else {
            this.attackTimer = this.fireDelay(this.shieldUp ? 2.1 : 1.6);
            this.setState('engage');
          }
        }
        break;
      default:
        this.setState('engage');
    }
  }

  private fire(): void {
    const t = this.target();
    const mx = this.x + this.facing * (this.shieldUp ? 19 : 14);
    const my = this.y - (this.shieldUp ? 28 : 21);
    let angle = this.facing > 0 ? 0 : Math.PI;
    if (t) {
      const dy = t.cy - my;
      const dx = Math.abs(t.cx - mx);
      if (Math.abs(dy) < dx * 0.6) angle = Math.atan2(dy, t.cx - mx);
    }
    this.shoot(mx, my, { angle, speed: 150 });
    this.world.effect('muzzle_flash', mx, my, { fps: 30, flip: this.facing < 0 });
    this.world.sfx('enemy_rifle', this.x, { vol: 0.5, pitch: 1.25 });
  }

  override think(dt: number): void {
    if (this.shieldKick > 0) this.shieldKick = Math.max(0, this.shieldKick - dt * 12);
    if (this.shieldFlash > 0) this.shieldFlash -= dt;
    if (this.hitSfxCd > 0) this.hitSfxCd -= dt;
    super.think(dt);
  }

  override onDeath(d?: Damage): void {
    super.onDeath(d);
    if (this.shieldUp) {
      // Drop the shield.
      this.shieldUp = false;
      this.world.add(new ShieldDebris(this.x + this.facing * 8, this.y - 14, this.facing));
    }
  }

  override aliveFrame(): number {
    if (this.shieldUp && (this.state === 'aim' || this.state === 'fire')) return SF.IDLE;
    if (!this.shieldUp) {
      if (this.state === 'aim') return SF.AIM;
      if (this.state === 'fire') return this.stateTime < 0.08 ? SF.FIRE : SF.AIM;
    }
    return super.aliveFrame();
  }

  /** Shield is held up in these states. */
  private get shieldRaised(): boolean {
    return this.shieldUp && !this.dying && this.state !== 'sleep' && this.state !== 'chat' && this.state !== 'panic';
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.deathBlinkHidden || this.gone) return;
    super.render(g);
    if (!this.shieldRaised) {
      if (this.shieldUp && !this.dying && (this.state === 'sleep' || this.state === 'chat' || this.state === 'panic')) {
        // Shield resting / dragged at his side.
        sprites.get('riot_shield').draw(g, this.x - this.facing * 9, this.y, 0, { flip: this.facing < 0 });
      }
      return;
    }
    const walking = this.vx !== 0 && this.onGround;
    const bob = walking ? Math.round(Math.abs(Math.sin(this.walkPhase * (Math.PI / 4))) * 1) : 0;
    const frac = this.shieldHp / this.shieldMax;
    const frame = frac > 0.6 ? 0 : frac > 0.3 ? 1 : 2;
    const sx = this.x + this.facing * (5 - Math.round(this.shieldKick));
    sprites.get('riot_shield').draw(g, sx, this.y - 1 - bob, frame, { flip: this.facing < 0, flash: this.shieldFlash > 0 });
    if (this.state === 'aim' || this.state === 'fire') {
      const f = this.state === 'fire' && this.stateTime < 0.08 ? 1 : 0;
      sprites.get('shield_trooper_arm').draw(g, this.x, this.y, f, { flip: this.facing < 0, flash: this.flash > 0 });
    }
  }
}

registerEntity(
  'shield_trooper',
  'enemy',
  (_w, s) => new ShieldTrooper(s.props),
  'Riot shield blocks frontal bullets (sparks + clang) until it breaks; flank him, jump-shoot over it, knife or bomb him. Pistol peeks over the shield to fire. props.behavior, shield (hp, default 14), facing, drop',
);
