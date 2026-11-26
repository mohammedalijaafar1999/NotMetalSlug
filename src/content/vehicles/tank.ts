// BULLDOG mini-tank (player vehicle). A squat, jaw-jutting little tank with a cartoon bulldog face
// and a spiked collar: a stubby cannon "barks" out of its mouth (BOMB, 30 shells) and a twin vulcan
// on a dome turret swivels smoothly toward the held direction (8 ways; back to forward when nothing
// is held) and fires while FIRE is held. JUMP hops, DOWN+JUMP bails out. 100 HP.
// props: ammo (cannon shells, default 30), facing.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { approach, angleDiff, wrapAngle } from '../../engine/math';
import type { ActionState } from '../../engine/input';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import { Vehicle, vsfx } from '../../game/vehicle';
import { Bullet, Projectile } from '../../game/projectile';
import { Z } from '../../game/constants';
import type { Entity } from '../../game/entity';
import { VP, ramp, rivet, shaded, shadedCapsule, shadedCircle, shadedPoly, shadedRect } from './art';

// ------------------------------------------------------------------ tuning

const SPEED = 86;
const ACCEL = 540;
const HOP = 320;
const TURRET_RATE = 7.5;
const VULCAN_CD = 0.075;
const CANNON_CD = 0.5;

// Canvas shared by the tread / hull / lid layers: origin = bottom-center (feet).
const W = 54;
const H = 44;
const OX = 27;
const OY = 44;
/** Vulcan pivot (canvas) and the pilot's shoulder line (canvas). */
const PIVOT = [37, 9] as const;
const SEAT = [18, 15] as const;
/** Cannon muzzle (canvas). */
const MUZZLE = [54, 26] as const;
/** Exhaust stack top (canvas). */
const EXHAUST = [8, 13] as const;
/** Antenna base (canvas). */
const ANTENNA = [11, 19] as const;
const GUN_FRAMES = 16;

// ------------------------------------------------------------------ art

const TRACK_GAP = '#3a3440';

function drawWheel(p: PixelArt, cx: number, cy: number, r: number, phase: number): void {
  shadedCircle(p, cx, cy, r, VP.steelDark);
  p.circle(cx, cy, r - 1.3, VP.steel.base);
  p.circle(cx - 0.4, cy - 0.4, Math.max(0.8, r - 2.3), VP.steel.light);
  p.px(Math.floor(cx), Math.floor(cy), VP.steelDark.dark);
  // Bolt marks rotate with travel.
  for (let k = 0; k < 2; k++) {
    const a = phase * (Math.PI / 4) + k * Math.PI;
    p.px(Math.floor(cx + Math.cos(a) * (r - 1.5)), Math.floor(cy + Math.sin(a) * (r - 1.5)), VP.steelDark.dark);
  }
}

sprites.define({
  name: 'tank_tread',
  w: W,
  h: H,
  ox: OX,
  oy: OY,
  frames: 4,
  draw: (p, f) => {
    const y = 38.5;
    p.capsule(11, y, 43, y, 5.5, VP.rubber);
    p.hline(11, 43, 33, VP.rubberL);
    p.capsule(11, y, 43, y, 3.8, TRACK_GAP);
    // Lugs: the top run travels forward, the bottom run backward.
    for (let x = 8; x <= 46; x += 3) {
      const tx = x + (f % 3);
      if (tx > 10 && tx < 44) p.px(tx, 33, VP.rubberLL);
      const bx = x - (f % 3);
      if (bx > 10 && bx < 44) p.px(bx, 43, VP.rubberL);
    }
    drawWheel(p, 11, y, 3.8, f);
    drawWheel(p, 43, y, 3.8, f);
    for (const wx of [18.5, 27, 35.5]) drawWheel(p, wx, y + 0.5, 3.3, f + 1);
    p.px(6, 37, VP.rubberL);
    p.px(7, 35, VP.rubberL);
  },
});

/** Hull: frame 0 = parked (hatch shut, eye dark), 1 = driven (open hatch, eye lit). */
sprites.define({
  name: 'tank_hull',
  w: W,
  h: H,
  ox: OX,
  oy: OY,
  frames: 2,
  draw: (p, f) => {
    const driven = f === 1;
    // Skirt over the tracks.
    shadedPoly(p, [4.5, 34.5, 8, 30.5, 46, 30.5, 49.5, 34.5], ramp('#3f8470', 0.3, -0.36));
    for (let x = 11; x <= 44; x += 7) rivet(p, x, 32, VP.hullL, VP.hullDeep);
    // Body + big bulldog head.
    shadedPoly(p, [6.5, 31, 6, 22, 9, 19, 27, 19, 29, 14, 33, 11.5, 40, 11, 45, 13, 47.5, 17, 48.6, 21, 49, 24.6, 45, 25.2, 44, 31], VP.hull);
    // Jowl crease under the eye, forehead sheen.
    p.line(39, 22.5, 45, 22.5, VP.hull.dark2 ?? VP.hull.dark);
    p.line(33, 12.5, 40, 12.2, VP.hullL);
    // Underbite jaw.
    shadedPoly(p, [43, 27.2, 50.6, 27.2, 51.6, 29, 49.6, 31.6, 43, 31.6], ramp('#468c76', 0.28, -0.36));
    // Mouth with the cannon in it.
    p.rect(43, 25, 8, 2.3, VP.hole);
    shaded(p, (m) => m.rect(46, 25.2, 7, 1.9, '#fff'), VP.steelDark);
    shadedRect(p, 51.6, 24.4, 2.8, 3.4, VP.steel);
    p.px(53, 25, VP.hole);
    // Teeth: two hang from the snout, a fang juts up from the jaw in front of the barrel.
    p.px(45, 25, VP.cream);
    p.px(47, 25, VP.cream);
    p.poly([48.6, 27.4, 49.5, 24.3, 50.6, 27.4], VP.cream);
    p.px(49, 26, VP.creamD);
    p.px(44, 27, VP.cream);
    // Nostril.
    p.px(47, 20, VP.hullDeep);
    p.px(48, 21, VP.hullDeep);
    // Eye under a heavy, scowling brow: wide awake when driven, snoozing when parked.
    if (driven) {
      p.circle(42.4, 17.8, 2.4, '#f8f2dc');
      p.rect(43, 17, 2, 2, VP.dark);
      p.px(43, 17, '#ffffff');
    } else {
      p.circle(42.4, 17.8, 2.4, VP.hull.dark);
      p.hline(40.5, 44.5, 18, VP.dark);
      p.px(40, 19, VP.dark);
    }
    shadedCapsule(p, 37, 13.8, 46.4, 15.8, 1.35, VP.steel);
    // Spiked collar around the neck.
    p.rect(26.5, 19, 3, 12, VP.orange);
    p.vline(26.5, 19, 30, VP.orangeL);
    p.vline(29, 19, 30, VP.orangeD);
    for (const sy of [21, 25, 29]) {
      p.px(27, sy, VP.cream);
      p.px(28, sy, '#ffffff');
    }
    // Paw-print squad emblem on the flank (symmetric, so it survives flipping).
    p.ellipse(18.5, 26.2, 2.4, 1.7, VP.cream);
    p.px(15, 23, VP.cream);
    p.px(17, 22, VP.cream);
    p.px(20, 22, VP.cream);
    p.px(22, 23, VP.cream);
    p.hline(17, 20, 27, VP.creamD);
    // Exhaust stack at the back.
    shadedCapsule(p, 8, 14, 8, 19.5, 1.4, VP.steelDark);
    p.px(7, 13, VP.hole);
    p.px(8, 13, VP.hole);
    // Rear tow hitch.
    p.rect(4, 27, 2.5, 2, VP.steelDark.base);
    // Turret dome on the head.
    shaded(p, (m) => m.circle(37, 11.5, 4.6, '#fff'), ramp('#5a6472', 0.35, -0.3));
    p.hline(32.5, 41.5, 14.5, VP.steelDark.dark);
    // Hatch coaming (the pilot sits behind it).
    shadedRect(p, 11.5, 16.5, 13, 3, VP.steel);
    if (!driven) {
      // Closed domed lid with a handle.
      shaded(p, (m) => m.poly([12, 17, 13.5, 14.3, 22.5, 14.3, 24, 17], '#fff'), VP.hull);
      p.hline(16, 20, 13, VP.steelDark.dark);
      p.px(16, 14, VP.steelDark.dark);
      p.px(20, 14, VP.steelDark.dark);
    }
  },
});

/** Hatch lid standing open behind the pilot (drawn before the pilot). */
sprites.define({
  name: 'tank_lid',
  w: W,
  h: H,
  ox: OX,
  oy: OY,
  draw: (p) => {
    shaded(p, (m) => m.poly([12, 18, 9, 9.5, 11.6, 8.4, 14.6, 17], '#fff'), VP.hull);
    p.line(11, 11, 12, 15, VP.hullDeep);
  },
});

/** Twin vulcan on its swivel: 16 directions x 2 (barrels kicked back while firing). Origin = pivot. */
sprites.define({
  name: 'tank_gun',
  w: 36,
  h: 36,
  ox: 18,
  oy: 18,
  frames: GUN_FRAMES * 2,
  draw: (p, f) => {
    const a = ((f % GUN_FRAMES) / GUN_FRAMES) * Math.PI * 2;
    const kick = f >= GUN_FRAMES ? 1.5 : 0;
    const cx = 18;
    const cy = 18;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const px = -dy;
    const py = dx;
    const at = (t: number, s: number): [number, number] => [cx + dx * t + px * s, cy + dy * t + py * s];
    // Side ammo drum (behind).
    const [ax, ay] = at(-2.5, 2.2);
    shadedCircle(p, ax, ay, 2.4, VP.steelDark);
    // Barrels.
    for (const s of [-1.3, 1.3]) {
      const [x0, y0] = at(3, s);
      const [x1, y1] = at(15 - kick, s);
      p.capsule(x0, y0, x1, y1, 0.75, s < 0 ? VP.steel.base : VP.steelDark.base);
      const [hx, hy] = at(14.6 - kick, s);
      p.px(Math.floor(hx), Math.floor(hy), VP.steel.light);
    }
    // Barrel clamp.
    const [c1x, c1y] = at(9.5 - kick, -2.3);
    const [c2x, c2y] = at(9.5 - kick, 2.3);
    p.capsule(c1x, c1y, c2x, c2y, 0.9, VP.steelDark.dark);
    // Housing block.
    const pts: number[] = [];
    for (const [sx, sy] of [
      [-3.6, -2.7],
      [4.4, -2.7],
      [5.2, 0],
      [4.4, 2.7],
      [-3.6, 2.7],
    ]) {
      const [x, y] = at(sx, sy);
      pts.push(x, y);
    }
    shadedPoly(p, pts, ramp('#6a7482', 0.34, -0.32));
    const [lx, ly] = at(1, -1);
    p.px(Math.floor(lx), Math.floor(ly), VP.orange);
  },
});

sprites.define({
  name: 'tank_shell',
  w: 9,
  h: 5,
  ox: 4,
  oy: 2,
  frames: 2,
  draw: (p, f) => {
    p.rect(0, 1, 3, 3, f ? '#ffd040' : '#ff8a20');
    shadedRect(p, 2, 0.5, 4, 4, ramp('#c89a3a', 0.3, -0.3));
    p.poly([6, 0.5, 9, 2.5, 6, 4.5], '#5a606c');
    p.px(6, 1, '#9aa0ac');
  },
});

// ------------------------------------------------------------------ projectiles

/** Cannon shell: fast, slightly arcing, big blast. */
export class TankShell extends Projectile {
  private trail = 0;

  constructor(owner: Entity, x: number, y: number, dir: number) {
    super({
      team: 'player',
      owner,
      x,
      y,
      vx: dir * 340,
      vy: -55,
      gravity: 240,
      w: 7,
      h: 7,
      sprite: 'tank_shell',
      rotate: true,
      fps: 16,
      life: 3,
      explode: { radius: 30, damage: 14, size: 'large', shake: 3 },
    });
    this.offscreenMargin = 60;
  }

  protected override move(dt: number): void {
    super.move(dt);
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = 0.025;
      this.world.particles.add({ kind: 'smoke', x: this.x - Math.sign(this.vx) * 4, y: this.y, vx: fxRng.range(-6, 6), vy: fxRng.range(-10, 0), life: 0.35, color: '#d8d8d8', color2: '#8a8a92', size: 1, size2: 3, drag: 2 });
    }
  }
}

// ------------------------------------------------------------------ entity

export class Tank extends Vehicle {
  /** World-space vulcan angle. */
  aim = 0;
  private fireCd = 0;
  private cannonCd = 0;
  private recoilT = 0;
  private kickT = 0;
  private tread = 0;
  private shot = 0;
  private treadSfx = 0;
  private exhaustT = 0;
  private sway = 0;
  private swayV = 0;
  private prevVx = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.vehicleName = 'BULLDOG';
    this.w = 36;
    this.h = 28;
    this.hp = this.maxHp = 100;
    this.secondaryAmmo = this.maxSecondaryAmmo = typeof props.ammo === 'number' ? props.ammo : 30;
    this.footprint = 15;
    this.smokeAt = [EXHAUST[0] - OX, EXHAUST[1] - OY + 2];
    this.debrisColors = ['#3f8470', '#56a084', '#545a68', '#2a262c', '#f0902e'];
  }

  override spawned(): void {
    this.aim = this.facing > 0 ? 0 : Math.PI;
  }

  override onEnter(): void {
    this.aim = this.facing > 0 ? 0 : Math.PI;
    this.swayV += 6;
  }

  /** Turret pivot in world space. */
  pivot(): { x: number; y: number } {
    return this.local(PIVOT[0] - OX - (this.recoilT > 0 ? 1.5 : 0), PIVOT[1] - OY);
  }

  /** 8-way aim from the held directions (forward when nothing is held). */
  aimTarget(inp: ActionState): number {
    const dx = inp.dirX;
    const up = inp.held('up');
    const down = inp.held('down');
    if (up && dx === 0) return -Math.PI / 2;
    if (up) return dx > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4;
    if (down && dx !== 0) return dx > 0 ? Math.PI / 4 : (3 * Math.PI) / 4;
    return this.facing > 0 ? 0 : Math.PI;
  }

  drive(inp: ActionState, dt: number): void {
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.cannonCd > 0) this.cannonCd -= dt;
    if (this.recoilT > 0) this.recoilT -= dt;
    if (this.kickT > 0) this.kickT -= dt;
    const dirX = inp.dirX;
    if (dirX !== 0) this.facing = dirX;
    this.vx = approach(this.vx, dirX * SPEED * (this.inWater ? 0.7 : 1), ACCEL * dt);
    this.aim = turnVia(this.aim, this.aimTarget(inp), TURRET_RATE * dt);
    if (inp.pressed('jump') && this.onGround && !inp.held('down')) {
      this.jump(HOP);
      vsfx(this.world, 'engine', this.x, { vol: 0.5, pitch: 1.25 });
      this.world.particles.dust(this.x - 12, this.y, 3);
      this.world.particles.dust(this.x + 12, this.y, 3);
      this.swayV -= 10;
    }
    if (inp.held('fire') && this.fireCd <= 0) this.fireVulcan();
    if (inp.pressed('bomb') && this.cannonCd <= 0) this.fireCannon();
    this.groundPhysics(dt);
    this.afterMove(dt, true);
  }

  override idle(dt: number): void {
    if (this.recoilT > 0) this.recoilT -= dt;
    if (this.kickT > 0) this.kickT -= dt;
    super.idle(dt);
    this.afterMove(dt, false);
  }

  private afterMove(dt: number, engineOn: boolean): void {
    const w = this.world;
    if (this.touchdown) {
      const hard = this.touchdownVy > 220;
      w.particles.dust(this.x - 13, this.y, hard ? 5 : 3);
      w.particles.dust(this.x + 13, this.y, hard ? 5 : 3);
      if (this.touchdownVy > 120) vsfx(w, 'land', this.x, { vol: 0.7, pitch: 0.6 });
      if (hard) w.shake(1.5, 0.15);
      this.swayV += 8;
    }
    // Treads roll with the ground speed.
    if (this.onGround) this.tread += this.vx * dt * this.facing;
    const moving = Math.abs(this.vx) > 8 && this.onGround;
    if (moving && engineOn) {
      this.treadSfx -= dt;
      if (this.treadSfx <= 0) {
        this.treadSfx = 0.32;
        vsfx(w, 'tank_tread', this.x, { vol: 0.3 });
      }
      if (fxRng.chance(0.25)) w.particles.dust(this.x - this.facing * 16, this.y, 1);
    }
    // Exhaust puffs while the engine runs.
    if (engineOn) {
      this.exhaustT -= dt;
      if (this.exhaustT <= 0) {
        this.exhaustT = moving ? 0.12 : 0.3;
        const e = this.local(EXHAUST[0] - OX, EXHAUST[1] - OY);
        w.particles.add({ kind: 'smoke', x: e.x, y: e.y, vx: -this.facing * fxRng.range(8, 20), vy: fxRng.range(-26, -14), life: fxRng.range(0.35, 0.6), color: '#9a9aa2', color2: '#6a6a72', size: 1, size2: 3, drag: 1.5 });
      }
    }
    // Antenna spring: reacts to acceleration and bumps.
    const acc = (this.vx - this.prevVx) / Math.max(dt, 1e-4);
    this.prevVx = this.vx;
    this.swayV += (-this.sway * 90 - this.swayV * 7 - acc * 0.02 * this.facing) * dt;
    this.sway += this.swayV * dt;
    this.sway = Math.max(-5, Math.min(5, this.sway));
  }

  private fireVulcan(): void {
    const w = this.world;
    this.fireCd = VULCAN_CD;
    this.kickT = 0.04;
    const a = this.aim;
    const pv = this.pivot();
    const side = this.shot++ % 2 === 0 ? -1.3 : 1.3;
    const mx = pv.x + Math.cos(a) * 15 - Math.sin(a) * side;
    const my = pv.y + Math.sin(a) * 15 + Math.cos(a) * side;
    w.add(new Bullet(this, mx, my, a + w.rng.range(-0.035, 0.035), 480, 1));
    const fx = w.effect('muzzle_flash', mx, my, { fps: 30, z: Z.VEHICLE + 3 });
    fx.rot = a;
    vsfx(w, 'vehicle_vulcan', this.x, { vol: 0.5 });
    w.stats.shotsFired++;
    // Spent casings.
    if (this.shot % 2 === 0) {
      w.particles.add({ kind: 'debris', x: pv.x, y: pv.y, vx: -this.facing * fxRng.range(30, 70), vy: -fxRng.range(80, 140), life: 0.8, color: '#f0c848', size: 1, size2: 1, gravity: 620, bounce: 0.4, rot: fxRng.range(0, 6), vr: fxRng.range(-20, 20) });
    }
  }

  private fireCannon(): void {
    const w = this.world;
    if (this.secondaryAmmo <= 0) {
      this.cannonCd = 0.3;
      vsfx(w, 'out_of_ammo', this.x);
      w.floatText('EMPTY', this.x, this.top - 6, '#d0d0d8', 0.7);
      return;
    }
    this.secondaryAmmo--;
    this.cannonCd = CANNON_CD;
    this.recoilT = 0.12;
    this.shoutTime = 0;
    const m = this.local(MUZZLE[0] - OX, MUZZLE[1] - OY);
    w.add(new TankShell(this, m.x, m.y, this.facing));
    const fx = w.effect('muzzle_flash', m.x, m.y, { fps: 24, z: Z.VEHICLE + 3 });
    fx.rot = this.facing > 0 ? 0 : Math.PI;
    w.particles.smokePuffs(m.x + this.facing * 4, m.y, 4, 3, '#d0d0d0', '#8a8a92');
    w.particles.sparks(m.x, m.y, 5, '#ffd060', 120);
    this.vx -= this.facing * 45;
    this.swayV -= this.facing * 14;
    w.shake(2.2, 0.14);
    vsfx(w, 'vehicle_cannon', this.x);
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.blinkHidden) return;
    const flip = this.facing < 0;
    const flash = this.flashOn;
    const shakeX = this.destroyed ? fxRng.int(-1, 1) : 0;
    const rec = this.recoilT > 0 ? -1.5 * this.facing : 0;
    const x = Math.round(this.x + shakeX);
    const y = Math.round(this.y);
    const hx = Math.round(this.x + shakeX + rec);
    const driven = this.driver !== null;
    if (driven) {
      sprites.get('tank_lid').draw(g, hx, y, 0, { flip, flash });
      const s = this.local(SEAT[0] - OX, SEAT[1] - OY);
      this.drawPilot(g, s.x + shakeX + rec, s.y);
    }
    const tf = ((Math.floor(this.tread / 2) % 4) + 4) % 4;
    sprites.get('tank_tread').draw(g, x, y, tf, { flip, flash });
    sprites.get('tank_hull').draw(g, hx, y, driven ? 1 : 0, { flip, flash });
    // Vulcan.
    const local = this.facing > 0 ? this.aim : Math.PI - this.aim;
    const k = ((Math.round(local / ((Math.PI * 2) / GUN_FRAMES)) % GUN_FRAMES) + GUN_FRAMES) % GUN_FRAMES;
    const pv = this.pivot();
    sprites.get('tank_gun').draw(g, pv.x + shakeX, pv.y, k + (this.kickT > 0 ? GUN_FRAMES : 0), { flip, flash });
    this.renderAntenna(g, hx);
    this.renderEnterHint(g);
  }

  /** Whip antenna on the rear deck (springy). */
  private renderAntenna(g: CanvasRenderingContext2D, hx: number): void {
    const bx = hx + (ANTENNA[0] - OX) * this.facing;
    const by = Math.round(this.y) + (ANTENNA[1] - OY);
    const len = 13;
    g.fillStyle = this.flashOn ? '#ffffff' : '#1e1a22';
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const off = Math.round((-1.5 * t - this.sway * t * t) * this.facing);
      g.fillRect(bx + off, by - i, 1, 1);
    }
    const tipOff = Math.round((-1.5 - this.sway) * this.facing);
    g.fillStyle = this.flashOn ? '#ffffff' : VP.red;
    g.fillRect(bx + tipOff, by - len - 1, 1, 2);
  }
}

/**
 * Rotate an angle toward a target; when the turn is (nearly) a half circle, swing over the top
 * so the vulcan sweeps through the sky instead of into the ground.
 */
export function turnVia(a: number, target: number, maxDelta: number): number {
  let d = angleDiff(a, target);
  if (Math.abs(d) > 2.8) {
    const mid = a + d / 2;
    if (Math.sin(mid) > 0) d = d > 0 ? d - Math.PI * 2 : d + Math.PI * 2;
  }
  if (Math.abs(d) <= maxDelta) return target;
  return wrapAngle(a + Math.sign(d) * maxDelta);
}

registerEntity('tank', 'vehicle', (_w, s) => new Tank(s.props ?? {}), 'BULLDOG mini-tank: 8-way vulcan turret, mouth cannon (BOMB, props.ammo=30), hop. 100 HP');
