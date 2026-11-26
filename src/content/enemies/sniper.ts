// Sniper: perches (usually on a high ledge), spots you from far away and kneels to aim. A red laser
// sight tracks you for ~0.75 s, then LOCKS (stops tracking, blinks white) for 0.25 s and he fires a
// fast round (240 px/s) along the locked line - move after the lock and it misses. Bolt-action
// reload between shots. Hopeless up close: he panics when you get near.
// props: behavior: guard (default) | patrol | idle | sleep | chat, facing, drop, range (px, default 330)

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { drawHuman, muzzleFromShoulder } from '../../art/humanoid';
import { defineSoldier, RUSTCOAT, SOLDIER_H, SOLDIER_OX, SOLDIER_OY, SOLDIER_W, styleVariant } from '../../art/soldier';
import { registerEntity } from '../../game/registry';
import { rotateTowards, angleDiff } from '../../engine/math';
import { Infantry } from './infantry';
import { SniperRound } from './projectiles';

export const SNIPER_STYLE = styleVariant(RUSTCOAT, {
  shirt: '#56603a',
  pants: '#474d30',
  vest: undefined,
  strap: '#3a3020',
  headgear: 'hood',
  headgearColor: '#4a5a2a',
  scarf: '#6e7a40',
  gloves: '#3a3424',
  gunColor: '#2e2a26',
});

defineSoldier('sniper', SNIPER_STYLE, 'sniper');

/** Kneeling aim angles (radians, negative = up). */
export const SNIPER_AIMS = [-1.05, -0.785, -0.524, -0.262, 0, 0.262, 0.524, 0.785, 1.05];
const BOLT_FRAME = SNIPER_AIMS.length;
const KNEEL = { hip: [0, -8] as [number, number], footF: [4.5, 0] as [number, number], footB: [-4.5, 0] as [number, number], lean: 1 };

sprites.define({
  name: 'sniper_aim',
  w: SOLDIER_W,
  h: SOLDIER_H,
  ox: SOLDIER_OX,
  oy: SOLDIER_OY,
  frames: SNIPER_AIMS.length + 1,
  draw: (p, f) => {
    if (f < SNIPER_AIMS.length) {
      const a = SNIPER_AIMS[f];
      drawHuman(p, SOLDIER_OX, SOLDIER_OY, { ...KNEEL, gun: 'sniper', aim: a, lean: a > 0.5 ? 0 : 1, headDx: a < -0.6 ? -0.5 : 0.3 }, SNIPER_STYLE);
    } else {
      // Working the bolt: rifle tipped up, back hand at the receiver.
      drawHuman(p, SOLDIER_OX, SOLDIER_OY, { ...KNEEL, gun: 'sniper', aim: -0.35, handB: [4, -1], expr: 'normal' }, SNIPER_STYLE);
    }
  },
});

const AIM_TIME = 1.0;
const LOCK_TIME = 0.25;

export class Sniper extends Infantry {
  range: number;
  /** Current laser angle (world, radians). */
  aimAngle = 0;
  private aimFrame = 4;
  private locked = false;

  constructor(props: Record<string, any> = {}) {
    super('sniper', { behavior: 'guard', ...props });
    this.scoreValue = 200;
    this.firstAttack = 0.6;
    this.sightRange = 320;
    this.panicProne = 0;
    this.range = props.range ?? 330;
  }

  override sees(range = this.sightRange): boolean {
    // Snipers scan high and low.
    return super.sees(range, 200);
  }

  /** Shoulder (kneeling) in world space. */
  private shoulder(): { x: number; y: number } {
    return { x: this.x + this.facing * 1, y: this.y - 18 };
  }

  /** Muzzle position for the sprite frame currently shown. */
  muzzle(): { x: number; y: number } {
    const s = this.shoulder();
    const [mx, my] = muzzleFromShoulder('sniper', SNIPER_AIMS[this.aimFrame]);
    return { x: s.x + mx * this.facing, y: s.y + my };
  }

  /** Aim relative to facing (0 forward, negative up) -> world angle and back. */
  private toWorld(rel: number): number {
    return this.facing > 0 ? rel : Math.PI - rel;
  }
  private toRel(world: number): number {
    return this.facing > 0 ? angleDiff(0, world) : angleDiff(0, Math.PI - world);
  }

  private nearestFrame(rel: number): number {
    let best = 0;
    for (let i = 1; i < SNIPER_AIMS.length; i++) if (Math.abs(SNIPER_AIMS[i] - rel) < Math.abs(SNIPER_AIMS[best] - rel)) best = i;
    return best;
  }

  /** Desired relative aim at the target, or null when out of reach. */
  private wantAim(): number | null {
    const t = this.target();
    if (!t) return null;
    const s = this.shoulder();
    const dx = (t.cx - s.x) * this.facing;
    if (dx < 12 || dx > this.range) return null;
    const rel = Math.atan2(t.cy - s.y, dx);
    if (Math.abs(rel) > 1.15) return null;
    return rel;
  }

  combat(dt: number): void {
    const t = this.target();
    switch (this.state) {
      case 'engage': {
        this.vx = 0;
        if (!t) {
          this.setState('idle');
          break;
        }
        this.faceTarget(t);
        // Too close for comfort.
        if (Math.abs(t.x - this.x) < 44 && Math.abs(t.y - this.y) < 30) {
          this.panic(t);
          break;
        }
        this.attackTimer -= dt;
        const rel = this.wantAim();
        if (rel !== null) this.aimFrame = this.nearestFrame(rel);
        if (this.attackTimer <= 0 && rel !== null && this.canAttack()) {
          this.aimAngle = this.toWorld(rel);
          this.locked = false;
          this.setState('aim');
          this.sfx('sniper_charge', { vol: 0.6 });
        }
        break;
      }
      case 'aim': {
        this.vx = 0;
        const rel = this.wantAim();
        if (!this.locked) {
          if (rel !== null) {
            this.aimAngle = rotateTowards(this.aimAngle, this.toWorld(rel), 1.7 * dt);
            this.aimFrame = this.nearestFrame(this.toRel(this.aimAngle));
          }
          if (this.stateTime >= AIM_TIME - LOCK_TIME) this.locked = true;
        }
        if (this.stateTime >= AIM_TIME) {
          if (this.canAttack()) this.fire();
          this.setState('bolt');
        } else if (rel === null && !this.locked && this.stateTime > 0.3) {
          // Lost the target: lower the rifle.
          this.attackTimer = 0.6;
          this.setState('engage');
        }
        break;
      }
      case 'bolt':
        this.vx = 0;
        if (this.stateTime > 0.75) {
          this.attackTimer = this.fireDelay(2.2);
          this.setState('engage');
        }
        break;
      default:
        this.setState('engage');
    }
  }

  private fire(): void {
    const m = this.muzzle();
    this.world.add(new SniperRound(this, m.x, m.y, this.aimAngle, this.shotSpeed(240)));
    const fx = this.world.effect('muzzle_flash', m.x, m.y, { fps: 30 });
    fx.rot = this.aimAngle;
    this.sfx('sniper_shot', { vol: 0.8 });
    // Ejected casing.
    this.world.particles.add({ kind: 'px', x: this.x + this.facing * 4, y: this.y - 19, vx: -this.facing * fxRng.range(30, 60), vy: -fxRng.range(60, 100), life: 0.6, color: '#e0b040', gravity: 500, bounce: 0.4 });
  }

  /** Laser end point: first terrain or player hit along the aim, within the view. */
  laserEnd(): { x: number; y: number; hitPlayer: boolean } {
    const m = this.muzzle();
    const dx = Math.cos(this.aimAngle);
    const dy = Math.sin(this.aimAngle);
    const T = this.world.terrain;
    const cam = this.world.camera;
    const targets = this.world.targets('enemy');
    let x = m.x;
    let y = m.y;
    for (let i = 0; i < 420; i++) {
      x = m.x + dx * i;
      y = m.y + dy * i;
      if (x < cam.x - 2 || x > cam.x + 386 || y < cam.y - 2 || y > cam.y + 218) break;
      if (T.isSolidPoint(x, y)) return { x, y, hitPlayer: false };
      if (i % 2 === 0) {
        for (const t of targets) {
          for (const hb of t.hurtboxes()) if (x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) return { x, y, hitPlayer: true };
        }
      }
    }
    return { x, y, hitPlayer: false };
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.deathBlinkHidden || this.gone) return;
    const aiming = !this.dying && (this.state === 'engage' || this.state === 'aim' || this.state === 'bolt');
    if (!aiming) {
      super.render(g);
      return;
    }
    const flip = this.facing < 0;
    const recoil = this.state === 'bolt' && this.stateTime < 0.08 ? -this.facing : 0;
    const frame = this.state === 'bolt' && this.stateTime > 0.15 ? BOLT_FRAME : this.aimFrame;
    sprites.get('sniper_aim').draw(g, this.x + recoil, this.y, frame, { flip, flash: this.flash > 0 });
    if (this.state !== 'aim') return;
    // Laser sight.
    const m = this.muzzle();
    const end = this.laserEnd();
    const len = Math.hypot(end.x - m.x, end.y - m.y);
    const dx = (end.x - m.x) / (len || 1);
    const dy = (end.y - m.y) / (len || 1);
    const lockBlink = this.locked && Math.floor(this.stateTime * 20) % 2 === 0;
    g.fillStyle = lockBlink ? '#ffffff' : '#ff2a2a';
    g.globalAlpha = this.locked ? 0.95 : 0.55 + 0.25 * Math.sin(this.stateTime * 30);
    for (let i = 2; i < len; i++) {
      if (!this.locked && Math.floor(i / 3) % 2 === 1) continue;
      g.fillRect(Math.round(m.x + dx * i), Math.round(m.y + dy * i), 1, 1);
    }
    g.globalAlpha = 1;
    // Dot where it lands.
    const ds = this.locked ? 3 : 2;
    g.fillStyle = lockBlink ? '#ffffff' : '#ff3a3a';
    g.fillRect(Math.round(end.x) - (ds >> 1), Math.round(end.y) - (ds >> 1), ds, ds);
    // Scope glint at the start of the aim.
    if (this.stateTime < 0.3 && Math.floor(this.stateTime * 16) % 2 === 0) {
      const gx = Math.round(this.x + this.facing * 6);
      const gy = Math.round(this.y - 21);
      g.fillStyle = '#ffffff';
      g.fillRect(gx - 1, gy, 3, 1);
      g.fillRect(gx, gy - 1, 1, 3);
    }
  }
}

registerEntity(
  'sniper',
  'enemy',
  (_w, s) => new Sniper(s.props),
  'Marksman for high ledges: red laser sight tracks you ~0.75 s, locks (blinks) 0.25 s, then a fast 240 px/s shot along the locked line. Panics up close. props.behavior (default guard), range (default 330), facing, drop',
);
