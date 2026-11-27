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
    const sy = Math.round(this.y);
    const t = this.world.time;
    // (the pit's walls, interior and heat glow are drawn behind the terrain by the theme's 'pit' decor)
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
