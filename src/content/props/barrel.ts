// Explosive barrel: a dented red drum with a flame hazard plate. A few hits light a short fuse
// (it rattles and glows), then it blows up, hurting EVERYONE nearby (players, enemies, vehicles)
// and setting off other barrels for chain reactions. Kills are credited to whoever lit it.
// props: hp (default 3)

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { registerEntity } from '../../game/registry';
import { isfx } from '../../game/pickup';
import type { Damage } from '../../game/constants';
import { Prop } from './common';
import { ramp, shaded } from '../vehicles/art';

const RED = ramp('#c8402a', 0.3, -0.34);

/** 0 = fine, 1 = dented, 2 = about to blow (glowing). */
sprites.define({
  name: 'barrel',
  w: 15,
  h: 22,
  frames: 3,
  draw: (p, f) => {
    const hot = f === 2;
    const body = hot ? ramp('#ff7a3a', 0.3, -0.3) : RED;
    const rib = hot ? '#c85020' : '#8a2a1a';
    const ribL = hot ? '#ffc090' : '#e8684a';
    shaded(p, (m) => m.rect(0.5, 2, 14, 20, '#fff'), body);
    // Lid rim and bung.
    p.ellipse(7.5, 2.2, 7, 1.8, ribL);
    p.ellipse(7.5, 2.2, 5.4, 1, rib);
    p.rect(10, 0.5, 2, 1.5, '#4a4a52');
    // Rolling hoops.
    for (const ry of [7, 16.5]) {
      p.hline(1, 13, ry, rib);
      p.hline(1, 13, ry - 1, ribL);
    }
    // Hazard plate: yellow diamond with a black flame.
    p.poly([7.5, 8, 11.2, 11.6, 7.5, 15.2, 3.8, 11.6], '#ffd23c');
    p.poly([7.5, 9.4, 8.8, 12.4, 8, 12, 7.5, 13.8, 6.4, 13, 6.2, 11.6], '#1e1a22');
    if (f >= 1) {
      // Dents.
      p.px(2, 4, '#7a2014');
      p.px(3, 4, ribL);
      p.px(12, 19, '#7a2014');
      p.px(11, 20, ribL);
      p.px(3, 18, '#7a2014');
    }
    if (hot) {
      p.px(1, 3, '#fff0c0');
      p.px(2, 3, '#fff0c0');
    }
  },
});

sprites.define({
  name: 'barrel_lid',
  w: 11,
  h: 4,
  ox: 5,
  oy: 2,
  draw: (p) => {
    p.ellipse(5.5, 2, 5.2, 1.6, '#c8402a');
    p.ellipse(5.5, 1.6, 4, 0.9, '#e8684a');
    p.rect(7, 0.5, 2, 1, '#4a4a52');
  },
});

export class Barrel extends Prop {
  private fuse = -1;

  constructor(props: Record<string, any> = {}) {
    super();
    this.w = 14;
    this.h = 22;
    this.hp = this.maxHp = typeof props.hp === 'number' ? props.hp : 3;
  }

  override onHit(d: Damage): void {
    if (this.hp > 0) {
      this.world.particles.sparks(d.x ?? this.x, d.y ?? this.cy, 3, '#ffe080', 90);
      isfx(this.world, 'metal_hit', this.x, { vol: 0.35 });
    }
  }

  destroyProp(d: Damage): void {
    // Short fuse so chain reactions pop one after another.
    this.fuse = d.kind === 'explosion' ? this.world.rng.range(0.08, 0.2) : 0.12;
  }

  override update(dt: number): void {
    this.moveAndCollide(dt);
    if (this.dead || this.fuse < 0) return;
    this.fuse -= dt;
    if (fxRng.chance(0.6)) this.world.particles.sparks(this.x + fxRng.range(-4, 4), this.top + 2, 1, '#ffd060', 80);
    if (this.fuse <= 0) this.explode();
  }

  explode(): void {
    const w = this.world;
    const cy = this.y - 11;
    w.explode(this.x, cy, {
      radius: 34,
      damage: 10,
      team: 'player',
      owner: this.lastHitter,
      hitAll: true,
      exclude: this,
      size: 'large',
      shake: 4,
      debris: ['#c8402a', '#8a2a1a', '#4a4a52', '#ffd23c'],
    });
    // Lid rockets up, a burst of burning fuel splashes out.
    const lid = sprites.get('barrel_lid');
    w.particles.add({ kind: 'sprite', sprite: lid, x: this.x, y: this.top, vx: fxRng.range(-40, 40), vy: -fxRng.range(260, 340), gravity: 700, bounce: 0.3, life: 1.4, fps: 1 });
    for (let i = 0; i < 10; i++) {
      w.particles.add({ kind: 'px', x: this.x + fxRng.range(-4, 4), y: cy, vx: fxRng.range(-110, 110), vy: fxRng.range(-200, -60), life: fxRng.range(0.4, 0.8), color: '#ffd040', color2: '#ff5a1a', gravity: 500, size: 2, size2: 1 });
    }
    isfx(w, 'fire_burst', this.x, { vol: 0.6 });
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const f = this.fuse >= 0 ? (Math.floor(this.fuse * 30) % 2 ? 2 : 1) : this.hp < this.maxHp ? 1 : 0;
    sprites.get('barrel').draw(g, this.x + this.jiggle + (this.fuse >= 0 ? fxRng.int(-1, 1) : 0), this.y, f, { flash: this.flash > 0 && this.fuse < 0 });
  }
}

registerEntity('barrel', 'prop', (_w, s) => new Barrel(s.props ?? {}), 'Explosive red barrel: blows up after a few hits, hurts everyone nearby, chain-reacts. props.hp=3');
