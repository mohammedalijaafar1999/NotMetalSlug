// m3_cablecar: the FROSTBITE PASS cable car. A red Legion gondola hangs from a sagging haul cable
// strung across the gorge; players ride on its roof walkway while jetpacks, drones, paratroopers
// and a gunship attack.
//
// How it works:
//  - The roof is a dynamic terrain solid (the walkable surface; bullets and shells stop on the
//    cabin body). Actors standing on it are carried by Actor.moveAndCollide (terrain dx/dy); the cabin
//    moves itself to the front of world.entities so it always moves BEFORE its riders in a step.
//  - Waits at its dock (spawn x) until a player stands on the roof, rings, and leaves once everybody
//    is aboard (or after a short grace time). Accelerates, cruises at props.speed, brakes into
//    props.stops and the far dock (props.to).
//  - Stops: { x, lock } - the cabin brakes at x and stays put until the camera lock whose x is
//    `lock` has been fought through (state 'done'), then carries on. Put that lock's x so the cabin
//    sits inside the locked view.
//  - Railings: players (and player vehicles) above the roof are kept over it on every side that faces
//    the gorge (both sides during the ride; the far side while docked; the near side once arrived), and
//    airborne riders are carried along so jumps on a moving cabin feel natural.
//
// props: cable  [[x, y], ...] cable support points (ascending x; y = cable height there). The cabin's
//               roof hangs HANG (44) px under the cable. Default: a short level span above the spawn.
//        sag    px the cable sags in the middle of each span (default 40)
//        to     arrival dock x (cabin centre; default: last support x)
//        stops  [{ x, lock }] mid-ride stops (see above)
//        speed  cruise speed px/s (default 48)
//        ends   [x0, x1] how far the cable is drawn (default: first/last support +- 60)
//   Spawn it at its departure dock: { type: 'm3_cablecar', x: dockCentreX, trigger: <well before> }.

import { Entity, Actor } from '../../../game/entity';
import { registerEntity } from '../../../game/registry';
import { Z } from '../../../game/constants';
import type { Solid } from '../../../game/terrain';
import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { VIEW_W } from '../../../engine/renderer';
import { CAB_W, CAB_H, HANG, CAB_SPRITE } from './art';

export interface CableStop {
  x: number;
  /** Camera-left x of the lock that must be cleared before the cabin moves on. */
  lock?: number;
}

type Mode = 'dock' | 'board' | 'ride' | 'halt' | 'arrived';

const ACCEL = 26;
const DECEL = 30;

export class CableCar extends Entity {
  supports: [number, number][] = [];
  sag = 40;
  toX = 0;
  stops: CableStop[] = [];
  speed = 48;
  drawFrom = 0;
  drawTo = 0;
  mode: Mode = 'dock';
  /** Cabin centre x along the cable. */
  pos = 0;
  v = 0;
  solid: Solid | null = null;
  private modeT = 0;
  private stopIdx = 0;
  private humT = 0;
  private wheel = 0;
  private lampT = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.team = 'neutral';
    this.hittable = false;
    this.persistent = true;
    this.z = Z.BACK_PROP;
    this.w = CAB_W;
    this.h = CAB_H;
    this.props = props;
  }

  override spawned(): void {
    const p = this.props;
    const cable = Array.isArray(p.cable) && p.cable.length >= 2 ? (p.cable as [number, number][]) : null;
    this.supports = cable
      ? cable.map(([x, y]) => [x, y] as [number, number]).sort((a, b) => a[0] - b[0])
      : [
          [this.x, this.y - 40 - HANG],
          [this.x + 300, this.y - 40 - HANG],
        ];
    this.sag = p.sag ?? 40;
    this.speed = p.speed ?? 48;
    this.stops = ((p.stops ?? []) as CableStop[]).slice().sort((a, b) => a.x - b.x);
    const first = this.supports[0][0];
    const last = this.supports[this.supports.length - 1][0];
    this.pos = Math.max(first, Math.min(last, this.x));
    this.toX = Math.max(this.pos, Math.min(last, p.to ?? last));
    this.drawFrom = p.ends?.[0] ?? first - 60;
    this.drawTo = p.ends?.[1] ?? last + 60;
    this.y = this.cableY(this.pos) + HANG;
    this.x = this.pos;
    this.solid = this.world.terrain.addSolid(this.pos - CAB_W / 2, this.y, CAB_W, CAB_H, { owner: this, material: 'metal', dynamic: true });
    // Move BEFORE everything else each step so riders are carried by this step's terrain delta.
    const list = this.world.entities;
    const i = list.indexOf(this);
    if (i > 0) {
      list.splice(i, 1);
      list.unshift(this);
    }
  }

  /** Cable height at x: piecewise parabolas sagging between supports (straight beyond the ends). */
  cableY(x: number): number {
    const S = this.supports;
    if (x <= S[0][0]) {
      const [x0, y0] = S[0];
      const [x1, y1] = S[1];
      const slope = (y1 - y0) / (x1 - x0) + (4 * this.sag) / (x1 - x0);
      return y0 + slope * (x - x0);
    }
    for (let i = 0; i < S.length - 1; i++) {
      const [x0, y0] = S[i];
      const [x1, y1] = S[i + 1];
      if (x <= x1) {
        const t = (x - x0) / (x1 - x0);
        return y0 + (y1 - y0) * t + this.sag * 4 * t * (1 - t);
      }
    }
    const n = S.length - 1;
    const [x0, y0] = S[n - 1];
    const [x1, y1] = S[n];
    const slope = (y1 - y0) / (x1 - x0) - (4 * this.sag) / (x1 - x0);
    return y1 + slope * (x - x1);
  }

  /** Roof (walkable surface) y when the cabin centre is at x. */
  roofAt(x: number): number {
    return this.cableY(x) + HANG;
  }

  /** Seconds spent in the current mode. */
  get modeTime(): number {
    return this.modeT;
  }

  get moving(): boolean {
    return this.mode === 'ride';
  }

  /** Next x the cabin brakes at. */
  private target(): { x: number; stop: CableStop | null } {
    while (this.stopIdx < this.stops.length && this.stops[this.stopIdx].x < this.pos - 0.5) this.stopIdx++;
    const s = this.stops[this.stopIdx];
    if (s && s.x < this.toX) return { x: s.x, stop: s };
    return { x: this.toX, stop: null };
  }

  /** Player-side actors (players on foot, driven vehicles): standing on the roof, or above it (jumping). */
  private riders(): { a: Actor; onRoof: boolean; aboard: boolean }[] {
    const out: { a: Actor; onRoof: boolean; aboard: boolean }[] = [];
    const s = this.solid!;
    for (const p of this.world.players) {
      if (p.state !== 'play' && p.state !== 'respawn' && p.state !== 'dying' && p.state !== 'vehicle') continue;
      const a = (p.vehicle ?? p) as Actor;
      if (a.dead) continue;
      const onRoof = a.onGround && a.groundSolid === s;
      const above = a.x >= s.x - 2 && a.x <= s.x + CAB_W + 2 && a.y <= s.y + 3 && a.y >= s.y - 150;
      out.push({ a, onRoof, aboard: onRoof || (above && p.state !== 'dying') });
    }
    return out;
  }

  override update(dt: number): void {
    const solid = this.solid;
    if (!solid) return;
    this.modeT += dt;
    const riders = this.riders();
    const aboard = riders.filter((r) => r.aboard);
    switch (this.mode) {
      case 'dock':
        if (riders.some((r) => r.onRoof) && this.toX > this.pos + 1) {
          this.setMode('board');
          this.ding();
        }
        break;
      case 'board': {
        if (!aboard.length) {
          if (this.modeT > 0.4) this.setMode('dock');
          break;
        }
        const everyone = this.world.players.every(
          (p) => p.state === 'out' || p.state === 'waiting' || aboard.some((r) => r.a === p || (p.vehicle && r.a === p.vehicle)),
        );
        if (this.modeT > 0.9 && (everyone || this.modeT > 2.6)) {
          this.setMode('ride');
          this.world.sfx('vehicle_enter', this.x, { vol: 0.7, pitch: 0.7 });
        }
        break;
      }
      case 'ride': {
        const tg = this.target();
        const dist = tg.x - this.pos;
        this.v = Math.min(this.speed, this.v + ACCEL * dt, Math.sqrt(2 * DECEL * Math.max(0, dist)) + 2);
        this.pos = Math.min(tg.x, this.pos + this.v * dt);
        if (tg.x - this.pos < 0.05) {
          this.pos = tg.x;
          this.v = 0;
          this.world.sfx('metal_hit', this.x, { vol: 0.8, pitch: 0.6 });
          this.world.particles.sparks(this.x, this.y - HANG, 8, '#ffd060', 120);
          this.world.shake(1.5, 0.2);
          if (tg.stop) this.setMode('halt');
          else this.setMode('arrived');
        }
        break;
      }
      case 'halt': {
        const s = this.stops[this.stopIdx];
        const ls = s?.lock !== undefined ? this.world.level?.lockStates().find((l) => Math.abs(l.x - s.lock!) < 1) : undefined;
        const done = !s || (ls ? ls.state === 'done' : this.modeT > 2) || (ls?.state === 'idle' && this.modeT > 8);
        // Sparks crackle at the jammed trolley.
        if (fxRng.chance(dt * 3)) this.world.particles.sparks(this.x + fxRng.range(-4, 4), this.y - HANG - 2, 3, '#ffe080', 90);
        if (done && this.modeT > 0.8) {
          this.stopIdx++;
          this.setMode('ride');
          this.ding();
        }
        break;
      }
      case 'arrived':
        if (this.x < this.world.camera.x - 520 && !riders.some((r) => r.onRoof)) this.remove();
        break;
    }

    // Move the cabin (records dx/dy on the solid for riders standing on it).
    const roof = this.roofAt(this.pos);
    const oldL = solid.x;
    this.world.terrain.moveSolid(solid, this.pos - CAB_W / 2, roof);
    const dx = solid.dx;
    this.x = this.pos;
    this.y = roof;

    // Railings + air carry.
    const L = solid.x;
    const R = solid.x + CAB_W;
    const railL = this.mode === 'ride' || this.mode === 'halt' || this.mode === 'arrived';
    const railR = this.mode !== 'arrived';
    for (const { a, onRoof } of riders) {
      if (a.y > roof + 4 || a.y < roof - 150) continue;
      if (a.x < L - 30 || a.x > R + 30) continue;
      const hw = a.w / 2 + 2;
      // Grounded riders are carried by dx later in their own update: clamp against the old span.
      const base = onRoof ? oldL : L;
      const lo = base + hw;
      const hi = base + CAB_W - hw;
      if (!onRoof && (this.mode === 'ride' || this.mode === 'halt')) a.x += dx;
      if (railL && a.x < lo) {
        a.x = lo;
        if (a.vx < 0) a.vx = 0;
      }
      if (railR && a.x > hi) {
        a.x = hi;
        if (a.vx > 0) a.vx = 0;
      }
    }

    // Cosmetics: wheel spin, motor hum, sparks at the grip, beacon.
    this.wheel += (this.v * dt) / 3;
    this.lampT += dt;
    if (this.mode === 'ride') {
      this.humT -= dt;
      if (this.humT <= 0 && this.onScreen(40)) {
        this.humT = 0.4;
        this.world.sfx('engine', this.x, { vol: 0.25, pitch: 0.55 });
      }
      if (fxRng.chance(dt * 1.5)) this.world.particles.add({ kind: 'px', x: this.x + fxRng.range(-5, 5), y: this.y - HANG - 3, vx: fxRng.range(-20, 20), vy: fxRng.range(-30, -5), life: 0.4, color: '#ffe080', gravity: 300 });
    }
  }

  private setMode(m: Mode): void {
    this.mode = m;
    this.modeT = 0;
  }

  private ding(): void {
    this.world.sfx('metal_hit', this.x, { vol: 0.6, pitch: 1.6 });
    this.world.sfx('alarm', this.x, { vol: 0.35, pitch: 1.3 });
  }

  override remove(): void {
    if (this.solid) this.world.terrain.remove(this.solid);
    this.solid = null;
    super.remove();
  }

  // ---------------------------------------------------------------- render

  override render(g: CanvasRenderingContext2D): void {
    const cam = this.world.camera;
    // Haul cable (two strands) across the visible part of the span.
    const x0 = Math.max(Math.floor(cam.x) - 2, Math.round(this.drawFrom));
    const x1 = Math.min(Math.ceil(cam.x + VIEW_W) + 2, Math.round(this.drawTo));
    for (let x = x0; x < x1; x++) {
      const y = Math.round(this.cableY(x + 0.5));
      g.fillStyle = '#20242e';
      g.fillRect(x, y - 1, 1, 3);
      g.fillStyle = '#6a7282';
      g.fillRect(x, y, 1, 1);
      // Thin upper track rope.
      const y2 = Math.round(this.cableY(x + 0.5) - 6 + 0.5);
      g.fillStyle = '#3a4250';
      g.fillRect(x, y2, 1, 1);
    }
    if (!this.onScreen(60)) return;
    const s = sprites.get(CAB_SPRITE);
    const lit = this.mode === 'ride' ? Math.floor(this.lampT * 4) % 2 : this.mode === 'halt' ? Math.floor(this.lampT * 8) % 2 : 0;
    const spin = Math.floor(this.wheel) % 2;
    s.draw(g, Math.round(this.x), Math.round(this.y), lit * 2 + spin);
  }
}

registerEntity(
  'm3_cablecar',
  'misc',
  (_w, s) => new CableCar(s.props ?? {}),
  'FROSTBITE PASS cable car: a gondola riding a sagging cable (props.cable [[x,y],...] supports, sag, to = arrival dock x, ' +
    'stops [{x, lock}] halts until that camera lock is done, speed, ends). Players ride the roof (dynamic solid, railed in over the gorge); ' +
    'it leaves its dock (spawn x) once players board.',
);
