// FROST BASTION - boss of mission 3 (Frostbite Pass): a Rustcoat Legion mountain gatehouse that
// rises out of the snowfield and fills the right side of the arena.
//
//  - The wall faces LEFT. Its face stands at camera-lock x + FACE_X; a dynamic terrain solid keeps
//    players, vehicles, bullets and grenades out of it. A battlement gallery overhangs the floor in
//    front of the face (players can walk under it).
//  - Weak point: the frost CORE behind armoured blast doors at the foot of the face. It is only
//    vulnerable while the doors are open and the core is pushed out on its pistons (low, so plain
//    forward fire hits it). Telegraph: amber beacons + steam from the vents + alarm ~1.1 s before.
//    Shots on the closed doors clang off (no damage). The core's hp IS the boss bar.
//  - Three destructible turrets (BossPieces; their damage also feeds the bar at TURRET_MUL):
//    MG ball turret hanging under the gallery tip (aimed bursts after a lock-on blink), ice-flak gun
//    on the gallery (airburst over a floor mark -> 3 ice fragments over shadows) and a mortar nest
//    (shells over blinking markers). Shoot them from below (aim up) while the doors are shut.
//    Every destroyed turret keeps the doors open longer and shut shorter.
//  - Core attacks (a fairness "director" keeps turrets and icicles quiet around them):
//      FROST LANCE - aim line at head height for 1 s, then a beam across the arena: CROUCH.
//      SPIKE WAVE (phase 1+) - a frost crack races along the floor, spikes erupt behind it: JUMP.
//      AVALANCHE (phase 2) - boulders arc over the wall onto a marked spot and roll at you: JUMP / shoot.
//  - Icicles grow under the gallery and drop (shadow first), mostly on players standing below.
//  - Phases by hpFrac: 0.66 (rage: faster turrets, spike waves), 0.33 (blast doors blown off: the
//    core stays exposed for good and attacks back to back). The wall shows cracks, breaches, fire.
//  - Death: core overload, turret pops, explosions, then the whole bastion sinks into the snow
//    leaving smoking rubble.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { approach, clamp, type Rect } from '../../engine/math';
import { Actor, type Entity } from '../../game/entity';
import { registerEntity } from '../../game/registry';
import type { Damage } from '../../game/constants';
import type { Solid } from '../../game/terrain';
import { EnemyBullet } from '../../game/projectile';
import { BigBoss, BossPiece, FlyingPart, Lobbed, Wreck, flames, smoke, sparkBurst, type Zone } from './common/kit';
import { GroundMarker as FloorMark, puffSteam, puffSnow } from './common/fx';
import { MG_FRAMES, WALL } from './m3/art';
import { Boulder, FallingIcicle, FlakShell, FrostLance, SPIKE_ACTIVE, SPIKE_LEAD, SPIKE_SPEED, SpikeWave, iceBurst, snd } from './m3/parts';

// ------------------------------------------------------------------ tuning

/** Arena-relative x of the wall face (camera-lock x + FACE_X). */
export const FACE_X = 248;
/** Height of the frost lance above the floor (crouch under it: crouched players are 17 px tall). */
export const LANCE_H = 25;

const HP = 260;
const TURRET_HP = { mg: 20, flak: 26, mortar: 26 } as const;
/** Share of turret damage that also drains the boss bar. */
const TURRET_MUL = 0.6;

const INTRO_RISE = 2.15;
const INTRO_END = 2.7;
const CLOSED = [5.0, 4.1];
const OPEN = [4.4, 4.6];
const OPENING = 0.75;
const CLOSING = 0.6;
const WARN = 1.15;
const ATTACK_DELAY = 0.5;
const LANCE_CHARGE = 1.0;
const LANCE_FIRE = 0.7;
const SPIKE_TELE = 0.6;
const MG_EVERY = [2.9, 2.4, 2.1];
const FLAK_EVERY = [4.7, 3.9, 3.5];
const MORTAR_EVERY = [5.6, 4.7, 4.3];
const ICICLE_EVERY = [3.6, 2.9, 2.3];

type CoreMode = 'closed' | 'opening' | 'open' | 'closing' | 'broken';
type CoreAttack = 'lance' | 'spikes' | 'boulders';
type TurretKind = 'mg' | 'flak' | 'mortar';

const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const easeIn = (t: number): number => t * t * t;

// ------------------------------------------------------------------ geometry (sprite space -> world)

/** Sprite x (facing right, authored) -> distance in front of the face. */
const D = (sx: number): number => sx - WALL.FACE;
/** Sprite y -> height above the ground. */
const HY = (sy: number): number => WALL.H - sy;

const GALLERY_UNDER = HY(WALL.GALLERY_BOTTOM);
const GALLERY_DECK = HY(WALL.GALLERY_TOP);
const GALLERY_TIP = D(WALL.GALLERY_END);
const CORE_Y = HY(WALL.GATE.y + WALL.GATE.h / 2);

// ------------------------------------------------------------------ turrets

class Turret extends BossPiece {
  readonly kind: TurretKind;
  /** World aim angle (radians, 0 = right, PI/2 = down). */
  ang: number;
  cd: number;
  stage: 'idle' | 'aim' | 'fire' | 'recover' = 'idle';
  stageT = 0;
  shots = 0;
  lockAng = 0;
  locked = false;
  recoil = 0;
  /** Burst target for the flak (world). */
  bx = 0;
  lastHitBy: Entity | null = null;

  constructor(boss: FrostBastion, kind: TurretKind, w: number, h: number, hp: number, cd: number) {
    super(boss, kind, w, h, { hp, mul: TURRET_MUL, destructible: true });
    this.kind = kind;
    this.ang = kind === 'mg' ? Math.PI * 0.8 : Math.PI * 1.25;
    this.cd = cd;
  }

  setStage(s: Turret['stage']): void {
    this.stage = s;
    this.stageT = 0;
  }

  override damage(d: Damage): boolean {
    if (d.owner) this.lastHitBy = d.owner;
    return super.damage(d);
  }
}

// ------------------------------------------------------------------ the boss

interface IcicleSlot {
  /** Distance in front of the face. */
  d: number;
  grow: number;
}

export class FrostBastion extends BigBoss {
  /** World x of the wall face. */
  face = 0;
  wallSolid: Solid | null = null;
  /** 1 = still sunk under the snow (intro), 0 = fully risen. */
  rise = 1;
  /** Pixels sunk during the death collapse. */
  sink = 0;
  private introT = 0;
  private landed = false;
  private roared = false;
  /** Turret pop-up (intro), 0..1. */
  deploy = 0;

  mode: CoreMode = 'closed';
  modeT = 0;
  modeDur = 0;
  doorK = 0;
  coreK = 0;
  coreRecoil = 0;
  /** Core glow 0..1 while an attack is charging. */
  charge = 0;
  broken = false;
  private attackStarted = false;
  private pending: CoreAttack = 'lance';
  private attackCount = 0;
  private lance: FrostLance | null = null;
  private spikeT = -1;
  private boulderLeft = 0;
  private boulderT = 0;
  private busyUntil = 0;
  private nextAttackAt = 0;
  private reserved: [number, number][] = [];

  mg!: Turret;
  flak!: Turret;
  mortar!: Turret;
  turrets: Turret[] = [];
  private lastTurretStart = -9;
  destroyed = 0;

  private slots: IcicleSlot[] = [];
  private icicleT = 3;

  private fxT = 0;
  private stackT = 0;
  private rumbleT = 0;
  private alarmed = false;
  jolt = 0;
  private wallFlash = 0;
  private deathPops: { t: number; done: boolean; d: number; h: number }[] = [];

  constructor() {
    super('FROST BASTION', HP);
    this.scoreValue = 30000;
    this.phaseAt = [0.66, 0.33];
    this.deathDuration = 4.6;
    this.w = 130;
    this.h = 46;
  }

  // ---------------------------------------------------------------- setup

  override spawned(): void {
    super.spawned();
    const T = this.world.terrain;
    this.face = this.arenaL + FACE_X;
    this.x = this.face + (WALL.FACE - WALL.OX);
    const gy = T.groundTopAt(this.face);
    if (isFinite(gy)) this.groundY = gy;
    this.y = this.groundY;
    this.wallSolid = T.addSolid(this.face + 2, this.groundY - 400, 420, 400, { owner: this, material: 'stone', dynamic: true });
    this.pushOut(this.face + 2);
    const fd = this.world.difficulty.enemyHp;
    this.mg = new Turret(this, 'mg', 18, 18, Math.round(TURRET_HP.mg * fd), 1.4);
    this.flak = new Turret(this, 'flak', 24, 22, Math.round(TURRET_HP.flak * fd), 2.6);
    this.mortar = new Turret(this, 'mortar', 28, 16, Math.round(TURRET_HP.mortar * fd), 3.6);
    this.turrets = [this.mg, this.flak, this.mortar];
    for (const t of this.turrets) {
      t.onDestroyed = () => this.turretDestroyed(t);
      this.world.add(t);
    }
    this.placeTurrets();
    this.slots = WALL.ICICLES.map((sx, i) => ({ d: D(sx), grow: 1.5 + i * 0.4 }));
    this.mode = 'closed';
    this.modeDur = 99;
    this.layoutZones();
    snd(this.world, 'boss_roar', this.face, 0.45, 0.55);
  }

  /** Shove player-side actors out of the wall (left of `edge`); `top` = only those whose feet are below it. */
  private pushOut(edge: number, top = -Infinity): void {
    for (const e of this.world.query((q) => q instanceof Actor && (q.team === 'player' || (q as { isVehicle?: boolean }).isVehicle === true))) {
      const a = e as Actor;
      if (a.x + a.w / 2 > edge && a.y > top) {
        a.x = edge - a.w / 2 - 0.5;
        if (a.vx > 0) a.vx = 0;
      }
    }
  }

  // ---------------------------------------------------------------- geometry helpers

  /** World x at `d` px in front of the face. */
  fx(d: number): number {
    return this.face - d;
  }

  /** World x of the core's crystal tip. */
  tipX(): number {
    return this.face - WALL.CORE_LEN * this.coreK + this.coreRecoil;
  }

  get G(): number {
    return this.groundY;
  }

  private mgPos(): { x: number; y: number } {
    return { x: this.fx(D(WALL.MG.x)), y: this.G - HY(WALL.MG.y) + 9 };
  }

  private flakPos(): { x: number; y: number } {
    return { x: this.fx(D(WALL.FLAK.x)), y: this.G - HY(WALL.FLAK.y) };
  }

  private mortarPos(): { x: number; y: number } {
    return { x: this.fx(D(WALL.MORTAR.x)), y: this.G - HY(WALL.MORTAR.y) };
  }

  private placeTurrets(): void {
    const m = this.mgPos();
    this.mg.place(m.x, m.y);
    const f = this.flakPos();
    this.flak.place(f.x - 1, f.y - 11);
    const o = this.mortarPos();
    this.mortar.place(o.x, o.y - 8);
  }

  /** Core zone + armoured doors and gate header (world space), rebuilt every frame. */
  layoutZones(): void {
    const z: Zone[] = [];
    if (this.face) {
      const G = this.groundY;
      const F = this.face;
      const FR = WALL.FRAME;
      // Armour (no damage, shots clang): the gate header always, the doors while shut.
      z.push({ id: 'frame', mul: 0, x: F - FR, y: G - HY(WALL.HEADER), w: FR + 2, h: HY(WALL.HEADER) - HY(WALL.GATE.y) });
      // Until the core is pushed out far enough to be hit, the gate counts as armour.
      if (this.coreK <= 0.3) z.push({ id: 'doors', mul: 0, x: F - FR, y: G - HY(WALL.GATE.y), w: FR + 2, h: WALL.GATE.h });
      else {
        const tip = this.tipX();
        z.push({ id: 'core', mul: 1, x: tip - 3, y: G - CORE_Y - 17, w: 29, h: 34 });
      }
    }
    this.zones = z;
  }

  // ---------------------------------------------------------------- director (fairness)

  /** May a turret / icicle attack that resolves within `dur` seconds start now? */
  private allow(dur: number): boolean {
    const now = this.world.time;
    for (const [a, b] of this.reserved) if (now < b + 0.25 && now + dur > a - 0.35) return false;
    return true;
  }

  private reserve(a: number, b: number): void {
    const now = this.world.time;
    this.reserved = this.reserved.filter(([, e]) => e > now - 1);
    this.reserved.push([a, b]);
  }

  private attackLength(k: CoreAttack): number {
    if (k === 'lance') return LANCE_CHARGE + LANCE_FIRE + 0.3;
    if (k === 'spikes') return SPIKE_TELE + SPIKE_LEAD + (this.face - this.arenaL) / SPIKE_SPEED + SPIKE_ACTIVE + 0.3;
    return 3.2;
  }

  private chooseAttack(): CoreAttack {
    const n = this.attackCount++;
    if (this.phase <= 0) return 'lance';
    if (this.phase === 1) return n % 2 === 0 ? 'spikes' : 'lance';
    return (['lance', 'spikes', 'boulders'] as const)[n % 3];
  }

  // ---------------------------------------------------------------- update

  think(dt: number): void {
    this.coreRecoil = approach(this.coreRecoil, 0, dt * 18);
    this.jolt = Math.max(0, this.jolt - dt);
    this.wallFlash = Math.max(0, this.wallFlash - dt);
    this.blockGate();
    if (!this.introDone) {
      this.intro(dt);
      this.placeTurrets();
      return;
    }
    this.coreLogic(dt);
    this.placeTurrets();
    for (const t of this.turrets) if (!t.dead) this.turretLogic(t, dt);
    this.icicleLogic(dt);
    this.ambient(dt);
  }

  private intro(dt: number): void {
    const w = this.world;
    this.introT += dt;
    const t = this.introT;
    this.rise = 1 - easeOut(clamp(t / INTRO_RISE, 0, 1));
    this.rumbleT -= dt;
    if (t < INTRO_RISE && this.rumbleT <= 0) {
      this.rumbleT = 0.12;
      w.shake(1.6, 0.15);
      for (let i = 0; i < 2; i++) puffSnow(w, this.face + fxRng.range(-6, 130), this.G - 1, 4, 55, true);
      smoke(w, this.face + fxRng.range(0, 120), this.G - 4, { n: 1, color: '#dce4f0', color2: '#9aaac0', size: 3, size2: 9, vy: -30, life: 1.1 });
      if (fxRng.chance(0.5)) {
        const top = this.G - (WALL.H + 6) * this.rise - fxRng.range(60, 140) * (1 - this.rise);
        w.add(new FlyingPart('bm3_plate', 3 + fxRng.int(0, 2), this.face + fxRng.range(-30, 110), Math.min(this.G - 8, top), fxRng.range(-70, 20), fxRng.range(-80, -20), { smoke: false, life: 1.4 }));
      }
      if (Math.floor(t / 0.36) !== Math.floor((t - 0.12) / 0.36)) snd(w, 'tank_tread', this.face, 0.8, 0.45);
    }
    if (!this.landed && t >= INTRO_RISE) {
      this.landed = true;
      w.shake(5, 0.5);
      snd(w, 'explosion_big', this.face, 0.7, 0.5);
      snd(w, 'land', this.face, 1, 0.4);
      for (let i = 0; i < 8; i++) puffSnow(w, this.face + fxRng.range(-70, 130), this.G - 1, 6, 80, true);
    }
    if (t >= INTRO_RISE) {
      const k = clamp((t - INTRO_RISE) / 0.35, 0, 1);
      if (this.deploy < 1 && k >= 1) snd(w, 'metal_hit', this.face, 0.8, 0.6);
      this.deploy = k;
    }
    if (!this.roared && t >= INTRO_RISE + 0.22) {
      this.roared = true;
      snd(w, 'boss_roar', this.face, 1, 0.85);
      w.shake(3, 0.8);
    }
    if (t >= INTRO_END) {
      this.rise = 0;
      this.deploy = 1;
      this.finishIntro();
      this.setMode('closed');
    }
  }

  private closedTime(): number {
    return Math.max(2.6, CLOSED[Math.min(1, this.phase)] - 0.45 * this.destroyed) * (0.85 + 0.15 * this.world.difficulty.enemyFireDelay);
  }

  private openTime(): number {
    return OPEN[Math.min(1, this.phase)] + 0.7 * this.destroyed;
  }

  private setMode(m: CoreMode): void {
    this.mode = m;
    this.modeT = 0;
    const now = this.world.time;
    if (m === 'closed') {
      this.modeDur = this.closedTime();
      this.alarmed = false;
      this.pending = this.chooseAttack();
      const at = now + this.modeDur + OPENING + ATTACK_DELAY;
      this.reserve(at, at + this.attackLength(this.pending));
    } else if (m === 'opening') {
      snd(this.world, 'tank_tread', this.face, 0.9, 0.7);
      snd(this.world, 'engine', this.face, 0.6, 0.6);
      this.steamBurst(10);
    } else if (m === 'open') {
      this.modeDur = this.openTime();
      this.attackStarted = false;
      snd(this.world, 'land', this.face, 0.9, 0.6);
      this.world.shake(1.5, 0.2);
    } else if (m === 'closing') {
      snd(this.world, 'tank_tread', this.face, 0.8, 0.6);
    } else if (m === 'broken') {
      this.nextAttackAt = now + 1.3;
      this.pending = this.chooseAttack();
      this.reserve(this.nextAttackAt, this.nextAttackAt + this.attackLength(this.pending));
    }
  }

  private attackBusy(): boolean {
    return this.world.time < this.busyUntil || this.spikeT >= 0 || this.boulderLeft > 0 || (this.lance !== null && !this.lance.dead);
  }

  private coreLogic(dt: number): void {
    const w = this.world;
    this.modeT += dt;
    switch (this.mode) {
      case 'closed': {
        this.doorK = approach(this.doorK, 0, dt * 5);
        this.coreK = approach(this.coreK, 0, dt * 5);
        const left = this.modeDur - this.modeT;
        if (left < WARN) {
          if (!this.alarmed) {
            this.alarmed = true;
            snd(w, 'alarm', this.face, 0.55, 1.1);
          }
          if (fxRng.chance(dt * 14)) this.steamBurst(1);
        }
        if (this.modeT >= this.modeDur) this.setMode('opening');
        break;
      }
      case 'opening': {
        this.doorK = clamp(this.modeT / 0.3, 0, 1);
        this.coreK = easeOut(clamp((this.modeT - 0.28) / (OPENING - 0.28), 0, 1));
        if (fxRng.chance(dt * 20)) this.steamBurst(1);
        if (this.modeT >= OPENING) this.setMode('open');
        break;
      }
      case 'open': {
        this.doorK = 1;
        this.coreK = 1;
        if (!this.attackStarted && this.modeT >= ATTACK_DELAY) {
          this.attackStarted = true;
          this.startAttack(this.pending);
        }
        if (this.modeT >= this.modeDur && this.attackStarted && !this.attackBusy()) this.setMode('closing');
        break;
      }
      case 'closing': {
        this.coreK = 1 - clamp(this.modeT / 0.32, 0, 1);
        this.doorK = 1 - clamp((this.modeT - 0.3) / 0.25, 0, 1);
        if (this.modeT >= CLOSING) {
          snd(w, 'land', this.face, 0.8, 0.8);
          snd(w, 'metal_hit', this.face, 0.6, 0.5);
          this.setMode('closed');
        }
        break;
      }
      case 'broken': {
        this.doorK = 1;
        this.coreK = approach(this.coreK, 1, dt * 3);
        if (!this.attackBusy() && w.time >= this.nextAttackAt) {
          this.startAttack(this.pending);
          const gap = w.rng.range(1.3, 2.0) * (0.8 + 0.2 * w.difficulty.enemyFireDelay);
          this.nextAttackAt = w.time + this.attackLength(this.pending) + gap;
          this.pending = this.chooseAttack();
          this.reserve(this.nextAttackAt, this.nextAttackAt + this.attackLength(this.pending));
        }
        break;
      }
    }
    this.attackUpdate(dt);
  }

  /**
   * The gate frame (and the core once it is pushed out) is a physical obstacle at floor level:
   * anyone standing there is shoved out. Above it the terrain solid of the face stays put, so
   * shots fly on to the face instead of stopping in mid-air.
   */
  private blockGate(): void {
    const edge = Math.min(this.face - WALL.FRAME, this.tipX() + 7);
    this.pushOut(edge, this.G - HY(WALL.HEADER) - 2);
  }

  private startAttack(k: CoreAttack): void {
    const w = this.world;
    this.charge = 0;
    if (k === 'lance') {
      this.lance = w.add(new FrostLance(this, this.tipX() - 2, this.G - LANCE_H, this.arenaL - 10, LANCE_CHARGE, LANCE_FIRE));
      this.lance.onFire = () => {
        this.coreRecoil = 5;
        this.steamBurst(6);
      };
      snd(w, 'boss_charge', this.face, 0.9, 0.9);
    } else if (k === 'spikes') {
      this.spikeT = SPIKE_TELE;
      snd(w, 'boss_charge', this.face, 0.8, 0.6);
      this.busyUntil = w.time + this.attackLength('spikes') - 0.4;
    } else {
      this.boulderLeft = this.destroyed >= 2 ? 3 : 2;
      this.boulderT = 0.2;
      snd(w, 'boss_roar', this.face, 0.7, 1.25);
      w.shake(2.5, 0.6);
    }
  }

  private attackUpdate(dt: number): void {
    const w = this.world;
    if (this.lance && this.lance.dead) this.lance = null;
    const charging = (this.lance && this.lance.charging) || this.spikeT >= 0;
    this.charge = approach(this.charge, charging ? 1 : 0, dt * (charging ? 1.4 : 3));
    if (this.lance && this.lance.charging) {
      this.lance.tipX = this.tipX() - 2;
      if (fxRng.chance(dt * 30)) {
        const a = fxRng.range(0, Math.PI * 2);
        const tx = this.tipX();
        const cy = this.G - CORE_Y;
        w.particles.add({ kind: 'px', x: tx + Math.cos(a) * 18, y: cy + Math.sin(a) * 14, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 50, life: 0.28, color: fxRng.pick(['#ffffff', '#aef2ff']), size: 1, front: true });
      }
    }
    if (this.spikeT >= 0) {
      this.spikeT -= dt;
      if (fxRng.chance(dt * 25)) iceBurst(w, this.tipX() - fxRng.range(0, 10), this.G - 2, 1, 40);
      if (this.spikeT < 0) {
        this.spikeT = -1;
        this.coreRecoil = -3;
        w.shake(3, 0.3);
        snd(w, 'explosion', this.face, 0.6, 0.6);
        w.add(new SpikeWave(this, this.tipX() - 2, this.arenaL - 6, this.G, SPIKE_SPEED * Math.min(1.1, w.difficulty.enemyShotSpeed)));
      }
    }
    if (this.boulderLeft > 0) {
      this.boulderT -= dt;
      if (this.boulderT <= 0) {
        this.boulderLeft--;
        this.boulderT = 0.95;
        const landX = this.fx(GALLERY_TIP + 10 + w.rng.range(0, 30));
        const b = new Boulder(this, this.face + 70, this.G - 200, landX, this.G, this.arenaL + 4, 1.05, 104 * w.difficulty.enemyShotSpeed);
        w.add(b);
        snd(w, 'mortar_whistle', landX, 0.6, 0.6);
      }
    }
  }

  // ---------------------------------------------------------------- turrets

  private turretLogic(t: Turret, dt: number): void {
    const w = this.world;
    t.stageT += dt;
    t.recoil = approach(t.recoil, 0, dt * 20);
    const tgt = w.nearestPlayer(t.x, t.y);
    const ph = Math.min(2, this.phase);
    // Smoke from damaged turrets.
    if (t.hp < t.maxHp * 0.5 && fxRng.chance(dt * 8)) smoke(w, t.x + fxRng.range(-4, 4), t.y - 4, { n: 1, size: 1.5, size2: 5, life: 0.8 });
    if (t.kind === 'mg') {
      const want = tgt ? Math.atan2(tgt.cy - t.y, tgt.cx - t.x) : Math.PI * 0.8;
      const a = clamp(want < -Math.PI / 2 ? want + Math.PI * 2 : want, Math.PI * 0.25, Math.PI * 1.08);
      if (t.stage === 'idle' || (t.stage === 'aim' && !t.locked)) t.ang = approachAngle(t.ang, a, dt * (t.stage === 'aim' ? 2.6 : 1.7));
    }
    switch (t.stage) {
      case 'idle': {
        t.cd -= dt;
        if (t.cd > 0 || !tgt || !tgt.onScreen(-4)) break;
        const dur = this.turretResolve(t, tgt);
        if (w.time - this.lastTurretStart < 0.7 || !this.allow(dur)) {
          t.cd = 0.25;
          break;
        }
        this.lastTurretStart = w.time;
        t.setStage('aim');
        t.locked = false;
        if (t.kind === 'mg') snd(w, 'enemy_alert', t.x, 0.35, 0.7);
        if (t.kind === 'flak') {
          t.bx = clamp(tgt.cx + w.rng.range(-8, 8), this.arenaL + 18, this.fx(GALLERY_TIP + 8));
          w.add(new FloorMark(t.bx, this.G, 0.45 + 0.85, 'cross', 9));
        }
        break;
      }
      case 'aim': {
        const aimT = t.kind === 'mg' ? 0.6 : t.kind === 'flak' ? 0.45 : 0.5;
        if (t.kind === 'mg' && !t.locked && t.stageT >= aimT - 0.28) {
          t.locked = true;
          t.lockAng = t.ang;
          snd(w, 'sniper_charge', t.x, 0.25, 1.6);
        }
        if (t.stageT >= aimT) {
          t.setStage('fire');
          t.shots = 0;
        }
        break;
      }
      case 'fire': {
        if (t.kind === 'mg') {
          const n = ph >= 1 ? 4 : 3;
          if (t.stageT >= t.shots * 0.12 && t.shots < n) {
            t.shots++;
            const a = t.lockAng + w.rng.range(-0.04, 0.04);
            const sp = (ph >= 1 ? 165 : 150) * w.difficulty.enemyShotSpeed;
            const mx = t.x + Math.cos(t.lockAng) * 14;
            const my = t.y + Math.sin(t.lockAng) * 14;
            this.enemyShot(mx, my, a, sp);
            t.recoil = 2;
            snd(w, 'heli_gun', t.x, 0.6, 1.1);
            w.particles.add({ kind: 'debris', x: t.x + 4, y: t.y, vx: fxRng.range(20, 50), vy: -fxRng.range(30, 70), gravity: 500, life: 0.6, color: '#e8c050', size: 1, bounce: 0.3 });
          }
          if (t.shots >= n && t.stageT >= n * 0.12 + 0.1) t.setStage('recover');
        } else if (t.kind === 'flak') {
          const f = this.flakPos();
          const mx = f.x - 12;
          const my = f.y - 22;
          w.add(new FlakShell(this, mx, my, t.bx, this.G - 92, 0.85, this.G));
          t.ang = Math.atan2(-1, t.bx < mx ? -1 : 1);
          t.recoil = 3;
          snd(w, 'tank_cannon', t.x, 0.55, 1.35);
          smoke(w, mx - 3, my - 3, { n: 3, color: '#c8ccd6', color2: '#7a8090', size: 2, size2: 6, vy: -20, life: 0.7 });
          t.setStage('recover');
        } else {
          const n = ph >= 1 ? 3 : 2;
          if (t.stageT >= t.shots * 0.22 && t.shots < n && tgt) {
            const side = w.rng.chance(0.5) ? -1 : 1;
            const offs = [w.rng.range(-6, 6), side * 54, -side * 54];
            const tx = clamp(tgt.cx + offs[t.shots], this.arenaL + 12, this.fx(24));
            t.shots++;
            const o = this.mortarPos();
            const mx = o.x - 6;
            const my = o.y - 20;
            w.add(new Lobbed({ owner: this, x: mx, y: my, tx, ty: this.G - 2, time: 1.35, sprite: 'bm3_mshell', radius: 17, size: 'medium', marker: true, trail: '#c0c8d4', shake: 2 }));
            t.recoil = 3;
            snd(w, 'mortar_fire', t.x, 0.7, 1);
            if (t.shots === 1) snd(w, 'mortar_whistle', tx, 0.5, 1);
            smoke(w, mx, my - 2, { n: 2, color: '#c8ccd6', color2: '#7a8090', size: 2, size2: 6, vy: -25, life: 0.6 });
          }
          if (t.shots >= n || !tgt) t.setStage('recover');
        }
        break;
      }
      case 'recover': {
        if (t.stageT >= 0.3) {
          t.setStage('idle');
          const base = t.kind === 'mg' ? MG_EVERY[ph] : t.kind === 'flak' ? FLAK_EVERY[ph] : MORTAR_EVERY[ph];
          t.cd = base * w.difficulty.enemyFireDelay * w.rng.range(0.9, 1.12);
        }
        break;
      }
    }
  }

  /** Seconds from now until a turret attack against `tgt` is over (for the director). */
  private turretResolve(t: Turret, tgt: Entity): number {
    if (t.kind === 'mg') {
      const d = Math.hypot(tgt.cx - t.x, tgt.cy - t.y);
      return 0.6 + 0.5 + d / (150 * this.world.difficulty.enemyShotSpeed) + 0.15;
    }
    if (t.kind === 'flak') return 0.45 + 0.85 + 0.9;
    return 0.5 + 0.44 + 1.35 + 0.1;
  }

  private enemyShot(x: number, y: number, a: number, speed: number): void {
    this.world.add(new EnemyBullet(this, x, y, a, speed));
  }

  private turretDestroyed(t: Turret): void {
    const w = this.world;
    this.destroyed++;
    w.explode(t.x, t.y, { radius: 16, damage: 0, team: 'enemy', size: 'large', shake: 4, sfx: 'explosion_big' });
    sparkBurst(w, t.x, t.y, 10, '#ffd060', 150);
    for (let i = 0; i < 4; i++) w.add(new FlyingPart('bm3_plate', fxRng.int(0, 2), t.x, t.y, fxRng.range(-120, 60), fxRng.range(-200, -80), { burn: i === 0 }));
    w.addScore(t.lastHitBy, 3000, { x: t.x, y: t.y - 14 });
    w.hitstop(0.05);
    this.jolt = 0.25;
    // Shaking the wall loosens the icicles.
    if (this.allow(1.1)) this.dropIcicles(2);
  }

  // ---------------------------------------------------------------- icicles

  private icicleLogic(dt: number): void {
    const w = this.world;
    const ph = Math.min(2, this.phase);
    for (const s of this.slots) s.grow = Math.min(3.99, s.grow + dt * (0.45 + 0.1 * ph));
    this.icicleT -= dt;
    if (this.icicleT > 0) return;
    this.icicleT = ICICLE_EVERY[ph] * (this.mg.dead ? 0.75 : 1) * w.difficulty.enemyFireDelay * w.rng.range(0.85, 1.15);
    if (!this.allow(1.1)) {
      this.icicleT = 0.4;
      return;
    }
    const p = w.nearestPlayer(this.fx(30), this.G - 20);
    const ripe = this.slots.filter((s) => s.grow >= 3);
    if (!ripe.length) return;
    let pick: IcicleSlot | null = null;
    if (p) {
      let bd = 26;
      for (const s of ripe) {
        const d = Math.abs(this.fx(s.d) - p.x);
        if (d < bd) {
          bd = d;
          pick = s;
        }
      }
    }
    if (!pick && w.rng.chance(0.45)) pick = ripe[w.rng.int(0, ripe.length - 1)];
    if (pick) this.dropSlot(pick, 0.6);
  }

  private dropSlot(s: IcicleSlot, shake: number): void {
    const f = Math.min(3, Math.floor(s.grow));
    if (f < 1) return;
    this.world.add(new FallingIcicle(this, this.fx(s.d), this.G - GALLERY_UNDER, this.G, shake, f));
    s.grow = 0;
  }

  private dropIcicles(max: number): void {
    const ripe = this.slots.filter((s) => s.grow >= 2).slice(0, max);
    ripe.forEach((s, i) => this.dropSlot(s, 0.55 + i * 0.25));
  }

  // ---------------------------------------------------------------- damage & phases

  override damage(d: Damage): boolean {
    // Scripted damage (no impact point) goes straight to the core.
    if (d.x === undefined || d.y === undefined) {
      if (this.dead || !this.hittable || this.dying) return false;
      return this.applyHit(d, 1, 'core');
    }
    return super.damage(d);
  }

  override applyHit(d: Damage, mul: number, id: string): boolean {
    const ok = super.applyHit(d, mul, id);
    if (ok && id === 'core') {
      this.coreRecoil = Math.max(this.coreRecoil, d.kind === 'explosion' ? 3 : 1);
      if (d.kind === 'explosion') this.jolt = Math.max(this.jolt, 0.12);
    }
    return ok;
  }

  onPhase(phase: number, _prev: number): void {
    const w = this.world;
    snd(w, 'boss_roar', this.face, 1, phase === 2 ? 0.7 : 0.8);
    w.shake(5, 0.7);
    w.flash('#ffffff', 0.35);
    this.jolt = 0.4;
    this.wallFlash = 0.15;
    for (let i = 0; i < 6; i++) {
      const x = this.fx(fxRng.range(-110, 10));
      const y = this.G - fxRng.range(40, 140);
      w.add(new FlyingPart('bm3_plate', fxRng.int(0, 5), x, y, fxRng.range(-150, 30), fxRng.range(-220, -60), { burn: i < 2 }));
    }
    for (let i = 0; i < 4; i++) w.explode(this.fx(fxRng.range(-100, 0)), this.G - fxRng.range(30, 130), { radius: 14, damage: 0, team: 'enemy', size: 'medium', shake: 0, sfx: i === 0 ? 'explosion' : null });
    // Re-plan around the new pacing.
    this.reserved = this.reserved.filter(([a]) => a < w.time);
    if (this.lance && !this.lance.dead) this.reserve(w.time, w.time + this.lance.total);
    if (phase >= 2 && !this.broken) this.breakDoors();
    else if (this.mode === 'closed') {
      this.modeDur = Math.min(this.modeDur, this.modeT + 1.4);
      this.pending = this.chooseAttack();
      const at = w.time + (this.modeDur - this.modeT) + OPENING + ATTACK_DELAY;
      this.reserve(at, at + this.attackLength(this.pending));
    }
    if (this.allow(1.1)) this.dropIcicles(3);
  }

  /** Phase 2: the blast doors are blown off; the core stays out for good. */
  private breakDoors(): void {
    const w = this.world;
    this.broken = true;
    const gx = this.face - 4;
    const gy = this.G - CORE_Y;
    w.explode(gx, gy, { radius: 22, damage: 0, team: 'enemy', size: 'large', shake: 6, sfx: 'explosion_big' });
    w.add(new FlyingPart('bm3_door', 0, gx - 8, gy - 12, -150, -260, { burn: true, life: 2.6 }));
    w.add(new FlyingPart('bm3_door', 1, gx - 8, gy + 8, -90, -170, { burn: false, life: 2.6 }));
    snd(w, 'alarm', this.face, 0.7, 0.9);
    const busy = this.lance && !this.lance.dead ? this.lance.total - this.lance.t : 0;
    this.setMode('broken');
    this.nextAttackAt = w.time + Math.max(1.5, busy + 0.8);
    this.reserved = this.reserved.filter(([a]) => a < w.time);
    this.reserve(this.nextAttackAt, this.nextAttackAt + this.attackLength(this.pending));
  }

  // ---------------------------------------------------------------- ambient fx

  /** Steam jets from the gate seams (above / below the core, drawn behind it) and the vent grille. */
  private steamBurst(n: number): void {
    const w = this.world;
    const G = this.G;
    const top = G - HY(WALL.GATE.y);
    const bot = G - 4;
    for (let i = 0; i < n; i++) {
      const up = fxRng.chance(0.5);
      const x = this.face - WALL.FRAME - 1;
      const y = up ? top + 2 : bot - 2;
      w.particles.add({
        kind: 'smoke',
        x: x + fxRng.range(-2, 2),
        y,
        vx: -fxRng.range(25, 70),
        vy: up ? -fxRng.range(15, 45) : -fxRng.range(4, 18),
        life: fxRng.range(0.35, 0.7),
        color: '#f2f6ff',
        color2: '#aebccc',
        size: 1.5,
        size2: 5,
        drag: 2.6,
        alpha: 0.75,
      });
    }
    const v = WALL.VENT;
    puffSteam(w, this.fx(D(v.x)), G - HY(v.y) - 4, -fxRng.range(5, 25), -fxRng.range(25, 50), 1, 2.5);
  }

  private ambient(dt: number): void {
    const w = this.world;
    const G = this.G;
    // Smokestack exhaust.
    this.stackT -= dt;
    if (this.stackT <= 0) {
      this.stackT = 0.16;
      const s = WALL.SMOKESTACK;
      smoke(w, this.fx(D(s.x)), G - HY(s.y) - 2, { n: 1, color: '#5a5660', color2: '#3a3640', size: 2.5, size2: 8, vx: -10, vy: -24, life: 1.5 });
    }
    // Damage: smoke and fire from the breaches.
    this.fxT -= dt;
    const f = this.hpFrac;
    if (this.fxT <= 0 && f < 0.85) {
      this.fxT = f < 0.33 ? 0.07 : f < 0.66 ? 0.12 : 0.2;
      const spots = WALL.BREACHES;
      const n = f < 0.33 ? spots.length : f < 0.66 ? 3 : 1;
      const s = spots[fxRng.int(0, n - 1)];
      const x = this.fx(D(s.x));
      const y = G - HY(s.y);
      smoke(w, x, y, { n: 1, color: '#3a3640', color2: '#24202a', size: 2.5, size2: 9, vy: -26, life: 1.4 });
      if (f < 0.5 && fxRng.chance(0.55)) flames(w, x, y + 2, { n: 2, size: 2, life: 0.35, spread: 3 });
      if (f < 0.66 && fxRng.chance(0.08)) sparkBurst(w, x, y, 3, '#ffc060', 70);
    }
  }

  // ---------------------------------------------------------------- death

  override onDeathStart(): void {
    const w = this.world;
    for (const e of w.query((q) => (q as { m3hazard?: boolean }).m3hazard === true)) e.remove();
    this.lance = null;
    this.spikeT = -1;
    this.boulderLeft = 0;
    this.coreK = Math.max(this.coreK, 0.6);
    this.deathPops = [
      { t: 0.35, done: false, d: D(WALL.MG.x), h: HY(WALL.MG.y) - 9 },
      { t: 0.8, done: false, d: D(WALL.FLAK.x), h: HY(WALL.FLAK.y) + 10 },
      { t: 1.2, done: false, d: D(WALL.MORTAR.x), h: HY(WALL.MORTAR.y) + 8 },
      { t: 1.6, done: false, d: 8, h: CORE_Y },
    ];
  }

  override deathArea(): Rect {
    const top = this.G - 140 + this.sink;
    return { x: this.fx(GALLERY_TIP), y: top, w: GALLERY_TIP + 120, h: Math.max(10, this.G - top - 6) };
  }

  override deathSequence(dt: number): void {
    const w = this.world;
    const t = this.deathTime;
    for (const p of this.deathPops) {
      if (p.done || t < p.t) continue;
      p.done = true;
      w.explode(this.fx(p.d), this.G - p.h + this.sink, { radius: 20, damage: 0, team: 'enemy', size: 'large', shake: 5, sfx: 'explosion_big' });
      for (let i = 0; i < 3; i++) w.add(new FlyingPart('bm3_plate', fxRng.int(0, 5), this.fx(p.d), this.G - p.h, fxRng.range(-160, 40), fxRng.range(-240, -90), { burn: i === 0 }));
    }
    if (t > 1.4) {
      const k = clamp((t - 1.4) / (this.deathDuration - 1.6), 0, 1);
      this.sink = (WALL.H + 8) * easeIn(k);
      this.rumbleT -= dt;
      if (this.rumbleT <= 0) {
        this.rumbleT = 0.07;
        w.shake(2.5, 0.12);
        puffSnow(w, this.face + fxRng.range(-70, 140), this.G - 1, 5, 70, true);
        smoke(w, this.face + fxRng.range(-60, 140), this.G - fxRng.range(0, 10), { n: 2, color: '#d8e0ec', color2: '#8a98b0', size: 4, size2: 12, vy: -36, vx: fxRng.range(-20, 10), life: 1.6, front: true });
        if (fxRng.chance(0.4)) w.add(new FlyingPart('bm3_plate', 3 + fxRng.int(0, 2), this.face + fxRng.range(-40, 120), this.G - 20, fxRng.range(-120, 40), fxRng.range(-220, -100), { smoke: true, life: 1.8 }));
        if (fxRng.chance(0.2)) snd(w, 'land', this.face, 0.8, 0.4);
      }
    }
    super.deathSequence(dt);
  }

  override onDestroyed(): void {
    const w = this.world;
    if (this.wallSolid) w.terrain.remove(this.wallSolid);
    this.wallSolid = null;
    w.add(
      new Wreck(this.face + 30, this.G, -1, [{ sprite: 'bm3_rubble', frame: 0, dx: 0, dy: 0 }], [
        { dx: 10, dy: -20, fire: true },
        { dx: -30, dy: -26, fire: false },
        { dx: -70, dy: -14, fire: true },
        { dx: 50, dy: -10, fire: false },
      ]),
    );
  }

  // ---------------------------------------------------------------- render

  override render(g: CanvasRenderingContext2D): void {
    const G = Math.round(this.G);
    const shakeX = this.jolt > 0 ? (Math.floor(this.age * 40) % 2 ? 1 : -1) : 0;
    const sunk = Math.round(this.rise * (WALL.H + 6) + this.sink);
    const ox = Math.round(this.x) + shakeX + (this.dying ? this.deathShakeX : 0);
    const by = G + sunk;
    /** World x / y of a sprite-space point of the wall. */
    const X = (sx: number): number => ox - (sx - WALL.OX);
    const Y = (sy: number): number => by - (WALL.H - sy);
    g.save();
    g.beginPath();
    g.rect(this.face - 140, G - 400, 700, 400);
    g.clip();
    const frame = this.dying ? 2 : Math.min(2, this.phase);
    sprites.get('bm3_wall').draw(g, ox, by, frame, { flip: true, flash: this.wallFlash > 0 });
    this.renderBeacons(g, X, Y);
    this.renderDeck(g, X, Y);
    this.renderCore(g, X, Y, shakeX);
    this.renderMG(g, X, Y);
    this.renderIcicles(g, X, Y);
    g.restore();
  }

  /** Hit flash for a part, blinking so constant fire never hides the art. */
  private blink(e: Entity): boolean {
    return e.flash > 0 && Math.floor(this.age * 30) % 2 === 0;
  }

  private renderBeacons(g: CanvasRenderingContext2D, X: (sx: number) => number, Y: (sy: number) => number): void {
    const spr = sprites.get('bm3_beacon');
    const warn = this.mode === 'closed' && this.introDone && this.modeDur - this.modeT < WARN;
    const red = this.charge > 0.05 || this.broken || this.dying;
    const active = warn || this.mode === 'opening' || this.mode === 'open' || this.mode === 'closing' || red;
    let f = 0;
    if (red) f = Math.floor(this.age * 8) % 2 ? 5 : 0;
    else if (active) f = 1 + (Math.floor(this.age * 12) % 4);
    for (const b of WALL.BEACONS) {
      const x = X(b.x);
      const y = Y(b.y);
      spr.draw(g, x, y, f, { flip: true });
      if (f > 0 && Math.floor(this.age * 12) % 2 === 0) {
        g.globalAlpha = 0.25;
        g.fillStyle = f === 5 ? '#ff3020' : '#ffb020';
        g.fillRect(x - 6, y - 8, 13, 9);
        g.globalAlpha = 1;
      }
    }
  }

  private renderDeck(g: CanvasRenderingContext2D, X: (sx: number) => number, Y: (sy: number) => number): void {
    const pop = Math.round((1 - this.deploy) * 22);
    // Flak.
    const fl = this.flak;
    const fx = X(WALL.FLAK.x);
    const fy = Y(WALL.FLAK.y) + pop;
    if (!fl.dead) {
      const ef = fl.stage === 'aim' ? 4 : fl.stage === 'fire' || fl.recoil > 1 ? 2 : 1;
      const firing = fl.recoil > 2 ? 5 : 0;
      sprites.get('bm3_flak').draw(g, fx + Math.round(fl.recoil * 0.6), fy, ef + firing, { flip: true, flash: this.blink(fl) });
    } else sprites.get('bm3_wreck').draw(g, fx, fy, 1, { flip: true });
    // Mortar nest.
    const mo = this.mortar;
    const mx = X(WALL.MORTAR.x);
    const my = Y(WALL.MORTAR.y) + pop;
    if (!mo.dead) {
      const mf = mo.recoil > 2 ? 1 : mo.recoil > 0.5 ? 2 : 0;
      sprites.get('bm3_mortar').draw(g, mx, my, mf, { flip: true, flash: this.blink(mo) });
    } else sprites.get('bm3_wreck').draw(g, mx, my, 2, { flip: true });
  }

  private renderCore(g: CanvasRenderingContext2D, X: (sx: number) => number, Y: (sy: number) => number, shakeX: number): void {
    void shakeX;
    const faceX = X(WALL.FACE);
    const gTop = Y(WALL.GATE.y);
    const gBot = Y(WALL.GATE.y + WALL.GATE.h);
    const cy = Math.round((gTop + gBot) / 2);
    // Core assembly: glows in the dark gate recess once the doors part, then rams out on its pistons.
    if (this.doorK > 0.02 || this.coreK > 0.01) {
      g.save();
      g.beginPath();
      g.rect(faceX - 90, gTop - 1, 90 + (WALL.FACE - WALL.GATE.x), gBot - gTop + 2);
      g.clip();
      const hot = this.charge > 0.6 || (this.lance?.firing ?? false);
      const fr = this.dying ? 4 + (Math.floor(this.age * 30) % 2) : hot ? 4 + (Math.floor(this.age * 20) % 2) : Math.floor(this.age * 6) % 4;
      const x = faceX + Math.round(WALL.CORE_LEN * (1 - this.coreK) + this.coreRecoil);
      // Hit flash blinks so a core under constant fire still shows its art.
      const flash = this.flashing('core') && Math.floor(this.age * 30) % 2 === 0;
      sprites.get('bm3_core').draw(g, x, cy, fr, { flip: true, flash });
      g.restore();
    }
    // Blast doors: the upper half retracts into the header, the lower one into the sill.
    if (!this.broken) {
      const s = sprites.get('bm3_door');
      const half = Math.round((gBot - gTop) / 2);
      const open = Math.round(this.doorK * (half + 1));
      g.save();
      g.beginPath();
      g.rect(faceX - WALL.FRAME - 2, gTop, WALL.FRAME + 5, gBot - gTop);
      g.clip();
      s.draw(g, faceX + 1, gTop - open, 0, { flip: true });
      s.draw(g, faceX + 1, gTop + half + open, 1, { flip: true });
      g.restore();
    }
  }

  private renderMG(g: CanvasRenderingContext2D, X: (sx: number) => number, Y: (sy: number) => number): void {
    const t = this.mg;
    const x = X(WALL.MG.x);
    const y = Y(WALL.MG.y) - Math.round((1 - this.deploy) * 14);
    if (t.dead) {
      sprites.get('bm3_wreck').draw(g, x, y + 18, 0, { flip: true });
      return;
    }
    // World angle -> sprite-space angle (sprite faces right, drawn flipped).
    const th = Math.PI - t.ang;
    const deg = (th * 180) / Math.PI;
    const ai = clamp(Math.round((deg - MG_A0) / MG_STEP), 0, MG_N - 1);
    const firing = t.stage === 'fire' && t.recoil > 1;
    const rx = Math.round(Math.cos(t.ang) * -t.recoil);
    const ry = Math.round(Math.sin(t.ang) * -t.recoil);
    sprites.get('bm3_mg').draw(g, x + rx, y + ry, ai + (firing ? MG_N : 0), { flip: true, flash: this.blink(t) });
    // Lock-on blink.
    if (t.stage === 'aim' && t.locked && Math.floor(this.age * 20) % 2 === 0) {
      const cx = x;
      const cyy = y + 9;
      g.fillStyle = '#ff3a2a';
      for (let i = 18; i < 60; i += 5) g.fillRect(Math.round(cx + Math.cos(t.lockAng) * i), Math.round(cyy + Math.sin(t.lockAng) * i), 1, 1);
    }
  }

  private renderIcicles(g: CanvasRenderingContext2D, X: (sx: number) => number, Y: (sy: number) => number): void {
    if (this.dying) return;
    const spr = sprites.get('bm3_icicle');
    const y = Y(WALL.GALLERY_BOTTOM);
    for (const s of this.slots) {
      const f = Math.floor(s.grow);
      if (f < 0 || s.grow < 0.3) continue;
      spr.draw(g, X(WALL.FACE + s.d), y, Math.min(3, f));
    }
  }
}

/** Angle approach that takes the short way round. */
function approachAngle(a: number, b: number, d: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= d) return b;
  return a + Math.sign(diff) * d;
}

/** MG sprite aim frames (sprite space, degrees down from facing right). */
const MG_A0 = MG_FRAMES.a0;
const MG_STEP = MG_FRAMES.step;
const MG_N = MG_FRAMES.n;

// ------------------------------------------------------------------ registration

registerEntity(
  'boss_m3',
  'boss',
  () => new FrostBastion(),
  'FROST BASTION (mission 3 boss, 260 hp): a mountain gatehouse wall that rises out of the snow and fills the right side of the arena. ' +
    'Weak point: the frost core behind blast doors at the foot of the wall (only hittable while open - shoot it with plain forward fire); ' +
    '3 destructible turrets (MG under the gallery, ice flak + mortar on the gallery - shoot them from below); attacks: head-height frost lance ' +
    '(crouch), floor spike wave (jump), avalanche boulders (jump/shoot), icicles (shadows). ' +
    'ARENA: flat ground from lockX-40 to lockX+470 (no pits/water/platforms/solids), camera at the level bottom with the ground at y ~184 ' +
    '(level height 216). Spawn x = lockX + 316 (the boss aligns its wall face to lockX + 248 itself; the wall extends past the right edge). ' +
    'Lock: boss: true, announce "WARNING! FROST BASTION" (the boss itself does not announce), music "boss". Nothing else in the lock waves.',
);
