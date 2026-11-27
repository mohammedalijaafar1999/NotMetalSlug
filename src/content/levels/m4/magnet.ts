// m4_magnet - the Legion's scrapyard gantry crane with a lifting electromagnet, straddling the road
// at the end of the warehouse district. It ends the BULLDOG stretch: when a vehicle rolls under
// it, a warning beacon and siren go off ("MAGNET!"), the trolley tracks the vehicle, the magnet
// slams down, the pilot is thrown clear (with a moment of invulnerability) and the vehicle is
// hoisted off the top of the screen. On foot you simply walk under it. It acts once.
// Place it on flat ground (y omitted); the legs stand at x +-84 and the girder spans ~160 px of the
// road, so keep the road between the legs free of other set pieces.

import { registerEntity } from '../../../game/registry';
import { Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { fxRng } from '../../../engine/rng';
import { sprites } from '../../../engine/sprites';
import { PixelArt, shade } from '../../../engine/pixelart';
import { isVehicle, type Vehicle } from '../../../game/vehicle';
import { D4, glow } from '../../themes/m4/decor';

const GW = 184;
const GH = 156;
/** Girder underside (rail) height above the ground. */
const RAIL = GH - 22;
/** Magnet hang height (bottom of the magnet) above the ground while idle. */
const HANG = 92;
const ARM_TIME = 0.75;
const GRAB_RANGE = 118;

const PAINT = '#8a7434';
const PAINT_L = '#ae9446';
const PAINT_D = '#56461e';

sprites.define({
  name: 'm4_gantry',
  w: GW,
  h: GH,
  ox: GW / 2,
  oy: GH,
  draw: (p: PixelArt) => {
    const B = GH - 1;
    // Lattice legs.
    for (const lx of [4, GW - 16]) {
      p.rect(lx, 14, 12, B - 14, PAINT_D);
      p.rect(lx + 1, 14, 2, B - 14, PAINT);
      p.rect(lx + 9, 14, 2, B - 14, PAINT);
      p.rect(lx + 1, 14, 1, B - 14, PAINT_L);
      for (let y = 22; y < B - 8; y += 12) {
        p.line(lx + 3, y, lx + 9, y + 10, PAINT, 1);
        p.line(lx + 9, y, lx + 3, y + 10, shade(PAINT, -0.2), 1);
      }
      // Feet on rail bogies.
      p.rect(lx - 4, B - 6, 20, 6, D4.iron);
      p.rect(lx - 4, B - 6, 20, 1, D4.ironL);
      for (let k = 0; k < 3; k++) p.circle(lx + k * 6, B - 1, 2, D4.ironD);
      // Knee braces under the girder.
      const inner = lx < GW / 2 ? lx + 12 : lx;
      const dir = lx < GW / 2 ? 1 : -1;
      p.line(inner, 40, inner + dir * 20, 22, PAINT, 2);
    }
    // Box girder with hazard stripes along its face.
    p.rect(0, 8, GW, 14, PAINT);
    p.rect(0, 8, GW, 1, PAINT_L);
    p.rect(0, 21, GW, 1, PAINT_D);
    for (let x = 2; x < GW - 2; x++) if ((x >> 2) % 2 === 0) p.rect(x, 12, 1, 6, '#1c1824');
    for (let x = 2; x < GW - 2; x++) if ((x >> 2) % 2 === 1) p.rect(x, 12, 1, 6, '#c8a838');
    p.rect(0, 11, GW, 1, PAINT_D);
    p.rect(0, 18, GW, 1, PAINT_D);
    // Rail under the girder.
    p.rect(14, 22, GW - 28, 2, D4.iron);
    // Operator cab hanging at the left, a Legion helmet in the window.
    p.rect(22, 22, 22, 16, PAINT);
    p.rect(22, 22, 22, 1, PAINT_L);
    p.rect(25, 25, 16, 8, '#1c1824');
    p.rect(26, 26, 14, 6, shade('#f2b866', -0.35));
    p.ellipse(33, 30, 3, 2, '#3a4a2a');
    p.rect(30, 31, 6, 2, '#3a4a2a');
    // Beacon housing on top.
    p.rect(GW / 2 - 3, 4, 7, 4, D4.iron);
    p.rect(GW / 2 - 2, 2, 5, 2, '#5a2420');
    // Weathering.
    for (let i = 0; i < 160; i++) {
      const x = (i * 37) % GW;
      const y = 8 + ((i * 53) % (B - 8));
      if (p.opaque(x, y) && i % 3 === 0) p.px(x, y, i % 2 ? D4.rust : shade(PAINT, -0.3));
    }
  },
});

sprites.define({
  name: 'm4_magnet',
  w: 36,
  h: 16,
  frames: 2,
  ox: 18,
  oy: 16,
  draw: (p: PixelArt, f: number) => {
    // Lifting eye + chains anchor.
    p.ring(18, 2.5, 2.5, D4.ironL, 1);
    p.rect(10, 4, 16, 3, D4.iron);
    p.rect(10, 4, 16, 1, D4.ironL);
    // Disc body: top plate, coil band, bottom face.
    p.rect(2, 7, 32, 3, D4.iron);
    p.rect(2, 7, 32, 1, D4.ironH);
    p.rect(2, 10, 32, 3, f ? '#b87a3a' : '#7a5a3a');
    p.rect(2, 10, 32, 1, f ? '#e0a860' : '#9a7448');
    p.rect(1, 13, 34, 3, D4.ironD);
    p.rect(1, 13, 34, 1, D4.iron);
    if (f) {
      p.rect(2, 15, 32, 1, '#a0d8ff');
      p.px(6, 15, '#ffffff');
      p.px(20, 15, '#ffffff');
      p.px(29, 15, '#ffffff');
    }
    // Hazard stripes on the side.
    for (let x = 4; x < 32; x += 6) p.rect(x, 8, 2, 1, '#c8a838');
  },
});

type MState = 'idle' | 'arm' | 'drop' | 'clamp' | 'lift' | 'done';

export class MagnetCrane extends Entity {
  state: MState = 'idle';
  stateTime = 0;
  trolleyX = 0;
  /** Bottom of the magnet (world y). */
  magY = 0;
  groundY = 0;
  target: Vehicle | null = null;
  /** Vehicle being carried (removed from the world, drawn here). */
  carried: Vehicle | null = null;
  private carryDy = 0;
  private sirenT = 0;
  /** Vehicles taken so far (tests). */
  taken = 0;

  constructor() {
    super();
    this.w = GW;
    this.h = GH;
    this.z = Z.BACK_PROP;
    this.hittable = false;
    this.persistent = true;
  }

  override spawned(): void {
    this.groundY = this.y;
    this.trolleyX = this.x;
    this.magY = this.groundY - HANG;
  }

  private setState(s: MState): void {
    this.state = s;
    this.stateTime = 0;
  }

  private findVehicle(): Vehicle | null {
    for (const e of this.world.entities) {
      if (e.dead || !isVehicle(e)) continue;
      const v = e as Vehicle;
      if (v.destroyed || !v.driver || v.flying) continue;
      if (Math.abs(v.x - this.x) < GRAB_RANGE && Math.abs(v.y - this.groundY) < 40) return v;
    }
    return null;
  }

  override update(dt: number): void {
    this.stateTime += dt;
    const W = this.world;
    const t = this.target;
    if (t && (t.dead || t.destroyed) && this.state !== 'clamp' && this.state !== 'lift') {
      this.target = null;
      this.setState('idle');
    }
    switch (this.state) {
      case 'idle': {
        this.magY += (this.groundY - HANG - this.magY) * Math.min(1, dt * 3);
        this.trolleyX += (this.x - this.trolleyX) * Math.min(1, dt * 2);
        const v = this.findVehicle();
        if (v && this.taken === 0) {
          this.target = v;
          this.setState('arm');
          W.sfx('alarm', this.x, { vol: 0.8 });
          W.sfx('boss_charge', this.x, { vol: 0.6 });
          W.floatText('MAGNET!', this.trolleyX, this.magY + 14, '#ff5a3a', 1.4);
        }
        break;
      }
      case 'arm': {
        this.follow(dt, 220);
        this.sirenT -= dt;
        if (this.sirenT <= 0) {
          this.sirenT = 0.12;
          W.particles.sparks(this.trolleyX + fxRng.range(-14, 14), this.magY, 2, '#a0d8ff', 70);
        }
        if (this.stateTime >= ARM_TIME) this.setState('drop');
        break;
      }
      case 'drop': {
        this.follow(dt, 320);
        const v = this.target!;
        const goal = v.top - 1;
        this.magY = Math.min(goal, this.magY + 460 * dt);
        if (this.magY >= goal) this.grab(v);
        break;
      }
      case 'clamp': {
        const v = this.carried!;
        v.x = this.trolleyX;
        v.y = this.magY + this.carryDy;
        if (fxRng.chance(dt * 20)) W.particles.sparks(v.x + fxRng.range(-12, 12), this.magY + 1, 2, '#a0d8ff', 90);
        if (this.stateTime > 0.45) this.setState('lift');
        break;
      }
      case 'lift': {
        const v = this.carried!;
        this.magY -= Math.min(150, 40 + this.stateTime * 160) * dt;
        this.trolleyX += 26 * dt;
        v.x = this.trolleyX;
        v.y = this.magY + this.carryDy;
        if (this.stateTime % 0.36 < dt) W.sfx('engine', this.x, { vol: 0.5, pitch: 0.7 });
        if (v.y < W.camera.y - 40) {
          this.carried = null;
          this.setState('done');
        }
        break;
      }
      case 'done':
        this.magY = Math.max(this.magY - 120 * dt, W.camera.y - 200);
        break;
    }
  }

  private follow(dt: number, speed: number): void {
    const v = this.target;
    if (!v) return;
    const d = v.x - this.trolleyX;
    this.trolleyX += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
  }

  private grab(v: Vehicle): void {
    const W = this.world;
    const d = v.driver;
    if (d) {
      d.exitVehicle(true);
      d.invuln = Math.max(d.invuln, 1.8);
    }
    v.canBeEntered = false;
    v.remove();
    W.invalidateTargets();
    this.carried = v;
    this.carryDy = v.y - this.magY;
    this.target = null;
    this.taken++;
    W.sfx('metal_hit', v.x, { vol: 1 });
    W.sfx('vehicle_exit', v.x, { vol: 0.8 });
    W.shake(3, 0.3);
    W.particles.sparks(v.x, this.magY, 14, '#a0d8ff', 160);
    this.setState('clamp');
  }

  override render(g: CanvasRenderingContext2D): void {
    const time = this.world.time;
    sprites.get('m4_gantry').draw(g, this.x, this.groundY);
    const railY = this.groundY - RAIL;
    // Trolley riding the rail.
    const tx = Math.round(this.trolleyX);
    g.fillStyle = D4.ink;
    g.fillRect(tx - 11, railY - 1, 22, 9);
    g.fillStyle = PAINT_D;
    g.fillRect(tx - 10, railY, 20, 7);
    g.fillStyle = PAINT;
    g.fillRect(tx - 10, railY, 20, 1);
    g.fillStyle = D4.iron;
    g.fillRect(tx - 8, railY - 2, 3, 2);
    g.fillRect(tx + 5, railY - 2, 3, 2);
    // Chains down to the magnet's eye.
    const eyeY = Math.round(this.magY) - 16;
    g.fillStyle = '#2a2632';
    for (const cx of [tx - 2, tx + 2]) for (let y = railY + 7; y < eyeY + 2; y += 2) g.fillRect(cx, y, 1, 1);
    g.fillStyle = '#4a4658';
    for (const cx of [tx - 2, tx + 2]) for (let y = railY + 8; y < eyeY + 2; y += 2) g.fillRect(cx, y, 1, 1);
    // Carried vehicle hangs under the magnet.
    if (this.carried) this.carried.render(g);
    const live = this.state === 'arm' || this.state === 'drop' || this.state === 'clamp' || this.state === 'lift';
    const energized = live && (this.state !== 'arm' || Math.floor(time * 14) % 2 === 0);
    sprites.get('m4_magnet').draw(g, tx, Math.round(this.magY), energized ? 1 : 0);
    if (energized) glow(g, tx, this.magY - 2, 16, '#a0d8ff', 0.4);
    // Beacon: slow blink idle, fast when armed.
    const period = this.state === 'idle' ? 1.4 : 0.25;
    if (this.state !== 'done' && (time % period) < period * 0.45) {
      const bx = this.x;
      const by = this.groundY - GH + 3;
      glow(g, bx, by, this.state === 'idle' ? 5 : 9, '#ff4038', 0.9);
      g.fillStyle = '#ff8a70';
      g.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 2);
    }
  }
}

registerEntity(
  'm4_magnet',
  'misc',
  () => new MagnetCrane(),
  'Mission 4 set piece: gantry crane with an electromagnet over the road (legs at x+-84, place on flat ground, y omitted). When a piloted ground vehicle comes within ~118 px it sounds the alarm ("MAGNET!"), tracks it, slams down, throws the pilot clear (1.8 s invulnerable) and hoists the vehicle off-screen. Acts once; harmless on foot.',
);
