// S - SHOTGUN: a short-range cone blast that hits everything inside it (pierces), does big
// damage, shoves light enemies and flings the ones it kills. Huge muzzle blast, pump-action casing.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { segmentRect } from '../../engine/math';
import { registerWeapon, ejectCasing } from '../../game/weapons';
import type { Entity } from '../../game/entity';
import { later, shove, wsfx } from './fx';

export const SHOTGUN_RANGE = 96;
export const SHOTGUN_HALF_ANGLE = 0.34;
export const SHOTGUN_DAMAGE = 8;

sprites.define({
  name: 'shotgun_blast',
  w: 38,
  h: 26,
  ox: 0,
  oy: 13,
  frames: 5,
  outline: null,
  draw: (p, f) => {
    const cy = 13;
    if (f <= 2) {
      const L = [30, 37, 33][f];
      const W = [9, 11.5, 11][f];
      const outer = ['#ffd040', '#ff9a2e', '#e2491d'][f];
      const mid = ['#fff6c0', '#ffd040', '#ff9a2e'][f];
      p.poly([0, cy, L * 0.35, cy - W, L * 0.8, cy - W * 0.75, L, cy, L * 0.8, cy + W * 0.75, L * 0.35, cy + W], outer);
      p.poly([0, cy, L * 0.3, cy - W * 0.55, L * 0.65, cy, L * 0.3, cy + W * 0.55], mid);
      if (f === 0) p.circle(3, cy, 4, '#ffffff');
      // Pellet streaks.
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.16;
        const r0 = L * (0.55 + f * 0.1);
        p.line(Math.cos(a) * r0, cy + Math.sin(a) * r0, Math.cos(a) * (r0 + 5), cy + Math.sin(a) * (r0 + 5), '#fff6c0');
      }
    } else {
      // Smoke ring dissipating.
      const k = f - 2;
      for (let i = 0; i < 6; i++) {
        const a = -0.6 + i * 0.24;
        const r = 10 + k * 7 + (i % 2) * 3;
        const x = Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * 0.9;
        const rr = 3.2 - k * 0.6;
        if (k === 2) p.dither(x - rr, y - rr, rr * 2, rr * 2, '#8a8a92', i % 2);
        else p.circle(x, y, rr, i % 2 ? '#9a9aa2' : '#b8b8c0');
      }
    }
  },
});

/** Everything the cone hits (rays from the muzzle, clipped by terrain). */
export function shotgunHits(world: import('../../game/world').World, x: number, y: number, a: number): { hits: Map<Entity, [number, number]>; ends: [number, number][] } {
  const rays = 9;
  const hits = new Map<Entity, [number, number]>();
  const ends: [number, number][] = [];
  const targets = world.targets('player');
  for (let i = 0; i < rays; i++) {
    const ra = a - SHOTGUN_HALF_ANGLE + (2 * SHOTGUN_HALF_ANGLE * i) / (rays - 1);
    let ex = x + Math.cos(ra) * SHOTGUN_RANGE;
    let ey = y + Math.sin(ra) * SHOTGUN_RANGE;
    const wall = world.terrain.raycast(x, y, ex, ey, 3);
    if (wall) {
      ex = wall.x;
      ey = wall.y;
    }
    ends.push([ex, ey]);
    for (const t of targets) {
      if (t.dead || hits.has(t)) continue;
      for (const hb of t.hurtboxes()) {
        const s = segmentRect(x, y, ex, ey, hb);
        if (s >= 0) {
          hits.set(t, [x + (ex - x) * s, y + (ey - y) * s]);
          break;
        }
      }
    }
  }
  return { hits, ends };
}

registerWeapon({
  id: 'shotgun',
  name: 'SHOTGUN',
  letter: 'S',
  ammo: 30,
  auto: false,
  cooldown: 0.52,
  gun: 'shotgun',
  color: '#e0a050',
  heavy: true,
  sfx: 'shotgun',
  flash: true,
  muzzle: 'shotgun_blast',
  recoil: 2.5,
  fire(p, x, y, a) {
    const w = p.world;
    const dir = Math.cos(a) > 0.05 ? 1 : Math.cos(a) < -0.05 ? -1 : p.facing;
    const { hits, ends } = shotgunHits(w, x, y, a);
    for (const [t, [hx, hy]] of hits) {
      const connected = t.damage({ amount: SHOTGUN_DAMAGE, kind: 'bullet', owner: p, x: hx, y: hy, dir });
      if (!connected) continue;
      shove(t, dir, 170);
      w.effect('impact_spark', hx, hy, { fps: 30 });
      w.particles.sparks(hx, hy, 3, '#ffe080', 120);
    }
    // Pellets streaking out + dust where they hit walls/ground.
    for (const [ex, ey] of ends) {
      const d = Math.hypot(ex - x, ey - y);
      const sp = fxRng.range(420, 560);
      w.particles.add({ kind: 'spark', x, y, vx: ((ex - x) / d) * sp, vy: ((ey - y) / d) * sp, life: Math.max(0.03, (d / sp) * 0.95), color: '#fff0a0' });
      if (d < 94) w.particles.dust(ex, ey + 1, 1, '#b8a888');
    }
    w.particles.smokePuffs(x + Math.cos(a) * 10, y + Math.sin(a) * 10, 3, 4, '#c8c8c8', '#8a8a92');
    // Pump action: shell flies out a moment later.
    later(w, 0.2, (wd) => {
      if (p.state !== 'play') return;
      const s = p.shoulder();
      ejectCasing(wd, s.x + p.facing * 3, s.y, p.facing, 'shell');
      wsfx(wd, 'shell_casing', p.x, { vol: 0.5 });
    });
  },
});
