// snowmobile — arctic raider on a Legion snowmobile (8 HP).
//  - Charges at you at full throttle, spraying snow; rams (crush damage) at speed: jump it!
//  - The rider raises his pistol (telegraph) and fires a 2-shot burst when you are ahead.
//  - After overshooting you (or reaching the screen edge / a ledge) it skids round and charges
//    again. Destroyed: the rider is thrown, the sled burns.
// props: facing (1|-1), drop

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import { MC, Machine, Pen, cog, charr, treads, cycleFrame, msfx, CREW_ARCTIC } from './common';
import { drawHuman } from '../../art/humanoid';

const W = 48;
const H = 36;
const TRACK_N = 3;
const AIM_F = TRACK_N;
const WRECK = TRACK_N * 2;
const WHITE = '#d6dde6';
const WHITE_D = '#9ea8b6';

function drawSled(p: PixelArt, f: number): void {
  const wreck = f === WRECK;
  const aiming = f >= AIM_F && !wreck;
  const cyc = (f % TRACK_N) / TRACK_N;
  const d = new Pen(p);
  // Rear track unit.
  treads(d, 3, 28, 22, 7, wreck ? 0 : cyc, { wheels: 3, hub: MC.steel, rim: MC.steelL });
  // Ski + strut at the front.
  d.rect(36, 27, 2, 6, MC.steelD);
  d.poly([28, 33, 44, 33, 46, 31, 47, 29, 47.5, 30.5, 46, 34, 44, 35, 28, 35], MC.steel);
  d.rect(29, 33, 15, 1, MC.steelL);
  // Rider (seated), drawn before the cowling so the body hides his legs.
  if (!wreck) {
    const arm: [number, number] = aiming ? [10, -1] : [7, 3];
    drawHuman(p, 17, 36, { hip: [0, -13], footB: [5, -6], footF: [8, -5], lean: 2, gun: aiming ? 'smg' : 'none', aim: aiming ? 0.05 : 0, handF: aiming ? undefined : arm, handB: aiming ? undefined : [8, 4], expr: aiming ? 'shout' : 'normal' }, CREW_ARCTIC);
  }
  // Seat.
  d.poly([6, 22, 20, 22, 22, 25, 5, 25], '#3a3438');
  d.rect(7, 22, 12, 1, '#5a5258');
  // Body cowling (winter camo: white with olive blotches, rust stripe).
  d.poly([4, 25, 22, 24, 30, 20, 40, 21, 46, 25, 45, 29, 38, 30, 5, 30], WHITE);
  d.poly([4, 29, 38, 29, 45, 28, 45, 29, 38, 30, 5, 30], WHITE_D);
  d.poly([22, 24, 30, 20, 40, 21, 39, 22, 30, 21.5, 23, 25], '#f2f5f8');
  d.ellipse(12, 27, 3.5, 1.3, MC.olive);
  d.ellipse(34, 24, 2.5, 1.2, MC.olive);
  d.ellipse(41, 26, 1.8, 1, MC.olive);
  d.rect(8, 26, 22, 1, MC.rust);
  d.rect(8, 27, 22, 1, MC.rustD);
  cog(d, 24, 27, 1.7);
  // Windscreen + handlebar.
  if (!wreck) {
    d.poly([29, 20, 33, 14, 35, 14, 33, 20], MC.glassD);
    d.poly([30, 19.5, 33.5, 15, 34, 15, 31.5, 19.5], MC.glass);
  }
  d.rect(26, 19, 4, 1, MC.steelD);
  // Headlight.
  d.circle(43, 24.5, 1.4, MC.steelD);
  d.px(43, 24, '#fff4c0');
  if (wreck) charr(p, 9, 0.02);
}

sprites.define({
  name: 'mach_snowmobile',
  w: W,
  h: H,
  frames: WRECK + 1,
  draw: (p, f) => drawSled(p, f),
});

export class Snowmobile extends Machine {
  trackT = 0;
  aimT = 0;
  shots = 0;
  shotT = 0;
  fireT = 0;
  engineT = 0;
  passX = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.w = 20;
    this.h = 24;
    this.bodyW = 40;
    this.hp = this.maxHp = 8;
    this.scoreValue = 500;
    this.boom = 'medium';
    this.blast = { radius: 24, damage: 3 };
    this.crewOut = ['mach_crew_arctic'];
    this.debris = [WHITE, WHITE_D, MC.olive, MC.steel, MC.rust];
    this.smokeAt = [[-10, -10]];
    this.wreckTime = 2;
  }

  override spawned(): void {
    super.spawned();
    this.fireT = this.fireDelay(0.8);
    this.setState('charge');
  }

  think(dt: number): void {
    const t = this.target();
    let wantV = 0;
    switch (this.state) {
      case 'charge': {
        wantV = this.facing * 132;
        const dx = t ? t.x - this.x : 0;
        if (t && Math.sign(dx) !== this.facing && Math.abs(dx) > 64) this.setState('skid');
        const [lo, hi] = this.viewClamp(this.bw / 2);
        const atEdge = this.onScreen(0) && ((this.facing < 0 && this.x < lo) || (this.facing > 0 && this.x > hi));
        if (atEdge || this.hitWall || this.ledgeAhead(this.facing, 8) || this.wallAhead(this.facing)) this.setState('skid');
        // Telegraphed pistol shots at a target ahead.
        this.fireT -= dt;
        if (this.aimT <= 0 && this.shots === 0 && this.fireT <= 0 && t && this.canAttack() && Math.sign(dx) === this.facing && Math.abs(dx) > 40 && Math.abs(dx) < 170) {
          this.aimT = 0.35;
        }
        break;
      }
      case 'skid':
        wantV = 0;
        if (fxRng.chance(dt * 40)) this.world.particles.dust(this.x - this.facing * 10, this.y, 2, '#f0f4f8');
        if (Math.abs(this.vx) < 8 || this.stateTime > 0.8) {
          this.facing = this.facing > 0 ? -1 : 1;
          this.vx = 0;
          this.setState('charge');
        }
        break;
    }
    // Pistol burst (after the raise-gun telegraph).
    if (this.aimT > 0) {
      this.aimT -= dt;
      if (this.aimT <= 0) {
        this.shots = 2;
        this.shotT = 0;
      }
    }
    if (this.shots > 0) {
      this.shotT -= dt;
      if (this.shotT <= 0) {
        this.shots--;
        this.shotT = 0.16;
        if (this.canAttack()) {
          const mx = this.x + this.facing * 9;
          const my = this.y - 25;
          let ang = this.facing > 0 ? 0 : Math.PI;
          if (t) {
            const a = Math.atan2(t.cy - my, Math.abs(t.cx - mx) + 1);
            const c = Math.max(-0.25, Math.min(0.35, a));
            ang = this.facing > 0 ? c : Math.PI - c;
          }
          this.shoot(mx, my, { angle: ang, speed: 160 });
          this.world.effect('muzzle_flash', mx, my, { fps: 30, flip: this.facing < 0 });
          msfx(this, 'enemy_rifle', { vol: 0.55 });
        }
        if (this.shots === 0) this.fireT = this.fireDelay(1.6);
      }
    }
    const acc = this.state === 'skid' ? 260 : 180;
    this.vx += Math.sign(wantV - this.vx) * Math.min(Math.abs(wantV - this.vx), acc * dt);
    this.moveAndCollide(dt);
    this.trackT += (this.vx * this.facing * dt) / 2;
    if (Math.abs(this.vx) > 50) this.touch({ x: this.x + (this.vx > 0 ? 0 : -this.bw / 2), y: this.y - 18, w: this.bw / 2, h: 18 }, 4, 'crush', 0.7);
    // Snow spray + engine.
    if (Math.abs(this.vx) > 30 && fxRng.chance(dt * 30)) {
      this.world.particles.add({ kind: 'px', x: this.x - Math.sign(this.vx) * 20, y: this.y - 2, vx: -this.vx * 0.4 + fxRng.range(-20, 20), vy: fxRng.range(-70, -30), life: 0.5, color: '#f4f8fc', color2: '#c8d4e0', gravity: 260, size: fxRng.pick([1, 2]) });
    }
    this.engineT -= dt;
    if (this.engineT <= 0 && this.onScreen(30)) {
      this.engineT = 0.35;
      msfx(this, 'engine', { vol: 0.3, pitch: 1.3 + Math.abs(this.vx) / 400 });
      this.world.particles.add({ kind: 'smoke', x: this.x - this.facing * 22, y: this.y - 10, vx: -this.facing * 12, vy: -6, life: 0.4, color: '#8a8690', color2: '#5a5660', size: 1, size2: 2.5 });
    }
  }

  override onExplode(): void {
    this.vy = -150;
    this.onGround = false;
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.hidden) return;
    const flip = this.facing < 0;
    const x = this.x + this.joltX;
    const spr = sprites.get('mach_snowmobile');
    if (this.wrecked) {
      spr.draw(g, x, this.y, WRECK, { flip });
      return;
    }
    const tf = cycleFrame(this.trackT, TRACK_N);
    const aiming = this.aimT > 0 || this.shots > 0;
    const tilt = this.state === 'skid' ? 0.08 * this.facing : 0;
    spr.draw(g, x, this.y, (aiming ? AIM_F : 0) + tf, { flip, flash: this.flash > 0, rot: tilt || undefined });
  }
}

registerEntity(
  'snowmobile',
  'enemy',
  (_w, s) => new Snowmobile(s.props),
  'Snowmobile raider (8 HP): charges and rams (crush), rider raises his pistol then fires 2-shot bursts, skids round after overshooting and charges again. props.facing, props.drop',
);
