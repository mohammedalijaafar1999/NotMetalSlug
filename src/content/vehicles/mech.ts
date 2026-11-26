// STRIDER walker (player vehicle). A long-legged digitigrade walker with an open cockpit pod, a
// visor "eye", a heavy chin cannon that aims like the soldier's gun (forward / diagonal / up, down
// in the air) and a back pod that fires a salvo of 3 homing mini-missiles (BOMB, 20 salvos).
// JUMP is a big thruster jump (hold JUMP while falling to glide briefly); landing stomps enemies
// underfoot with a shockwave. Kneels when parked. 90 HP.
// props: ammo (missile salvos, default 20), facing.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { approach, angleTo, rotateTowards, rectsOverlap } from '../../engine/math';
import type { ActionState } from '../../engine/input';
import type { PixelArt } from '../../engine/pixelart';
import { ik2 } from '../../art/humanoid';
import { registerEntity } from '../../game/registry';
import { Vehicle, vsfx } from '../../game/vehicle';
import { Bullet, Projectile } from '../../game/projectile';
import { Z } from '../../game/constants';
import type { Entity } from '../../game/entity';
import { VP, ramp, rivet, shaded, shadedCapsule, shadedCircle, shadedPoly, shadedRect, type Ramp } from './art';

// ------------------------------------------------------------------ tuning

const SPEED = 72;
const ACCEL = 620;
const JUMP = 380;
const GLIDE_FALL = 55;
const GLIDE_TIME = 0.75;
const VULCAN_CD = 0.085;
const SALVO_CD = 0.75;
const AIM_RATE = 12;

// ------------------------------------------------------------------ poses

/** Leg pose: hip height above the ground, feet x (relative to the body) and lift. */
interface MPose {
  hip: number;
  bx: number;
  by: number;
  fx: number;
  fy: number;
}

export const MF = { STAND: 0, WALK: 1, WALK_N: 8, JUMP: 9, FALL: 10, SQUAT: 11, KNEEL: 12, COUNT: 13 } as const;
const HIP0 = 29;

export const MECH_POSES: MPose[] = (() => {
  const out: MPose[] = [{ hip: HIP0, bx: -5, by: 0, fx: 5, fy: 0 }];
  for (let i = 0; i < 8; i++) {
    const ph = (i / 8) * Math.PI * 2;
    out.push({
      hip: HIP0 - Math.abs(Math.sin(ph)) * 1.4,
      fx: 1 + Math.sin(ph) * 9,
      fy: -Math.max(0, Math.cos(ph)) * 6,
      bx: -1 + Math.sin(ph + Math.PI) * 9,
      by: -Math.max(0, Math.cos(ph + Math.PI)) * 6,
    });
  }
  out.push({ hip: HIP0 + 1, bx: -7, by: -9, fx: 4, fy: -11 }); // jump
  out.push({ hip: HIP0 + 1, bx: -4, by: -2, fx: 6, fy: -1 }); // fall
  out.push({ hip: HIP0 - 8, bx: -8, by: 0, fx: 8, fy: 0 }); // squat
  out.push({ hip: 15, bx: -9, by: 0, fx: 10, fy: 0 }); // kneel
  return out;
})();

// ------------------------------------------------------------------ art

const LW = 56;
const LH = 50;
const LOX = 28;
const LOY = 50;
/** Body canvas: origin = hip center. */
const BW = 52;
const BH = 42;
const BOX = 26;
const BOY = 32;
/** Pilot shoulder, gun pivot, missile launch point, thrusters, smoke (body canvas). */
const SEAT = [24, 17] as const;
const GUN = [36, 33] as const;
const LAUNCH = [12, 12] as const;
const THRUST = [18, 37] as const;

const LEG_HULL = ramp('#4f9a80', 0.3, -0.32);
const LEG_HULL_B = ramp('#3a7864', 0.22, -0.32);

function drawLeg(p: PixelArt, pose: MPose, back: boolean): void {
  const hipX = LOX + (back ? -2 : 2);
  const hipY = LOY - pose.hip;
  const footX = LOX + (back ? pose.bx : pose.fx);
  const footY = LOY + (back ? pose.by : pose.fy);
  // Hock (reverse joint) sits behind and above the foot.
  const hockX = footX - 3.5;
  const hockY = footY - 8;
  const [kx, ky] = ik2(hipX, hipY, hockX, hockY, 11.5, 12.5, 1);
  const armor: Ramp = back ? LEG_HULL_B : LEG_HULL;
  const metal: Ramp = back ? ramp('#5a606e', 0.25, -0.3) : VP.steel;
  const dark: Ramp = back ? ramp('#3e4250', 0.2, -0.3) : VP.steelDark;
  // Shin (knee -> hock) with a piston behind it.
  shadedCapsule(p, kx, ky, hockX, hockY, 2.1, metal);
  p.line(kx - 1, ky + 2, hockX - 1, hockY - 2, dark.dark);
  // Metatarsal (hock -> ankle).
  shadedCapsule(p, hockX, hockY, footX, footY - 3, 1.7, dark);
  // Foot: wide three-toed plate.
  shadedPoly(p, [footX - 4, footY, footX - 3, footY - 3, footX + 2, footY - 3.6, footX + 7, footY - 1.4, footX + 7.5, footY], dark);
  p.px(Math.floor(footX + 6), Math.floor(footY - 1), metal.light);
  p.hline(footX - 3, footX + 6, footY - 1, dark.dark2 ?? dark.dark);
  // Thigh armor (hip -> knee).
  shadedCapsule(p, hipX, hipY, kx, ky, 3.4, armor);
  p.line(hipX + 1, hipY + 1, kx + 1, ky - 1, back ? armor.light2 ?? armor.light : VP.hullL);
  // Knee and hock joints.
  shadedCircle(p, kx, ky, 2.3, metal);
  p.px(Math.floor(kx), Math.floor(ky), dark.dark);
  shadedCircle(p, hockX, hockY, 1.6, dark);
  if (!back) {
    // Hip joint over the pod.
    shadedCircle(p, hipX, hipY, 3.6, VP.steel);
    p.circle(hipX, hipY, 1.4, VP.steelDark.base);
    p.px(Math.floor(hipX) - 1, Math.floor(hipY) - 1, VP.steel.light);
  }
}

for (const back of [true, false]) {
  sprites.define({
    name: back ? 'mech_leg_b' : 'mech_leg_f',
    w: LW,
    h: LH,
    ox: LOX,
    oy: LOY,
    frames: MF.COUNT,
    draw: (p, f) => drawLeg(p, MECH_POSES[f], back),
  });
}

/** Cockpit pod: 0 parked (canopy shut, visor dark), 1 driven, 2 driven + missile hatch open. */
sprites.define({
  name: 'mech_body',
  w: BW,
  h: BH,
  ox: BOX,
  oy: BOY,
  frames: 3,
  draw: (p, f) => {
    const driven = f > 0;
    // Belly thrusters.
    shadedRect(p, 15.5, 35, 3.5, 3, VP.steelDark);
    shadedRect(p, 20.5, 35, 3.5, 3, VP.steelDark);
    p.hline(16, 18, 37, VP.hole);
    p.hline(21, 23, 37, VP.hole);
    // Missile pod on the back (behind the pod body).
    shadedRect(p, 10, 15, 9, 8, ramp('#59616e', 0.32, -0.32));
    p.rect(10, 18, 9, 1, VP.orange);
    // Missile noses in the launch cells.
    for (const mx of [11, 13.5, 16]) {
      p.rect(mx, 13.5, 1.6, 2, f === 2 ? VP.red : VP.cream);
      p.px(mx, 12.5, f === 2 ? '#ff9a7a' : VP.cream);
    }
    if (f !== 2) {
      // Pod lid closed over the noses.
      shadedRect(p, 9.5, 12.4, 10, 2.6, VP.steel);
    } else {
      // Lid flipped up and back.
      shaded(p, (m) => m.poly([9.5, 15, 6.5, 8, 8.5, 7.5, 11.5, 14.5], '#fff'), VP.steel);
    }
    // Main pod hull.
    shadedPoly(p, [14, 33, 13, 24, 17, 19, 31, 19, 36, 21.5, 39.6, 26, 39.6, 32, 35, 35.6, 18, 36], VP.hull);
    // Armor seam and side stripe.
    p.line(15, 28, 38, 28, VP.hull.dark2 ?? VP.hull.dark);
    p.rect(15, 29, 17, 2, VP.orange);
    p.hline(15, 31, 29, VP.orangeL);
    for (const rx of [17, 22, 27, 32]) rivet(p, rx, 25, VP.hullL, VP.hullDeep);
    // Vent grille.
    for (let i = 0; i < 3; i++) p.hline(16, 20, 32.5 + i, i % 2 ? VP.hull.dark : VP.hullDeep);
    // Visor "eye" on the nose.
    p.rect(34.5, 23.5, 5, 3, VP.hole);
    p.rect(35.5, 24.2, 3.5, 1.6, driven ? '#ff6a3a' : '#4a3a3a');
    if (driven) p.px(37, 24, '#ffd0a0');
    // Cockpit rim.
    shadedRect(p, 16.5, 18, 15.5, 2.5, VP.steel);
    // Windshield.
    p.capsule(31.5, 18.5, 33.4, 12.6, 1.1, VP.glassD);
    p.line(32, 17, 33, 13, VP.glassL);
    if (!driven) {
      // Canopy cover when parked.
      shaded(p, (m) => m.poly([17, 18.4, 19, 14.4, 29, 14.4, 31.5, 18.4], '#fff'), VP.hull);
      p.hline(21, 27, 16, VP.hullL);
    }
    // Chin gun mount.
    shadedCircle(p, GUN[0], GUN[1], 3.3, VP.steelDark);
  },
});

/** Chin cannon: 9 aims (-90..+90 degrees in 22.5 steps) x 2 (kick). Origin = pivot. */
sprites.define({
  name: 'mech_gun',
  w: 30,
  h: 30,
  ox: 15,
  oy: 15,
  frames: 18,
  draw: (p, f) => {
    const a = -Math.PI / 2 + (f % 9) * (Math.PI / 8);
    const kick = f >= 9 ? 1.5 : 0;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy;
    const py = dx;
    const at = (t: number, s: number): [number, number] => [15 + dx * t + px * s, 15 + dy * t + py * s];
    const [b0x, b0y] = at(2, 0);
    const [b1x, b1y] = at(13 - kick, 0);
    shaded(p, (m) => m.capsule(b0x, b0y, b1x, b1y, 1.5, '#fff'), VP.steelDark);
    // Cooling jacket holes.
    for (const t of [5, 7, 9]) {
      const [hx, hy] = at(t - kick, -0.4);
      p.px(Math.floor(hx), Math.floor(hy), VP.hole);
    }
    // Muzzle brake.
    const [m0x, m0y] = at(11.5 - kick, -2);
    const [m1x, m1y] = at(11.5 - kick, 2);
    p.capsule(m0x, m0y, m1x, m1y, 1.1, VP.steel.base);
    // Breech block.
    const pts: number[] = [];
    for (const [sx, sy] of [
      [-3, -2.8],
      [3.6, -2.8],
      [3.6, 2.8],
      [-3, 2.8],
    ]) {
      const [x, y] = at(sx, sy);
      pts.push(x, y);
    }
    shadedPoly(p, pts, ramp('#6a7482', 0.34, -0.32));
  },
});

sprites.define({
  name: 'mech_missile',
  w: 9,
  h: 5,
  ox: 4,
  oy: 2,
  frames: 2,
  draw: (p, f) => {
    p.rect(0, 1.5, 2, 2, f ? '#ffd040' : '#ff8a20');
    shadedRect(p, 1.5, 1, 5, 3, ramp('#e8e4d8', 0.2, -0.3));
    p.poly([6.5, 1, 9, 2.5, 6.5, 4], VP.red);
    p.rect(2, 0, 1.5, 5, '#6a7482');
  },
});

// ------------------------------------------------------------------ projectiles

/** Mini-missile: pops up out of the pod, then accelerates and curves into the nearest enemy. */
export class MechMissile extends Projectile {
  private t = 0;
  private dir: number;
  private target: Entity | null = null;
  private smokeT = 0;

  constructor(owner: Entity, x: number, y: number, dir: number, spread: number) {
    super({
      team: 'player',
      owner,
      x,
      y,
      vx: dir * (30 + spread * 18),
      vy: -150 - spread * 10,
      w: 6,
      h: 5,
      sprite: 'mech_missile',
      rotate: true,
      fps: 20,
      life: 3.2,
      explode: { radius: 20, damage: 8, size: 'medium', shake: 1 },
    });
    this.dir = dir;
    this.offscreenMargin = 60;
  }

  protected override move(dt: number): void {
    this.t += dt;
    if (this.t < 0.16) {
      this.vy += 420 * dt;
    } else {
      if (!this.target || this.target.dead || !this.target.hittable) this.target = this.acquire();
      let ang = Math.atan2(this.vy, this.vx);
      const want = this.target ? angleTo(this.x, this.y, this.target.cx, this.target.cy) : this.dir > 0 ? 0 : Math.PI;
      ang = rotateTowards(ang, want, (this.target ? 7 : 3.5) * dt);
      const sp = Math.min(360, Math.hypot(this.vx, this.vy) + 760 * dt);
      this.vx = Math.cos(ang) * sp;
      this.vy = Math.sin(ang) * sp;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.03;
      const a = Math.atan2(this.vy, this.vx);
      this.world.particles.add({ kind: 'smoke', x: this.x - Math.cos(a) * 4, y: this.y - Math.sin(a) * 4, vx: fxRng.range(-6, 6), vy: fxRng.range(-8, 2), life: fxRng.range(0.25, 0.4), color: '#eeeeee', color2: '#9a9aa2', size: 1, size2: 2.5, drag: 2 });
    }
  }

  private acquire(): Entity | null {
    let best: Entity | null = null;
    let bd = 300;
    for (const t of this.world.targets('player')) {
      if (t.team !== 'enemy' || t.dead || !t.hittable) continue;
      if (!t.onScreen(8)) continue;
      const d = Math.hypot(t.cx - this.x, t.cy - this.y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }
}

// ------------------------------------------------------------------ entity

export class Mech extends Vehicle {
  /** Gun angle relative to facing (0 forward, -PI/2 up, +PI/2 down). */
  aim = 0;
  private fireCd = 0;
  private salvoCd = 0;
  private salvoLeft = 0;
  private salvoT = 0;
  private kickT = 0;
  private hatchT = 0;
  private walk = 0;
  private lastStep = -1;
  private glide = 0;
  private squatT = 0;
  /** 0 = kneeling (parked) .. 1 = standing. */
  private stand = 0;
  private thrustT = 0;
  private shot = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.vehicleName = 'STRIDER';
    this.w = 26;
    this.h = 42;
    this.hp = this.maxHp = 90;
    this.secondaryAmmo = this.maxSecondaryAmmo = typeof props.ammo === 'number' ? props.ammo : 20;
    this.footprint = 10;
    this.smokeAt = [-6, -38];
    this.debrisColors = ['#3f8470', '#56a084', '#545a68', '#848c9c', '#f0902e'];
  }

  override entryBox(): { x: number; y: number; w: number; h: number } {
    // Parked low: the cockpit is at knee height.
    return { x: this.x - 14, y: this.y - 30, w: 28, h: 32 };
  }

  override onEnter(): void {
    this.aim = 0;
  }

  /** Current leg pose index. */
  pose(): number {
    if (!this.driver && !this.destroyed) return this.stand < 0.5 ? MF.KNEEL : MF.SQUAT;
    if (this.stand < 0.5) return MF.KNEEL;
    if (this.stand < 1 || this.squatT > 0) return MF.SQUAT;
    if (!this.onGround) return this.vy < 0 ? MF.JUMP : MF.FALL;
    if (Math.abs(this.vx) > 4) return MF.WALK + (Math.floor(this.walk * 8) % 8);
    return MF.STAND;
  }

  /** Hip height for the current pose. */
  hipHeight(): number {
    return MECH_POSES[this.pose()].hip;
  }

  private bodyPt(bx: number, by: number): { x: number; y: number } {
    return this.local(bx - BOX, by - BOY - this.hipHeight());
  }

  /** World-space gun angle. */
  worldAim(): number {
    return this.facing > 0 ? this.aim : Math.PI - this.aim;
  }

  drive(inp: ActionState, dt: number): void {
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.salvoCd > 0) this.salvoCd -= dt;
    if (this.kickT > 0) this.kickT -= dt;
    if (this.hatchT > 0) this.hatchT -= dt;
    if (this.squatT > 0) this.squatT -= dt;
    this.stand = Math.min(1, this.stand + dt * 4);
    const ready = this.stand >= 1;
    const dirX = inp.dirX;
    if (dirX !== 0) this.facing = dirX;
    const speed = ready && this.squatT <= 0 ? SPEED * (this.inWater ? 0.75 : 1) : 0;
    this.vx = approach(this.vx, dirX * speed, ACCEL * dt);
    // Aim like the soldier: up, diagonal, down only in the air (or diagonal down on the ground).
    let target = 0;
    if (inp.held('up')) target = dirX !== 0 ? -Math.PI / 4 : -Math.PI / 2;
    else if (inp.held('down')) target = this.onGround ? Math.PI / 4 : Math.PI / 2;
    this.aim = rotateTowards(this.aim, target, AIM_RATE * dt);
    // Jump + glide.
    if (ready && inp.pressed('jump') && this.onGround && !inp.held('down')) {
      this.jump(JUMP);
      this.glide = GLIDE_TIME;
      vsfx(this.world, 'engine', this.x, { vol: 0.6, pitch: 1.5 });
      this.world.particles.dust(this.x - 8, this.y, 4);
      this.world.particles.dust(this.x + 8, this.y, 4);
    }
    let thrusting = !this.onGround && this.vy < -120;
    if (!this.onGround && this.vy > GLIDE_FALL && inp.held('jump') && this.glide > 0) {
      this.glide -= dt;
      this.vy = GLIDE_FALL;
      thrusting = true;
    }
    if (thrusting) this.thrusterFx(dt);
    if (inp.held('fire') && this.fireCd <= 0 && ready) this.fireGun();
    if (inp.pressed('bomb') && this.salvoCd <= 0 && ready) this.startSalvo();
    this.updateSalvo(dt);
    this.groundPhysics(dt);
    this.afterMove(dt);
  }

  override idle(dt: number): void {
    if (this.kickT > 0) this.kickT -= dt;
    if (this.squatT > 0) this.squatT -= dt;
    if (this.onGround) this.stand = Math.max(0, this.stand - dt * 3);
    super.idle(dt);
    this.afterMove(dt);
  }

  private afterMove(dt: number): void {
    const w = this.world;
    if (this.onGround && Math.abs(this.vx) > 4) {
      this.walk += (Math.abs(this.vx) * dt) / 34;
      const f = Math.floor(this.walk * 8) % 8;
      if (f !== this.lastStep && (f === 1 || f === 5)) {
        // Foot plants: thud, dust, a tiny shake.
        const fx = this.x + this.facing * (f === 1 ? 7 : -7);
        w.particles.dust(fx, this.y, 3);
        vsfx(w, 'mech_step', this.x, { vol: 0.45 });
        if (this.driver) w.shake(0.6, 0.08);
      }
      this.lastStep = f;
    } else this.lastStep = -1;
    if (this.touchdown) this.landed2();
  }

  /** Touchdown: squat, and stomp anything underfoot after a real fall. */
  private landed2(): void {
    const w = this.world;
    const vy = this.touchdownVy;
    this.glide = GLIDE_TIME;
    if (vy < 120) return;
    this.squatT = vy > 260 ? 0.16 : 0.09;
    vsfx(w, 'mech_step', this.x, { vol: 0.9, pitch: 0.85 });
    w.particles.dust(this.x - 10, this.y, 5);
    w.particles.dust(this.x + 10, this.y, 5);
    if (vy > 220 && this.driver) {
      vsfx(w, 'land', this.x, { vol: 0.8, pitch: 0.5 });
      w.shake(3, 0.2);
      this.stomp();
    }
  }

  /** Crush damage under the feet + a dust shockwave both ways. */
  stomp(): void {
    const w = this.world;
    const box = { x: this.x - 22, y: this.y - 16, w: 44, h: 18 };
    for (const t of w.targets('player').slice()) {
      if (t.dead || !t.hittable || t.team !== 'enemy') continue;
      let hit = false;
      for (const hb of t.hurtboxes()) if (rectsOverlap(box, hb)) hit = true;
      if (hit) t.damage({ amount: 10, kind: 'crush', owner: this, x: t.cx, y: t.bottom, dir: Math.sign(t.cx - this.x) || this.facing });
    }
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        w.particles.add({ kind: 'smoke', x: this.x + dir * (6 + i * 3), y: this.y - 2, vx: dir * fxRng.range(60, 120), vy: fxRng.range(-30, -8), life: fxRng.range(0.3, 0.5), color: '#c8b48a', color2: '#9a8a6a', size: 2, size2: 4, drag: 3 });
      }
    }
    w.particles.add({ kind: 'ring', x: this.x, y: this.y - 2, life: 0.3, color: '#fff0c0', size: 4, size2: 26 });
  }

  private thrusterFx(dt: number): void {
    this.thrustT -= dt;
    if (this.thrustT > 0) return;
    this.thrustT = 0.03;
    const P = this.world.particles;
    for (const ox of [0, 5]) {
      const t = this.bodyPt(THRUST[0] + ox, THRUST[1]);
      P.add({ kind: 'px', x: t.x + fxRng.range(-1, 1), y: t.y + 1, vx: fxRng.range(-10, 10), vy: fxRng.range(80, 140), life: fxRng.range(0.08, 0.16), color: '#fff0a0', color2: '#ff8a20', size: 2 });
      P.add({ kind: 'smoke', x: t.x, y: t.y + 4, vx: fxRng.range(-12, 12), vy: fxRng.range(30, 60), life: 0.3, color: '#d8d0c8', color2: '#8a8a92', size: 1, size2: 3, drag: 2 });
    }
  }

  private fireGun(): void {
    const w = this.world;
    this.fireCd = VULCAN_CD;
    this.kickT = 0.045;
    const a = this.worldAim();
    const pv = this.bodyPt(GUN[0], GUN[1]);
    const mx = pv.x + Math.cos(a) * 13;
    const my = pv.y + Math.sin(a) * 13;
    w.add(new Bullet(this, mx, my, a + w.rng.range(-0.03, 0.03), 470, 1));
    const fx = w.effect('muzzle_flash', mx, my, { fps: 30, z: Z.VEHICLE + 3 });
    fx.rot = a;
    vsfx(w, 'vehicle_vulcan', this.x, { vol: 0.5, pitch: 0.9 });
    w.stats.shotsFired++;
    if (this.shot++ % 2 === 0) {
      w.particles.add({ kind: 'debris', x: pv.x, y: pv.y, vx: -this.facing * fxRng.range(30, 60), vy: -fxRng.range(60, 120), life: 0.8, color: '#f0c848', size: 1, size2: 1, gravity: 620, bounce: 0.4, rot: fxRng.range(0, 6), vr: fxRng.range(-20, 20) });
    }
  }

  private startSalvo(): void {
    const w = this.world;
    if (this.secondaryAmmo <= 0) {
      this.salvoCd = 0.3;
      vsfx(w, 'out_of_ammo', this.x);
      w.floatText('EMPTY', this.x, this.top - 6, '#d0d0d8', 0.7);
      return;
    }
    this.secondaryAmmo--;
    this.salvoCd = SALVO_CD;
    this.salvoLeft = 3;
    this.salvoT = 0;
    this.hatchT = 0.45;
    this.shoutTime = 0;
  }

  private updateSalvo(dt: number): void {
    if (this.salvoLeft <= 0) return;
    this.salvoT -= dt;
    if (this.salvoT > 0) return;
    this.salvoT = 0.075;
    const i = 3 - this.salvoLeft;
    this.salvoLeft--;
    const w = this.world;
    const l = this.bodyPt(LAUNCH[0] + i * 3, LAUNCH[1]);
    w.add(new MechMissile(this, l.x, l.y, this.facing, i - 1));
    w.particles.smokePuffs(l.x, l.y + 2, 2, 2, '#e0e0e0', '#9a9aa2');
    vsfx(w, 'mech_missile', this.x, { vol: 0.7 });
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.blinkHidden) return;
    const flip = this.facing < 0;
    const flash = this.flashOn;
    const sx = this.destroyed ? fxRng.int(-1, 1) : 0;
    const pose = this.pose();
    const x = Math.round(this.x + sx);
    const y = Math.round(this.y);
    const by = y - Math.round(MECH_POSES[pose].hip);
    sprites.get('mech_leg_b').draw(g, x, y, pose, { flip, flash });
    if (this.driver) {
      const s = this.bodyPt(SEAT[0], SEAT[1]);
      this.drawPilot(g, s.x + sx, Math.round(s.y));
    }
    const bf = !this.driver ? 0 : this.hatchT > 0 ? 2 : 1;
    sprites.get('mech_body').draw(g, x, by, bf, { flip, flash });
    sprites.get('mech_leg_f').draw(g, x, y, pose, { flip, flash });
    const gp = this.bodyPt(GUN[0], GUN[1]);
    const k = Math.max(0, Math.min(8, Math.round((this.aim + Math.PI / 2) / (Math.PI / 8))));
    sprites.get('mech_gun').draw(g, gp.x + sx, Math.round(gp.y), k + (this.kickT > 0 ? 9 : 0), { flip, flash });
    this.renderEnterHint(g);
  }
}

registerEntity('mech', 'vehicle', (_w, s) => new Mech(s.props ?? {}), 'STRIDER walker: chin cannon, homing missile salvo (BOMB, props.ammo=20), thruster jump + glide, landing stomp. 90 HP');
