// boss_m2 - HORNET KING: the Rustcoat Legion's twin-rotor heavy gunship (Mission 2, Dustwind Canyon).
//
// Fight (all attacks telegraphed, one at a time, every one has a safe answer):
//  - Intro (~2.6 s, not hittable): roars in from the right edge high up and settles over the arena.
//  - Hover: drifts over the player (shoot up into the belly), bobbing; turns around (yaw) when you
//    stay behind it.
//  - STINGER SWEEP: lines its chin gun up in front of you, a red sight line sweeps the ground away
//    from it (boss_charge), then a stream of slow bullets walks back toward the gunship.
//    Safe: under / behind the hull (the gun cannot reach behind the nose).
//  - MISSILE SALVO: the wing pod opens (weak point x1.7), then 3-5 lock-on missiles drop out, ignite
//    and steer onto the spot you stood on at launch (blinking bracket marker). Keep moving or shoot
//    them down (1 HP).
//  - CARPET RUN: climbs to one edge, bomb bay opens (alarm, weak point x1.8), crosses the arena
//    dropping high-drag bombs every 64 px; each one has a growing ground shadow. Stand between.
//  - After salvos / bomb runs it sinks LOW over you while re-arming: the grenade window.
//  - 50 %: the aft rotor tears off, spins away and crashes. Phase 2: wobbly, erratic flight, faster
//    and more aggressive: double sweeps, 4-missile salvos, faster runs and MISSILE RAIN (missiles
//    climb, then dive onto marked 48-px slots; free slots are always left next to you).
//  - 20 %: engine fire, burning, everything faster (phase 3).
//  - Death: spools down, falls and crashes into the salt flat, burns, final blast, burning wreck.
// Weak points (from below): open missile pod, open bomb bay, the belly breach and torn rotor stump
// (phase 2+). Contact never hurts (the rotors stay far above the player).
//
// Arena (see registerEntity description below): flat open ground across the locked screen.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import type { Damage } from '../../game/constants';
import type { Entity } from '../../game/entity';
import { EnemyBullet } from '../../game/projectile';
import { registerEntity } from '../../game/registry';
import { BigBoss, FlyingPart, LockMissile, Wreck, bsfx, bsfxAt, flames, smoke, sparkBurst, type Zone } from './common/kit';
import { dottedLine, pixelEllipse } from './common/fx';
import { BAY_N, FRONT_HUB_F, FRONT_HUB_R, GUN_MAX, GUN_N, NT, P, POD_N, ROT_N, TILT0, TILTS } from './m2/art';
import { CarpetBomb, LockMark, TornRotor } from './m2/parts';

export const HORNET_HP = 380;

/** Pivot height above the ground for each flight band. */
const ALT_INTRO = 128;
const ALT_HIGH = 94;
const ALT_MID = 86;
const ALT_LOW = 70;
/** Local y of the wheels' bottom (lowest point of the hull). */
const WHEELS = 24;
/** Pivot margins that keep the whole hull on screen (nose side / tail side). */
const NOSE_M = 92;
const TAIL_M = 100;
/** Carpet bombs: spacing on the ground, fall gravity. */
const BOMB_GAP = 64;
const BOMB_G = 230;
/** Missile-rain slots. */
const SLOT = 48;
/** Never lower than this pivot height (the wheels stay well above a standing player's head). */
const MIN_ALT = 64;
/** |sx| below which the head-on sprite is shown during a yaw turn. */
const FRONT_K = 0.42;

type Attack = 'sweep' | 'salvo' | 'carpet' | 'rain';

interface Tuning {
  hover: number;
  sweepAim: number;
  sweepFire: number;
  sweepIv: number;
  sweepSpeed: number;
  sweepPasses: number;
  salvoN: number;
  salvoGap: number;
  runSpeed: number;
  rainN: number;
  reload: number;
}

const TUNE: Tuning[] = [
  { hover: 1.6, sweepAim: 0.95, sweepFire: 1.15, sweepIv: 0.075, sweepSpeed: 150, sweepPasses: 1, salvoN: 3, salvoGap: 0.42, runSpeed: 104, rainN: 0, reload: 2.1 },
  { hover: 1.05, sweepAim: 0.8, sweepFire: 1.0, sweepIv: 0.066, sweepSpeed: 162, sweepPasses: 2, salvoN: 4, salvoGap: 0.34, runSpeed: 118, rainN: 5, reload: 1.6 },
  { hover: 0.75, sweepAim: 0.72, sweepFire: 0.9, sweepIv: 0.06, sweepSpeed: 172, sweepPasses: 2, salvoN: 5, salvoGap: 0.28, runSpeed: 128, rainN: 6, reload: 1.3 },
];

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export class HornetKing extends BigBoss {
  // ---- pose
  tilt = 0;
  ti = TILT0;
  /** Signed horizontal draw scale: facing, shrinking through 0 during a yaw turn. */
  sx: number = -1;
  rotorA = 0;
  rotorB = 1.3;
  rotorSpd = 1;
  // ---- flight
  tx = 0;
  ty = 0;
  maxV = 100;
  maxVy = 70;
  private bob = 0;
  private behindT = 0;
  private lurchT = 2;
  // ---- combat state
  attackCd = 1.2;
  lastAttack: Attack | '' = '';
  /** Attacks started (tests / tuning). */
  attackLog: string[] = [];
  private turnFrom: 1 | -1 = -1;
  private afterTurn = 'hover';
  gunAng = 0.5;
  private gunSpinA = 0;
  private gunSpinV = 0;
  private aimA = 0;
  aimLine = false;
  private sweepA0 = 0.3;
  private sweepA1 = 1.3;
  private sweepPass = 0;
  private fireT = 0;
  podState = 0;
  bayState = 0;
  private shotsLeft = 0;
  private runDir: 1 | -1 = -1;
  private nextDropX = 0;
  private rainSlots: number[] = [];
  // ---- damage / fx
  dmgState = 0;
  pylonOn = true;
  private dmgEvents = new Set<string>();
  private fxT = 0;
  private rotorSfxT = 0;
  private hullFlash = 0;
  private hullFlashCd = 0;
  private joltX = 0;
  private joltY = 0;
  private crashed = false;
  private seqStep = 0;
  private burnAfterTear = false;

  constructor() {
    super('HORNET KING', HORNET_HP);
    this.anchor = 'center';
    this.w = 172;
    this.h = 44;
    this.phaseAt = [0.5, 0.2];
    this.scoreValue = 30000;
    this.deathDuration = 4.8;
    this.facing = -1;
    this.state = 'intro';
  }

  // ------------------------------------------------------------------ setup

  override spawned(): void {
    super.spawned();
    const T = this.world.terrain;
    const mid = (this.arenaL + this.arenaR) / 2;
    const gy = T.groundTopAt(mid);
    if (isFinite(gy)) this.groundY = gy;
    // Fly in from the side given by props.from (default: the right edge), high up.
    const fromLeft = this.props.from === 'left';
    this.facing = fromLeft ? 1 : -1;
    this.sx = this.facing;
    this.x = fromLeft ? this.arenaL - 150 : this.arenaR + 150;
    this.y = this.groundY - ALT_INTRO - 20;
    this.vx = this.facing * 175;
    this.vy = 0;
    this.tx = mid - this.facing * 30;
    this.ty = this.groundY - ALT_MID;
    this.setState('intro');
    bsfx(this, 'boss_roar', { vol: 0.9 });
    this.layoutZones();
  }

  // ------------------------------------------------------------------ geometry

  get tiltQ(): number {
    return TILTS[this.ti];
  }

  /** Local hull point (facing right) to world, with the baked tilt and the yaw scale. */
  toWorld(lx: number, ly: number, signOnly = false): { x: number; y: number } {
    const a = this.tiltQ;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rx = lx * c - ly * s;
    const ry = lx * s + ly * c;
    const k = signOnly ? (this.sx < 0 ? -1 : 1) : this.sx;
    return { x: this.x + this.joltX + rx * k, y: this.y + this.joltY + ry };
  }

  private rectW(x0: number, y0: number, x1: number, y1: number): { x: number; y: number; w: number; h: number } {
    const pts = [this.toWorld(x0, y0), this.toWorld(x1, y0), this.toWorld(x0, y1), this.toWorld(x1, y1)];
    let ax = Infinity;
    let ay = Infinity;
    let bx = -Infinity;
    let by = -Infinity;
    for (const p of pts) {
      ax = Math.min(ax, p.x);
      ay = Math.min(ay, p.y);
      bx = Math.max(bx, p.x);
      by = Math.max(by, p.y);
    }
    return { x: ax, y: ay, w: Math.max(1, bx - ax), h: Math.max(1, by - ay) };
  }

  layoutZones(): void {
    if (Math.abs(this.sx) < FRONT_K) {
      // Head-on (mid turn): one box around the face, wings and gear.
      this.zones = [{ id: 'hull', mul: 1, x: this.x - 40, y: this.y - 22, w: 80, h: 46 }];
      return;
    }
    const z: Zone[] = [];
    const add = (id: string, mul: number, x0: number, y0: number, x1: number, y1: number) => z.push({ id, mul, ...this.rectW(x0, y0, x1, y1) });
    // Underside first (what shots from below meet), then the upper hull.
    add('belly', 1, -58, 8, -38, WHEELS);
    if (this.bayState > 0) add('bay', 1.8, -37, 12, -5, 26);
    else add('belly', 1, -37, 8, -5, 18);
    add('pod', this.podState === 1 || this.podState === 2 ? 1.7 : 1, -4, 8, 29, 20);
    add('belly', 1, 30, 8, 48, WHEELS);
    add('gun', 1, 56, 14, 72, 22);
    if (this.dmgState >= 2) {
      add('breach', 1.6, -76, 3, -54, 17);
      add('stump', 1.6, -84, -32, -46, -20);
    } else {
      add('hull', 1, -76, 3, -59, 12);
      add('pylon', 1, -84, -44, -46, -22);
    }
    add('hull', 1, -92, -22, 84, 8);
    add('head', 1, 49, 8, 84, 14);
    this.zones = z;
  }

  override deathArea(): { x: number; y: number; w: number; h: number } {
    return this.rectW(-92, -26, 84, 18);
  }

  private gunPivot(): { x: number; y: number } {
    return this.toWorld(P.gun[0], P.gun[1]);
  }

  /** World aim angle of the chin gun (facing-adjusted). */
  private gunWorldAngle(): number {
    const a = this.gunAng + this.tiltQ;
    return this.facing > 0 ? a : Math.PI - a;
  }

  private muzzle(): { x: number; y: number } {
    const g = this.gunPivot();
    const a = this.gunWorldAngle();
    return { x: g.x + Math.cos(a) * 21, y: g.y + Math.sin(a) * 21 };
  }

  private get tune(): Tuning {
    return TUNE[Math.min(TUNE.length - 1, this.phase)];
  }

  private delay(base: number): number {
    return base * this.world.difficulty.enemyFireDelay;
  }

  private shotSpeed(base: number): number {
    return base * this.world.difficulty.enemyShotSpeed;
  }

  private clampX(x: number): number {
    const lo = this.arenaL + (this.facing < 0 ? NOSE_M : TAIL_M);
    const hi = this.arenaR - (this.facing > 0 ? NOSE_M : TAIL_M);
    return lo <= hi ? clamp(x, lo, hi) : (this.arenaL + this.arenaR) / 2;
  }

  private alt(a: number): number {
    return this.groundY - a;
  }

  // ------------------------------------------------------------------ hits

  override applyHit(d: Damage, mul: number, id: string): boolean {
    const r = super.applyHit(d, mul, id);
    if (r) {
      if ((id === 'hull' || id === 'belly' || id === 'head' || id === 'pylon') && this.hullFlashCd <= 0) {
        this.hullFlash = 0.05;
        this.hullFlashCd = 0.2;
      }
      if (d.kind === 'explosion' || d.amount >= 4) {
        this.joltX += (d.dir ?? 0) * 1.5;
        this.joltY -= 1.5;
        this.world.shake(1.5, 0.15);
      }
    }
    return r;
  }

  // ------------------------------------------------------------------ phases & damage states

  onPhase(phase: number, prev: number): void {
    if (phase >= 1 && prev < 1) this.startTear();
    if (phase >= 2 && prev < 2) {
      if (this.state === 'tear') this.burnAfterTear = true; // finish the tear first, burn right after
      else this.startBurn();
    }
  }

  private cancelAttack(): void {
    this.aimLine = false;
    this.gunSpinV = 0;
    if (this.podState === 1 || this.podState === 2) this.podState = 3;
    this.bayState = 0;
    this.shotsLeft = 0;
  }

  private startTear(): void {
    this.cancelAttack();
    this.setState('tear');
    this.seqStep = 0;
  }

  private startBurn(): void {
    this.cancelAttack();
    this.setState('burn');
    this.seqStep = 0;
  }

  private throwPlate(lx: number, ly: number, frame: number, burn = false): void {
    const p = this.toWorld(lx, ly);
    const dir = this.facing * (fxRng.chance(0.5) ? 1 : -1);
    this.world.add(new FlyingPart('bm2_plate', frame, p.x, p.y, dir * fxRng.range(40, 110), fxRng.range(-170, -90), { burn, life: 2.6, groundY: this.groundY }));
    sparkBurst(this.world, p.x, p.y, 6, '#ffe080', 120);
  }

  private damageProgress(): void {
    const f = this.hpFrac;
    const once = (k: string, cond: boolean, fn: () => void) => {
      if (cond && !this.dmgEvents.has(k)) {
        this.dmgEvents.add(k);
        fn();
      }
    };
    once('p85', f < 0.85, () => {
      this.throwPlate(-20, -12, 0);
      bsfx(this, 'metal_hit', { vol: 0.7, pitch: 0.8 });
    });
    once('p70', f < 0.7, () => {
      if (this.dmgState < 1) this.dmgState = 1;
      this.throwPlate(-19, -11, 1);
      this.throwPlate(34, 0, 0);
      const p = this.toWorld(30, -2);
      this.world.explode(p.x, p.y, { radius: 12, damage: 0, team: 'enemy', size: 'small', shake: 2, sfx: 'explosion_small' });
    });
    once('p35', f < 0.35, () => {
      this.throwPlate(-40, -10, 2, true);
      this.throwPlate(56, -18, 0, true);
      const p = this.toWorld(-40, -10);
      this.world.explode(p.x, p.y, { radius: 14, damage: 0, team: 'enemy', size: 'medium', shake: 3, sfx: 'explosion' });
    });
  }

  // ------------------------------------------------------------------ main loop

  think(dt: number): void {
    const T = this.tune;
    const t = this.target();
    this.hullFlash -= dt;
    this.hullFlashCd -= dt;
    this.bob += dt;
    this.joltX *= Math.pow(0.002, dt);
    this.joltY *= Math.pow(0.002, dt);
    if (this.introDone) this.damageProgress();

    // Default flight targets (states override).
    let maxV = 100;
    let maxVy = 70;
    let wantTilt: number | null = null;
    const px = t ? t.x : (this.arenaL + this.arenaR) / 2;

    switch (this.state) {
      case 'intro': {
        maxV = 175;
        maxVy = 60;
        this.tx = (this.arenaL + this.arenaR) / 2 - this.facing * 30;
        this.ty = this.alt(ALT_MID);
        if (this.stateTime > 2.6 || (this.stateTime > 1.4 && Math.abs(this.x - this.tx) < 10 && Math.abs(this.vx) < 30)) {
          this.finishIntro();
          this.attackCd = this.delay(0.9);
          this.setState('hover');
        }
        break;
      }
      case 'hover': {
        const off = 26 + Math.sin(this.bob * 0.7) * 18;
        this.tx = this.clampX(px - this.facing * off);
        this.ty = this.alt(ALT_MID) + Math.sin(this.bob * 1.9) * 3;
        if (t && (px - this.x) * this.facing < -70) this.behindT += dt;
        else this.behindT = Math.max(0, this.behindT - dt);
        this.attackCd -= dt;
        if (t && this.behindT > 1.3) {
          this.startTurn('hover');
          break;
        }
        if (this.attackCd <= 0 && t && this.introDone) this.chooseAttack(t);
        break;
      }
      case 'turn': {
        maxV = 50;
        const k = clamp(this.stateTime / 0.6, 0, 1);
        this.sx = this.turnFrom * Math.cos(Math.PI * k);
        if (Math.abs(this.sx) < 0.05) this.sx = this.sx < 0 ? -0.05 : 0.05;
        if (k >= 0.5) this.facing = (-this.turnFrom) as 1 | -1;
        this.tx = this.x;
        this.ty = this.alt(ALT_MID);
        if (k >= 1) {
          this.sx = this.facing;
          this.behindT = 0;
          this.setState(this.afterTurn);
        }
        break;
      }
      // ---------------------------------------------------------- chin-gun sweep
      case 'sweepMove': {
        maxV = 130;
        this.tx = this.clampX(px - this.facing * 132);
        this.ty = this.alt(ALT_MID);
        this.gunAng += (0.9 - this.gunAng) * Math.min(1, dt * 4);
        if ((Math.abs(this.x - this.tx) < 14 && Math.abs(this.y - this.ty) < 10) || this.stateTime > 1.3) {
          this.setState('sweepAim');
          this.aimLine = true;
          bsfx(this, 'boss_charge', { vol: 0.75 });
          const g = this.gunPivot();
          const h = Math.max(30, this.groundY - g.y);
          this.sweepA1 = 1.3;
          this.sweepA0 = clamp(Math.atan2(h, 205), 0.2, 0.6);
          this.gunSpinV = 4;
        }
        break;
      }
      case 'sweepAim': {
        this.tx = this.x;
        this.ty = this.alt(ALT_MID);
        wantTilt = 0.06;
        const dur = this.delay(T.sweepAim);
        const k = clamp(this.stateTime / dur, 0, 1);
        this.aimA = this.sweepA1 + (this.sweepA0 - this.sweepA1) * k;
        this.gunSpinV = 4 + 26 * k;
        if (k >= 1 && this.stateTime > dur + 0.22) {
          this.aimLine = false;
          this.setState('sweepFire');
          this.sweepPass = 0;
          this.fireT = 0;
        }
        break;
      }
      case 'sweepFire': {
        this.tx = this.x;
        this.ty = this.alt(ALT_MID);
        wantTilt = 0.06;
        const dur = T.sweepFire;
        const k = clamp(this.stateTime / dur, 0, 1);
        const fwd = this.sweepPass % 2 === 0;
        this.aimA = fwd ? this.sweepA0 + (this.sweepA1 - this.sweepA0) * k : this.sweepA1 + (this.sweepA0 - this.sweepA1) * k;
        this.gunSpinV = 30;
        this.fireT -= dt;
        if (this.fireT <= 0 && k < 1) {
          this.fireT += T.sweepIv;
          this.fireChin(this.shotSpeed(T.sweepSpeed));
        }
        if (k >= 1) {
          this.sweepPass++;
          if (this.sweepPass < T.sweepPasses) {
            this.stateTime = 0;
            this.fireT = 0.12;
          } else this.endAttack(this.delay(T.hover));
        }
        break;
      }
      // ---------------------------------------------------------- missile salvo
      case 'salvoOpen': {
        this.tx = this.clampX(px - this.facing * 40);
        this.ty = this.alt(ALT_MID + 6);
        this.podState = this.stateTime < 0.2 ? 1 : 2;
        if (this.stateTime > this.delay(0.55)) {
          this.setState('salvoFire');
          this.shotsLeft = T.salvoN;
          this.fireT = 0;
        }
        break;
      }
      case 'salvoFire': {
        this.tx = this.x;
        this.ty = this.alt(ALT_MID + 6);
        this.fireT -= dt;
        if (this.fireT <= 0 && this.shotsLeft > 0) {
          this.fireT = this.delay(T.salvoGap);
          this.shotsLeft--;
          this.launchMissile(t);
        }
        if (this.shotsLeft <= 0 && this.fireT <= 0) {
          this.podState = 3;
          this.startReload();
        }
        break;
      }
      // ---------------------------------------------------------- carpet bombing
      case 'carpetGo': {
        maxV = 165;
        maxVy = 90;
        this.tx = this.runDir > 0 ? this.arenaL + 34 : this.arenaR - 34;
        this.ty = this.alt(ALT_HIGH);
        if ((Math.abs(this.x - this.tx) < 16 && Math.abs(this.y - this.ty) < 12) || this.stateTime > 2.6) {
          this.setState('carpetOpen');
          bsfx(this, 'alarm', { vol: 0.6 });
        }
        break;
      }
      case 'carpetOpen': {
        this.tx = this.runDir > 0 ? this.arenaL + 34 : this.arenaR - 34;
        this.ty = this.alt(ALT_HIGH);
        this.bayState = this.stateTime < 0.25 ? 1 : 2;
        if (this.stateTime > this.delay(0.7)) {
          this.setState('carpetRun');
          const edge = this.runDir > 0 ? this.arenaL : this.arenaR;
          this.nextDropX = edge + this.runDir * (18 + this.world.rng.range(0, 34));
        }
        break;
      }
      case 'carpetRun': {
        const sp = T.runSpeed;
        this.vx += (this.runDir * sp - this.vx) * Math.min(1, dt * 3);
        this.tx = this.x + this.vx * 0.5;
        maxV = sp;
        this.ty = this.alt(ALT_HIGH) + Math.sin(this.bob * 2.3) * 2;
        const bay = this.toWorld(P.bay[0], P.bay[1]);
        if ((bay.x - this.nextDropX) * this.runDir >= 0) {
          if (bay.x > this.arenaL + 10 && bay.x < this.arenaR - 10) this.dropBomb(bay.x, bay.y + 3);
          this.nextDropX += this.runDir * BOMB_GAP;
        }
        const end = this.runDir > 0 ? this.arenaR - 34 : this.arenaL + 34;
        if ((this.x - end) * this.runDir >= 0 || this.stateTime > 6) {
          this.setState('carpetEnd');
        }
        break;
      }
      case 'carpetEnd': {
        this.tx = this.runDir > 0 ? this.arenaR - 40 : this.arenaL + 40;
        this.ty = this.alt(ALT_HIGH);
        this.bayState = this.stateTime < 0.3 ? 1 : 0;
        if (this.stateTime > 0.7) {
          this.bayState = 0;
          this.startReload();
        }
        break;
      }
      // ---------------------------------------------------------- missile rain (phase 2+)
      case 'rainOpen': {
        this.tx = this.clampX((this.arenaL + this.arenaR) / 2 + this.facing * 10);
        this.ty = this.alt(ALT_MID + 8);
        this.podState = this.stateTime < 0.2 ? 1 : 2;
        if (this.stateTime > this.delay(0.6)) {
          this.setState('rainFire');
          this.rainSlots = this.pickRainSlots(px, T.rainN);
          this.fireT = 0;
        }
        break;
      }
      case 'rainFire': {
        this.tx = this.x;
        this.ty = this.alt(ALT_MID + 8);
        this.fireT -= dt;
        if (this.fireT <= 0 && this.rainSlots.length) {
          this.fireT = 0.13;
          this.launchRain(this.rainSlots.shift()!);
        }
        if (!this.rainSlots.length && this.fireT <= 0) {
          this.podState = 3;
          this.startReload();
        }
        break;
      }
      // ---------------------------------------------------------- vulnerable re-arm window
      case 'reload': {
        maxV = 115;
        this.tx = this.clampX(px - this.facing * 18);
        this.ty = this.alt(ALT_LOW) + Math.sin(this.bob * 2.2) * 2;
        if (this.stateTime > 0.7 && this.podState === 3) {
          this.podState = 0;
          const pm = this.toWorld(P.podMouth[0], P.podMouth[1]);
          smoke(this.world, pm.x, pm.y, { n: 4, color: '#e8e4dc', color2: '#a8a4a0', vy: -14, life: 0.6 });
          bsfx(this, 'shell_casing', { vol: 0.5, pitch: 0.7 });
        }
        if (this.stateTime > this.delay(T.reload)) {
          this.podState = 0;
          this.endAttack(this.delay(0.55));
        }
        break;
      }
      // ---------------------------------------------------------- scripted phase changes
      case 'tear':
        this.tearSequence(dt, px);
        maxV = 60;
        maxVy = 110;
        break;
      case 'burn':
        this.burnSequence(dt);
        maxV = 60;
        maxVy = 110;
        break;
    }

    // ---- erratic flight once the aft rotor is gone
    let ex = 0;
    let ey = 0;
    if (this.phase >= 1 && this.state !== 'intro') {
      const b = this.bob;
      ex = Math.sin(b * 1.13) * 8 + Math.sin(b * 2.9) * 3;
      ey = Math.sin(b * 1.71) * 6 + Math.sin(b * 4.3) * 3;
      this.lurchT -= dt;
      if (this.lurchT <= 0 && this.state !== 'carpetRun') {
        this.lurchT = this.world.rng.range(1.6, 3.2);
        this.vy += 55;
        this.tilt += this.world.rng.sign() * 0.08;
        const s = this.toWorld(P.stump[0], P.stump[1]);
        sparkBurst(this.world, s.x, s.y, 8, '#ffd070', 140);
        bsfx(this, 'metal_hit', { vol: 0.45, pitch: 0.6 });
      }
    }
    const gx = this.state === 'intro' ? this.tx : clamp(this.tx + ex, this.arenaL + 26, this.arenaR - 26);
    this.flyTo(dt, gx, this.ty + ey, maxV, maxVy);
    if (this.y > this.groundY - MIN_ALT) {
      this.y = this.groundY - MIN_ALT;
      this.vy = Math.min(0, this.vy);
    }

    // ---- tilt: nose down when moving forward, wobble in phase 2+
    let want = wantTilt ?? clamp((this.vx * this.facing) / 110, -1, 1) * 0.12;
    if (this.phase >= 1) want += Math.sin(this.bob * 7.3) * 0.045 + Math.sin(this.bob * 12.1) * 0.02;
    this.tilt += (want - this.tilt) * Math.min(1, dt * 5);
    this.ti = this.quantTilt(this.tilt);

    // ---- chin gun aim
    let gunWant = 0.5;
    if (this.state === 'sweepAim' || this.state === 'sweepFire') gunWant = this.aimA - this.tiltQ;
    else if (this.state === 'sweepMove') gunWant = 0.9;
    gunWant = clamp(gunWant, 0, GUN_MAX);
    const gr = this.state === 'sweepFire' || this.state === 'sweepAim' ? 12 : 3;
    this.gunAng += clamp(gunWant - this.gunAng, -gr * dt, gr * dt);
    if (this.state !== 'sweepAim' && this.state !== 'sweepFire') this.gunSpinV = Math.max(0, this.gunSpinV - dt * 20);
    this.gunSpinA += this.gunSpinV * dt;

    this.ambient(dt);
  }

  private quantTilt(a: number): number {
    let best = 0;
    for (let i = 1; i < NT; i++) if (Math.abs(TILTS[i] - a) < Math.abs(TILTS[best] - a)) best = i;
    return best;
  }

  /** Damped spring toward (gx, gy) with speed limits. */
  private flyTo(dt: number, gx: number, gy: number, maxV: number, maxVy: number): void {
    const k = 2.4;
    const ax = (gx - this.x) * k * k - this.vx * 2 * k * 0.85;
    const ay = (gy - this.y) * k * k * 1.3 - this.vy * 2 * k;
    if (this.state !== 'carpetRun') this.vx = clamp(this.vx + ax * dt, -maxV, maxV);
    this.vy = clamp(this.vy + ay * dt, -maxVy, maxVy + (this.phase >= 1 ? 40 : 0));
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.maxV = maxV;
    this.maxVy = maxVy;
  }

  private startTurn(after: string): void {
    this.turnFrom = this.facing;
    this.afterTurn = after;
    this.setState('turn');
  }

  private endAttack(cd: number): void {
    this.aimLine = false;
    this.attackCd = cd;
    this.setState('hover');
  }

  private startReload(): void {
    this.setState('reload');
  }

  /** Can the chin gun get the player in front of it (after repositioning)? */
  private sweepFeasible(px: number): boolean {
    const tx = this.clampX(px - this.facing * 132);
    const gunX = tx + this.facing * P.gun[0];
    return (px - gunX) * this.facing > 36;
  }

  private chooseAttack(t: Entity): void {
    const behind = (t.x - this.x) * this.facing < -40;
    if (behind && this.world.rng.chance(0.5)) {
      // Swing round to face the player, then pick again.
      this.attackCd = 0.25;
      this.startTurn('hover');
      return;
    }
    const opts: [Attack, number][] = [];
    if (!behind && this.sweepFeasible(t.x)) opts.push(['sweep', 3]);
    opts.push(['salvo', 2.4]);
    opts.push(['carpet', 2]);
    if (this.phase >= 1) opts.push(['rain', 2.6]);
    const pool = opts.filter(([a]) => a !== this.lastAttack);
    const pick = this.world.rng.weighted(pool.length ? pool : opts);
    this.lastAttack = pick;
    this.attackLog.push(pick);
    switch (pick) {
      case 'sweep':
        this.setState('sweepMove');
        break;
      case 'salvo':
        this.setState('salvoOpen');
        bsfx(this, 'boss_charge', { vol: 0.55, pitch: 1.2 });
        break;
      case 'carpet':
        this.runDir = this.facing;
        this.setState('carpetGo');
        break;
      case 'rain':
        this.setState('rainOpen');
        bsfx(this, 'warning', { vol: 0.55 });
        break;
    }
  }

  // ------------------------------------------------------------------ weapons

  private fireChin(speed: number): void {
    if (!this.world.activePlayers().length) return;
    const m = this.muzzle();
    const a = this.gunWorldAngle();
    this.world.add(new EnemyBullet(this, m.x, m.y, a, speed));
    const fx = this.world.effect('muzzle_flash', m.x, m.y, { fps: 30 });
    fx.rot = a;
    bsfx(this, 'heli_gun', { vol: 0.5 });
    const g = this.gunPivot();
    this.world.particles.add({ kind: 'px', x: g.x, y: g.y + 2, vx: -this.facing * fxRng.range(20, 60), vy: fxRng.range(-50, -10), life: 0.7, color: '#d4a23a', gravity: 520 });
  }

  private launchMissile(t: Entity | null): void {
    const pm = this.toWorld(P.podMouth[0], P.podMouth[1]);
    const lockX = clamp(t ? t.x : this.x, this.arenaL + 12, this.arenaR - 12);
    const gy = this.floorAt(lockX);
    const m = new LockMissile({
      owner: this,
      x: pm.x,
      y: pm.y,
      vx: this.facing * 55 + this.vx * 0.4,
      vy: 30,
      tx: lockX,
      ty: gy,
      sprite: 'bm2_missile',
      drop: 0.3,
      speed: 50,
      topSpeed: Math.min(220, this.shotSpeed(205)),
      accel: 250,
      turn: 4.6,
      steer: 0.95,
      radius: 15,
    });
    this.world.add(m);
    const mk = this.world.add(new LockMark(lockX, gy, 1.4, 9));
    mk.watch = m;
    smoke(this.world, pm.x, pm.y, { n: 3, color: '#e8e0d0', color2: '#8a8480', vy: -6, life: 0.5 });
    bsfx(this, 'metal_hit', { vol: 0.35, pitch: 1.5 });
  }

  /** Free slots: the player's slot is hit, but a neighbour is always left free (plus one more). */
  private pickRainSlots(px: number, n: number): number[] {
    const slots: number[] = [];
    const count = Math.floor((this.arenaR - this.arenaL) / SLOT);
    for (let i = 0; i < count; i++) slots.push(this.arenaL + SLOT / 2 + i * SLOT + (this.arenaR - this.arenaL - count * SLOT) / 2);
    let pi = 0;
    for (let i = 1; i < slots.length; i++) if (Math.abs(slots[i] - px) < Math.abs(slots[pi] - px)) pi = i;
    const rng = this.world.rng;
    const free = new Set<number>();
    const nb = pi === 0 ? 1 : pi === slots.length - 1 ? slots.length - 2 : pi + rng.sign();
    free.add(nb);
    while (free.size < Math.max(2, slots.length - n)) free.add(rng.int(0, slots.length - 1));
    if (free.has(pi)) free.delete(pi);
    const hit = slots.filter((_, i) => !free.has(i));
    // Player's slot first, then the rest shuffled.
    hit.sort((a, b) => (a === slots[pi] ? -1 : b === slots[pi] ? 1 : rng.next() - 0.5));
    return hit.slice(0, n);
  }

  private launchRain(x: number): void {
    const pm = this.toWorld(P.podMouth[0], P.podMouth[1]);
    const gy = this.floorAt(x);
    const m = new LockMissile({
      owner: this,
      x: pm.x,
      y: pm.y,
      vx: this.facing * this.world.rng.range(-10, 50),
      vy: -205,
      tx: x,
      ty: gy,
      sprite: 'bm2_missile',
      drop: 0.56,
      speed: 40,
      topSpeed: Math.min(235, this.shotSpeed(220)),
      accel: 320,
      turn: 7,
      steer: 1.1,
      radius: 15,
    });
    this.world.add(m);
    const mk = this.world.add(new LockMark(x, gy, 1.7, 10));
    mk.watch = m;
    smoke(this.world, pm.x, pm.y, { n: 3, color: '#e8e0d0', color2: '#8a8480', vy: -16, life: 0.5 });
    bsfx(this, 'enemy_rocket', { vol: 0.4, pitch: 1.2 });
  }

  private dropBomb(x: number, y: number): void {
    if (!this.world.activePlayers().length) return;
    const vxb = this.vx * 0.35;
    const gy0 = this.floorAt(x);
    const T = Math.sqrt((2 * Math.max(20, gy0 - y)) / BOMB_G);
    const tx = x + vxb * T;
    const gy = this.floorAt(tx);
    const Tf = Math.sqrt((2 * Math.max(20, gy - y)) / BOMB_G);
    this.world.add(new CarpetBomb(this, x, y, tx, gy, Tf, BOMB_G));
    bsfx(this, 'mortar_whistle', { vol: 0.4, pitch: 1.15 });
  }

  private floorAt(x: number): number {
    const g = this.world.terrain.groundTopAt(x);
    return isFinite(g) ? g : this.groundY;
  }

  // ------------------------------------------------------------------ scripted sequences

  private tearSequence(_dt: number, px: number): void {
    const t = this.stateTime;
    this.tx = this.x;
    this.ty = this.alt(ALT_MID);
    if (this.seqStep === 0) {
      this.seqStep = 1;
      // Rip: the aft rotor pylon blows off and spins away from the player.
      const s = this.toWorld(P.hubR[0], P.hubR[1] + 22);
      this.pylonOn = false;
      this.dmgState = 2;
      this.world.explode(s.x, s.y, { radius: 30, damage: 0, team: 'enemy', size: 'large', shake: 7, sfx: 'explosion_big' });
      this.world.hitstop(0.12);
      this.world.flash('#ffffff', 0.45);
      // It lands inside the arena, well clear of the player (purely cosmetic crash).
      let away = s.x < px ? -1 : 1;
      const flight = (210 + Math.sqrt(210 * 210 + 2 * 330 * Math.max(10, this.groundY - 12 - s.y))) / 330;
      let land = clamp(s.x + away * 70, this.arenaL + 34, this.arenaR - 34);
      if (Math.abs(land - px) < 70) {
        away = -away as 1 | -1;
        land = clamp(px + away * 90, this.arenaL + 34, this.arenaR - 34);
      }
      this.world.add(new TornRotor(s.x, s.y, (land - s.x) / flight, -210, away * 5.5, this.groundY));
      this.world.particles.debris(s.x, s.y, 18, ['#7d7343', '#5a522e', '#4c4e5a', '#e8c02a'], 240);
      this.throwPlate(-60, -24, 1, true);
      this.throwPlate(-70, -20, 2, true);
      bsfx(this, 'alarm', { vol: 0.7 });
      bsfx(this, 'boss_roar', { vol: 0.7, pitch: 0.8 });
      // Lurch: tail drops, the hull sags.
      this.vy = 90;
      this.tilt = -0.14;
      this.rotorSpd = 0.55;
    }
    if (t > 0.5 && this.seqStep === 1) {
      this.seqStep = 2;
      this.rotorSpd = 1.15;
    }
    if (t > 2.1) {
      this.rotorSpd = 1.1;
      const burnNext = this.burnAfterTear || (this.phase >= 2 && this.dmgState < 3);
      this.burnAfterTear = false;
      this.endAttack(this.delay(0.5));
      if (burnNext) this.startBurn();
    }
  }

  private burnSequence(_dt: number): void {
    const t = this.stateTime;
    this.tx = this.x;
    this.ty = this.alt(ALT_MID);
    if (this.seqStep === 0) {
      this.seqStep = 1;
      this.dmgState = 3;
      const e = this.toWorld(34, -30);
      this.world.explode(e.x, e.y, { radius: 24, damage: 0, team: 'enemy', size: 'large', shake: 5, sfx: 'explosion_big' });
      this.world.flash('#ffd0a0', 0.3);
      this.throwPlate(40, -26, 0, true);
      this.throwPlate(10, -18, 2, true);
      bsfx(this, 'alarm', { vol: 0.7 });
      this.vy = 70;
      this.tilt = 0.14;
      this.rotorSpd = 0.7;
    }
    if (t > 0.6) this.rotorSpd = 1.2;
    if (t > 1.2) this.endAttack(this.delay(0.35));
  }

  // ------------------------------------------------------------------ ambience

  private ambient(dt: number): void {
    const w = this.world;
    this.rotorA += dt * Math.PI * 2 * 4.3 * this.rotorSpd;
    this.rotorB += dt * Math.PI * 2 * 4.1 * this.rotorSpd;
    this.rotorSfxT -= dt;
    if (this.rotorSfxT <= 0) {
      this.rotorSfxT = 0.38;
      const sput = this.phase >= 1 ? fxRng.range(0.85, 1.05) : 1;
      bsfx(this, 'heli_rotor', { vol: 0.5, pitch: 0.72 * sput });
    }
    this.fxT -= dt;
    if (this.fxT > 0) return;
    this.fxT = 0.05;
    // Rotor downwash dust when low.
    const lowest = this.y + WHEELS;
    if (this.groundY - lowest < 95) {
      for (const hub of [P.hubF, this.pylonOn ? P.hubR : null]) {
        if (!hub) continue;
        const h = this.toWorld(hub[0], 0);
        const dx = fxRng.range(-50, 50);
        w.particles.add({ kind: 'smoke', x: h.x + dx, y: this.groundY - 2, vx: Math.sign(dx || 1) * fxRng.range(30, 70), vy: fxRng.range(-14, -4), life: fxRng.range(0.5, 0.9), color: '#d8c8a0', color2: '#b8a47c', size: 2, size2: 5, drag: 1.4, alpha: 0.7 });
      }
    }
    // Engine exhaust.
    if (this.pylonOn) {
      const e = this.toWorld(P.exhaust[0], P.exhaust[1]);
      if (fxRng.chance(0.6)) smoke(w, e.x, e.y, { n: 1, size: 1.5, size2: 4, life: 0.5, vx: -this.facing * 30, vy: -8, color: '#9a948c', color2: '#6a6660' });
    }
    // Damage smoke / fire.
    if (this.dmgState >= 1) {
      const h = this.toWorld(-19, -11);
      if (fxRng.chance(0.4)) smoke(w, h.x, h.y, { n: 1, size: 2, size2: 6, life: 0.9, color: '#5a5458', color2: '#34302f' });
      const h2 = this.toWorld(34, 0);
      if (fxRng.chance(0.25)) smoke(w, h2.x, h2.y, { n: 1, size: 1.5, size2: 5, life: 0.7 });
    }
    if (this.dmgState >= 2) {
      const s = this.toWorld(P.stump[0], P.stump[1]);
      flames(w, s.x + fxRng.range(-10, 10), s.y, { n: 1, size: 2.5, life: 0.35 });
      smoke(w, s.x, s.y - 4, { n: 1, size: 3, size2: 10, life: 1.3, vx: -this.facing * 20, vy: -26, color: '#3a3436', color2: '#1e1a1e' });
      if (fxRng.chance(0.12)) sparkBurst(w, s.x + fxRng.range(-12, 12), s.y, 3, '#ffd070', 110);
      const b = this.toWorld(P.breach[0], P.breach[1]);
      if (fxRng.chance(0.3)) flames(w, b.x, b.y + 2, { n: 1, size: 2, life: 0.25, vy: 10 });
    }
    if (this.dmgState >= 3) {
      const f = this.toWorld(34, -30);
      flames(w, f.x + fxRng.range(-6, 6), f.y, { n: 2, size: 2.5, life: 0.4 });
      smoke(w, f.x, f.y - 6, { n: 1, size: 3, size2: 11, life: 1.4, vy: -30, color: '#2e2a2c', color2: '#161216' });
      const h = this.toWorld(fxRng.range(-80, 70), fxRng.range(-18, 6));
      if (fxRng.chance(0.25)) flames(w, h.x, h.y, { n: 1, size: 2, life: 0.3 });
    }
  }

  // ------------------------------------------------------------------ death

  override onDeathStart(): void {
    this.cancelAttack();
    this.podState = 0;
    this.crashed = false;
    this.vy = Math.min(this.vy, 0) - 20;
    const c = (this.arenaL + this.arenaR) / 2;
    this.vx = clamp((c - this.x) * 0.4, -60, 60);
    bsfx(this, 'alarm', { vol: 0.8 });
  }

  override deathSequence(dt: number): void {
    const w = this.world;
    if (!this.crashed) {
      this.rotorSpd = Math.max(0.2, this.rotorSpd - dt * 0.45);
      this.vy = Math.min(this.vy + 150 * dt, 175);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.tilt += (0.13 + Math.sin(this.deathTime * 9) * 0.04 - this.tilt) * Math.min(1, dt * 3);
      this.ti = this.quantTilt(this.tilt);
      const s = this.toWorld(fxRng.range(-80, 60), fxRng.range(-20, 6));
      smoke(w, s.x, s.y, { n: 1, size: 3, size2: 10, life: 1.2, vy: -20, color: '#302c2e', color2: '#18141a' });
      flames(w, s.x, s.y, { n: 2, size: 2.5, life: 0.35 });
      if (this.y + WHEELS - 4 >= this.groundY) this.crash();
    } else {
      this.rotorSpd = Math.max(0, this.rotorSpd - dt * 0.8);
    }
    this.rotorA += dt * Math.PI * 2 * 4.3 * this.rotorSpd;
    this.rotorB += dt * Math.PI * 2 * 4.1 * this.rotorSpd;
    super.deathSequence(dt);
  }

  private crash(): void {
    this.crashed = true;
    this.gunAng = 0.1;
    this.bayState = 0;
    this.y = this.groundY - WHEELS + 5;
    this.vx = 0;
    this.vy = 0;
    this.tilt = 0.06;
    this.ti = this.quantTilt(this.tilt);
    const w = this.world;
    const c = this.toWorld(-4, 10);
    w.explode(c.x, c.y, { radius: 40, damage: 0, team: 'enemy', size: 'huge', shake: 9, sfx: 'explosion_big' });
    w.hitstop(0.1);
    w.flash('#ffe0b0', 0.5);
    for (let i = -3; i <= 3; i++) w.particles.dust(this.x + i * 26, this.groundY, 5, '#d8c8a0');
    for (let i = 0; i < 4; i++) this.throwPlate(fxRng.range(-70, 60), fxRng.range(-20, 0), i % 3, i < 2);
    const hub = this.toWorld(P.hubF[0], P.hubF[1]);
    for (const s of [-1, 1]) w.add(new FlyingPart('boss_debris', 3, hub.x + s * 20, hub.y, s * fxRng.range(100, 170), fxRng.range(-260, -180), { life: 2.4, vr: s * 16, burn: true }));
    bsfxAt(w, 'metal_hit', this.x, { vol: 0.9, pitch: 0.5 });
    bsfx(this, 'glass_break', { vol: 0.7 });
  }

  override onDestroyed(): void {
    const w = this.world;
    const y = this.groundY - WHEELS + 7;
    w.add(
      new Wreck(this.x, y, this.facing, [{ sprite: 'bm2_wreck', frame: 0, dx: 0, dy: 0 }], [
        { dx: -64, dy: -28, fire: true },
        { dx: 34, dy: -34, fire: false },
        { dx: -20, dy: -12, fire: true },
        { dx: 60, dy: -6, fire: false },
        { dx: 6, dy: -20, fire: true },
      ]),
    );
  }

  // ------------------------------------------------------------------ render

  /** Mid-turn: the gunship faces the camera (head-on sprite, rotors edge-on). */
  private renderFront(g: CanvasRenderingContext2D): void {
    const x = Math.round(this.x + this.joltX + this.deathShakeX);
    const y = Math.round(this.y + this.joltY);
    const rf = (a: number) => Math.floor((a / ((Math.PI * 2) / 3)) * ROT_N) % ROT_N;
    const hf = { x, y: y + FRONT_HUB_F[1] };
    const hr = { x, y: y + FRONT_HUB_R[1] };
    if (this.pylonOn) sprites.get('bm2_blur').draw(g, hr.x, hr.y, TILT0, { alpha: 0.24 });
    sprites.get('bm2_blur').draw(g, hf.x, hf.y, TILT0, { alpha: 0.28 });
    if (this.pylonOn) sprites.get('bm2_rotor').draw(g, hr.x, hr.y, TILT0 * ROT_N + rf(this.rotorB));
    sprites.get('bm2_front').draw(g, x, y, this.dmgState);
    if (this.hullFlash > 0) sprites.get('bm2_front').draw(g, x, y, this.dmgState, { flash: true, alpha: 0.4 });
    sprites.get('bm2_rotor').draw(g, hf.x, hf.y, TILT0 * ROT_N + rf(this.rotorA));
    sprites.get('bm2_hub').draw(g, hf.x, hf.y, Math.floor(this.rotorA * 2) % 2);
    if (Math.floor(this.age * 2.2) % 3 === 0) {
      g.fillStyle = '#ff3a2a';
      g.fillRect(x - 1, y - 32, 2, 2);
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    const k = Math.abs(this.sx);
    if (k < FRONT_K) {
      this.renderFront(g);
      return;
    }
    const scaled = k < 0.999;
    const flip = this.sx < 0;
    const ti = this.ti;
    const shakeX = this.deathShakeX;
    if (scaled || shakeX) {
      g.save();
      g.translate(this.x + shakeX, 0);
      g.scale(k, 1);
      g.translate(-this.x, 0);
    }
    const R = (lx: number, ly: number) => this.toWorld(lx, ly, true);
    // Rotor discs (translucent) behind everything.
    const hubF = R(P.hubF[0], P.hubF[1]);
    const hubR = R(P.hubR[0], P.hubR[1]);
    const spinning = this.rotorSpd > 0.25;
    if (spinning) {
      sprites.get('bm2_blur').draw(g, hubF.x, hubF.y, ti, { flip, alpha: 0.28 * Math.min(1, this.rotorSpd) });
      if (this.pylonOn) sprites.get('bm2_blur').draw(g, hubR.x, hubR.y, ti, { flip, alpha: 0.28 });
    }
    // Hull.
    const hull = sprites.get('bm2_hull');
    hull.draw(g, this.x + this.joltX, this.y + this.joltY, this.dmgState * NT + ti, { flip });
    if (this.hullFlash > 0 && !this.dying) hull.draw(g, this.x + this.joltX, this.y + this.joltY, this.dmgState * NT + ti, { flip, flash: true, alpha: 0.4 });
    // Bomb bay, wing pod, chin gun.
    const bay = R(P.bay[0], P.bay[1]);
    sprites.get('bm2_bay').draw(g, bay.x, bay.y, Math.min(BAY_N - 1, this.bayState) * NT + ti, { flip, flash: this.flashing('bay') });
    const pod = R(P.pod[0], P.pod[1]);
    sprites.get('bm2_pod').draw(g, pod.x, pod.y, Math.min(POD_N - 1, this.podState) * NT + ti, { flip, flash: this.flashing('pod') });
    const gp = R(P.gun[0], P.gun[1]);
    const ga = clamp(this.gunAng + this.tiltQ, 0, GUN_MAX);
    const gf = Math.round((ga / GUN_MAX) * (GUN_N - 1)) * 2 + (Math.floor(this.gunSpinA) % 2);
    sprites.get('bm2_gun').draw(g, gp.x, gp.y, gf, { flip, flash: this.flashing('gun') });
    // Glows: exhaust (flicker) and the breach.
    if (this.pylonOn) {
      const e = R(P.exhaust[0], P.exhaust[1]);
      sprites.get('bm2_glow').draw(g, e.x, e.y, Math.floor(this.age * 14) % 3, { alpha: 0.9 });
    }
    if (this.dmgState >= 2) {
      const b = R(P.breach[0], P.breach[1]);
      sprites.get('bm2_glow').draw(g, b.x, b.y, Math.floor(this.age * 10) % 3, { alpha: 0.75 + 0.25 * Math.sin(this.age * 9), flash: this.flashing('breach') });
    }
    // Rotor blades + hubs on top.
    const rf = (a: number) => Math.floor((a / ((Math.PI * 2) / 3)) * ROT_N) % ROT_N;
    if (!this.crashed) sprites.get('bm2_rotor').draw(g, hubF.x, hubF.y, ti * ROT_N + rf(this.rotorA), { flip });
    sprites.get('bm2_hub').draw(g, hubF.x, hubF.y, Math.floor(this.rotorA * 2) % 2, { flip });
    if (this.pylonOn) {
      sprites.get('bm2_rotor').draw(g, hubR.x, hubR.y, ti * ROT_N + rf(this.rotorB), { flip });
      sprites.get('bm2_hub').draw(g, hubR.x, hubR.y, Math.floor(this.rotorB * 2) % 2, { flip });
    }
    // Beacon + tail light.
    if (!this.dying || this.deathTime < 1) {
      const bc = R(P.beacon[0], P.beacon[1]);
      if (Math.floor(this.age * 2.2) % 3 === 0) {
        g.fillStyle = '#ff3a2a';
        g.fillRect(Math.round(bc.x) - 1, Math.round(bc.y) - 1, 2, 2);
        pixelEllipse(g, bc.x, bc.y, 4, 3, '#ff5a3a', 0.35);
      }
      const tl = R(P.tailLight[0], P.tailLight[1]);
      if (Math.floor(this.age * 2.2 + 1.5) % 3 === 0) {
        g.fillStyle = '#ffd040';
        g.fillRect(Math.round(tl.x), Math.round(tl.y) - 1, 1, 2);
      }
    }
    if (scaled || shakeX) g.restore();
    // Sight line telegraph (world space).
    if (this.aimLine && !this.dying) this.renderAimLine(g);
  }

  private renderAimLine(g: CanvasRenderingContext2D): void {
    const m = this.muzzle();
    const a = this.facing > 0 ? this.aimA : Math.PI - this.aimA;
    const dy = Math.sin(a);
    if (dy <= 0.01) return;
    const dist = (this.groundY - m.y) / dy;
    const ex = m.x + Math.cos(a) * dist;
    const ey = this.groundY - 1;
    const blink = Math.floor(this.age * 16) % 2 === 0;
    dottedLine(g, m.x, m.y, ex, ey, blink ? '#ff3a2a' : '#ff8a5a', 5, 3, -this.age * 40);
    pixelEllipse(g, ex, ey, 6, 2, '#ff3020', 0.45);
    g.fillStyle = blink ? '#ffe060' : '#ff3a2a';
    g.fillRect(Math.round(ex) - 1, Math.round(ey) - 2, 3, 3);
    g.fillRect(Math.round(ex) - 4, Math.round(ey) - 1, 2, 1);
    g.fillRect(Math.round(ex) + 3, Math.round(ey) - 1, 2, 1);
  }
}

registerEntity(
  'boss_m2',
  'boss',
  () => new HornetKing(),
  'HORNET KING twin-rotor heavy gunship (Mission 2 boss, flying, 320 HP x difficulty, 30000 pts). Flies in from the RIGHT edge on its own (props.from = "left" for the other side; spawn x/y are ignored), not hittable during its ~2.6 s entrance. Telegraphed chin-gun sweeps (red sight line; safe under/behind the hull), lock-on missile salvos (keep moving / shoot them), carpet-bombing runs with ground shadows every 64 px, low re-arm hover after salvos/runs (grenade window); 50%: aft rotor tears off and crashes -> erratic flight, double sweeps, missile rain on marked 48 px slots; 20%: burning, faster. Crashes and burns on death. ARENA: flat open ground over the whole locked screen [lock.x, lock.x+384] (ground y ~184 in a 216-tall level, camera at the bottom, no camera keys), no platforms/solids/water/pits there (bombs, missiles and shadows need the floor; nothing to stand on above it), 150+ px of flat ground beyond both edges is nice for the torn rotor; sky clear. Lock: { boss: true, music: "boss", announce: "WARNING! ..." } - the boss never calls world.announce. Spawn it in the first wave (delay ~1 s), e.g. { type: "boss_m2", x: lock.x + 500 }.',
);
