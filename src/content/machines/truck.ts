// truck — Legion troop truck (20 HP).
//  - Drives in from its side and stops once it is well on screen (or at props.stopX / near you).
//  - The rear flap rolls up, the tailgate drops, and props.troops (default 3) soldiers hop out
//    one by one (world.spawn of props.troop, default 'rifleman', behavior 'charge').
//  - Lingers a few seconds with the empty bed open (a juicy target), then backs out of sight.
//  - Rams you while driving fast (crush). Destroyed: fireball, everyone still aboard is flung
//    out, a wheel flies off, the canvas burns.
// props: facing (1|-1), troops (default 3), troop (entity type, default 'rifleman'),
//        stopX (world x to stop at), leave (default true), drop

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { VIEW_W } from '../../engine/renderer';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import type { Enemy } from '../../game/enemy';
import { MC, Machine, Pen, FlyingPart, cog, charr, wheel, drawHumanMask, rivetRow, cycleFrame, msfx, troopType, CREW_DRIVER } from './common';
import { RUSTCOAT } from '../../art/soldier';

const W = 78;
const H = 46;
const WHEEL_N = 4;
const F_HALF = 4;
const F_OPEN = 5;
const F_EMPTY = 6;
const WRECK = 7;
/** Rear of the bed (canvas x) where troops hop out. */
const REAR_X = 3;

function drawTruck(p: PixelArt, f: number): void {
  const wreck = f === WRECK;
  const driving = f < WHEEL_N;
  const bob = driving && f % 2 === 1 ? -1 : 0;
  const d = new Pen(p);
  const b = new Pen(p, 0, bob);
  const phase = driving ? (f / WHEEL_N) * (Math.PI / 2) : 0;
  // Wheels: rear tandem + front.
  wheel(d, 15, 38.5, 7, phase, { hub: MC.oliveL, bolts: 4 });
  wheel(d, 30, 38.5, 7, phase + 0.5, { hub: MC.oliveL, bolts: 4 });
  wheel(d, 63, 38.5, 7, phase + 1, { hub: MC.oliveL, bolts: 4 });
  // Chassis rail.
  b.rect(4, 33, 66, 3, MC.oliveDD);
  // ---- cargo bed sides
  b.poly([2, 26, 50, 26, 50, 34, 2, 34], MC.olive);
  b.rect(2, 26, 48, 1, MC.oliveLL);
  b.rect(2, 33, 48, 1, MC.oliveD);
  for (let x = 8; x < 50; x += 10) {
    b.rect(x, 27, 1, 6, MC.oliveD);
    b.rect(x + 1, 27, 1, 6, MC.oliveL);
  }
  b.rect(4, 29, 44, 1, MC.rust);
  // ---- canvas tarp over hoops
  const openK = f === F_HALF ? 0.5 : f === F_OPEN || f === F_EMPTY ? 1 : 0;
  b.poly([2, 26, 2, 12, 5, 8, 47, 8, 50, 12, 50, 26], MC.canvas);
  b.rect(5, 8, 42, 1, MC.canvasL);
  b.poly([2, 12, 5, 8, 6, 9, 3, 13], MC.canvasL);
  for (let x = 10; x < 48; x += 9) {
    b.rect(x, 9, 1, 17, MC.canvasD);
    b.rect(x + 1, 9, 1, 17, MC.canvasL);
  }
  // Rope ties along the bottom edge.
  for (let x = 5; x < 49; x += 5) b.px(x, 25, MC.canvasDD);
  cog(b, 27, 17, 4, MC.brassD);
  cog(b, 27, 17, 3.2, MC.brass);
  // Rear opening: interior shows as the flap rolls up.
  if (openK > 0) {
    const top = 11;
    const bot = 26;
    const rolled = top + Math.round((bot - top) * (1 - openK));
    b.rect(2, top, 7, bot - top, '#1e1a1c');
    if (f !== F_EMPTY) {
      // Troopers waiting inside (helmets + shoulders).
      for (const [hx, hy] of [
        [5, 20],
        [9, 19],
      ] as [number, number][]) {
        b.circle(hx, hy, 2.6, RUSTCOAT.headgearColor!);
        b.px(hx - 1, hy - 2, MC.oliveLL);
        b.rect(hx - 2, hy + 2, 5, 3, RUSTCOAT.shirt);
        b.rect(hx + 1, hy, 1, 1, RUSTCOAT.skin);
      }
    }
    // Rolled flap.
    b.cap(2, rolled, 9, rolled, 1.6, MC.canvasD);
    b.cap(2, rolled - 0.6, 9, rolled - 0.6, 0.6, MC.canvasL);
    // Tailgate hinged down.
    b.rect(-1, 33, 4, 2, MC.olive);
    b.rect(-1, 33, 4, 1, MC.oliveL);
  } else {
    // Closed flap + tailgate.
    b.rect(2, 12, 2, 14, MC.canvasD);
    b.rect(1, 26, 3, 8, MC.oliveD);
    b.px(1, 28, MC.oliveL);
  }
  // ---- cab
  b.poly([50, 16, 62, 16, 66, 24, 76, 25, 77, 34, 50, 34], MC.olive);
  b.rect(50, 16, 12, 1, MC.oliveLL);
  b.rect(50, 17, 1, 16, MC.oliveL);
  b.poly([66, 24, 76, 25, 76, 26, 66, 25], MC.oliveLL);
  // Side window with the driver behind it.
  b.poly([53, 18, 61, 18, 64, 24, 53, 24], MC.glassD);
  b.poly([54, 19, 60, 19, 62, 23, 54, 23], MC.glass);
  if (!wreck) {
    const [fx, fy] = b.t(58, 47);
    drawHumanMask(p, fx, fy, { hip: [0, -13], footB: [-2, 0], footF: [2, 0], part: 'upper', gun: 'none', handF: [7, 2], handB: [6, 3], lean: 1 }, CREW_DRIVER, [MC.glassD, MC.glass]);
    b.px(60, 19, MC.glassL);
    b.px(61, 20, MC.glassL);
  }
  // Door seam + handle, hood grille, bumper, headlight.
  b.rect(52, 25, 1, 8, MC.oliveD);
  b.rect(62, 25, 1, 8, MC.oliveD);
  b.rect(58, 27, 2, 1, MC.steelL);
  for (let gy = 27; gy <= 33; gy += 2) b.rect(75, gy, 2, 1, MC.oliveDD);
  b.rect(74, 33, 4, 3, MC.steel);
  b.rect(74, 33, 4, 1, MC.steelL);
  b.circle(72.5, 27, 1.5, MC.steelD);
  b.px(72, 26, MC.glassL);
  rivetRow(b, 54, 74, 34, 5, MC.olive);
  // Fenders.
  b.poly([54, 34, 56, 30.5, 70, 30.5, 72, 34], MC.oliveD);
  b.rect(56, 30.5, 14, 1, MC.olive);
  b.poly([6, 34, 8, 31.5, 37, 31.5, 39, 34], MC.oliveD);
  // Exhaust stack behind the cab.
  b.rect(48, 6, 2, 20, MC.steelD);
  b.rect(48, 6, 1, 20, MC.steel);
  b.rect(47, 5, 4, 2, MC.steelD);
  if (wreck) charr(p, 13, 0.02);
}

sprites.define({
  name: 'mach_truck',
  w: W,
  h: H,
  frames: WRECK + 1,
  draw: (p, f) => drawTruck(p, f),
});

export class Truck extends Machine {
  wheelT = 0;
  troops: number;
  troop: string;
  stopX: number | null;
  leave: boolean;
  dropT = 0;
  engineT = 0;
  braking = 0;
  unloaded: Enemy[] = [];

  constructor(props: Record<string, any> = {}) {
    super();
    this.w = 26;
    this.h = 38;
    this.bodyW = 70;
    this.hp = this.maxHp = 20;
    this.scoreValue = 1000;
    this.troops = typeof props.troops === 'number' ? Math.max(0, Math.floor(props.troops)) : 3;
    this.troop = troopType(props.troop);
    this.stopX = typeof props.stopX === 'number' ? props.stopX : null;
    this.leave = props.leave !== false;
    this.boom = 'huge';
    this.blast = { radius: 36, damage: 5 };
    this.crewOut = ['mach_crew'];
    this.smokeAt = [
      [26, -26],
      [-10, -32],
      [10, -10],
    ];
    this.debris = [MC.olive, MC.oliveD, MC.canvas, MC.canvasD, MC.steel, MC.rust];
    this.wreckTime = 3;
  }

  override spawned(): void {
    super.spawned();
    this.setState('drive');
  }

  /** Where troops hop out (world). */
  rear(): { x: number; y: number } {
    return { x: this.x + (REAR_X - W / 2 - 2) * this.facing, y: this.y - 14 };
  }

  think(dt: number): void {
    const t = this.target();
    const c = this.world.camera;
    if (this.braking > 0) this.braking -= dt;
    let wantV = 0;
    switch (this.state) {
      case 'drive': {
        wantV = this.facing * 78;
        // Stop: explicit x, near the player, or once the whole truck is well inside the view.
        const inView = this.facing < 0 ? this.x + this.bw / 2 < c.x + VIEW_W - 24 : this.x - this.bw / 2 > c.x + 24;
        const near = t ? Math.abs(t.x - this.x) < 150 + this.bw / 2 : false;
        const stop = this.stopX !== null ? (this.x - this.stopX) * this.facing >= 0 : inView && (near || (this.facing < 0 ? this.x < c.x + VIEW_W * 0.72 : this.x > c.x + VIEW_W * 0.28));
        if (stop || this.hitWall || this.ledgeAhead(this.facing) || this.wallAhead(this.facing)) {
          this.braking = 0.4;
          this.world.particles.dust(this.x + this.facing * 26, this.y, 6);
          this.world.particles.dust(this.x - this.facing * 20, this.y, 5);
          this.setState(this.troops > 0 ? 'open' : 'parked');
        }
        break;
      }
      case 'open':
        if (this.stateTime > 0.6 && Math.abs(this.vx) < 5) {
          this.setState('unload');
          this.dropT = 0;
        }
        break;
      case 'unload':
        this.dropT -= dt;
        if (this.dropT <= 0 && this.troops > 0) {
          this.dropT = 0.6;
          this.unloadOne();
        }
        if (this.troops <= 0 && this.dropT <= 0) this.setState('parked');
        break;
      case 'parked':
        if (this.leave && this.stateTime > 3.2) this.setState('leave');
        break;
      case 'leave':
        wantV = -this.facing * 55;
        if (!this.onScreen(30)) {
          this.goGhost();
          return;
        }
        // Blocked behind: stay parked (still a target).
        if (this.ledgeAhead(-this.facing) || this.wallAhead(-this.facing)) {
          this.leave = false;
          this.setState('parked');
        }
        break;
      case 'ghost':
        // Gone from view: keep an arena wave blocked until the troops we brought are dead.
        if (this.unloaded.every((e) => e.dead || !e.hittable) || this.stateTime > 25) this.remove();
        return;
    }
    const acc = this.braking > 0 ? 260 : 110;
    this.vx += Math.sign(wantV - this.vx) * Math.min(Math.abs(wantV - this.vx), acc * dt);
    this.moveAndCollide(dt);
    this.wheelT += (this.vx * this.facing * dt) / 4;
    if (Math.abs(this.vx) > 40) this.touch({ x: this.x + (this.vx > 0 ? this.bw / 2 - 14 : -this.bw / 2 - 2), y: this.y - 26, w: 16, h: 26 }, 4, 'crush', 0.7);
    this.engineT -= dt;
    if (this.engineT <= 0 && this.onScreen(30)) {
      this.engineT = Math.abs(this.vx) > 20 ? 0.5 : 1.0;
      msfx(this, 'engine', { vol: 0.35, pitch: Math.abs(this.vx) > 20 ? 0.9 : 0.7 });
      this.world.particles.add({ kind: 'smoke', x: this.x + 10 * this.facing, y: this.y - 41, vx: -this.facing * 8 - this.vx * 0.3, vy: -22, life: 0.8, color: '#6a6670', color2: '#3a3840', size: 1.5, size2: 4, drag: 1 });
    }
    if (Math.abs(this.vx) > 40 && fxRng.chance(dt * 14)) this.world.particles.dust(this.x - Math.sign(this.vx) * 24, this.y, 1);
  }

  /** Left the screen: invisible, harmless, but still blocking the wave while our troops live. */
  private goGhost(): void {
    this.setState('ghost');
    this.hittable = false;
    this.persistent = true;
    this.vx = 0;
    this.world.invalidateTargets();
  }

  private unloadOne(): void {
    const r = this.rear();
    this.troops--;
    const e = this.world.spawn(this.troop, r.x, r.y, { behavior: 'charge', facing: this.facing });
    if (e) {
      e.vy = -150;
      e.vx = -this.facing * 50;
      this.unloaded.push(e as Enemy);
      e.waveId = this.waveId;
    }
    this.world.particles.dust(r.x, this.y, 3);
    msfx(this, 'enemy_alert', { vol: 0.5 });
  }

  override onExplode(): void {
    this.vy = -120;
    this.onGround = false;
    this.world.add(new FlyingPart('mach_wheel', 0, this.x + this.facing * 24, this.y - 8, this.facing * fxRng.range(60, 100), -fxRng.range(220, 280), fxRng.range(8, 12), { life: 2.2 }));
  }

  override explodeNow(): void {
    // Make sure the passengers are part of the flung crew before the base class throws them.
    if (!this.wrecked && this.troops > 0) {
      for (let i = 0; i < this.troops; i++) this.crewOut.push('mach_crew');
      this.troops = 0;
    }
    super.explodeNow();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.hidden) return;
    const flip = this.facing < 0;
    const flash = this.flash > 0;
    const x = this.x + this.joltX;
    const spr = sprites.get('mach_truck');
    if (this.wrecked) {
      spr.draw(g, x, this.y, WRECK, { flip });
      return;
    }
    let f: number;
    if (this.state === 'ghost') return;
    if (this.state === 'drive' || this.state === 'leave') {
      f = cycleFrame(this.wheelT, WHEEL_N);
    } else if (this.state === 'open') f = this.stateTime < 0.3 ? F_HALF : F_OPEN;
    else if (this.state === 'unload') f = this.troops > 0 ? F_OPEN : F_EMPTY;
    else f = this.troops > 0 && this.state !== 'parked' ? F_OPEN : F_EMPTY;
    if (this.state === 'parked' && this.unloaded.length === 0) f = 0;
    const dip = this.braking > 0 ? 1 : 0;
    spr.draw(g, x, this.y + dip, f, { flip, flash });
  }
}

registerEntity(
  'truck',
  'enemy',
  (_w, s) => new Truck(s.props),
  "Troop truck (20 HP): drives in, stops on screen (props.stopX), opens the back and unloads props.troops (default 3) of props.troop (default 'rifleman'), then backs out (props.leave, default true); rams while fast. props.facing, props.drop",
);
