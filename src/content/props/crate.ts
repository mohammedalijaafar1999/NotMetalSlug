// Breakable wooden supply crate. You can stand on it (its lid is a one-way platform), shots splinter
// it, and when it breaks the planks fly and it drops props.drop (any pickup spec). Stacks fall when
// the crate underneath breaks.
// props: drop (pickup spec, default none), size: 'small' (default) | 'big', hp

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { registerEntity } from '../../game/registry';
import { dropPickup, isfx } from '../../game/pickup';
import type { Surface } from '../../game/terrain';
import type { Damage } from '../../game/constants';
import type { PixelArt } from '../../engine/pixelart';
import { Prop } from './common';
import { ramp, shaded } from '../vehicles/art';

const WOOD = ramp('#b07a40', 0.28, -0.34);
const WOOD_D = '#6a4420';
const WOOD_DD = '#4a2e14';
const NAIL = '#d8d0c0';

function drawCrate(p: PixelArt, w: number, h: number, cracked: boolean): void {
  shaded(p, (m) => m.rect(0, 0, w, h, '#fff'), WOOD);
  // Planks.
  const planks = Math.round(h / 5);
  for (let i = 1; i < planks; i++) p.hline(1, w - 2, Math.round((i * h) / planks), WOOD_D);
  // Frame + diagonal brace.
  p.box(0, 0, w, h, WOOD_DD);
  p.rect(1, 1, w - 2, 2, '#c8904c');
  p.rect(1, h - 3, w - 2, 2, '#8a5a2a');
  p.capsule(2.5, h - 3.5, w - 3.5, 3.5, 1.1, '#9a6834');
  p.line(3, h - 4, w - 4, 3, '#c8904c');
  // Nails at the corners.
  for (const [nx, ny] of [
    [2, 1.5],
    [w - 3, 1.5],
    [2, h - 2.5],
    [w - 3, h - 2.5],
  ])
    p.px(nx, ny, NAIL);
  if (cracked) {
    p.line(w * 0.3, 3, w * 0.45, h * 0.55, WOOD_DD);
    p.line(w * 0.45, h * 0.55, w * 0.35, h - 3, WOOD_DD);
    p.px(Math.floor(w * 0.6), 4, WOOD_DD);
  }
}

sprites.define({ name: 'crate_prop', w: 20, h: 21, frames: 2, draw: (p, f) => drawCrate(p, 20, 21, f === 1) });
sprites.define({ name: 'crate_prop_big', w: 28, h: 26, frames: 2, draw: (p, f) => drawCrate(p, 28, 26, f === 1) });

export class CrateProp extends Prop {
  big: boolean;
  private lid: Surface | null = null;

  constructor(props: Record<string, any> = {}) {
    super();
    this.big = props.size === 'big';
    this.w = this.big ? 28 : 20;
    this.h = this.big ? 26 : 21;
    this.hp = this.maxHp = typeof props.hp === 'number' ? props.hp : this.big ? 6 : 3;
    this.stepDown = 2;
  }

  override spawned(): void {
    this.lid = this.world.terrain.addSurface(this.left, this.top, this.right, this.top, { oneWay: true, owner: this, material: 'wood', dynamic: true });
  }

  override onHit(d: Damage): void {
    if (this.hp <= 0) return;
    this.world.particles.debris(d.x ?? this.x, d.y ?? this.cy, 2, ['#b07a40', '#6a4420'], 80);
  }

  destroyProp(_d: Damage): void {
    const w = this.world;
    this.dropLid();
    const cols = ['#b07a40', '#c8904c', '#6a4420', '#8a5a2a'];
    for (let i = 0; i < (this.big ? 14 : 9); i++) {
      w.particles.add({
        kind: 'debris',
        x: this.x + fxRng.range(-this.w / 2, this.w / 2),
        y: this.y - fxRng.range(2, this.h),
        vx: fxRng.range(-130, 130),
        vy: fxRng.range(-230, -80),
        life: fxRng.range(0.7, 1.3),
        color: fxRng.pick(cols),
        size: 2,
        size2: 2,
        gravity: 620,
        bounce: 0.35,
        rot: fxRng.range(0, 6),
        vr: fxRng.range(-16, 16),
      });
    }
    w.particles.dust(this.x, this.y, 5, '#c8a070');
    isfx(w, 'crate_break', this.x);
    const drop = this.props.drop;
    if (drop) dropPickup(w, this.x, this.y - this.h / 2, String(drop));
    this.remove();
  }

  private dropLid(): void {
    if (this.lid) {
      this.world.terrain.remove(this.lid);
      this.lid = null;
    }
  }

  override update(dt: number): void {
    this.moveAndCollide(dt);
    // Tidy up before the world despawns us far behind the camera (no ghost platforms).
    if (this.dead || this.right < this.world.camera.x - 180) {
      this.dropLid();
      if (!this.dead) this.remove();
      return;
    }
    if (this.lid) this.world.terrain.moveSurface(this.lid, this.left, this.top, this.right, this.top);
  }

  override render(g: CanvasRenderingContext2D): void {
    const name = this.big ? 'crate_prop_big' : 'crate_prop';
    sprites.get(name).draw(g, this.x + this.jiggle, this.y, this.hp < this.maxHp ? 1 : 0, { flash: this.flash > 0 });
  }
}

registerEntity('crate_prop', 'prop', (_w, s) => new CrateProp(s.props ?? {}), 'Breakable wooden crate you can stand on. props.drop = pickup spec, props.size = small|big');
