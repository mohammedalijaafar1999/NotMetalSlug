// gunboat — Legion patrol boat (26 HP).
//  - Floats on the water body it spawns in (bobbing, bow wake), patrolling inside it and keeping
//    its distance from you. With no water under it, it sits beached on the ground and still fights.
//  - Deck gun: traverses, the muzzle glows, then an arcing shell onto the shore.
//  - Bridge MG: short telegraphed bursts when you come close.
//  - Destroyed: explodes, the crew is thrown overboard and the hull sinks (or burns on land).
// props: facing (1|-1), drop

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import { Shell } from '../../game/projectile';
import type { Water } from '../../game/terrain';
import { MC, Machine, Pen, FlyingPart, plate, rivetRow, cog, charr, drawHumanMask, ballistic, angleFrame, msfx, CREW_SAILOR } from './common';

const W = 90;
const H = 42;
/** Keel depth below the water surface. */
const DRAFT = 9;
const WRECK = 2;
/** Deck gun pivot (canvas) and its sprite. */
const GUN_X = 66;
const GUN_Y = 16;
const GUN_N = 6;
const GUN_MAX = 0.95;
const GUN_LEN = 15;
/** Bridge MG port (canvas). */
const MG_X = 50;
const MG_Y = 15;

function drawBoat(p: PixelArt, f: number): void {
  const d = new Pen(p);
  const wreck = f === WRECK;
  // Stern flag pole + flag (waves between frames).
  d.rect(5, 2, 1, 22, MC.steelD);
  const fw = f === 1 ? 1 : 0;
  d.poly([6, 2, 15, 3 + fw, 14, 5.5, 15, 8 - fw, 6, 7], MC.rust);
  d.poly([6, 2, 15, 3 + fw, 14.5, 4, 6, 3], MC.rustL);
  cog(d, 10, 4.8, 1.5);
  // Radar mast.
  d.rect(36, 0, 1, 9, MC.steelD);
  d.rect(32, 1, 9, 2, MC.steel);
  d.rect(32, 1, 9, 1, MC.steelL);
  // Exhaust stack.
  plate(d, 20, 6, 5, 9, MC.navyD, { hi: 0.3 });
  d.rect(20, 7, 5, 1, MC.rust);
  // Bridge cabin.
  plate(d, 24, 8, 26, 15, MC.navy, { hi: 0.25 });
  d.rect(24, 8, 26, 1, MC.navyL);
  d.rect(22, 7, 30, 2, MC.navyD);
  d.rect(22, 7, 30, 1, MC.navyL);
  // Windows with the skipper behind the front one.
  for (const wx of [27, 34]) {
    d.rect(wx, 11, 5, 4, MC.glassD);
    d.rect(wx, 11, 4, 3, MC.glass);
  }
  d.poly([41, 11, 48, 11, 49, 15, 41, 15], MC.glassD);
  d.poly([42, 11, 47, 11, 48, 14, 42, 14], MC.glass);
  if (!wreck) {
    drawHumanMask(p, 44, 37, { hip: [0, -13], footB: [-2, 0], footF: [2, 0], part: 'upper', gun: 'none', handF: [5, 2], handB: [4, 3], lean: 0.5 }, CREW_SAILOR, [MC.glassD, MC.glass]);
    d.px(28, 11, MC.glassL);
    d.px(35, 11, MC.glassL);
  }
  // MG port under the front window.
  d.rect(MG_X - 2, MG_Y + 1, 3, 2, MC.black);
  d.cap(MG_X, MG_Y + 2, MG_X + 4, MG_Y + 2, 0.6, MC.steelD);
  // Life ring on the cabin side.
  d.circle(30, 19, 2.4, MC.white);
  d.circle(30, 19, 1.1, MC.navyD);
  d.px(28, 19, MC.red);
  d.px(32, 19, MC.red);
  // ---- hull
  // Upper hull (above the waterline).
  d.poly([1, 22, 74, 22, 88, 17, 86, 24, 80, 31, 6, 31, 2, 27], MC.navy);
  d.poly([1, 22, 74, 22, 88, 17, 87, 19, 74, 23.5, 2, 23.5], MC.navyL);
  // Cream boot stripe + rust-red bottom (mostly under water).
  d.poly([2, 27, 6, 31, 80, 31, 82, 29, 84, 27, 85, 25, 84, 26, 79, 28, 5, 28], MC.cream);
  d.poly([6, 31, 80, 31, 75, 38, 12, 38], MC.redD);
  d.poly([6, 31, 80, 31, 79, 32.5, 7, 32.5], MC.red);
  // Portholes.
  for (const hx of [14, 22, 56]) {
    d.circle(hx, 25.5, 1.4, MC.navyD);
    d.px(hx - 1, 25, MC.glassL);
  }
  // Deck railing + posts.
  d.rect(2, 19, 20, 1, MC.steelL);
  d.rect(52, 19, 22, 1, MC.steelL);
  for (const rx of [4, 10, 16, 54, 60, 72]) d.rect(rx, 19, 1, 3, MC.steelL);
  rivetRow(d, 6, 70, 24, 6, MC.navy);
  // Bow number + anchor.
  d.rect(76, 21, 5, 3, MC.brass);
  d.px(77, 22, MC.brassD);
  d.px(79, 22, MC.brassD);
  // Deck gun ring.
  plate(d, GUN_X - 5, GUN_Y + 3, 10, 3, MC.steel, { hi: 0.3 });
  if (wreck) charr(p, 41, 0.02);
}

sprites.define({
  name: 'mach_boat',
  w: W,
  h: H,
  frames: WRECK + 1,
  draw: (p, f) => drawBoat(p, f),
});

/** Deck gun with its shield (origin = pivot). */
sprites.define({
  name: 'mach_boat_gun',
  w: 30,
  h: 24,
  ox: 9,
  oy: 14,
  frames: GUN_N + 1,
  draw: (p, f) => {
    const d = new Pen(p);
    const a = f === GUN_N ? 0.4 : (f / (GUN_N - 1)) * GUN_MAX;
    const cs = Math.cos(-a);
    const sn = Math.sin(-a);
    const at = (t: number, s = 0): [number, number] => [9 + cs * t - sn * s, 14 + sn * t + cs * s];
    const [b0x, b0y] = at(0, -1);
    const [b1x, b1y] = at(GUN_LEN, -1);
    d.cap(b0x, b0y, b1x, b1y, 1.4, MC.steel);
    const [h0x, h0y] = at(2, -2);
    const [h1x, h1y] = at(GUN_LEN - 2, -2);
    d.cap(h0x, h0y, h1x, h1y, 0.4, MC.steelLL);
    const [m0x, m0y] = at(GUN_LEN - 3, -1);
    d.cap(m0x, m0y, b1x, b1y, 1.9, MC.steelD);
    // Shield housing.
    d.poly([1, 17, 1, 10, 4, 7, 12, 7, 15, 10, 16, 17], MC.navy);
    d.poly([1, 10, 4, 7, 12, 7, 12, 8, 4.5, 8, 2, 10.5], MC.navyL);
    d.rect(1, 15, 15, 2, MC.navyD);
    d.rect(5, 10, 4, 1, MC.black);
    if (f === GUN_N) charr(p, 2);
  },
});

export class Gunboat extends Machine {
  water: Water | null = null;
  baseY = 0;
  aim = 0.25;
  wantAim = 0.25;
  cannonT = 0;
  mgT = 0;
  burst = 0;
  burstT = 0;
  goal = 0;
  goalT = 0;
  sinkRot = 0;
  engineT = 0;
  private shot: { tx: number; ty: number } | null = null;

  constructor(props: Record<string, any> = {}) {
    super();
    this.w = 80;
    this.h = 30;
    this.hp = this.maxHp = 26;
    this.scoreValue = 1500;
    this.boom = 'huge';
    this.blast = { radius: 36, damage: 5 };
    this.crewOut = ['mach_crew_sailor', 'mach_crew_sailor'];
    this.debris = [MC.navy, MC.navyD, MC.navyL, MC.cream, MC.red, MC.steel];
    this.smokeAt = [
      [-22, -36],
      [0, -30],
      [20, -22],
    ];
    this.wreckTime = 2.6;
  }

  override spawned(): void {
    super.spawned();
    const T = this.world.terrain;
    // Find the water body under (or around) the spawn point.
    this.water = T.water.find((w) => this.x >= w.x && this.x < w.x + w.w && this.y >= w.y - 24 && this.y <= w.y + w.h) ?? null;
    if (this.water) {
      const ground = T.groundTopAt(this.x);
      this.baseY = Math.min(this.water.y + DRAFT, isFinite(ground) ? ground : Infinity);
      this.y = this.baseY;
      this.collideTerrain = false;
      this.gravityScale = 0;
    }
    this.goal = this.x;
    this.cannonT = this.fireDelay(1.5);
    this.mgT = this.fireDelay(1.0);
  }

  get floating(): boolean {
    return this.water !== null;
  }

  private canvasToWorld(cx: number, cy: number): { x: number; y: number } {
    return { x: this.x + (cx - W / 2) * this.facing, y: this.y + (cy - H) + DRAFT_OFFSET };
  }

  gunPivot(): { x: number; y: number } {
    return this.canvasToWorld(GUN_X, GUN_Y + 1);
  }

  muzzle(): { x: number; y: number } {
    const g = this.gunPivot();
    const a = -this.aim;
    return { x: g.x + Math.cos(a) * (GUN_LEN + 1) * this.facing, y: g.y + Math.sin(a) * (GUN_LEN + 1) - 1 };
  }

  think(dt: number): void {
    const t = this.target();
    // Face the player (boats turn slowly: only when well behind).
    if (t && Math.sign(t.x - this.x) !== this.facing && Math.abs(t.x - this.x) > 50) this.facing = this.facing > 0 ? -1 : 1;
    if (this.floating && this.water) {
      const w = this.water;
      // Patrol inside the water, keeping 140..220 px from the player.
      this.goalT -= dt;
      if (this.goalT <= 0 && t) {
        this.goalT = this.world.rng.range(1.5, 3);
        const want = t.x - this.facing * this.world.rng.range(140, 220);
        this.goal = want;
      }
      const lo = w.x + this.w / 2 + 4;
      const hi = w.x + w.w - this.w / 2 - 4;
      const goal = lo < hi ? Math.max(lo, Math.min(hi, this.goal)) : w.x + w.w / 2;
      const tv = Math.max(-32, Math.min(32, (goal - this.x) * 0.8));
      this.vx += Math.sign(tv - this.vx) * Math.min(Math.abs(tv - this.vx), 40 * dt);
      this.x += this.vx * dt;
      this.y = this.baseY + Math.sin(this.age * 2.2) * 1.2;
      // Bow wake.
      if (Math.abs(this.vx) > 6 && fxRng.chance(dt * 18)) {
        const bx = this.x + this.facing * (this.vx * this.facing > 0 ? 40 : -40);
        this.world.particles.splash(bx, w.y, 2, '#d8f0ff');
      }
    } else {
      this.vx = 0;
      this.moveAndCollide(dt);
    }
    // Deck gun.
    switch (this.state) {
      case 'idle':
        this.cannonT -= dt;
        this.wantAim = 0.25 + Math.sin(this.age) * 0.05;
        if (this.cannonT <= 0 && t && this.canAttack() && Math.sign(t.x - this.x) === this.facing) {
          const m = this.muzzle();
          const tx = t.x;
          const ty = t.y - 2;
          this.shot = { tx, ty };
          const v = this.solve(m.x, m.y, tx, ty);
          this.wantAim = Math.max(0, Math.min(GUN_MAX, Math.atan2(-v.vy, Math.abs(v.vx))));
          this.setState('aim');
        }
        break;
      case 'aim':
        if (Math.abs(this.aim - this.wantAim) < 0.04 || this.stateTime > 1.2) this.setState('charge');
        break;
      case 'charge':
        if (this.stateTime > 0.55) {
          this.fireCannon();
          this.cannonT = this.fireDelay(2.7);
          this.setState('idle');
        }
        break;
    }
    this.aim += Math.sign(this.wantAim - this.aim) * Math.min(Math.abs(this.wantAim - this.aim), 1.2 * dt);
    // Bridge MG.
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burst--;
        this.burstT = 0.12;
        this.fireMg();
      }
    } else {
      this.mgT -= dt;
      if (this.mgT <= 0 && t && this.canAttack() && Math.sign(t.x - this.x) === this.facing && Math.abs(t.x - this.x) < 170) {
        this.burst = 3;
        this.burstT = 0.42;
        this.mgT = this.fireDelay(2.4);
      }
    }
    this.engineT -= dt;
    if (this.engineT <= 0 && this.onScreen(20)) {
      this.engineT = 0.8;
      msfx(this, 'engine', { vol: 0.25, pitch: 0.75 });
    }
  }

  private solve(x0: number, y0: number, tx: number, ty: number): { vx: number; vy: number } {
    const T = Math.max(0.8, Math.min(1.5, 0.55 + Math.abs(tx - x0) / 300)) / this.world.difficulty.enemyShotSpeed;
    return ballistic(x0, y0, tx, ty, 220, T);
  }

  private fireCannon(): void {
    if (!this.canAttack() || !this.shot) return;
    const m = this.muzzle();
    const v = this.solve(m.x, m.y, this.shot.tx, this.shot.ty);
    this.world.add(new Shell({ team: 'enemy', owner: this, x: m.x, y: m.y, vx: v.vx, vy: v.vy, gravity: 220, radius: 20, damage: 5, sprite: 'mach_shell' }));
    const fx = this.world.effect('mach_flash', m.x, m.y, { fps: 24 });
    fx.rot = Math.atan2(v.vy, v.vx);
    this.world.particles.smokePuffs(m.x, m.y, 2, 3, '#a8a098', '#6a6470');
    msfx(this, 'tank_cannon', { vol: 0.85 });
    this.jolt = 0.08;
    this.shot = null;
  }

  private fireMg(): void {
    if (!this.canAttack()) return;
    const p = this.canvasToWorld(MG_X + 5, MG_Y + 2);
    const t = this.target();
    let ang = this.facing > 0 ? 0 : Math.PI;
    if (t) {
      const raw = Math.atan2(t.cy - p.y, Math.abs(t.cx - p.x) + 1);
      const a = Math.max(-0.3, Math.min(0.5, raw));
      ang = this.facing > 0 ? a : Math.PI - a;
    }
    this.shoot(p.x, p.y, { angle: ang, speed: 150 });
    const fx = this.world.effect('muzzle_flash', p.x, p.y, { fps: 30 });
    fx.rot = ang;
    msfx(this, 'turret_fire', { vol: 0.5 });
  }

  override onExplode(): void {
    const g = this.gunPivot();
    this.world.add(new FlyingPart('mach_boat_gun', GUN_N, g.x, g.y - 4, this.facing * fxRng.range(30, 70), -fxRng.range(230, 290), fxRng.range(6, 9), { flip: this.facing < 0, life: 2.2 }));
    if (this.floating && this.water) {
      this.world.particles.splash(this.x - 20, this.water.y, 10);
      this.world.particles.splash(this.x + 20, this.water.y, 10);
      msfx(this, 'splash');
    }
  }

  override updateWreck(dt: number): void {
    if (!this.floating || !this.water) {
      super.updateWreck(dt);
      return;
    }
    if (!this.wrecked) return;
    // Sink: nose up, slide under, bubbles.
    this.y += dt * (6 + this.wreckAge * 10);
    this.sinkRot = Math.min(0.32, this.sinkRot + dt * 0.18);
    if (fxRng.chance(dt * 14)) this.world.particles.add({ kind: 'px', x: this.x + fxRng.range(-30, 30), y: this.water.y + 2, vx: 0, vy: -20, life: 0.4, color: '#d8f0ff' });
    if (this.y - this.h > this.water.y + this.water.h || this.y > this.baseY + 46) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.hidden) return;
    const flip = this.facing < 0;
    const flash = this.flash > 0;
    const x = this.x + this.joltX;
    const spr = sprites.get('mach_boat');
    const y = this.y + DRAFT_OFFSET;
    if (this.wrecked) {
      if (this.sinkRot > 0) spr.draw(g, x, y, WRECK, { flip, rot: -this.sinkRot * this.facing });
      else spr.draw(g, x, y, WRECK, { flip });
      return;
    }
    const gp = this.gunPivot();
    sprites.get('mach_boat_gun').draw(g, gp.x, gp.y, angleFrame(this.aim, 0, GUN_MAX, GUN_N), { flip, flash });
    spr.draw(g, x, y, Math.floor(this.age * 3) % 2, { flip, flash });
    if (this.state === 'charge' && Math.floor(this.stateTime * 14) % 2 === 0) {
      const m = this.muzzle();
      sprites.get('mach_glow').draw(g, m.x, m.y, Math.min(2, Math.floor(this.stateTime * 5)));
    }
    if (this.burst > 0 && this.burstT > 0.13 && Math.floor(this.burstT * 16) % 2 === 0) {
      const p = this.canvasToWorld(MG_X + 5, MG_Y + 2);
      sprites.get('mach_glow').draw(g, p.x, p.y, 0);
    }
  }
}

/** The sprite's keel sits 4 px above its bottom edge. */
const DRAFT_OFFSET = 4;

registerEntity(
  'gunboat',
  'enemy',
  (_w, s) => new Gunboat(s.props),
  'Patrol gunboat (26 HP): floats on the water body it spawns in (patrols it; beached on the ground if there is no water), telegraphed arcing deck-gun shells + bridge-MG bursts; sinks when destroyed. Spawn with y omitted (or on the water surface). props.facing, props.drop',
);
