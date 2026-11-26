// DRAGONFLY gyrocopter (player vehicle). A nimble autogyro with a big compound-eye nose lamp, a
// segmented dragonfly tail, an open cockpit, a free-spinning top rotor and a pusher prop.
// Free 8-way flight inside the camera view (no gravity), a nose vulcan that fires forward (tilted
// down while DOWN is held; holding FIRE locks the facing so you can strafe), and belly bombs (BOMB,
// 20). Hovers in place with a gentle bob when empty. Bailing out is only allowed over solid ground
// (never in missions played entirely in the gyro). 80 HP.
// props: ammo (bombs, default 20), facing.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { approach } from '../../engine/math';
import type { ActionState } from '../../engine/input';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import { Vehicle, vsfx } from '../../game/vehicle';
import { Bullet, Projectile } from '../../game/projectile';
import { Z } from '../../game/constants';
import type { Entity } from '../../game/entity';
import { VP, ellipsePts, ramp, rotPt, rotPts, shaded, shadedPoly } from './art';

// ------------------------------------------------------------------ tuning

const SPEED_X = 104;
const SPEED_Y = 88;
const ACCEL = 430;
const DRAG = 300;
const VULCAN_CD = 0.08;
const BOMB_CD = 0.28;
const DOWN_ANGLE = 0.45;

// ------------------------------------------------------------------ art

const W = 72;
const H = 44;
const OX = 36;
const OY = 44;
/** Tilt pivot (mast base) and the tilt angles of the 5 body frames (+ = nose down). */
const PIV = [36, 25] as const;
export const GYRO_TILTS = [-0.16, -0.08, 0, 0.08, 0.16];
/** Canvas points: pilot shoulder, rotor hub, pusher hub, gun mount, bomb pylon, engine smoke. */
const SEAT = [40.5, 23] as const;
const HUB = [32.5, 7] as const;
const PROP = [28.5, 30] as const;
const GUN = [51, 36] as const;
const PYLON = [42, 39] as const;

/** Canvas point after tilting the body by frame t. */
function tiltPt(x: number, y: number, t: number): [number, number] {
  return rotPt(x, y, PIV[0], PIV[1], GYRO_TILTS[t]);
}

function drawBody(p: PixelArt, t: number, driven: boolean, bombs: boolean): void {
  const a = GYRO_TILTS[t];
  const R = (pts: number[]) => rotPts(pts, PIV[0], PIV[1], a);
  const P = (x: number, y: number) => rotPt(x, y, PIV[0], PIV[1], a);
  const cap = (x0: number, y0: number, x1: number, y1: number, r: number, c: string) => {
    const [ax, ay] = P(x0, y0);
    const [bx, by] = P(x1, y1);
    p.capsule(ax, ay, bx, by, r, c);
  };
  const tail = ramp('#468c76', 0.3, -0.34);
  // Skids + struts.
  cap(30, 36, 28, 42, 0.8, VP.steelDark.base);
  cap(45, 36, 46.5, 42, 0.8, VP.steelDark.base);
  cap(23, 42.5, 50, 42.5, 1, VP.steelDark.dark);
  cap(50, 42.5, 52.5, 40.5, 1, VP.steelDark.dark);
  // Rotor mast (behind the pilot).
  shaded(p, (m) => {
    const [x0, y0] = P(34.5, 25);
    const [x1, y1] = P(32.5, 8);
    m.capsule(x0, y0, x1, y1, 1.2, '#fff');
  }, VP.steel);
  // Segmented dragonfly tail boom.
  const segs = [
    [31, 30.5, 25, 29.5, 2.8],
    [25, 29.5, 19.5, 28.6, 2.4],
    [19.5, 28.6, 14.5, 27.8, 2.1],
    [14.5, 27.8, 9.5, 27, 1.8],
  ];
  segs.forEach(([x0, y0, x1, y1, r], i) => {
    shaded(p, (m) => {
      const [ax, ay] = P(x0, y0);
      const [bx, by] = P(x1, y1);
      m.capsule(ax, ay, bx, by, r, '#fff');
    }, i % 2 ? tail : VP.hull);
  });
  // Tail fin (orange for visibility) + stabilizer.
  shadedPoly(p, R([4, 27.5, 2.5, 17, 6.5, 17.5, 11, 27]), ramp(VP.orange, 0.3, -0.3));
  cap(3, 28, 13, 28, 1, VP.orangeD);
  // Pusher prop hub.
  shaded(p, (m) => {
    const [hx, hy] = P(PROP[0] + 1.5, PROP[1]);
    m.circle(hx, hy, 2.6, '#fff');
  }, VP.steelDark);
  // Stub wing + bomb pylon.
  if (bombs) {
    for (const bx of [39.5, 44]) {
      const [x0, y0] = P(bx, 38.6);
      const [x1, y1] = P(bx + 3, 38.6);
      p.capsule(x0, y0, x1, y1, 1.3, '#5a6a3a');
      const [fx, fy] = P(bx - 0.5, 38.6);
      p.px(Math.floor(fx), Math.floor(fy), '#3a4422');
    }
  }
  shadedPoly(p, R([35, 36, 48, 35, 49, 37, 36, 38]), VP.steel);
  // Cockpit pod.
  shadedPoly(p, R([30.5, 31, 32.5, 25.4, 37, 23.4, 45, 23.4, 51, 24.4, 55.5, 28.4, 56, 33.6, 51.5, 37.8, 36, 38.4, 30.5, 35.6]), VP.hull);
  // Belly shade + orange cheek stripe.
  shadedPoly(p, R([33, 33.5, 52, 33.5, 50, 36.6, 36, 37.2]), ramp('#3f8470', 0.18, -0.3));
  shadedPoly(p, R([36, 30.5, 49, 30.5, 48.5, 32, 36, 32]), ramp(VP.orange, 0.25, -0.3));
  // Compound-eye nose lamp.
  const [ex, ey] = P(51.5, 29);
  p.circle(ex, ey, 4.2, VP.dark);
  p.circle(ex, ey, 3.4, driven ? VP.glass : '#3a5a66');
  const [ix, iy] = P(52.4, 29.8);
  p.circle(ix, iy, 1.6, driven ? VP.glassD : '#2a4450');
  const [gx, gy] = P(50.2, 27.6);
  p.px(Math.floor(gx), Math.floor(gy), driven ? VP.glassL : '#6a8a96');
  p.px(Math.floor(gx) + 1, Math.floor(gy), driven ? VP.glassL : '#6a8a96');
  // Cockpit rim + windscreen.
  shadedPoly(p, R([36, 23, 46.5, 23, 46.5, 25, 36, 25]), VP.steel);
  const [w0x, w0y] = P(46.5, 23.5);
  const [w1x, w1y] = P(48.8, 17.5);
  p.capsule(w0x, w0y, w1x, w1y, 1, VP.glassD);
  const [w2x, w2y] = P(47.5, 21.5);
  p.px(Math.floor(w2x), Math.floor(w2y), VP.glassL);
  if (!driven) {
    // Cockpit cover when parked.
    shadedPoly(p, R([36.5, 23.4, 38.5, 20, 44.5, 20, 46.5, 23.4]), VP.hull);
  }
  // Rotor hub.
  shaded(p, (m) => {
    const [hx, hy] = P(HUB[0], HUB[1]);
    m.circle(hx, hy, 2.1, '#fff');
  }, VP.steelDark);
}

/** Body: frame = tilt (0..4) + 5 * variant (0 parked, 1 driven, 2 driven without bombs). */
sprites.define({
  name: 'gyro_body',
  w: W,
  h: H,
  ox: OX,
  oy: OY,
  frames: 15,
  draw: (p, f) => {
    const t = f % 5;
    const v = Math.floor(f / 5);
    drawBody(p, t, v > 0, v < 2);
  },
});

/** Top rotor seen from the side: 4 spin frames + 1 stopped. Origin = hub. */
sprites.define({
  name: 'gyro_rotor',
  w: 66,
  h: 5,
  ox: 33,
  oy: 2,
  frames: 5,
  outline: '#1e1a22',
  draw: (p, f) => {
    if (f === 4) {
      // Stopped: one long blade, slightly drooping.
      p.capsule(6, 3, 60, 2, 0.8, '#3c404c');
      p.hline(10, 56, 2, '#6a7080');
      return;
    }
    // Motion blur band across the whole disc.
    for (let x = 2; x <= 63; x++) if ((x + f) % 3 === 0) p.px(x, 2, '#9aa0ac');
    const ext = [30, 21, 7, 21][f];
    const dir = f === 3 ? -1 : 1;
    p.capsule(33 - ext, 2 + (f === 1 ? 1 : 0) * dir, 33 + ext, 2 - (f === 1 ? 1 : 0) * dir, 0.75, '#3c404c');
    p.px(33 + ext - 1, 2, '#c4cad4');
    p.px(33 - ext + 1, 2, '#c4cad4');
  },
});

/** Pusher propeller disc: 4 spin frames. Origin = hub. */
sprites.define({
  name: 'gyro_prop',
  w: 5,
  h: 17,
  ox: 2,
  oy: 8,
  frames: 4,
  outline: null,
  draw: (p, f) => {
    // Blurred disc (dithered) with one blade streak sweeping through it.
    for (let y = 0; y < 17; y++) {
      const dy = (y - 8) / 8.5;
      const half = Math.sqrt(Math.max(0, 1 - dy * dy)) * 2.2;
      for (let x = 0; x < 5; x++) if (Math.abs(x - 2) <= half && (x + y + f) % 2 === 0) p.px(x, y, '#dfe6ee');
    }
    const yb = [1, 5, 10, 13][f];
    p.rect(1, yb, 3, 3, '#4a505c');
    p.px(2, yb, '#8a909c');
  },
});

/** Nose vulcan: 0 forward, 1 tilted down. Origin = mount. */
sprites.define({
  name: 'gyro_gun',
  w: 16,
  h: 12,
  ox: 3,
  oy: 4,
  frames: 2,
  draw: (p, f) => {
    const a = f === 1 ? DOWN_ANGLE : 0;
    const at = (t: number, s: number): [number, number] => [3 + Math.cos(a) * t - Math.sin(a) * s, 4 + Math.sin(a) * t + Math.cos(a) * s];
    for (const s of [-0.9, 0.9]) {
      const [x0, y0] = at(1, s);
      const [x1, y1] = at(10, s);
      p.capsule(x0, y0, x1, y1, 0.6, s < 0 ? VP.steel.base : VP.steelDark.base);
    }
    const [hx, hy] = at(0.5, 0);
    shaded(p, (m) => m.circle(hx, hy, 2.3, '#fff'), VP.steelDark);
  },
});

sprites.define({
  name: 'gyro_bomb',
  w: 10,
  h: 6,
  ox: 5,
  oy: 3,
  draw: (p) => {
    p.poly([0, 1, 2, 3, 0, 5], '#3a4422');
    shaded(p, (m) => m.ellipse(5.5, 3, 4, 2.4, '#fff'), ramp('#5a6a3a', 0.3, -0.3));
    p.rect(3, 1, 1, 4, VP.orange);
    p.px(8, 2, '#c8d0a0');
  },
});

// ------------------------------------------------------------------ projectiles

/** Belly bomb: falls, noses over, explodes on contact. */
export class GyroBomb extends Projectile {
  constructor(owner: Entity, x: number, y: number, vx: number, vy: number) {
    super({
      team: 'player',
      owner,
      x,
      y,
      vx,
      vy,
      gravity: 560,
      w: 7,
      h: 7,
      sprite: 'gyro_bomb',
      rotate: true,
      life: 4,
      explode: { radius: 26, damage: 12, size: 'medium', shake: 2 },
    });
    this.offscreenMargin = 120;
  }
}

// ------------------------------------------------------------------ entity

export class Gyro extends Vehicle {
  /** Visual tilt (-2..2, + = nose down). */
  tilt = 0;
  private fireCd = 0;
  private bombCd = 0;
  private rotor = 0;
  private prop = 0;
  private shot = 0;
  private rotorSfx = 0;
  private aimDown = false;
  private washT = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.vehicleName = 'DRAGONFLY';
    this.w = 36;
    this.h = 22;
    this.hp = this.maxHp = 80;
    this.flying = true;
    this.gravityScale = 0;
    this.secondaryAmmo = this.maxSecondaryAmmo = typeof props.ammo === 'number' ? props.ammo : 20;
    this.smokeAt = [PROP[0] - OX, PROP[1] - OY - 3];
    this.debrisColors = ['#3f8470', '#56a084', '#545a68', '#f0902e', '#7fd0ee'];
    this.wreckDelay = 2.4;
  }

  override entryBox(): { x: number; y: number; w: number; h: number } {
    return { x: this.x - 16, y: this.y - 30, w: 32, h: 34 };
  }

  /** No bailing out over a bottomless sky (or in missions flown entirely in the gyro). */
  override canEject(): boolean {
    const def = this.world.level?.def;
    if (def?.startVehicle === this.type) return false;
    return this.world.terrain.floorAt(this.x, this.y - 4, this.y + 240) !== null;
  }

  override onEnter(): void {
    this.vy = Math.min(this.vy, -30);
  }

  drive(inp: ActionState, dt: number): void {
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.bombCd > 0) this.bombCd -= dt;
    const dirX = inp.dirX;
    const dirY = inp.dirY;
    const firing = inp.held('fire');
    // Strafe lock: keep facing while the trigger is held.
    if (dirX !== 0 && !firing) this.facing = dirX;
    this.vx = dirX !== 0 ? approach(this.vx, dirX * SPEED_X, ACCEL * dt) : approach(this.vx, 0, DRAG * dt);
    this.vy = dirY !== 0 ? approach(this.vy, dirY * SPEED_Y, ACCEL * dt) : approach(this.vy, 0, DRAG * dt);
    if (this.onGround && dirY >= 0) this.vy = Math.max(0, this.vy);
    this.aimDown = inp.held('down');
    if (firing && this.fireCd <= 0) this.fireVulcan();
    if (inp.pressed('bomb') && this.bombCd <= 0) this.dropBomb();
    this.moveAndCollide(dt);
    this.animate(dt, true);
    this.rotorSfx -= dt;
    if (this.rotorSfx <= 0) {
      this.rotorSfx = 0.3;
      vsfx(this.world, 'gyro_rotor', this.x, { vol: 0.25 });
    }
  }

  override idle(dt: number): void {
    // Hover in place (or sit parked on the ground).
    this.vx = approach(this.vx, 0, DRAG * dt);
    this.vy = approach(this.vy, 0, DRAG * dt);
    this.moveAndCollide(dt);
    this.animate(dt, !this.onGround);
  }

  private animate(dt: number, powered: boolean): void {
    const fwd = this.vx * this.facing;
    const want = this.onGround ? 0 : fwd > 60 ? 2 : fwd > 20 ? 1 : fwd < -60 ? -2 : fwd < -20 ? -1 : 0;
    this.tilt = approach(this.tilt, want, dt * 8);
    this.rotor += dt * (powered ? 24 : this.driver ? 14 : 0);
    this.prop += dt * (powered ? 30 : 0);
    // Rotor wash kicks up dust near the ground.
    if (powered) {
      this.washT -= dt;
      if (this.washT <= 0) {
        this.washT = 0.08;
        const floor = this.world.terrain.floorAt(this.x, this.y - 2, this.y + 40);
        if (floor) {
          const s = 1 - (floor.y - this.y) / 40;
          if (fxRng.chance(0.4 + s * 0.6)) {
            const side = fxRng.sign();
            this.world.particles.add({ kind: 'smoke', x: this.x + side * fxRng.range(4, 16), y: floor.y - 1, vx: side * fxRng.range(40, 80), vy: fxRng.range(-14, -4), life: 0.4, color: '#d8c8a0', color2: '#a89878', size: 1.5, size2: 3.5, drag: 2 });
          }
        }
      }
    }
  }

  /** Visual hover bob (px). */
  private bob(): number {
    if (this.onGround || this.destroyed) return 0;
    return Math.round(Math.sin(this.age * 3.2) * 1.5);
  }

  private tiltFrame(): number {
    return Math.max(0, Math.min(4, Math.round(this.tilt) + 2));
  }

  /** World position of a body canvas point (accounts for tilt and facing). */
  private bodyPt(cx: number, cy: number): { x: number; y: number } {
    const [x, y] = tiltPt(cx, cy, this.tiltFrame());
    return this.local(x - OX, y - OY + this.bob());
  }

  private fireVulcan(): void {
    const w = this.world;
    this.fireCd = VULCAN_CD;
    const rel = this.aimDown ? DOWN_ANGLE : 0;
    const tiltA = GYRO_TILTS[this.tiltFrame()];
    const relA = rel + tiltA * 0.5;
    const a = this.facing > 0 ? relA : Math.PI - relA;
    const g = this.bodyPt(GUN[0], GUN[1]);
    const side = this.shot++ % 2 === 0 ? -0.9 : 0.9;
    const mx = g.x + Math.cos(a) * 10 - Math.sin(a) * side;
    const my = g.y + Math.sin(a) * 10 + Math.cos(a) * side;
    w.add(new Bullet(this, mx, my, a + w.rng.range(-0.03, 0.03), 480, 1));
    const fx = w.effect('muzzle_flash', mx, my, { fps: 30, z: Z.VEHICLE + 3 });
    fx.rot = a;
    vsfx(w, 'vehicle_vulcan', this.x, { vol: 0.45, pitch: 1.1 });
    w.stats.shotsFired++;
  }

  private dropBomb(): void {
    const w = this.world;
    if (this.secondaryAmmo <= 0) {
      this.bombCd = 0.3;
      vsfx(w, 'out_of_ammo', this.x);
      w.floatText('EMPTY', this.x, this.top - 6, '#d0d0d8', 0.7);
      return;
    }
    this.secondaryAmmo--;
    this.bombCd = BOMB_CD;
    this.shoutTime = 0;
    const pyl = this.bodyPt(PYLON[0] + 2, PYLON[1]);
    w.add(new GyroBomb(this, pyl.x, pyl.y + 2, this.vx * 0.6 + this.facing * 25, 40 + Math.max(0, this.vy)));
    vsfx(w, 'mech_missile', this.x, { vol: 0.35, pitch: 0.7 });
  }

  override onDestroyed(): void {
    this.gravityScale = 1;
    this.vy = Math.min(this.vy, -60);
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.blinkHidden) return;
    const flip = this.facing < 0;
    const flash = this.flashOn;
    const t = this.tiltFrame();
    const bob = this.bob();
    const x = Math.round(this.x);
    const y = Math.round(this.y) + bob;
    if (this.destroyed) {
      // Spin down out of the sky (rotate around the body's middle, 22px above the skids).
      const th = this.destroyTimer * 7 * this.facing;
      const cx = this.x;
      const cy = this.y - 22;
      sprites.get('gyro_body').draw(g, cx - 22 * Math.sin(th), cy + 22 * Math.cos(th), t + 5, { flip, flash, rot: th });
      return;
    }
    if (this.driver) {
      const s = this.bodyPt(SEAT[0], SEAT[1]);
      this.drawPilot(g, s.x, s.y);
    }
    const variant = !this.driver ? 0 : this.secondaryAmmo > 0 ? 1 : 2;
    const pr = this.bodyPt(PROP[0], PROP[1]);
    const spinning = this.rotor > 0 && (this.driver !== null || !this.onGround);
    sprites.get('gyro_body').draw(g, x, y, t + 5 * variant, { flip, flash });
    sprites.get('gyro_prop').draw(g, pr.x, pr.y, spinning ? Math.floor(this.prop) % 4 : 0, { flip });
    const gp = this.bodyPt(GUN[0], GUN[1]);
    sprites.get('gyro_gun').draw(g, gp.x, gp.y, this.aimDown && this.driver ? 1 : 0, { flip, flash });
    const hub = this.bodyPt(HUB[0], HUB[1]);
    const rf = spinning ? Math.floor(this.rotor) % 4 : 4;
    sprites.get('gyro_rotor').draw(g, hub.x, hub.y, rf, { flip, flash });
    this.renderEnterHint(g);
  }
}

registerEntity('gyro', 'vehicle', (_w, s) => new Gyro(s.props ?? {}), 'DRAGONFLY gyrocopter: free 8-way flight, nose vulcan (down-tilt), belly bombs (BOMB, props.ammo=20). 80 HP. Use LevelDef.startVehicle="gyro" for flying missions');
