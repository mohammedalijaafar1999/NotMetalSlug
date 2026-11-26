// airship_turret — ball turret bolted to a riveted airship hull plate (12 HP), for the sky
// mission. It holds its world position (no gravity) like part of the ship it is mounted on.
//  - Tracks you with twin barrels across its half of the sky, glows, then fires a 3-shot burst.
//  - Destroyed: the ball is blown off the mount, leaving a scorched plate.
// props: mount 'top' (default: plate below, aims upward) | 'bottom' (hanging under a hull,
//        aims downward); vx (drift px/s, to ride a moving ship, default 0); facing; drop.
// Position: y = the hull surface the plate is fixed to (omit y: 'top' sits on the floor,
// 'bottom' hangs just under the HUD).

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import { MC, Machine, Pen, FlyingPart, rivetRow, cog, charr, msfx } from './common';

const DIRS = 16;
const BALL = 26;
const BC = 13;
const BARREL = 11;
/** Ball center distance from the hull surface. */
const STANDOFF = 8;

sprites.define({
  name: 'mach_airship_plate',
  w: 40,
  h: 9,
  ox: 20,
  oy: 9,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p);
    // Curved riveted hull section (brass trim on steel).
    d.poly([0, 9, 2, 3, 8, 0, 32, 0, 38, 3, 40, 9], MC.steel);
    d.poly([2, 3, 8, 0, 32, 0, 33, 1, 8.5, 1.5, 3, 4], MC.steelL);
    d.rect(0, 7, 40, 2, MC.steelD);
    d.rect(6, 4, 28, 1, MC.brass);
    d.px(6, 4, MC.brassL);
    rivetRow(d, 4, 36, 6, 4, MC.steel);
    // Porthole.
    d.circle(31, 3.5, 1.6, MC.brassD);
    d.circle(31, 3.5, 0.9, MC.glass);
    cog(d, 9, 3.5, 1.4);
    if (f === 1) charr(p, 6, 0.03);
  },
});

/** Ball turret with twin barrels in DIRS directions (frame k = angle k/DIRS * 2PI). */
sprites.define({
  name: 'mach_airship_ball',
  w: BALL + 8,
  h: BALL + 8,
  ox: BC + 4,
  oy: BC + 4,
  frames: DIRS + 1,
  draw: (p: PixelArt, f) => {
    const d = new Pen(p);
    const c = BC + 4;
    if (f < DIRS) {
      const a = (f / DIRS) * Math.PI * 2;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      for (const s of [-1.6, 1.6]) {
        d.cap(c + cs * 3 - sn * s, c + sn * 3 + cs * s, c + cs * BARREL - sn * s, c + sn * BARREL + cs * s, 0.9, MC.steelD);
        d.cap(c + cs * (BARREL - 2) - sn * s, c + sn * (BARREL - 2) + cs * s, c + cs * BARREL - sn * s, c + sn * BARREL + cs * s, 1.2, MC.steel);
      }
    }
    // Ball (brass-banded steel sphere, lit top-left) with a vision slit.
    d.circle(c, c, 6.5, MC.steelD);
    d.circle(c - 0.4, c - 0.4, 5.8, MC.steel);
    d.circle(c - 1.8, c - 1.8, 3, MC.steelL);
    d.px(c - 3, c - 3, MC.steelLL);
    d.rect(c - 6, c, 12, 1, MC.brass);
    d.px(c - 6, c, MC.brassL);
    if (f < DIRS) {
      const a = (f / DIRS) * Math.PI * 2;
      d.circle(c + Math.cos(a) * 3.5, c + Math.sin(a) * 3.5, 1.3, MC.black);
      d.px(Math.floor(c + Math.cos(a) * 3.5), Math.floor(c + Math.sin(a) * 3.5), MC.red);
    } else charr(p, 3);
  },
});

export class AirshipTurret extends Machine {
  hanging: boolean;
  drift: number;
  aim: number;
  fireT = 0;
  burst = 0;
  burstT = 0;
  baseY = 0;

  /** Spawned without an explicit y. */
  autoY: boolean;

  constructor(props: Record<string, any> = {}, autoY = false) {
    super();
    this.autoY = autoY;
    this.hanging = props.mount === 'bottom';
    this.drift = typeof props.vx === 'number' ? props.vx : 0;
    this.anchor = 'center';
    this.w = 20;
    this.h = 20;
    this.hp = this.maxHp = 12;
    this.scoreValue = 600;
    this.boom = 'medium';
    this.blast = { radius: 22, damage: 3 };
    this.debris = [MC.steel, MC.steelD, MC.steelL, MC.brass, MC.brassD];
    this.smokeAt = [[0, 0]];
    this.wreckTime = 2;
    this.collideTerrain = false;
    this.gravityScale = 0;
    this.aim = this.hanging ? Math.PI / 2 : -Math.PI / 2;
  }

  override spawned(): void {
    super.spawned();
    // y given = hull surface; move the ball center off it. A hanging turret without a y hangs
    // from an (implied) hull just under the HUD.
    this.baseY = this.hanging && this.autoY ? this.world.camera.y + 44 : this.y;
    this.y = this.hanging ? this.baseY + STANDOFF + 2 : this.baseY - STANDOFF - 2;
    this.aim = this.hanging ? (this.facing > 0 ? Math.PI / 4 : (3 * Math.PI) / 4) : this.facing > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4;
    this.fireT = this.fireDelay(1.0);
  }

  /** Clamp an angle into this mount's half of the sky. */
  private clampAim(a: number): number {
    const lo = this.hanging ? 0.08 : -Math.PI + 0.08;
    const hi = this.hanging ? Math.PI - 0.08 : -0.08;
    let b = Math.atan2(Math.sin(a), Math.cos(a));
    if (this.hanging) {
      if (b < 0) b = b < -Math.PI / 2 ? hi : lo;
    } else if (b > 0) b = b > Math.PI / 2 ? lo : hi;
    return Math.max(lo, Math.min(hi, b));
  }

  think(dt: number): void {
    const t = this.target();
    this.x += this.drift * dt;
    if (t) {
      const want = this.clampAim(Math.atan2(t.cy - this.y, t.cx - this.x));
      let da = want - this.aim;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      this.aim += Math.sign(da) * Math.min(Math.abs(da), 2.2 * dt);
      this.facing = Math.cos(this.aim) < 0 ? -1 : 1;
    }
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burst--;
        this.burstT = 0.14;
        if (this.canAttack()) {
          const mx = this.x + Math.cos(this.aim) * (BARREL + 1);
          const my = this.y + Math.sin(this.aim) * (BARREL + 1);
          this.shoot(mx, my, { angle: this.aim, speed: 140, spread: 0.05 });
          const fx = this.world.effect('muzzle_flash', mx, my, { fps: 30 });
          fx.rot = this.aim;
          msfx(this, 'turret_fire', { vol: 0.5, pitch: 1.1 });
        }
        if (this.burst === 0) this.fireT = this.fireDelay(1.8);
      }
    } else {
      this.fireT -= dt;
      if (this.fireT <= 0 && t && this.canAttack()) {
        this.burst = 3;
        this.burstT = 0.45;
      }
    }
  }

  override updateWreck(_dt: number): void {
    // Stays bolted to its hull.
  }

  override onExplode(): void {
    this.world.add(new FlyingPart('mach_airship_ball', DIRS, this.x, this.y, fxRng.range(-60, 60), this.hanging ? fxRng.range(-40, 20) : -fxRng.range(160, 220), fxRng.range(6, 10), { life: 2 }));
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.hidden) return;
    const flash = this.flash > 0;
    const plateSpr = sprites.get('mach_airship_plate');
    const x = Math.round(this.x) + this.joltX;
    // Plate: drawn upside-down when hanging under a hull.
    plateSpr.draw(g, x, this.baseY, this.wrecked ? 1 : 0, { flipY: this.hanging, flash: flash && !this.wrecked });
    if (this.wrecked) return;
    const k = ((Math.round((this.aim / (Math.PI * 2)) * DIRS) % DIRS) + DIRS) % DIRS;
    sprites.get('mach_airship_ball').draw(g, x, this.y, k, { flash });
    if (this.burst > 0 && this.burstT > 0.15 && Math.floor(this.burstT * 16) % 2 === 0) {
      sprites.get('mach_glow').draw(g, x + Math.cos(this.aim) * (BARREL + 1), this.y + Math.sin(this.aim) * (BARREL + 1), 1);
    }
  }
}

registerEntity(
  'airship_turret',
  'enemy',
  (_w, s) => new AirshipTurret(s.props, s.y === undefined),
  "Airship ball turret (12 HP, no gravity): bolted to a hull plate at y (the hull surface); props.mount 'top' (default, aims up) | 'bottom' (hanging, aims down); tracks you and fires telegraphed 3-shot bursts; props.vx drift to ride a moving ship; props.drop",
);
