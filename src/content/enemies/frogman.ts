// Frogman: lurks in deep water (only his snorkel tip and bubbles show - he can't be hurt down
// there), swims to a spot near you, pops out with a splash, winds up and throws an arcing harpoon,
// then dives again. Out of water (or in water too shallow to hide in) he waddles around on his
// flippers and throws harpoons from land.
// props: facing, drop, behavior (land mode), water: false = never use water (default: auto),
//        range: preferred throwing distance px (default 120)

import { fxRng } from '../../engine/rng';
import { VIEW_W } from '../../engine/renderer';
import { defineSoldier, RUSTCOAT, SF, SOLDIER_OX, SOLDIER_OY, styleVariant, poseHand } from '../../art/soldier';
import type { HumanPose } from '../../art/humanoid';
import type { PixelArt } from '../../engine/pixelart';
import type { Water } from '../../game/terrain';
import type { Damage } from '../../game/constants';
import { registerEntity } from '../../game/registry';
import { Infantry } from './infantry';
import { uprightFrame } from './gear';
import { Harpoon } from './projectiles';

export const FROG_STYLE = styleVariant(RUSTCOAT, {
  shirt: '#2c3e48',
  pants: '#243640',
  boots: '#1e2a30',
  belt: '#c8a040',
  vest: undefined,
  gloves: '#1a242a',
  headgear: 'hood',
  headgearColor: '#26363f',
  strap: '#1a242a',
  sleeves: 'long',
});

function drawHarpoon(p: PixelArt, x: number, y: number, a: number, len = 16): void {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const bx = x - dx * 5;
  const by = y - dy * 5;
  const tx = x + dx * (len - 5);
  const ty = y + dy * (len - 5);
  p.capsule(bx, by, tx, ty, 0.6, '#9a7a44');
  p.capsule(tx, ty, tx + dx * 3.5, ty + dy * 3.5, 1, '#c8d0d8');
  p.px(tx + dx * 3, ty + dy * 3 - 1, '#ffffff');
  p.px(bx, by, '#c04030');
}

/** Harpoon angle per frame (null = not holding one). */
function harpoonAngle(f: number): number | null {
  if (f < SF.AIM) return -0.45;
  if (f === SF.THROW) return -0.2;
  if (f === SF.AIM || f === SF.ALERT) return -0.9;
  return null;
}

defineSoldier('frogman', FROG_STYLE, 'none', {
  throwItem: 'none',
  pose: (f, pose): HumanPose => {
    if (!uprightFrame(f)) return pose;
    if (f < SF.WALK) return { ...pose, handF: [4, 4], handB: [-1.5, 8.5] };
    if (f < SF.AIM) {
      // Flipper waddle: wide steps, arms out for balance.
      const s = Math.sin(((f - SF.WALK) / SF.WALK_N) * Math.PI * 2);
      return { ...pose, handF: [4, 4 + s], handB: [-4 + s * 2, 5], lean: 0.5 };
    }
    if (f === SF.THROW) return { ...pose, handF: [-4, -8], handB: [4, 3], lean: -1.5 };
    if (f === SF.THROW + 1) return { ...pose, handF: [9, -2], handB: [-3, 4], lean: 2 };
    if (f === SF.FIDGET || f === SF.FIDGET + 1) return { ...pose, handF: [4, -8 + (f - SF.FIDGET)], handB: [-4, -7], expr: 'shout' };
    if (f === SF.ALERT || f === SF.AIM) return { ...pose, handF: [3, 2], handB: [-2, 6] };
    return pose;
  },
  decorate: (p, f, pose) => {
    if (!uprightFrame(f)) return;
    // Dive mask and snorkel.
    const hx = SOLDIER_OX + pose.hip[0] + (pose.lean ?? 0) + 0.5 + (pose.headDx ?? 0);
    const hy = SOLDIER_OY + pose.hip[1] - (pose.torso ?? 10) - 5.5 + (pose.headDy ?? 0);
    p.rect(hx + 1, hy - 2, 5, 3, '#1a2228');
    p.rect(hx + 1.5, hy - 1.5, 4, 2, '#7ac4e0');
    p.px(hx + 2, hy - 1.5, '#e8f8ff');
    p.capsule(hx - 2.5, hy - 1, hx - 3, hy - 8, 0.7, '#e8c030');
    p.capsule(hx - 3, hy - 8, hx - 1.5, hy - 9, 0.7, '#e8c030');
    // Flippers.
    for (const [fx0, fy0] of [pose.footB, pose.footF]) {
      const fx = SOLDIER_OX + fx0;
      const fy = SOLDIER_OY + fy0;
      p.poly([fx - 1, fy - 2.2, fx + 6.5, fy - 1, fx + 7, fy + 0.4, fx - 1.5, fy + 0.4], '#c8c040');
      p.rect(fx + 1, fy - 1, 5, 0.8, '#8a8a20');
    }
    const a = harpoonAngle(f);
    if (a !== null) {
      const [x, y] = poseHand(pose, 'F');
      drawHarpoon(p, x, y, a);
    }
  },
});

/** Water deep enough to hide in at x, near y. */
function findWater(e: Infantry, x: number, y: number): Water | null {
  const T = e.world.terrain;
  let best: Water | null = null;
  let bd = Infinity;
  for (const w of T.water) {
    if (x < w.x + 8 || x > w.x + w.w - 8) continue;
    const floor = Math.min(w.y + w.h, T.groundTopAt(x));
    if (floor - w.y < 20) continue;
    const d = Math.abs(w.y - y);
    if (d < bd && d < 90) {
      bd = d;
      best = w;
    }
  }
  return best;
}

export class Frogman extends Infantry {
  water: Water | null = null;
  range: number;
  private useWater: boolean;
  private swimTo = 0;
  private hiddenTime = 0;
  private floatT = 0;

  constructor(props: Record<string, any> = {}) {
    super('frogman', props);
    this.scoreValue = 150;
    this.firstAttack = 1.0;
    this.panicProne = 0.6;
    this.patrolSpeed = 16;
    this.range = props.range ?? 120;
    this.useWater = props.water !== false;
  }

  override spawned(): void {
    super.spawned();
    if (this.useWater) this.water = findWater(this, this.x, this.y);
    if (this.water) {
      this.collideTerrain = false;
      this.gravityScale = 0;
      this.submerge(this.world.rng.range(0.4, 1.0));
    }
  }

  get submerged(): boolean {
    return this.state === 'submerged';
  }

  private submerge(time: number): void {
    const w = this.water!;
    this.setState('submerged');
    this.hiddenTime = time;
    this.hittable = false;
    this.world.invalidateTargets();
    this.y = w.y + 24;
  }

  private surface(): void {
    const w = this.water!;
    this.setState('emerge');
    this.hittable = true;
    this.blocksProgress = true;
    this.world.invalidateTargets();
    this.y = w.y + 13;
    this.world.particles.splash(this.x, w.y, 10);
    this.world.sfx('splash', this.x, { vol: 0.6 });
  }

  private dive(): void {
    const w = this.water!;
    this.world.particles.splash(this.x, w.y, 7);
    this.world.sfx('splash', this.x, { vol: 0.45, pitch: 1.2 });
    this.submerge(this.world.rng.range(1.3, 2.3));
  }

  override think(dt: number): void {
    if (!this.water) {
      super.think(dt);
      return;
    }
    this.waterThink(dt);
  }

  private waterThink(dt: number): void {
    const w = this.water!;
    const t = this.target();
    this.vy = 0;
    switch (this.state) {
      case 'submerged': {
        // Swim (hidden) toward a spot at throwing distance from the target.
        if (t) {
          const side = t.x < this.x ? 1 : -1;
          this.swimTo = Math.max(w.x + 10, Math.min(w.x + w.w - 10, t.x + side * this.range * 0.8));
        }
        const cam = this.world.camera;
        const goal = Math.max(cam.x + 16, Math.min(cam.x + VIEW_W - 16, this.swimTo || this.x));
        const d = goal - this.x;
        this.vx = Math.abs(d) < 2 ? 0 : Math.sign(d) * 46;
        this.x += this.vx * dt;
        if (fxRng.chance(dt * 7)) this.world.particles.add({ kind: 'px', x: this.x + fxRng.range(-3, 3), y: w.y + 6, vx: 0, vy: -14, life: 0.4, color: '#d8f4ff' });
        this.hiddenTime -= dt;
        if (this.hiddenTime <= 0 && t && this.onScreen(-14) && Math.abs(d) < 24) this.surface();
        // Water out of view for ages: don't hold up an arena wave forever.
        if (this.hiddenTime < -6 && !this.onScreen(0)) this.blocksProgress = false;
        break;
      }
      case 'emerge':
        this.vx = 0;
        this.faceTarget(t);
        if (this.stateTime > 0.3) this.setState(this.canAttack() && t ? 'windup' : 'tread');
        break;
      case 'tread':
        this.vx = 0;
        if (this.stateTime > 0.5) this.dive();
        break;
      case 'windup':
        this.vx = 0;
        this.faceTarget(t);
        if (this.stateTime > 0.45) {
          this.throwHarpoon();
          this.setState('throw');
        }
        break;
      case 'throw':
        if (this.stateTime > 0.45) this.dive();
        break;
      default:
        this.submerge(1);
    }
    if (this.state !== 'submerged') this.y = w.y + 13 + Math.sin(this.age * 5) * 0.8;
  }

  combat(dt: number): void {
    // Land mode.
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
        if (dx > this.range + 40) move = this.facing;
        else if (dx < 60) move = -this.facing;
        if (move !== 0 && !this.floorAhead(move)) move = 0;
        this.vx = move * 26;
        this.attackTimer -= dt;
        if (this.attackTimer <= 0 && this.canAttack() && dx > 30) {
          this.vx = 0;
          this.setState('windup');
        }
        break;
      }
      case 'windup':
        this.vx = 0;
        this.faceTarget(t);
        if (this.stateTime > 0.45) {
          this.throwHarpoon();
          this.setState('throw');
        }
        break;
      case 'throw':
        this.vx = 0;
        if (this.stateTime > 0.35) {
          this.attackTimer = this.fireDelay(2.2);
          this.setState('engage');
        }
        break;
      default:
        this.setState('engage');
    }
  }

  private throwHarpoon(): void {
    const t = this.target();
    const x = this.x + this.facing * 6;
    const y = this.y - 27;
    const v = this.shotSpeed(175);
    const g = 190;
    let ang = -0.5;
    if (t) {
      const dx = Math.max(10, Math.abs(t.cx - x));
      const up = y - t.cy;
      const disc = v ** 4 - g * (g * dx * dx + 2 * up * v * v);
      ang = disc >= 0 ? -Math.atan((v * v - Math.sqrt(disc)) / (g * dx)) : -0.78;
      ang = Math.max(-1.0, Math.min(0.45, ang));
    }
    const vx = Math.cos(ang) * v * this.facing;
    const vy = Math.sin(ang) * v;
    this.world.add(new Harpoon(this, x, y, vx, vy));
    this.sfx('harpoon', { vol: 0.65 });
  }

  // ---------------------------------------------------------------- death

  override onDeath(d?: Damage): void {
    super.onDeath(d);
    if (this.water) {
      this.collideTerrain = false;
      this.gravityScale = this.deathKind === 'explosion' ? 1 : 0;
      if (this.deathKind !== 'explosion') this.vy = 0;
      this.deathDuration = 2.2;
    }
  }

  override updateDeath(dt: number): void {
    if (!this.water) {
      super.updateDeath(dt);
      return;
    }
    const w = this.water;
    // Float belly-up on the surface (after being blasted out of it, if needed).
    this.vy = Math.min(this.vy + (this.gravityScale ? 900 : 0) * dt, 400);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y >= w.y + 3 && this.vy >= 0) {
      if (this.gravityScale) this.world.particles.splash(this.x, w.y, 8);
      this.gravityScale = 0;
      this.vy = 0;
      this.y = w.y + 3 + Math.sin(this.deathTime * 3) * 0.6;
      this.vx *= Math.pow(0.2, dt);
      this.floatT += dt;
    }
  }

  override deathFrame(): number {
    if (this.water && this.floatT > 0) return SF.DIE + 4;
    return super.deathFrame();
  }

  override aliveFrame(): number {
    switch (this.state) {
      case 'windup':
        return SF.THROW;
      case 'throw':
        return this.stateTime < 0.2 ? SF.THROW + 1 : SF.IDLE;
      case 'emerge':
        return SF.FIDGET + (Math.floor(this.stateTime * 12) % 2);
      case 'tread':
        return SF.IDLE + (Math.floor(this.age * 3) % 2);
    }
    return super.aliveFrame();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (!this.water) {
      super.render(g);
      return;
    }
    const w = this.water;
    if (this.deathBlinkHidden) return;
    if (!this.dying && this.submerged) {
      // A dark shape under the surface and the snorkel tip poking out.
      g.globalAlpha = 0.45;
      g.fillStyle = '#0e1a22';
      g.fillRect(Math.round(this.x - 7), Math.round(w.y + 4), 14, 3);
      g.fillRect(Math.round(this.x - 5), Math.round(w.y + 3), 10, 5);
      g.globalAlpha = 1;
      const sx = Math.round(this.x - this.facing * 2);
      g.fillStyle = '#e8c030';
      g.fillRect(sx, Math.round(w.y - 3), 1, 4);
      g.fillRect(sx + this.facing, Math.round(w.y - 3), 1, 1);
      return;
    }
    // Clip at the waterline so he really is in the water.
    g.save();
    g.beginPath();
    g.rect(this.x - 40, this.y - 80, 80, w.y + 2 - (this.y - 80));
    g.clip();
    super.render(g);
    g.restore();
  }
}

registerEntity(
  'frogman',
  'enemy',
  (_w, s) => new Frogman(s.props),
  'Frogman: hides in deep water (invulnerable, snorkel tip visible), pops up with a splash, 0.45 s wind-up, throws an arcing harpoon, dives again. On land he waddles and throws harpoons. props.water (false = land only), range, behavior, facing, drop',
);

