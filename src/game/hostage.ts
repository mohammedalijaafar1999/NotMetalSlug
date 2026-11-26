// Hostages: the Legion's captured mechanics (orange coveralls, assorted caps and goggles).
//   mode 'tied'   (default) kneeling, roped to a stake, struggling - shoot or touch to free
//   mode 'caged'  sitting in a bamboo cage - shoot the cage until it breaks apart (touch won't do)
//   mode 'wander' loose and nervous, pacing about - touch to rescue
// Freed hostages hop for joy, walk to their rescuer, dig an item out of a pocket and toss it over,
// salute, and run off. Rescues are tallied at mission end.
// props: drop (pickup spec, default 'random'), mode, look (0..2 outfit), cageHp (default 8), facing.

import { sprites } from '../engine/sprites';
import { audio } from '../engine/audio';
import { fxRng } from '../engine/rng';
import { rectsOverlap } from '../engine/math';
import { drawHuman, LEG_FRAMES, type HumanPose, type HumanoidStyle } from '../art/humanoid';
import { Actor, Entity } from './entity';
import { Z, type Damage } from './constants';
import { dropPickup, isfx } from './pickup';
import { registerEntity } from './registry';
import type { Player } from './player';

/** Outfits: blue cap + mustache, welding goggles + gloves, teal bandana + ponytail. */
export const HOSTAGE_STYLES: HumanoidStyle[] = [
  {
    skin: '#f0c098',
    hair: '#5a3a22',
    hairStyle: 'short',
    mustache: '#5a3a22',
    shirt: '#e8782a',
    pants: '#d8682a',
    boots: '#4a3424',
    belt: '#7a4a22',
    headgear: 'cap',
    headgearColor: '#3a6ab0',
    headgearAccent: '#f0e8d8',
    sleeves: 'short',
  },
  {
    skin: '#c88a60',
    hair: '#2a1a14',
    hairStyle: 'short',
    shirt: '#e8782a',
    pants: '#d8682a',
    boots: '#3a2a20',
    belt: '#7a4a22',
    gloves: '#d8c070',
    headgear: 'goggles',
    headgearColor: '#5a4a30',
    sleeves: 'long',
  },
  {
    skin: '#f4d0a8',
    hair: '#c8742e',
    hairStyle: 'ponytail',
    shirt: '#e8782a',
    pants: '#d8682a',
    boots: '#4a3424',
    belt: '#7a4a22',
    headgear: 'bandana',
    headgearColor: '#2a9a8a',
    headgearAccent: '#1a6a62',
    sleeves: 'short',
  },
];
/** Back-compat alias (first outfit). */
export const HOSTAGE_STYLE = HOSTAGE_STYLES[0];

export const HF = {
  TIED: 0,
  TIED_N: 3,
  HOP: 3,
  WALK: 4,
  WALK_N: 4,
  GIVE: 8,
  TOSS: 9,
  SALUTE: 10,
  RUN: 12,
  RUN_N: 4,
  IDLE: 16,
  SCRATCH: 17,
  CAGED: 18,
  CAGED_N: 2,
  COUNT: 20,
} as const;

const HW = 44;
const HH = 46;
const HOX = 22;
const HOY = 43;
const ROPE = '#c8a050';
const ROPE_D = '#8a6a2a';

function hostagePose(f: number): HumanPose {
  const stand = { hip: [0, -13] as [number, number], footB: [-2.5, 0] as [number, number], footF: [2.5, 0] as [number, number], gun: 'none' as const };
  if (f < HF.HOP) {
    // Sitting against the stake, wrists roped behind it; wriggles, shouts for help.
    const k = f - HF.TIED;
    return { hip: [-2, -4], footB: [5, 0], footF: [7.5, 0], lean: k === 1 ? 1 : -0.4, gun: 'none', handF: [-5, 7], handB: [-6, 6], expr: k === 2 ? 'shout' : 'hurt', headDx: k === 1 ? 0.6 : 0, headDy: k === 2 ? -0.6 : 0 };
  }
  if (f === HF.HOP) return { hip: [0, -15], footB: [-3, -4], footF: [3, -3], gun: 'none', handF: [3, -10], handB: [-3, -10], expr: 'happy' };
  if (f < HF.GIVE) {
    const L = LEG_FRAMES[1 + (f - HF.WALK) * 2];
    const sw = (f - HF.WALK) % 2 === 0 ? 2 : -2;
    return { hip: L.hip, footB: L.footB, footF: L.footF, lean: 0.5, gun: 'none', handF: [1 + sw, 8], handB: [-1 - sw, 8], expr: 'happy' };
  }
  if (f === HF.GIVE) return { ...stand, handF: [2, 8], handB: [-2, 8], headDy: 0.6, expr: 'normal' };
  if (f === HF.TOSS) return { ...stand, handF: [9, 0], handB: [-2, 8], lean: 0.5, expr: 'happy' };
  if (f === HF.SALUTE || f === HF.SALUTE + 1) return { ...stand, hip: [0, -13.5], handF: [4, -8], handB: [-1, 9], lean: 0.5, expr: f === HF.SALUTE ? 'normal' : 'happy' };
  if (f < HF.IDLE) {
    const L = LEG_FRAMES[1 + (f - HF.RUN) * 2];
    const k = (f - HF.RUN) % 2 === 0;
    return { hip: L.hip, footB: L.footB, footF: L.footF, lean: 2, gun: 'none', handF: k ? [6, 2] : [-2, 6], handB: k ? [-3, 6] : [5, 3], expr: 'shout' };
  }
  if (f === HF.IDLE) return { ...stand, handF: [1.5, 9], handB: [-1.5, 9], headDx: -1, expr: 'normal' };
  if (f === HF.SCRATCH) return { ...stand, handF: [2, -11], handB: [-1.5, 9], expr: 'normal' };
  // Caged: sitting with knees up; waving on the second frame.
  const wave = f === HF.CAGED + 1;
  return { hip: [-2, -4], footB: [5, 0], footF: [7, 0], lean: 1, gun: 'none', handF: wave ? [3, -10] : [7, 4], handB: [6, 5], expr: wave ? 'shout' : 'hurt' };
}

HOSTAGE_STYLES.forEach((st, i) => {
  sprites.define({
    name: `hostage_${i}`,
    w: HW,
    h: HH,
    ox: HOX,
    oy: HOY,
    frames: HF.COUNT,
    draw: (p, f) => {
      const pose = hostagePose(f);
      drawHuman(p, HOX, HOY, pose, st);
      if (f < HF.HOP) {
        // Rope coils around the chest and arms, knot at the back.
        const sx = HOX + pose.hip[0] + (pose.lean ?? 0);
        const sy = HOY + pose.hip[1] - 10;
        for (let k = 0; k < 2; k++) {
          p.rect(sx - 6, sy + 3 + k * 3, 11, 1, ROPE);
          p.px(sx - 6, sy + 3 + k * 3, ROPE_D);
          p.px(sx + 4, sy + 3 + k * 3, ROPE_D);
        }
        p.rect(sx - 8, sy + 5, 2, 2, ROPE);
        p.px(sx - 9, sy + 7, ROPE_D);
      }
    },
  });
});
// Legacy single-outfit name.
sprites.recolor('hostage_0', 'hostage', {}, { w: HW, h: HH, ox: HOX, oy: HOY, frames: HF.COUNT });

/** Wooden stake the hostage is tied to: 0 = rope on, 1 = cut rope dangling. */
sprites.define({
  name: 'hostage_post',
  w: 7,
  h: 24,
  frames: 2,
  draw: (p, f) => {
    p.rect(1.5, 1, 4, 23, '#7a5430');
    p.rect(1.5, 1, 1, 23, '#9a7040');
    p.rect(4.5, 1, 1, 23, '#5a3a1e');
    p.poly([1.5, 1, 3.5, -1, 5.5, 1], '#6a4826');
    p.hline(2, 4, 7, '#5a3a1e');
    p.hline(2, 4, 15, '#5a3a1e');
    if (f === 0) {
      p.rect(1, 12, 6, 1.5, ROPE);
      p.rect(1, 14.5, 6, 1.5, ROPE);
    } else {
      p.rect(1, 13, 6, 1.5, ROPE);
      p.rect(5.5, 14.5, 1, 4, ROPE);
      p.px(6, 18, ROPE_D);
    }
  },
});

/** Bamboo cage: 0 intact, 1 dented, 2 about to give. Drawn in front of the hostage. */
sprites.define({
  name: 'hostage_cage',
  w: 28,
  h: 32,
  frames: 3,
  draw: (p, f) => {
    const bamboo = '#c8a858';
    const bambooL = '#e8d088';
    const bambooD = '#8a7034';
    const bars = [1, 5, 9, 13, 17, 21, 25];
    bars.forEach((bx, i) => {
      if (f >= 1 && i === 2) return; // snapped bar
      if (f >= 2 && i === 5) return;
      const lean = f >= 2 && i === 4 ? 1.5 : 0;
      p.capsule(bx + 1, 3, bx + 1 + lean, 29, 1, bamboo);
      p.line(bx + 0.5, 4, bx + 0.5 + lean, 28, bambooL);
      for (const ny of [10, 19]) p.hline(bx, bx + 2, ny, bambooD);
    });
    if (f >= 1) {
      // Splintered stubs of the snapped bar.
      p.rect(9.5, 3, 2, 5, bamboo);
      p.rect(9.5, 24, 2, 5, bamboo);
      p.px(10, 8, bambooL);
      p.px(11, 23, bambooD);
    }
    const tilt = f >= 2 ? 1 : 0;
    p.poly([0, 0 + tilt, 28, 0, 28, 3.5, 0, 3.5 + tilt], '#7a5430');
    p.hline(0, 27, 0, '#9a7040');
    p.rect(0, 28.5, 28, 3.5, '#7a5430');
    p.hline(0, 27, 28, '#9a7040');
    // Lashings + padlock.
    for (const bx of [1, 13, 25]) p.rect(bx, 1, 3, 2, ROPE);
    p.rect(12, 14, 5, 4, '#e0b030');
    p.ring(14.5, 13.5, 1.8, '#8a8a96', 1);
    p.px(14, 15, '#5a4010');
  },
});

/** The stake left behind after a rescue. */
class PostRemains extends Entity {
  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
    this.z = Z.HOSTAGE - 1;
    this.w = 6;
    this.h = 22;
  }

  override render(g: CanvasRenderingContext2D): void {
    sprites.get('hostage_post').draw(g, this.x, this.y, 1);
  }
}

export type HostageMode = 'tied' | 'caged' | 'wander' | 'freed' | 'walk' | 'give' | 'salute' | 'run';

export class Hostage extends Actor {
  mode: HostageMode = 'tied';
  modeTime = 0;
  rescuer: Player | null = null;
  given = false;
  /** Outfit (0..2). */
  look: number;
  /** Was loose (wander) before being rescued. */
  wander: boolean;
  caged: boolean;
  cageHp = 0;
  cageMaxHp = 0;
  private cageFlash = 0;
  private homeX = 0;
  private pause = 0;
  private walkPhase = 0;
  private thanked = false;
  private beatT = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.team = 'neutral';
    this.hittable = true;
    this.w = 12;
    this.h = 22;
    this.z = Z.HOSTAGE;
    this.look = typeof props.look === 'number' ? Math.abs(Math.floor(props.look)) % HOSTAGE_STYLES.length : -1;
    this.wander = props.mode === 'wander';
    this.caged = props.mode === 'caged';
    if (this.wander) {
      this.mode = 'wander';
      this.hittable = false;
      this.h = 26;
    } else if (this.caged) {
      this.mode = 'caged';
      this.cageHp = this.cageMaxHp = typeof props.cageHp === 'number' ? props.cageHp : 8;
      this.w = 26;
      this.h = 30;
    }
  }

  override spawned(): void {
    this.homeX = this.x;
    if (this.look < 0) this.look = this.id % HOSTAGE_STYLES.length;
  }

  get spriteName(): string {
    return `hostage_${this.look < 0 ? 0 : this.look}`;
  }

  override damage(d: Damage): boolean {
    if (this.mode === 'tied') {
      this.free(this.world.ownerPlayer(d.owner));
      return true;
    }
    if (this.mode === 'caged') {
      this.cageHp -= Math.max(1, d.amount);
      this.cageFlash = 0.08;
      const hx = d.x ?? this.x;
      const hy = d.y ?? this.cy;
      this.world.particles.debris(hx, hy, 2, ['#c8a858', '#e8d088', '#8a7034'], 90);
      isfx(this.world, 'metal_hit', this.x, { vol: 0.4, pitch: 1.4 });
      if (this.cageHp <= 0) {
        this.breakCage();
        this.free(this.world.ownerPlayer(d.owner));
      }
      return true;
    }
    return false;
  }

  private breakCage(): void {
    const w = this.world;
    const cols = ['#c8a858', '#e8d088', '#8a7034', '#7a5430'];
    for (let i = 0; i < 14; i++) {
      w.particles.add({
        kind: 'debris',
        x: this.x + fxRng.range(-13, 13),
        y: this.y - fxRng.range(2, 28),
        vx: fxRng.range(-120, 120),
        vy: fxRng.range(-220, -80),
        life: fxRng.range(0.8, 1.4),
        color: fxRng.pick(cols),
        size: 2,
        size2: 2,
        gravity: 600,
        bounce: 0.35,
        rot: fxRng.range(0, 6),
        vr: fxRng.range(-14, 14),
      });
    }
    w.particles.dust(this.x, this.y, 6);
    isfx(w, 'crate_break', this.x);
    w.shake(1.5, 0.12);
    this.caged = false;
  }

  free(by: Player | null): void {
    if (this.mode !== 'tied' && this.mode !== 'caged' && this.mode !== 'wander') return;
    const wasTied = this.mode === 'tied';
    this.mode = 'freed';
    this.modeTime = 0;
    this.hittable = false;
    this.w = 12;
    this.h = 26;
    this.world.invalidateTargets();
    this.rescuer = by ?? this.world.players.find((p) => p.isActive) ?? null;
    this.jump(190);
    this.vx = 0;
    if (wasTied) {
      // Cut ropes fly off; the stake stays behind.
      this.world.particles.debris(this.x, this.y - 12, 6, [ROPE, ROPE_D], 120);
      this.world.add(new PostRemains(this.x - 8 * this.facing, this.y));
    }
    this.world.stats.rescues++;
    if (this.rescuer) {
      this.rescuer.profile.rescues++;
      this.rescuer.profile.missionRescues++;
    }
    this.world.addScore(this.rescuer, 100, { x: this.x, y: this.y - 30 });
    isfx(this.world, 'rescue', this.x);
    audio.say('thank you!', { pitch: 1.3, rate: 1.1 });
    this.world.emit({ type: 'hostageRescued', entity: this, by: this.rescuer });
  }

  private setMode(m: HostageMode): void {
    this.mode = m;
    this.modeTime = 0;
  }

  /** A player (on foot, or their vehicle) touching this hostage. */
  private toucher(): Player | null {
    for (const p of this.world.players) {
      if (p.state === 'play' && rectsOverlap(this.box, p.box)) return p;
      if (p.state === 'vehicle' && p.vehicle && rectsOverlap(this.box, p.vehicle.box)) return p;
    }
    return null;
  }

  override update(dt: number): void {
    this.modeTime += dt;
    if (this.cageFlash > 0) this.cageFlash -= dt;
    switch (this.mode) {
      case 'tied': {
        this.vx = 0;
        const p = this.toucher();
        if (p) this.free(p);
        break;
      }
      case 'caged':
        this.vx = 0;
        break;
      case 'wander': {
        // Pace nervously around home, stopping to look around.
        if (this.pause > 0) {
          this.pause -= dt;
          this.vx = 0;
        } else {
          if (Math.abs(this.x - this.homeX) > 26) this.facing = this.x > this.homeX ? -1 : 1;
          this.vx = this.facing * 20;
          if (!this.floorAhead(this.facing)) {
            this.facing = (-this.facing) as 1 | -1;
            this.vx = 0;
          }
          this.beatT += dt;
          if (this.beatT > 1.6) {
            this.beatT = 0;
            if (this.world.rng.chance(0.5)) this.pause = this.world.rng.range(0.6, 1.4);
          }
        }
        const p = this.toucher();
        if (p) this.free(p);
        break;
      }
      case 'freed':
        this.vx = 0;
        if (this.onGround && this.modeTime > 0.3) this.setMode('walk');
        break;
      case 'walk': {
        const r = this.rescuer;
        if (r) this.facing = (r.vehicle ?? r).x < this.x ? -1 : 1;
        this.vx = this.facing * 34;
        const rx = r ? (r.vehicle ?? r).x : this.x;
        if (this.modeTime > 0.6 || Math.abs(rx - this.x) < 18 || !this.floorAhead(this.facing)) {
          this.vx = 0;
          this.setMode('give');
        }
        break;
      }
      case 'give':
        this.vx = 0;
        if (!this.given && this.modeTime > 0.28) {
          this.given = true;
          dropPickup(this.world, this.x + this.facing * 8, this.y - 16, String(this.props.drop ?? 'random'), this.facing * 45);
        }
        if (this.modeTime > 0.6) this.setMode('salute');
        break;
      case 'salute':
        this.vx = 0;
        if (!this.thanked) {
          this.thanked = true;
          this.world.floatText('THANK YOU!', this.x, this.y - 34, '#fff2c0', 0.9);
        }
        if (this.modeTime > 0.7) {
          this.setMode('run');
          this.facing = -1;
        }
        break;
      case 'run':
        this.vx = -110;
        this.facing = -1;
        if (this.onGround && this.hitWall) this.jump(220);
        if (!this.onScreen(24)) this.remove();
        break;
    }
    this.moveAndCollide(dt);
    if (this.vx !== 0 && this.onGround) this.walkPhase += dt * (this.mode === 'run' ? 14 : 8);
  }

  override render(g: CanvasRenderingContext2D): void {
    const s = sprites.get(this.spriteName);
    const t = this.age;
    let f: number = HF.TIED;
    switch (this.mode) {
      case 'tied': {
        sprites.get('hostage_post').draw(g, this.x - 8 * this.facing, this.y, 0);
        // Struggle in bursts, shout now and then.
        const cyc = t % 2.4;
        f = cyc < 1.2 ? HF.TIED + (Math.floor(t * 5) % 2) : cyc < 1.7 ? HF.TIED + 2 : HF.TIED;
        break;
      }
      case 'caged':
        f = HF.CAGED + (t % 2 < 0.5 ? 1 : 0);
        break;
      case 'wander':
        f = this.vx !== 0 ? HF.WALK + (Math.floor(this.walkPhase) % HF.WALK_N) : t % 1.6 < 0.8 ? HF.IDLE : HF.SCRATCH;
        break;
      case 'freed':
        f = HF.HOP;
        break;
      case 'walk':
        f = HF.WALK + (Math.floor(this.walkPhase) % HF.WALK_N);
        break;
      case 'give':
        f = this.modeTime < 0.28 ? HF.GIVE : HF.TOSS;
        break;
      case 'salute':
        f = HF.SALUTE + (this.modeTime > 0.35 ? 1 : 0);
        break;
      case 'run':
        f = HF.RUN + (Math.floor(this.walkPhase) % HF.RUN_N);
        break;
    }
    s.draw(g, this.x, this.y, f, { flip: this.facing < 0 });
    if (this.mode === 'caged') {
      const frac = this.cageHp / Math.max(1, this.cageMaxHp);
      const cf = frac > 0.6 ? 0 : frac > 0.3 ? 1 : 2;
      const jig = this.cageFlash > 0 ? (Math.floor(this.cageFlash * 60) % 2 ? 1 : -1) : 0;
      sprites.get('hostage_cage').draw(g, this.x + jig, this.y, cf, { flash: this.cageFlash > 0.04 });
    }
  }
}

registerEntity(
  'hostage',
  'hostage',
  (_w, s) => new Hostage(s.props ?? {}),
  'Captured mechanic. props.drop = pickup spec; props.mode = "tied" (default) | "caged" (shoot the cage, props.cageHp=8) | "wander" (touch); props.look 0..2',
);
