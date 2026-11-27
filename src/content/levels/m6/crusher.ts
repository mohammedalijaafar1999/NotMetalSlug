// m6_crusher - a hydraulic press hammering the factory floor (IRON CITADEL).
// Cycle: UP (safe to pass) -> WARN (0.75 s: red lamp blinks + beeps, the head jerks up and shudders,
// steam hisses, the hazard plate on the floor glows red) -> SLAM (fast) -> HOLD (dust, shake) -> RISE.
// The head is solid steel (blocks walking and bullets). Anything caught under it when it slams is
// crushed: players, soldiers, robots, crates, barrels; a driven vehicle loses a big chunk of armour.
// props.scrap = true makes it a SCRAP PRESS (wider head, high enough for a STRIDER to walk under):
// it slams as soon as a vehicle rolls under it and wrecks it outright (the pilot is thrown clear).
//   spawn: { type: 'm6_crusher', x: <centre>, y: <floor y>, trigger: <early>,
//            props: { cycle: 3.4, offset: 0 (s), clearance: 44, scrap: false } }

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { shade, type PixelArt } from '../../../engine/pixelart';
import { rectsOverlap, type Rect } from '../../../engine/math';
import { registerEntity } from '../../../game/registry';
import { Actor, Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { Hostage } from '../../../game/hostage';
import type { Solid } from '../../../game/terrain';
import { ramp, shaded } from '../../vehicles/art';
import { M6 } from '../../themes/m6/palette';

const HEAD_H = 24;
const HOUSING_H = 22;
const WARN = 0.75;
const SLAM = 0.13;
const HOLD = 0.42;
const RISE = 0.9;

function headArt(w: number): (p: PixelArt, f: number) => void {
  return (p) => {
    const steel = ramp(M6.steelL, 0.3, -0.34);
    // block body
    shaded(p, (m) => m.rect(0, 0, w, HEAD_H - 5, '#fff'), steel);
    // ram socket on top
    shaded(p, (m) => m.rect(w / 2 - 7, 0, 14, 4, '#fff'), ramp(M6.iron, 0.3, -0.3));
    // rivet rows
    for (let x = 3; x < w - 2; x += 6) {
      p.px(x, 5, M6.steelLLL);
      p.px(x + 1, 6, M6.steelDD);
    }
    // hazard band
    for (let y = 9; y < 15; y++) for (let x = 1; x < w - 1; x++) p.px(x, y, (x + y) % 8 < 4 ? M6.hazard : M6.hazardD);
    p.rect(1, 9, w - 2, 1, shade(M6.hazard, 0.25));
    p.rect(1, 15, w - 2, 1, M6.steelD);
    // crushing teeth along the bottom
    for (let x = 0; x < w; x++) {
      const tooth = x % 6;
      const hgt = tooth === 0 || tooth === 5 ? 1 : tooth === 1 || tooth === 4 ? 3 : 4;
      for (let y = 0; y < hgt; y++) p.px(x, HEAD_H - 5 + y, y === 0 ? M6.steelD : tooth < 3 ? M6.steelL : M6.steel);
    }
  };
}

function housingArt(w: number): (p: PixelArt, f: number) => void {
  return (p, f) => {
    const W = w + 16;
    const iron = ramp(M6.iron, 0.3, -0.34);
    shaded(p, (m) => m.rect(0, 4, W, HOUSING_H - 4, '#fff'), iron);
    // hydraulic cylinders on top
    for (const cx of [6, W - 12]) shaded(p, (m) => m.rect(cx, 0, 6, 6, '#fff'), ramp(M6.steelL, 0.3, -0.3));
    for (let x = 3; x < W - 2; x += 7) {
      p.px(x, 7, M6.steelLL);
      p.px(x + 1, 8, M6.steelDD);
      p.px(x, HOUSING_H - 4, M6.steelLL);
    }
    // gland where the ram comes out
    shaded(p, (m) => m.rect(W / 2 - 6, HOUSING_H - 3, 12, 3, '#fff'), ramp(M6.steelD, 0.4, -0.3));
    // warning lamp (frame 1 = lit)
    p.rect(W / 2 - 3, 9, 6, 5, M6.outline);
    p.rect(W / 2 - 2, 10, 4, 3, f ? M6.red : M6.redD);
    if (f) {
      p.px(W / 2 - 2, 10, '#ffd0c0');
      p.px(W / 2 - 1, 10, '#ff9080');
    }
    // stencil arrows pointing down on both sides
    for (const ax of [W / 2 - 14, W / 2 + 10]) {
      p.rect(ax + 1, 10, 2, 3, M6.hazard);
      p.poly([ax - 0.5, 13, ax + 4.5, 13, ax + 2, 16], M6.hazard);
    }
  };
}

for (const w of [36, 48]) {
  sprites.define({ name: `m6_press_head_${w}`, w, h: HEAD_H, ox: w / 2, oy: HEAD_H, draw: headArt(w) });
  sprites.define({ name: `m6_press_housing_${w}`, w: w + 16, h: HOUSING_H, ox: (w + 16) / 2, oy: 0, frames: 2, draw: housingArt(w) });
}

type PressState = 'up' | 'warn' | 'slam' | 'hold' | 'rise';

export class Crusher extends Entity {
  state: PressState = 'up';
  stateTime = 0;
  /** Head bottom offset above the floor (0 = slammed shut). */
  lift = 44;
  clearance = 44;
  cycle = 3.4;
  scrap = false;
  headW = 36;
  private solid: Solid | null = null;
  private hitIds = new Set<number>();
  private upTime = 1;
  private beeped = 0;
  /** Length of the current telegraph (shorter when a scrap press catches a vehicle). */
  private warnT = WARN;

  constructor() {
    super();
    this.z = Z.PROP + 2;
    this.team = 'neutral';
    this.hittable = false;
  }

  override spawned(): void {
    const P = this.props;
    this.scrap = !!P.scrap;
    this.headW = this.scrap ? 48 : 36;
    this.clearance = typeof P.clearance === 'number' ? P.clearance : this.scrap ? 58 : 44;
    this.cycle = typeof P.cycle === 'number' ? P.cycle : this.scrap ? 3.0 : 3.4;
    this.lift = this.clearance;
    this.upTime = Math.max(0.4, this.cycle - (WARN + SLAM + HOLD + RISE));
    // phase offset: start part-way through the UP wait
    const off = typeof P.offset === 'number' ? P.offset : 0;
    this.stateTime = ((off % this.cycle) + this.cycle) % this.cycle;
    if (this.stateTime > this.upTime) this.stateTime = this.upTime * 0.5;
    this.w = this.headW;
    this.h = this.clearance + HEAD_H + 8 + HOUSING_H;
    // One solid column from the housing down to the head's face, so nothing can stand on the head.
    this.solid = this.world.terrain.addSolid(this.x - this.headW / 2, this.housingTop, this.headW, this.headBottom - 2 - this.housingTop, { owner: this, material: 'metal', dynamic: true });
  }

  /** World y of the head's bottom (crushing face). */
  get headBottom(): number {
    return this.y - this.lift;
  }
  get headTop(): number {
    return this.headBottom - HEAD_H;
  }
  /** Bottom of the housing (top of the ram's travel). */
  get housingBottom(): number {
    return this.y - this.clearance - HEAD_H - 8;
  }
  get housingTop(): number {
    return this.housingBottom - HOUSING_H;
  }

  /** Is the press about to come down / coming down? (tests, AI) */
  get dangerous(): boolean {
    return this.state === 'warn' || this.state === 'slam' || this.state === 'hold';
  }

  override remove(): void {
    if (this.solid) this.world.terrain.remove(this.solid);
    this.solid = null;
    super.remove();
  }

  private set(s: PressState): void {
    this.state = s;
    this.stateTime = 0;
  }

  private vehicleUnder(): boolean {
    for (const p of this.world.players) {
      const v = p.vehicle;
      if (v && !v.dead && Math.abs(v.x - this.x) < this.headW / 2 + 2) return true;
    }
    return false;
  }

  override update(dt: number): void {
    this.stateTime += dt;
    const vis = this.onScreen(24);
    switch (this.state) {
      case 'up':
        this.lift = this.clearance;
        if (this.stateTime >= this.upTime || (this.scrap && this.stateTime > 0.15 && this.vehicleUnder())) {
          this.set('warn');
          this.beeped = 0;
          this.hitIds.clear();
          this.warnT = this.scrap && this.vehicleUnder() ? 0.42 : WARN;
        }
        break;
      case 'warn': {
        const warn = this.warnT;
        const k = this.stateTime / warn;
        // wind-up: jerk up a little, then shudder
        this.lift = this.clearance + Math.min(3, k * 9) + (k > 0.4 && Math.floor(this.stateTime * 40) % 2 ? 1 : 0);
        if (vis && this.beeped === 0) {
          this.world.sfx('mine_beep', this.x, { vol: 0.75, pitch: 0.8 });
          this.beeped = 1;
        }
        if (vis && this.beeped === 1 && k > 0.5) {
          this.world.sfx('mine_beep', this.x, { vol: 0.75, pitch: 0.8 });
          this.beeped = 2;
        }
        if (vis && fxRng.chance(dt * 14)) {
          const sx = this.x + (fxRng.chance(0.5) ? -1 : 1) * (this.headW / 2 + 4);
          this.world.particles.add({ kind: 'smoke', x: sx, y: this.housingBottom - 6, vx: fxRng.range(-12, 12), vy: fxRng.range(-30, -10), life: 0.5, color: '#c8c0c8', color2: '#8a8490', size: 1, size2: 3, alpha: 0.6, drag: 2 });
        }
        if (this.stateTime >= warn) this.set('slam');
        break;
      }
      case 'slam': {
        const k = Math.min(1, this.stateTime / SLAM);
        this.lift = (this.clearance + 3) * (1 - k * k);
        this.crush();
        if (k >= 1) {
          this.lift = 0;
          this.set('hold');
          this.impact(vis);
        }
        break;
      }
      case 'hold':
        this.lift = 0;
        this.crush();
        if (this.stateTime >= HOLD) this.set('rise');
        break;
      case 'rise': {
        const k = Math.min(1, this.stateTime / RISE);
        this.lift = this.clearance * (1 - (1 - k) * (1 - k));
        if (k >= 1) this.set('up');
        break;
      }
    }
    if (this.solid) {
      this.world.terrain.moveSolid(this.solid, this.x - this.headW / 2, this.housingTop);
      this.solid.h = Math.max(4, this.headBottom - 2 - this.housingTop);
    }
  }

  private impact(vis: boolean): void {
    const w = this.world;
    if (!vis) return;
    w.shake(2, 0.18);
    w.sfx('mech_step', this.x, { vol: 0.9, pitch: 0.8 });
    w.sfx('metal_hit', this.x, { vol: 0.5, pitch: 0.7 });
    w.particles.dust(this.x - this.headW / 2 - 2, this.y, 4, '#8a8490');
    w.particles.dust(this.x + this.headW / 2 + 2, this.y, 4, '#8a8490');
    w.particles.sparks(this.x - this.headW / 2, this.y - 2, 4, '#ffe080', 120);
    w.particles.sparks(this.x + this.headW / 2, this.y - 2, 4, '#ffe080', 120);
  }

  /** Damage everything under the descending head. */
  private crush(): void {
    const r: Rect = { x: this.x - this.headW / 2 + 1, y: this.headTop, w: this.headW - 2, h: HEAD_H };
    for (const e of this.world.entities) {
      if (e.dead || this.hitIds.has(e.id) || e === this) continue;
      if (!(e instanceof Actor)) continue;
      if (!rectsOverlap(r, e.box)) continue;
      const anyE = e as any;
      if (anyE.isPlayer) {
        if (anyE.state !== 'play' && anyE.state !== 'respawn') continue;
        this.hitIds.add(e.id);
        e.damage({ amount: 99, kind: 'crush', x: e.x, y: this.headBottom, dir: e.x < this.x ? -1 : 1 });
      } else if (anyE.isVehicle) {
        this.hitIds.add(e.id);
        if (this.scrap) {
          if (!anyE.destroyed) {
            anyE.startDestruction();
            this.world.shake(4, 0.3);
            this.world.particles.debris(e.x, e.y - 10, 14, [M6.steelL, M6.steel, '#4f9a80', '#24514a'], 200);
          }
        } else if (anyE.driver) {
          e.damage({ amount: 2, kind: 'crush', x: e.x, y: this.headBottom });
        }
      } else if (e instanceof Hostage) {
        continue;
      } else if (e.hittable && (e.team === 'enemy' || e.team === 'neutral')) {
        this.hitIds.add(e.id);
        e.damage({ amount: 99, kind: 'crush', owner: null, x: e.x, y: this.headBottom, dir: e.x < this.x ? -1 : 1 });
      }
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const fy = Math.round(this.y);
    const hb = Math.round(this.headBottom);
    const hTop = Math.round(this.housingBottom) - HOUSING_H;
    const W = this.headW;
    // supply pipes running up out of view
    for (const px of [x - W / 2 - 2, x + W / 2 - 2]) {
      g.fillStyle = M6.outline;
      g.fillRect(px - 1, hTop - 240, 6, 240);
      g.fillStyle = M6.iron;
      g.fillRect(px, hTop - 240, 4, 240);
      g.fillStyle = M6.ironL;
      g.fillRect(px, hTop - 240, 1, 240);
    }
    // guide rails down to the floor
    for (const rx of [x - W / 2 - 5, x + W / 2 + 2]) {
      g.fillStyle = M6.outline;
      g.fillRect(rx - 1, hTop + HOUSING_H, 5, fy - hTop - HOUSING_H);
      g.fillStyle = M6.ironD;
      g.fillRect(rx, hTop + HOUSING_H, 3, fy - hTop - HOUSING_H);
      g.fillStyle = M6.iron;
      g.fillRect(rx, hTop + HOUSING_H, 1, fy - hTop - HOUSING_H);
    }
    // hazard plate on the floor (glows red during the telegraph)
    const warn = this.state === 'warn' || this.state === 'slam';
    const blink = warn && Math.floor(this.stateTime * 12) % 2 === 0;
    for (let i = 0; i < W + 6; i++) {
      g.fillStyle = (i + Math.floor(fy)) % 6 < 3 ? (blink ? M6.red : M6.hazard) : M6.hazardD;
      g.fillRect(x - W / 2 - 3 + i, fy - 1, 1, 2);
    }
    if (warn) {
      g.globalAlpha = blink ? 0.3 : 0.15;
      g.fillStyle = M6.red;
      g.fillRect(x - W / 2, hb, W, fy - hb);
      g.globalAlpha = 1;
    }
    // ram
    const ramTop = Math.round(this.housingBottom);
    const ramBot = hb - HEAD_H + 2;
    if (ramBot > ramTop) {
      g.fillStyle = M6.outline;
      g.fillRect(x - 4, ramTop, 8, ramBot - ramTop);
      g.fillStyle = M6.steelLL;
      g.fillRect(x - 3, ramTop, 6, ramBot - ramTop);
      g.fillStyle = M6.steelLLL;
      g.fillRect(x - 2, ramTop, 1, ramBot - ramTop);
      g.fillStyle = M6.steelL;
      g.fillRect(x + 2, ramTop, 1, ramBot - ramTop);
    }
    sprites.get(`m6_press_head_${W}`).draw(g, x, hb);
    const lit = warn ? (blink ? 1 : 0) : 0;
    sprites.get(`m6_press_housing_${W}`).draw(g, x, hTop, lit);
  }
}

registerEntity(
  'm6_crusher',
  'hazard',
  () => new Crusher(),
  'Hydraulic press (mission 6): x = centre, y = floor; cycles UP -> WARN (0.75 s red lamp, beeps, shudder, glowing ' +
    'floor plate) -> SLAM -> HOLD -> RISE. The head is solid; anything under it when it slams is crushed (players, ' +
    'enemies, props; vehicles lose armour). props.cycle (s, default 3.4), offset (s), clearance (px, default 44), ' +
    'scrap (true = SCRAP PRESS: 48 px head, 58 px clearance, slams on vehicles at once and wrecks them).',
);
