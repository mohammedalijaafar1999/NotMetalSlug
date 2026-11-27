// boss_m1 — GRINDER (Mission 1, Palm Harbor): the Rustcoat Legion's steam war-dozer.
// The first boss of the game, so the most forgiving one: every attack has a long, loud tell.
//
// Fight (one-screen ground arena; the Grinder parks against the right edge facing left, and its
// hull is SOLID - players are pushed out, nobody can get inside or behind it):
//  - Entrance (2.6 s, not hittable): drives in from beyond the right edge under a WARNING banner
//    (world.announce), lurches to a stop and blasts its steam horn (boss_roar).
//  - CANNON VOLLEY: the turret elevates and lobs 2/3/4 arcing shells, each with a landing shadow +
//    blinking marker 1.1-1.3 s ahead. Keep moving.
//  - HATCH: the commander hatch flips open and riflemen leap out in front of the blade (max 2/3).
//  - BLADE CHARGE: telegraphed for 1.45/1.25/1.15 s (engine revs, pistons hammer, black smoke,
//    treads spin in place, blade drops, the grinder drum spins up throwing sparks, red beacon,
//    headlamp) and a blinking chevron lane on the ground that ends at a hazard post: the blade stops
//    exactly there, 74/60/50 px from the left edge. Stand left of the post. The charge flattens the
//    Legion's own troops. It slams to a stop, sputters, then backs up slowly (amber lamp, beeps).
//  - FLAME VENTS (phase 2+): nozzles in the blade glow and hiss for 0.8/0.65 s, then a ground-hugging
//    flame jet 96/108 px forward for 1.1/1.3 s. Back off toward the left edge.
//  - Weak point: the smoke stack on the boiler (x2; jump-shots near the apex, grenades on the boiler).
//    The armour plates (blade, hull, turret) shrug off part of every blast and flame (x0.6) until they
//    fly off at 25%, so a hoard of grenades dumped on the blade does not scrap it in seconds; blasts on
//    the boiler (lob them over the blade with UP) and the stack bite in full. At 75% a skirt plate is
//    torn off; at 50% the stack blows off (the burning stub stays a x2 weak
//    point) and the turret catches fire; at 25% the armour plates fly off (every hit +30%), the boiler
//    vents steam and the attacks come faster (shells while reversing).
//  - Death (4.4 s): shudders, the crew bails out and flees, stack / hatch / barrel / turret blow off,
//    the blade drops, it settles into the ground, then a huge blast leaves a burning wreck.
//
// ARENA REQUIREMENTS (mission designers) - see also the test arena levels/test/bosstest_m1.ts:
//  - Boss lock { x: L, boss: true, waves: [{ spawns: [{ type: 'boss_m1', x: L + 282 }] }] } with the
//    level ending at (or continuing flat past) L + 384. NO `announce` on the lock (the boss shows its
//    own WARNING banner). LevelDef.bossMusic 'boss' (default) and bossName 'GRINDER'.
//  - FLAT ground across the whole arena [L, L + 384] (no pits, solids, water, platforms or props);
//    any ground height works (y 170-190 in a 216-tall level). The spawn x is its resting hull centre
//    (clamped to L + 250 .. L + 282, rear against the right edge); y is read from the ground. It drives
//    in from off-screen right, so the ground must continue (or at least the camera must be locked) there.
//  - Camera: bottom of the level (camera top = ground - ~184 or lower); the stack top is 113 px above
//    the ground: keep at least ~120 px of open sky above the ground line.
//  - Keep the left 80 px of the arena clear (the charge safe pocket).

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { rectsOverlap, type Rect } from '../../engine/math';
import { Entity } from '../../game/entity';
import { Enemy } from '../../game/enemy';
import { Z, type Damage } from '../../game/constants';
import { registerEntity } from '../../game/registry';
import { SF } from '../../art/soldier';
import { BigBoss, FlyingPart, Lobbed, Wreck, bsfx, flames, smoke, sparkBurst, type Zone } from './common/kit';
import { pixelEllipse, puffSteam } from './common/fx';
import { GR, bladeBottomRel, bladeFrameBottomRel } from './m1/grinder_art';

/** Per-phase tuning. Times in s, speeds in px/s, distances in px. */
export const GRINDER_PHASES = [
  { idle: 1.15, rev: 1.45, charge: 160, pocket: 74, stuck: 1.0, back: 58, shells: 2, shellTime: 1.3, shellGap: 0.65, troops: 1, maxTroops: 2, flameLen: 0, flameDur: 0, flameTel: 0 },
  { idle: 0.85, rev: 1.25, charge: 190, pocket: 60, stuck: 0.8, back: 70, shells: 3, shellTime: 1.2, shellGap: 0.52, troops: 2, maxTroops: 3, flameLen: 96, flameDur: 1.1, flameTel: 0.8 },
  { idle: 0.55, rev: 1.15, charge: 215, pocket: 50, stuck: 0.6, back: 84, shells: 4, shellTime: 1.1, shellGap: 0.44, troops: 1, maxTroops: 3, flameLen: 108, flameDur: 1.3, flameTel: 0.65 },
];
const PH = GRINDER_PHASES;

const BASE_HP = 380;
const INTRO_DRIVE = 1.9;
const INTRO_TIME = 2.6;
const CHARGE_ACCEL = 600;
const DUST = '#b89c70';
/** Blast / fire damage taken by the armoured zones (blade, hull, turret) until the plates fly off. */
export const GRINDER_ARMOUR_BLAST = 0.6;

export type GrinderAttack = 'volley' | 'deploy' | 'charge' | 'flame';
type Attack = GrinderAttack;
type Group = 'hull' | 'boiler' | 'turret' | 'stack' | 'blade';

/** A soldier leaping out of the hatch; becomes a real rifleman when he lands. */
class HatchTrooper extends Entity {
  boss: Grinder;

  constructor(boss: Grinder, x: number, y: number, vx: number, vy: number) {
    super();
    this.boss = boss;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.w = 12;
    this.h = 26;
    this.facing = vx < 0 ? -1 : 1;
    this.z = Z.ENEMY;
    this.persistent = true;
  }

  override update(dt: number): void {
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const gy = this.boss.groundY;
    if (this.vy > 0 && this.y >= gy) {
      this.y = gy;
      this.world.particles.dust(this.x, gy, 4);
      if (!this.boss.dying && !this.boss.dead) {
        const e = this.world.spawn('rifleman', this.x, gy, { behavior: 'charge', facing: this.facing });
        if (e) this.boss.troopers.push(e);
      }
      this.remove();
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    sprites.get('rifleman').draw(g, this.x, this.y, this.vy < 0 ? SF.PANIC : SF.PANIC + 1, { flip: this.facing < 0 });
  }
}

/** A crewman bailing out of the doomed machine (cosmetic): leaps clear and flees off-screen. */
class Bailout extends Entity {
  private landed = false;
  private gy: number;

  constructor(x: number, y: number, vx: number, vy: number, gy: number) {
    super();
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.gy = gy;
    this.facing = vx < 0 ? -1 : 1;
    this.w = 12;
    this.h = 26;
    this.z = Z.ENEMY;
    this.persistent = true;
  }

  override update(dt: number): void {
    if (!this.landed) {
      this.vy += 900 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.vy > 0 && this.y >= this.gy) {
        this.y = this.gy;
        this.landed = true;
        this.vx = this.facing * 100;
        this.world.particles.dust(this.x, this.gy, 4);
      }
    } else {
      this.x += this.vx * dt;
      if (!this.onScreen(24)) this.remove();
    }
    if (this.age > 6) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const fr = SF.PANIC + (Math.floor(this.age * 12) % 2);
    sprites.get('rifleman').draw(g, this.x, this.y, fr, { flip: this.facing < 0 });
  }
}

/** A big piece of the Grinder that tumbles off and comes to rest lying flat (long parts never stand on end). */
class Scrap extends FlyingPart {
  override update(dt: number): void {
    super.update(dt);
    if (this.resting) this.rot = Math.round(this.rot / Math.PI) * Math.PI;
  }
}

/** Charge telegraph on the ground: chevrons racing toward the hazard post where the blade will stop. */
class ChargeLane extends Entity {
  boss: Grinder;
  stopX: number;
  gy: number;

  constructor(boss: Grinder, stopX: number, gy: number) {
    super();
    this.boss = boss;
    this.stopX = stopX;
    this.gy = gy;
    this.z = Z.BACK_PROP;
    this.persistent = true;
  }

  override update(): void {
    const b = this.boss;
    if (b.dead || b.dying || (b.state !== 'rev' && b.state !== 'charge')) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const dir = this.boss.facing;
    const tip = this.boss.frontX;
    const y = Math.round(this.gy) - 1;
    const span = (this.stopX - tip) * dir;
    const blink = Math.floor(this.age * 10) % 2 === 0;
    g.globalAlpha = Math.min(1, this.age / 0.2) * 0.9;
    if (span > 6) {
      g.fillStyle = blink ? '#ff3a20' : '#ffb030';
      const off = (this.age * 40) % 10;
      for (let s = off + 4; s < span - 3; s += 10) {
        const cx = Math.round(tip + dir * s);
        for (let k = 0; k < 5; k++) {
          const dx = Math.abs(k - 2);
          g.fillRect(dir < 0 ? cx + dx : cx - dx - 1, y - 4 + k, 2, 1);
        }
      }
    }
    // Hazard post on the safe side of the stop line.
    const px = Math.round(this.stopX) - (dir < 0 ? 3 : 0);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 === 0 ? (blink ? '#ffe040' : '#ffb030') : '#140c1c';
      g.fillRect(px, y - 2 * i - 1, 3, 2);
    }
    g.fillStyle = blink ? '#ff3a20' : '#ffe040';
    g.fillRect(px - 1, y - 15, 5, 2);
    g.fillRect(px, y - 13, 3, 1);
    g.globalAlpha = 1;
  }
}

export class Grinder extends BigBoss {
  homeX = 0;
  startX = 0;
  /** Blade lowered fraction 0..1 (and target). */
  bladeLow = 0;
  bladeTarget = 0;
  /** Distance the treads have rolled (animation). */
  treadPhase = 0;
  /** Grinder drum angle and spin rate (rad/s). */
  drumAngle = 0;
  drumRate = 2;
  /** Engine cycle (pistons, exhaust puffs) and its rate in Hz. */
  engPhase = 0;
  rpm = 1.6;
  barrelElev = 0.5;
  barrelTarget = 0.5;
  recoil = 0;
  /** Turret recoil (px towards the rear). */
  turretKick = 0;
  hatch = 0;
  hatchTarget = 0;
  /** Soldier emerging from the hatch 0..1. */
  pop = 0;
  /** Suspension bob (render offset of the upper body) and its velocity. */
  bob = 0;
  bobV = 0;
  jitter = 0;
  headGlow = 0;
  /** Firebox grate glow 0..2. */
  fireGlow = 0;
  beacon: 'off' | 'red' | 'amber' = 'off';
  skirtOff = false;
  stackGone = false;
  armourOff = false;
  turretGone = false;
  barrelGone = false;
  hatchGone = false;
  flameLen = 0;
  /** Current movement speed along x (signed, world). */
  vxMove = 0;
  troopers: Entity[] = [];
  /** Highest phase reached and stats for tests / tuning. */
  maxPhase = 0;
  charges = 0;
  private attacks = 0;
  private lastAttack: Attack | null = null;
  private sinceCharge = 0;
  private shotsLeft = 0;
  private shotT = 0;
  private troopsLeft = 0;
  private fxT = 0;
  private sndT = 0;
  private beepT = 0;
  private pendingStagger = 0;
  private staggerKind = 0;
  private deathFx = 0;
  private sinkY = 0;
  private lastPuff = 0;
  private sway = 0;
  /** Tuning of the attack in progress (a phase change mid-attack never moves the goalposts). */
  private atk = PH[0];
  /** Blade stop line of the charge in progress. */
  private chargeStop = 0;
  /** Attack forced after a phase change (shows off the new move). */
  private nextAttack: Attack | null = null;
  private usedFlame = false;
  /** Last impact point per zone (localised hit flash). */
  private hitAt: Record<string, { x: number; y: number; big: boolean }> = {};

  constructor() {
    super('GRINDER', BASE_HP);
    this.w = 182;
    this.h = 112;
    this.facing = -1;
    this.phaseAt = [0.5, 0.25];
  }

  // ------------------------------------------------------------------ geometry

  get stats() {
    return PH[Math.min(PH.length - 1, this.phase)];
  }

  /** World x of a local x. */
  wx(lx: number): number {
    return this.x + this.facing * lx;
  }

  /** World y of the (bobbing) upper body for a local y. */
  wy(ly: number): number {
    return this.groundY + this.bob + this.sinkY + ly;
  }

  get frontX(): number {
    return this.wx(GR.BLADE_TIP);
  }

  get rearX(): number {
    return this.wx(GR.REAR);
  }

  /** Local y of the blade's bottom edge. */
  get bladeBottom(): number {
    return GR.BLADE_PY + bladeBottomRel(this.bladeLow);
  }

  /** Baked blade position frame (0 raised, 1 mid, 2 lowered). */
  get bladePos(): number {
    return this.bladeLow < 0.25 ? 0 : this.bladeLow < 0.75 ? 1 : 2;
  }

  /** Where the blade tip stops at the end of a charge. */
  get stopX(): number {
    if (this.state === 'rev' || this.state === 'charge' || this.state === 'slam') return this.chargeStop;
    return this.facing < 0 ? this.arenaL + this.stats.pocket : this.arenaR - this.stats.pocket;
  }

  private rectL(lx0: number, ly0: number, lx1: number, ly1: number, upper = true): Rect {
    const a = this.wx(lx0);
    const b = this.wx(lx1);
    const y0 = upper ? this.wy(ly0) : this.groundY + this.sinkY + ly0;
    const y1 = upper ? this.wy(ly1) : this.groundY + this.sinkY + ly1;
    return { x: Math.min(a, b), y: Math.min(y0, y1), w: Math.abs(b - a), h: Math.abs(y1 - y0) };
  }

  layoutZones(): void {
    const z: Zone[] = [];
    const add = (id: string, r: Rect, mul: number) => z.push({ id, mul, x: r.x, y: r.y, w: r.w, h: r.h });
    const bb = this.bladeBottom;
    add('blade', this.rectL(GR.BLADE_PX + GR.BLADE_BX - 2, bb - 36, GR.BLADE_TIP - 1, bb, false), 1);
    add('hull', this.rectL(GR.REAR, -52, 58, -2), 1);
    add('boiler', this.rectL(-12, -66, 60, -52), 1);
    if (!this.turretGone) add('turret', this.rectL(-66 - this.turretKick, -86, -14 - this.turretKick, -52), 1);
    if (!this.stackGone) add('stack', this.rectL(GR.STACK_X - 7, GR.STACK_TOP + 1, GR.STACK_X + 7, GR.STACK_Y - 1), 2);
    else add('stack', this.rectL(GR.STACK_X - 7, GR.STACK_Y - 16, GR.STACK_X + 7, GR.STACK_Y - 1), 2);
    this.zones = z;
  }

  override deathArea(): Rect {
    return this.rectL(GR.REAR + 6, -100, GR.BLADE_TIP - 10, -6);
  }

  // ------------------------------------------------------------------ lifecycle

  override spawned(): void {
    super.spawned();
    this.homeX = this.facing < 0 ? Math.max(this.arenaL + 250, Math.min(this.arenaR - 102, this.x)) : Math.min(this.arenaR - 250, Math.max(this.arenaL + 102, this.x));
    this.startX = this.facing < 0 ? this.arenaR + 120 : this.arenaL - 120;
    this.x = this.startX;
    this.y = this.groundY;
    this.setState('intro');
    this.layoutZones();
  }

  override onPhase(phase: number, prev: number): void {
    this.pendingStagger = phase;
    this.maxPhase = Math.max(this.maxPhase, phase);
    if (prev < 1 && phase >= 1) this.staggerKind |= 1;
    if (phase >= 2) this.staggerKind |= 2;
  }

  // ------------------------------------------------------------------ behaviour

  think(dt: number): void {
    const prevX = this.x;
    switch (this.state) {
      case 'intro':
        this.updateIntro(dt);
        break;
      case 'idle':
        this.updateIdle(dt);
        break;
      case 'volley':
        this.updateVolley(dt);
        break;
      case 'deploy':
        this.updateDeploy(dt);
        break;
      case 'rev':
        this.updateRev(dt);
        break;
      case 'charge':
        this.updateCharge(dt);
        break;
      case 'slam':
        this.updateSlam(dt);
        break;
      case 'reverse':
        this.updateReverse(dt);
        break;
      case 'flame_tel':
      case 'flame':
      case 'flame_end':
        this.updateFlame(dt);
        break;
      case 'stagger':
        this.updateStagger(dt);
        break;
    }
    if (!this.skirtOff && this.hpFrac < 0.75 && this.introDone) this.tearSkirt();
    // Shared animation.
    const moved = this.x - prevX;
    if (this.state !== 'rev') this.treadPhase += moved * this.facing;
    this.bladeLow += Math.sign(this.bladeTarget - this.bladeLow) * Math.min(Math.abs(this.bladeTarget - this.bladeLow), dt * 3.2);
    this.hatch += Math.sign(this.hatchTarget - this.hatch) * Math.min(Math.abs(this.hatchTarget - this.hatch), dt * 5);
    this.barrelElev += (this.barrelTarget - this.barrelElev) * Math.min(1, dt * 7);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.turretKick = Math.max(0, this.turretKick - dt * 10);
    this.drumAngle += this.drumRate * dt;
    this.engPhase += this.rpm * Math.PI * 2 * dt;
    // Suspension spring.
    this.bobV += (-this.bob * 160 - this.bobV * 9) * dt;
    this.bob += this.bobV * dt;
    this.pushPlayers();
    this.ambientFx(dt);
  }

  private crossed(at: number, dt: number): boolean {
    // The first think() after setState() sees stateTime == dt, so an event at 0 fires on that frame.
    return this.stateTime >= at && this.stateTime - dt < at + 1e-9;
  }

  /** The hull is solid: players and their vehicles are pushed out to the front. */
  private pushPlayers(): void {
    const front = this.wx(GR.BLADE_TIP);
    const rear = this.wx(GR.REAR);
    const lo = Math.min(front, rear);
    const hi = Math.max(front, rear);
    const top = this.groundY - 104;
    for (const p of this.world.players) {
      if (!p.isActive) continue;
      const t = p.vehicle ?? p;
      if (t.dead || t.bottom < top) continue;
      if (t.right > lo && t.left < hi) {
        if ((t as { flying?: boolean }).flying) {
          // Flyers may hover over the hull but not sink into it.
          t.y -= t.bottom - top;
          if (t.vy > 0) t.vy = 0;
        } else if (this.facing < 0) {
          t.x = lo - t.w / 2;
          if (t.vx > 0) t.vx = 0;
        } else {
          t.x = hi + t.w / 2;
          if (t.vx < 0) t.vx = 0;
        }
      }
    }
  }

  private updateIntro(dt: number): void {
    const t = this.stateTime;
    this.rpm = 5;
    this.drumRate = 4;
    if (this.crossed(0.05, dt)) {
      bsfx(this, 'warning', { vol: 0.8 });
      this.world.announce('WARNING!', { color: '#ff4040', time: 2.4, sub: 'THE GRINDER APPROACHES' });
    }
    if (t < INTRO_DRIVE) {
      const k = t / INTRO_DRIVE;
      const e = 1 - Math.pow(1 - k, 3);
      this.x = this.startX + (this.homeX - this.startX) * e;
      this.sndT -= dt;
      if (this.sndT <= 0) {
        this.sndT = 0.22;
        bsfx(this, 'tank_tread', { vol: 0.55 });
      }
      if (fxRng.chance(0.5)) this.world.particles.dust(this.rearX - this.facing * 4, this.groundY, 2, DUST);
    } else if (this.x !== this.homeX) {
      this.x = this.homeX;
      // Lurch to a stop.
      this.bobV = 46;
      this.world.shake(3, 0.3);
      this.world.particles.dust(this.frontX, this.groundY, 8, DUST);
      this.world.particles.dust(this.x, this.groundY, 8, DUST);
    }
    if (this.crossed(INTRO_DRIVE + 0.15, dt)) {
      bsfx(this, 'boss_roar', { vol: 0.9 });
      this.world.shake(4, 0.5);
      this.rpm = 9;
      this.fireGlow = 2;
      // Horn: huge black blast from the stack, steam from the whistle.
      for (let i = 0; i < 10; i++) smoke(this.world, this.wx(GR.STACK_X), this.wy(GR.STACK_TOP), { n: 1, vy: -60 - i * 6, size: 3, size2: 11, life: 1.3, spread: 4 });
      puffSteam(this.world, this.wx(25), this.wy(-74), 0, -70, 6, 3);
    }
    if (t >= INTRO_TIME) {
      this.finishIntro();
      this.setState('idle');
    }
  }

  private updateIdle(dt: number): void {
    this.beacon = 'off';
    this.bladeTarget = 0;
    this.rpm = 1.6 + this.phase * 0.5;
    this.drumRate = 2 + this.phase;
    this.headGlow = Math.max(0, this.headGlow - dt * 2);
    // Idle sway: creeps a few px forward and back (rear stays against the arena edge).
    this.sway += dt;
    const swayX = this.homeX + this.facing * 3 * (0.5 - 0.5 * Math.cos(this.sway * 1.7));
    this.x += (swayX - this.x) * Math.min(1, dt * 6);
    this.barrelTarget = 0.45 + Math.sin(this.age * 0.8) * 0.08;
    if (this.pendingStagger) {
      this.pendingStagger = 0;
      this.setState('stagger');
    } else if (this.stateTime > this.stats.idle * this.world.difficulty.enemyFireDelay) this.chooseAttack();
  }

  private shellsInFlight(): boolean {
    return this.world.query((e) => e instanceof Lobbed && e.owner === this).length > 0;
  }

  private chooseAttack(): void {
    const ph = this.phase;
    const st = this.stats;
    const scripted: Attack[] = ['volley', 'deploy', 'charge'];
    const troops = this.aliveTroopers();
    let pick: Attack;
    if (this.nextAttack) {
      pick = this.nextAttack;
    } else if (this.attacks < scripted.length && ph === 0) {
      pick = scripted[this.attacks];
    } else if (this.sinceCharge >= 3) {
      pick = 'charge';
    } else {
      const opts: [Attack, number][] = [['volley', 3]];
      if (troops < st.maxTroops) opts.push(['deploy', ph === 1 ? 2.2 : 1.6]);
      opts.push(['charge', ph === 2 ? 3.2 : 2.4]);
      if (ph >= 1) opts.push(['flame', 2.6]);
      const filtered = opts.filter(([a]) => a !== this.lastAttack);
      pick = this.world.rng.weighted(filtered.length ? filtered : opts);
    }
    if (pick === 'deploy' && troops >= st.maxTroops) pick = 'volley';
    // Never start a charge while shells are still in the air (they could land in the safe pocket).
    if (pick === 'charge' && this.shellsInFlight()) return;
    this.nextAttack = null;
    this.atk = st;
    if (pick === 'flame') this.usedFlame = true;
    this.attacks++;
    this.lastAttack = pick;
    this.sinceCharge = pick === 'charge' ? 0 : this.sinceCharge + 1;
    switch (pick) {
      case 'volley':
        this.shotsLeft = st.shells;
        this.shotT = 0.55;
        bsfx(this, 'metal_hit', { vol: 0.5, pitch: 0.55 });
        this.setState('volley');
        break;
      case 'deploy':
        this.troopsLeft = Math.min(st.troops, st.maxTroops - troops);
        this.setState('deploy');
        break;
      case 'charge':
        this.charges++;
        this.setState('rev');
        this.chargeStop = this.facing < 0 ? this.arenaL + st.pocket : this.arenaR - st.pocket;
        this.world.add(new ChargeLane(this, this.chargeStop, this.groundY));
        break;
      case 'flame':
        this.setState('flame_tel');
        break;
    }
  }

  /** Debug / tests: perform this attack next (as soon as the Grinder is idle). */
  forceAttack(a: GrinderAttack): void {
    this.nextAttack = a;
    if (this.state === 'idle') this.stateTime = 99;
  }

  aliveTroopers(): number {
    this.troopers = this.troopers.filter((t) => !t.dead && t.hittable);
    return this.troopers.length + this.world.query((e) => e instanceof HatchTrooper && e.boss === this).length;
  }

  // ---- cannon volley

  private muzzle(): { x: number; y: number; a: number } {
    const e = this.barrelElev;
    const len = GR.BARREL_LEN - this.recoil * 4;
    const lx = GR.BARREL_X - this.turretKick + Math.cos(e) * len;
    const ly = GR.BARREL_Y - Math.sin(e) * len;
    const a = this.facing > 0 ? -e : Math.PI + e;
    return { x: this.wx(lx), y: this.wy(ly), a };
  }

  private updateVolley(dt: number): void {
    this.rpm = 2.4;
    this.beacon = 'red';
    const dist = Math.abs(this.targetX() - this.wx(GR.BARREL_X));
    this.barrelTarget = Math.max(GR.BARREL_MIN, Math.min(GR.BARREL_MIN + GR.BARREL_STEP * (GR.BARREL_N - 1), 0.35 + dist / 420));
    this.aimAndFire(dt, this.atk.shells);
    if (this.shotsLeft <= 0 && this.shotT <= -0.3) this.setState('idle');
  }

  /** Fire the queued shells (volley state, and phase-3 reversing). */
  private aimAndFire(dt: number, total: number): void {
    this.shotT -= dt;
    if (this.shotT <= 0 && this.shotsLeft > 0) {
      this.fireShell(total - this.shotsLeft);
      this.shotsLeft--;
      this.shotT = this.atk.shellGap;
    }
  }

  private fireShell(i: number): void {
    const t = this.target();
    let tx = t ? t.x : this.arenaL + 90;
    if (t && i > 0) {
      // Later shells lead a moving target or bracket it.
      const lead = Math.sign(t.vx) * Math.min(48, Math.abs(t.vx) * 0.45);
      tx += lead + (i % 2 ? 1 : -1) * this.world.rng.range(0, 14);
    }
    const front = this.frontX - this.facing * 10;
    tx = this.facing < 0 ? Math.min(front, tx) : Math.max(front, tx);
    tx = Math.max(this.arenaL + 10, Math.min(this.arenaR - 10, tx));
    const m = this.muzzle();
    this.world.add(
      new Lobbed({ owner: this, x: m.x, y: m.y, tx, ty: this.groundY, time: this.atk.shellTime, gravity: 380, radius: 18, size: 'medium', sprite: 'grinder_shell', shake: 3, trail: '#9a928a' }),
    );
    this.recoil = 1;
    this.turretKick = 2;
    this.bobV += 26;
    const fx = this.world.effect('muzzle_flash', m.x, m.y, { fps: 24 });
    fx.rot = m.a;
    smoke(this.world, m.x, m.y, { n: 5, vx: Math.cos(m.a) * 30, vy: -18, size: 2, size2: 7, life: 0.7, color: '#8a8480', color2: '#4a4448' });
    bsfx(this, 'tank_cannon', { vol: 0.85 });
    this.world.shake(2, 0.15);
  }

  // ---- hatch deploy

  private updateDeploy(dt: number): void {
    const t = this.stateTime;
    this.beacon = 'red';
    this.rpm = 2;
    if (this.crossed(0, dt)) {
      if (this.hatchTarget !== 1) bsfx(this, 'metal_hit', { vol: 0.5, pitch: 0.6 });
      this.hatchTarget = 1;
    }
    if (t > 0.3 && this.troopsLeft > 0) {
      this.pop = Math.min(1, (t - 0.3) / 0.22);
      if (this.crossed(0.3, dt)) bsfx(this, 'enemy_alert', { vol: 0.6 });
      if (t >= 0.78) {
        this.leap();
        this.troopsLeft--;
        this.pop = 0;
        if (this.troopsLeft > 0) this.stateTime = 0.25;
      }
    }
    if (this.troopsLeft <= 0 && t > 1.05) this.hatchTarget = 0;
    if (this.troopsLeft <= 0 && t > 1.35) this.setState('idle');
  }

  private leap(): void {
    const hx = this.wx(GR.HATCH_CX - this.turretKick);
    const hy = this.wy(GR.HATCH_Y + 2);
    const vx = this.facing * this.world.rng.range(190, 235);
    const vy = -this.world.rng.range(250, 290);
    this.world.add(new HatchTrooper(this, hx, hy, vx, vy));
    smoke(this.world, hx, hy, { n: 3, size: 2, size2: 5, life: 0.4, color: '#c8c0b0', color2: '#8a8480' });
  }

  // ---- blade charge

  private revTime(): number {
    return this.atk.rev * (0.85 + 0.15 * this.world.difficulty.enemyFireDelay);
  }

  private updateRev(dt: number): void {
    const t = this.stateTime;
    const k = Math.min(1, t / this.revTime());
    this.beacon = 'red';
    this.bladeTarget = 1;
    this.headGlow = Math.min(1, t / 0.4);
    this.rpm = 5 + 5 * k;
    this.drumRate = 8 + 34 * k;
    this.fireGlow = 2;
    this.treadPhase += dt * (60 + 120 * k);
    this.jitter = fxRng.chance(0.5) ? 1 : -1;
    if (this.crossed(0, dt)) {
      bsfx(this, 'boss_charge', { vol: 0.9 });
      this.bobV -= 30;
    }
    this.sndT -= dt;
    if (this.sndT <= 0) {
      this.sndT = 0.26;
      bsfx(this, 'engine', { vol: 0.6, pitch: 0.85 + k * 0.5 });
    }
    // Black smoke, dirt thrown backwards from the spinning treads.
    if (fxRng.chance(0.6)) smoke(this.world, this.wx(GR.STACK_X), this.wy(GR.STACK_TOP + 2), { n: 1, vy: -55, size: 3, size2: 9, life: 0.9, color: '#2a2628', color2: '#1a181c' });
    if (fxRng.chance(0.7)) {
      const x = this.rearX - this.facing * 2;
      this.world.particles.add({ kind: 'px', x, y: this.groundY - 2, vx: -this.facing * fxRng.range(60, 140), vy: fxRng.range(-120, -40), life: 0.5, color: fxRng.chance(0.5) ? '#8a6a44' : '#5e4430', gravity: 500, size: 2 });
    }
    if (this.bladeLow > 0.95 && fxRng.chance(0.5)) sparkBurst(this.world, this.frontX - this.facing * 4, this.groundY - 1, 2, '#ffd080', 90);
    if (t >= this.revTime()) {
      this.jitter = 0;
      this.vxMove = 0;
      this.setState('charge');
    }
  }

  /** The front of the machine while charging: blade, drum and push arms (deadly). */
  chargeHitbox(): Rect {
    const bb = this.bladeBottom;
    return this.rectL(GR.BLADE_PX + GR.BLADE_BX - 4, bb - 38, GR.BLADE_TIP + 1, Math.max(bb, 0) + 1, false);
  }

  private updateCharge(dt: number): void {
    const st = this.atk;
    const speed = Math.min(st.charge, Math.abs(this.vxMove) + CHARGE_ACCEL * dt);
    this.vxMove = this.facing * speed;
    this.x += this.vxMove * dt;
    // Never overshoot the stop line (the blade must not poke into the safe pocket, even for a frame).
    const stop = this.stopX;
    const atStop = (this.facing < 0 && this.frontX <= stop) || (this.facing > 0 && this.frontX >= stop);
    if (atStop) this.x = stop - this.facing * GR.BLADE_TIP;
    this.beacon = 'red';
    this.headGlow = 1;
    this.rpm = 10;
    this.drumRate = 44;
    const blade = this.chargeHitbox();
    this.hurtPlayers(blade, 'crush', 18);
    // Flattens its own troops (they get flung over the hood).
    for (const e of this.world.query((x): x is Enemy => x instanceof Enemy && !x.dying && x.hittable)) {
      if (rectsOverlap(blade, e.box)) {
        e.damage({ amount: 99, kind: 'explosion', owner: this, x: e.x, y: e.cy, dir: -this.facing });
        sparkBurst(this.world, e.x, e.cy, 4, '#ffd080', 120);
      }
    }
    if (fxRng.chance(0.8)) sparkBurst(this.world, this.frontX - this.facing * 4, this.groundY - 1, 2, '#ffd080', 110);
    if (fxRng.chance(0.6)) this.world.particles.dust(this.frontX - this.facing * 6, this.groundY, 2, DUST);
    if (fxRng.chance(0.5)) this.world.particles.dust(this.rearX, this.groundY, 2, DUST);
    this.sndT -= dt;
    if (this.sndT <= 0) {
      this.sndT = 0.16;
      bsfx(this, 'tank_tread', { vol: 0.7 });
    }
    if (atStop) {
      this.vxMove = 0;
      this.setState('slam');
    }
  }

  private updateSlam(dt: number): void {
    const t = this.stateTime;
    const st = this.atk;
    this.rpm = t < 0.3 ? 2 : 3.5;
    this.drumRate = Math.max(0, this.drumRate - dt * 120);
    if (this.crossed(0, dt)) {
      this.world.shake(6, 0.4);
      this.world.hitstop(0.05);
      this.bobV += 60;
      bsfx(this, 'explosion', { vol: 0.7, pitch: 0.7 });
      bsfx(this, 'metal_hit', { vol: 0.8, pitch: 0.5 });
      this.world.particles.dust(this.frontX, this.groundY, 14, DUST);
      sparkBurst(this.world, this.frontX, this.groundY - 6, 14, '#ffd080', 180);
      // Clods of earth thrown up by the blade, rubble shaken loose from above (cosmetic).
      for (let i = 0; i < 8; i++) {
        this.world.particles.add({ kind: 'debris', x: this.frontX + fxRng.range(-6, 6), y: this.groundY - 4, vx: this.facing * fxRng.range(20, 110), vy: fxRng.range(-220, -90), life: 1.2, color: fxRng.pick(['#7a5a3c', '#5e4430', '#a08a70']), size: fxRng.pick([1, 2, 2]), gravity: 600, bounce: 0.3, rot: 0, vr: fxRng.range(-8, 8) });
      }
      for (let i = 0; i < 8; i++) {
        this.world.particles.add({ kind: 'debris', x: this.arenaL + fxRng.range(4, 90), y: this.world.camera.y + fxRng.range(-10, 20), vx: fxRng.range(-20, 20), vy: fxRng.range(20, 80), life: 1.4, color: fxRng.pick(['#7a6a55', '#5a4a3a', '#a08a70']), size: fxRng.pick([1, 2]), gravity: 500, bounce: 0.3, rot: 0, vr: fxRng.range(-8, 8) });
      }
    }
    if (t > 0.25 && fxRng.chance(0.35)) puffSteam(this.world, this.wx(fxRng.range(-10, 50)), this.wy(-50), 0, -40, 1, 2.5);
    if (t > st.stuck * 0.55) {
      this.bladeTarget = 0;
      this.headGlow = Math.max(0, this.headGlow - dt * 3);
    }
    if (t >= st.stuck) {
      this.setState('reverse');
      if (this.phase >= 2) {
        // Frantic: lob a couple of shells while backing up.
        this.shotsLeft = 2;
        this.shotT = 0.35;
      }
    }
  }

  private updateReverse(dt: number): void {
    this.beacon = 'amber';
    this.bladeTarget = 0;
    this.rpm = 4;
    this.drumRate = 6;
    this.vxMove = -this.facing * this.atk.back;
    this.x += this.vxMove * dt;
    if (this.shotsLeft > 0) {
      const dist = Math.abs(this.targetX() - this.wx(GR.BARREL_X));
      this.barrelTarget = Math.max(GR.BARREL_MIN, Math.min(GR.BARREL_MIN + GR.BARREL_STEP * (GR.BARREL_N - 1), 0.35 + dist / 420));
      this.aimAndFire(dt, 2);
    }
    this.beepT -= dt;
    if (this.beepT <= 0) {
      this.beepT = 0.45;
      this.world.sfx('mine_beep', this.rearX, { vol: 0.35, pitch: 0.6 });
    }
    this.sndT -= dt;
    if (this.sndT <= 0) {
      this.sndT = 0.4;
      bsfx(this, 'engine', { vol: 0.35, pitch: 0.8 });
    }
    if ((this.facing < 0 && this.x >= this.homeX) || (this.facing > 0 && this.x <= this.homeX)) {
      this.x = this.homeX;
      this.vxMove = 0;
      this.shotsLeft = 0;
      this.setState('idle');
    }
  }

  // ---- flame vents

  /** World position of the lower flame nozzle in the blade. */
  nozzle(): { x: number; y: number } {
    const bb = GR.BLADE_PY + bladeFrameBottomRel(this.bladePos);
    return { x: this.wx(GR.BLADE_PX + GR.BLADE_BX + 9), y: this.groundY + this.sinkY + bb - 17 };
  }

  private updateFlame(dt: number): void {
    const st = this.atk;
    const t = this.stateTime;
    this.beacon = 'red';
    this.bladeTarget = 1;
    this.rpm = 4;
    this.drumRate = 12;
    this.fireGlow = 2;
    const n = this.nozzle();
    if (this.state === 'flame_tel') {
      if (this.crossed(0, dt)) bsfx(this, 'fire_burst', { vol: 0.5, pitch: 0.7 });
      const k = Math.min(1, t / Math.max(0.1, st.flameTel));
      if (fxRng.chance(0.4 + 0.5 * k)) flames(this.world, n.x + this.facing * 3, n.y - fxRng.pick([0, 8]), { n: 1, vx: this.facing * (20 + 50 * k), vy: -12, size: 1.5 + 1.5 * k, life: 0.2 + 0.15 * k });
      if (fxRng.chance(0.35)) puffSteam(this.world, n.x, n.y - 3, this.facing * 20, -20, 1, 2);
      this.sndT -= dt;
      if (this.sndT <= 0) {
        this.sndT = 0.3;
        bsfx(this, 'enemy_flame', { vol: 0.3 + 0.3 * k, pitch: 1.4 });
      }
      if (t >= st.flameTel * (0.85 + 0.15 * this.world.difficulty.enemyFireDelay) && this.bladeLow > 0.95) {
        this.setState('flame');
        bsfx(this, 'fire_burst', { vol: 0.9 });
      }
      return;
    }
    if (this.state === 'flame') {
      this.flameLen = Math.min(st.flameLen, (t / 0.3) * st.flameLen);
      if (t >= 0.3 + st.flameDur) this.setState('flame_end');
    } else {
      this.flameLen = Math.max(0, this.flameLen - dt * st.flameLen * 4);
      if (this.flameLen <= 0) {
        this.bladeTarget = 0;
        this.setState('idle');
        return;
      }
    }
    // Hazard box: ground-hugging jet from the nozzle forward.
    const len = this.flameLen;
    if (len > 4) {
      const x0 = this.facing < 0 ? n.x - len : n.x;
      this.hurtPlayers({ x: x0, y: this.groundY - 18, w: len, h: 18 }, 'fire', 14);
    }
    this.sndT -= dt;
    if (this.sndT <= 0) {
      this.sndT = 0.22;
      bsfx(this, 'enemy_flame', { vol: 0.7 });
    }
    if (fxRng.chance(0.9)) {
      const k = fxRng.range(0.2, 1);
      flames(this.world, n.x + this.facing * len * k, this.groundY - fxRng.range(2, 14), { n: 1, vx: this.facing * 40, vy: -30, size: 2.5, life: 0.35 });
    }
    if (fxRng.chance(0.4)) smoke(this.world, n.x + this.facing * len * fxRng.range(0.5, 1), this.groundY - 16, { n: 1, vy: -35, size: 2, size2: 7, life: 0.8 });
  }

  // ---- damage beats and phase transitions

  private tearSkirt(): void {
    this.skirtOff = true;
    const x = this.wx(-25);
    const y = this.wy(-30);
    this.world.explode(x, y, { radius: 12, damage: 0, team: 'enemy', size: 'small', shake: 3, sfx: 'explosion_small' });
    this.world.add(new Scrap('grinder_parts', 0, x, y, this.facing * 70, -240, { vr: 7, life: 3, groundY: this.groundY }));
    sparkBurst(this.world, x, y, 8, '#ffd080', 150);
    bsfx(this, 'metal_hit', { vol: 0.8, pitch: 0.7 });
  }

  private updateStagger(dt: number): void {
    const t = this.stateTime;
    this.beacon = 'red';
    this.jitter = t < 0.9 ? (fxRng.chance(0.5) ? 1 : -1) : 0;
    this.flameLen = 0;
    this.bladeTarget = 0;
    this.rpm = t < 0.9 ? 0.6 : 8;
    this.drumRate = 0;
    if (this.crossed(0, dt)) {
      bsfx(this, 'alarm', { vol: 0.7 });
      this.world.flash('#ffffff', 0.35);
      this.world.shake(5, 0.5);
      if (this.staggerKind & 1 && !this.stackGone) this.blowStack();
      if (this.staggerKind & 2) this.stripArmour();
      this.staggerKind = 0;
    }
    if (this.crossed(0.3, dt)) {
      const r = this.deathArea();
      this.world.explode(r.x + r.w * 0.3, r.y + r.h * 0.6, { radius: 16, damage: 0, team: 'enemy', size: 'medium', shake: 3 });
    }
    if (this.crossed(0.6, dt)) {
      const r = this.deathArea();
      this.world.explode(r.x + r.w * 0.7, r.y + r.h * 0.45, { radius: 16, damage: 0, team: 'enemy', size: 'medium', shake: 3 });
    }
    if (this.crossed(1.0, dt)) {
      bsfx(this, 'boss_roar', { vol: 0.85 });
      this.fireGlow = 2;
      for (let i = 0; i < 8; i++) smoke(this.world, this.wx(GR.STACK_X), this.wy(this.stackGone ? GR.STACK_Y - 14 : GR.STACK_TOP), { n: 1, vy: -70 - i * 5, size: 3, size2: 10, life: 1.1, color: '#e8e4dc', color2: '#b0aca4' });
    }
    if (t >= 1.45) {
      this.attacks = Math.max(this.attacks, 3);
      this.nextAttack = this.phase >= 1 && !this.usedFlame ? 'flame' : 'charge';
      this.sinceCharge = Math.max(this.sinceCharge, 2);
      this.setState('idle');
      this.stateTime = 99;
    }
  }

  private blowStack(): void {
    this.stackGone = true;
    const sx = this.wx(GR.STACK_X);
    const sy = this.wy(GR.STACK_TOP + 6);
    this.world.explode(sx, sy + 10, { radius: 20, damage: 0, team: 'enemy', size: 'large', shake: 6, sfx: 'explosion_big' });
    this.world.add(new Scrap('grinder_parts', 1, sx, sy, -this.facing * 70, -330, { vr: 7, life: 3.2, burn: true, groundY: this.groundY }));
    for (let i = 0; i < 4; i++) this.world.add(new FlyingPart('boss_debris', i % 3, sx, sy + 20, fxRng.range(-140, 140), fxRng.range(-320, -160), { life: 2.2, groundY: this.groundY }));
  }

  private stripArmour(): void {
    this.armourOff = true;
    this.armorMul = 1.3;
    const pts: [number, number, number][] = [
      [-60, -30, 0],
      [12, -30, 0],
      [-52, -42, 3],
      [16, -44, 3],
      [-30, -48, 3],
    ];
    pts.forEach(([lx, ly, fr], i) => {
      this.world.add(new Scrap('grinder_parts', fr, this.wx(lx), this.wy(ly), this.facing * fxRng.range(-120, 120), fxRng.range(-300, -180), { vr: fxRng.range(-9, 9), life: 3, burn: i % 2 === 0, groundY: this.groundY }));
    });
    this.world.explode(this.wx(-20), this.wy(-40), { radius: 24, damage: 0, team: 'enemy', size: 'large', shake: 6, sfx: 'explosion_big' });
  }

  // ---- ambient fx

  private ambientFx(dt: number): void {
    const w = this.world;
    const f = this.hpFrac;
    // Exhaust: a puff from alternating pipes on every engine half-stroke.
    const half = Math.floor(this.engPhase / Math.PI);
    if (half !== this.lastPuff) {
      this.lastPuff = half;
      const [ex, ey] = GR.EXHAUST[half & 1];
      const hard = this.rpm > 4.5;
      smoke(w, this.wx(ex), this.wy(ey), { n: 1, vx: -this.facing * 14, vy: -26, size: hard ? 2.5 : 1.5, size2: hard ? 7 : 5, life: hard ? 0.8 : 0.6, color: hard ? '#2e2a2c' : '#6e686a', color2: hard ? '#1c1a1e' : '#4a4648' });
    }
    // Firebox glow decays back to a flicker.
    this.fireGlow = Math.max(0.6, this.fireGlow - dt * 2.5);
    this.fxT -= dt;
    if (this.fxT > 0) return;
    this.fxT = 0.07;
    // Stack / stub exhaust.
    if (!this.stackGone) {
      if (fxRng.chance(0.4)) smoke(w, this.wx(GR.STACK_X), this.wy(GR.STACK_TOP + 2), { n: 1, vy: -32, size: 2, size2: 7, life: 1.1, color: f < 0.75 ? '#3a3436' : '#6a6466', color2: '#3a363a' });
    } else {
      flames(w, this.wx(GR.STACK_X), this.wy(GR.STACK_Y - 12), { n: 2, vy: -60, size: 3, life: 0.4, spread: 3 });
      smoke(w, this.wx(GR.STACK_X), this.wy(GR.STACK_Y - 20), { n: 1, vy: -40, size: 3, size2: 9, life: 1.2, color: '#2a2628', color2: '#1c1a1e' });
    }
    // Damage states at fixed spots (torn skirt, turret hole, exposed machinery, cracked boiler).
    if (this.skirtOff && fxRng.chance(0.35)) smoke(w, this.wx(-25 + fxRng.range(-10, 10)), this.wy(-30), { n: 1, vy: -24, size: 1.5, size2: 6, life: 0.9 });
    if (this.phase >= 1 && !this.turretGone && fxRng.chance(0.4)) flames(w, this.wx(-57 - this.turretKick), this.wy(-62), { n: 1, size: 2, life: 0.3, vy: -30 });
    if (this.phase >= 1 && fxRng.chance(0.2)) smoke(w, this.wx(-57), this.wy(-66), { n: 1, vy: -30, size: 2, size2: 7, life: 1.0 });
    if (this.armourOff) {
      if (fxRng.chance(0.3)) flames(w, this.wx(-50), this.wy(-40), { n: 1, size: 2, life: 0.3, vy: -20 });
      if (fxRng.chance(0.15)) sparkBurst(w, this.wx(17), this.wy(-38), 3, '#ffd080', 90);
      if (fxRng.chance(0.18)) puffSteam(w, this.wx(fxRng.pick([16, 44])), this.wy(-56), this.facing * 10, -45, 1, 2.5);
    }
  }

  // ------------------------------------------------------------------ death

  override onDeathStart(): void {
    this.deathDuration = 4.4;
    this.flameLen = 0;
    this.pop = 0;
    this.beacon = 'off';
    this.headGlow = 0;
    this.shotsLeft = 0;
    for (const t of this.troopers) if (!t.dead && t.hittable) t.damage({ amount: 99, kind: 'explosion', owner: null, x: this.x, y: t.cy, dir: Math.sign(t.x - this.x) || -1 });
    for (const e of this.world.query((x) => x instanceof HatchTrooper)) e.remove();
  }

  override deathSequence(dt: number): void {
    const t = this.deathTime;
    const ev = (at: number) => t >= at && this.deathFx < at;
    this.jitter = t < 3.6 ? (fxRng.chance(0.5) ? 1 : -1) : 0;
    this.rpm = Math.max(0, 3 - t);
    this.drumRate = Math.max(0, this.drumRate - dt * 20);
    this.fireGlow = t < 2.6 ? 2 : 1;
    if (ev(0.35) && !this.stackGone) this.blowStack();
    if (ev(0.8)) {
      this.hatchGone = true;
      this.world.add(new Scrap('grinder_parts', 2, this.wx(GR.HATCH_CX), this.wy(GR.HATCH_Y), -this.facing * 40, -300, { vr: 10, life: 3, groundY: this.groundY }));
      // The crew bails out: one leaps off the front and flees past the player, one jumps off the back.
      this.world.add(new Bailout(this.wx(GR.HATCH_CX), this.wy(GR.HATCH_Y + 2), this.facing * 150, -300, this.groundY));
      bsfx(this, 'enemy_alert', { vol: 0.6 });
    }
    if (ev(1.25)) this.world.add(new Bailout(this.wx(GR.HATCH_CX), this.wy(GR.HATCH_Y + 2), -this.facing * 80, -280, this.groundY));
    if (ev(1.6)) {
      this.barrelGone = true;
      this.world.add(new Scrap('grinder_parts', 4, this.wx(GR.BARREL_X + 20), this.wy(GR.BARREL_Y - 10), this.facing * 90, -260, { vr: 6, life: 3, burn: true, groundY: this.groundY }));
    }
    if (ev(2.2)) {
      this.turretGone = true;
      const tx = this.wx(GR.TURRET_X);
      const ty = this.wy(GR.TURRET_Y - 16);
      this.world.explode(tx, ty, { radius: 26, damage: 0, team: 'enemy', size: 'large', shake: 7, sfx: 'explosion_big' });
      this.world.add(new Scrap('grinder_turret', 3, tx, ty, -this.facing * 50, -380, { vr: 0.7, life: 2.6, burn: true, groundY: this.groundY, bounce: 0.2 }));
      this.world.flash('#ffffff', 0.4);
    }
    if (ev(2.6)) {
      this.bladeTarget = 1;
      this.world.add(new Scrap('grinder_parts', 6, this.wx(10), this.groundY - 8, this.facing * 110, -200, { vr: 8, life: 2.6, groundY: this.groundY }));
      this.world.add(new Scrap('grinder_parts', 7, this.wx(-24), this.groundY - 9, -this.facing * 80, -240, { vr: 9, life: 2.6, groundY: this.groundY }));
      bsfx(this, 'metal_hit', { vol: 0.8, pitch: 0.45 });
    }
    if (t > 2.6) this.sinkY = Math.min(5, this.sinkY + dt * 6);
    this.bladeLow = Math.min(1, this.bladeLow + dt * 2 * (this.bladeTarget > 0 ? 1 : 0));
    this.bobV += (-this.bob * 160 - this.bobV * 9) * dt;
    this.bob += this.bobV * dt;
    if (fxRng.chance(0.5)) flames(this.world, this.wx(fxRng.range(-80, 50)), this.wy(fxRng.range(-80, -30)), { n: 1, size: 2.5, life: 0.4 });
    if (fxRng.chance(0.3)) smoke(this.world, this.wx(fxRng.range(-80, 50)), this.wy(-70), { n: 1, vy: -40, size: 3, size2: 9, life: 1.2, color: '#2a2628', color2: '#1c1a1e' });
    this.deathFx = t;
    super.deathSequence(dt);
  }

  override onDestroyed(): void {
    const bb = GR.BLADE_PY + bladeFrameBottomRel(2);
    this.world.add(
      new Wreck(this.x, this.groundY, this.facing, [
        { sprite: 'grinder_tracks', frame: GR.TRACK_FRAMES, dx: 0, dy: 2 },
        { sprite: 'grinder_body', frame: 3, dx: 0, dy: 5 },
        { sprite: 'grinder_blade', frame: 8, dx: GR.BLADE_PX, dy: GR.BLADE_PY + 2 },
        { sprite: 'grinder_drum', frame: GR.DRUM_FRAMES, dx: GR.BLADE_PX + GR.BLADE_BX + GR.DRUM_DX, dy: bb + GR.DRUM_DY + 2 },
      ], [
        { dx: GR.STACK_X, dy: GR.STACK_Y + 2, fire: true },
        { dx: -40, dy: -50, fire: true },
        { dx: -20, dy: -44, fire: false },
        { dx: -84, dy: -60, fire: false },
        { dx: 10, dy: -55, fire: true },
      ]),
    );
    this.world.particles.debris(this.x, this.groundY - 50, 24, ['#7d7343', '#5a522e', '#3c3834', '#d4a23a', '#4c4e5a'], 300);
  }

  // ------------------------------------------------------------------ render

  override render(g: CanvasRenderingContext2D): void {
    // Headlamp beam (behind the boss so it shines out in front).
    if (this.headGlow > 0.05) {
      const X = Math.round(this.x) + this.jitter;
      const B = Math.round(this.groundY + this.bob + this.sinkY);
      this.renderBeam(g, X + this.facing * GR.LAMP_FX, B + GR.LAMP_FY);
    }
    // Contact shadow anchoring the treads to the ground.
    if (!this.turretGone || this.deathTime < 3.5) pixelEllipse(g, this.x - this.facing * 6, this.groundY + 1, 98, 3, '#140c1c', 0.28);
    this.drawParts(g, null);
    // Hit flash: only the part that was hit (around the impact point on the big hull/boiler).
    if (!this.dying) {
      for (const z of this.zones) {
        if ((this.zoneFlash[z.id] ?? 0) <= 0.035) continue;
        g.save();
        // A round hot spot around the impact, inside the zone (big blasts light up more).
        const h = this.hitAt[z.id] ?? { x: z.x + z.w / 2, y: z.y + z.h / 2, big: false };
        g.beginPath();
        g.rect(Math.floor(z.x) - 1, Math.floor(z.y) - 1, Math.ceil(z.w) + 2, Math.ceil(z.h) + 2);
        g.clip();
        g.beginPath();
        g.ellipse(Math.round(h.x), Math.round(h.y), h.big ? 22 : 11, h.big ? 16 : 8, 0, 0, Math.PI * 2);
        g.clip();
        g.globalAlpha = 0.6;
        this.drawParts(g, z.id as Group);
        g.restore();
      }
    }
    // Flame jet.
    if (this.flameLen > 1) this.renderFlame(g);
    // Vent glow while the nozzles build pressure: blinking faster and hotter until the jet fires.
    if (this.state === 'flame_tel') {
      const n = this.nozzle();
      const k = Math.min(1, this.stateTime / Math.max(0.1, this.atk.flameTel));
      const on = Math.floor(this.age * (8 + 14 * k)) % 2 === 0;
      const nx = Math.round(n.x) - (this.facing < 0 ? 2 : 0);
      for (const dy of [-9, -1]) {
        g.fillStyle = on ? '#ffe070' : '#ff7a2a';
        g.fillRect(nx - 1, Math.round(n.y) + dy - 1, 4, 4);
        g.fillStyle = on ? '#ffffff' : '#ffd060';
        g.fillRect(nx, Math.round(n.y) + dy, 2, 2);
      }
    }
  }

  override applyHit(d: Damage, mul: number, id: string): boolean {
    if (d.x !== undefined && d.y !== undefined) this.hitAt[id] = { x: d.x, y: d.y, big: d.kind === 'explosion' || d.amount >= 5 };
    // Armour plates soak part of blasts and flames (until they are blown off at 25%).
    const plated = !this.armourOff && (d.kind === 'explosion' || d.kind === 'fire') && (id === 'blade' || id === 'hull' || id === 'turret');
    const ok = super.applyHit(d, plated ? mul * GRINDER_ARMOUR_BLAST : mul, id);
    // Heavy hits (grenades, rockets, cannon shells) jolt the suspension.
    if (ok && !this.dying && d.amount * mul >= 8) this.bobV += Math.min(40, d.amount * mul * 2);
    return ok;
  }

  /** Draw every part (group null), or only one zone's parts as a white flash silhouette. */
  private drawParts(g: CanvasRenderingContext2D, only: Group | null): void {
    const f = this.facing;
    const flip = f < 0;
    const flash = only !== null;
    const X = Math.round(this.x) + this.jitter;
    const G = Math.round(this.groundY + this.sinkY);
    const B = Math.round(this.groundY + this.bob + this.sinkY);
    const P = (lx: number) => X + f * lx;
    const TK = -Math.round(this.turretKick);
    const on = (...groups: Group[]) => only === null || groups.includes(only);
    const dying = this.dying;
    const charred = dying && this.deathTime > 2.8;
    // Engine pistons (behind the body; the housings hide their lower ends).
    if (only === null) {
      GR.PISTONS.forEach(([px, py], i) => {
        const ext = (1 - Math.cos(this.engPhase + i * Math.PI)) * 2;
        sprites.get('grinder_piston').draw(g, P(px), B + py + 4 - Math.round(ext), 0, { flip });
      });
    }
    // Cannon barrel (behind the turret mantlet).
    if (!this.barrelGone && !this.turretGone && on('turret')) {
      const fr = Math.max(0, Math.min(GR.BARREL_N - 1, Math.round((this.barrelElev - GR.BARREL_MIN) / GR.BARREL_STEP)));
      const e = GR.BARREL_MIN + fr * GR.BARREL_STEP;
      const rx = -Math.cos(e) * this.recoil * 4;
      const ry = Math.sin(e) * this.recoil * 4;
      sprites.get('grinder_barrel').draw(g, P(GR.BARREL_X + TK + rx), B + GR.BARREL_Y + ry, fr, { flip, flash });
    }
    // Soldier popping out of the hatch (the turret hides his legs).
    if (this.pop > 0 && only === null) sprites.get('rifleman').draw(g, P(GR.HATCH_CX + TK), B + GR.HATCH_Y + 26 - Math.round(this.pop * 17), SF.ALERT, { flip });
    // Tracks.
    if (on('hull')) {
      const tf = charred ? GR.TRACK_FRAMES : (((Math.floor(this.treadPhase) % GR.TRACK_FRAMES) + GR.TRACK_FRAMES) % GR.TRACK_FRAMES);
      sprites.get('grinder_tracks').draw(g, X, G, tf, { flip, flash });
    }
    // Hull + boiler.
    if (on('hull', 'boiler')) {
      const bodyFrame = charred ? 3 : this.armourOff ? 2 : this.skirtOff ? 1 : 0;
      sprites.get('grinder_body').draw(g, X, B, bodyFrame, { flip, flash });
    }
    // Firebox glow.
    if (only === null && !charred) {
      const lvl = this.fireGlow + (Math.floor(this.age * 9) % 3 === 0 ? 0.6 : 0);
      const fr = lvl >= 2 ? 2 : lvl >= 1 ? 1 : 0;
      sprites.get('grinder_glow').draw(g, P(GR.FIREBOX_X), B + GR.FIREBOX_Y, fr, { flip });
    }
    // Turret, hatch lid, beacon.
    if (!this.turretGone && on('turret')) {
      const tFrame = charred ? 3 : this.phase >= 1 ? 2 : this.skirtOff ? 1 : 0;
      sprites.get('grinder_turret').draw(g, P(GR.TURRET_X + TK), B + GR.TURRET_Y, tFrame, { flip, flash });
      if (!this.hatchGone) {
        const hf = this.hatch < 0.25 ? 0 : this.hatch < 0.75 ? 1 : 2;
        sprites.get('grinder_hatch').draw(g, P(GR.HATCH_X + TK), B + GR.HATCH_Y, hf, { flip, flash });
      }
      if (only === null) {
        const blink = Math.floor(this.age * (this.beacon === 'amber' ? 5 : 9)) % 2 === 1;
        const lampFrame = this.beacon === 'amber' ? (blink ? 3 : 2) : this.beacon === 'red' && blink ? 1 : 0;
        sprites.get('grinder_lamp').draw(g, P(GR.LAMP_X + TK), B + GR.LAMP_Y, lampFrame, { flip });
      }
    }
    // Smoke stack (or its burning stub).
    if (on('stack')) {
      const sf = this.stackGone ? 3 : this.hpFrac < 0.62 ? 2 : this.hpFrac < 0.82 ? 1 : 0;
      sprites.get('grinder_stack').draw(g, P(GR.STACK_X), B + GR.STACK_Y, sf, { flip, flash });
    }
    // Blade + grinder drum.
    if (on('blade')) {
      const pos = this.bladePos;
      const cond = charred ? 2 : this.phase >= 1 ? 1 : 0;
      sprites.get('grinder_blade').draw(g, P(GR.BLADE_PX), G + GR.BLADE_PY, cond * 3 + pos, { flip, flash });
      const step = Math.PI / 12;
      const df = charred ? GR.DRUM_FRAMES : (((Math.floor(this.drumAngle / step) % GR.DRUM_FRAMES) + GR.DRUM_FRAMES) % GR.DRUM_FRAMES);
      const dy = GR.BLADE_PY + bladeFrameBottomRel(pos) + GR.DRUM_DY;
      sprites.get('grinder_drum').draw(g, P(GR.BLADE_PX + GR.BLADE_BX + GR.DRUM_DX), G + dy, df, { flip, flash });
    }
    // Headlamp lens.
    if (only === null && this.headGlow > 0.05) {
      g.fillStyle = this.headGlow > 0.6 ? '#fffbe0' : '#ffe070';
      g.fillRect(P(GR.LAMP_FX) - (flip ? 2 : 0), B + GR.LAMP_FY - 2, 2, 4);
    }
  }

  private renderBeam(g: CanvasRenderingContext2D, lx: number, ly: number): void {
    const f = this.facing;
    const len = 90;
    g.globalAlpha = 0.16 * this.headGlow;
    g.fillStyle = '#fff2a0';
    for (let i = 0; i < len; i += 2) {
      const h = 3 + i * 0.32;
      g.fillRect(lx + f * i - (f < 0 ? 2 : 0), Math.round(ly - h * 0.35 + i * 0.12), 2, Math.round(h));
    }
    g.globalAlpha = 1;
  }

  private renderFlame(g: CanvasRenderingContext2D): void {
    const n = this.nozzle();
    const len = Math.round(this.flameLen);
    const s = sprites.get('grinder_flame');
    const fr = Math.floor(this.age * 20) % 4;
    g.save();
    g.beginPath();
    if (this.facing < 0) g.rect(Math.round(n.x) - len, Math.round(n.y) - 20, len, 40);
    else g.rect(Math.round(n.x), Math.round(n.y) - 20, len, 40);
    g.clip();
    s.draw(g, n.x, n.y, fr, { flip: this.facing < 0 });
    g.restore();
  }
}

registerEntity(
  'boss_m1',
  'boss',
  () => new Grinder(),
  'GRINDER (mission 1 boss, 380 HP, 30000 pts): steam war-dozer that parks against the right edge of a one-screen arena; its hull is ' +
    'solid. Arena: FLAT ground across [L, L+384] (no pits/solids/water/platforms/props), boss lock at L with NO announce (the boss ' +
    'shows its own WARNING banner), bossMusic "boss". Spawn { type: "boss_m1", x: L + 282 } (resting hull centre; y read from the ' +
    'ground; it drives in from off-screen right). Camera at the bottom of the level (ground ~y 170-190 on screen, >= 120 px of sky ' +
    'above it for the 113 px tall stack). Keep the left 80 px clear: the blade charge stops 74/60/50 px from the left edge (safe pocket).',
);
