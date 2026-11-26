// Fuel tank: a big pressurised tank on concrete saddles. Takes a beating (it starts leaking flame
// when hurt), then hisses, rattles and goes up in a huge blast followed by a few secondary pops,
// hurting everyone around. The charred shell keeps burning for a while.
// props: hp (default 14)

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { registerEntity } from '../../game/registry';
import { isfx } from '../../game/pickup';
import type { Damage } from '../../game/constants';
import type { PixelArt } from '../../engine/pixelart';
import { Prop } from './common';
import { ramp, shaded } from '../vehicles/art';

const W = 48;
const H = 30;
const SHELL = ramp('#d8d6cc', 0.22, -0.36);

function saddles(p: PixelArt): void {
  for (const sx of [9, 33]) {
    shaded(p, (m) => m.poly([sx, 30, sx + 1.5, 21, sx + 6.5, 21, sx + 8, 30], '#fff'), ramp('#8a8478', 0.25, -0.3));
    p.hline(sx + 1, sx + 7, 24, '#6a6458');
  }
}

/** 0 intact, 1 dented and leaking, 2 burnt-out wreck. */
sprites.define({
  name: 'fuel_tank',
  w: W,
  h: H,
  frames: 3,
  draw: (p, f) => {
    if (f === 2) {
      saddles(p);
      // Torn, charred halves.
      p.poly([2, 22, 2, 13, 6, 7, 13, 5, 18, 9, 16, 13, 20, 16, 17, 22], '#2e2a2c');
      p.poly([30, 22, 31, 15, 28, 11, 33, 6, 41, 6, 46, 12, 46, 22], '#2e2a2c');
      p.poly([4, 20, 4, 13, 7, 9, 12, 7.5, 15, 10, 13, 20], '#4a4244');
      p.poly([33, 20, 33, 15, 35, 9, 40, 8.5, 44, 13, 44, 20], '#4a4244');
      p.px(8, 10, '#ff8a2a');
      p.px(38, 11, '#ff8a2a');
      p.rect(18, 21, 13, 2, '#1e1a1c');
      return;
    }
    saddles(p);
    // Tank shell.
    shaded(p, (m) => m.capsule(11, 14, 37, 14, 9, '#fff'), SHELL);
    // Seams + rivets.
    for (const sx of [15, 33]) {
      p.vline(sx, 6, 22, '#a8a69c');
      for (let ry = 8; ry <= 20; ry += 4) p.px(sx + 1, ry, '#f4f2ea');
    }
    // Red hazard band with a flame diamond (symmetric).
    p.rect(20.5, 5.5, 7, 17, '#c8402a');
    p.vline(20.5, 6, 22, '#e8684a');
    p.vline(27, 6, 22, '#8a2a1a');
    p.poly([24, 9.5, 27, 13.5, 24, 17.5, 21, 13.5], '#ffd23c');
    p.poly([24, 10.6, 25, 14, 24.4, 13.6, 24, 16, 23.2, 14.8, 23, 13.6], '#1e1a22');
    // Top valve.
    p.rect(14.5, 2, 2, 4, '#6a6e78');
    p.ring(15.5, 1.8, 2.2, '#c8402a', 1);
    p.px(15, 1, '#c8402a');
    // Pipe running down the far end.
    p.capsule(41, 9, 45, 9, 1, '#7a7e88');
    p.capsule(45, 9, 45, 26, 1, '#7a7e88');
    if (f === 1) {
      // Dents, a puncture and scorching.
      p.circle(31, 10, 1.6, '#3a3434');
      p.px(30, 9, '#1e1a1c');
      p.px(8, 17, '#8a887e');
      p.px(9, 18, '#f4f2ea');
      p.px(36, 19, '#8a887e');
      p.dither(28, 11, 6, 4, '#5a5450', 0);
    }
  },
});

export class FuelTank extends Prop {
  private fuse = -1;
  private wreck = false;
  private wreckT = 0;
  private leakT = 0;
  private secondaries: number[] = [];

  constructor(props: Record<string, any> = {}) {
    super();
    this.w = 42;
    this.h = 24;
    this.hp = this.maxHp = typeof props.hp === 'number' ? props.hp : 14;
  }

  override onHit(d: Damage): void {
    if (this.hp <= 0) return;
    this.world.particles.sparks(d.x ?? this.x, d.y ?? this.cy, 4, '#ffe080', 100);
    isfx(this.world, 'metal_hit', this.x, { vol: 0.45, pitch: 0.8 });
  }

  destroyProp(_d: Damage): void {
    this.fuse = 0.45;
    isfx(this.world, 'fire_burst', this.x, { vol: 0.5, pitch: 1.4 });
  }

  override update(dt: number): void {
    this.moveAndCollide(dt);
    if (this.dead) return;
    const w = this.world;
    const P = w.particles;
    if (this.wreck) {
      this.wreckT += dt;
      // Pending secondary blasts.
      for (let i = this.secondaries.length - 1; i >= 0; i--) {
        if (this.wreckT >= this.secondaries[i]) {
          this.secondaries.splice(i, 1);
          const ex = this.x + w.rng.range(-18, 18);
          const ey = this.y - w.rng.range(6, 22);
          w.explode(ex, ey, { radius: 22, damage: 6, team: 'player', owner: this.lastHitter, hitAll: true, exclude: this, size: 'medium', shake: 2 });
        }
      }
      // Burning shell, then smoulder.
      if (fxRng.chance(this.wreckT < 4 ? 0.5 : 0.12)) {
        const fx = this.x + fxRng.range(-16, 16);
        if (this.wreckT < 4) P.add({ kind: 'px', x: fx, y: this.y - fxRng.range(4, 14), vx: fxRng.range(-8, 8), vy: fxRng.range(-60, -30), life: fxRng.range(0.25, 0.5), color: '#ffd040', color2: '#ff5a1a', size: 2, size2: 1 });
        P.add({ kind: 'smoke', x: fx, y: this.y - 12, vx: fxRng.range(-6, 6), vy: fxRng.range(-30, -16), life: fxRng.range(0.6, 1.1), color: '#3a3640', color2: '#1e1c24', size: 2, size2: 6, drag: 1 });
      }
      return;
    }
    // Leaking flame once badly hurt.
    if (this.hp < this.maxHp * 0.5 && this.fuse < 0) {
      this.leakT -= dt;
      if (this.leakT <= 0) {
        this.leakT = 0.05;
        P.add({ kind: 'px', x: this.x + 7, y: this.y - 20, vx: fxRng.range(20, 50), vy: fxRng.range(-40, -10), life: fxRng.range(0.15, 0.3), color: '#ffe080', color2: '#ff6a1a', size: 2, size2: 1 });
      }
    }
    if (this.fuse >= 0) {
      this.fuse -= dt;
      // Hissing jets out of the seams.
      for (let i = 0; i < 2; i++) {
        const side = fxRng.sign();
        P.add({ kind: 'px', x: this.x + side * 18, y: this.y - fxRng.range(8, 20), vx: side * fxRng.range(60, 120), vy: fxRng.range(-30, 10), life: 0.2, color: '#fff0a0', color2: '#ff6a1a', size: 2, size2: 1 });
      }
      if (this.fuse <= 0) this.blowUp();
    }
  }

  private blowUp(): void {
    const w = this.world;
    const cy = this.y - 14;
    w.explode(this.x, cy, {
      radius: 58,
      damage: 20,
      team: 'player',
      owner: this.lastHitter,
      hitAll: true,
      exclude: this,
      size: 'huge',
      shake: 7,
      debris: ['#d8d6cc', '#a8a69c', '#c8402a', '#4a4244'],
    });
    w.flash('#ffe0a0', 0.35);
    w.hitstop(0.05);
    for (let i = 0; i < 18; i++) {
      w.particles.add({ kind: 'px', x: this.x + fxRng.range(-14, 14), y: cy, vx: fxRng.range(-60, 60), vy: fxRng.range(-320, -120), life: fxRng.range(0.5, 1.0), color: '#ffe060', color2: '#ff4a1a', gravity: 260, size: 3, size2: 1 });
    }
    w.particles.smokePuffs(this.x, cy - 10, 10, 20, '#4a4650', '#1e1c24');
    this.wreck = true;
    this.wreckT = 0;
    this.secondaries = [0.18, 0.36, 0.6];
  }

  override render(g: CanvasRenderingContext2D): void {
    const f = this.wreck ? 2 : this.hp < this.maxHp * 0.5 ? 1 : 0;
    const shake = this.fuse >= 0 ? fxRng.int(-1, 1) : this.jiggle;
    const hot = this.fuse >= 0 && Math.floor(this.fuse * 24) % 2 === 0;
    sprites.get('fuel_tank').draw(g, this.x + shake, this.y, f, { flash: (this.flash > 0 && !this.wreck) || hot });
  }
}

registerEntity('fuel_tank', 'prop', (_w, s) => new FuelTank(s.props ?? {}), 'Big explosive fuel tank: leaks flame when hurt, huge blast + secondary pops (hits everyone), burning wreck. props.hp=14');
