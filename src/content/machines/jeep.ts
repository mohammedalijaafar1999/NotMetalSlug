// jeep — Legion gun jeep (16 HP): a driver and a gunner on a pintle-mounted MG.
//  - Drives in fast from its side, brakes hard at fighting range (or props.stopX).
//  - The gunner swivels onto you (he can turn to fire backwards), the muzzle glows, then a
//    4-round burst. It shuffles back and forth between bursts.
//  - After a few bursts it reverses off-screen (props.leave, default true; never while the camera
//    is locked in an arena).
//  - Rams you while driving fast (crush damage).
//  - Destroyed: hops up in a fireball, crew + a wheel fly off, wreck burns.
// props: facing (1|-1; default toward the player), stopX (world x to stop at), leave (default true),
//        bursts (before leaving, default 3), drop

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import { MC, Machine, Pen, FlyingPart, cog, charr, wheel, drawHumanClip, angleFrame, cycleFrame, msfx, CREW_DRIVER, CREW_GUNNER } from './common';

const W = 56;
const H = 46;
const WHEEL_N = 4;
const WRECK = WHEEL_N;
/** Gunner sprite: origin = MG pivot. */
const GUN_W = 40;
const GUN_H = 36;
const GUN_OX = 16;
const GUN_OY = 22;
/** MG pivot relative to the jeep's feet (facing right). */
const PIV_DX = -11;
const PIV_DY = -27;
const AIMS = [0.3, 0.12, -0.08, -0.3, -0.55];
const MG_LEN = 15;

function drawJeep(p: PixelArt, f: number, wreck: boolean): void {
  const bob = !wreck && f % 2 === 1 ? -1 : 0;
  const d = new Pen(p);
  const b = new Pen(p, 0, bob);
  const phase = (f / WHEEL_N) * (Math.PI / 2);
  // Big off-road wheels (behind the fenders).
  wheel(d, 13, 38.5, 7, phase, { hub: MC.oliveL });
  wheel(d, 42, 38.5, 7, phase + 0.4, { hub: MC.oliveL });
  // Driver (seated; the tub hides everything below the rim).
  if (!wreck) drawHumanClip(p, 26, 46 + bob, { hip: [0, -13], footB: [-2, 0], footF: [2, 0], part: 'upper', gun: 'none', handF: [7, 2], handB: [6, 3], lean: 1 }, CREW_DRIVER, -5, 27 + bob);
  // Steering wheel.
  if (!wreck) b.line(30, 22, 32, 25, MC.steelD);
  // Spare tire on the tailgate.
  b.circle(2.5, 30, 4.5, MC.tread);
  b.circle(2.5, 30, 2.4, MC.oliveD);
  b.px(1, 28, MC.treadLL);
  // Tub (high sides).
  b.poly([4, 25, 31, 25, 32, 35, 5, 35], MC.olive);
  b.rect(4, 25, 27, 1, MC.oliveLL);
  b.rect(4, 26, 1, 8, MC.oliveL);
  b.rect(5, 34, 27, 1, MC.oliveD);
  b.rect(6, 29, 24, 1, MC.rust);
  b.px(6, 29, MC.rustL);
  // Door seam + Legion cog.
  b.rect(20, 26, 1, 8, MC.oliveD);
  b.rect(21, 26, 1, 8, MC.oliveL);
  cog(b, 26, 31.5, 2.2);
  // Hood (short, sloping to the grille) + bumper + headlight.
  b.poly([31, 26, 45, 27, 51, 29, 51, 35, 32, 35], MC.olive);
  b.poly([31, 26, 45, 27, 47, 28, 32, 27.5], MC.oliveLL);
  b.rect(33, 30, 16, 1, MC.oliveD);
  for (let gy = 30; gy <= 34; gy += 2) b.rect(49, gy, 2, 1, MC.oliveDD);
  b.rect(51, 33, 3, 3, MC.steel);
  b.rect(51, 33, 3, 1, MC.steelL);
  b.circle(47.5, 29.5, 1.5, MC.steelD);
  b.px(47, 29, MC.glassL);
  // Flat fenders over the wheels.
  b.poly([3, 33, 5, 30.5, 21, 30.5, 23, 33, 23, 34, 3, 34], MC.oliveD);
  b.poly([32, 33, 34, 30.5, 50, 30.5, 52, 33, 52, 34, 32, 34], MC.oliveD);
  b.rect(5, 30.5, 16, 1, MC.olive);
  b.rect(34, 30.5, 16, 1, MC.olive);
  // Windshield frame + glass.
  if (!wreck) {
    b.rect(31, 16, 2, 10, MC.steelD);
    b.rect(33, 17, 2, 9, MC.glassD);
    b.px(33, 18, MC.glassL);
    b.px(33, 19, MC.glassL);
    b.rect(31, 16, 4, 1, MC.steel);
  } else {
    b.line(32, 25, 36, 20, MC.steelD);
  }
  // Pintle post for the MG.
  b.rect(16, 19, 2, 7, MC.steelD);
  b.px(16, 19, MC.steelL);
  if (wreck) charr(p, 21);
}

sprites.define({
  name: 'mach_jeep',
  w: W,
  h: H,
  frames: WHEEL_N + 1,
  draw: (p, f) => drawJeep(p, f, f === WRECK),
});

/** Gunner + MG for each aim (frames 0..4), origin at the pivot. */
sprites.define({
  name: 'mach_jeep_gun',
  w: GUN_W,
  h: GUN_H,
  ox: GUN_OX,
  oy: GUN_OY,
  frames: AIMS.length,
  draw: (p, f) => {
    const a = AIMS[f];
    const d = new Pen(p);
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const at = (t: number, s = 0): [number, number] => [GUN_OX + cs * t - sn * s, GUN_OY + sn * t + cs * s];
    // Gunner standing in the tub behind the gun; hands on the grips.
    const [gx, gy] = at(-5, 1);
    const fx = GUN_OX - 9;
    const fy = GUN_OY + 19;
    const shx = fx + 1.5;
    const shy = fy - 13 - 10;
    drawHumanClip(p, fx, fy, { hip: [0, -13], footB: [-2.5, 0], footF: [2.5, 0], lean: 1.5, gun: 'none', handF: [gx - shx + 1, gy - shy], handB: [gx - shx - 1, gy - shy + 1.5], expr: f === 4 ? 'normal' : 'shout' }, CREW_GUNNER, -10, GUN_OY + 7);
    // MG: receiver, barrel with cooling jacket, ammo box.
    const cap = (t0: number, t1: number, s: number, r: number, c: string) => {
      const [x0, y0] = at(t0, s);
      const [x1, y1] = at(t1, s);
      d.cap(x0, y0, x1, y1, r, c);
    };
    cap(-6, 2, 0, 2, MC.steel);
    cap(-5, 1, -1.1, 0.5, MC.steelLL);
    cap(2, MG_LEN - 2, 0, 1.3, MC.steelD);
    cap(3, MG_LEN - 4, -0.7, 0.35, MC.steelL);
    cap(MG_LEN - 3, MG_LEN, 0, 0.9, MC.steel);
    cap(-7, -6, 1.6, 0.8, MC.steelD);
    const [bx, by] = at(-1, 3);
    d.rect(bx - 2, by, 5, 3, MC.olive);
    d.rect(bx - 2, by, 5, 1, MC.oliveL);
  },
});

/** A loose tire (jeeps/trucks blown apart). */
sprites.define({
  name: 'mach_wheel',
  w: 14,
  h: 14,
  ox: 7,
  oy: 7,
  draw: (p) => {
    const d = new Pen(p);
    wheel(d, 7, 7, 6.5, 0.3, { hub: MC.oliveL });
    charr(p, 4, 0.03);
  },
});

export class Jeep extends Machine {
  wheelT = 0;
  stopX: number | null;
  leave: boolean;
  burstsLeft: number;
  aim = 0;
  gunFacing: 1 | -1 = 1;
  fireT = 0;
  burst = 0;
  burstT = 0;
  moveT = 0;
  goal = 0;
  engineT = 0;
  recoil = 0;
  braking = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.rearWarn = true;
    this.w = 24;
    this.h = 26;
    this.bodyW = 46;
    this.hp = this.maxHp = 16;
    this.scoreValue = 800;
    this.stopX = typeof props.stopX === 'number' ? props.stopX : null;
    this.leave = props.leave !== false;
    this.burstsLeft = typeof props.bursts === 'number' ? props.bursts : 3;
    this.boom = 'large';
    this.blast = { radius: 30, damage: 4 };
    this.crewOut = ['mach_crew', 'mach_crew'];
    this.smokeAt = [
      [16, -14],
      [-10, -12],
    ];
    this.wreckTime = 2.3;
  }

  override spawned(): void {
    super.spawned();
    this.gunFacing = this.facing;
    this.fireT = this.fireDelay(0.6);
    this.setState('drive');
  }

  pivot(): { x: number; y: number } {
    return { x: this.x + PIV_DX * this.facing, y: this.y + PIV_DY };
  }

  muzzle(): { x: number; y: number; ang: number } {
    const p = this.pivot();
    const a = this.aim;
    const ang = this.gunFacing > 0 ? a : Math.PI - a;
    return { x: p.x + Math.cos(ang) * (MG_LEN + 1), y: p.y + Math.sin(ang) * (MG_LEN + 1), ang };
  }

  think(dt: number): void {
    const t = this.target();
    const dx = t ? t.x - this.x : this.facing * 200;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 12);
    if (this.braking > 0) this.braking -= dt;
    let wantV = 0;
    switch (this.state) {
      case 'drive': {
        wantV = this.facing * 92;
        const stopHere = this.stopX !== null ? (this.x - this.stopX) * this.facing >= 0 : t ? Math.abs(dx) < 150 && Math.sign(dx) === this.facing && this.onScreen(-24) : false;
        // Never drive past the far edge of the view when the player is behind.
        const passing = t && Math.sign(dx) !== this.facing && this.onScreen(-30);
        if (stopHere || passing || this.ledgeAhead(this.facing) || this.wallAhead(this.facing)) {
          this.setState('fight');
          this.braking = 0.35;
          this.world.particles.dust(this.x + this.facing * 16, this.y, 5);
          this.world.particles.dust(this.x - this.facing * 14, this.y, 4);
          this.goal = this.x;
        }
        break;
      }
      case 'fight': {
        // Shuffle around a goal point.
        this.moveT -= dt;
        if (this.moveT <= 0) {
          this.moveT = this.world.rng.range(1.2, 2.2);
          const [lo, hi] = this.viewClamp(this.bw / 2 + 6);
          this.goal = Math.max(lo, Math.min(hi, this.x + this.world.rng.range(-40, 40)));
        }
        const gd = this.goal - this.x;
        if (Math.abs(gd) > 4 && !this.ledgeAhead(Math.sign(gd)) && !this.wallAhead(Math.sign(gd))) wantV = Math.sign(gd) * 40;
        // Gun.
        this.fireT -= dt;
        if (this.burst === 0 && this.fireT <= 0 && t && this.canAttack()) {
          this.burst = 4;
          this.burstT = 0.38; // wind-up with muzzle glow
        }
        if (this.burst > 0) {
          this.burstT -= dt;
          if (this.burstT <= 0) {
            this.burst--;
            this.burstT = 0.09;
            this.fire();
            if (this.burst === 0) {
              this.fireT = this.fireDelay(1.6);
              this.burstsLeft--;
              if (this.burstsLeft <= 0 && this.leave && !this.world.level?.locked) this.setState('leave');
            }
          }
        }
        break;
      }
      case 'leave':
        wantV = -this.facing * 75;
        if (!this.onScreen(40)) {
          this.remove();
          return;
        }
        // Can't back out (wall / ledge behind): stay and fight.
        if (this.ledgeAhead(-this.facing) || this.wallAhead(-this.facing)) {
          this.leave = false;
          this.setState('fight');
        }
        break;
    }
    // Gunner tracks the target (can swivel to the rear).
    if (t) {
      const p = this.pivot();
      const gdx = t.cx - p.x;
      if (Math.abs(gdx) > 6 && this.burst <= 0) this.gunFacing = gdx < 0 ? -1 : 1;
      const want = Math.max(AIMS[AIMS.length - 1], Math.min(AIMS[0], Math.atan2(t.cy - p.y, Math.abs(gdx) + 1)));
      this.aim += Math.sign(want - this.aim) * Math.min(Math.abs(want - this.aim), 2.5 * dt);
    }
    // Speed control with hard braking.
    const acc = this.braking > 0 ? 320 : 160;
    this.vx += Math.sign(wantV - this.vx) * Math.min(Math.abs(wantV - this.vx), acc * dt);
    if (this.state !== 'leave' && this.onScreen(0)) {
      const [lo, hi] = this.viewClamp(this.bw / 2 + 2);
      if ((this.vx < 0 && this.x < lo && this.state !== 'drive') || (this.vx > 0 && this.x > hi && this.state !== 'drive')) this.vx = 0;
    }
    this.moveAndCollide(dt);
    if (this.hitWall) this.goal = this.x;
    this.wheelT += (this.vx * this.facing * dt) / 4;
    // Ram.
    if (Math.abs(this.vx) > 45) this.touch({ x: this.x + (this.vx > 0 ? 6 : -this.bw / 2 - 4), y: this.y - 18, w: this.bw / 2, h: 18 }, 4, 'crush', 0.7);
    // Engine + dust.
    this.engineT -= dt;
    if (this.engineT <= 0 && this.onScreen(30)) {
      this.engineT = Math.abs(this.vx) > 20 ? 0.45 : 0.9;
      msfx(this, 'engine', { vol: 0.3, pitch: Math.abs(this.vx) > 20 ? 1.15 : 0.9 });
      this.world.particles.add({ kind: 'smoke', x: this.x - this.facing * 27, y: this.y - 7, vx: -this.facing * 14, vy: -8, life: 0.5, color: '#7a7680', color2: '#4a4850', size: 1, size2: 3, drag: 1 });
    }
    if (Math.abs(this.vx) > 40 && fxRng.chance(dt * 12)) this.world.particles.dust(this.x - Math.sign(this.vx) * 16, this.y, 1);
  }

  private fire(): void {
    if (!this.canAttack()) return;
    const m = this.muzzle();
    this.shoot(m.x, m.y, { angle: m.ang, speed: 155, spread: 0.04 });
    const fx = this.world.effect('muzzle_flash', m.x, m.y, { fps: 30 });
    fx.rot = m.ang;
    msfx(this, 'turret_fire', { vol: 0.55 });
    this.recoil = 1.5;
    const p = this.pivot();
    this.world.particles.add({ kind: 'px', x: p.x, y: p.y, vx: -this.gunFacing * fxRng.range(20, 50), vy: fxRng.range(-70, -30), life: 0.5, color: MC.brass, gravity: 500 });
  }

  override onExplode(): void {
    this.vy = -170;
    this.onGround = false;
    this.world.add(new FlyingPart('mach_wheel', 0, this.x + this.facing * 16, this.y - 8, this.facing * fxRng.range(50, 90), -fxRng.range(200, 260), fxRng.range(8, 12), { life: 2 }));
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.hidden) return;
    const flip = this.facing < 0;
    const flash = this.flash > 0;
    const x = this.x + this.joltX;
    const body = sprites.get('mach_jeep');
    if (this.wrecked) {
      body.draw(g, x, this.y, WRECK, { flip });
      return;
    }
    const wf = cycleFrame(this.wheelT, WHEEL_N);
    const bob = wf % 2 === 1 ? -1 : 0;
    const dip = this.braking > 0 ? 1 : 0;
    // Gunner behind the tub.
    const p = this.pivot();
    const af = angleFrame(this.aim, AIMS[0], AIMS[AIMS.length - 1], AIMS.length);
    const rx = -this.gunFacing * Math.round(this.recoil);
    sprites.get('mach_jeep_gun').draw(g, p.x + rx, p.y + bob + dip, af, { flip: this.gunFacing < 0, flash });
    body.draw(g, x, this.y + dip, wf, { flip, flash });
    if (this.burst > 0 && this.burstT > 0.12 && Math.floor(this.burstT * 16) % 2 === 0) {
      const m = this.muzzle();
      sprites.get('mach_glow').draw(g, m.x, m.y + bob, 1);
    }
  }
}

registerEntity(
  'jeep',
  'enemy',
  (_w, s) => new Jeep(s.props),
  'Gun jeep (16 HP): drives in fast, brakes at range (props.stopX), gunner swivels + telegraphed MG bursts, rams while fast, reverses off-screen after props.bursts (default 3) unless props.leave=false or the camera is locked. props.facing, props.drop',
);
