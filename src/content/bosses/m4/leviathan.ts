// LEVIATHAN (boss_m4): a monstrous Legion submarine in the harbour of Rustwater Docks.
//
// Arena: a dock (flat solid ground) on the facing side, deep water under the sub. The sub sits with
// its reference point (conning tower centre) at the spawn x and its waterline on the water surface.
//  Intro   rises from the depths (~2.7 s, not hittable): periscope, tower, then the hull breaches.
//  Phase 0 SURFACED  - torpedo volleys from the jaw (they skim the water and ride up onto the dock:
//                      jump them), missile pod salvos (markers show each landing spot), periscope
//                      laser whip (thin line + swept path telegraph, then a fast sweep: jump it).
//  Phase 1 CLAW      - a hatch on the head blows off and a mech claw arm unfolds: shadow-telegraphed
//                      slam, then it rakes the planks back toward the water (jump the fingers).
//  Phase 2 DIVE      - partially submerges: only the conning tower is above water (and hittable);
//                      double laser whips, claw slams from the water, torpedoes from underwater.
//  Death   explosions, a last breach, then it sinks with a geyser.
// Weak points: conning tower (x1.25, x1.6 submerged), missile pods (x1.25, destructible), the open
// mouth (x1.5 while the jaw is open); armoured hull/head x0.35; claw x0.7 (armoured x0 while diving).

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { clamp, lerp, approach, easeInQuad, easeInOutSine, segmentRect, type Rect } from '../../../engine/math';
import type { Damage, DamageKind } from '../../../game/constants';
import type { Entity } from '../../../game/entity';
import { BigBoss, LockMissile, GroundMarker as LandingMarker, FlyingPart, smoke, flames, sparkBurst } from '../common/kit';
import { GroundMarker as ShadowMarker, puffSteam, puffFoam, pixelEllipse } from '../common/fx';
import * as A from './art';
import { ClawArm } from './arm';
import { Torpedo, LaserBeam, m4sfx } from './weapons';

export const LEVIATHAN_HP = 360;
/** How far the sub sinks for phase 2 (deck under water, tower out). */
export const DIVE_SINK = 40;
/** The hull rides this far below its painted waterline (low profile: standing shots clear the head). */
export const FLOAT = 6;
/** Start depth of the intro (fully hidden). */
const INTRO_DEPTH = 112;
const POD_HP = 24;
/** Laser sweep ends this far from the arena's far edge. */
const SWEEP_END_MARGIN = 24;

interface Pod {
  id: 'podF' | 'podA';
  lx: number;
  hp: number;
  alive: boolean;
  open: number;
  target: number;
}

type ClawStep = 'rise' | 'reach' | 'track' | 'lock' | 'slam' | 'rest' | 'clench' | 'rake' | 'lift' | 'return';

export class Leviathan extends BigBoss {
  // ---- arena geometry (world)
  waterY = 0;
  deckY = 0;
  pierTip = 0;
  pierFar = 0;
  homeX = 0;
  // ---- body pose
  sink = INTRO_DEPTH;
  sinkTarget = 0;
  advance = 0;
  t = 0;
  dmgLevel = 0;
  // ---- parts
  jaw = 0;
  jawTarget = 0;
  scopeExt = 0;
  scopeTarget = 0;
  hatchOpen = false;
  armTarget = 0;
  readonly arm = new ClawArm();
  readonly pods: Pod[] = [
    { id: 'podF', lx: A.POD_F_X, hp: POD_HP, alive: true, open: 0, target: 0 },
    { id: 'podA', lx: A.POD_A_X, hp: POD_HP, alive: true, open: 0, target: 0 },
  ];
  beam!: LaserBeam;
  // ---- attack state
  private step = '';
  private stepT = 0;
  private shots = 0;
  private launchT = 0;
  private podIdx = 0;
  private cycle = 0;
  private lastAttack = '';
  private nextGap = 0.8;
  private sweeps = 0;
  private sweepX = 0;
  private sweepX0 = 0;
  private sweepEnd = 0;
  private clawX = 0;
  private clawFrom = { x: 0, y: 0 };
  private shadow: ShadowMarker | null = null;
  private beamCd = new Map<number, number>();
  // ---- fx state
  private fxT = 0;
  private ventT = 1;
  private sndT = 0;
  private introFlags = 0;
  private waterfallT = 0;
  private eyeFlash = 0;
  private breached = false;
  /** Phases reached (tests). */
  readonly phasesSeen = new Set<number>([0]);
  /** Count of attacks started by kind (tests / tuning). */
  readonly attacks: Record<string, number> = {};

  constructor() {
    super('LEVIATHAN', LEVIATHAN_HP);
    this.phaseAt = [0.66, 0.33];
    this.scoreValue = 30000;
    this.deathDuration = 5.2;
    this.w = 190;
    this.h = 100;
    this.facing = -1;
  }

  // ------------------------------------------------------------------ setup

  override spawned(): void {
    super.spawned();
    const T = this.world.terrain;
    const cx = (this.arenaL + this.arenaR) / 2;
    const pf = this.props.facing;
    this.facing = pf === 1 || pf === -1 ? pf : this.x > cx ? -1 : 1;
    this.arm.facing = this.facing;
    this.arm.back = this.facing > 0 ? -1 : 1;
    // Water surface under the sub (fallback: the ground, e.g. when spawned on land in tests).
    const water = T.water.find((w) => this.x >= w.x && this.x < w.x + w.w);
    const gy = T.groundTopAt(this.x);
    this.waterY = water ? water.y : isFinite(gy) ? gy : this.y;
    // Dock edge: first ground toward the pier that rises above the water.
    let tip = this.x + this.facing * 150;
    for (let i = 0; i < 420; i += 2) {
      const x = this.x + this.facing * i;
      if (T.groundTopAt(x) <= this.waterY - 2) {
        tip = x;
        break;
      }
    }
    this.pierTip = tip;
    const dy = T.groundTopAt(tip + this.facing * 24);
    this.deckY = isFinite(dy) ? dy : this.waterY - 10;
    this.pierFar = this.facing < 0 ? this.arenaL + 8 : this.arenaR - 8;
    this.homeX = this.x;
    this.sink = INTRO_DEPTH;
    this.y = this.waterY + FLOAT + this.sink;
    this.beam = this.world.add(new LaserBeam(this));
    this.setState('intro');
    this.layoutZones();
  }

  /** Sub-local x -> world x. */
  lx2w(lx: number): number {
    return this.x + lx * this.facing;
  }

  /** Visible surface (dock or water) at x. */
  surfaceAt(x: number): number {
    const T = this.world.terrain;
    const gy = T.groundTopAt(x);
    const w = T.waterAt(x, this.waterY + 1);
    const s = w ? Math.min(gy, w.y) : gy;
    return isFinite(s) ? s : this.waterY;
  }

  get submerged(): boolean {
    return this.sink > 20;
  }

  /** Arm shoulder pivot (world). */
  pivot(): { x: number; y: number } {
    return { x: this.lx2w(A.SHOULDER_X), y: this.y + A.SHOULDER_Y - 9 };
  }

  /** Periscope lens (world). */
  lensPos(): { x: number; y: number } {
    const ext = this.scopeExt * 18;
    return { x: this.lx2w(A.SCOPE_X + 9), y: this.y + A.DECK_Y + A.TOWER_TOP - 4 - ext - 5 };
  }

  private restPose(): { x: number; y: number } {
    const p = this.pivot();
    const sway = this.dying ? 0 : 1;
    if (this.phase >= 2) return { x: p.x + this.facing * 30 + Math.sin(this.t * 1.4) * 3 * sway, y: p.y - 40 + Math.cos(this.t * 1.9) * 2 * sway };
    return { x: p.x + this.facing * 34 + Math.sin(this.t * 1.4) * 3 * sway, y: p.y - 28 + Math.cos(this.t * 1.9) * 2 * sway };
  }

  // ------------------------------------------------------------------ zones (weak points)

  layoutZones(): void {
    const z = (this.zones = [] as typeof this.zones);
    const wl = this.waterY + 2;
    const add = (id: string, lx0: number, lx1: number, ly0: number, ly1: number, mul: number) => {
      const xa = this.lx2w(lx0);
      const xb = this.lx2w(lx1);
      const y0 = this.y + ly0;
      const y1 = Math.min(this.y + ly1, wl);
      if (y1 - y0 < 3) return;
      z.push({ id, x: Math.min(xa, xb), y: y0, w: Math.abs(xb - xa), h: y1 - y0, mul });
    };
    const dive = this.phase >= 2;
    add('tower', -19, 19, A.DECK_Y + A.TOWER_TOP + 2, A.DECK_Y, dive ? 1.6 : 1.25);
    if (!dive) {
      for (const p of this.pods) if (p.alive) add(p.id, p.lx - 12, p.lx + 12, A.DECK_Y - 17, A.DECK_Y - 1, 1.25);
      add('hull', -150, 44, A.DECK_Y, 2, 0.35);
      add('hull', 44, 100, -34, -13, 0.35);
      if (this.jaw > 0.55) add('mouth', 62, 96, -13, 2, 1.5);
      else add('hull', 60, 100, -13, 2, 0.35);
    }
    if (this.arm.out > 0.6 && this.state === 'claw' && ['rest', 'clench', 'rake', 'slam', 'track', 'lock'].includes(this.step)) {
      const r = this.arm.clawRect();
      z.push({ id: 'claw', x: r.x, y: r.y, w: r.w, h: r.h, mul: dive ? 0 : 0.7 });
    }
  }

  override applyHit(d: Damage, mul: number, id: string): boolean {
    const ok = super.applyHit(d, mul, id);
    if (ok && (id === 'podF' || id === 'podA')) {
      const pod = this.pods.find((p) => p.id === id)!;
      if (pod.alive) {
        pod.hp -= d.amount;
        if (pod.hp <= 0) this.destroyPod(pod, d);
      }
    }
    return ok;
  }

  // ------------------------------------------------------------------ phases

  onPhase(phase: number): void {
    this.phasesSeen.add(phase);
    if (this.dying) return;
    this.cancelAttack();
    if (phase >= 2) {
      this.setState('dive');
      this.step = '';
    } else {
      this.setState('emerge');
      this.step = '';
    }
  }

  private cancelAttack(): void {
    this.beam?.stop();
    this.shadow?.remove();
    this.shadow = null;
    this.shots = 0;
    this.jawTarget = 0;
    this.scopeTarget = 0;
    for (const p of this.pods) p.target = 0;
    if (this.arm.out > 0) this.arm.frame = 0;
  }

  private toIdle(): void {
    this.setState('idle');
    this.step = '';
    const base = [1.25, 1.0, 0.8][Math.min(2, this.phase)];
    this.nextGap = base * this.world.difficulty.enemyFireDelay * this.world.rng.range(0.9, 1.1);
  }

  private pickAttack(): void {
    const ph = Math.min(2, this.phase);
    const seqs = [
      ['torpedo', 'missiles', 'laser'],
      ['claw', 'torpedo', 'missiles', 'claw', 'laser'],
      ['laser', 'claw', 'torpedo', 'claw'],
    ];
    const seq = seqs[ph];
    let pick = seq[this.cycle % seq.length];
    // A little variety: sometimes swap with the next one in the rotation.
    if (this.world.rng.chance(0.25)) pick = seq[(this.cycle + 1) % seq.length];
    this.cycle++;
    const podsUp = this.pods.some((p) => p.alive) && ph < 2;
    if (pick === 'missiles' && !podsUp) pick = ph === 0 ? 'laser' : 'claw';
    if (pick === this.lastAttack) pick = seq[this.cycle % seq.length];
    if (pick === 'missiles' && !podsUp) pick = 'torpedo';
    if (pick === 'claw' && ph < 1) pick = 'torpedo';
    this.lastAttack = pick;
    this.attacks[pick] = (this.attacks[pick] ?? 0) + 1;
    if (pick === 'torpedo') this.startTorpedo();
    else if (pick === 'missiles') this.startMissiles();
    else if (pick === 'laser') this.startLaser();
    else this.startClaw();
  }

  // ------------------------------------------------------------------ think

  think(dt: number): void {
    this.t += dt;
    if (this.eyeFlash > 0) this.eyeFlash -= dt;
    this.updateBody(dt);
    switch (this.state) {
      case 'intro':
        this.doIntro(dt);
        break;
      case 'idle':
        this.idleArm(dt);
        if (this.stateTime >= this.nextGap) this.pickAttack();
        break;
      case 'torpedo':
        this.idleArm(dt);
        this.doTorpedo(dt);
        break;
      case 'missiles':
        this.idleArm(dt);
        this.doMissiles(dt);
        break;
      case 'laser':
        this.idleArm(dt);
        this.doLaser(dt);
        break;
      case 'claw':
        this.doClaw(dt);
        break;
      case 'emerge':
        this.doEmerge(dt);
        break;
      case 'dive':
        this.doDive(dt);
        break;
    }
    this.updateParts(dt);
    this.updateFx(dt);
    this.checkDamageLevel();
  }

  private updateBody(dt: number): void {
    const adv = this.phase >= 2 ? 10 : this.phase >= 1 ? 18 : 0;
    this.advance = approach(this.advance, adv, 10 * dt);
    const drift = Math.sin(this.t * 0.55) * 3;
    this.x = this.homeX + this.facing * (this.advance + drift);
    if (this.state !== 'intro') {
      const want = this.phase >= 2 && this.state !== 'dive' ? DIVE_SINK : this.sinkTarget;
      this.sink = approach(this.sink, want, 26 * dt);
    }
    const bob = this.state === 'intro' ? 0 : Math.sin(this.t * 2.2) * 1.2;
    this.y = this.waterY + FLOAT + this.sink + bob;
  }

  private updateParts(dt: number): void {
    this.jaw = approach(this.jaw, this.jawTarget, dt * 2.6);
    this.scopeExt = approach(this.scopeExt, this.scopeTarget, dt * 3);
    for (const p of this.pods) p.open = approach(p.open, p.alive ? p.target : 0, dt * 2.6);
    this.arm.out = approach(this.arm.out, this.armTarget, dt * (this.armTarget > this.arm.out ? 1.6 : 2.2));
    const pv = this.pivot();
    this.arm.px = pv.x;
    this.arm.py = pv.y;
    this.arm.solve();
  }

  private idleArm(dt: number): void {
    if (this.arm.out <= 0) return;
    const r = this.restPose();
    const k = Math.min(1, dt * 4);
    this.arm.wx += (r.x - this.arm.wx) * k;
    this.arm.wy += (r.y - this.arm.wy) * k;
    if (this.state === 'idle') this.arm.frame = Math.sin(this.t * 1.3) > 0.7 ? 1 : 0;
  }

  // ------------------------------------------------------------------ intro

  private doIntro(dt: number): void {
    const t = this.stateTime;
    const T0 = 0.25;
    const T1 = 2.3;
    const s = clamp((t - T0) / (T1 - T0), 0, 1);
    const rise = 1 - Math.pow(1 - s, 2.4);
    let sink = INTRO_DEPTH * (1 - rise);
    if (t > T1) sink += -2.5 * Math.sin((t - T1) * 7) * Math.exp(-(t - T1) * 3);
    this.sink = sink;
    this.y = this.waterY + FLOAT + sink;
    // Boiling water and a deep rumble.
    this.sndT -= dt;
    if (this.sndT <= 0 && t < 1.9) {
      this.sndT = 0.38;
      m4sfx(this.world, 'engine', this.x, { vol: 0.7, pitch: 0.45 });
    }
    if (t < T1) {
      for (let i = 0; i < 3; i++) {
        const x = this.lx2w(fxRng.range(-120, 100));
        this.world.particles.add({ kind: 'px', x, y: this.waterY + fxRng.range(2, 14), vx: fxRng.range(-6, 6), vy: -fxRng.range(30, 60), life: 0.35, color: fxRng.chance(0.6) ? '#e8f8ff' : '#9ad6ff', size: fxRng.pick([1, 2]) });
      }
      if (fxRng.chance(0.25)) puffFoam(this.world, this.lx2w(fxRng.range(-100, 90)), this.waterY - 1, 2, 70, 30);
    }
    // Milestones as parts break the surface.
    const flag = (bit: number) => {
      if (this.introFlags & bit) return false;
      this.introFlags |= bit;
      return true;
    };
    if (sink + FLOAT < 101 && flag(1)) {
      this.world.particles.splash(this.lx2w(A.SCOPE_X), this.waterY, 8, '#d8f0ff');
      m4sfx(this.world, 'splash', this.x, { vol: 0.5, pitch: 1.3 });
    }
    if (sink + FLOAT < 86 && flag(2)) {
      for (let lx = -20; lx <= 20; lx += 6) this.world.particles.splash(this.lx2w(lx), this.waterY, 6, '#d8f0ff');
      m4sfx(this.world, 'splash', this.x, { vol: 0.8 });
    }
    if (sink + FLOAT < 22 && flag(4)) {
      for (let lx = -150; lx <= 100; lx += 8) {
        this.world.particles.splash(this.lx2w(lx), this.waterY, 7, '#e8f8ff');
        if (fxRng.chance(0.4)) puffFoam(this.world, this.lx2w(lx), this.waterY - 2, 4, 170, 40);
      }
      this.world.shake(5, 0.7);
      m4sfx(this.world, 'boss_roar', this.x, { vol: 1 });
      m4sfx(this.world, 'splash', this.x, { vol: 1, pitch: 0.6 });
      this.waterfallT = 1.4;
    }
    if (t >= 2.7) {
      this.finishIntro();
      this.eyeFlash = 0.5;
      m4sfx(this.world, 'boss_charge', this.x, { vol: 0.5, pitch: 1.3 });
      this.toIdle();
      this.nextGap = 0.7;
    }
  }

  // ------------------------------------------------------------------ torpedoes

  private startTorpedo(): void {
    this.setState('torpedo');
    this.shots = this.phase >= 1 ? 3 : 2;
    this.launchT = this.submerged ? 0.5 : 0.6;
    this.jawTarget = this.submerged ? 0 : 1;
    if (!this.submerged) {
      m4sfx(this.world, 'metal_hit', this.lx2w(A.JAW_HX), { vol: 0.7, pitch: 0.5 });
      puffSteam(this.world, this.lx2w(A.JAW_HX), this.y + A.JAW_HY, this.facing * 20, -20, 4, 3);
    } else m4sfx(this.world, 'engine', this.x, { vol: 0.6, pitch: 0.7 });
  }

  private doTorpedo(dt: number): void {
    if (this.shots > 0) {
      this.launchT -= dt;
      if (this.launchT <= 0) {
        this.fireTorpedo();
        this.shots--;
        this.launchT = [0.95, 0.85, 0.8][Math.min(2, this.phase)] * this.world.difficulty.enemyFireDelay;
        if (this.shots === 0) this.stepT = 0;
      }
      return;
    }
    this.stepT += dt;
    if (this.stepT > 0.45) this.jawTarget = 0;
    if (this.stepT > 0.9) this.toIdle();
  }

  private fireTorpedo(): void {
    const speed = 125 * this.world.difficulty.enemyShotSpeed * (this.phase >= 2 ? 1.1 : 1);
    if (this.submerged) {
      const x = this.lx2w(A.BOW_X - 6);
      this.world.add(new Torpedo(this, x, this.waterY + 15, this.facing, speed, this.waterY, true));
      for (let i = 0; i < 6; i++) this.world.particles.add({ kind: 'px', x: x + fxRng.range(-4, 4), y: this.waterY + 12, vx: fxRng.range(-8, 8), vy: -fxRng.range(30, 70), life: 0.4, color: '#e8f8ff', size: 1 });
      m4sfx(this.world, 'enemy_rocket', x, { vol: 0.5, pitch: 0.5 });
      return;
    }
    const x = this.lx2w(A.TUBE_X + 8);
    const y = this.y + A.TUBE_Y;
    this.world.add(new Torpedo(this, x, y, this.facing, speed, this.waterY));
    this.world.effect('muzzle_flash', this.lx2w(A.TUBE_X + 4), y, { flip: this.facing < 0, fps: 30 });
    puffSteam(this.world, x, y, this.facing * 40, -10, 4, 3);
    m4sfx(this.world, 'enemy_rocket', x, { vol: 0.8, pitch: 0.6 });
    this.eyeFlash = 0.15;
  }

  // ------------------------------------------------------------------ missile salvo

  private startMissiles(): void {
    this.setState('missiles');
    const alive = this.pods.filter((p) => p.alive).length;
    this.shots = alive * (this.phase >= 1 ? 3 : 2);
    this.launchT = 0.6;
    this.podIdx = 0;
    for (const p of this.pods) if (p.alive) p.target = 1;
    m4sfx(this.world, 'metal_hit', this.x, { vol: 0.6, pitch: 0.7 });
    m4sfx(this.world, 'enemy_alert', this.x, { vol: 0.6 });
  }

  private doMissiles(dt: number): void {
    if (this.shots > 0) {
      this.launchT -= dt;
      if (this.launchT <= 0) {
        const alive = this.pods.filter((p) => p.alive);
        if (!alive.length) this.shots = 0;
        else {
          this.fireMissile(alive[this.podIdx % alive.length]);
          this.podIdx++;
          this.shots--;
          this.launchT = 0.24 * this.world.difficulty.enemyFireDelay;
        }
        if (this.shots === 0) this.stepT = 0;
      }
      return;
    }
    this.stepT += dt;
    if (this.stepT > 0.5) for (const p of this.pods) p.target = 0;
    if (this.stepT > 1.0) this.toIdle();
  }

  private fireMissile(pod: Pod): void {
    const rng = this.world.rng;
    const side = this.podIdx % 2 ? 1 : -1;
    const x = this.lx2w(pod.lx + side * 4);
    const y = this.y + A.DECK_Y - 22;
    const lo = Math.min(this.pierFar + this.facing * -10, this.pierTip - this.facing * 8);
    const hi = Math.max(this.pierFar + this.facing * -10, this.pierTip - this.facing * 8);
    const tx = clamp(this.targetX() + rng.range(-14, 14), lo, hi);
    const ty = this.surfaceAt(tx);
    const sp = this.world.difficulty.enemyShotSpeed;
    const m = this.world.add(
      new LockMissile({
        owner: this,
        x,
        y,
        vx: this.facing * rng.range(20, 50),
        vy: -rng.range(185, 215),
        tx,
        ty,
        sprite: 'bm4_missile',
        drop: 0.42,
        speed: 50,
        topSpeed: 200 * sp,
        accel: 300,
        turn: 4.2,
        steer: 0.65,
        radius: 14,
      }),
    );
    const mk = this.world.add(new LandingMarker(tx, ty, 1.45, 14));
    mk.watch = m;
    smoke(this.world, x, y, { n: 3, color: '#d8d0c8', color2: '#8a8480', vy: -10 });
    m4sfx(this.world, 'enemy_rocket', x, { vol: 0.6 });
  }

  // ------------------------------------------------------------------ periscope laser

  private startLaser(): void {
    this.setState('laser');
    this.step = 'raise';
    this.stepT = 0;
    this.sweeps = this.phase >= 2 ? 2 : 1;
    this.scopeTarget = 1;
    m4sfx(this.world, 'engine', this.x, { vol: 0.5, pitch: 1.7 });
  }

  private beginAim(): void {
    this.sweepX0 = this.lx2w(A.BOW_X) + this.facing * 14;
    this.sweepEnd = this.facing < 0 ? this.arenaL + SWEEP_END_MARGIN : this.arenaR - SWEEP_END_MARGIN;
    const path: number[] = [];
    const n = Math.max(2, Math.ceil(Math.abs(this.sweepEnd - this.sweepX0) / 6));
    for (let i = 0; i <= n; i++) {
      const x = lerp(this.sweepX0, this.sweepEnd, i / n);
      path.push(x, this.surfaceAt(x) - 1);
    }
    this.beam.path = path;
    this.beam.sweepDir = this.facing;
    this.beam.mode = 'aim';
    this.beam.charge = 0;
    m4sfx(this.world, 'boss_charge', this.x, { vol: 0.8 });
  }

  private doLaser(dt: number): void {
    this.stepT += dt;
    const E = this.lensPos();
    const aimTime = [0.95, 0.88, 0.8][Math.min(2, this.phase)];
    switch (this.step) {
      case 'raise':
        if (this.stepT >= 0.35) {
          this.step = 'aim';
          this.stepT = 0;
          this.beginAim();
        }
        break;
      case 'aim': {
        this.beam.ex = E.x;
        this.beam.ey = E.y;
        this.beam.ix = this.sweepX0;
        this.beam.iy = this.surfaceAt(this.sweepX0);
        this.beam.charge = clamp(this.stepT / aimTime, 0, 1);
        if (this.stepT >= aimTime) {
          this.step = 'fire';
          this.stepT = 0;
          this.sweepX = this.sweepX0;
          this.beam.fire();
          this.beamCd.clear();
          m4sfx(this.world, 'boss_laser', this.x, { vol: 1 });
        }
        break;
      }
      case 'fire': {
        const v = (this.phase >= 2 ? 440 : 400) * (0.9 + 0.1 * this.world.difficulty.enemyShotSpeed);
        const prev = this.sweepX;
        this.sweepX += this.facing * v * dt;
        const done = (this.sweepX - this.sweepEnd) * this.facing >= 0;
        if (done) this.sweepX = this.sweepEnd;
        const iy = this.surfaceAt(this.sweepX);
        this.beam.ex = E.x;
        this.beam.ey = E.y;
        this.beam.ix = this.sweepX;
        this.beam.iy = iy;
        this.beamHurt(E.x, E.y, prev, this.sweepX);
        this.impactFx(this.sweepX, iy);
        if (done) {
          this.beam.stop();
          this.sweeps--;
          this.step = this.sweeps > 0 ? 'gap' : 'lower';
          this.stepT = 0;
        }
        break;
      }
      case 'gap':
        if (this.stepT >= 0.45) {
          this.step = 'aim';
          this.stepT = 0;
          this.beginAim();
        }
        break;
      case 'lower':
        this.scopeTarget = 0;
        if (this.stepT >= 0.45) this.toIdle();
        break;
    }
  }

  /** Damage along the beam for every impact point between x0 and x1 (sub-stepped: no tunnelling). */
  private beamHurt(ex: number, ey: number, x0: number, x1: number): void {
    const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / 3));
    for (let i = 1; i <= n; i++) {
      const x = lerp(x0, x1, i / n);
      this.hurtSegment(ex, ey, x, this.surfaceAt(x), 1.5, 'laser', 12);
    }
  }

  /** Segment damage with a per-target cooldown (one hit per sweep pass). */
  private hurtSegment(x0: number, y0: number, x1: number, y1: number, half: number, kind: DamageKind, vehicle: number): void {
    for (const t of this.world.targets('enemy')) {
      if (t.dead || !t.hittable) continue;
      if ((this.beamCd.get(t.id) ?? -1) > this.age) continue;
      for (const hb of t.hurtboxes()) {
        const r = { x: hb.x - half, y: hb.y - half, w: hb.w + half * 2, h: hb.h + half * 2 };
        if (segmentRect(x0, y0, x1, y1, r) >= 0) {
          this.beamCd.set(t.id, this.age + 0.6);
          const isPlayer = !!(t as { isPlayer?: boolean }).isPlayer;
          t.damage({ amount: isPlayer ? 1 : vehicle, kind, owner: this, x: t.cx, y: t.cy, dir: Math.sign(t.cx - x0) || -1 });
          break;
        }
      }
    }
  }

  private impactFx(x: number, y: number): void {
    const overWater = !!this.world.terrain.waterAt(x, this.waterY + 1) && y >= this.waterY - 0.5;
    if (overWater) {
      if (fxRng.chance(0.7)) puffSteam(this.world, x, y - 1, 0, -40, 1, 3);
      if (fxRng.chance(0.5)) puffFoam(this.world, x, y, 2, 100, 30);
    } else {
      sparkBurst(this.world, x, y - 1, 2, fxRng.chance(0.5) ? '#ffd0d0' : '#ff7050', 90);
      if (fxRng.chance(0.35)) flames(this.world, x, y - 1, { n: 1, size: 2, life: 0.35 });
      if (fxRng.chance(0.25)) smoke(this.world, x, y - 3, { n: 1, size: 1.5, size2: 5, life: 0.7 });
    }
  }

  // ------------------------------------------------------------------ claw

  private startClaw(): void {
    this.setState('claw');
    this.step = this.arm.out < 0.95 ? 'rise' : 'reach';
    this.stepT = 0;
    this.armTarget = 1;
    if (this.step === 'rise') {
      const p = this.pivot();
      this.arm.wx = p.x + this.facing * 20;
      this.arm.wy = p.y - 20;
      if (this.submerged) {
        for (let i = 0; i < 4; i++) this.world.particles.splash(p.x + fxRng.range(-10, 10), this.waterY, 6, '#e8f8ff');
        m4sfx(this.world, 'splash', p.x, { vol: 0.7 });
      }
    }
    m4sfx(this.world, 'engine', this.x, { vol: 0.6, pitch: 0.75 });
  }

  private hoverY(): number {
    return this.deckY - A.CLAW_H - (this.phase >= 2 ? 32 : 40);
  }

  /** Allowed claw x range (within reach, over the dock). */
  private clawRange(y: number): [number, number] {
    const p = this.pivot();
    const reach = this.arm.reachAt(y);
    const far = p.x + this.facing * reach;
    const near = this.pierTip - this.facing * 16;
    let lo = Math.min(far, near);
    let hi = Math.max(far, near);
    lo = Math.max(lo, this.arenaL + 14);
    hi = Math.min(hi, this.arenaR - 14);
    return [lo, Math.max(lo, hi)];
  }

  private doClaw(dt: number): void {
    this.stepT += dt;
    const arm = this.arm;
    const st = this.stepT;
    const slamY = this.deckY - A.CLAW_H + 1;
    switch (this.step as ClawStep) {
      case 'rise': {
        const r = this.restPose();
        arm.wx += (r.x - arm.wx) * Math.min(1, dt * 5);
        arm.wy += (r.y - arm.wy) * Math.min(1, dt * 5);
        if (st >= 0.55 && arm.out > 0.95) this.next('reach');
        break;
      }
      case 'reach': {
        if (st < dt * 1.5) {
          const [lo, hi] = this.clawRange(this.hoverY());
          this.clawX = clamp(this.targetX(), lo, hi);
          this.clawFrom = { x: arm.wx, y: arm.wy };
          this.shadow?.remove();
          this.shadow = this.world.add(new ShadowMarker(this.clawX, this.deckY, 0.55 + 0.5 + 0.32 + 0.12, 'shadow', 20));
          arm.frame = 0;
        }
        const k = easeInOutSine(clamp(st / 0.55, 0, 1));
        arm.wx = lerp(this.clawFrom.x, this.clawX, k);
        arm.wy = lerp(this.clawFrom.y, this.hoverY(), k) - Math.sin(k * Math.PI) * 18;
        if (st >= 0.55) this.next('track');
        break;
      }
      case 'track': {
        const [lo, hi] = this.clawRange(this.hoverY());
        this.clawX = clamp(approach(this.clawX, this.targetX(), 70 * dt), lo, hi);
        arm.wx = this.clawX;
        arm.wy = this.hoverY() + Math.sin(this.t * 9) * 1.5;
        if (this.shadow) this.shadow.x = this.clawX;
        if (st >= 0.5) {
          this.next('lock');
          arm.frame = 3;
          m4sfx(this.world, 'metal_hit', this.clawX, { vol: 0.7, pitch: 1.5 });
          sparkBurst(this.world, this.clawX, this.hoverY() + A.CLAW_H - 4, 4, '#ffffff', 60);
        }
        break;
      }
      case 'lock': {
        arm.wx = this.clawX + (Math.floor(st * 30) % 2 ? 1 : -1) * 0.6;
        arm.wy = this.hoverY() - st * 10;
        if (st >= 0.32) this.next('slam');
        break;
      }
      case 'slam': {
        const k = easeInQuad(clamp(st / 0.12, 0, 1));
        const y0 = this.hoverY() - 3.2;
        arm.wx = this.clawX;
        arm.wy = lerp(y0, slamY, k);
        arm.frame = 0;
        this.hurtPlayers(arm.clawRect(), 'crush', 25);
        if (st >= 0.12) {
          arm.wy = slamY;
          this.next('rest');
          this.slamImpact();
        }
        break;
      }
      case 'rest':
        arm.wx = this.clawX;
        arm.wy = slamY;
        if (st >= 0.85) {
          this.next('clench');
          m4sfx(this.world, 'tank_tread', this.clawX, { vol: 0.7, pitch: 0.6 });
        }
        break;
      case 'clench':
        arm.frame = st < 0.15 ? 1 : 2;
        arm.wx = this.clawX + (Math.floor(st * 40) % 2 ? 0.5 : -0.5);
        if (fxRng.chance(0.5)) sparkBurst(this.world, this.clawX + fxRng.range(-10, 10), this.deckY - 1, 2, '#ffe080', 80);
        if (st >= 0.35) this.next('rake');
        break;
      case 'rake': {
        const dir = -this.facing;
        const stop = this.pierTip - this.facing * 12;
        this.clawX += dir * 130 * dt;
        const done = (this.clawX - stop) * dir >= 0;
        if (done) this.clawX = stop;
        arm.wx = this.clawX;
        arm.wy = slamY;
        arm.frame = 2;
        this.hurtPlayers(arm.clawRect(true), 'crush', 20);
        if (fxRng.chance(0.8)) this.world.particles.add({ kind: 'spark', x: this.clawX - dir * 6, y: this.deckY - 1, vx: -dir * fxRng.range(40, 140), vy: -fxRng.range(20, 100), life: 0.3, color: fxRng.chance(0.5) ? '#ffe080' : '#ffffff', gravity: 300 });
        if (fxRng.chance(0.25)) this.world.particles.debris(this.clawX, this.deckY - 1, 1, ['#8a6a48', '#5a4430'], 90);
        this.sndT -= dt;
        if (this.sndT <= 0) {
          this.sndT = 0.3;
          m4sfx(this.world, 'tank_tread', this.clawX, { vol: 0.7, pitch: 0.7 });
        }
        if (done || st > 3) this.next('lift');
        break;
      }
      case 'lift': {
        const k = clamp(st / 0.4, 0, 1);
        arm.wx = this.clawX + this.facing * -18 * k;
        arm.wy = slamY - 40 * easeInOutSine(k);
        arm.frame = 1;
        if (st >= 0.4) {
          this.next('return');
          this.clawFrom = { x: arm.wx, y: arm.wy };
          if (this.phase >= 2) this.armTarget = 0;
        }
        break;
      }
      case 'return': {
        const r = this.restPose();
        const k = easeInOutSine(clamp(st / 0.5, 0, 1));
        arm.wx = lerp(this.clawFrom.x, r.x, k);
        arm.wy = lerp(this.clawFrom.y, r.y, k);
        arm.frame = 0;
        if (st >= 0.5) this.toIdle();
        break;
      }
    }
  }

  private next(step: ClawStep): void {
    this.step = step;
    this.stepT = 0;
  }

  private slamImpact(): void {
    const x = this.clawX;
    const y = this.deckY;
    this.shadow?.remove();
    this.shadow = null;
    this.hurtPlayers({ x: x - 18, y: y - A.CLAW_H, w: 36, h: A.CLAW_H }, 'crush', 25);
    this.world.shake(6, 0.35);
    this.world.hitstop(0.03);
    this.world.particles.dust(x - 10, y, 6, '#b8a888');
    this.world.particles.dust(x + 10, y, 6, '#b8a888');
    this.world.particles.debris(x, y - 2, 10, ['#8a6a48', '#5a4430', '#a8885a'], 170);
    sparkBurst(this.world, x, y - 2, 8, '#ffe080', 150);
    m4sfx(this.world, 'tank_cannon', x, { vol: 0.9, pitch: 0.6 });
    m4sfx(this.world, 'crate_break', x, { vol: 0.8, pitch: 0.7 });
  }

  // ------------------------------------------------------------------ phase transitions

  private doEmerge(dt: number): void {
    const st = this.stateTime;
    const at = (t: number) => st >= t && st - dt < t;
    if (at(0) || st < dt * 1.5) {
      if (this.step !== 'go') {
        this.step = 'go';
        this.world.shake(4, 0.45);
        m4sfx(this.world, 'warning', this.x, { vol: 0.9 });
      }
    }
    if (at(0.35)) {
      const hx = this.lx2w(A.SHOULDER_X);
      const hy = this.y + A.SHOULDER_Y;
      this.hatchOpen = true;
      this.world.explode(hx, hy - 2, { radius: 12, damage: 0, team: 'enemy', size: 'medium', shake: 4, sfx: 'explosion' });
      this.world.add(new FlyingPart('bm4_debris', 5, hx, hy - 4, this.facing * 40, -260, { vr: 9, life: 2.4, smoke: true }));
      puffSteam(this.world, hx, hy - 4, 0, -50, 6, 4);
      const p = this.pivot();
      this.arm.wx = p.x + this.facing * 6;
      this.arm.wy = p.y - 8;
      this.armTarget = 1;
      m4sfx(this.world, 'engine', hx, { vol: 0.7, pitch: 0.6 });
    }
    if (st > 0.35) this.idleArm(dt);
    if (at(1.25)) {
      this.arm.frame = 3;
      m4sfx(this.world, 'metal_hit', this.arm.rx, { vol: 0.8, pitch: 0.8 });
    }
    if (at(1.45)) {
      this.arm.frame = 2;
      m4sfx(this.world, 'metal_hit', this.arm.rx, { vol: 0.8, pitch: 1.1 });
    }
    if (st >= 1.75) this.toIdle();
  }

  private doDive(dt: number): void {
    const st = this.stateTime;
    if (this.step !== 'go') {
      this.step = 'go';
      this.armTarget = 0;
      m4sfx(this.world, 'warning', this.x, { vol: 0.9 });
      m4sfx(this.world, 'alarm', this.x, { vol: 0.6 });
    }
    this.idleArm(dt);
    // Ballast vents blast spray along the hull.
    if (st < 1.4) {
      this.fxT -= dt;
      if (this.fxT <= 0) {
        this.fxT = 0.05;
        const lx = fxRng.range(-130, 50);
        const x = this.lx2w(lx);
        puffFoam(this.world, x, Math.min(this.waterY - 1, this.y + A.DECK_Y), 4, 200, 25);
        if (fxRng.chance(0.5)) puffSteam(this.world, x, this.y + A.DECK_Y - 2, 0, -60, 2, 4);
      }
    }
    if (st >= 0.3) this.sinkTarget = DIVE_SINK;
    this.sink = approach(this.sink, this.sinkTarget, 26 * dt);
    if (this.sink + FLOAT > 22 && !(this.introFlags & 8)) {
      this.introFlags |= 8;
      for (let lx = -150; lx <= 100; lx += 10) this.world.particles.splash(this.lx2w(lx), this.waterY, 6, '#e8f8ff');
      this.world.shake(3, 0.5);
      m4sfx(this.world, 'splash', this.x, { vol: 1, pitch: 0.7 });
    }
    if (st >= 2.2) this.toIdle();
  }

  // ------------------------------------------------------------------ damage & destruction

  private destroyPod(pod: Pod, d: Damage): void {
    pod.alive = false;
    pod.hp = 0;
    pod.target = 0;
    const x = this.lx2w(pod.lx);
    const y = this.y + A.DECK_Y - 9;
    this.world.explode(x, y, { radius: 18, damage: 0, team: 'enemy', size: 'large', shake: 5, sfx: 'explosion_big' });
    this.world.hitstop(0.05);
    for (let i = 0; i < 3; i++) {
      this.world.add(new FlyingPart('bm4_debris', i === 2 ? 3 : 0, x + fxRng.range(-6, 6), y - 4, fxRng.range(-80, 80), -fxRng.range(180, 280), { burn: i === 0, life: 2.2 }));
    }
    this.world.add(new FlyingPart('bm4_missile', 0, x, y - 6, fxRng.range(-60, 60), -240, { vr: 12, life: 2, burn: true }));
    this.world.addScore(d.owner, 2000, { x, y: y - 14 });
    this.world.invalidateTargets();
  }

  private checkDamageLevel(): void {
    const f = this.hpFrac;
    const lvl = f > 0.75 ? 0 : f > 0.5 ? 1 : f > 0.25 ? 2 : 3;
    if (lvl <= this.dmgLevel) return;
    this.dmgLevel = lvl;
    const spots: [number, number][][] = [[], [[-60, -14]], [[-70, -15], [-12, A.DECK_Y - 8]], [[-20, -14], [10, A.DECK_Y - 48]]];
    for (const [lx, ly] of spots[lvl]) {
      const x = this.lx2w(lx);
      const y = this.y + ly;
      if (y > this.waterY - 2) continue;
      this.world.explode(x, y, { radius: 14, damage: 0, team: 'enemy', size: 'medium', shake: 3, sfx: 'explosion' });
      for (let i = 0; i < 3; i++) {
        this.world.add(new FlyingPart('bm4_debris', fxRng.pick([0, 0, 1, 2, 3]), x, y, fxRng.range(-90, 90), -fxRng.range(150, 260), { burn: fxRng.chance(0.3), life: 2.2 }));
      }
      m4sfx(this.world, 'metal_hit', x, { vol: 0.8, pitch: 0.6 });
    }
  }

  // ------------------------------------------------------------------ ambient & damage fx

  private updateFx(dt: number): void {
    const w = this.world;
    // Waterfalls off the deck right after surfacing.
    if (this.waterfallT > 0) {
      this.waterfallT -= dt;
      for (let i = 0; i < 2; i++) {
        const lx = fxRng.range(-140, 60);
        w.particles.add({ kind: 'px', x: this.lx2w(lx), y: this.y + A.DECK_Y + 2, vx: fxRng.range(-6, 6), vy: fxRng.range(10, 40), life: 0.45, color: fxRng.chance(0.5) ? '#d8f0ff' : '#9ad6ff', gravity: 500, size: 1 });
      }
    }
    if (!this.introDone && this.state === 'intro') return;
    // Stern exhaust vent.
    this.ventT -= dt;
    if (this.ventT <= 0) {
      this.ventT = 1.3 + fxRng.next() * 0.6;
      const vx = this.lx2w(A.VENT_X);
      const vy = this.y + A.DECK_Y - 4;
      if (vy < this.waterY - 2) puffSteam(w, vx, vy, -this.facing * 10, -45, 3, 3);
      else for (let i = 0; i < 4; i++) w.particles.add({ kind: 'px', x: vx + fxRng.range(-3, 3), y: this.waterY + 4, vx: 0, vy: -fxRng.range(25, 50), life: 0.3, color: '#e8f8ff', size: 1 });
    }
    // Damage emitters.
    this.fxT -= dt;
    if (this.fxT > 0) return;
    this.fxT = 0.07;
    const emit = (lx: number, ly: number, fire: boolean, heavy = false) => {
      const x = this.lx2w(lx) + fxRng.range(-3, 3);
      const y = this.y + ly;
      if (y > this.waterY - 2) {
        if (fxRng.chance(0.3)) w.particles.add({ kind: 'px', x, y: this.waterY + 3, vx: fxRng.range(-4, 4), vy: -fxRng.range(20, 45), life: 0.3, color: '#e8f8ff', size: 1 });
        return;
      }
      smoke(w, x, y, { n: 1, size: heavy ? 3 : 2, size2: heavy ? 10 : 7, life: heavy ? 1.7 : 1.1, vy: -24, color: heavy ? '#2e2a2c' : '#4a4448', color2: '#221e22' });
      if (fire && fxRng.chance(0.7)) flames(w, x, y + 1, { n: 2, size: 2, life: 0.35, spread: 3 });
    };
    const L = this.dmgLevel;
    if (L >= 1) emit(-60, -15, false);
    if (L >= 1 && fxRng.chance(0.5)) emit(-10, A.DECK_Y + A.TOWER_TOP + 6, false);
    if (L >= 2) emit(-70, -16, true);
    if (L >= 2 && fxRng.chance(0.08)) {
      const x = this.lx2w(14);
      const y = this.y + A.DECK_Y - 30;
      if (y < this.waterY - 2) sparkBurst(w, x, y, 4, '#ffe080', 90);
    }
    if (L >= 3) {
      emit(-20, -16, true);
      emit(10, A.DECK_Y - 44, true, true);
      if (fxRng.chance(0.5)) emit(-130, -14, true);
    }
    for (const p of this.pods) if (!p.alive) emit(p.lx, A.DECK_Y - 6, true);
  }

  // ------------------------------------------------------------------ death

  override onDeathStart(): void {
    this.beam?.stop();
    this.shadow?.remove();
    this.shadow = null;
    this.jawTarget = 1;
    this.scopeTarget = 0;
    for (const p of this.pods) p.target = 0;
    this.armTarget = 0;
    m4sfx(this.world, 'alarm', this.x, { vol: 0.8 });
  }

  override deathSequence(dt: number): void {
    const t = this.deathTime;
    this.t += dt;
    const w = this.world;
    if (t < 1.3) {
      // Shudders in place while explosions rip through it.
    } else if (t < 2.5) {
      if (!this.breached) {
        this.breached = true;
        const cx = this.lx2w(-10);
        w.explode(cx, this.y + A.DECK_Y - 10, { radius: 30, damage: 0, team: 'enemy', size: 'huge', shake: 8, sfx: 'explosion_big' });
        w.flash('#ffffff', 0.5);
        for (let lx = -150; lx <= 100; lx += 8) {
          w.particles.splash(this.lx2w(lx), this.waterY, 8, '#e8f8ff');
          if (fxRng.chance(0.5)) puffFoam(w, this.lx2w(lx), this.waterY - 2, 5, 220, 45);
        }
        // The periscope, flag and pods' doors are torn off.
        const top = this.y + A.DECK_Y + A.TOWER_TOP;
        w.add(new FlyingPart('bm4_scope', 3, this.lx2w(A.SCOPE_X), top - 6, -this.facing * 70, -300, { vr: 10, life: 3, burn: true }));
        w.add(new FlyingPart('bm4_flag', 3, this.lx2w(A.FLAG_X), top - 14, -this.facing * 40, -220, { vr: 6, life: 3, burn: true }));
        for (let i = 0; i < 4; i++) w.add(new FlyingPart('bm4_debris', fxRng.pick([0, 1, 2, 3, 4]), this.lx2w(fxRng.range(-100, 80)), this.y + A.DECK_Y, fxRng.range(-120, 120), -fxRng.range(200, 320), { burn: true, life: 2.6 }));
        m4sfx(w, 'boss_roar', this.x, { vol: 1, pitch: 0.7 });
        m4sfx(w, 'splash', this.x, { vol: 1, pitch: 0.5 });
      }
      this.sink = approach(this.sink, -12, 140 * dt);
    } else {
      // Going down: accelerating, steam and bubbles where the fire meets the water.
      this.sink += (14 + (t - 2.5) * 46) * dt;
      if (fxRng.chance(0.6)) puffSteam(w, this.lx2w(fxRng.range(-120, 90)), this.waterY - 2, 0, -50, 1, 4);
      for (let i = 0; i < 2; i++) w.particles.add({ kind: 'px', x: this.lx2w(fxRng.range(-140, 100)), y: this.waterY + fxRng.range(1, 10), vx: fxRng.range(-6, 6), vy: -fxRng.range(30, 70), life: 0.35, color: '#e8f8ff', size: fxRng.pick([1, 2]) });
      this.sndT -= dt;
      if (this.sndT <= 0) {
        this.sndT = 0.5;
        m4sfx(w, 'splash', this.x, { vol: 0.6, pitch: 0.5 + fxRng.next() * 0.3 });
      }
    }
    const shudder = t < 2.5 ? Math.round((fxRng.next() - 0.5) * 3) : 0;
    this.x = this.homeX + this.facing * this.advance + shudder;
    this.y = this.waterY + FLOAT + this.sink;
    // Fires all over while above water.
    if (fxRng.chance(0.5)) {
      const lx = fxRng.range(-120, 90);
      const y = this.y + A.DECK_Y - fxRng.range(0, 30);
      if (y < this.waterY - 2) flames(w, this.lx2w(lx), y, { n: 2, size: 2.5, life: 0.4, spread: 5 });
    }
    // The claw arm goes limp and slides into the water.
    this.arm.out = approach(this.arm.out, 0, dt * 0.6);
    this.arm.wy += 60 * dt;
    const pv = this.pivot();
    this.arm.px = pv.x;
    this.arm.py = pv.y;
    this.arm.solve();
    this.jaw = approach(this.jaw, 1, dt * 2);
    this.layoutZones();
    super.deathSequence(dt);
  }

  override deathArea(): Rect {
    const xa = clamp(this.lx2w(-110), this.arenaL + 8, this.arenaR - 8);
    const xb = clamp(this.lx2w(A.BOW_X), this.arenaL + 8, this.arenaR - 8);
    const top = Math.min(this.y + A.DECK_Y + A.TOWER_TOP, this.waterY - 14);
    const bottom = Math.min(this.y + 2, this.waterY + 2);
    return { x: Math.min(xa, xb), y: top, w: Math.max(20, Math.abs(xb - xa)), h: Math.max(14, bottom - top) };
  }

  override onDestroyed(): void {
    const w = this.world;
    const x = this.lx2w(0);
    for (let i = 0; i < 40; i++) {
      w.particles.add({ kind: 'px', x: x + fxRng.range(-24, 24), y: this.waterY - 1, vx: fxRng.range(-60, 60), vy: -fxRng.range(120, 330), life: fxRng.range(0.6, 1.2), color: fxRng.pick(['#ffffff', '#e8f8ff', '#9ad6ff']), gravity: 420, size: fxRng.pick([1, 2, 2]), front: true });
    }
    puffSteam(w, x, this.waterY - 4, 0, -60, 10, 6);
    m4sfx(w, 'splash', x, { vol: 1, pitch: 0.4 });
    this.beam?.remove();
  }

  // ------------------------------------------------------------------ render

  override render(g: CanvasRenderingContext2D): void {
    const X = this.x;
    const Y = this.y;
    const flip = this.facing < 0;
    const deep = this.sink > 26;
    const alpha = deep && !this.dying ? clamp(1.25 - (this.sink - 26) / 70, 0.22, 1) : this.dying ? clamp(1.3 - (this.sink - 26) / 80, 0.15, 1) : 1;
    const blinkOn = this.world.frame % 2 === 0;
    const fl = (id: string) => this.flashing(id) && blinkOn;
    const dmg = this.dmgLevel;
    // Underwater shadow while deep.
    if (deep) pixelEllipse(g, this.lx2w(-20), this.waterY + 12, 120, 6, '#0a1420', 0.3 * (1 - alpha));
    const hull = sprites.get('bm4_hull');
    hull.draw(g, X, Y, dmg, { flip, alpha });
    if (fl('hull')) hull.draw(g, X, Y, dmg, { flip, flash: true, alpha: 0.35 });
    // Mouth glow (torpedo tubes) behind the jaw.
    if (this.jaw > 0.3) sprites.get('bm4_tube').draw(g, this.lx2w(A.TUBE_X - 1), Y + A.TUBE_Y - 1, Math.floor(this.t * 12) % 2, { alpha: alpha * clamp(this.jaw * 1.5 - 0.3, 0, 1) });
    if (this.jaw > 0.3) sprites.get('bm4_tube').draw(g, this.lx2w(A.TUBE_X - 1), Y + A.TUBE_Y + 5, Math.floor(this.t * 12 + 1) % 2, { alpha: alpha * clamp(this.jaw * 1.5 - 0.3, 0, 1) });
    // Pods.
    const pod = sprites.get('bm4_pod');
    for (const p of this.pods) {
      let frame = 0;
      if (!p.alive) frame = 4;
      else if (p.open > 0.8) frame = 3;
      else if (p.open > 0.25) frame = 2;
      else if (p.target > 0 || (this.dmgLevel >= 2 && Math.floor(this.t * 3) % 2 === 0)) frame = 1;
      const px = this.lx2w(p.lx);
      pod.draw(g, px, Y + A.DECK_Y, frame, { flip, alpha });
      if (fl(p.id)) pod.draw(g, px, Y + A.DECK_Y, frame, { flip, flash: true, alpha: 0.5 });
    }
    // Conning tower + fittings.
    const ty = Y + A.DECK_Y;
    const tower = sprites.get('bm4_tower');
    tower.draw(g, X, ty, dmg, { flip, alpha });
    if (fl('tower')) tower.draw(g, X, ty, dmg, { flip, flash: true, alpha: 0.45 });
    if (!this.dying || this.deathTime < 1.3) {
      // Radar bar.
      const rx = Math.round(this.lx2w(A.RADAR_X));
      const ry = Math.round(ty + A.RADAR_Y);
      const half = Math.round(Math.abs(Math.cos(this.t * 4)) * 5);
      g.globalAlpha = alpha;
      g.fillStyle = '#140c1c';
      g.fillRect(rx - half - 1, ry - 1, half * 2 + 3, 3);
      g.fillStyle = Math.cos(this.t * 4) > 0 ? '#aeb2be' : '#7c808e';
      g.fillRect(rx - half, ry, half * 2 + 1, 1);
      g.globalAlpha = 1;
      sprites.get('bm4_flag').draw(g, this.lx2w(A.FLAG_X), ty + A.FLAG_Y + 2, dmg >= 3 ? 3 : Math.floor(this.t * 7) % 3, { flip, alpha });
      // Periscope mast + head.
      const ext = this.scopeExt * 18;
      const mx = Math.round(this.lx2w(A.SCOPE_X));
      const base = Math.round(ty + A.TOWER_TOP - 4);
      const head = base - Math.round(ext);
      if (ext >= 1) {
        g.globalAlpha = alpha;
        g.fillStyle = '#140c1c';
        g.fillRect(mx - 2, head - 1, 5, base - head + 1);
        g.fillStyle = '#4c4e5a';
        g.fillRect(mx - 1, head, 3, base - head);
        g.fillStyle = '#aeb2be';
        g.fillRect(mx - 1, head, 1, base - head);
        g.globalAlpha = 1;
      }
      let sf = 0;
      if (this.state === 'laser') sf = this.step === 'fire' ? 3 : this.step === 'aim' ? (this.beam.charge > 0.6 ? 2 : 1) : 1;
      else if (this.introDone) sf = 1;
      sprites.get('bm4_scope').draw(g, mx, head, sf, { flip, alpha });
    }
    // Claw hatch / shoulder mount on the head.
    const hx = this.lx2w(A.SHOULDER_X);
    const hy = Y + A.SHOULDER_Y + 1;
    sprites.get('bm4_hatch').draw(g, hx, hy, this.hatchOpen ? 1 : 0, { flip, alpha });
    // Jaw + eye.
    const jf = Math.min(3, Math.round(this.jaw * 3));
    sprites.get('bm4_jaw').draw(g, this.lx2w(A.JAW_HX), Y + A.JAW_HY, jf, { flip, alpha });
    if (fl('mouth') || fl('hull')) sprites.get('bm4_jaw').draw(g, this.lx2w(A.JAW_HX), Y + A.JAW_HY, jf, { flip, flash: true, alpha: 0.4 });
    let ef = 0;
    if (!this.introDone) ef = this.state === 'intro' && this.stateTime > 2.2 ? 1 : 2;
    else if (this.dying) ef = Math.floor(this.t * 14) % 3 === 0 ? 2 : 0;
    else if (this.eyeFlash > 0) ef = 3;
    else if (this.jaw > 0.3 || this.step === 'aim' || this.step === 'lock' || this.state === 'emerge' || this.state === 'dive') ef = 1;
    else if (this.dmgLevel >= 3 && Math.floor(this.t * 9) % 7 === 0) ef = 2;
    sprites.get('bm4_eye').draw(g, this.lx2w(A.EYE_X), Y + A.EYE_Y, ef, { flip, alpha });
    // Waterline foam where the hull or tower meets the surface.
    this.renderFoam(g);
    // Claw arm (in front of the hull).
    if (this.arm.out > 0.02) {
      if (this.hatchOpen && !this.submerged) sprites.get('bm4_shoulder').draw(g, hx, hy, 0, { flip });
      this.arm.render(g, fl('claw'), this.state === 'claw' && (this.step === 'rake' || this.step === 'rest') ? 1 : 0.6);
    }
  }

  private renderFoam(g: CanvasRenderingContext2D): void {
    const wy = Math.round(this.waterY) - 1;
    const top = this.y + A.DECK_Y;
    let x0: number;
    let x1: number;
    if (top < this.waterY - 1 && this.y + 20 > this.waterY) {
      x0 = this.lx2w(-150);
      x1 = this.lx2w(A.BOW_X - 2);
    } else if (this.y + A.DECK_Y + A.TOWER_TOP < this.waterY) {
      x0 = this.lx2w(-21);
      x1 = this.lx2w(23);
    } else return;
    const a = Math.round(Math.min(x0, x1));
    const b = Math.round(Math.max(x0, x1));
    const ph = Math.floor(this.t * 10);
    for (let x = a; x <= b; x++) {
      const k = ((x * 7 + ph * 3) % 11) / 11;
      if (k < 0.45) {
        g.fillStyle = k < 0.15 ? '#ffffff' : '#cfeeff';
        g.fillRect(x, wy - (k < 0.08 ? 1 : 0), 1, 1);
      }
    }
    // Bow wave.
    const bx = Math.round(this.facing < 0 ? Math.min(x0, x1) : Math.max(x0, x1));
    g.fillStyle = '#ffffff';
    const s = Math.floor(this.t * 6) % 2;
    g.fillRect(bx - 3 + s, wy - 1, 4, 1);
    g.fillRect(bx - 5, wy, 8, 1);
  }

  // ------------------------------------------------------------------ helpers for tests

  /** Is the given entity one of this boss's live attacks? */
  ownsProjectile(e: Entity): boolean {
    return e.owner === this;
  }
}
