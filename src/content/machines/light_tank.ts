// light_tank — "STOMPER": the Legion's tracked light tank (30 HP).
//  - Advances to a comfortable range and keeps it (backs off if you get too close).
//  - Cannon: the turret visibly traverses to the firing elevation, the muzzle glows, then it lobs
//    an arcing shell at where you stood (move and it misses).
//  - Hull MG: short telegraphed bursts when you are close and level with it.
//  - Treads crush (damage kind 'crush') when it drives into you: jump over it.
//  - Destroyed: the turret pops off spinning, the commander is flung out, the hull burns.
// props: facing (1|-1), behavior: 'advance' (default) | 'hold' (stays put), drop

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { registerEntity } from '../../game/registry';
import { Shell } from '../../game/projectile';
import { MC, Machine, Pen, FlyingPart, plate, rivetRow, cog, treads, charr, ballistic, angleFrame, cycleFrame, msfx, drawHumanClip, CREW_DRIVER } from './common';

const HULL_W = 60;
const HULL_H = 25;
const TREAD_FRAMES = 3;
const HULL_WRECK = TREAD_FRAMES;

const TUR_W = 46;
const TUR_H = 28;
const TUR_OX = 13;
const TUR_OY = 26;
/** Turret base position relative to the tank's feet (facing right). */
const TUR_DX = -4;
const TUR_DY = -22;
/** Barrel pivot in turret-local coords and length. */
const PIV_X = 25;
const PIV_Y = 20;
const BARREL = 19;
const ELEV_N = 8;
const ELEV_MAX = (56 * Math.PI) / 180;
const TUR_WRECK = ELEV_N;

function drawHull(d: Pen, cycle: number): void {
  // Exhaust muffler at the back.
  d.cap(1.5, 7.5, 6, 7.5, 1.6, MC.steelD);
  d.cap(2, 7, 5.5, 7, 0.6, MC.steelL);
  d.rect(0, 6, 1, 3, MC.steelDD);
  // Tread belt.
  treads(d, 3, 14, 54, 11, cycle, { wheels: 6 });
  // Hull body (side view: rear plate, deck, sloped glacis).
  d.poly([5, 12, 5, 5, 8, 3, 41, 3, 55, 10, 55, 12], MC.olive);
  // Glacis plate catches light along its upper edge.
  d.poly([41, 3, 55, 10, 52, 10, 40, 4.5], MC.oliveL);
  d.line(42, 4, 53, 9.5, MC.oliveLL);
  // Deck + rear edge highlights.
  d.rect(8, 3, 33, 1, MC.oliveLL);
  d.rect(5, 5, 1, 6, MC.oliveL);
  d.px(6, 4, MC.oliveL);
  d.px(7, 3, MC.oliveL);
  // Engine grille on the rear deck.
  for (let gx = 9; gx <= 19; gx += 2) d.rect(gx, 4, 1, 2, MC.oliveDD);
  d.rect(9, 6, 11, 1, MC.oliveD);
  // Camo blotches.
  d.ellipse(16, 8.5, 4.5, 1.6, MC.camo);
  d.ellipse(35, 6.5, 3.5, 1.4, MC.camo);
  d.ellipse(44, 8.6, 2.5, 1.0, MC.camo);
  // Side shadow under the sponson + rust stripe.
  d.rect(6, 10, 47, 2, MC.oliveD);
  d.rect(9, 9, 26, 1, MC.rust);
  d.rect(9, 9, 1, 1, MC.rustL);
  // Plate seams with rivets.
  for (const sx of [21, 36]) {
    d.rect(sx, 4, 1, 6, MC.oliveD);
    d.rect(sx + 1, 4, 1, 6, MC.oliveL);
    d.px(sx - 1, 5, MC.oliveLL);
    d.px(sx - 1, 8, MC.oliveLL);
  }
  // Legion cog on the side.
  cog(d, 28.5, 6.5, 2.4);
  // Jerry can riding on the rear deck.
  plate(d, 6, 0, 5, 4, MC.rust, { hi: 0.3 });
  d.rect(7, 1, 3, 1, MC.rustD);
  // Spare track links bolted to the glacis.
  for (let i = 0; i < 3; i++) {
    const sx = 43 + i * 3;
    const sy = 5 + i * 1.5;
    d.rect(sx, sy, 2, 2, MC.treadL);
    d.px(sx, sy, MC.treadLL);
  }
  // Headlight + hull MG ball mount on the glacis.
  d.circle(49.5, 6.5, 1.4, MC.steelD);
  d.px(49, 6, MC.glassL);
  d.circle(46, 9, 1.9, MC.steelD);
  d.circle(45.6, 8.6, 1, MC.steel);
  d.cap(47, 9, 52, 9, 0.7, MC.steel);
  // Track guard (fender) with rivets.
  d.poly([1, 13, 4, 11, 56, 11, 59, 13, 59, 15, 1, 15], MC.oliveD);
  d.rect(4, 11, 52, 1, MC.oliveL);
  d.px(3, 12, MC.oliveL);
  d.rect(1, 14, 58, 1, MC.oliveDD);
  rivetRow(d, 6, 54, 12, 6, MC.oliveD);
  // Tow hook.
  d.rect(0, 12, 2, 2, MC.steelD);
}

function drawTurret(p: import('../../engine/pixelart').PixelArt, d: Pen, elev: number, wreck: boolean): void {
  const a = -elev;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const at = (t: number, s = 0): [number, number] => [PIV_X + cs * t - sn * s, PIV_Y + sn * t + cs * s];
  // Barrel (behind the mantlet).
  if (!wreck) {
    const [x0, y0] = at(0);
    const [x1, y1] = at(BARREL);
    d.cap(x0, y0, x1, y1, 1.5, MC.steel);
    const [hx0, hy0] = at(2, -0.9);
    const [hx1, hy1] = at(BARREL - 3, -0.9);
    d.cap(hx0, hy0, hx1, hy1, 0.45, MC.steelLL);
    // Bore evacuator + muzzle brake.
    const [ex0, ey0] = at(8);
    const [ex1, ey1] = at(11);
    d.cap(ex0, ey0, ex1, ey1, 2, MC.steel);
    d.cap(...at(8.5, -1), ...at(10.5, -1), 0.6, MC.steelL);
    const [mx0, my0] = at(BARREL - 3);
    const [mx1, my1] = at(BARREL);
    d.cap(mx0, my0, mx1, my1, 2.1, MC.steelD);
    d.cap(...at(BARREL - 2.5, -1.1), ...at(BARREL - 0.5, -1.1), 0.5, MC.steel);
  } else {
    // Bent, broken barrel stub.
    d.cap(PIV_X, PIV_Y, PIV_X + 7, PIV_Y + 2, 1.5, MC.steel);
    d.cap(PIV_X + 7, PIV_Y + 2, PIV_X + 11, PIV_Y + 5, 1.3, MC.steel);
  }
  // Open hatch lid standing behind the commander.
  if (!wreck) {
    d.poly([4, 15, 3, 8, 5, 7.5, 6, 15], MC.oliveD);
    d.rect(4, 9, 1, 5, MC.oliveL);
  }
  // Commander peeking out of the hatch (only above the rim shows).
  if (!wreck) drawHumanClip(p, d.ox + 10, d.oy + 41.5, { hip: [0, -13], footB: [-2, 0], footF: [2, 0], part: 'upper', gun: 'none', handF: [3, 4], handB: [-3, 4], lean: 0.5 }, CREW_DRIVER, 0, 14);
  // Turret ring shadow.
  d.rect(1, 23, 24, 3, MC.oliveDD);
  // Turret body (rounded cast dome with a rear bustle).
  d.poly([0, 23, 0, 19, 3, 16, 21, 15, 25, 17, 27, 20, 26, 23], MC.olive);
  d.rect(4, 15, 17, 1, MC.oliveLL);
  d.poly([0, 19, 3, 16, 4, 17, 1, 20], MC.oliveL);
  d.rect(1, 21, 25, 2, MC.oliveD);
  d.ellipse(11, 19, 3.5, 1.4, MC.camo);
  d.rect(14, 18, 6, 1, MC.rust);
  rivetRow(d, 3, 22, 21, 4, MC.oliveD);
  // Hatch rim (in front of the commander).
  plate(d, 6, 13, 9, 3, MC.oliveD, { hi: 0.35 });
  // Periscope block.
  d.rect(17, 13, 3, 2, MC.steelD);
  d.px(18, 13, MC.glass);
  // Mantlet.
  d.circle(PIV_X, PIV_Y, 3.2, MC.oliveD);
  d.circle(PIV_X - 0.6, PIV_Y - 0.6, 2.2, MC.olive);
  d.px(PIV_X - 2, PIV_Y - 2, MC.oliveL);
  // Antenna whip.
  d.line(2, 15, 0, 3, MC.steelD);
  d.px(0, 2, MC.red);
}

sprites.define({
  name: 'mach_tank_hull',
  w: HULL_W,
  h: HULL_H,
  frames: TREAD_FRAMES + 1,
  draw: (p, f) => {
    const d = new Pen(p);
    drawHull(d, f >= TREAD_FRAMES ? 0 : f / TREAD_FRAMES);
    if (f === HULL_WRECK) {
      charr(p, 11);
      // Gaping turret ring.
      p.ellipse(26 + 1, 3.5 + 1, 9, 1.8, '#1a1418');
      p.rect(27 - 9, 3 + 1, 18, 1, '#3a2a22');
    }
  },
});

sprites.define({
  name: 'mach_tank_turret',
  w: TUR_W,
  h: TUR_H,
  ox: TUR_OX,
  oy: TUR_OY,
  frames: ELEV_N + 1,
  draw: (p, f) => {
    const d = new Pen(p);
    const wreck = f === TUR_WRECK;
    drawTurret(p, d, wreck ? 0 : (f / (ELEV_N - 1)) * ELEV_MAX, wreck);
    if (wreck) charr(p, 5);
  },
});

export class LightTank extends Machine {
  behavior: string;
  treadCycle = 0;
  /** Current / wanted cannon elevation (radians, up positive). */
  elev = 0.1;
  wantElev = 0.1;
  cannonT = 0;
  mgT = 0;
  burst = 0;
  burstT = 0;
  recoil = 0;
  turnT = 0;
  treadSfxT = 0;
  exhaustT = 0;
  private shot: { vx: number; vy: number; tx: number } | null = null;

  constructor(props: Record<string, any> = {}) {
    super();
    this.w = 26;
    this.h = 32;
    this.bodyW = 50;
    this.hp = this.maxHp = 30;
    this.scoreValue = 1500;
    this.behavior = props.behavior ?? 'advance';
    this.boom = 'large';
    this.blast = { radius: 34, damage: 5 };
    this.crewOut = ['mach_crew'];
    this.smokeAt = [
      [-12, -16],
      [4, -24],
      [-20, -12],
    ];
    this.wreckTime = 2.8;
    this.stepUp = 7;
  }

  override spawned(): void {
    super.spawned();
    this.cannonT = this.fireDelay(1.6);
    this.mgT = this.fireDelay(1.2);
    this.setState('drive');
  }

  /** Barrel tip in world coordinates for the current elevation. */
  muzzle(): { x: number; y: number } {
    const a = -this.elev;
    const lx = TUR_DX + (PIV_X - TUR_OX) + Math.cos(a) * (BARREL + 1);
    const ly = TUR_DY + (PIV_Y - TUR_OY) + Math.sin(a) * (BARREL + 1);
    return { x: this.x + lx * this.facing, y: this.y + ly };
  }

  think(dt: number): void {
    const t = this.target();
    const dx = t ? t.x - this.x : 0;
    const adx = Math.abs(dx);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 14);

    // Turn to face a target that got behind us (brief pause first).
    if (t && Math.sign(dx) !== this.facing && adx > 30 && this.state !== 'charge') {
      this.turnT += dt;
      if (this.turnT > 0.6) {
        this.facing = this.facing > 0 ? -1 : 1;
        this.turnT = 0;
        this.world.particles.dust(this.x - this.facing * 20, this.y, 4);
      }
    } else this.turnT = 0;

    // Movement: keep a comfortable range (and inside the view while on screen).
    let want = 0;
    if (t && this.behavior !== 'hold' && this.state !== 'charge') {
      if (adx > 200) want = Math.sign(dx);
      else if (adx < 110) want = -Math.sign(dx);
      if (want !== 0 && Math.sign(dx) !== this.facing && want === Math.sign(dx)) want = 0;
    } else if (!t && this.behavior !== 'hold' && !this.onScreen(-20)) {
      want = this.facing;
    }
    if (want !== 0 && (this.ledgeAhead(want) || this.wallAhead(want))) want = 0;
    if (want !== 0 && this.onScreen(0)) {
      const [lo, hi] = this.viewClamp(this.bw / 2 + 4);
      if ((want < 0 && this.x < lo) || (want > 0 && this.x > hi)) want = 0;
    }
    const speed = want === this.facing ? 26 : 19;
    const target = want * speed;
    this.vx += Math.sign(target - this.vx) * Math.min(Math.abs(target - this.vx), 80 * dt);

    // Cannon: traverse, charge (glow), fire.
    switch (this.state) {
      case 'drive':
        this.wantElev = 0.12 + Math.sin(this.age * 0.8) * 0.06;
        this.cannonT -= dt;
        if (this.cannonT <= 0 && t && this.canAttack() && Math.sign(dx) === this.facing && adx > 50) {
          this.planShot();
          this.setState('aim');
        }
        break;
      case 'aim':
        if (Math.abs(this.elev - this.wantElev) < 0.03 || this.stateTime > 1.2) this.setState('charge');
        break;
      case 'charge':
        if (this.stateTime > 0.5) {
          this.fireCannon();
          this.cannonT = this.fireDelay(2.8);
          this.setState('drive');
        }
        break;
    }
    // Turret traverse speed (radians/s).
    const de = this.wantElev - this.elev;
    this.elev += Math.sign(de) * Math.min(Math.abs(de), 1.1 * dt);

    // Hull MG: close-range telegraphed bursts.
    this.mgT -= dt;
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burst--;
        this.burstT = 0.13;
        const mx = this.x + this.facing * 24;
        const my = this.y - 16;
        let ang = this.facing > 0 ? 0 : Math.PI;
        if (t) {
          const dy = t.cy - my;
          if (Math.abs(dy) < Math.abs(t.cx - mx) * 0.4) ang = Math.atan2(dy, t.cx - mx);
        }
        this.shoot(mx, my, { angle: ang, speed: 150 });
        this.world.effect('muzzle_flash', mx, my, { fps: 30, flip: this.facing < 0 });
        msfx(this, 'turret_fire', { vol: 0.5 });
      }
    } else if (this.mgT <= 0 && t && this.canAttack() && Math.sign(dx) === this.facing && adx < 120 && Math.abs(t.cy - (this.y - 16)) < 26 && this.state === 'drive') {
      this.burst = 3;
      this.burstT = 0.4; // wind-up (glow shown while burstT is long)
      this.mgT = this.fireDelay(2.2);
    }

    this.moveAndCollide(dt);
    // Treads + exhaust + crush.
    const moving = Math.abs(this.vx) > 4;
    this.treadCycle += (this.vx * this.facing * dt) / 3;
    if (moving) {
      this.touch({ x: this.x - this.bw / 2 - 2, y: this.y - 12, w: this.bw + 4, h: 12 }, 6, 'crush', 0.6);
      this.treadSfxT -= dt;
      if (this.treadSfxT <= 0 && this.onScreen(20)) {
        this.treadSfxT = 0.42;
        msfx(this, 'tank_tread', { vol: 0.35 });
      }
      if (fxRng.chance(dt * 6)) this.world.particles.dust(this.x - this.facing * fxRng.range(-20, 22), this.y, 1);
    }
    this.exhaustT -= dt;
    if (this.exhaustT <= 0 && this.onScreen(20)) {
      this.exhaustT = moving ? 0.12 : 0.3;
      const ex = this.x - this.facing * 30;
      this.world.particles.add({ kind: 'smoke', x: ex, y: this.y - 17, vx: -this.facing * fxRng.range(8, 18), vy: fxRng.range(-14, -6), life: fxRng.range(0.4, 0.7), color: '#6a6670', color2: '#3a3840', size: 1, size2: 3, drag: 1.2 });
    }
  }

  private planShot(): void {
    const t = this.target();
    if (!t) return;
    const m = this.muzzle();
    const g = 220;
    const dist = Math.abs(t.x - m.x);
    const T = Math.max(0.75, Math.min(1.45, 0.5 + dist / 300)) / this.world.difficulty.enemyShotSpeed;
    const v = ballistic(m.x, m.y, t.x, t.y - 2, g, T);
    this.shot = { vx: v.vx, vy: v.vy, tx: t.x };
    // Elevation relative to facing (up positive).
    this.wantElev = Math.max(0, Math.min(ELEV_MAX, Math.atan2(-v.vy, Math.abs(v.vx))));
  }

  private fireCannon(): void {
    if (!this.canAttack() || !this.shot) return;
    const m = this.muzzle();
    // Re-aim from the actual barrel tip, keeping the planned landing spot.
    const t = this.target();
    const g = 220;
    const tx = this.shot.tx;
    const ty = t ? t.y - 2 : this.y;
    const T = Math.max(0.75, Math.min(1.45, 0.5 + Math.abs(tx - m.x) / 300)) / this.world.difficulty.enemyShotSpeed;
    const v = ballistic(m.x, m.y, tx, ty, g, T);
    this.world.add(new Shell({ team: 'enemy', owner: this, x: m.x, y: m.y, vx: v.vx, vy: v.vy, gravity: g, radius: 20, damage: 5, sprite: 'mach_shell' }));
    const fx = this.world.effect('mach_flash', m.x, m.y, { fps: 24 });
    fx.rot = Math.atan2(v.vy, v.vx);
    this.world.particles.smokePuffs(m.x, m.y, 3, 3, '#a8a098', '#6a6470');
    this.recoil = 3;
    this.jolt = 0.08;
    this.world.shake(1.5, 0.15);
    msfx(this, 'tank_cannon');
    this.shot = null;
  }

  override onExplode(): void {
    const tx = this.x + TUR_DX * this.facing;
    const ty = this.y + TUR_DY - 6;
    this.world.add(new FlyingPart('mach_tank_turret', TUR_WRECK, tx, ty, -this.facing * fxRng.range(30, 70), -fxRng.range(260, 320), fxRng.range(5, 9) * (fxRng.chance(0.5) ? 1 : -1), { flip: this.facing < 0, life: 2.6 }));
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.hidden) return;
    const flip = this.facing < 0;
    const flash = this.flash > 0;
    const hull = sprites.get('mach_tank_hull');
    const rx = -this.facing * Math.round(this.recoil * 0.4);
    const x = this.x + this.joltX + rx;
    if (this.wrecked) {
      hull.draw(g, x, this.y, HULL_WRECK, { flip });
      return;
    }
    const tf = cycleFrame(this.treadCycle, TREAD_FRAMES);
    const bob = Math.abs(this.vx) > 4 && cycleFrame(this.treadCycle * 2, 2) === 0 ? 1 : 0;
    hull.draw(g, x, this.y, tf, { flip, flash });
    const ef = angleFrame(this.elev, 0, ELEV_MAX, ELEV_N);
    const tx = x + TUR_DX * this.facing - this.facing * Math.round(this.recoil * 0.6);
    sprites.get('mach_tank_turret').draw(g, tx, this.y + TUR_DY + bob, ef, { flip, flash });
    // Telegraphs.
    if (this.state === 'charge' && Math.floor(this.stateTime * 14) % 2 === 0) {
      const m = this.muzzle();
      sprites.get('mach_glow').draw(g, m.x, m.y + bob, Math.min(2, Math.floor(this.stateTime * 6)));
    }
    if (this.burst > 0 && this.burstT > 0.15 && Math.floor(this.burstT * 16) % 2 === 0) {
      sprites.get('mach_glow').draw(g, this.x + this.facing * 23, this.y - 16, 0);
    }
  }
}

registerEntity(
  'light_tank',
  'enemy',
  (_w, s) => new LightTank(s.props),
  'STOMPER light tank (30 HP): keeps range, telegraphed arcing cannon shells + close hull-MG bursts, treads crush. props.facing 1|-1, props.behavior advance|hold, props.drop',
);
