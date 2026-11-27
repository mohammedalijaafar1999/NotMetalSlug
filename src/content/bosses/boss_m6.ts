// boss_m6 - JUGGERNAUT: Marshal Vortigern Gristle's crimson-and-brass war walker, the final boss.
//
// A towering (~165 px) reverse-jointed walker: boiler hull with smokestacks, twin artillery barrels,
// a missile box, a drone bay and a glass cockpit dome with Gristle at the controls. The legs are
// solved with IK every frame and drawn from angle-baked segments (src/content/bosses/m6/).
//
// Fight (hp thresholds via BigBoss.phaseAt = [0.6, 0.25]):
//  PHASE 1 (>60%): walks back and forth on the right of the arena.
//    - CANNON VOLLEY: barrels elevate (0.5 s), 3 arcing shells, each with a landing marker (~1.25 s).
//    - STOMP: lifts a foot high (0.75 s, landing shadow), slams it: crush under the foot + two ground
//      shockwaves rolling out along the floor (~150 px/s, 12 px tall) -> JUMP them.
//    - MISSILE RAIN: missiles leave the box; markers every 64 px (one under you) 1.5 s before the
//      missiles drop -> stand in a gap (24 px safe windows). Missiles can be shot down.
//  PHASE 2 (<=60%): the chest armour blows off and exposes the REACTOR CORE (x2.2 damage).
//    - CORE LASER: braces, squats all the way down (crush under the belly), core charges with a thin
//      red targeting line, then a beam sweeps down to a horizontal line 25 px above the floor and
//      holds: CROUCH under it (crouched players are 17 px tall) - and shoot the core, it is now at
//      bullet height. Two missile waves, double stomps, drones from the rear bay.
//  PHASE 3 (<=25%): desperation - plates torn off, fires, sparks everywhere, Gristle panics; faster,
//    triple stomps, random stumbles (free hits), weaker armour.
//  Standing under its belly for long makes it vent flames downward (telegraphed hiss + glow).
//  Contact damage only from feet coming down, the squatting hull and the vent flames.
//  Death: chain explosions, Gristle's cockpit ejects on a rocket and drifts off under a parachute,
//  the walker buckles and crashes nose-first, huge final blast, burning wreck.
//
// Arena (see registerEntity description): flat floor >= 1 screen, no platforms/solids/water/pits,
// floor at screen y >= 196. Spawn x = its home position (lockX + ~290); it walks in from the right.
// The boss announces itself with world.announce('WARNING!') - the boss lock must not announce.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { VIEW_W } from '../../engine/renderer';
import { approach, clamp, segmentRect, type Rect } from '../../engine/math';
import { ik2 } from '../../art/humanoid';
import { registerEntity } from '../../game/registry';
import { Z, type Damage } from '../../game/constants';
import type { Entity } from '../../game/entity';
import { BigBoss, FlyingPart, Lobbed, Wreck, bsfx, flames, smoke, sparkBurst, type Zone } from './common/kit';
import { GroundMarker, dottedLine, pixelEllipse, pixelLine, puffSteam } from './common/fx';
import {
  ANKLE,
  ARMOR_ORIGIN,
  CANNON,
  CANNON_A0,
  CANNON_N,
  CANNON_STEP,
  CORE,
  DOME,
  DOMEF,
  HATCH,
  HIP_SQUAT,
  HIP_STAND,
  LIGHTS,
  LS,
  LT,
  POD,
  SEG_STEP,
  SHIN_A0,
  SHIN_N,
  STACKS,
  THIGH_A0,
  THIGH_N,
  TILTS,
  angleFrame,
  footFrame,
  tiltIndex,
  type DomeExpr,
} from './m6/art';
import './m6/legs';
import './m6/fxart';
import { EscapePod, JugOverlay, JugShockwave, LaunchTrail, RainMissile } from './m6/parts';

export const JUG_NAME = 'JUGGERNAUT';
export const JUG_HP = 520;

/** Damage multipliers per zone. */
export const JUG_MUL = { legs: 0.8, hull: 1, armor: 0.75, chest: 1, core: 2.2, dome: 1.4 } as const;

/** Artillery shell gravity (a little floaty so the arcs stay on screen). */
const SHELL_G = 340;

/** Laser beam: half thickness and height of its centre above the floor when horizontal. */
export const BEAM_HALF = 3;
export const BEAM_HEIGHT = HIP_SQUAT - CORE.y;

type Step = { fromX: number; toX: number; t: number; dur: number; h: number; dir: number };

interface Leg {
  /** World x of the ankle, sole lift above the floor, foot tilt (local, + = toes down). */
  x: number;
  lift: number;
  tilt: number;
  step: Step | null;
  /** Manually driven (stomp) - the gait leaves it alone. */
  manual: boolean;
  // solved each frame (world space) + local segment angles
  hx: number;
  hy: number;
  kx: number;
  ky: number;
  ax: number;
  ay: number;
  thighA: number;
  shinA: number;
}

/** A sprite / rect / ellipse to paint (render and the offline preview share these). */
export type DrawOp =
  | { s: string; f: number; x: number; y: number; flip?: boolean; flash?: boolean }
  | { r: [number, number, number, number]; c: string; a?: number }
  | { e: [number, number, number, number]; c: string; a: number };

interface Strike {
  x: number;
  /** Seconds until the marker appears; the missile spawns `lead - fall` after it. */
  mark: number;
  marker: GroundMarker | null;
  spawned: boolean;
  t: number;
}

const ATTACKS = ['cannon', 'stomp', 'missiles', 'laser', 'drones'] as const;
type Attack = (typeof ATTACKS)[number];

function newLeg(x: number): Leg {
  return { x, lift: 0, tilt: 0, step: null, manual: false, hx: 0, hy: 0, kx: 0, ky: 0, ax: 0, ay: 0, thighA: Math.PI / 2, shinA: Math.PI / 2 };
}

export class Juggernaut extends BigBoss {
  /** Rig: hip height above the floor (smoothed toward hipTarget), hull tilt (+ = nose down). */
  hipH = HIP_STAND;
  hipTarget = HIP_STAND;
  hipRate = 120;
  tilt = 0;
  tiltTarget = 0;
  /** Footfall impact (dips the body, decays). */
  impact = 0;
  legs: Leg[] = [newLeg(8), newLeg(-8)];
  gait = true;
  vxWalk = 0;
  cannonElev = 0.8;
  cannonTarget = 0.8;
  recoil = 0;
  podFrame = 0;
  hatchOpen = false;
  armorOn = true;
  podOut = false;
  // fight state
  home = 0;
  destX = 0;
  minX = 0;
  maxX = 0;
  attackCd = 1.5;
  last: Attack | null = null;
  forced: Attack | null = null;
  sub = 0;
  subT = 0;
  count = 0;
  stompLeg = 0;
  targets: number[] = [];
  strikes: Strike[] = [];
  drones: Entity[] = [];
  behindT = 0;
  underT = 0;
  stumbleT = 8;
  flinchT = 0;
  exprT = 0;
  staggerDur = 1.2;
  /** True on the first think() of a state / sub-step (subT was just reset). */
  first = false;
  /** Laser: angle above horizontal (rad) and whether it is lethal right now. */
  beamA = 0.42;
  beamOn = false;
  charging = false;
  ventGlow = 0;
  venting = false;
  private beamCd = new Map<number, number>();
  /** Heavy-hit flash timers per zone id. */
  hitFx: Record<string, number> = {};
  private fxT = 0;
  private stackT = 0;
  private laserSfxT = 0;
  private crashed = false;
  private debrisT = 0;
  private marker: GroundMarker | null = null;

  constructor() {
    super(JUG_NAME, JUG_HP);
    this.w = 112;
    this.h = 150;
    this.scoreValue = 50000;
    this.phaseAt = [0.6, 0.25];
    this.deathDuration = 5.4;
  }

  // ---------------------------------------------------------------- setup

  override spawned(): void {
    super.spawned();
    this.home = this.inArena(this.x, 0);
    this.minX = this.arenaL + 150;
    this.maxX = this.arenaR - 76;
    this.home = clamp(this.home, this.minX, this.maxX);
    const t = this.target();
    this.facing = t && t.x > this.home ? 1 : -1;
    // Walk in from beyond the edge it faces away from.
    this.x = this.facing < 0 ? this.arenaR + 92 : this.arenaL - 92;
    this.y = this.groundY;
    this.legs[0].x = this.x + 8 * this.facing;
    this.legs[1].x = this.x - 8 * this.facing;
    this.destX = this.home;
    this.world.add(new JugOverlay(this));
    this.world.announce('WARNING!', { color: '#ff4040', time: 2.6, sub: 'MARSHAL GRISTLE APPROACHES' });
    this.setState('intro');
    this.layoutZones();
  }

  // ---------------------------------------------------------------- rig

  /** Hip pivot (hull origin) in world space. */
  get hipY(): number {
    return this.y - this.hipH + this.impact * 3 + this.breath;
  }

  /** Idle "breathing" of the hydraulics (whole pixels; off while squatting / dying). */
  get breath(): number {
    if (this.dying || this.state === 'laser' || this.hipH < HIP_STAND - 12) return 0;
    return Math.round(Math.sin(this.age * 2.4) * 0.9);
  }

  /** World position of a hull-local point (rotated by the tilt, mirrored by facing). */
  att(lx: number, ly: number): [number, number] {
    const c = Math.cos(this.tilt);
    const s = Math.sin(this.tilt);
    return [this.x + this.facing * (lx * c - ly * s), this.hipY + lx * s + ly * c];
  }

  /** Solve the legs (2-bone IK, knees bending backwards). */
  computeRig(): void {
    const f = this.facing;
    const hy0 = this.hipY;
    for (let i = 0; i < 2; i++) {
      const L = this.legs[i];
      const hx = i === 1 ? -3 : 0;
      const hy = i === 1 ? -2 : 0;
      const tx = (L.x - this.x) * f;
      const ty = this.y - ANKLE - L.lift - hy0;
      let [kx, ky, ex, ey] = ik2(hx, hy, tx, ty, LT, LS, -1);
      // Never fold a knee through the floor: bend it forward instead.
      if (hy0 + ky > this.y - 4) [kx, ky, ex, ey] = ik2(hx, hy, tx, ty, LT, LS, 1);
      L.thighA = Math.atan2(ky - hy, kx - hx);
      L.shinA = Math.atan2(ey - ky, ex - kx);
      L.hx = this.x + hx * f;
      L.hy = hy0 + hy;
      L.kx = this.x + kx * f;
      L.ky = hy0 + ky;
      L.ax = this.x + ex * f;
      L.ay = hy0 + ey;
    }
  }

  /** World-space bbox of a hull-local rect (follows the tilt). */
  private hullRect(x0: number, y0: number, x1: number, y1: number): Rect {
    const pts = [this.att(x0, y0), this.att(x1, y0), this.att(x1, y1), this.att(x0, y1)];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const ax = Math.min(...xs);
    const ay = Math.min(...ys);
    return { x: ax, y: ay, w: Math.max(...xs) - ax, h: Math.max(...ys) - ay };
  }

  override layoutZones(): void {
    this.computeRig();
    const z: Zone[] = [];
    const add = (id: string, mul: number, r: Rect) => z.push({ id, mul, x: r.x, y: r.y, w: r.w, h: r.h });
    add('hull', JUG_MUL.hull, this.hullRect(-55, -58, 34, 8));
    if (this.armorOn) add('armor', JUG_MUL.armor, this.hullRect(34, -50, 57, 10));
    else {
      add('chest', JUG_MUL.chest, this.hullRect(34, -50, 57, -12));
      add('core', JUG_MUL.core, this.hullRect(35, -12, 57, 12));
    }
    if (!this.podOut) add('dome', JUG_MUL.dome, this.hullRect(6, -80, 36, -58));
    for (let i = 0; i < 2; i++) {
      const L = this.legs[i];
      const id = i === 0 ? 'legN' : 'legF';
      const seg = (x0: number, y0: number, x1: number, y1: number, r: number): Rect => ({
        x: Math.min(x0, x1) - r,
        y: Math.min(y0, y1) - r,
        w: Math.abs(x1 - x0) + r * 2,
        h: Math.abs(y1 - y0) + r * 2,
      });
      add(id, JUG_MUL.legs, seg(L.hx, L.hy, L.kx, L.ky, 7));
      add(id, JUG_MUL.legs, seg(L.kx, L.ky, L.ax, L.ay, 5));
      const fy = this.y - L.lift;
      add(id, JUG_MUL.legs, { x: L.ax - 16, y: fy - 13, w: 34, h: 13 });
    }
    this.zones = z;
  }

  // ---------------------------------------------------------------- phases & damage

  override onPhase(phase: number, prev: number): void {
    this.endAttack();
    if (phase >= 1 && prev < 1) this.blowArmor();
    if (phase >= 2 && prev < 2) this.desperation();
  }

  private blowArmor(): void {
    if (!this.armorOn) return;
    this.armorOn = false;
    const [ax, ay] = this.att(ARMOR_ORIGIN.x, ARMOR_ORIGIN.y);
    this.world.explode(ax, ay, { radius: 30, damage: 0, team: 'enemy', size: 'large', shake: 7, sfx: 'explosion_big' });
    this.world.flash('#ffe0a0', 0.45);
    this.world.add(new FlyingPart('bm6_armor', 0, ax, ay, this.facing * 120, -260, { vr: this.facing * 7, life: 3.2, burn: true, flip: this.facing < 0, z: Z.FX - 2 }));
    for (let i = 0; i < 4; i++) this.flingDebris(ax, ay, 1.3);
    sparkBurst(this.world, ax, ay, 14, '#ffd080', 200);
    this.stagger(1.6, -0.1);
    this.forced = 'laser';
    bsfx(this, 'boss_roar', { vol: 0.9, pitch: 1.05 });
  }

  private desperation(): void {
    for (let i = 0; i < 3; i++) {
      const [x, y] = this.att(fxRng.range(-44, 40), fxRng.range(-54, -4));
      this.world.explode(x, y, { radius: 22, damage: 0, team: 'enemy', size: i === 0 ? 'large' : 'medium', shake: 5, sfx: i === 0 ? 'explosion_big' : 'explosion' });
      this.flingDebris(x, y, 1.2);
      this.flingDebris(x, y, 1.2);
    }
    const [sx, sy] = this.att(STACKS[1].x + 3, STACKS[1].y + 6);
    this.world.add(new FlyingPart('bm6_debris', 3, sx, sy, -this.facing * 60, -220, { vr: 10, life: 2.6, burn: true }));
    this.world.flash('#ff8040', 0.35);
    bsfx(this, 'alarm', { vol: 0.7 });
    bsfx(this, 'boss_roar', { vol: 1, pitch: 0.85 });
    this.armorMul = 1.15;
    this.stagger(1.8, 0.1);
  }

  override applyHit(d: Damage, mul: number, id: string): boolean {
    const ok = super.applyHit(d, mul, id);
    if (ok && d.amount * mul >= 5) this.flinchT = 0.3;
    // White hit flash only for heavy hits (bullets just spark) - and any hit on the small weak points.
    if (ok && (d.amount * mul * this.armorMul >= 3 || id === 'core' || id === 'dome')) this.hitFx[id] = 0.12;
    if (ok && id === 'core' && d.x !== undefined && d.y !== undefined && fxRng.chance(0.5)) sparkBurst(this.world, d.x, d.y, 3, '#fff0a0', 140);
    return ok;
  }

  // ---------------------------------------------------------------- behaviour

  /** Scaled cooldown. */
  private cd(base: number): number {
    return base * this.world.difficulty.enemyFireDelay * this.world.rng.range(0.85, 1.15);
  }

  private get speed(): number {
    return [30, 38, 48][this.phase] ?? 30;
  }

  override setState(s: string): void {
    super.setState(s);
    this.sub = 0;
    this.subT = 0;
  }

  private next(sub: number): void {
    this.sub = sub;
    this.subT = 0;
  }

  private stagger(dur: number, tilt: number): void {
    this.setState('stagger');
    this.count = 0;
    this.staggerDur = dur;
    this.tiltTarget = tilt;
    this.vxWalk = 0;
  }

  /** Clean up whatever attack was running (phase change / death). */
  private endAttack(): void {
    this.beamOn = false;
    this.charging = false;
    this.venting = false;
    this.ventGlow = 0;
    this.hatchOpen = false;
    this.podFrame = 0;
    this.hipTarget = HIP_STAND;
    this.hipRate = 120;
    this.tiltTarget = 0;
    this.gait = true;
    this.stance = 'stand';
    for (const L of this.legs) L.manual = false;
    this.marker?.remove();
    this.marker = null;
  }

  private toWalk(cooldown?: number): void {
    this.endAttack();
    this.setState('walk');
    const base = [2.2, 1.5, 0.95][this.phase] ?? 2;
    this.attackCd = cooldown ?? this.cd(base);
    this.pickDest();
  }

  private pickDest(): void {
    const rng = this.world.rng;
    let d = rng.range(this.minX, this.maxX);
    if (Math.abs(d - this.x) < 50) d = this.x < (this.minX + this.maxX) / 2 ? this.maxX - rng.range(0, 30) : this.minX + rng.range(0, 30);
    this.destX = d;
  }

  private chooseAttack(): Attack {
    if (this.forced) {
      const f = this.forced;
      this.forced = null;
      return f;
    }
    const t = this.target();
    const near = t ? Math.abs(t.x - this.x) < 120 : false;
    const ph = this.phase;
    const alive = this.liveDrones();
    const w: [Attack, number][] = [
      ['cannon', 3],
      ['stomp', near ? 4 : 2],
      ['missiles', 2.2],
    ];
    if (ph >= 1) {
      w.push(['laser', 3]);
      if (alive < (ph >= 2 ? 3 : 2)) w.push(['drones', ph >= 2 ? 1.6 : 2]);
    }
    const options = w.filter(([a]) => a !== this.last);
    const a = this.world.rng.weighted(options.length ? options : w);
    return a;
  }

  private liveDrones(): number {
    this.drones = this.drones.filter((d) => !d.dead && !(d as { dying?: boolean }).dying);
    return this.drones.length;
  }

  override update(dt: number): void {
    for (const k in this.hitFx) this.hitFx[k] -= dt;
    super.update(dt);
  }

  override think(dt: number): void {
    this.flinchT -= dt;
    this.first = this.subT === 0;
    this.subT += dt;
    const t = this.target();
    switch (this.state) {
      case 'intro': {
        const dir = Math.sign(this.home - this.x);
        const dist = Math.abs(this.home - this.x);
        this.vxWalk = dir * Math.max(84, dist / 2.1);
        if (dist < 3 || this.stateTime > 2.5) {
          this.vxWalk = 0;
          this.setState('roar');
          bsfx(this, 'boss_roar', { vol: 1 });
          this.world.shake(4, 0.6);
          for (const s of STACKS) {
            const [x, y] = this.att(s.x + 3, s.y);
            puffSteam(this.world, x, y, -this.facing * 10, -60, 6, 4);
          }
        }
        break;
      }
      case 'roar':
        this.vxWalk = 0;
        if (this.stateTime > 0.45) {
          this.finishIntro();
          this.toWalk(this.cd(1.0));
        }
        break;
      case 'walk':
        this.thinkWalk(dt, t);
        break;
      case 'turn':
        this.vxWalk = 0;
        this.hipTarget = HIP_STAND - 8;
        if (this.sub === 0 && this.subT > 0.25) {
          this.next(1);
          this.facing = this.facing > 0 ? -1 : 1;
          this.world.shake(2, 0.2);
          bsfx(this, 'land', { vol: 0.7, pitch: 0.45 });
        }
        if (this.sub === 1 && this.subT > 0.3) this.toWalk(Math.max(this.attackCd, 0.6));
        break;
      case 'stagger':
        this.thinkStagger(dt);
        break;
      case 'cannon':
        this.thinkCannon(dt);
        break;
      case 'stomp':
        this.thinkStomp(dt);
        break;
      case 'missiles':
        this.thinkMissiles(dt);
        break;
      case 'laser':
        this.thinkLaser(dt);
        break;
      case 'drones':
        this.thinkDrones(dt);
        break;
      case 'vent':
        this.thinkVent(dt);
        break;
      default:
        this.toWalk();
    }
    this.updateStrikes(dt);
    this.updateBody(dt);
    this.ambient(dt);
  }

  private thinkWalk(dt: number, t: Entity | null): void {
    const dir = Math.sign(this.destX - this.x);
    const dist = Math.abs(this.destX - this.x);
    const want = dist < 4 ? 0 : dir * this.speed * Math.min(1, dist / 30 + 0.3);
    this.vxWalk = approach(this.vxWalk, want, 90 * dt);
    if (dist < 4 && this.stateTime > 1.2 && this.attackCd > 0.6) this.pickDest();
    // Turn to face players behind.
    if (t && (t.x - this.x) * this.facing < -26) this.behindT += dt;
    else this.behindT = 0;
    if (this.behindT > 0.55) {
      this.behindT = 0;
      this.setState('turn');
      return;
    }
    // Anti-camping: someone loitering under the belly gets vented.
    if (this.playerUnderBelly()) this.underT += dt;
    else this.underT = Math.max(0, this.underT - dt * 2);
    if (this.underT > 1.0) {
      this.underT = 0;
      this.setState('vent');
      bsfx(this, 'boss_charge', { vol: 0.5, pitch: 1.6 });
      return;
    }
    // Desperation stumbles (free hits).
    if (this.phase >= 2) {
      this.stumbleT -= dt;
      if (this.stumbleT <= 0) {
        this.stumbleT = this.world.rng.range(6, 9);
        const [x, y] = this.att(fxRng.range(-40, 30), fxRng.range(-50, -10));
        this.world.explode(x, y, { radius: 16, damage: 0, team: 'enemy', size: 'medium', shake: 4, sfx: 'explosion' });
        this.stagger(0.9, this.world.rng.sign() * 0.08);
        return;
      }
    }
    this.attackCd -= dt;
    if (this.attackCd <= 0 && this.stateTime > 0.4) this.startAttack(this.chooseAttack());
  }

  private playerUnderBelly(): boolean {
    const [bx] = this.att(-4, 0);
    for (const p of this.world.players) {
      if (!p.isTargetable) continue;
      const e = this.world.targetOf(p);
      if (Math.abs(e.x - bx) < 34 && e.y > this.hipY) return true;
    }
    return false;
  }

  private startAttack(a: Attack): void {
    this.last = a;
    this.count = 0;
    this.setState(a);
    this.vxWalk = 0;
    if (a === 'stomp') this.stompLeg = 0;
  }

  // ---- stagger (phase change / stumble)
  private thinkStagger(_dt: number): void {
    const dur = this.staggerDur;
    this.vxWalk = 0;
    const k = this.stateTime / dur;
    this.hipTarget = HIP_STAND - 10 * Math.sin(Math.min(1, k) * Math.PI);
    if (k > 0.55) this.tiltTarget = 0;
    if (fxRng.chance(0.4)) {
      const [x, y] = this.att(fxRng.range(-40, 50), fxRng.range(-56, 0));
      sparkBurst(this.world, x, y, 2, '#ffd080', 120);
    }
    if (this.stateTime >= dur) this.toWalk(this.forced ? 0.35 : this.cd(0.8));
  }

  // ---- cannon volley
  private thinkCannon(_dt: number): void {
    const t = this.target();
    const n = [3, 4, 5][this.phase] ?? 3;
    if (this.sub === 0) {
      if (this.first) this.planVolley(n, t);
      const tx = this.targets[0] ?? this.x - this.facing * 150;
      this.cannonTarget = this.launchAngle(tx);
      if (this.subT > 0.5) {
        this.next(1);
        this.count = 0;
      }
    } else if (this.sub === 1) {
      const gap = [0.38, 0.32, 0.26][this.phase] ?? 0.38;
      if (this.subT >= (this.count === 0 ? 0 : gap)) {
        if (this.count < this.targets.length) {
          this.fireShell(this.targets[this.count]);
          this.count++;
          this.subT = 0;
          const nx = this.targets[this.count];
          if (nx !== undefined) this.cannonTarget = this.launchAngle(nx);
        } else this.next(2);
      }
    } else if (this.subT > 0.55) this.toWalk();
  }

  private planVolley(n: number, t: Entity | null): void {
    const rng = this.world.rng;
    const px = t ? t.x : this.x - this.facing * 160;
    const side = rng.sign();
    const out: number[] = [];
    for (let k = 0; out.length < n && k < n * 3; k++) {
      const off = (k === 0 ? 0 : Math.ceil(k / 2) * (k % 2 ? 1 : -1)) * 70 * side + rng.range(-6, 6);
      const x = clamp(px + off, this.arenaL + 12, this.arenaR - 12);
      // only in front of the barrels, never onto its own feet (players underneath get stomps / the vent)
      if ((x - this.x) * this.facing < 46) continue;
      if (out.some((o) => Math.abs(o - x) < 40)) continue;
      out.push(x);
    }
    this.targets = out;
  }

  /** Shell flight time for a horizontal distance: long shots fly longer (<= ~210 px/s across). */
  private flightTime(D: number): number {
    return clamp(0.9 + D / 400, 1.05, 1.6) / Math.sqrt(this.world.difficulty.enemyShotSpeed);
  }

  /** Barrel elevation that matches the lob onto tx. */
  private launchAngle(tx: number): number {
    const [mx, my] = this.muzzle();
    const D = Math.max(1, Math.abs(tx - mx));
    const T = this.flightTime(D);
    const vy = (this.groundY - 2 - my - 0.5 * SHELL_G * T * T) / T;
    return clamp(Math.atan2(-vy, D / T), CANNON_A0, CANNON_A0 + (CANNON_N - 1) * CANNON_STEP);
  }

  /** Muzzle (world) for the current elevation. */
  private muzzle(): [number, number] {
    const a = this.cannonElev - this.tilt;
    const [px, py] = this.att(CANNON.x, CANNON.y);
    return [px + this.facing * Math.cos(a) * (CANNON.len + 2), py - Math.sin(a) * (CANNON.len + 2)];
  }

  private fireShell(tx: number): void {
    const [mx, my] = this.muzzle();
    const T = this.flightTime(Math.abs(tx - mx));
    const e = this.cannonElev;
    this.world.add(new Lobbed({ owner: this, x: mx, y: my, tx, ty: this.groundY - 2, time: T, gravity: SHELL_G, radius: 16, size: 'medium', sprite: 'bm6_shell', marker: true, rotate: true, shake: 2, trail: '#8a8078' }));
    this.recoil = 1;
    this.world.shake(2, 0.15);
    bsfx(this, 'tank_cannon', { vol: 0.85, pitch: 0.85 });
    const fx = this.world.effect('muzzle_flash', mx, my, { fps: 24, z: Z.FX });
    fx.rot = this.facing > 0 ? -e : Math.PI + e;
    smoke(this.world, mx, my, { n: 4, vx: this.facing * 30, vy: -30, size: 2.5, size2: 8, life: 0.9, color: '#8a8480', color2: '#4a4648' });
  }

  // ---- stomp + shockwaves
  private thinkStomp(_dt: number): void {
    const n = this.phase + 1;
    const L = this.legs[this.stompLeg];
    const lift = this.count === 0 ? ([0.75, 0.62, 0.52][this.phase] ?? 0.7) : 0.48;
    const liftT = lift * Math.sqrt(this.world.difficulty.enemyFireDelay);
    if (this.sub === 0) {
      if (this.first || !L.manual) {
        this.gait = false;
        L.manual = true;
        L.step = null;
        const landX = clamp(this.x + this.facing * 28, this.arenaL + 20, this.arenaR - 20);
        this.targets = [landX, L.x];
        this.marker?.remove();
        this.marker = this.world.add(new GroundMarker(landX, this.groundY, liftT + 0.14, 'shadow', 22));
        bsfx(this, 'boss_charge', { vol: 0.55, pitch: 1.35 });
      }
      const k = Math.min(1, this.subT / liftT);
      const e = 1 - (1 - k) * (1 - k);
      L.x = this.targets[1] + (this.targets[0] - this.targets[1]) * e;
      L.lift = 46 * e + Math.sin(this.subT * 40) * (k > 0.8 ? 1 : 0);
      L.tilt = -0.35 * e;
      this.tiltTarget = -0.08;
      this.hipTarget = HIP_STAND + 4;
      if (this.subT >= liftT) this.next(1);
    } else if (this.sub === 1) {
      const k = Math.min(1, this.subT / 0.12);
      L.lift = 46 * (1 - k * k);
      L.tilt = -0.35 * (1 - k);
      L.x = this.targets[0];
      if (k >= 1) {
        L.lift = 0;
        L.tilt = 0;
        this.slam(L);
        this.next(2);
      }
    } else if (this.sub === 2) {
      this.tiltTarget = 0;
      this.hipTarget = HIP_STAND;
      if (this.subT > 0.32) {
        this.count++;
        L.manual = false;
        if (this.count < n) {
          this.stompLeg = 1 - this.stompLeg;
          // bring the other foot back under the body first: it stomps from where it stands
          this.next(0);
        } else this.next(3);
      }
    } else {
      this.gait = true;
      if (this.subT > 0.45) this.toWalk();
    }
  }

  private slam(L: Leg): void {
    this.marker?.remove();
    this.marker = null;
    const gy = this.groundY;
    this.world.shake(7, 0.4);
    this.world.hitstop(0.04);
    bsfx(this, 'explosion_big', { vol: 0.85, pitch: 0.6 });
    bsfx(this, 'land', { vol: 1, pitch: 0.35 });
    this.hurtPlayers({ x: L.x - 18, y: gy - 16, w: 36, h: 16 }, 'crush', 20);
    const sp = ([150, 165, 180][this.phase] ?? 150) * this.world.difficulty.enemyShotSpeed;
    for (const dir of [-1, 1] as const) {
      const limit = dir < 0 ? this.arenaL - 12 : this.arenaR + 12;
      this.world.add(new JugShockwave(this, L.x + dir * 20, gy, dir, sp, limit));
    }
    this.world.particles.dust(L.x - 14, gy, 8, '#a88a64');
    this.world.particles.dust(L.x + 14, gy, 8, '#a88a64');
    this.world.particles.debris(L.x, gy - 2, 10, ['#6e5038', '#9a7450', '#4a3a2a'], 200);
    sparkBurst(this.world, L.x, gy - 3, 8, '#ffd060', 160);
    this.impact = 1;
  }

  // ---- missile rain
  private thinkMissiles(_dt: number): void {
    const n = [6, 8, 9][this.phase] ?? 6;
    if (this.sub === 0) {
      this.podFrame = this.subT > 0.2 ? 2 : 1;
      if (this.first) bsfx(this, 'metal_hit', { vol: 0.6, pitch: 0.5 });
      if (this.subT > 0.42) {
        this.next(1);
        this.count = 0;
      }
    } else if (this.sub === 1) {
      if (this.subT >= 0.1) {
        this.subT = 0;
        const tube = POD.tubes[this.count % POD.tubes.length];
        const [x, y] = this.att(tube, POD.tubeY);
        this.world.add(new LaunchTrail(x, y));
        smoke(this.world, x, y + 4, { n: 2, vy: 10, size: 2, size2: 6, life: 0.7, color: '#d8d0c8', color2: '#7a7470' });
        if (this.count % 2 === 0) bsfx(this, 'enemy_rocket', { vol: 0.5, pitch: fxRng.range(0.9, 1.1) });
        this.count++;
        if (this.count >= n) {
          this.planRain();
          this.next(2);
        }
      }
    } else {
      if (this.subT > 0.35) this.podFrame = this.subT > 0.5 ? 0 : 1;
      if (this.subT > 0.8) this.toWalk();
    }
  }

  /** Markers every 64 px (one under the player); a second, offset wave from phase 2. */
  private planRain(): void {
    const t = this.target();
    const px = t ? t.x : this.x - this.facing * 140;
    const waves = this.phase >= 1 ? 2 : 1;
    const lead = 1.5 * Math.sqrt(this.world.difficulty.enemyFireDelay);
    for (let w = 0; w < waves; w++) {
      const base = px + w * 32;
      for (let k = -6; k <= 6; k++) {
        const x = base + k * 64;
        if (x < this.arenaL + 8 || x > this.arenaR - 8) continue;
        this.strikes.push({ x, mark: 0.25 + w * 1.05 + Math.abs(k) * 0.04, marker: null, spawned: false, t: lead });
      }
    }
  }

  private updateStrikes(dt: number): void {
    if (!this.strikes.length) return;
    const fall = 1.0;
    const y0 = this.world.camera.y - 14;
    for (const s of this.strikes) {
      if (s.mark > 0) {
        s.mark -= dt;
        if (s.mark <= 0) {
          s.marker = this.world.add(new GroundMarker(s.x, this.groundY, s.t, 'cross', 12));
          if (fxRng.chance(0.35)) this.world.sfx('mortar_whistle', s.x, { vol: 0.35, pitch: fxRng.range(0.95, 1.1) });
        }
        continue;
      }
      s.t -= dt;
      if (!s.spawned && s.t <= fall) {
        s.spawned = true;
        const speed = (this.groundY - 2 - y0) / fall;
        const m = this.world.add(new RainMissile(this, s.x, y0, speed, 12));
        m.marker = s.marker;
      }
    }
    this.strikes = this.strikes.filter((s) => !s.spawned);
  }

  // ---- core laser
  private thinkLaser(dt: number): void {
    const hold = ([1.1, 1.1, 1.25][this.phase] ?? 1.1) * 1;
    switch (this.sub) {
      case 0: // brace: tuck the feet, steam hisses under the belly
        this.vxWalk = 0;
        this.stance = 'squat';
        if (this.first) {
          bsfx(this, 'engine', { vol: 0.7, pitch: 0.6 });
          // Fairness: no new drone dives / zaps while players must stay crouched under the beam.
          for (const d of this.drones) {
            const dr = d as unknown as { attackT?: number };
            if (typeof dr.attackT === 'number') dr.attackT = Math.max(dr.attackT, 5);
          }
        }
        if (fxRng.chance(0.25)) {
          const [x, y] = this.att(fxRng.range(-30, 24), 8);
          this.steam(x, y, 0, 40);
        }
        if (this.subT > 0.5 && !this.legs.some((l) => l.step)) {
          this.gait = false;
          this.next(1);
          this.hipTarget = HIP_SQUAT;
          this.hipRate = 135;
        }
        break;
      case 1: {
        // squat; the hull crushes anyone underneath on the way down
        const bellyY = this.hipY + 8;
        if (this.y - bellyY < 30) {
          const [x0] = this.att(-46, 0);
          const [x1] = this.att(36, 0);
          this.hurtPlayers({ x: Math.min(x0, x1), y: bellyY, w: Math.abs(x1 - x0), h: this.y - bellyY }, 'crush', 20);
        }
        if (this.hipH <= HIP_SQUAT + 0.5) {
          this.world.shake(4, 0.3);
          bsfx(this, 'land', { vol: 1, pitch: 0.4 });
          for (const s of [-1, 1]) this.world.particles.dust(this.x + s * 44, this.y, 8, '#a88a64');
          this.next(2);
          this.charging = true;
          bsfx(this, 'boss_charge', { vol: 0.9 });
        }
        break;
      }
      case 2: // charge: targeting line, particles converge into the core
        if (fxRng.chance(0.7)) {
          const [cx, cy] = this.att(CORE.x, CORE.y);
          const a = fxRng.range(0, Math.PI * 2);
          const r = fxRng.range(18, 30);
          this.world.particles.add({ kind: 'px', x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3, life: 0.3, color: fxRng.chance(0.5) ? '#fff0a0' : '#ff9a30', size: 1, front: true });
        }
        if (this.subT > 1.05 * Math.sqrt(this.world.difficulty.enemyFireDelay)) {
          this.charging = false;
          this.beamOn = true;
          this.beamA = 0.42;
          this.laserSfxT = 0;
          this.next(3);
        }
        break;
      case 3: {
        // fire: sweep down to horizontal, hold, sweep back up
        const sweepIn = 0.35;
        const out = 0.25;
        if (this.subT < sweepIn) this.beamA = 0.42 * (1 - this.subT / sweepIn) ** 2;
        else if (this.subT < sweepIn + hold) this.beamA = 0;
        else this.beamA = 0.5 * ((this.subT - sweepIn - hold) / out) ** 2;
        this.laserSfxT -= dt;
        if (this.laserSfxT <= 0) {
          this.laserSfxT = 0.9;
          bsfx(this, 'boss_laser', { vol: 0.85 });
        }
        if (fxRng.chance(0.5)) this.world.shake(1.2, 0.1);
        this.hurtBeam();
        if (this.subT >= sweepIn + hold + out) {
          this.beamOn = false;
          this.next(4);
          this.hipTarget = HIP_STAND;
          this.hipRate = 100;
        }
        break;
      }
      default:
        if (fxRng.chance(0.2)) {
          const [x, y] = this.att(fxRng.range(-30, 24), 8);
          this.steam(x, y, 0, 30);
        }
        if (this.hipH >= HIP_STAND - 1 && this.subT > 0.3) {
          this.gait = true;
          this.toWalk();
        }
    }
  }

  /** Beam emitter (world) and end point. */
  beamLine(): [number, number, number, number] {
    const [ex, ey] = this.att(CORE.x + CORE.r - 1, CORE.y);
    const endX = this.facing > 0 ? this.arenaR + 40 : this.arenaL - 40;
    const len = Math.abs(endX - ex);
    return [ex, ey, endX, ey - Math.tan(this.beamA) * len];
  }

  private hurtBeam(): void {
    const [x0, y0, x1, y1] = this.beamLine();
    for (const t of this.world.targets('enemy').slice()) {
      if (t.dead || !t.hittable) continue;
      const until = this.beamCd.get(t.id) ?? -1;
      if (this.age < until) continue;
      for (const hb of t.hurtboxes()) {
        const r = { x: hb.x - BEAM_HALF, y: hb.y - BEAM_HALF, w: hb.w + BEAM_HALF * 2, h: hb.h + BEAM_HALF * 2 };
        if (segmentRect(x0, y0, x1, y1, r) >= 0) {
          this.beamCd.set(t.id, this.age + 0.4);
          const isVehicle = !!(t as { isVehicle?: boolean }).isVehicle;
          t.damage({ amount: isVehicle ? 10 : 1, kind: 'laser', owner: this, x: t.cx, y: t.cy, dir: this.facing });
          break;
        }
      }
    }
  }

  // ---- drones from the rear bay
  private thinkDrones(_dt: number): void {
    const n = this.phase >= 2 ? 3 : 2;
    if (this.sub === 0) {
      this.hatchOpen = true;
      if (this.first) bsfx(this, 'metal_hit', { vol: 0.6, pitch: 0.6 });
      if (this.subT > 0.35) {
        this.next(1);
        this.count = 0;
      }
    } else if (this.sub === 1) {
      if (this.subT >= 0.38) {
        this.subT = 0;
        const [x, y] = this.att(HATCH.x - 4, HATCH.y);
        const kind = this.phase >= 2 && this.count % 2 === 1 ? 'zap' : 'kamikaze';
        const d = this.world.spawn('drone', x, y, { kind, alt: 64 + this.count * 12, facing: this.facing });
        if (d) {
          d.vx = -this.facing * 60;
          d.vy = -40;
          this.drones.push(d);
        }
        smoke(this.world, x, y, { n: 4, vx: -this.facing * 30, vy: -10, size: 2, size2: 6, life: 0.6, color: '#8a8480', color2: '#4a4648' });
        bsfx(this, 'enemy_alert', { vol: 0.4, pitch: 1.4 });
        this.count++;
        if (this.count >= n) this.next(2);
      }
    } else {
      if (this.subT > 0.3) this.hatchOpen = false;
      if (this.subT > 0.6) this.toWalk();
    }
  }

  // ---- belly vent (anti-camping)
  private thinkVent(_dt: number): void {
    this.vxWalk = 0;
    const tele = 0.75;
    if (this.sub === 0) {
      this.ventGlow = Math.min(1, this.subT / tele);
      if (fxRng.chance(0.35)) {
        const [x, y] = this.att(fxRng.range(-30, 22), 8);
        this.steam(x, y, 0, 50);
      }
      if (this.subT > tele) {
        this.next(1);
        this.venting = true;
        bsfx(this, 'enemy_flame', { vol: 0.9, pitch: 0.7 });
      }
    } else if (this.sub === 1) {
      const [x0, by] = this.att(-32, 8);
      const [x1] = this.att(24, 8);
      const r = { x: Math.min(x0, x1), y: by, w: Math.abs(x1 - x0), h: this.y - by };
      for (let i = 0; i < 3; i++) flames(this.world, r.x + fxRng.next() * r.w, by + 2, { n: 1, vy: 150, size: 3, size2: 2, life: 0.32, spread: 2 });
      this.hurtPlayers(r, 'fire', 10);
      if (this.subT > 0.9) {
        this.venting = false;
        this.ventGlow = 0;
        this.toWalk(this.cd(0.7));
      }
    }
  }

  // ---------------------------------------------------------------- body, gait, ambience

  private updateBody(dt: number): void {
    this.hipH = approach(this.hipH, this.hipTarget, this.hipRate * dt);
    this.tilt += (this.tiltTarget - this.tilt) * Math.min(1, dt * 6);
    this.impact = Math.max(0, this.impact - dt * 5);
    this.recoil = Math.max(0, this.recoil - dt * 4);
    this.cannonElev += (this.cannonTarget - this.cannonElev) * Math.min(1, dt * 7);
    if (this.state !== 'cannon') this.cannonTarget = 0.62 + Math.sin(this.age * 0.8) * 0.04;
    this.x += this.vxWalk * dt;
    if (this.introDone) this.x = clamp(this.x, this.arenaL + 60, this.arenaR - 60);
    this.updateGait(dt);
  }

  /** Foot rest spots: a wide stance standing, both feet tucked just ahead of the hip squatting. */
  stance: 'stand' | 'squat' = 'stand';

  private home0(i: number): number {
    if (this.stance === 'squat') return this.x + (i === 0 ? 2 : -1) * this.facing;
    return this.x + (i === 0 ? 8 : -8) * this.facing;
  }

  private updateGait(dt: number): void {
    for (const L of this.legs) {
      const s = L.step;
      if (!s) continue;
      s.t += dt / s.dur;
      const k = Math.min(1, s.t);
      const e = k * k * (3 - 2 * k);
      L.x = s.fromX + (s.toX - s.fromX) * e;
      L.lift = Math.sin(Math.PI * k) * s.h;
      L.tilt = 0.4 * Math.sin(Math.PI * 2 * k) * s.dir;
      if (this.introDone && k > 0.62 && L.lift < 9) this.hurtPlayers({ x: L.x - 17, y: this.y - L.lift - 14, w: 34, h: 14 }, 'crush', 15);
      if (k >= 1) {
        L.step = null;
        L.lift = 0;
        L.tilt = 0;
        this.footfall(L);
      }
    }
    if (!this.gait || this.legs.some((l) => l.step)) return;
    const v = this.vxWalk;
    const free = [0, 1].filter((i) => !this.legs[i].manual);
    if (!free.length) return;
    if (Math.abs(v) > 3) {
      const sgn = Math.sign(v);
      const dur = clamp(44 / (2 * Math.abs(v)), 0.3, 0.75);
      const S = 2 * Math.abs(v) * dur;
      let best = -1;
      let worst = Infinity;
      for (const i of free) {
        const rel = (this.legs[i].x - this.home0(i)) * sgn;
        if (rel < worst) {
          worst = rel;
          best = i;
        }
      }
      if (best >= 0 && worst <= -S / 4) {
        const L = this.legs[best];
        const to = this.home0(best) + sgn * (Math.abs(v) * dur + S / 4);
        L.step = { fromX: L.x, toX: to, t: 0, dur, h: 11 + Math.abs(v) * 0.06, dir: sgn * this.facing };
      }
    } else {
      let best = -1;
      let err = this.stance === 'squat' ? 1.5 : 5;
      for (const i of free) {
        const e = Math.abs(this.legs[i].x - this.home0(i));
        if (e > err) {
          err = e;
          best = i;
        }
      }
      if (best >= 0) {
        const L = this.legs[best];
        const to = this.home0(best);
        L.step = { fromX: L.x, toX: to, t: 0, dur: 0.42, h: 9, dir: Math.sign(to - L.x) * this.facing };
      }
    }
  }

  private footfall(L: Leg): void {
    this.impact = Math.max(this.impact, 0.7);
    const heavy = this.state === 'intro';
    this.world.shake(heavy ? 3 : 1.6, 0.18);
    bsfx(this, 'land', { vol: heavy ? 0.9 : 0.6, pitch: 0.42 + fxRng.range(-0.04, 0.04) });
    bsfx(this, 'metal_hit', { vol: 0.2, pitch: 0.35 });
    this.world.particles.dust(L.x - 12, this.y, 3, '#a88a64');
    this.world.particles.dust(L.x + 12, this.y, 3, '#a88a64');
  }

  private ambient(dt: number): void {
    // Exhaust from the stacks.
    this.stackT -= dt;
    if (this.stackT <= 0) {
      this.stackT = Math.abs(this.vxWalk) > 5 ? 0.09 : 0.16;
      const s = STACKS[this.phase >= 2 ? 0 : fxRng.chance(0.5) ? 0 : 1];
      const [x, y] = this.att(s.x + 3, s.y - 2);
      smoke(this.world, x, y, { n: 1, vx: -this.facing * 12, vy: -30, size: 2, size2: 7, life: 1.3, color: '#3e3a40', color2: '#26222a' });
    }
    this.fxT -= dt;
    if (this.fxT > 0) return;
    this.fxT = this.phase >= 2 ? 0.05 : this.phase >= 1 ? 0.09 : 0.14;
    const f = this.hpFrac;
    const em: [number, number, 'smoke' | 'fire' | 'spark'][] = [];
    if (f < 0.85) em.push([-34, -52, 'smoke']);
    if (this.phase >= 1) em.push([44, -40, 'smoke'], [CORE.x, CORE.y - CORE.r - 2, 'spark']);
    if (f < 0.45) em.push([-22, -46, 'fire'], [-52, -40, 'smoke']);
    if (this.phase >= 2) em.push([-22, -46, 'fire'], [19, -12, 'fire'], [fxRng.range(-50, 50), fxRng.range(-56, 4), 'spark'], [fxRng.range(-50, 50), fxRng.range(-56, 4), 'spark']);
    if (!em.length) return;
    const [lx, ly, kind] = em[Math.floor(fxRng.next() * em.length)];
    const [x, y] = this.att(lx, ly);
    if (kind === 'smoke') smoke(this.world, x, y, { n: 1, size: 2, size2: 6, life: 1.1 });
    else if (kind === 'fire') flames(this.world, x, y, { n: 2, size: 2.5, life: 0.35, spread: 3 });
    else sparkBurst(this.world, x, y, 3, fxRng.chance(0.5) ? '#ffe080' : '#ffb040', 110);
    if (this.phase >= 2 && fxRng.chance(0.08)) {
      const L = this.legs[fxRng.chance(0.5) ? 0 : 1];
      sparkBurst(this.world, L.kx, L.ky, 4, '#ffd080', 120);
      puffSteam(this.world, L.kx, L.ky, -this.facing * 20, -20, 2, 2.5);
    }
  }

  private flingDebris(x: number, y: number, k = 1): void {
    const vx = fxRng.range(-140, 140) * k;
    const vy = fxRng.range(-300, -150) * k;
    this.world.add(new FlyingPart('bm6_debris', Math.floor(fxRng.next() * 5), x, y, vx, vy, { life: fxRng.range(1.6, 2.6), burn: fxRng.chance(0.4), groundY: this.groundY }));
  }

  // ---------------------------------------------------------------- death

  override onDeathStart(): void {
    this.endAttack();
    this.vxWalk = 0;
    this.gait = false;
    for (const s of this.strikes) s.marker?.remove();
    this.strikes = [];
    for (const d of this.drones) {
      if (d.dead) continue;
      this.world.explode(d.x, d.y, { radius: 8, damage: 0, team: 'enemy', size: 'small', shake: 0, sfx: 'explosion_small' });
      d.remove();
    }
    this.drones = [];
    bsfx(this, 'alarm', { vol: 0.8 });
  }

  override deathArea(): Rect {
    const r = this.hullRect(-54, -60, 54, 8);
    return { x: r.x, y: r.y, w: r.w, h: Math.max(10, Math.min(r.h + 20, this.y - r.y - 4)) };
  }

  override deathSequence(dt: number): void {
    const t = this.deathTime;
    if (t > 0.9 && !this.podOut) {
      this.podOut = true;
      const [x, y] = this.att(DOME.x, DOME.y);
      this.world.add(new EscapePod(x, y, -this.facing));
      this.world.explode(x, y + 2, { radius: 12, damage: 0, team: 'enemy', size: 'small', shake: 3, sfx: 'explosion_small' });
      for (let i = 0; i < 4; i++) this.world.add(new FlyingPart('bm6_debris', 5, x + fxRng.range(-8, 8), y - 6, fxRng.range(-80, 80), fxRng.range(-200, -100), { life: 1.6, smoke: false }));
    }
    if (t > 1.1) {
      // knees buckle: the hull sinks and pitches nose-first, feet skid inwards
      this.hipTarget = 18;
      this.hipRate = t < 2.2 ? 18 : 46;
      this.tiltTarget = 0.16;
      this.stance = 'squat';
      for (let i = 0; i < 2; i++) {
        const L = this.legs[i];
        L.step = null;
        L.lift = Math.max(0, L.lift - dt * 60);
        L.x = approach(L.x, this.home0(i), dt * 30);
      }
    }
    this.hipH = approach(this.hipH, this.hipTarget, this.hipRate * dt);
    this.tilt += (this.tiltTarget - this.tilt) * Math.min(1, dt * 2.5);
    this.impact = Math.max(0, this.impact - dt * 5);
    if (!this.crashed && this.hipH <= 19) {
      this.crashed = true;
      this.world.shake(8, 0.6);
      this.world.flash('#ffd0a0', 0.4);
      bsfx(this, 'explosion_big', { vol: 1, pitch: 0.55 });
      for (const s of [-1, 1]) {
        this.world.particles.dust(this.x + s * 50, this.y, 14, '#a88a64');
        this.world.particles.dust(this.x + s * 25, this.y, 10, '#8a7458');
      }
    }
    this.debrisT -= dt;
    if (this.debrisT <= 0) {
      this.debrisT = 0.3;
      const [x, y] = this.att(fxRng.range(-48, 48), fxRng.range(-56, 0));
      this.flingDebris(x, y, 1);
      sparkBurst(this.world, x, y, 5, '#ffe080', 150);
    }
    if (fxRng.chance(0.5)) {
      const [x, y] = this.att(fxRng.range(-50, 50), fxRng.range(-56, 4));
      flames(this.world, x, y, { n: 1, size: 3, life: 0.4 });
    }
    super.deathSequence(dt);
  }

  override onDestroyed(): void {
    this.world.add(
      new Wreck(this.x, this.y, this.facing, [{ sprite: 'bm6_wreck', frame: 0, dx: 0, dy: 0 }], [
        { dx: -22, dy: -56, fire: true },
        { dx: 18, dy: -30, fire: true },
        { dx: -46, dy: -40, fire: false },
        { dx: 40, dy: -50, fire: false },
        { dx: -4, dy: -20, fire: true },
      ]),
    );
    for (let i = 0; i < 8; i++) this.flingDebris(this.x + fxRng.range(-40, 40), this.y - fxRng.range(20, 60), 1.4);
    this.world.particles.debris(this.x, this.y - 40, 30, ['#7c2420', '#a3362a', '#d4a23a', '#4c4e5a', '#30303a'], 300);
  }

  // ---------------------------------------------------------------- rendering

  /** Hit flash as a flicker (continuous fire must not turn whole parts into white blobs). */
  flick(id: string): boolean {
    return !this.dying && (this.hitFx[id] ?? 0) > 0 && Math.floor(this.age * 30) % 2 === 0;
  }

  /** Light steam puff (behind the near leg, translucent). */
  steam(x: number, y: number, vx: number, vy: number, size = 2): void {
    this.world.particles.add({ kind: 'smoke', x: x + fxRng.range(-2, 2), y, vx: vx + fxRng.range(-8, 8), vy: vy * fxRng.range(0.7, 1.2), life: fxRng.range(0.35, 0.6), color: '#e8eef6', color2: '#a8b4c4', size, size2: size * 2.2, drag: 2.5, alpha: 0.55 });
  }

  /** Current expression of Gristle in the dome. */
  domeExpr(): DomeExpr {
    const blink = (r: number) => Math.floor(this.age * r) % 2 === 0;
    if (this.dying) return blink(4) ? 'panic' : 'panic2';
    if (this.flinchT > 0) return 'flinch';
    switch (this.state) {
      case 'intro':
      case 'roar':
        return blink(5) ? 'laugh' : 'idle2';
      case 'cannon':
      case 'missiles':
      case 'drones':
      case 'stomp':
      case 'vent':
        return this.sub === 0 ? (blink(4) ? 'shout' : 'fist') : 'shout';
      case 'laser':
        return this.sub >= 2 ? (blink(6) ? 'laugh' : 'idle2') : 'shout';
      case 'stagger':
        return this.phase >= 2 ? (blink(5) ? 'panic' : 'panic2') : 'flinch';
      default:
        if (this.phase >= 2) return blink(3) ? 'panic' : 'panic2';
        return blink(1.2) ? 'idle' : 'idle2';
    }
  }

  /** Hull damage state for the sprite (0..3). */
  hullState(): number {
    if (this.phase >= 2 || this.dying) return 3;
    if (this.phase >= 1) return 2;
    return this.hpFrac <= 0.8 ? 1 : 0;
  }

  drawOps(): DrawOp[] {
    const ops: DrawOp[] = [];
    const f = this.facing;
    const flip = f < 0;
    const jx = this.dying && this.deathTime < 4.6 ? this.deathShakeX : 0;
    const S = (s: string, fr: number, x: number, y: number, flash = false) => ops.push({ s, f: fr, x: x + jx, y, flip, flash });
    // shadow
    ops.push({ e: [this.x, this.y - 1, 52 - this.hipH * 0.1, 4], c: '#0a0810', a: 0.28 });
    for (const L of this.legs) if (L.lift > 2) ops.push({ e: [L.x, this.y - 1, 16, 2.5], c: '#0a0810', a: Math.min(0.35, 0.12 + L.lift / 140) });
    // far leg
    const far = this.legs[1];
    const ff = this.flick('legF');
    S('bm6_thigh_f', angleFrame(far.thighA, THIGH_A0, SEG_STEP, THIGH_N), far.hx, far.hy, ff);
    S('bm6_shin_f', angleFrame(far.shinA, SHIN_A0, SEG_STEP, SHIN_N), far.kx, far.ky, ff);
    S('bm6_foot_f', footFrame(far.tilt), far.ax, far.ay, ff);
    S('bm6_knee_f', 0, far.kx, far.ky, ff);
    // missile box (sits on the deck), drone hatch
    const [pX, pY] = this.att(POD.x, POD.y);
    S('bm6_pod', this.podFrame, pX, pY);
    // hull
    const hf = this.flick('hull') || this.flick('chest');
    S('bm6_hull', this.hullState() * TILTS.length + tiltIndex(this.tilt), this.x, this.hipY, hf);
    const [hX, hY] = this.att(HATCH.x, HATCH.y);
    S('bm6_hatch', this.hatchOpen ? 1 : 0, hX, hY);
    // artillery
    const [cX, cY] = this.att(CANNON.x - this.recoil * 4 * Math.cos(this.cannonElev), CANNON.y + this.recoil * 4 * Math.sin(this.cannonElev));
    S('bm6_cannon', angleFrame(this.cannonElev - this.tilt, CANNON_A0, CANNON_STEP, CANNON_N), cX, cY, hf);
    // chest armour or the exposed core
    if (this.armorOn) {
      const [aX, aY] = this.att(ARMOR_ORIGIN.x, ARMOR_ORIGIN.y);
      S('bm6_armor', 0, aX, aY, this.flick('armor'));
    } else {
      const [oX, oY] = this.att(CORE.x, CORE.y);
      const fr = this.charging || this.beamOn ? 4 + (Math.floor(this.age * 20) % 2) : Math.floor(this.age * 8) % 4;
      if (this.charging || this.beamOn) ops.push({ e: [oX + jx, oY, 14, 14], c: '#ffb040', a: 0.25 + 0.15 * Math.sin(this.age * 40) });
      S('bm6_core', fr, oX, oY, this.flick('core'));
    }
    // cockpit
    if (!this.podOut) {
      const [dX, dY] = this.att(DOME.x, DOME.y + 1);
      S('bm6_dome', DOMEF[this.domeExpr()], dX, dY, this.flick('dome'));
      const crack = this.phase >= 2 || this.dying ? 1 : this.hpFrac < 0.5 ? 0 : -1;
      if (crack >= 0) S('bm6_crack', crack, dX, dY);
    }
    // near leg
    const near = this.legs[0];
    const nf = this.flick('legN');
    S('bm6_thigh_n', angleFrame(near.thighA, THIGH_A0, SEG_STEP, THIGH_N), near.hx, near.hy, nf);
    S('bm6_shin_n', angleFrame(near.shinA, SHIN_A0, SEG_STEP, SHIN_N), near.kx, near.ky, nf);
    S('bm6_foot_n', footFrame(near.tilt), near.ax, near.ay, nf);
    S('bm6_knee_n', 0, near.kx, near.ky, nf);
    S('bm6_hip_n', 0, near.hx, near.hy, nf);
    // running lights
    for (let i = 0; i < LIGHTS.length; i++) {
      const l = LIGHTS[i];
      const rate = this.phase >= 2 ? 5 : 1.6;
      if (Math.floor(this.age * rate + i * 0.5) % 2 !== 0) continue;
      const [x, y] = this.att(l.x, l.y);
      ops.push({ r: [Math.round(x + jx) - 1, Math.round(y) - 1, 2, 2], c: l.c });
      ops.push({ e: [x + jx, y, 3, 3], c: l.c, a: 0.25 });
    }
    // vent glow under the belly
    if (this.ventGlow > 0) {
      const [x0, y0] = this.att(-32, 8);
      const [x1] = this.att(24, 8);
      ops.push({ r: [Math.min(x0, x1) + jx, y0 - 1, Math.abs(x1 - x0), 3], c: '#ff6a20', a: 0.4 + 0.5 * this.ventGlow * (0.6 + 0.4 * Math.sin(this.age * 30)) });
    }
    return ops;
  }

  override render(g: CanvasRenderingContext2D): void {
    for (const op of this.drawOps()) {
      if ('s' in op) sprites.get(op.s).draw(g, op.x, op.y, op.f, op.flip || op.flash ? { flip: op.flip, flash: op.flash } : undefined);
      else if ('r' in op) {
        g.globalAlpha = op.a ?? 1;
        g.fillStyle = op.c;
        g.fillRect(op.r[0], op.r[1], op.r[2], op.r[3]);
        g.globalAlpha = 1;
      } else pixelEllipse(g, op.e[0], op.e[1], op.e[2], op.e[3], op.c, op.a);
    }
  }

  /** Telegraphs and the beam, drawn above the actors by JugOverlay. */
  renderOverlay(g: CanvasRenderingContext2D): void {
    if (this.dying) return;
    if (this.charging) {
      const [x0, y0, x1] = this.beamLine();
      const k = Math.min(1, this.subT / 1.05);
      const rate = 6 + k * 14;
      const on = Math.floor(this.age * rate) % 2 === 0;
      // danger band exactly where the beam will be (always shown, pulsing) + a flickering aim line
      g.globalAlpha = (0.16 + k * 0.22) * (on ? 1 : 0.6);
      g.fillStyle = '#ff2a1a';
      g.fillRect(Math.min(x0, x1), Math.round(y0) - BEAM_HALF, Math.abs(x1 - x0), BEAM_HALF * 2);
      g.globalAlpha = 1;
      if (on) pixelLine(g, x0, y0, x1, y0, '#ff4a30', 1);
      else dottedLine(g, x0, y0, x1, y0, '#ffc8b0', 6, 3, -this.age * 60);
      pixelEllipse(g, x0, y0, 3 + k * 4, 3 + k * 4, '#fff0a0', 0.4 + k * 0.4);
    }
    if (this.beamOn) {
      const [x0, y0, x1, y1] = this.beamLine();
      const fl = Math.floor(this.age * 30) % 2;
      g.globalAlpha = 0.35;
      pixelLine(g, x0, y0, x1, y1, '#ff5a1a', BEAM_HALF * 2 + 4 + fl);
      g.globalAlpha = 1;
      pixelLine(g, x0, y0, x1, y1, '#ffb030', BEAM_HALF * 2 - 1 + fl);
      pixelLine(g, x0, y0, x1, y1, '#fff6d8', 3);
      pixelEllipse(g, x0, y0, 7 + fl, 7 + fl, '#fff6d8', 0.85);
      // floor glow + sparks where it meets the screen edge
      const ex = clamp(x1, this.world.camera.x, this.world.camera.x + VIEW_W);
      const t = Math.abs(ex - x0) / Math.max(1, Math.abs(x1 - x0));
      const ey = y0 + (y1 - y0) * t;
      if (fxRng.chance(0.6)) sparkBurst(this.world, ex, ey, 2, '#ffe0a0', 140);
      if (this.beamA < 0.05) {
        g.globalAlpha = 0.25;
        g.fillStyle = '#ff7a2a';
        g.fillRect(Math.min(x0, ex), this.y - 2, Math.abs(ex - x0), 2);
        g.globalAlpha = 1;
      }
    }
  }
}

registerEntity(
  'boss_m6',
  'boss',
  () => new Juggernaut(),
  `JUGGERNAUT, Marshal Gristle's crimson war walker (final boss, ${JUG_HP} HP, ~165 px tall, ~120 px wide). ` +
    'Walks back and forth on the right of the arena: artillery volleys with landing markers, stomps that send ' +
    'ground shockwaves (jump), missile rain on markers 64 px apart (stand in a gap); <60% chest armour blows ' +
    'off -> reactor core (x2.2), core laser at 25 px above the floor after squatting (crouch), drones; <25% ' +
    'desperation. Walks in from the right edge (~2.7 s, not hittable) and announces itself (WARNING banner) - ' +
    'the boss lock must NOT have an announce. ARENA: flat floor at least 1 screen wide from the lock x, no ' +
    'platforms / solids / water / pits inside it, floor at screen y >= 196 (e.g. ground y 198 in a 216 tall ' +
    'level, camera at the bottom). Spawn: { type: "boss_m6", x: lockX + 290 } (its home x; y omitted). ' +
    "Level: bossMusic 'boss_final'. It spawns its own drones; ejects Gristle's escape pod on death.",
);
