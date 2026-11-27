// m4_harbor - mission 4 water feedback (one per level, spawn at x 0; persistent, invisible).
// The canals and the basin of RUSTWATER DOCKS are deep water over a pit: whatever falls in sinks out
// of the level (players lose a life and drop back in on solid ground). This controller makes that
// read clearly: anything that drops through a deep-water surface throws up a splash (big for
// people and vehicles, small for shells and debris) with the 'splash' sound, and a player who goes
// under leaves a trail of bubbles.
// Players who drop back in over a canal are steered to the nearest solid quay (pontoons bob and are
// too narrow to land on blind). Frogmen and gunboats handle their own water; bosses are skipped.

import { registerEntity } from '../../../game/registry';
import { Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { fxRng } from '../../../engine/rng';
import type { Water } from '../../../game/terrain';
import { VIEW_H, VIEW_W } from '../../../engine/renderer';

const SKIP = new Set(['frogman', 'gunboat']);

interface Bubbles {
  x: number;
  y: number;
  t: number;
}

export class HarborWater extends Entity {
  private prevBottom = new WeakMap<Entity, number>();
  private bubbles: Bubbles[] = [];
  private sfxCool = 0;
  /** Splashes made so far (tests). */
  splashes = 0;

  constructor() {
    super();
    this.persistent = true;
    this.hittable = false;
    this.z = Z.FX;
    this.w = 1;
    this.h = 1;
  }

  private deepAt(x: number, y0: number, y1: number): Water | null {
    for (const w of this.world.terrain.water) {
      if (!w.deadly || x < w.x || x >= w.x + w.w) continue;
      if (y0 < w.y && y1 >= w.y) return w;
    }
    return null;
  }

  /** Solid quay (ground, not a pontoon) at x, inside the view and not under deep water? */
  private quayAt(x: number): boolean {
    const T = this.world.terrain;
    const cam = this.world.camera;
    const gy = T.groundTopAt(x);
    if (!isFinite(gy) || gy > cam.y + VIEW_H - 8) return false;
    return !T.waterAt(x, gy - 2)?.deadly;
  }

  /** Room to land: quay under x and a little either side (players drift while dropping in). */
  private landingAt(x: number): boolean {
    return this.quayAt(x) && this.quayAt(x - 12) && this.quayAt(x + 28);
  }

  /**
   * A player who just dropped back in (respawn, still near the top of the screen) over a canal is
   * moved to the nearest solid quay with room to land, and dropped from lower down so he can't
   * drift back over the water - pontoons bob and are too narrow to land on blind.
   */
  private steerRespawns(): void {
    const cam = this.world.camera;
    for (const p of this.world.players) {
      if (p.state !== 'respawn' || p.y > cam.y + 40 || this.landingAt(p.x)) continue;
      let to: number | null = null;
      for (let d = 4; d <= VIEW_W && to === null; d += 4) {
        if (p.x - d > cam.x + 16 && this.landingAt(p.x - d)) to = p.x - d;
        else if (p.x + d < cam.x + VIEW_W - 16 && this.landingAt(p.x + d)) to = p.x + d;
      }
      if (to === null) continue;
      p.x = to;
      p.y = Math.max(p.y, this.world.terrain.groundTopAt(to) - 44);
      p.vx = 0;
    }
  }

  override update(dt: number): void {
    this.sfxCool -= dt;
    const W = this.world;
    this.steerRespawns();
    for (const e of W.entities) {
      if (e === this || e.dead) continue;
      const big = e.anchor === 'bottom';
      const bottom = e.bottom;
      const prev = this.prevBottom.get(e);
      this.prevBottom.set(e, bottom);
      if (prev === undefined || e.vy < 25 || SKIP.has(e.type) || e.type.startsWith('boss')) continue;
      const w = this.deepAt(e.x, prev, bottom);
      if (!w) continue;
      this.splashes++;
      const isPlayer = (W.players as Entity[]).includes(e);
      const heavy = big && (isPlayer || e.w >= 12);
      W.particles.splash(e.x, w.y, heavy ? 16 : 5, '#bcd0ec');
      if (heavy) W.particles.splash(e.x + fxRng.range(-6, 6), w.y, 6, '#7a90b8');
      if (this.sfxCool <= 0 || heavy) {
        W.sfx('splash', e.x, { vol: heavy ? 0.9 : 0.35, pitch: heavy ? 0.85 : 1.3 });
        this.sfxCool = 0.12;
      }
      if (isPlayer) this.bubbles.push({ x: e.x, y: w.y, t: 0 });
    }
    for (const b of this.bubbles) {
      b.t += dt;
      if (fxRng.chance(dt * 18)) W.particles.add({ kind: 'px', x: b.x + fxRng.range(-4, 4), y: b.y + 1, vx: 0, vy: -fxRng.range(10, 30), life: 0.25, color: '#cfe2ff', size: fxRng.pick([1, 2]) });
    }
    this.bubbles = this.bubbles.filter((b) => b.t < 1.1);
  }
}

registerEntity(
  'm4_harbor',
  'misc',
  () => new HarborWater(),
  'Mission 4 water feedback (place once at x 0, persistent, invisible): anything that falls through a deep (deadly) water surface splashes (big for people/vehicles, small for shells/debris) with the splash sound; players who go under leave bubbles. Deep water in m4 is a pit, so falling in loses a life.',
);
