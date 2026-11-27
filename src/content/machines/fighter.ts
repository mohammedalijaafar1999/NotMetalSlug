// fighter — Legion jet fighter (8 HP), mostly for the sky mission.
//  - A blinking arrow at the screen edge + jet roar warns where it will come from.
//  - Strafing pass across the screen: short aimed nose-gun bursts and one dropped missile that
//    ignites and weakly homes (dodgeable).
//  - At the far side it loops back (an Immelmann climb or a split-S dive, rolling upright) and
//    makes the next pass the other way, alternating high and low passes.
//  - After props.passes passes (default 4) it leaves. Shot down it spins away and explodes.
// props: passes (default 4), alt (screen-y of the low pass, default 112), facing (flight
//        direction of the first pass), drop. Spawn anywhere: it repositions off-screen.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { VIEW_W } from '../../engine/renderer';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import { MC, FlyingMachine, Pen, Missile, EdgeWarning, cog, msfx } from './common';

const S = 58;
const C = 29;
const ANG_N = 16;
const ROLL = ANG_N * 2;
const SPEED = 196;
const LOOP_R = 26;

function drawJet(p: PixelArt, a: number, flame: number, roll: boolean): void {
  const d = new Pen(p, 0, 0, a, [C, C]);
  // Local coordinates: plane centered at (29, 29), nose toward +x.
  const X = (v: number) => v + 1;
  const Y = (v: number) => v + 1;
  if (roll) {
    // Edge-on during the half roll: thin fuselage, wings as a vertical bar.
    d.rect(X(20), Y(18), 3, 22, MC.oliveD);
    d.rect(X(20), Y(18), 1, 22, MC.oliveL);
    d.poly([X(4), Y(27), X(40), Y(26), X(54), Y(28), X(40), Y(30), X(4), Y(29)], MC.olive);
    d.poly([X(48), Y(26.5), X(54), Y(28), X(48), Y(29.5)], MC.rust);
    d.rect(X(0), Y(27), 4, 2, flame ? '#ffe070' : '#ff8a20');
    return;
  }
  // Afterburner.
  const fl = flame ? 6 : 4;
  d.poly([X(4), Y(26.5), X(4 - fl), Y(28), X(4), Y(29.5)], '#ff8a20');
  d.poly([X(4), Y(27.3), X(4 - fl + 2), Y(28), X(4), Y(28.7)], '#ffe070');
  // Far wing (darker, peeking out).
  d.poly([X(22), Y(27), X(33), Y(27), X(27), Y(23), X(21), Y(23)], MC.oliveDD);
  // Tail fin.
  d.poly([X(5), Y(27), X(13), Y(27), X(10), Y(18), X(5), Y(18)], MC.olive);
  d.poly([X(5), Y(18), X(10), Y(18), X(10.5), Y(19.5), X(5.5), Y(19.5)], MC.oliveL);
  cog(d, X(8.5), Y(22.5), 1.6);
  // Fuselage: olive top, light belly.
  d.poly([X(3), Y(26), X(18), Y(24.5), X(40), Y(24.5), X(50), Y(26.5), X(54), Y(28), X(50), Y(29.5), X(40), Y(31), X(18), Y(31.5), X(3), Y(30)], MC.olive);
  d.poly([X(3), Y(28.4), X(54), Y(28.4), X(50), Y(29.5), X(40), Y(31), X(18), Y(31.5), X(3), Y(30)], MC.oliveLL);
  d.poly([X(18), Y(24.5), X(40), Y(24.5), X(41), Y(25.5), X(18), Y(25.5)], MC.oliveL);
  d.rect(X(14), Y(27), 26, 1, MC.rust);
  // Canopy + pilot.
  d.poly([X(35), Y(24.8), X(38), Y(21.6), X(44), Y(21.6), X(48), Y(25)], MC.glassD);
  d.poly([X(36.5), Y(24.4), X(38.6), Y(22.4), X(43.4), Y(22.4), X(46), Y(24.6)], MC.glass);
  // Pilot: helmet + goggle glint.
  const [hx, hy] = d.t(X(40.5), Y(23.6));
  p.circle(hx, hy, 1.9, '#5a4a32');
  p.px(Math.floor(hx + Math.cos(a) * 1.4 - Math.sin(a) * -0.2), Math.floor(hy + Math.sin(a) * 1.4), '#8ad8ff');
  d.px(X(43), Y(22), MC.glassL);
  // Nose cone + intake.
  d.poly([X(48), Y(26.2), X(55), Y(28), X(48), Y(29.8)], MC.rust);
  d.poly([X(48), Y(26.2), X(55), Y(28), X(49), Y(27)], MC.rustL);
  d.rect(X(30), Y(28.5), 6, 2, MC.black);
  // Near wing + missile.
  d.poly([X(19), Y(29), X(35), Y(29), X(27), Y(35), X(15), Y(35)], MC.oliveD);
  d.poly([X(19), Y(29), X(35), Y(29), X(33), Y(30.5), X(18), Y(30.5)], MC.olive);
  d.cap(X(19), Y(36.2), X(28), Y(36.2), 0.9, MC.cream);
  d.px(X(28), Y(36), MC.red);
  // Tailplane + nozzle.
  d.poly([X(2), Y(29), X(13), Y(29.5), X(5), Y(33)], MC.oliveD);
  d.rect(X(1), Y(26.5), 3, 3, MC.steelD);
}

sprites.define({
  name: 'mach_fighter',
  w: S,
  h: S,
  ox: C,
  oy: C,
  frames: ANG_N * 2 + 2,
  draw: (p, f) => {
    if (f >= ROLL) drawJet(p, 0, f - ROLL, true);
    else drawJet(p, (Math.floor(f / 2) / ANG_N) * Math.PI * 2, f % 2, false);
  },
});

export class Fighter extends FlyingMachine {
  passes: number;
  passNo = 0;
  /** Heading (radians, screen space). */
  heading = 0;
  /** Canopy on the left side of travel (upright when heading right). */
  canopyLeft = true;
  turnDir = 0;
  turned = 0;
  rollT = 0;
  gunT = 0;
  bursts = 0;
  burst = 0;
  burstT = 0;
  missileFired = false;
  high = false;
  spinV = 0;
  spin = 0;

  constructor(props: Record<string, any> = {}, autoAlt = true) {
    super(autoAlt, 112, props);
    this.anchor = 'center';
    this.w = 40;
    this.h = 12;
    this.hp = this.maxHp = 8;
    this.scoreValue = 1000;
    this.passes = typeof props.passes === 'number' ? props.passes : 4;
    this.boom = 'large';
    this.blast = { radius: 26, damage: 4 };
    this.debris = [MC.olive, MC.oliveD, MC.oliveLL, MC.steel, MC.rust, MC.glass];
    this.smokeAt = [[-8, 0]];
    this.wreckTime = 0;
    this.persistent = true;
  }

  override spawned(): void {
    super.spawned();
    // Start just off-screen on the side opposite to the flight direction; warn first.
    const c = this.world.camera;
    const dir = this.facing;
    this.heading = dir > 0 ? 0 : Math.PI;
    this.canopyLeft = dir > 0;
    this.x = dir > 0 ? c.x - 40 : c.x + VIEW_W + 40;
    if (this.autoAlt) this.y = this.cruiseY;
    this.setState('warn');
    this.world.add(new EdgeWarning((dir > 0 ? -1 : 1) as 1 | -1, this.y, 0.9));
    msfx(this, 'warning', { vol: 0.5 });
  }

  /** Ground-relative low/high pass altitude. */
  private passY(): number {
    return this.world.camera.y + (this.high ? this.alt - 2 * LOOP_R : this.alt);
  }

  think(dt: number): void {
    const c = this.world.camera;
    const t = this.target();
    switch (this.state) {
      case 'warn':
        // Hold position off-screen (relative to the scrolling camera) while the warning blinks.
        this.x = this.heading === 0 ? c.x - 40 : c.x + VIEW_W + 40;
        if (this.stateTime > 0.9) {
          this.setState('pass');
          this.startPass();
          msfx(this, 'jet_flyby', { vol: 0.8 });
        }
        return;
      case 'pass': {
        const dir = Math.cos(this.heading) >= 0 ? 1 : -1;
        this.facing = dir;
        // Ease toward the pass altitude with a slight dip toward the target.
        let gy = this.passY();
        if (t && Math.abs(t.x - this.x) < 120) gy += 6;
        this.y += (gy - this.y) * Math.min(1, dt * 2);
        this.x += dir * SPEED * dt;
        this.attack(dt, dir);
        const exitEdge = dir > 0 ? c.x + VIEW_W - 34 : c.x + 34;
        const crossed = dir > 0 ? this.x > exitEdge : this.x < exitEdge;
        if (crossed) {
          this.passNo++;
          if (this.passNo >= this.passes) this.setState('leave');
          else this.startLoop(dir);
        }
        break;
      }
      case 'roll':
        // Half roll (edge-on frame) before a split-S / after an Immelmann.
        this.x += Math.cos(this.heading) * SPEED * dt;
        this.y += Math.sin(this.heading) * SPEED * dt;
        if (this.stateTime > 0.14) {
          this.canopyLeft = !this.canopyLeft;
          if (this.turnDir !== 0 && this.turned < Math.PI) this.setState('loop');
          else {
            this.turnDir = 0;
            this.setState('pass');
            this.startPass();
          }
        }
        break;
      case 'loop': {
        const w = (SPEED / LOOP_R) * dt;
        this.heading += this.turnDir * w;
        this.turned += w;
        this.x += Math.cos(this.heading) * SPEED * dt;
        this.y += Math.sin(this.heading) * SPEED * dt;
        if (this.turned >= Math.PI) {
          this.heading = Math.cos(this.heading) >= 0 ? 0 : Math.PI;
          this.high = !this.high;
          if (this.high) this.setState('roll');
          else {
            this.turnDir = 0;
            this.setState('pass');
            this.startPass();
          }
        }
        break;
      }
      case 'leave': {
        const dir = Math.cos(this.heading) >= 0 ? 1 : -1;
        this.x += dir * SPEED * dt;
        this.y -= 20 * dt;
        if (!this.onScreen(60)) this.remove();
        break;
      }
    }
    // Contrail.
    if (fxRng.chance(dt * 30)) {
      this.world.particles.add({ kind: 'smoke', x: this.x - Math.cos(this.heading) * 24, y: this.y - Math.sin(this.heading) * 24, vx: 0, vy: 0, life: 0.35, color: '#e8ecf4', color2: '#b8c0cc', size: 1, size2: 2.5 });
    }
  }

  private startPass(): void {
    this.bursts = 0;
    this.missileFired = false;
    this.gunT = 0.2;
  }

  /** Begin the turn-around: Immelmann (climb) after a low pass, split-S (dive) after a high one. */
  private startLoop(dir: number): void {
    this.turned = 0;
    if (!this.high) {
      // Climb: heading rotates toward "up" (-PI/2).
      this.turnDir = dir > 0 ? -1 : 1;
      this.setState('loop');
    } else {
      // Dive: roll inverted first, then pull through toward "down".
      this.turnDir = dir > 0 ? 1 : -1;
      this.setState('roll');
    }
  }

  private attack(dt: number, dir: number): void {
    const t = this.target();
    // Fire only once at least half of the plane is in view (never from off-screen).
    if (!t || !this.canAttack(-this.w / 2)) return;
    const ahead = (t.x - this.x) * dir;
    // Nose gun: up to two aimed 3-round bursts per pass.
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burst--;
        this.burstT = 0.09;
        const mx = this.x + dir * 22;
        const my = this.y + 1;
        // Leaving the screen: the nose is already past the edge, hold the rest of the burst.
        if (!this.world.isVisible(mx, my, 0)) return;
        const a = Math.atan2(t.cy - my, t.cx - mx);
        const lim = 0.9;
        const rel = dir > 0 ? Math.max(-0.2, Math.min(lim, a)) : Math.PI - Math.max(-0.2, Math.min(lim, Math.PI - a));
        this.shoot(mx, my, { angle: rel, speed: 165 });
        const fx = this.world.effect('muzzle_flash', mx, my, { fps: 30 });
        fx.rot = rel;
        msfx(this, 'heli_gun', { vol: 0.45, pitch: 1.2 });
      }
    } else {
      this.gunT -= dt;
      if (this.gunT <= 0 && this.bursts < 2 && ahead > 40 && ahead < 170) {
        this.bursts++;
        this.burst = 3;
        this.burstT = 0.05;
        this.gunT = this.fireDelay(0.55);
      }
    }
    if (!this.missileFired && ahead > 70 && ahead < 150) {
      this.missileFired = true;
      this.world.add(new Missile(this, this.x - dir * 2, this.y + 7, dir * 70, { maxSpeed: this.shotSpeed(165) }));
    }
  }

  // ---------------------------------------------------------------- death

  override onDeath(): void {
    this.spinV = (fxRng.chance(0.5) ? 1 : -1) * 7;
    this.vx = Math.cos(this.heading) * SPEED * 0.8;
    this.vy = Math.sin(this.heading) * SPEED * 0.8 - 30;
    this.world.explode(this.x, this.y, { radius: 8, damage: 0, team: 'player', size: 'small', shake: 2, sfx: 'explosion' });
  }

  override updateWreck(dt: number): void {
    if (this.wrecked) return;
    this.vy = Math.min(this.vy + 380 * dt, 320);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.spin += this.spinV * dt;
    const P = this.world.particles;
    P.add({ kind: 'smoke', x: this.x, y: this.y, vx: fxRng.range(-8, 8), vy: fxRng.range(-12, 0), life: fxRng.range(0.5, 0.9), color: '#3a363c', color2: '#1e1c22', size: 2, size2: 5, drag: 1 });
    P.add({ kind: 'smoke', x: this.x, y: this.y, vx: 0, vy: 0, life: 0.2, color: '#ffe070', color2: '#f05a1a', size: 1.5, size2: 3, front: true });
    const ground = this.world.terrain.groundTopAt(this.x);
    if (this.deathTime > 0.75 || this.y >= ground - 4 || this.y > this.world.camera.y + 240) this.explodeNow();
  }

  override explodeNow(): void {
    super.explodeNow();
    this.deathDuration = this.deathTime + 0.05;
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.wrecked || this.dead || this.state === 'warn') return;
    const spr = sprites.get('mach_fighter');
    const flame = Math.floor(this.age * 24) % 2;
    const flash = this.flash > 0;
    if (this.dying) {
      spr.draw(g, this.x, this.y, flame, { rot: this.heading + this.spin, flash });
      return;
    }
    if (this.state === 'roll') {
      spr.draw(g, this.x, this.y, ROLL + flame, { flip: Math.cos(this.heading) < 0 });
      return;
    }
    // Pick the baked angle; mirror vertically when the canopy is on the right of travel.
    const h = this.canopyLeft ? this.heading : -this.heading;
    const k = ((Math.round((h / (Math.PI * 2)) * ANG_N) % ANG_N) + ANG_N) % ANG_N;
    spr.draw(g, this.x, this.y, k * 2 + flame, { flipY: !this.canopyLeft, flash });
  }
}

registerEntity(
  'fighter',
  'enemy',
  (_w, s) => new Fighter(s.props, s.y === undefined),
  'Jet fighter (8 HP, flying): edge warning, then strafing passes (aimed nose-gun bursts + one dropped homing missile), loops back between passes alternating low/high, leaves after props.passes (4). props.facing = first pass direction, props.alt (low-pass screen-y, default 112), props.drop',
);
