// m6_molten - a channel of molten metal sunk into the factory floor (IRON CITADEL).
// Place it in a pit (a gap in the ground polyline) together with a LevelDef.water entry
// { deadly: true } that starts at the molten surface: the theme paints that water as glowing
// molten metal in front of everything (things that fall in sink out of sight), while this entity
// draws the pit's brick walls, the heat glow above it, bubbles and spitting sparks, and does the
// killing: anything that touches the surface burns (players die in one hit, enemies too, a driven
// vehicle melts in a moment).
//   spawn: { type: 'm6_molten', x: <pit centre>, y: <molten surface y>, trigger: <early>,
//            props: { w: <pit width, default 28>, floor: <ground y at the pit edges, default y - 12> } }

import { fxRng } from '../../../engine/rng';
import { registerEntity } from '../../../game/registry';
import { Actor, Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { Hostage } from '../../../game/hostage';
import { M6, hash01 } from '../../themes/m6/palette';

export class MoltenPool extends Entity {
  /** Ground y at the pit's edges. */
  floorY = 0;
  private burned = new Set<number>();
  private sparkT = 0;

  constructor() {
    super();
    this.z = Z.BACK_PROP;
    this.team = 'neutral';
    this.hittable = false;
    this.w = 28;
    this.h = 12;
  }

  override spawned(): void {
    this.w = typeof this.props.w === 'number' ? this.props.w : 28;
    this.floorY = typeof this.props.floor === 'number' ? this.props.floor : this.y - 12;
    this.h = Math.max(2, this.y - this.floorY);
  }

  get x0(): number {
    return this.x - this.w / 2;
  }
  get x1(): number {
    return this.x + this.w / 2;
  }

  override update(dt: number): void {
    // Burn whatever reaches the surface.
    for (const e of this.world.entities) {
      if (e.dead || !(e instanceof Actor)) continue;
      if (e.x < this.x0 - 1 || e.x > this.x1 + 1) continue;
      if (e.y < this.y - 1 || e.y > this.y + 120) continue;
      this.burn(e);
    }
    // Spitting sparks while on screen.
    if (this.onScreen(16)) {
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = fxRng.range(0.18, 0.5) * (32 / Math.max(16, this.w));
        const x = fxRng.range(this.x0 + 2, this.x1 - 2);
        this.world.particles.add({
          kind: 'px',
          x,
          y: this.y - 1,
          vx: fxRng.range(-25, 25),
          vy: fxRng.range(-120, -50),
          gravity: 320,
          life: fxRng.range(0.35, 0.7),
          color: fxRng.chance(0.5) ? M6.moltenLL : M6.moltenL,
          color2: M6.molten,
          size: 1,
        });
      }
    }
  }

  private burn(e: Actor): void {
    const first = !this.burned.has(e.id);
    const anyE = e as any;
    if (anyE.isPlayer) {
      const st = anyE.state;
      if (st === 'play' || st === 'respawn') e.damage({ amount: 99, kind: 'fire', x: e.x, y: this.y, dir: 0 });
    } else if (anyE.isVehicle) {
      if (anyE.driver) e.damage({ amount: 99, kind: 'fire', x: e.x, y: this.y });
    } else if (e.team === 'enemy' && e.hittable) {
      e.damage({ amount: 99, kind: 'fire', owner: null, x: e.x, y: this.y, dir: 0 });
    } else if (e.hittable && e.team === 'neutral' && !(e instanceof Hostage)) {
      // props (barrels, crates) go up too
      e.damage({ amount: 99, kind: 'fire', owner: null, x: e.x, y: this.y });
    }
    if (first) {
      this.burned.add(e.id);
      const w = this.world;
      w.particles.splash(e.x, this.y - 1, 10, M6.moltenL);
      w.particles.sparks(e.x, this.y - 2, 8, M6.moltenLL, 150);
      w.particles.smokePuffs(e.x, this.y - 6, 4, 5, '#4a3a3a', '#2a2026');
      if (this.onScreen(40)) w.sfx('fire_burst', e.x, { vol: 0.7 });
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    const x0 = Math.round(this.x0);
    const x1 = Math.round(this.x1);
    const fy = Math.round(this.floorY);
    const sy = Math.round(this.y);
    const t = this.world.time;
    // pit interior: dark back wall lit from below (dithered bands)
    for (let y = fy; y < sy + 2; y++) {
      const k = (y - fy) / Math.max(1, sy - fy);
      g.fillStyle = k > 0.7 ? '#5a1e10' : k > 0.4 ? '#3a1410' : '#1e0e10';
      g.fillRect(x0, y, x1 - x0, 1);
    }
    g.fillStyle = '#7a2a12';
    for (let y = fy + 2; y < sy; y += 2) {
      const k = (y - fy) / Math.max(1, sy - fy);
      if (k < 0.45) continue;
      for (let x = x0 + ((y >> 1) % 2); x < x1; x += 2) g.fillRect(x, y, 1, 1);
    }
    // brick side walls (3 px) with mortar lines, the inner faces glowing warm near the surface
    for (const [wx, dir] of [
      [x0, 1],
      [x1 - 3, -1],
    ] as const) {
      for (let y = fy; y < sy + 2; y++) {
        const k = (y - fy) / Math.max(1, sy - fy);
        const mortar = (y - fy) % 5 === 4;
        g.fillStyle = mortar ? M6.mortar : k > 0.6 ? '#8a3a22' : M6.brickD;
        g.fillRect(wx, y, 3, 1);
        g.fillStyle = k > 0.5 ? '#c8642a' : M6.brick;
        g.fillRect(dir > 0 ? wx + 2 : wx, y, 1, 1);
      }
      g.fillStyle = M6.outline;
      g.fillRect(dir > 0 ? wx - 1 : wx + 3, fy, 1, sy - fy + 2);
    }
    // heat glow above the channel (flickers)
    const fl = 0.1 + 0.04 * Math.sin(t * 9 + this.x) + 0.03 * Math.sin(t * 21);
    g.fillStyle = M6.glow;
    g.globalAlpha = fl;
    g.fillRect(x0 - 4, fy - 14, x1 - x0 + 8, 14);
    g.globalAlpha = fl * 0.6;
    g.fillRect(x0 - 8, fy - 26, x1 - x0 + 16, 12);
    g.globalAlpha = 1;
    // bubbles swelling and popping on the surface (drawn just above it)
    for (let i = 0; i < Math.max(2, Math.floor(this.w / 12)); i++) {
      const per = 0.9 + hash01(i, 7, this.id) * 0.9;
      const ph = ((t + hash01(i, 8, this.id) * per) % per) / per;
      const bx = Math.round(x0 + 4 + hash01(i, Math.floor((t + hash01(i, 8, this.id) * per) / per), this.id) * (x1 - x0 - 8));
      if (ph < 0.75) {
        const r = ph < 0.5 ? 1 : 2;
        g.fillStyle = M6.moltenL;
        g.fillRect(bx - r, sy - r, r * 2, r);
        g.fillStyle = M6.moltenLL;
        g.fillRect(bx - r + 1, sy - r, 1, 1);
      } else {
        g.fillStyle = M6.moltenLL;
        g.fillRect(bx - 2, sy - 3, 1, 1);
        g.fillRect(bx + 2, sy - 2, 1, 1);
        g.fillRect(bx, sy - 4, 1, 1);
      }
    }
  }
}

registerEntity(
  'm6_molten',
  'hazard',
  () => new MoltenPool(),
  'Molten metal channel (mission 6): x = pit centre, y = molten surface; props.w (pit width, default 28), floor ' +
    '(ground y at the edges, default y - 12). Burns anything touching the surface (players, enemies, vehicles, props). ' +
    'Put it in a pit (gap in the ground) <= 28 px wide plus a deadly LevelDef.water rect from the surface down; spawn it ' +
    'early (trigger) so the pit never shows empty.',
);
