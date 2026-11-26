// heli — "HORNET" attack helicopter (24 HP).
//  - Flies in from off-screen (or drops in from above) and hovers in an altitude band near the
//    top of the screen, keeping to one side of you; banks into its moves.
//  - Strafe: banks nose-down, the chin gun swings onto you and glows, then a sweeping burst.
//  - Bomb run: lines up above you, a whistle + blinking ground marker shows where each bomb lands.
//  - Destroyed: spins down trailing smoke and fire, crashes, explodes and burns.
// props: facing (1|-1), alt (screen-y of the skids while hovering, default 78), bombs (default true),
//        drop. Spawn just off either screen edge to fly in from that side; y omitted = altitude band.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { VIEW_W } from '../../engine/renderer';
import type { Rect } from '../../engine/math';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import { MC, FlyingMachine, Pen, Bomb, TargetMarker, plate, cog, charr, drawHumanMask, angleFrame, msfx, blurLine, blurRing, CREW_PILOT } from './common';

const W = 72;
const H = 38;
/** Sprite origin = banking pivot (canvas coords). */
const PVX = 36;
const PVY = 22;
/** Skid bottom (canvas y) = entity feet. */
const FEET = 36;
const TILTS = [0.15, 0, -0.12];
const ROTOR_N = 4;
const WRECK = TILTS.length * ROTOR_N;
/** Chin gun mount (canvas coords, level). */
const GUN_X = 58;
const GUN_Y = 29;
const GUN_N = 6;
const GUN_MAX = 1.2;
/** Rotor hub + tail rotor centers (canvas coords, level). */
const HUB_X = 35.5;
const HUB_Y = 1.5;
const TR_X = 6;
const TR_Y = 14;

function drawHeli(p: PixelArt, tilt: number, rotor: number, wreck: boolean): void {
  const d = new Pen(p, 0, 0, tilt, [PVX, PVY]);
  const k = rotor % ROTOR_N;
  // ---- tail rotor blade (blur disc is drawn at render time)
  if (!wreck) {
    const ta = (k / ROTOR_N) * Math.PI;
    d.cap(TR_X - Math.cos(ta) * 4.5, TR_Y - Math.sin(ta) * 4.5, TR_X + Math.cos(ta) * 4.5, TR_Y + Math.sin(ta) * 4.5, 0.6, MC.steelD);
    d.px(Math.round(TR_X + Math.cos(ta) * 4 - 0.5), Math.round(TR_Y + Math.sin(ta) * 4 - 0.5), MC.red);
  }
  // ---- tail boom + fin
  d.poly([30, 17, 10, 17.5, 4, 16, 4, 19, 10, 21.5, 30, 23], MC.olive);
  d.rect(10, 17.5, 19, 1, MC.oliveL);
  d.poly([10, 21.5, 30, 23, 30, 22, 11, 20.5], MC.oliveD);
  d.poly([2, 9, 6, 8, 10, 17.5, 9, 21, 4, 19], MC.olive);
  d.poly([2, 9, 6, 8, 7, 10, 3, 11], MC.oliveL);
  d.rect(4, 12, 3, 2, MC.rust);
  d.poly([3, 19, 9, 21, 7, 23, 3, 22], MC.oliveD);
  d.circle(TR_X, TR_Y, 1.3, MC.steel);
  cog(d, 19, 20, 1.9);
  // ---- far stub wing
  d.poly([30, 26, 40, 25, 42, 27, 31, 28], MC.oliveD);
  // ---- fuselage
  d.poly([24, 13, 30, 10, 46, 10, 52, 12, 62, 18, 64, 23, 62, 27, 54, 30, 30, 30, 24, 26], MC.olive);
  // Cockpit glass, pilot behind it, then highlights and frame.
  d.poly([46, 12, 52, 12, 61, 18.5, 62, 22, 45, 22, 44, 16], MC.glassD);
  d.poly([47, 13, 52, 13, 60, 19, 50, 19, 46, 16], MC.glass);
  if (!wreck) {
    const [fx, fy] = d.t(51, 35);
    drawHumanMask(p, fx, fy, { hip: [0, -13], footB: [-2, 0], footF: [2, 0], part: 'upper', gun: 'none', handF: [5, 3], handB: [4, 4], lean: 0.5, rot: tilt, rotPivot: [0, -24] }, CREW_PILOT, [MC.glassD, MC.glass]);
    d.poly([56, 15.5, 59, 18, 58.5, 18.5, 55.5, 16], MC.glassL);
    d.px(48, 14, MC.glassL);
    d.px(49, 14, MC.glassL);
  }
  d.line(46, 12, 52, 12, MC.steelD);
  d.line(52, 12, 61, 18, MC.steelD);
  d.line(52, 12, 51, 22, MC.steelD);
  // Body shading: top highlight, belly shade, side rust stripe, camo.
  d.poly([24, 13, 30, 10, 46, 10, 46, 11, 30, 11.5, 25, 14], MC.oliveL);
  d.poly([24, 26, 30, 30, 54, 30, 62, 27, 60, 26, 53, 28, 31, 28], MC.oliveD);
  d.rect(26, 22, 18, 1, MC.rust);
  d.ellipse(34, 18, 4, 1.6, MC.camo);
  d.ellipse(40, 25.5, 3, 1.2, MC.camo);
  // Door seams + rivets.
  d.rect(32, 14, 1, 9, MC.oliveD);
  d.rect(43, 14, 1, 9, MC.oliveD);
  d.px(38, 13, MC.oliveLL);
  d.px(38, 23, MC.oliveLL);
  // Nose sensor.
  d.circle(63, 23, 1.4, MC.steelD);
  d.px(63, 22, MC.red);
  // ---- engine housing, exhaust, mast
  plate(d, 27, 6, 18, 5, MC.olive, { rivets: 5 });
  d.poly([45, 6, 49, 8, 49, 10, 45, 11], MC.oliveD);
  d.cap(24, 9, 27, 9, 1.5, MC.steelD);
  d.px(23, 9, MC.black);
  d.rect(34, 2, 3, 4, MC.steel);
  d.rect(34, 2, 1, 4, MC.steelL);
  // ---- near stub wing + rocket pod
  d.poly([32, 25, 42, 24, 43, 26, 33, 27], MC.olive);
  d.rect(33, 24.5, 9, 1, MC.oliveL);
  d.cap(32, 28.5, 42, 28.5, 1.9, MC.steelD);
  d.cap(33, 28, 41, 28, 0.8, MC.steel);
  d.circle(42.5, 28.5, 1.2, MC.black);
  // ---- skids
  d.line(31, 30, 29, 34, MC.steelD);
  d.line(48, 30, 50, 34, MC.steelD);
  d.cap(24, 35, 54, 35, 0.9, MC.steel);
  d.cap(54, 35, 57, 33, 0.9, MC.steel);
  d.px(30, 35, MC.steelL);
  // ---- main rotor blade (long/short alternation reads as spinning)
  if (!wreck) {
    const spans: [number, number][] = [
      [3, 68],
      [24, 56],
      [10, 62],
      [29, 48],
    ];
    const [a, b] = spans[k];
    d.rect(a, 1, b - a, 1, MC.steelD);
    d.rect(a, 1, 3, 1, MC.steelL);
    d.rect(b - 3, 1, 3, 1, MC.steelL);
    d.rect(31, 0, 9, 2, MC.steel);
    d.rect(31, 0, 9, 1, MC.steelL);
  } else {
    d.line(35, 1, 26, 4, MC.steelD);
    d.line(36, 1, 44, -1, MC.steelD);
    d.rect(33, 1, 5, 2, MC.steel);
  }
}

sprites.define({
  name: 'mach_heli',
  w: W,
  h: H,
  ox: PVX,
  oy: PVY,
  frames: WRECK + 1,
  draw: (p, f) => {
    if (f === WRECK) {
      drawHeli(p, 0.28, 0, true);
      charr(p, 7);
      return;
    }
    drawHeli(p, TILTS[Math.floor(f / ROTOR_N)], f % ROTOR_N, false);
  },
});

/** Chin gun (rotates down from forward; origin at its pivot). */
sprites.define({
  name: 'mach_heli_gun',
  w: 14,
  h: 14,
  ox: 3,
  oy: 3,
  frames: GUN_N,
  draw: (p, f) => {
    const a = (f / (GUN_N - 1)) * GUN_MAX;
    const d = new Pen(p);
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    d.cap(3, 3, 3 + cs * 10, 3 + sn * 10, 1.1, MC.steelD);
    d.cap(3 + cs * 2 + sn * 0.6, 3 + sn * 2 - cs * 0.6, 3 + cs * 8 + sn * 0.6, 3 + sn * 8 - cs * 0.6, 0.4, MC.steelL);
    d.circle(3, 3, 2.6, MC.oliveD);
    d.circle(2.6, 2.6, 1.6, MC.olive);
    d.px(2, 2, MC.oliveL);
  },
});

export class Heli extends FlyingMachine {
  rotorT = 0;
  tilt = 0;
  gunAng = 0.3;
  attackT = 0;
  side: 1 | -1 = 1;
  burst = 0;
  burstT = 0;
  sweep = 0;
  baseAng = 0;
  bombsLeft = 0;
  bombT = 0;
  rotorSfxT = 0;
  spin = 0;
  spinV = 0;
  crashing = false;
  useBombs: boolean;
  private hb: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];

  constructor(props: Record<string, any> = {}, autoAlt = true) {
    super(autoAlt, 78, props);
    this.w = 44;
    this.h = 28;
    this.hp = this.maxHp = 24;
    this.scoreValue = 1500;
    this.useBombs = props.bombs !== false;
    this.boom = 'large';
    this.blast = { radius: 32, damage: 5 };
    this.crewOut = ['mach_crew'];
    this.smokeAt = [
      [-2, -28],
      [8, -26],
      [-18, -20],
    ];
    this.debris = [MC.olive, MC.oliveD, MC.oliveL, MC.steel, MC.glass, MC.rust];
    this.wreckTime = 2.4;
  }

  override spawned(): void {
    super.spawned();
    const c = this.world.camera;
    const onScreenX = this.x > c.x - 10 && this.x < c.x + VIEW_W + 10;
    if (this.autoAlt) this.y = onScreenX ? c.y - 4 : this.cruiseY;
    this.side = this.facing > 0 ? -1 : 1;
    this.attackT = this.fireDelay(1.4);
    this.setState('enter');
  }

  /** Body + tail boom hurtboxes (the rotor is not hittable). */
  override hurtboxes(): Rect[] {
    const f = this.facing;
    const body = this.hb[0];
    body.x = f > 0 ? this.x - 12 : this.x - 28;
    body.y = this.y - 27;
    body.w = 40;
    body.h = 22;
    const tail = this.hb[1];
    tail.x = f > 0 ? this.x - 34 : this.x + 12;
    tail.y = this.y - 30;
    tail.w = 22;
    tail.h = 14;
    return this.hb;
  }

  /** Map a canvas point (level art) to world coordinates with the current bank. */
  private toWorld(cx: number, cy: number): { x: number; y: number } {
    const dx = cx - PVX;
    const dy = cy - PVY;
    const a = this.tilt;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a) + PVY - FEET;
    return { x: this.x + lx * this.facing, y: this.y + ly };
  }

  gunPivot(): { x: number; y: number } {
    return this.toWorld(GUN_X, GUN_Y);
  }

  think(dt: number): void {
    const c = this.world.camera;
    const t = this.target();
    this.rotorT += dt * 26;
    this.rotorSfxT -= dt;
    if (this.rotorSfxT <= 0 && this.onScreen(40)) {
      this.rotorSfxT = 0.34;
      msfx(this, 'heli_rotor', { vol: 0.3 });
    }
    // Desired position.
    let gx = this.x;
    const gy = this.cruiseY + Math.sin(this.age * 2.1 + this.id) * 4;
    if (t) {
      if (this.state === 'bomb') gx = t.x - this.facing * 6;
      else gx = t.x + this.side * (84 + Math.sin(this.age * 0.7) * 18);
      const want: 1 | -1 = t.x < this.x ? -1 : 1;
      if (want !== this.facing && this.state !== 'strafe' && this.state !== 'windup' && this.state !== 'bomb' && Math.abs(t.x - this.x) > 16) this.facing = want;
    }
    gx = Math.max(c.x + 34, Math.min(c.x + VIEW_W - 34, gx));
    if (this.state === 'enter' && this.onScreen(-30) && Math.abs(this.y - this.cruiseY) < 30) this.setState('hover');
    // Steering.
    const maxV = this.state === 'enter' ? 95 : this.state === 'bomb' ? 80 : 62;
    const tvx = Math.max(-maxV, Math.min(maxV, (gx - this.x) * 1.6));
    const tvy = Math.max(-60, Math.min(60, (gy - this.y) * 2.2));
    this.vx += Math.sign(tvx - this.vx) * Math.min(Math.abs(tvx - this.vx), 150 * dt);
    this.vy += Math.sign(tvy - this.vy) * Math.min(Math.abs(tvy - this.vy), 150 * dt);
    // Bank into the motion (nose down when moving forward).
    let wantTilt = Math.max(-1, Math.min(1, (this.vx * this.facing) / 60)) * 0.15;
    if (this.state === 'windup' || this.state === 'strafe') wantTilt = 0.15;
    this.tilt += (wantTilt - this.tilt) * Math.min(1, dt * 6);

    switch (this.state) {
      case 'hover':
        this.attackT -= dt;
        if (this.attackT <= 0 && t && this.canAttack()) {
          if (this.useBombs && this.world.rng.chance(0.4)) {
            this.setState('bomb');
            this.bombsLeft = 2;
            this.bombT = 0;
          } else this.setState('windup');
        }
        if (t && this.stateTime > 4 && this.world.rng.chance(dt * 0.25)) this.side = (this.side * -1) as 1 | -1;
        break;
      case 'windup':
        if (t) {
          const g = this.gunPivot();
          this.baseAng = Math.atan2(t.cy - g.y, Math.abs(t.cx - g.x) + 1);
        }
        if (this.stateTime > 0.6) {
          this.setState('strafe');
          this.burst = 6;
          this.burstT = 0;
          this.sweep = -0.22;
        }
        break;
      case 'strafe':
        this.burstT -= dt;
        if (this.burstT <= 0 && this.burst > 0) {
          this.burstT = 0.1;
          this.burst--;
          this.sweep += 0.088;
          this.fireGun();
        }
        if (this.burst <= 0 && this.burstT <= 0) {
          this.attackT = this.fireDelay(2.3);
          this.setState('hover');
        }
        break;
      case 'bomb':
        if (!t) {
          this.setState('hover');
          break;
        }
        if (Math.abs(this.x - (t.x - this.facing * 6)) < 26 || this.stateTime > 2.5) {
          this.bombT -= dt;
          if (this.bombT <= 0 && this.bombsLeft > 0 && this.canAttack()) {
            this.bombsLeft--;
            this.bombT = 0.42;
            this.dropBomb();
          }
          if (this.bombsLeft <= 0 && this.bombT <= 0) {
            this.attackT = this.fireDelay(2.0);
            this.side = (this.side * -1) as 1 | -1;
            this.setState('hover');
          }
        }
        break;
    }
    // Chin gun aim (relative to facing, down positive).
    let wantGun = 0.35;
    if ((this.state === 'windup' || this.state === 'strafe') && t) wantGun = Math.max(0, Math.min(GUN_MAX, this.baseAng + this.sweep - this.tilt));
    this.gunAng += Math.sign(wantGun - this.gunAng) * Math.min(Math.abs(wantGun - this.gunAng), 3 * dt);

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Rotor downwash kicks up dust when low.
    const fy = this.floorUnder(this.x);
    if (fy !== null && fy - this.y < 70 && fxRng.chance(dt * 10)) this.world.particles.dust(this.x + fxRng.range(-20, 20), fy, 1, '#d8c8a0');
  }

  private fireGun(): void {
    if (!this.canAttack()) return;
    const g = this.gunPivot();
    const a = this.gunAng + this.tilt;
    const ang = this.facing > 0 ? a : Math.PI - a;
    const mx = g.x + Math.cos(ang) * 10;
    const my = g.y + Math.sin(ang) * 10;
    this.shoot(mx, my, { angle: ang, speed: 150 });
    const fx = this.world.effect('muzzle_flash', mx, my, { fps: 30 });
    fx.rot = ang;
    msfx(this, 'heli_gun', { vol: 0.55 });
    this.world.particles.add({ kind: 'px', x: g.x, y: g.y, vx: -this.facing * fxRng.range(20, 50), vy: fxRng.range(-40, -10), life: 0.6, color: MC.brass, gravity: 500 });
  }

  private dropBomb(): void {
    const bx = this.x - this.facing * 2;
    const by = this.y - 6;
    const vx = this.vx * 0.5;
    const vy = 20;
    // Predict the landing spot for the warning marker.
    const g = 300;
    const fy = this.floorUnder(bx) ?? this.world.camera.y + 200;
    const dy = Math.max(1, fy - by);
    const tt = (-vy + Math.sqrt(vy * vy + 2 * g * dy)) / g;
    const lx = bx + vx * tt;
    const ly = this.floorUnder(lx) ?? fy;
    this.world.add(new TargetMarker(lx, ly, tt + 0.05));
    this.world.add(new Bomb(this, bx, by, vx, vy));
    msfx(this, 'mortar_whistle', { vol: 0.7 });
  }

  // ---------------------------------------------------------------- death: crash first

  override onDeath(): void {
    this.crashing = true;
    this.spinV = (fxRng.chance(0.5) ? 1 : -1) * 3;
    this.vy = Math.min(this.vy, -20);
    msfx(this, 'alarm', { vol: 0.5 });
    this.world.explode(this.cx, this.cy - 6, { radius: 10, damage: 0, team: 'player', size: 'medium', shake: 2, sfx: 'explosion', debris: this.debris });
  }

  override updateWreck(dt: number): void {
    if (!this.crashing || this.wrecked) return;
    this.rotorT += dt * 14;
    this.spinV += Math.sign(this.spinV) * dt * 4;
    this.spin += this.spinV * dt;
    this.vy = Math.min(this.vy + 260 * dt, 260);
    this.vx *= Math.pow(0.6, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const P = this.world.particles;
    P.add({ kind: 'smoke', x: this.cx + fxRng.range(-4, 4), y: this.cy, vx: fxRng.range(-10, 10), vy: fxRng.range(-20, 0), life: fxRng.range(0.6, 1.0), color: '#3a363c', color2: '#1e1c22', size: 2, size2: 6, drag: 1 });
    P.add({ kind: 'smoke', x: this.cx + fxRng.range(-3, 3), y: this.cy - 4, vx: fxRng.range(-10, 10), vy: fxRng.range(-30, -10), life: fxRng.range(0.15, 0.3), color: '#ffe070', color2: '#f05a1a', size: 1.5, size2: 3, front: true });
    if (fxRng.chance(dt * 4)) this.world.explode(this.cx + fxRng.range(-16, 16), this.cy + fxRng.range(-8, 4), { radius: 8, damage: 0, team: 'player', size: 'small', shake: 1, sfx: 'explosion_small' });
    const fy = this.floorUnder(this.x);
    const c = this.world.camera;
    if ((fy !== null && this.y >= fy) || this.y > c.y + 260 || this.deathTime > 4) {
      if (fy !== null && this.y >= fy - 2) this.y = fy;
      const inWater = !!this.world.terrain.waterAt(this.x, this.y - 1);
      if (inWater) {
        this.world.particles.splash(this.x, this.y, 16);
        msfx(this, 'splash');
      }
      this.vx = 0;
      this.vy = 0;
      this.explodeNow();
      msfx(this, 'glass_break', { vol: 0.6 });
      if (inWater || fy === null || this.y > c.y + 250) this.deathDuration = this.deathTime + 0.9;
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.hidden) return;
    const flip = this.facing < 0;
    const flash = this.flash > 0;
    const spr = sprites.get('mach_heli');
    const x = this.x + this.joltX;
    const oy = PVY - FEET;
    if (this.wrecked) {
      spr.draw(g, x, this.y + oy + 3, WRECK, { flip });
      return;
    }
    const rf = Math.floor(this.rotorT) % ROTOR_N;
    if (this.crashing) {
      spr.draw(g, x, this.y + oy, ROTOR_N + rf, { flip, rot: this.spin, flash });
      return;
    }
    const ti = this.tilt > 0.07 ? 0 : this.tilt < -0.06 ? 2 : 1;
    // Rotor blur (translucent) behind the blade art.
    const hub = this.toWorld(HUB_X, HUB_Y + 0.5);
    const ca = Math.cos(this.tilt) * this.facing;
    const sa = Math.sin(this.tilt);
    blurLine(g, hub.x - ca * 33, hub.y - sa * 33, hub.x + ca * 33, hub.y + sa * 33, '#e4e8f0', 0.55, (rf % 3) + 1);
    const tr = this.toWorld(TR_X, TR_Y);
    blurRing(g, tr.x, tr.y, 4.5, '#e4e8f0', 0.5);
    spr.draw(g, x, this.y + oy, ti * ROTOR_N + rf, { flip, flash });
    const gp = this.gunPivot();
    sprites.get('mach_heli_gun').draw(g, gp.x, gp.y, angleFrame(this.gunAng, 0, GUN_MAX, GUN_N), { flip, flash });
    if (this.state === 'windup' && Math.floor(this.stateTime * 14) % 2 === 0) {
      const a = this.gunAng + this.tilt;
      const ang = this.facing > 0 ? a : Math.PI - a;
      sprites.get('mach_glow').draw(g, gp.x + Math.cos(ang) * 10, gp.y + Math.sin(ang) * 10, Math.min(2, Math.floor(this.stateTime * 5)));
    }
  }
}

registerEntity(
  'heli',
  'enemy',
  (_w, s) => new Heli(s.props, s.y === undefined),
  'HORNET attack helicopter (24 HP, flying): hovers near the top of the screen, telegraphed sweeping chin-gun bursts and bomb runs (whistle + ground marker); crashes when destroyed. props.facing, props.alt (skid screen-y, default 78), props.bombs (default true), props.drop. Spawn off-screen to fly in; y omitted = altitude band.',
);
