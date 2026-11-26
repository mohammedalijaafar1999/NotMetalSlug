// boss_m1 — GRINDER (Mission 1, Palm Harbor): the Rustcoat Legion's steam-diesel war-dozer.
//
// Fight (one-screen ground arena, the Grinder faces left and never leaves the right half):
//  - Entrance: drives in from beyond the right edge (WARNING banner), lurches to a stop, horn blast.
//    Not hittable until the horn (about 2.4 s).
//  - CANNON VOLLEY: the turret elevates and lobs 2/3/4 arcing shells at you, each with a landing
//    shadow + blinking marker (1.0-1.3 s of warning). Keep moving.
//  - HATCH: the commander hatch flips open, riflemen pop up and leap out in front of the blade.
//  - BLADE CHARGE: telegraphed by revving (black smoke, treads spinning in place, blade lowering with
//    sparks, headlamp beam, red beacon), then it rams left and slams to a stop short of the left edge.
//    Dodge: stand in the safe pocket at the left edge (66/46/30 px wide by phase) or JUMP over the
//    low blade (its hitbox is the bottom 28 px; the hull itself never hurts). It then backs up
//    slowly with an amber reverse lamp (the rear sprocket hurts while reversing).
//  - FLAME VENTS (phase 2+): nozzles in the blade glow and hiss, then spray a ground-hugging flame
//    jet 96/108 px forward. Back off to the left edge.
//  - Weak point: the smoke stack on the boiler (x2 damage; jump-shots and grenades reach it). At 50%
//    it blows off and the burning stub stays a weak point; at 25% the armour plates fly off
//    (all hits +30%) and it gets frantic.
//  - Death: shudders, parts blow off, chained explosions, leaves a burning wreck.
//
// ARENA REQUIREMENTS (mission designers):
//  - Boss lock { x: L, boss: true, waves: [{ spawns: [{ type: 'boss_m1', x: L + 236 }] }] } with the
//    level ending at (or continuing flat past) L + 384. Do not give the lock an `announce` (the boss
//    shows its own WARNING). bossMusic 'boss'.
//  - FLAT ground across the whole arena [L, L + 384] (no pits, solids, water or platforms needed);
//    any ground height works (y 170-190 in a 216-tall level). The spawn x is its resting hull centre
//    (clamped to L+200..L+290); y is read from the ground. It drives in from off-screen right.
//  - Camera: bottom of the level (camera y = level height - 216); the stack top is 113 px above
//    the ground, keep at least ~140 px of open sky above the ground line.
//  - Keep the left 70 px of the arena clear: that is the charge safe pocket.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import type { Rect } from '../../engine/math';
import { Entity } from '../../game/entity';
import { Z } from '../../game/constants';
import { registerEntity } from '../../game/registry';
import { SF } from '../../art/soldier';
import { BigBoss, FlyingPart, Lobbed, Wreck, bsfx, flames, smoke, sparkBurst, type Zone } from './common/kit';
import { GR, bladeBottomRel } from './m1/grinder_art';

/** Per-phase tuning. */
const PH = [
  { idle: 1.0, charge: 150, pocket: 66, rev: 1.25, shells: 2, shellTime: 1.3, shellGap: 0.62, troops: 1, flameLen: 0, flameDur: 0 },
  { idle: 0.7, charge: 185, pocket: 46, rev: 1.0, shells: 3, shellTime: 1.15, shellGap: 0.5, troops: 2, flameLen: 96, flameDur: 1.1 },
  { idle: 0.42, charge: 215, pocket: 30, rev: 0.85, shells: 4, shellTime: 1.05, shellGap: 0.42, troops: 1, flameLen: 108, flameDur: 1.35 },
];

const BASE_HP = 320;
const INTRO_DRIVE = 1.85;
const INTRO_TIME = 2.45;
const MAX_TROOPS = 3;

type Attack = 'volley' | 'deploy' | 'charge' | 'flame';

/** A soldier leaping out of the hatch; becomes a real rifleman when it lands. */
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
    const s = sprites.get('rifleman');
    s.draw(g, this.x, this.y, this.vy < 0 ? SF.PANIC : SF.PANIC + 1, { flip: this.facing < 0 });
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
  barrelElev = 0.5;
  barrelTarget = 0.5;
  recoil = 0;
  hatch = 0;
  hatchTarget = 0;
  /** Soldier emerging from the hatch 0..1. */
  pop = 0;
  /** Suspension bob (render offset of the upper body) and its velocity. */
  bob = 0;
  bobV = 0;
  jitter = 0;
  headGlow = 0;
  beacon: 'off' | 'red' | 'amber' = 'off';
  stackGone = false;
  flameLen = 0;
  /** Current movement speed along x (signed, world). */
  vxMove = 0;
  troopers: Entity[] = [];
  private attacks = 0;
  private lastAttack: Attack | null = null;
  private sinceCharge = 0;
  private shotsLeft = 0;
  private shotT = 0;
  private troopsLeft = 0;
  private fxT = 0;
  private sndT = 0;
  private pendingStagger = 0;
  private staggerKind = 0;
  private shuffleTo = 0;
  private deathFx = 0;
  private sinkY = 0;

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

  private rectL(lx0: number, ly0: number, lx1: number, ly1: number, upper = true): Rect {
    const a = this.wx(lx0);
    const b = this.wx(lx1);
    const y0 = upper ? this.wy(ly0) : this.groundY + ly0;
    const y1 = upper ? this.wy(ly1) : this.groundY + ly1;
    return { x: Math.min(a, b), y: Math.min(y0, y1), w: Math.abs(b - a), h: Math.abs(y1 - y0) };
  }

  layoutZones(): void {
    const z: Zone[] = [];
    const add = (id: string, r: Rect, mul: number) => z.push({ id, mul, x: r.x, y: r.y, w: r.w, h: r.h });
    const bb = this.bladeBottom;
    add('blade', this.rectL(GR.BLADE_PX + GR.BLADE_BX - 2, bb - 36, GR.BLADE_TIP - 2, bb, false), 1);
    add('hull', this.rectL(GR.REAR, -52, 58, -2), 1);
    add('boiler', this.rectL(-12, -66, 60, -52), 1);
    add('turret', this.rectL(-66, -85, -14, -52), 1);
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
    this.homeX = Math.max(this.arenaL + 200, Math.min(this.arenaL + 290, this.x));
    this.startX = this.arenaR + 120;
    this.x = this.startX;
    this.y = this.groundY;
    this.shuffleTo = this.homeX;
    this.setState('intro');
    this.layoutZones();
  }

  override onPhase(phase: number, prev: number): void {
    this.pendingStagger = phase;
    if (prev < 1 && phase >= 1) this.staggerKind |= 1;
    if (phase >= 2) this.staggerKind |= 2;
  }

  // ------------------------------------------------------------------ behaviour

  think(dt: number): void {
    const st = this.stats;
    const prevX = this.x;
    this.sinceChargeTick();
    switch (this.state) {
      case 'intro':
        this.updateIntro();
        break;
      case 'idle':
        this.beacon = 'off';
        this.bladeTarget = 0;
        this.headGlow = Math.max(0, this.headGlow - dt * 2);
        this.vxMove = Math.max(-30, Math.min(30, (this.shuffleTo - this.x) * 2));
        this.x += this.vxMove * dt;
        this.barrelTarget = 0.45 + Math.sin(this.age * 0.8) * 0.08;
        if (this.pendingStagger) this.startStagger();
        else if (this.stateTime > st.idle * this.world.difficulty.enemyFireDelay) this.chooseAttack();
        break;
      case 'volley':
        this.updateVolley(dt);
        break;
      case 'deploy':
        this.updateDeploy();
        break;
      case 'rev':
        this.updateRev(dt);
        break;
      case 'charge':
        this.updateCharge(dt);
        break;
      case 'slam':
        this.updateSlam();
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
        this.updateStagger();
        break;
    }
    // Shared animation.
    const moved = this.x - prevX;
    if (this.state !== 'rev') this.treadPhase += -moved * this.facing;
    this.bladeLow += Math.sign(this.bladeTarget - this.bladeLow) * Math.min(Math.abs(this.bladeTarget - this.bladeLow), dt * 3.2);
    this.hatch += Math.sign(this.hatchTarget - this.hatch) * Math.min(Math.abs(this.hatchTarget - this.hatch), dt * 5);
    this.barrelElev += (this.barrelTarget - this.barrelElev) * Math.min(1, dt * 7);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    // Suspension spring.
    this.bobV += (-this.bob * 160 - this.bobV * 9) * dt;
    this.bob += this.bobV * dt;
    this.ambientFx(dt);
  }

  private sinceChargeTick(): void {
    /* counted per attack in chooseAttack */
  }

  private updateIntro(): void {
    const t = this.stateTime;
    if (t < INTRO_DRIVE) {
      const k = t / INTRO_DRIVE;
      const e = 1 - Math.pow(1 - k, 3);
      this.x = this.startX + (this.homeX - this.startX) * e;
      this.sndT -= 1 / 60;
      if (this.sndT <= 0) {
        this.sndT = 0.22;
        bsfx(this, 'tank_tread', { vol: 0.5 });
      }
      if (fxRng.chance(0.5)) this.world.particles.dust(this.rearX + this.facing * -4, this.groundY, 2, '#b89c70');
    } else if (this.x !== this.homeX) {
      this.x = this.homeX;
      // Lurch to a stop.
      this.bobV = 46;
      this.world.shake(3, 0.3);
      this.world.particles.dust(this.frontX, this.groundY, 8, '#b89c70');
      this.world.particles.dust(this.x, this.groundY, 8, '#b89c70');
    }
    if (t > 0.05 && t - 1 / 60 <= 0.05) {
      bsfx(this, 'warning', { vol: 0.9 });
      this.world.announce('WARNING!', { color: '#ff4040', time: 2.2, sub: 'THE GRINDER APPROACHES' });
    }
    if (t > INTRO_DRIVE + 0.1 && t - 1 / 60 <= INTRO_DRIVE + 0.1) {
      bsfx(this, 'boss_roar', { vol: 0.9 });
      this.world.shake(4, 0.5);
      // Horn: huge black blast from the stack.
      for (let i = 0; i < 10; i++) smoke(this.world, this.wx(GR.STACK_X), this.wy(GR.STACK_TOP), { n: 1, vy: -60 - i * 6, size: 3, size2: 11, life: 1.3, spread: 4 });
    }
    if (t >= INTRO_TIME) {
      this.finishIntro();
      this.setState('idle');
    }
  }

  private chooseAttack(): void {
    const ph = this.phase;
    const scripted: Attack[] = ['volley', 'deploy', 'charge'];
    let pick: Attack;
    const troops = this.aliveTroopers();
    if (this.attacks < scripted.length && ph === 0) {
      pick = scripted[this.attacks];
    } else {
      const opts: [Attack, number][] = [['volley', 3]];
      if (troops < Math.min(MAX_TROOPS, ph === 0 ? 2 : 3)) opts.push(['deploy', ph === 1 ? 2.2 : 1.6]);
      opts.push(['charge', this.sinceCharge >= 2 ? 9 : ph === 2 ? 3.2 : 2.4]);
      if (ph >= 1) opts.push(['flame', 2.6]);
      const filtered = opts.filter(([a]) => a !== this.lastAttack);
      pick = this.world.rng.weighted(filtered.length ? filtered : opts);
    }
    if (pick === 'deploy' && troops >= MAX_TROOPS) pick = 'volley';
    this.attacks++;
    this.lastAttack = pick;
    this.sinceCharge = pick === 'charge' ? 0 : this.sinceCharge + 1;
    this.shuffleTo = this.homeX + this.world.rng.pick([-18, -6, 0, 12, 20]);
    switch (pick) {
      case 'volley':
        this.shotsLeft = this.stats.shells;
        this.shotT = 0.5;
        this.beacon = 'red';
        this.setState('volley');
        break;
      case 'deploy':
        this.troopsLeft = Math.min(this.stats.troops, MAX_TROOPS - troops);
        this.setState('deploy');
        break;
      case 'charge':
        this.setState('rev');
        break;
      case 'flame':
        this.setState('flame_tel');
        break;
    }
  }

  aliveTroopers(): number {
    this.troopers = this.troopers.filter((t) => !t.dead && t.hittable);
    return this.troopers.length + this.world.query((e) => e instanceof HatchTrooper && e.boss === this).length;
  }

  // ---- cannon volley

  private muzzle(): { x: number; y: number; a: number } {
    const e = this.barrelElev;
    const len = GR.BARREL_LEN - this.recoil * 4;
    const lx = GR.BARREL_X + Math.cos(e) * len;
    const ly = GR.BARREL_Y - Math.sin(e) * len;
    const a = this.facing > 0 ? -e : Math.PI + e;
    return { x: this.wx(lx), y: this.wy(ly), a };
  }

  private updateVolley(dt: number): void {
    this.vxMove = 0;
    // Elevation rises with distance to the player (cosmetic).
    const dist = Math.abs(this.targetX() - this.wx(GR.BARREL_X));
    this.barrelTarget = Math.max(GR.BARREL_MIN, Math.min(GR.BARREL_MIN + GR.BARREL_STEP * (GR.BARREL_N - 1), 0.35 + dist / 420));
    this.shotT -= dt;
    if (this.shotT <= 0 && this.shotsLeft > 0) {
      this.fireShell(this.stats.shells - this.shotsLeft);
      this.shotsLeft--;
      this.shotT = this.stats.shellGap;
    }
    if (this.shotsLeft <= 0 && this.shotT <= -0.35) this.setState('idle');
  }

  private fireShell(i: number): void {
    const t = this.target();
    let tx = t ? t.x : this.arenaL + 90;
    if (t && i > 0) {
      // Later shells lead a moving target or bracket it.
      const lead = Math.sign(t.vx) * Math.min(48, Math.abs(t.vx) * 0.45);
      tx += lead + (i % 2 ? 1 : -1) * this.world.rng.range(0, 14);
    }
    tx = Math.max(this.arenaL + 8, Math.min(this.frontX - 14 * -this.facing, tx));
    const m = this.muzzle();
    this.world.add(
      new Lobbed({ owner: this, x: m.x, y: m.y, tx, ty: this.groundY, time: this.stats.shellTime, gravity: 380, radius: 18, size: 'medium', sprite: 'grinder_shell', shake: 3, trail: '#9a928a' }),
    );
    this.recoil = 1;
    this.bobV += 26;
    const fx = this.world.effect('muzzle_flash', m.x, m.y, { fps: 24 });
    fx.rot = m.a;
    smoke(this.world, m.x, m.y, { n: 5, vx: Math.cos(m.a) * 30, vy: -18, size: 2, size2: 7, life: 0.7, color: '#8a8480', color2: '#4a4448' });
    bsfx(this, 'tank_cannon', { vol: 0.85 });
    this.world.shake(2, 0.15);
  }

  // ---- hatch deploy

  private updateDeploy(): void {
    const t = this.stateTime;
    this.vxMove = 0;
    this.beacon = 'red';
    if (t < 0.02) {
      this.hatchTarget = 1;
      bsfx(this, 'metal_hit', { vol: 0.5, pitch: 0.6 });
    }
    if (t > 0.3 && this.troopsLeft > 0) {
      this.pop = Math.min(1, (t - 0.3) / 0.22);
      if (t - 1 / 60 <= 0.3) bsfx(this, 'enemy_alert', { vol: 0.6 });
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
    const hx = this.wx(GR.HATCH_CX);
    const hy = this.wy(GR.HATCH_Y + 2);
    const vx = this.facing * this.world.rng.range(190, 235);
    const vy = -this.world.rng.range(250, 290);
    this.world.add(new HatchTrooper(this, hx, hy, vx, vy));
    smoke(this.world, hx, hy, { n: 3, size: 2, size2: 5, life: 0.4, color: '#c8c0b0', color2: '#8a8480' });
  }

  // ---- blade charge

  private updateRev(dt: number): void {
    const t = this.stateTime;
    const st = this.stats;
    this.vxMove = 0;
    this.beacon = 'red';
    this.bladeTarget = 1;
    this.headGlow = Math.min(1, t / 0.4);
    this.treadPhase += dt * 140;
    this.jitter = fxRng.chance(0.5) ? 1 : -1;
    if (t < 1 / 60 + 1e-6 || this.stateTime - dt <= 0) {
      bsfx(this, 'boss_charge', { vol: 0.9 });
      this.bobV -= 30;
    }
    this.sndT -= dt;
    if (this.sndT <= 0) {
      this.sndT = 0.28;
      bsfx(this, 'engine', { vol: 0.6, pitch: 0.9 + t * 0.4 });
    }
    // Black smoke, dust thrown backwards from the spinning treads.
    if (fxRng.chance(0.6)) smoke(this.world, this.wx(GR.STACK_X), this.wy(GR.STACK_TOP + 2), { n: 1, vy: -55, size: 3, size2: 9, life: 0.9, color: '#2a2628', color2: '#1a181c' });
    if (fxRng.chance(0.5)) {
      for (const [ex, ey] of GR.EXHAUST) smoke(this.world, this.wx(ex), this.wy(ey), { n: 1, vx: -this.facing * 20, vy: -30, size: 1.5, size2: 5, life: 0.6, color: '#3a3438' });
    }
    if (fxRng.chance(0.7)) {
      const x = this.rearX - this.facing * 2;
      this.world.particles.add({ kind: 'px', x, y: this.groundY - 2, vx: -this.facing * fxRng.range(60, 140), vy: fxRng.range(-120, -40), life: 0.5, color: fxRng.chance(0.5) ? '#8a6a44' : '#5e4430', gravity: 500, size: 2 });
    }
    if (this.bladeLow > 0.95 && fxRng.chance(0.35)) sparkBurst(this.world, this.frontX, this.groundY - 1, 2, '#ffd080', 80);
    if (t >= st.rev * (0.85 + 0.15 * this.world.difficulty.enemyFireDelay)) {
      this.jitter = 0;
      this.vxMove = 0;
      this.setState('charge');
    }
  }

  private updateCharge(dt: number): void {
    const st = this.stats;
    const speed = Math.min(st.charge, Math.abs(this.vxMove) + 700 * dt);
    this.vxMove = this.facing * speed;
    this.x += this.vxMove * dt;
    this.beacon = 'red';
    this.headGlow = 1;
    // Blade hitbox: bottom 28 px of the blade (jumpable), 20 px deep.
    const bb = this.bladeBottom;
    const blade = this.rectL(GR.BLADE_TIP - 20, bb - 28, GR.BLADE_TIP, bb, false);
    this.hurtPlayers(blade, 'crush', 18);
    if (fxRng.chance(0.8)) sparkBurst(this.world, this.frontX, this.groundY - 1, 2, '#ffd080', 110);
    if (fxRng.chance(0.6)) this.world.particles.dust(this.frontX - this.facing * 6, this.groundY, 2, '#b89c70');
    this.sndT -= dt;
    if (this.sndT <= 0) {
      this.sndT = 0.16;
      bsfx(this, 'tank_tread', { vol: 0.7 });
    }
    const stop = this.arenaL + st.pocket;
    if ((this.facing < 0 && this.frontX <= stop) || (this.facing > 0 && this.frontX >= this.arenaR - st.pocket)) {
      this.x = this.facing < 0 ? stop + GR.BLADE_TIP : this.arenaR - st.pocket - GR.BLADE_TIP;
      this.vxMove = 0;
      this.setState('slam');
    }
  }

  private updateSlam(): void {
    const t = this.stateTime;
    if (t < 1 / 60 + 1e-6) {
      this.world.shake(6, 0.4);
      this.world.hitstop(0.05);
      this.bobV += 60;
      bsfx(this, 'explosion', { vol: 0.7, pitch: 0.7 });
      bsfx(this, 'metal_hit', { vol: 0.8, pitch: 0.5 });
      this.world.particles.dust(this.frontX, this.groundY, 12, '#b89c70');
      sparkBurst(this.world, this.frontX, this.groundY - 6, 12, '#ffd080', 180);
      // Rubble shaken loose from above (cosmetic).
      for (let i = 0; i < 8; i++) {
        this.world.particles.add({ kind: 'debris', x: this.arenaL + fxRng.range(4, 90), y: this.world.camera.y + fxRng.range(-10, 20), vx: fxRng.range(-20, 20), vy: fxRng.range(20, 80), life: 1.4, color: fxRng.pick(['#7a6a55', '#5a4a3a', '#a08a70']), size: fxRng.pick([1, 2]), gravity: 500, bounce: 0.3, rot: 0, vr: fxRng.range(-8, 8) });
      }
    }
    if (t > 0.45) {
      this.bladeTarget = 0;
      this.headGlow = Math.max(0, 1 - (t - 0.45) * 3);
    }
    if (t > 0.3 && fxRng.chance(0.3)) smoke(this.world, this.wx(30), this.wy(-40), { n: 1, vy: -30, color: '#d8d4cc', color2: '#a8a49c', size: 2, size2: 7, life: 0.6 });
    if (t >= 0.95) this.setState(this.pendingStagger ? 'stagger_wait' : 'reverse');
    if (this.state === 'stagger_wait') this.setState('reverse');
  }

  private updateReverse(dt: number): void {
    this.beacon = 'amber';
    this.bladeTarget = 0;
    this.vxMove = -this.facing * 62;
    this.x += this.vxMove * dt;
    // The rear sprocket grinds anything behind it.
    const rear = this.rectL(GR.REAR + 2, -24, GR.REAR + 14, 0, false);
    this.hurtPlayers(rear, 'crush', 18);
    this.sndT -= dt;
    if (this.sndT <= 0) {
      this.sndT = 0.4;
      bsfx(this, 'engine', { vol: 0.35, pitch: 0.8 });
    }
    if ((this.facing < 0 && this.x >= this.homeX) || (this.facing > 0 && this.x <= this.homeX)) {
      this.x = this.homeX;
      this.vxMove = 0;
      this.setState('idle');
    }
  }

  // ---- flame vents

  /** World position of the lower flame nozzle in the blade. */
  private nozzle(): { x: number; y: number } {
    const bb = this.bladeBottom;
    return { x: this.wx(GR.BLADE_PX + GR.BLADE_BX + 9), y: this.groundY + bb - 13 };
  }

  private updateFlame(dt: number): void {
    const st = this.stats;
    const t = this.stateTime;
    this.vxMove = 0;
    this.beacon = 'red';
    this.bladeTarget = 1;
    const n = this.nozzle();
    if (this.state === 'flame_tel') {
      if (t - dt <= 0) bsfx(this, 'fire_burst', { vol: 0.5, pitch: 0.7 });
      if (fxRng.chance(0.5)) flames(this.world, n.x + this.facing * 2, n.y, { n: 1, vx: this.facing * 20, vy: -10, size: 1.5, life: 0.25 });
      if (fxRng.chance(0.3)) smoke(this.world, n.x, n.y - 4, { n: 1, vy: -20, size: 1.5, size2: 4, life: 0.5, color: '#8a8480' });
      if (t >= (this.phase >= 2 ? 0.6 : 0.75) && this.bladeLow > 0.9) {
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

  // ---- phase transitions

  private startStagger(): void {
    this.pendingStagger = 0;
    this.setState('stagger');
  }

  private updateStagger(): void {
    const t = this.stateTime;
    this.vxMove = 0;
    this.beacon = 'red';
    this.jitter = t < 0.9 ? (fxRng.chance(0.5) ? 1 : -1) : 0;
    this.flameLen = 0;
    this.bladeTarget = 0;
    if (t < 1 / 60 + 1e-6) {
      bsfx(this, 'alarm', { vol: 0.7 });
      this.world.flash('#ffffff', 0.35);
      this.world.shake(5, 0.5);
      if (this.staggerKind & 1 && !this.stackGone) this.blowStack();
      if (this.staggerKind & 2) this.stripArmour();
      this.staggerKind = 0;
    }
    if (t > 0.3 && t - 1 / 60 <= 0.3) {
      const r = this.deathArea();
      this.world.explode(r.x + r.w * 0.3, r.y + r.h * 0.6, { radius: 16, damage: 0, team: 'enemy', size: 'medium', shake: 3 });
    }
    if (t > 0.6 && t - 1 / 60 <= 0.6) {
      const r = this.deathArea();
      this.world.explode(r.x + r.w * 0.7, r.y + r.h * 0.45, { radius: 16, damage: 0, team: 'enemy', size: 'medium', shake: 3 });
    }
    if (t > 1.0 && t - 1 / 60 <= 1.0) {
      bsfx(this, 'boss_roar', { vol: 0.85 });
      for (let i = 0; i < 8; i++) smoke(this.world, this.wx(GR.STACK_X), this.wy(this.stackGone ? GR.STACK_Y - 14 : GR.STACK_TOP), { n: 1, vy: -70 - i * 5, size: 3, size2: 10, life: 1.1, color: '#e8e4dc', color2: '#b0aca4' });
    }
    if (t >= 1.45) {
      this.attacks = Math.max(this.attacks, 3);
      this.sinceCharge = 3;
      this.setState('idle');
      this.stateTime = 99;
    }
  }

  private blowStack(): void {
    this.stackGone = true;
    const sx = this.wx(GR.STACK_X);
    const sy = this.wy(GR.STACK_TOP + 6);
    this.world.explode(sx, sy + 10, { radius: 20, damage: 0, team: 'enemy', size: 'large', shake: 6, sfx: 'explosion_big' });
    this.world.add(new FlyingPart('grinder_parts', 1, sx, sy, -this.facing * 70, -330, { vr: 7, life: 3.2, burn: true, groundY: this.groundY }));
    this.world.add(new FlyingPart('grinder_parts', 0, this.wx(-25), this.wy(-30), this.facing * 60, -220, { vr: -6, life: 3, groundY: this.groundY }));
    for (let i = 0; i < 4; i++) this.world.add(new FlyingPart('boss_debris', i % 3, sx, sy + 20, fxRng.range(-140, 140), fxRng.range(-320, -160), { life: 2.2, groundY: this.groundY }));
  }

  private stripArmour(): void {
    this.armorMul = 1.3;
    const pts: [number, number, number][] = [
      [-60, -30, 0],
      [12, -30, 0],
      [-40, -62, 3],
      [20, -44, 3],
      [-74, -66, 5],
    ];
    pts.forEach(([lx, ly, fr], i) => {
      this.world.add(new FlyingPart('grinder_parts', fr, this.wx(lx), this.wy(ly), this.facing * fxRng.range(-120, 120), fxRng.range(-300, -180), { vr: fxRng.range(-9, 9), life: 3, burn: i % 2 === 0, groundY: this.groundY }));
    });
    this.world.explode(this.wx(-20), this.wy(-40), { radius: 24, damage: 0, team: 'enemy', size: 'large', shake: 6, sfx: 'explosion_big' });
  }

  // ---- ambient fx

  private ambientFx(dt: number): void {
    this.fxT -= dt;
    if (this.fxT > 0) return;
    this.fxT = 0.07;
    const w = this.world;
    const f = this.hpFrac;
    // Stack / stub exhaust.
    if (!this.stackGone) {
      if (fxRng.chance(0.4)) smoke(w, this.wx(GR.STACK_X), this.wy(GR.STACK_TOP + 2), { n: 1, vy: -32, size: 2, size2: 7, life: 1.1, color: f < 0.75 ? '#3a3436' : '#6a6466', color2: '#3a363a' });
    } else {
      flames(w, this.wx(GR.STACK_X), this.wy(GR.STACK_Y - 12), { n: 2, vy: -60, size: 3, life: 0.4, spread: 3 });
      smoke(w, this.wx(GR.STACK_X), this.wy(GR.STACK_Y - 20), { n: 1, vy: -40, size: 3, size2: 9, life: 1.2, color: '#2a2628', color2: '#1c1a1e' });
    }
    // Damage states.
    if (f < 0.75 && fxRng.chance(0.35)) smoke(w, this.wx(fxRng.range(-80, 40)), this.wy(fxRng.range(-60, -30)), { n: 1, vy: -24, size: 1.5, size2: 6, life: 0.9 });
    if (f < 0.5 && fxRng.chance(0.25)) flames(w, this.wx(fxRng.range(-70, 30)), this.wy(fxRng.range(-50, -34)), { n: 1, size: 2, life: 0.3 });
    if (f < 0.35 && fxRng.chance(0.12)) sparkBurst(w, this.wx(fxRng.range(-60, 40)), this.wy(fxRng.range(-60, -26)), 4, '#ffd080', 100);
    if (this.armorMul > 1 && fxRng.chance(0.3)) flames(w, this.wx(-34), this.wy(-40), { n: 1, size: 2, life: 0.3, vy: -20 });
  }

  // ------------------------------------------------------------------ death

  override onDeathStart(): void {
    this.deathDuration = 4.0;
    this.flameLen = 0;
    this.pop = 0;
    this.beacon = 'off';
    for (const t of this.troopers) if (!t.dead && t.hittable) t.damage({ amount: 99, kind: 'explosion', owner: null, x: this.x, y: t.cy, dir: Math.sign(t.x - this.x) || -1 });
    for (const e of this.world.query((x) => x instanceof HatchTrooper)) e.remove();
  }

  override deathSequence(dt: number): void {
    const t = this.deathTime;
    this.jitter = fxRng.chance(0.5) ? 1 : -1;
    this.sinkY = Math.min(5, t * 2);
    this.treadPhase += dt * 20;
    const ev = (at: number) => t >= at && this.deathFx < at;
    if (ev(0.35) && !this.stackGone) this.blowStack();
    if (ev(0.9)) {
      this.hatch = 1;
      this.world.add(new FlyingPart('grinder_parts', 2, this.wx(GR.HATCH_CX), this.wy(GR.HATCH_Y), -this.facing * 40, -300, { vr: 10, life: 3, groundY: this.groundY }));
    }
    if (ev(1.5)) {
      this.world.add(new FlyingPart('grinder_parts', 4, this.wx(GR.BARREL_X + 20), this.wy(GR.BARREL_Y - 10), this.facing * 90, -260, { vr: 6, life: 3, burn: true, groundY: this.groundY }));
      this.barrelElev = -1;
    }
    if (ev(2.2)) this.bladeTarget = 1;
    this.bladeLow = Math.min(1, this.bladeLow + dt * 2 * (this.bladeTarget > 0 ? 1 : 0));
    if (fxRng.chance(0.5)) flames(this.world, this.wx(fxRng.range(-80, 50)), this.wy(fxRng.range(-80, -30)), { n: 1, size: 2.5, life: 0.4 });
    this.deathFx = t;
    super.deathSequence(dt);
  }

  override onDestroyed(): void {
    const bb = GR.BLADE_PY + bladeBottomRel(1);
    void bb;
    this.world.add(
      new Wreck(this.x, this.groundY + 4, this.facing, [
        { sprite: 'grinder_tracks', frame: GR.TRACK_FRAMES, dx: 0, dy: -4 },
        { sprite: 'grinder_body', frame: 3, dx: 0, dy: 0 },
        { sprite: 'grinder_blade', frame: 8, dx: GR.BLADE_PX, dy: GR.BLADE_PY - 4 },
      ], [
        { dx: GR.STACK_X, dy: GR.STACK_Y - 4, fire: true },
        { dx: -40, dy: -84, fire: true },
        { dx: -20, dy: -48, fire: false },
        { dx: -84, dy: -72, fire: false },
        { dx: 10, dy: -60, fire: true },
      ]),
    );
    this.world.particles.debris(this.x, this.groundY - 50, 24, ['#7d7343', '#5a522e', '#3c3834', '#d4a23a', '#4c4e5a'], 300);
  }

  // ------------------------------------------------------------------ render

  override render(g: CanvasRenderingContext2D): void {
    const f = this.facing;
    const flip = f < 0;
    const X = Math.round(this.x) + this.jitter;
    const G = Math.round(this.groundY + this.sinkY);
    const B = Math.round(this.groundY + this.bob + this.sinkY);
    const P = (lx: number) => X + f * lx;
    const fl = (id: string) => this.flashing(id);
    // Headlamp beam (behind the boss so it shines out in front).
    if (this.headGlow > 0.05) this.renderBeam(g, P(GR.LAMP_FX), B + GR.LAMP_FY);
    // Cannon barrel (behind the turret mantlet).
    if (this.barrelElev > -0.5) {
      const fr = Math.max(0, Math.min(GR.BARREL_N - 1, Math.round((this.barrelElev - GR.BARREL_MIN) / GR.BARREL_STEP)));
      const e = GR.BARREL_MIN + fr * GR.BARREL_STEP;
      const rx = -Math.cos(e) * this.recoil * 4;
      const ry = Math.sin(e) * this.recoil * 4;
      const s = sprites.get('grinder_barrel');
      s.draw(g, P(GR.BARREL_X + rx), B + GR.BARREL_Y + ry, fr, { flip });
      if (fl('turret')) s.draw(g, P(GR.BARREL_X + rx), B + GR.BARREL_Y + ry, fr, { flip, flash: true, alpha: 0.5 });
    }
    // Soldier popping out of the hatch (the turret hides his legs).
    if (this.pop > 0) sprites.get('rifleman').draw(g, P(GR.HATCH_CX), B + GR.HATCH_Y + 26 - Math.round(this.pop * 17), SF.ALERT, { flip });
    // Tracks.
    const tf = this.dying || this.dead ? GR.TRACK_FRAMES : (((Math.floor(this.treadPhase) % GR.TRACK_FRAMES) + GR.TRACK_FRAMES) % GR.TRACK_FRAMES);
    sprites.get('grinder_tracks').draw(g, X, G, tf, { flip });
    // Body.
    const bodyFrame = this.dying ? Math.min(3, (this.armorMul > 1 ? 2 : this.phase >= 1 ? 1 : 0) + (this.deathTime > 2.6 ? 3 : 0)) : this.armorMul > 1 ? 2 : this.phase >= 1 ? 1 : 0;
    const body = sprites.get('grinder_body');
    body.draw(g, X, B, bodyFrame, { flip });
    if (fl('hull') || fl('boiler') || fl('turret')) body.draw(g, X, B, bodyFrame, { flip, flash: true, alpha: 0.45 });
    // Hatch lid.
    if (!(this.dying && this.deathTime > 0.9)) {
      const hf = this.hatch < 0.25 ? 0 : this.hatch < 0.75 ? 1 : 2;
      sprites.get('grinder_hatch').draw(g, P(GR.HATCH_X), B + GR.HATCH_Y, hf, { flip });
    }
    // Smoke stack (or its burning stub).
    const stack = sprites.get('grinder_stack');
    const sf = this.stackGone ? 3 : this.hpFrac < 0.62 ? 2 : this.hpFrac < 0.82 ? 1 : 0;
    stack.draw(g, P(GR.STACK_X), B + GR.STACK_Y, sf, { flip });
    if (fl('stack')) stack.draw(g, P(GR.STACK_X), B + GR.STACK_Y, sf, { flip, flash: true, alpha: 0.6 });
    // Blade.
    const pos = this.bladeLow < 0.25 ? 0 : this.bladeLow < 0.75 ? 1 : 2;
    const cond = this.dying && this.deathTime > 2.6 ? 2 : this.phase >= 1 ? 1 : 0;
    const blade = sprites.get('grinder_blade');
    blade.draw(g, P(GR.BLADE_PX), G + GR.BLADE_PY, cond * 3 + pos, { flip });
    if (fl('blade')) blade.draw(g, P(GR.BLADE_PX), G + GR.BLADE_PY, cond * 3 + pos, { flip, flash: true, alpha: 0.45 });
    // Beacon + headlamp lens.
    const blink = Math.floor(this.age * (this.beacon === 'amber' ? 5 : 9)) % 2 === 1;
    const lampFrame = this.beacon === 'amber' ? (blink ? 3 : 2) : this.beacon === 'red' && blink ? 1 : 0;
    sprites.get('grinder_lamp').draw(g, P(GR.LAMP_X), B + GR.LAMP_Y, lampFrame, { flip });
    if (this.headGlow > 0.05) {
      g.fillStyle = this.headGlow > 0.6 ? '#fffbe0' : '#ffe070';
      g.fillRect(P(GR.LAMP_FX) - (flip ? 2 : 0), B + GR.LAMP_FY - 2, 2, 4);
    }
    // Flame jet.
    if (this.flameLen > 1) this.renderFlame(g);
    // Nozzle glow while the vents build pressure.
    if (this.state === 'flame_tel' && Math.floor(this.age * 12) % 2 === 0) {
      const n = this.nozzle();
      g.fillStyle = '#ffb040';
      g.fillRect(Math.round(n.x) - 1, Math.round(n.y) - 8, 2, 2);
      g.fillRect(Math.round(n.x) - 1, Math.round(n.y) - 1, 2, 2);
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
  'GRINDER (mission 1 boss): steam war-dozer. Arena: flat ground across one screen [L, L+384] with the camera ' +
    'locked at L (boss lock, no announce). Spawn { type: "boss_m1", x: L + 236 } (resting hull centre; it drives ' +
    'in from off-screen right). Needs ~140 px of sky above the ground; keep the left 70 px clear (charge safe pocket).',
);
