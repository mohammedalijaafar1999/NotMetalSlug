// Player bombs (BOMB button): the default hand grenade and the FIRE BOMB (crate pickup).
//  - grenade: tumbling pineapple grenade with a smoke wisp; one bounce, then a meaty blast.
//  - firebomb: a fuel bottle with a burning rag that shatters on impact into a pillar of fire
//    and a wave of flames racing along the ground (damage kind 'fire', several ticks).
// Registered in player.ts's bombThrowers registry.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { bombThrowers, type Player } from '../../game/player';
import { Grenade } from '../../game/projectile';
import { GroundFire, floorNear, wsfx } from './fx';

export const GRENADE_DAMAGE = 9;
export const GRENADE_RADIUS = 26;
export const FIREBOMB_WAVE = 5;

sprites.define({
  name: 'grenade_player',
  w: 8,
  h: 8,
  ox: 4,
  oy: 4,
  frames: 8,
  draw: (p, f) => {
    // Pineapple grenade tumbling end over end: the fuse cap orbits the body.
    const a = (f / 8) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const pt = (u: number, v: number): [number, number] => [4 + u * c - v * s, 4.2 + u * s + v * c];
    p.circle(4, 4.2, 2.9, '#4e6a2a');
    for (const u of [-1.1, 1.1]) {
      const [x0, y0] = pt(u, -2.3);
      const [x1, y1] = pt(u, 2.3);
      p.line(x0, y0, x1, y1, '#36481c');
    }
    p.px(3, 3, '#8aa850'); // light from top-left
    const [cx, cy] = pt(0, -3.2);
    p.circle(cx, cy, 1.15, '#a8a8b0');
    const [lx, ly] = pt(1.5, -2.4);
    p.px(Math.round(lx), Math.round(ly), '#e0e0e8');
  },
});

sprites.define({
  name: 'firebomb',
  w: 9,
  h: 9,
  ox: 4,
  oy: 4,
  frames: 8,
  draw: (p, f) => {
    const a = (f / 8) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const pt = (u: number, v: number): [number, number] => [4.5 + u * c - v * s, 4.5 + u * s + v * c];
    const [ax, ay] = pt(-2.6, 0);
    const [bx, by] = pt(1.4, 0);
    p.capsule(ax, ay, bx, by, 2, '#b83a24'); // bottle
    const [hx, hy] = pt(-1.8, -1);
    p.px(Math.round(hx), Math.round(hy), '#ee7a4a');
    const [nx, ny] = pt(3.2, 0);
    p.capsule(bx, by, nx, ny, 0.9, '#d8c8a0'); // neck + rag
    const [fx, fy] = pt(4.4, 0);
    p.px(Math.round(fx), Math.round(fy), f % 2 ? '#ffd040' : '#ff8a20');
  },
});

/** Hand grenade with spin, smoke wisp and a beefier explosion. */
export class PlayerGrenade extends Grenade {
  private wispT = 0;

  constructor(p: Player, x: number, y: number, vx: number, vy: number) {
    super({ team: 'player', owner: p, x, y, vx, vy, radius: GRENADE_RADIUS * p.char.grenadeRadiusMul, damage: GRENADE_DAMAGE, sprite: 'grenade_player' });
    this.explodeOpts = { ...this.explodeOpts!, shake: 3 };
    this.fps = 16;
  }

  protected override move(dt: number): void {
    super.move(dt);
    this.wispT -= dt;
    if (this.wispT <= 0 && !this.dead) {
      this.wispT = 0.05;
      this.world.particles.add({ kind: 'smoke', x: this.x, y: this.y - 1, vx: fxRng.range(-5, 5), vy: -12, life: 0.3, color: '#c8c8c8', color2: '#8a8a92', size: 1, size2: 2 });
    }
  }

  override detonate(): void {
    if (this.dead) return;
    const w = this.world;
    w.particles.debris(this.x, this.y, 5, ['#4e6a2a', '#3a3a40', '#8a8a92'], 190);
    w.particles.sparks(this.x, this.y, 6, '#ffe080', 170);
    super.detonate();
  }
}

/** Fuel bottle that bursts into a pillar of fire and a wave of flames along the ground. */
export class FireBomb extends Grenade {
  constructor(p: Player, x: number, y: number, vx: number, vy: number) {
    super({ team: 'player', owner: p, x, y, vx, vy, radius: 16, damage: 0, maxBounces: 0, sprite: 'firebomb' });
    this.fps = 18;
    this.kind = 'fire'; // direct hits burn too
  }

  protected override move(dt: number): void {
    super.move(dt);
    if (!this.dead && fxRng.chance(0.6)) {
      this.world.particles.add({ kind: 'px', x: this.x, y: this.y - 2, vx: fxRng.range(-10, 10), vy: fxRng.range(-30, -10), life: 0.2, color: '#ffd040', color2: '#ff6a20' });
    }
  }

  override detonate(): void {
    if (this.dead) return;
    const w = this.world;
    const owner = this.owner;
    const gy = floorNear(w, this.x, this.y, 24, 60) ?? this.y;
    wsfx(w, 'firebomb_burst', this.x);
    wsfx(w, 'fire_burst', this.x, { vol: 0.8 });
    w.shake(2.5, 0.25);
    // Glass shards + burst of flame.
    w.particles.debris(this.x, this.y, 6, ['#c8e0e8', '#b83a24', '#ffffff'], 150);
    for (let i = 0; i < 12; i++) {
      w.particles.add({ kind: 'px', x: this.x, y: gy - 3, vx: fxRng.range(-90, 90), vy: fxRng.range(-160, -40), life: fxRng.range(0.3, 0.6), color: fxRng.pick(['#ffd040', '#ff9a2e', '#fff6b0']), color2: '#c8301a', gravity: 300, size: fxRng.pick([1, 2]) });
    }
    // Central pillar.
    w.add(new GroundFire({ owner, x: this.x, y: gy, tall: true, life: 0.9, damage: 2, tick: 0.12, w: 16 }));
    // Wave racing ahead along the ground (follows slopes, stops at pits/walls), plus a little behind.
    const dir = Math.sign(this.vx) || (this.owner?.facing ?? 1);
    for (const [side, count] of [
      [dir, FIREBOMB_WAVE],
      [-dir, 2],
    ] as const) {
      let py = gy;
      for (let i = 1; i <= count; i++) {
        const fx = this.x + side * i * 13;
        const fy = floorNear(w, fx, py, 14, 26);
        if (fy === null || w.terrain.isSolidPoint(fx, fy - 6)) break;
        py = fy;
        w.add(new GroundFire({ owner, x: fx, y: fy, tall: i <= 3, life: 0.75 - i * 0.04, delay: i * 0.06, damage: 2, tick: 0.14, w: i <= 3 ? 13 : 10 }));
      }
    }
    this.remove();
  }
}

bombThrowers['grenade'] = (p, x, y, vx, vy) => {
  p.world.add(new PlayerGrenade(p, x, y, vx, vy));
};

bombThrowers['firebomb'] = (p, x, y, vx, vy) => {
  p.world.add(new FireBomb(p, x, y, vx, vy));
};
