// THUNDERHEAD (boss_m5): the Rustcoat Legion's flagship airship, fought from the DRAGONFLY gyro.
//
// The ship holds a station on the right of the (locked) camera, nose toward the players, and bobs and
// drifts slowly. Everything is relative to the camera, so the arena only needs open sky.
//  - Entrance (2.6 s, not hittable): slides in from the right with its horn blaring.
//  - Parts: three ball turrets (dorsal fore / dorsal aft / chin; separately destructible pieces that
//    fire telegraphed 3-round bursts), two dorsal drone launch tubes, a bomb bay (parachute mines),
//    three broadside gun ports on the gondola, engine pods with pusher propellers (contact hurts).
//  - Damage: bridge windows x1.25, gondola x1, envelope x0.35, engines x0.5; the storm core in the
//    nose x1.35 once exposed.
//  - Phase 0 (100-62%): turrets + drones + mine curtains.
//    Phase 1 (62-33%): the envelope is holed and burns; broadside fan volleys join in.
//    Phase 2 (<33%): the nose cap is blown off, exposing the STORM CORE: aimed lightning bolts
//    (tracking dotted line, lock blink, strike) on top of everything else; the ship lists lower.
//  - Death: fires everywhere, the ship plunges nose-first, breaks in two and falls out of the sky.
// The boss entity's own box (x, y, w, h) is the current main target (gondola, then the core), which
// is what the flying autopilot lines up with; the art is drawn from shipX/shipY.

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { angleTo, clamp, rectsOverlap, rotateTowards, wrapAngle, type Rect } from '../../../engine/math';
import { EnemyBullet } from '../../../game/projectile';
import type { Damage } from '../../../game/constants';
import type { Entity } from '../../../game/entity';
import { BigBoss, BossPiece, FlyingPart, flames, smoke, sparkBurst, type Zone } from '../common/kit';
import { pixelEllipse } from '../common/fx';
import { BALL_DIRS, CORE_POS, HOLES1, HOLES2, PORTS, T5 } from './art';
import { BroadsideShell, LightningStrike, SkyMine, WreckHalf, s5 } from './projectiles';

// ------------------------------------------------------------------ layout & tuning

/** Ship origin (envelope centre) on screen at its station. */
export const STATION_X = 270;
export const STATION_Y = 100;
/** Entrance: starts this far right / up of the station. */
const ENTRY_DX = 250;
const ENTRY_DY = -24;
export const INTRO_TIME = 2.6;
export const BASE_HP = 400;
const TURRET_HP = 16;
const MAX_DRONES = 3;
const MAX_MINES = 9;

interface TurretDef {
  key: string;
  ax: number;
  ay: number;
  mount: 0 | 1;
}
const TURRETS: TurretDef[] = [
  { key: 'dorsal_fore', ax: 60, ay: -36, mount: 0 },
  { key: 'dorsal_aft', ax: -12, ay: -36, mount: 0 },
  { key: 'chin', ax: 70, ay: 66, mount: 1 },
];
/** Drone launch tubes (art x; base on the envelope top). */
const TUBES = [38, 18];
const TUBE_Y = -27;
/** Engine pods: upper (on the flank, in front of the envelope) and lower (hanging below). */
const ENGINES: [number, number][] = [
  [-71, -8],
  [-71, 25],
];
const PROP_DX = -19;
const BAY_DROP: [number, number] = [39, 61];

type Attack = 'drones' | 'mines' | 'broadside' | 'lightning';
const PATTERNS: Attack[][] = [
  ['mines', 'drones', 'mines', 'drones'],
  ['broadside', 'drones', 'mines', 'broadside', 'mines'],
  ['lightning', 'drones', 'broadside', 'lightning', 'mines'],
];
const PAUSE = [2.3, 1.9, 1.6];

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ turret piece

/** Ball turret: a separately destructible BossPiece; aimed and fired by the ship. */
export class SkyTurret extends BossPiece {
  readonly def: TurretDef;
  aim: number;
  mode: 'idle' | 'warm' | 'burst' = 'idle';
  modeT = 0;
  cd: number;
  shots = 0;
  shotT = 0;
  kick = 0;
  destroyed = false;

  constructor(parent: Thunderhead, def: TurretDef, hp: number, cd: number) {
    super(parent, def.key, 15, 15, { hp, mul: 0.8, destructible: true });
    this.def = def;
    this.aim = def.mount === 0 ? Math.PI + 0.45 : Math.PI - 0.45;
    this.cd = cd;
    this.scoreValue = 1000;
  }

  /** Aim limits relative to "straight left" (+ = upward). */
  private arc(): [number, number] {
    return this.def.mount === 0 ? [-0.55, 1.45] : [-1.45, 0.55];
  }

  muzzle(): { x: number; y: number } {
    return { x: this.x + Math.cos(this.aim) * 14, y: this.y + Math.sin(this.aim) * 14 - 1 };
  }

  think(dt: number, ship: Thunderhead, allowFire: boolean): void {
    if (this.kick > 0) this.kick -= dt;
    const t = ship.target();
    const [lo, hi] = this.arc();
    // Angles relative to "straight ahead" (toward the ship's nose), + = upward.
    const fwd = ship.facing < 0 ? Math.PI : 0;
    const up = ship.facing < 0 ? 1 : -1;
    let want = this.aim;
    let inArc = false;
    if (t) {
      const a = angleTo(this.x, this.y, t.cx, t.cy);
      const rel = wrapAngle(a - fwd) * up;
      inArc = rel > lo - 0.12 && rel < hi + 0.12;
      want = fwd + clamp(rel, lo, hi) * up;
    }
    this.modeT += dt;
    switch (this.mode) {
      case 'idle':
        this.aim = rotateTowards(this.aim, want, 1.9 * dt);
        this.cd -= dt;
        if (this.cd <= 0 && allowFire && inArc && t && ship.turretSlot()) {
          this.mode = 'warm';
          this.modeT = 0;
        }
        break;
      case 'warm':
        this.aim = rotateTowards(this.aim, want, 0.9 * dt);
        if (!allowFire) {
          this.mode = 'idle';
          this.cd = 0.6;
        } else if (this.modeT >= 0.62) {
          this.mode = 'burst';
          this.modeT = 0;
          this.shots = 3;
          this.shotT = 0;
        }
        break;
      case 'burst':
        this.shotT -= dt;
        if (this.shotT <= 0 && this.shots > 0) {
          this.shotT = 0.13;
          this.shots--;
          const m = this.muzzle();
          const w = this.world;
          w.add(new EnemyBullet(ship, m.x, m.y, this.aim + w.rng.range(-0.04, 0.04), 150 * w.difficulty.enemyShotSpeed));
          const fx = w.effect('muzzle_flash', m.x, m.y, { fps: 30 });
          fx.rot = this.aim;
          s5(ship, 'heli_gun', { vol: 0.4, pitch: 1.1 });
          this.kick = 0.07;
        }
        if (this.shots <= 0 && this.shotT <= 0) {
          this.mode = 'idle';
          this.modeT = 0;
          this.cd = this.world.rng.range(2.5, 3.6) * this.world.difficulty.enemyFireDelay;
        }
        break;
    }
  }

  /** Ball frame for the current aim. */
  frame(): number {
    const a = ((this.aim % TAU) + TAU) % TAU;
    return Math.round(a / (TAU / BALL_DIRS)) % BALL_DIRS;
  }
}

// ------------------------------------------------------------------ the airship

export class Thunderhead extends BigBoss {
  /** Ship origin (envelope centre) in world space, and on screen. */
  shipX = 0;
  shipY = 0;
  sx = STATION_X + ENTRY_DX;
  sy = STATION_Y + ENTRY_DY;
  turrets: SkyTurret[] = [];
  dmgFrame = 0;
  coreOpen = false;
  /** 0..1 glow while the core charges a bolt. */
  coreCharge = 0;
  tubes = [
    { open: false, fire: 0 },
    { open: false, fire: 0 },
  ];
  bay = 0;
  portsOpen = false;
  portGlow = [0, 0, 0];
  portKick = [0, 0, 0];
  private cycle = 0;
  private nextTurretAt = 0;
  private launched = 0;
  private volleys = 0;
  private strike: LightningStrike | null = null;
  private strikes = 0;
  private gapT = 0;
  private humT = 0;
  private fxT = 0;
  private exhaustT = 0;
  prop = 0;
  private listY = 0;
  private wobble = 0;
  /** Death plunge. */
  sink = 0;
  private sinkV = 0;
  tilt = 0;
  private boomStage = 0;
  /** Throttled hit flashes per part (a held vulcan would otherwise white the whole ship out). */
  private hitFx: Record<string, { t: number; cd: number }> = {};

  constructor(_props: Record<string, any> = {}) {
    super('THUNDERHEAD', BASE_HP);
    this.anchor = 'center';
    this.facing = -1;
    this.w = 79;
    this.h = 25;
    this.scoreValue = 30000;
    this.phaseAt = [0.62, 0.33];
    this.deathDuration = 4.6;
  }

  override spawned(): void {
    this.placeShip(0);
    super.spawned();
    const w = this.world;
    const hp = Math.max(4, Math.round(TURRET_HP * w.difficulty.enemyHp));
    TURRETS.forEach((d, i) => {
      const t = new SkyTurret(this, d, hp, 1.2 + i * 0.9);
      t.onDestroyed = () => this.turretDestroyed(t);
      this.turrets.push(t);
      w.add(t);
    });
    this.placeTurrets();
    this.setState('intro');
  }

  // ------------------------------------------------------------ geometry

  /** World position of an art-space point (nose toward facing). */
  at(ax: number, ay: number): { x: number; y: number } {
    return { x: this.shipX + ax * this.facing, y: this.shipY + ay };
  }

  /** World rect of an art-space rect. */
  rectAt(ax0: number, ay0: number, ax1: number, ay1: number): Rect {
    const xa = this.shipX + ax0 * this.facing;
    const xb = this.shipX + ax1 * this.facing;
    return { x: Math.min(xa, xb), y: this.shipY + ay0, w: Math.abs(xb - xa), h: ay1 - ay0 };
  }

  coreAt(): { x: number; y: number } {
    return this.at(CORE_POS[0], CORE_POS[1]);
  }

  /** Move the ship relative to the camera (station + bob + drift + entrance / plunge offsets). */
  private placeShip(dt: number): void {
    const c = this.world.camera;
    const t = this.age;
    if (this.state === 'intro' && !this.dying) {
      const k = Math.min(1, this.stateTime / INTRO_TIME);
      const e = 1 - Math.pow(1 - k, 3);
      this.sx = STATION_X + ENTRY_DX * (1 - e);
      this.sy = STATION_Y + ENTRY_DY * (1 - e);
    } else {
      const ft = this.fightTime;
      this.sx = STATION_X + Math.sin(ft * 0.37) * 6;
      this.sy = STATION_Y + Math.sin(ft * 0.55) * 6;
    }
    const wantList = this.coreOpen ? 7 : 0;
    this.listY += (wantList - this.listY) * Math.min(1, dt * 1.5);
    if (this.wobble > 0) this.wobble = Math.max(0, this.wobble - dt);
    const shake = this.wobble > 0 ? Math.sin(t * 47) * 2 * Math.min(1, this.wobble) : 0;
    this.shipX = c.x + this.sx + shake;
    this.shipY = c.y + this.sy + Math.sin(t * 1.6) * 2.2 + this.listY + this.sink;
  }

  private placeTurrets(): void {
    for (const tr of this.turrets) {
      if (tr.destroyed) continue;
      const p = this.at(tr.def.ax, tr.def.ay);
      tr.place(p.x, p.y);
    }
  }

  layoutZones(): void {
    const z: Zone[] = [];
    const add = (id: string, ax0: number, ay0: number, ax1: number, ay1: number, mul: number) => z.push({ id, mul, ...this.rectAt(ax0, ay0, ax1, ay1) });
    add('hull', -62, -26, 96, 26, 0.35);
    if (this.coreOpen) add('core', 66, -16, 97, 16, 1.35);
    add('gondola', 8, 33, 88, 58, 1);
    add('bridge', 55, 33, 89, 46, 1.25);
    add('engine', -86, -14, -55, -2, 0.5);
    add('engine', -86, 19, -55, 31, 0.5);
    for (const tx of TUBES) add('tube', tx - 4, -40, tx + 4, -27, 0.8);
    this.zones = z;
    // The entity box = the current main target (the autopilot lines up with it).
    const f = this.coreOpen ? this.rectAt(66, -16, 96, 16) : this.rectAt(8, 33, 87, 58);
    this.w = f.w;
    this.h = f.h;
    this.x = f.x + f.w / 2;
    this.y = f.y + f.h / 2;
  }

  /** Whole-ship bounds (death explosions, contact). */
  override deathArea(): Rect {
    return this.rectAt(-96, -28, 96, 58);
  }

  // ------------------------------------------------------------ behaviour

  /** Turret coordination: at most one turret starts a burst every ~0.85 s. */
  turretSlot(): boolean {
    if (this.world.time < this.nextTurretAt) return false;
    this.nextTurretAt = this.world.time + 0.85 * this.world.difficulty.enemyFireDelay;
    return true;
  }

  private turretDestroyed(t: SkyTurret): void {
    t.destroyed = true;
    const w = this.world;
    w.explode(t.x, t.y, { radius: 16, damage: 0, team: 'enemy', size: 'large', shake: 4, sfx: 'explosion_big' });
    w.add(new FlyingPart('bm5_ball', BALL_DIRS, t.x, t.y, fxRng.range(-30, 50), t.def.mount === 0 ? -170 : -40, { burn: true, life: 2.6, vr: fxRng.range(-9, 9) }));
    sparkBurst(w, t.x, t.y, 10, '#ffd060', 160);
  }

  private dronesAlive(): number {
    return this.world.query((e) => e.type === 'drone' && !e.dead && !(e as any).dying).length;
  }

  private minesAlive(): number {
    return this.world.query((e) => e instanceof SkyMine && !e.dead).length;
  }

  private nextAttack(): void {
    const list = PATTERNS[Math.min(this.phase, 2)];
    let a = list[this.cycle % list.length];
    this.cycle++;
    if (a === 'drones' && this.dronesAlive() >= MAX_DRONES) a = this.phase >= 1 ? 'broadside' : 'mines';
    if (a === 'mines' && this.minesAlive() > MAX_MINES - 4) a = this.phase >= 1 ? 'broadside' : 'drones';
    if (a === 'lightning' && !this.coreOpen) a = 'broadside';
    this.launched = 0;
    this.volleys = 0;
    this.strikes = 0;
    this.strike = null;
    this.gapT = 0;
    this.setState(a);
  }

  private resetRig(): void {
    for (const t of this.tubes) t.open = false;
    this.bay = 0;
    this.portsOpen = false;
    this.portGlow = [0, 0, 0];
    this.coreCharge = 0;
  }

  think(dt: number): void {
    const w = this.world;
    this.placeShip(dt);
    this.prop += dt * 26;
    for (const t of this.tubes) if (t.fire > 0) t.fire -= dt;
    for (let i = 0; i < 3; i++) if (this.portKick[i] > 0) this.portKick[i] -= dt;
    const fd = w.difficulty.enemyFireDelay;
    switch (this.state) {
      case 'intro':
        if (this.stateTime < dt * 1.5) s5(this, 'boss_roar', { vol: 0.9, pitch: 0.75 });
        if (this.stateTime >= INTRO_TIME) {
          this.finishIntro();
          this.setState('cruise');
        }
        break;
      case 'cruise':
        if (this.stateTime >= PAUSE[Math.min(this.phase, 2)] * fd) this.nextAttack();
        break;
      case 'stagger':
        if (this.stateTime >= 1.5) this.setState('cruise');
        break;
      case 'drones':
        this.thinkDrones();
        break;
      case 'mines':
        this.thinkMines();
        break;
      case 'broadside':
        this.thinkBroadside();
        break;
      case 'lightning':
        this.thinkLightning(dt);
        break;
    }
    if (this.state !== 'lightning') this.coreCharge = Math.max(0, this.coreCharge - dt * 2);
    this.placeTurrets();
    const fire = this.introDone && this.state !== 'stagger' && this.state !== 'lightning';
    for (const tr of this.turrets) if (!tr.destroyed && !tr.dead) tr.think(dt, this, fire);
    this.pushPlayers();
    this.hurtByProps();
    this.ambient(dt);
  }

  private thinkDrones(): void {
    const w = this.world;
    const t = this.stateTime;
    const n = Math.min([2, 2, 3][Math.min(this.phase, 2)], MAX_DRONES - this.dronesAlive() + this.launched);
    if (t < 0.02) {
      for (const tb of this.tubes) tb.open = true;
      s5(this, 'enemy_alert', { vol: 0.6, pitch: 0.8 });
    }
    if (this.launched < n && t >= 0.55 + this.launched * 0.45) {
      const i = this.launched++;
      const tb = this.tubes[i % 2];
      const m = this.at(TUBES[i % 2], TUBE_Y - 13);
      const kinds: ('kamikaze' | 'zap')[][] = [['kamikaze', 'zap'], ['zap', 'kamikaze'], ['kamikaze', 'zap', 'zap']];
      const kl = kinds[Math.min(this.phase, 2)];
      const kind = kl[i % kl.length];
      const alt = 66 + 38 * ((i + this.cycle) % 3);
      const d = w.spawn('drone', m.x, m.y, { kind, alt });
      if (d) {
        d.vx = -30 - i * 12;
        d.vy = -110;
      }
      tb.fire = 0.18;
      smoke(w, m.x, m.y, { n: 4, size: 2, size2: 7, vy: -30, color: '#d8d0c8', color2: '#7a7470', life: 0.7 });
      s5(this, 'mortar_fire', { vol: 0.55, pitch: 1.3 });
    }
    if (t >= 0.55 + Math.max(n, 1) * 0.45 + 0.5) {
      for (const tb of this.tubes) tb.open = false;
      this.setState('cruise');
    }
  }

  private thinkMines(): void {
    const w = this.world;
    const t = this.stateTime;
    const n = [4, 5, 5][Math.min(this.phase, 2)];
    if (t < 0.02) {
      this.bay = 1;
      s5(this, 'metal_hit', { vol: 0.5, pitch: 0.55 });
    }
    if (t >= 0.25 && this.bay === 1 && this.launched === 0) this.bay = 2;
    if (this.launched < n && t >= 0.6 + this.launched * 0.2) {
      const i = this.launched++;
      if (this.minesAlive() < MAX_MINES) {
        const p = this.at(BAY_DROP[0], BAY_DROP[1]);
        const vx = this.facing * (95 + i * 34 + w.rng.range(0, 20));
        const vy = -(95 + ((i * 3) % n) * 32 + w.rng.range(0, 20));
        w.add(new SkyMine(this, p.x, p.y, vx, vy, 6.5, this.facing * 20));
        s5(this, 'mortar_fire', { vol: 0.45, pitch: 0.9 });
        smoke(w, p.x, p.y + 3, { n: 2, size: 2, size2: 5, vy: 10, color: '#8a8480', color2: '#4a4448', life: 0.5 });
      }
    }
    if (t >= 0.6 + n * 0.2 + 0.35) this.bay = 1;
    if (t >= 0.6 + n * 0.2 + 0.6) {
      this.bay = 0;
      this.setState('cruise');
    }
  }

  private thinkBroadside(): void {
    const w = this.world;
    const t = this.stateTime;
    const n = this.phase >= 2 ? 3 : 2;
    if (t < 0.02) {
      this.portsOpen = true;
      s5(this, 'metal_hit', { vol: 0.55, pitch: 0.7 });
    }
    const T = 0.95 + this.volleys * 0.62;
    if (this.volleys < n) {
      for (let i = 0; i < 3; i++) {
        const start = T - 0.5 + i * 0.07;
        this.portGlow[i] = t >= start ? 1 : 0;
      }
      if (t >= T) {
        const k = this.volleys++;
        const tg = this.target();
        const g = this.at(39, 49);
        let base = tg ? angleTo(g.x, g.y, tg.cx, tg.cy) : this.facing < 0 ? Math.PI : 0;
        // Keep the fan pointed forward (never backward through the ship).
        const fwd = this.facing < 0 ? Math.PI : 0;
        base = fwd + clamp(wrapAngle(base - fwd), -0.6, 0.6);
        const spread = 0.27;
        for (let i = 0; i < 3; i++) {
          const m = this.at(PORTS[i][0] + 8, PORTS[i][1]);
          const a = base + (i - 1) * spread + (k % 2 ? spread / 2 : 0);
          w.add(new BroadsideShell(this, m.x, m.y, a, 118 * w.difficulty.enemyShotSpeed));
          const fx = w.effect('muzzle_flash', m.x, m.y, { fps: 30 });
          fx.rot = a;
          smoke(w, m.x, m.y, { n: 2, size: 2, size2: 6, vx: 30, vy: -10, color: '#c8c0b4', color2: '#6a6462', life: 0.6 });
          this.portKick[i] = 0.14;
          this.portGlow[i] = 0;
        }
        s5(this, 'tank_cannon', { vol: 0.6, pitch: 0.95 });
        w.shake(1.5, 0.15);
      }
    } else if (t >= T - 0.62 + 0.55) {
      this.portsOpen = false;
      this.portGlow = [0, 0, 0];
      this.setState('cruise');
    }
  }

  private thinkLightning(dt: number): void {
    const w = this.world;
    const total = 3;
    if (this.strike && !this.strike.dead) {
      this.coreCharge = Math.min(1, this.coreCharge + dt * 2.5);
      return;
    }
    if (this.strike) {
      this.strike = null;
      this.gapT = 0.3;
    }
    this.coreCharge = Math.max(0, this.coreCharge - dt * 3);
    if (this.gapT > 0) {
      this.gapT -= dt;
      return;
    }
    if (this.strikes >= total) {
      this.setState('cruise');
      return;
    }
    const k = this.strikes++;
    const c = this.coreAt();
    const tg = this.target();
    const ang = tg ? angleTo(c.x, c.y, tg.cx, tg.cy) : this.facing < 0 ? Math.PI : 0;
    this.strike = w.add(
      new LightningStrike(this, {
        origin: () => this.coreAt(),
        track: k === 0 ? 0.8 : 0.55,
        lock: 0.34 * Math.sqrt(w.difficulty.enemyFireDelay),
        turn: 2.3,
        angle: ang,
      }),
    );
    s5(this, 'boss_charge', { vol: 0.6, pitch: 1.2 });
  }

  // ------------------------------------------------------------ interplay

  /** Soft hull: flying players are nudged out of the envelope and the gondola. */
  private pushPlayers(): void {
    const solids = [this.rectAt(-80, -25, 96, 25), this.rectAt(8, 31, 88, 58)];
    for (const p of this.world.players) {
      const v = p.vehicle as (Entity & { flying?: boolean }) | null;
      if (!v || v.dead) continue;
      const b = v.box;
      for (const r of solids) {
        if (!rectsOverlap(b, r)) continue;
        const left = b.x + b.w - r.x;
        const up = b.y + b.h - r.y;
        const down = r.y + r.h - b.y;
        const m = Math.min(left, up, down);
        const step = Math.min(m, 3);
        if (m === left) {
          v.x -= step;
          v.vx = Math.min(v.vx, 0);
        } else if (m === up) {
          v.y -= step;
          v.vy = Math.min(v.vy, 0);
        } else {
          v.y += step;
          v.vy = Math.max(v.vy, 0);
        }
      }
    }
  }

  /** Spinning propellers are the only parts that hurt on contact. */
  private hurtByProps(): void {
    for (const [ex, ey] of ENGINES) {
      const r = this.rectAt(ex + PROP_DX - 4, ey - 16, ex + PROP_DX + 4, ey + 16);
      this.hurtPlayers(r, 'melee', 3);
    }
  }

  private ambient(dt: number): void {
    const w = this.world;
    // Engine drone.
    this.humT -= dt;
    if (this.humT <= 0) {
      this.humT = 0.4;
      s5(this, 'engine', { vol: 0.22, pitch: 0.6 });
    }
    // Exhaust from the engine stacks, blown back by the slipstream.
    this.exhaustT -= dt;
    if (this.exhaustT <= 0) {
      this.exhaustT = 0.09;
      for (const [ex, ey] of ENGINES) {
        const p = this.at(ex - 5, ey - 8);
        const bad = this.phase >= 2 && ey > 0;
        smoke(w, p.x, p.y, { n: 1, size: bad ? 2 : 1.5, size2: bad ? 6 : 4, vx: -this.facing * 38, vy: -14, life: 0.7, color: bad ? '#3a3640' : '#b8b4b0', color2: bad ? '#1e1c22' : '#7a7678' });
        if (bad && fxRng.chance(0.5)) flames(w, p.x, p.y + 2, { n: 1, vx: -this.facing * 30, size: 2 });
      }
    }
    // Fires in the torn envelope.
    this.fxT -= dt;
    if (this.fxT <= 0 && this.phase >= 1) {
      this.fxT = this.phase >= 2 ? 0.045 : 0.07;
      const list = this.phase >= 2 ? [...HOLES1, ...HOLES2] : HOLES1;
      const [hx, hy] = list[Math.floor(fxRng.next() * list.length)];
      const p = this.at(hx, hy);
      flames(w, p.x, p.y, { n: 3, vx: -this.facing * 35, vy: -30, size: 3, spread: 3, life: 0.4 });
      smoke(w, p.x, p.y - 2, { n: 1, vx: -this.facing * 45, vy: -18, size: 2.5, size2: 9, life: 1.2, color: '#3e3a3c', color2: '#22201f' });
    }
    // Smouldering turret mounts.
    for (const tr of this.turrets) {
      if (!tr.destroyed || !fxRng.chance(dt * 9)) continue;
      const p = this.at(tr.def.ax, tr.def.ay + (tr.def.mount === 0 ? 4 : -4));
      smoke(w, p.x, p.y, { n: 1, vx: -this.facing * 30, size: 1.5, size2: 6, life: 0.9, color: '#3e3a3c', color2: '#22201f' });
      if (fxRng.chance(0.4)) flames(w, p.x, p.y, { n: 1, size: 2 });
    }
    // Core crackle.
    if (this.coreOpen && fxRng.chance(dt * (6 + this.coreCharge * 30))) {
      const c = this.coreAt();
      const a = fxRng.range(0, TAU);
      sparkBurst(w, c.x + Math.cos(a) * 12, c.y + Math.sin(a) * 12, 2, '#c8f4ff', 70);
    }
  }

  // ------------------------------------------------------------ phases

  onPhase(phase: number, prev: number): void {
    for (let p = prev + 1; p <= phase; p++) this.enterPhase(p);
    // Each phase opens with its signature attack.
    this.cycle = 0;
    this.resetRig();
    this.strike?.remove();
    this.strike = null;
    this.setState('stagger');
  }

  private enterPhase(p: number): void {
    const w = this.world;
    this.wobble = 1.4;
    s5(this, 'boss_roar', { vol: 0.8, pitch: 0.7 });
    if (p === 1) {
      this.dmgFrame = 1;
      for (const [hx, hy, r] of HOLES1) {
        const c = this.at(hx, hy);
        w.explode(c.x, c.y, { radius: 14, damage: 0, team: 'enemy', size: 'large', shake: 4, sfx: 'explosion' });
        for (let i = 0; i < 2; i++) w.add(new FlyingPart('bm5_debris', i, c.x, c.y, fxRng.range(-40, 80), fxRng.range(-200, -90), { life: 2.4, smoke: true, burn: r > 4 }));
      }
      w.flash('#ffd8a0', 0.35);
    } else if (p === 2) {
      this.dmgFrame = 2;
      this.coreOpen = true;
      for (const [hx, hy] of HOLES2) {
        const c = this.at(hx, hy);
        w.explode(c.x, c.y, { radius: 12, damage: 0, team: 'enemy', size: 'medium', shake: 3, sfx: null });
      }
      const c = this.coreAt();
      w.explode(c.x, c.y, { radius: 30, damage: 0, team: 'enemy', size: 'huge', shake: 7, sfx: 'explosion_big' });
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.5;
        w.add(new FlyingPart('bm5_debris', 2 + (i % 2), c.x + Math.cos(a) * 10, c.y + Math.sin(a) * 12, this.facing * fxRng.range(40, 120) + Math.cos(a) * 40, -fxRng.range(100, 220), { life: 2.6, smoke: true }));
      }
      sparkBurst(w, c.x, c.y, 16, '#c8f4ff', 200);
      w.flash('#c8f0ff', 0.6);
      w.hitstop(0.08);
      s5(this, 'glass_break', { vol: 0.7, pitch: 0.7 });
    }
  }

  // ------------------------------------------------------------ death

  override onDeathStart(): void {
    const w = this.world;
    this.resetRig();
    this.strike?.remove();
    this.strike = null;
    for (const e of w.query((x) => x instanceof SkyMine || x instanceof LightningStrike)) {
      if (e instanceof SkyMine) e.pop();
      else e.remove();
    }
    for (const e of w.query((x) => x.type === 'drone' && !x.dead && x.hittable)) e.damage({ amount: 99, kind: 'explosion', owner: null });
    for (const tr of this.turrets) {
      if (tr.destroyed || tr.dead) continue;
      tr.destroyed = true;
      w.add(new FlyingPart('bm5_ball', BALL_DIRS, tr.x, tr.y, fxRng.range(-60, 60), -fxRng.range(80, 200), { burn: true, life: 3 }));
      tr.remove();
    }
    this.boomStage = 0;
  }

  override deathSequence(dt: number): void {
    const w = this.world;
    // Plunge: sink faster and faster, nose dipping.
    this.sinkV = Math.min(this.sinkV + 5 * dt, 18);
    this.sink += this.sinkV * dt;
    this.tilt = Math.min(0.2, this.tilt + dt * 0.055);
    this.prop += dt * Math.max(0, 26 - this.deathTime * 8);
    this.placeShip(dt);
    // Fires everywhere.
    this.fxT -= dt;
    if (this.fxT <= 0) {
      this.fxT = 0.03;
      const list = [...HOLES1, ...HOLES2];
      const [hx, hy] = list[Math.floor(fxRng.next() * list.length)];
      const p = this.shipPt(hx, hy);
      flames(w, p.x, p.y, { n: 3, vx: -this.facing * 30, vy: -40, size: 3, spread: 4 });
      smoke(w, p.x, p.y - 3, { n: 1, vx: -this.facing * 35, vy: -30, size: 3, size2: 11, life: 1.4, color: '#3a3436', color2: '#1e1a1e' });
    }
    // Big structural blasts.
    const marks = [0.5, 1.4, 2.3, 3.2];
    if (this.boomStage < marks.length && this.deathTime >= marks[this.boomStage]) {
      const k = this.boomStage++;
      const spots: [number, number][] = [
        [40, 45],
        [-30, 0],
        [60, 10],
        [-70, 20],
      ];
      const p = this.shipPt(spots[k][0], spots[k][1]);
      w.explode(p.x, p.y, { radius: 26, damage: 0, team: 'enemy', size: 'huge', shake: 6, sfx: 'explosion_big' });
      for (let i = 0; i < 3; i++) w.add(new FlyingPart('bm5_debris', (i + k) % 5, p.x, p.y, fxRng.range(-90, 90), fxRng.range(-220, -80), { life: 2.6, burn: i === 0 }));
      w.flash('#ffe0b0', 0.3);
    }
    super.deathSequence(dt);
  }

  /** World point of an art-space point, including the death tilt. */
  private shipPt(ax: number, ay: number): { x: number; y: number } {
    const rot = this.tilt * this.facing;
    const lx = ax * this.facing;
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    return { x: this.shipX + lx * cs - ay * sn, y: this.shipY + lx * sn + ay * cs };
  }

  override onDestroyed(): void {
    const w = this.world;
    const f = this.facing;
    const rot = this.tilt * f;
    const front = new WreckHalf(
      this.shipX,
      this.shipY,
      f,
      [
        { sprite: 'bm5_envelope', frame: 3, dx: 0, dy: 0 },
        { sprite: 'bm5_gondola', frame: 3, dx: 0, dy: 0 },
      ],
      [22, 110],
      [
        [50, 0],
        [40, 45],
        [80, -10],
        [30, -15],
      ],
      f * 28,
      18,
      f * 0.5,
    );
    front.rot = rot;
    const rear = new WreckHalf(
      this.shipX,
      this.shipY,
      f,
      [
        { sprite: 'bm5_engine', frame: 1, dx: ENGINES[1][0], dy: ENGINES[1][1] },
        { sprite: 'bm5_envelope', frame: 3, dx: 0, dy: 0 },
        { sprite: 'bm5_gondola', frame: 3, dx: 0, dy: 0 },
        { sprite: 'bm5_engine', frame: 1, dx: ENGINES[0][0], dy: ENGINES[0][1] },
      ],
      [-120, 22],
      [
        [-20, 0],
        [-60, 10],
        [0, -20],
        [-80, -5],
      ],
      -f * 22,
      0,
      -f * 0.32,
    );
    rear.rot = rot;
    w.add(rear);
    w.add(front);
    w.particles.debris(this.shipX, this.shipY, 30, ['#7d7343', '#5a522e', '#4c4e5a', '#d4a23a', '#3a3430'], 300);
  }

  // ------------------------------------------------------------ damage feedback

  override update(dt: number): void {
    for (const k in this.hitFx) {
      this.hitFx[k].t -= dt;
      this.hitFx[k].cd -= dt;
    }
    super.update(dt);
  }

  private lit(key: string): boolean {
    return (this.hitFx[key]?.t ?? 0) > 0;
  }

  override applyHit(d: Damage, mul: number, id: string): boolean {
    const ok = super.applyHit(d, mul, id);
    if (ok) {
      const key = id === 'bridge' ? 'gondola' : id;
      const f = (this.hitFx[key] ??= { t: 0, cd: 0 });
      if (f.cd <= 0) {
        f.t = key === 'core' ? 0.05 : 0.034;
        f.cd = key === 'hull' ? 0.22 : 0.15;
      }
    }
    if (ok && id === 'core' && d.x !== undefined && d.y !== undefined && fxRng.chance(0.3)) sparkBurst(this.world, d.x, d.y, 3, '#c8f4ff', 120);
    return ok;
  }

  // ------------------------------------------------------------ render

  override render(g: CanvasRenderingContext2D): void {
    const f = this.facing;
    const flip = f < 0;
    const sx = Math.round(this.shipX);
    const sy = Math.round(this.shipY);
    const rot = this.dying ? this.tilt * f : 0;
    if (rot) {
      g.save();
      g.translate(sx, sy);
      g.rotate(rot);
      g.translate(-sx, -sy);
    }
    const at = (ax: number, ay: number) => ({ x: sx + ax * f, y: sy + ay });
    const S = (n: string) => sprites.get(n);
    const spin = this.dying && this.deathTime > 2.5 ? 4 : Math.floor(this.prop) % 4;
    const engFrame = this.phase >= 2 || this.dying ? 1 : 0;
    // Lower engine pod (behind the envelope) + its propeller.
    {
      const [ex, ey] = ENGINES[1];
      const p = at(ex, ey);
      S('bm5_engine').draw(g, p.x, p.y, engFrame, { flip, flash: this.lit('engine') });
      const q = at(ex + PROP_DX, ey);
      S('bm5_prop').draw(g, q.x, q.y, spin, { flip });
    }
    // Envelope (big: hits flicker a translucent flash instead of a full white-out).
    S('bm5_envelope').draw(g, sx, sy, this.dmgFrame, { flip });
    if (this.lit('hull')) S('bm5_envelope').draw(g, sx, sy, this.dmgFrame, { flip, flash: true, alpha: 0.22 });
    // Drone launch tubes.
    TUBES.forEach((tx, i) => {
      const p = at(tx, TUBE_Y);
      const tb = this.tubes[i];
      S('bm5_tube').draw(g, p.x, p.y, tb.fire > 0 ? 2 : tb.open ? 1 : 0, { flip, flash: this.lit('tube') });
    });
    // Dorsal turrets.
    for (const tr of this.turrets) if (tr.def.mount === 0) this.drawTurret(g, tr, at(tr.def.ax, tr.def.ay));
    // Upper engine pod (on the flank, in front of the envelope).
    {
      const [ex, ey] = ENGINES[0];
      const p = at(ex, ey);
      S('bm5_engine').draw(g, p.x, p.y, engFrame, { flip, flash: this.lit('engine') });
      const q = at(ex + PROP_DX, ey);
      S('bm5_prop').draw(g, q.x, q.y, spin === 4 ? 4 : (spin + 2) % 4, { flip });
    }
    // Storm core.
    if (this.coreOpen) {
      const c = at(CORE_POS[0], CORE_POS[1]);
      const pulse = 0.25 + 0.15 * Math.sin(this.age * 9) + this.coreCharge * 0.45;
      pixelEllipse(g, c.x, c.y, 17 + this.coreCharge * 5, 15 + this.coreCharge * 4, T5.core, pulse * 0.5);
      const fr = this.coreCharge > 0.5 && Math.floor(this.age * 20) % 2 === 0 ? 4 : Math.floor(this.age * 12) % 4;
      S('bm5_core').draw(g, c.x, c.y, fr, { flip });
      if (this.lit('core')) S('bm5_core').draw(g, c.x, c.y, fr, { flip, flash: true, alpha: 0.8 });
    }
    // Gondola.
    S('bm5_gondola').draw(g, sx, sy, this.dmgFrame, { flip });
    if (this.lit('gondola')) S('bm5_gondola').draw(g, sx, sy, this.dmgFrame, { flip, flash: true, alpha: 0.42 });
    S('bm5_bay').draw(g, sx, sy, this.bay, { flip });
    if (this.portsOpen) {
      PORTS.forEach(([px, py], i) => {
        const kick = this.portKick[i] > 0 ? 2 : 0;
        const p = at(px - kick, py);
        S('bm5_port').draw(g, p.x, p.y, this.portGlow[i] ? 2 : 1, { flip });
      });
    }
    // Chin turret.
    for (const tr of this.turrets) if (tr.def.mount === 1) this.drawTurret(g, tr, at(tr.def.ax, tr.def.ay));
    // Beacons.
    const beacon = (ax: number, ay: number, period: number, ph: number, col: string) => {
      if ((this.age + ph) % period > 0.16) return;
      const p = at(ax, ay);
      g.fillStyle = col;
      g.fillRect(p.x - 1, p.y - 1, 2, 2);
      pixelEllipse(g, p.x, p.y, 3, 3, col, 0.35);
    };
    if (!this.dying) {
      beacon(74, -34, 1.1, 0, T5.lamp);
      beacon(-101, 0, 0.9, 0.4, '#ffffff');
      beacon(-98, -41, 1.1, 0.55, T5.lamp);
    }
    if (rot) g.restore();
    // Turret telegraphs (muzzle glow while warming up).
    for (const tr of this.turrets) {
      if (tr.destroyed || tr.dead || tr.mode !== 'warm') continue;
      const m = tr.muzzle();
      const k = tr.modeT / 0.62;
      const r = 1.5 + k * 2;
      pixelEllipse(g, m.x, m.y, r + 1, r + 1, '#ff6a2a', 0.45);
      pixelEllipse(g, m.x, m.y, r, r, Math.floor(tr.modeT * 16) % 2 ? '#ffe070' : '#ffffff', 0.9);
    }
  }

  private drawTurret(g: CanvasRenderingContext2D, tr: SkyTurret, p: { x: number; y: number }): void {
    const S = (n: string) => sprites.get(n);
    S('bm5_mount').draw(g, p.x, p.y, tr.def.mount, { flip: this.facing < 0 });
    if (tr.destroyed || tr.dead) return;
    const kx = tr.kick > 0 ? -Math.cos(tr.aim) : 0;
    const ky = tr.kick > 0 ? -Math.sin(tr.aim) : 0;
    S('bm5_ball').draw(g, p.x + kx, p.y + ky, tr.frame(), { flash: tr.flash > 0 });
  }
}
