// Sandbag wall: stacked burlap bags. 'sandbag_wall' is pure scenery - bullets fly through it and
// nobody is blocked - but explosions tear it down (top row first, then to a flat pile of burst
// bags). 'sandbags' is the same wall used as cover: it also soaks up enemy bullets that hit it.
// props: bags (bags in the bottom row, 2..8, default 4), rows (2..3, default 3), cover, hp (default 18)

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { rectsOverlap } from '../../engine/math';
import { registerEntity } from '../../game/registry';
import { Projectile } from '../../game/projectile';
import type { Damage } from '../../game/constants';
import type { PixelArt } from '../../engine/pixelart';
import { Prop } from './common';
import { ramp, shaded } from '../vehicles/art';

const BAG_W = 10;
const BAG_H = 5;
const SAND = ['#c8b07a', '#d8c08a', '#b89c66'];

function drawBag(p: PixelArt, x: number, y: number, v: number): void {
  const base = SAND[v % SAND.length];
  shaded(p, (m) => m.capsule(x + 2, y + 2.5, x + BAG_W - 2, y + 2.5, 2.4, '#fff'), ramp(base, 0.25, -0.32));
  // Tied ends + stitching.
  p.px(x, y + 2, '#8a7448');
  p.px(x + BAG_W - 1, y + 2, '#8a7448');
  p.hline(x + 3, x + BAG_W - 4, y + 1, shade2(base));
}

function shade2(c: string): string {
  return c === SAND[1] ? '#e8d4a0' : '#dcc490';
}

/** Single bag (3 shades) used to compose walls; 'sandbag_burst' = a split, flattened bag. */
sprites.define({ name: 'sandbag', w: BAG_W, h: BAG_H, frames: 3, draw: (p, f) => drawBag(p, 0, 0, f) });
sprites.define({
  name: 'sandbag_burst',
  w: 12,
  h: 4,
  draw: (p) => {
    shaded(p, (m) => m.poly([0, 4, 2, 1.5, 5, 0.5, 8, 1, 12, 4], '#fff'), ramp('#b89c66', 0.25, -0.32));
    p.px(4, 2, '#8a7448');
    p.px(7, 1, '#e8d4a0');
  },
});

export class SandbagWall extends Prop {
  bags: number;
  rows: number;
  cover: boolean;

  constructor(props: Record<string, any> = {}, cover = false) {
    super();
    this.bags = Math.max(2, Math.min(8, Math.floor(props.bags ?? 4)));
    this.rows = Math.max(2, Math.min(3, Math.floor(props.rows ?? 3)));
    this.cover = !!(props.cover ?? cover);
    this.w = this.bags * (BAG_W - 1) + 1;
    this.h = this.rows * (BAG_H - 1) + 1;
    this.hp = this.maxHp = typeof props.hp === 'number' ? props.hp : 18;
    // Shots pass straight through; only blasts and crushing wreck it.
    this.immune = ['bullet', 'laser', 'fire', 'melee', 'electric'];
  }

  /** Rows still standing (top rows go first). */
  private rowsLeft(): number {
    if (this.broken) return 0;
    return this.hp > this.maxHp * 0.5 ? this.rows : this.rows - 1;
  }

  override onHit(d: Damage): void {
    this.world.particles.dust(d.x ?? this.x, Math.min(d.y ?? this.cy, this.y - 2), 4, '#d8c08a');
    if (this.hp > 0 && this.hp <= this.maxHp * 0.5 && this.hp + d.amount > this.maxHp * 0.5) this.burst(this.rows - 1);
  }

  destroyProp(_d: Damage): void {
    for (let r = 0; r < this.rows - 1; r++) this.burst(r);
    this.world.invalidateTargets();
  }

  /** Burst the bags of one row: sand sprays, burlap scraps fly. */
  private burst(row: number): void {
    const w = this.world;
    const y = this.y - row * (BAG_H - 1) - 3;
    for (let i = 0; i < this.bags; i++) {
      const bx = this.left + i * (BAG_W - 1) + BAG_W / 2;
      w.particles.dust(bx, y, 3, '#d8c08a');
      w.particles.add({ kind: 'debris', x: bx, y, vx: fxRng.range(-90, 90), vy: fxRng.range(-180, -70), life: fxRng.range(0.6, 1.1), color: fxRng.pick(['#b89c66', '#8a7448', '#d8c08a']), size: 2, size2: 2, gravity: 600, bounce: 0.3, rot: fxRng.range(0, 6), vr: fxRng.range(-12, 12) });
    }
  }

  override update(dt: number): void {
    this.moveAndCollide(dt);
    if (this.dead || !this.cover || this.broken) return;
    // Soak up enemy bullets that reach the bags.
    const box = { x: this.left, y: this.y - this.rowsLeft() * (BAG_H - 1) - 1, w: this.w, h: this.rowsLeft() * (BAG_H - 1) + 1 };
    for (const e of this.world.query((x) => x instanceof Projectile && x.team === 'enemy' && (x as Projectile).kind === 'bullet')) {
      if (!rectsOverlap(box, e.box)) continue;
      this.world.particles.dust(e.x, e.y, 2, '#d8c08a');
      this.world.particles.add({ kind: 'px', x: e.x, y: e.y, vx: fxRng.range(-30, 30), vy: fxRng.range(-60, -20), life: 0.3, color: '#e8d4a0', gravity: 300 });
      e.remove();
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    const rows = this.rowsLeft();
    const bag = sprites.get('sandbag');
    const x0 = Math.round(this.left);
    const y0 = Math.round(this.y);
    const jig = this.jiggle;
    if (rows === 0) {
      // Flattened pile of burst bags.
      const burst = sprites.get('sandbag_burst');
      for (let i = 0; i < this.bags; i++) burst.draw(g, x0 + 6 + i * (BAG_W - 1), y0, 0);
      return;
    }
    for (let r = 0; r < rows; r++) {
      const n = r === 2 ? this.bags - 1 : this.bags;
      const off = r === 2 ? (BAG_W - 1) / 2 : r === 1 ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const bx = x0 + off + i * (BAG_W - 1) + BAG_W / 2;
        bag.draw(g, bx + jig, y0 - r * (BAG_H - 1), (i * 7 + r * 3) % 3, { flash: this.flash > 0 });
      }
    }
  }
}

registerEntity('sandbag_wall', 'prop', (_w, s) => new SandbagWall(s.props ?? {}), 'Decorative sandbag wall (blocks nothing) that explosions tear down. props.bags=4, rows=3');
registerEntity('sandbags', 'prop', (_w, s) => new SandbagWall(s.props ?? {}, true), 'Sandbag cover: like sandbag_wall but soaks up enemy bullets. props.bags=4, rows=3');
