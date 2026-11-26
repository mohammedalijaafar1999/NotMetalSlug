// Shared helpers for weapon content: typed sound names, delayed actions, knockback,
// burning ground fires and flame pillars (flame shot puffs, fire bombs).

import { sprites } from '../../engine/sprites';
import { Rng, fxRng } from '../../engine/rng';
import { rectsOverlap, type Rect } from '../../engine/math';
import { Entity, Actor } from '../../game/entity';
import { Z } from '../../game/constants';
import type { World } from '../../game/world';

// Typed canonical sound helper lives in core (player.ts uses it too).
export { wsfx, WEAPON_SFX, type WeaponSfx } from '../../game/weapons';

/** Runs a callback after a delay (cosmetic follow-ups: pump-action casings, chained bursts). */
export class Delay extends Entity {
  constructor(
    private wait: number,
    private fn: (w: World) => void,
  ) {
    super();
    this.persistent = true;
  }
  override update(): void {
    if (this.age >= this.wait) {
      this.remove();
      this.fn(this.world);
    }
  }
}

export function later(world: World, seconds: number, fn: (w: World) => void): void {
  world.add(new Delay(seconds, fn));
}

/** Light enemies hit by a heavy blow get shoved; ones that just died are flung away. */
export function shove(t: Entity, dir: number, power: number): void {
  if (!(t instanceof Actor) || t.team !== 'enemy' || (t as any).isVehicle) return;
  const dying = (t as any).dying === true;
  if (dying) {
    t.vx = dir * power;
    if (t.onGround) t.jump(power * 0.75);
  } else if (t.maxHp <= 4) {
    // Nudge (AI resets vx every frame, so move the position directly when there is room).
    const nx = t.x + dir * Math.min(6, power * 0.04);
    const T = t.world.terrain;
    if (!T.solidOverlap({ x: nx - t.w / 2, y: t.y - t.h, w: t.w, h: t.h - 0.5 }, t) && T.groundTopAt(nx) >= t.y - t.stepUp) t.x = nx;
  }
}

// ------------------------------------------------------------------ fire sprites

const FIRE = ['#a8241a', '#e2491d', '#f9a12e', '#fff27a'];

function drawFlameColumn(p: import('../../engine/pixelart').PixelArt, cx: number, base: number, H: number, R: number, f: number, smoky: number): void {
  const rng = new Rng(4000 + f * 31 + Math.round(H));
  const ks = [1, 0.78, 0.55, 0.32];
  for (let li = 0; li < 4; li++) {
    const k = ks[li];
    const col = smoky > 0.5 && li === 0 ? '#5a2a22' : FIRE[li];
    const top = H * (0.5 + k * 0.5);
    for (let y = 0; y <= top; y += 1) {
      const t = y / H;
      const r = R * k * (1 - t * 0.78) + (t < 0.12 ? (0.12 - t) * R * 1.6 * k : 0);
      const wob = Math.sin(t * 8.5 + f * 1.9) * 1.7 * t;
      p.circle(cx + wob, base - 0.5 - y, Math.max(0.55, r), col);
    }
  }
  // Licks and embers above the column.
  for (let i = 0; i < 3; i++) {
    const x = cx + rng.range(-R * 0.7, R * 0.7);
    const y = base - H * rng.range(0.85, 1.12);
    p.px(Math.round(x), Math.round(y), rng.pick(['#ffd040', '#ff8a20', '#ffe890']));
  }
}

sprites.define({
  name: 'fire_pillar',
  w: 18,
  h: 44,
  ox: 9,
  oy: 44,
  frames: 8,
  outline: '#4a1008',
  draw: (p, f) => {
    const hk = [0.38, 0.72, 1, 0.95, 1, 0.94, 0.7, 0.42][f];
    drawFlameColumn(p, 9, 44, 40 * hk, 6.6, f, f >= 6 ? 1 : 0);
  },
});

sprites.define({
  name: 'fire_small',
  w: 12,
  h: 18,
  ox: 6,
  oy: 18,
  frames: 6,
  outline: '#4a1008',
  draw: (p, f) => {
    const hk = [0.55, 0.9, 1, 0.85, 0.7, 0.45][f];
    drawFlameColumn(p, 6, 18, 15 * hk, 4, f + 3, f >= 5 ? 1 : 0);
  },
});

// ------------------------------------------------------------------ burning entities

/**
 * A burning patch on the ground: damages overlapping enemies every `tick` seconds with
 * damage kind 'fire' (they die burnt). Used by flame shot puffs and fire bomb waves.
 */
export class GroundFire extends Entity {
  life: number;
  delay: number;
  dmg: number;
  tick: number;
  tall: boolean;
  private hitAt = new Map<number, number>();
  private emberT = 0;

  constructor(o: { owner: Entity | null; x: number; y: number; life?: number; delay?: number; damage?: number; tick?: number; tall?: boolean; w?: number }) {
    super();
    this.owner = o.owner;
    this.team = 'player';
    this.x = o.x;
    this.y = o.y;
    this.life = o.life ?? 0.6;
    this.delay = o.delay ?? 0;
    this.dmg = o.damage ?? 1;
    this.tick = o.tick ?? 0.25;
    this.tall = !!o.tall;
    this.w = o.w ?? (this.tall ? 14 : 9);
    this.h = this.tall ? 38 : 14;
    this.z = Z.FX - 1;
    this.persistent = true;
  }

  get burning(): boolean {
    return this.age >= this.delay;
  }

  override update(dt: number): void {
    if (this.age < this.delay) return;
    const t = this.age - this.delay;
    if (t >= this.life) {
      this.world.particles.smokePuffs(this.x, this.y - this.h * 0.6, this.tall ? 2 : 1, 3, '#4a4040', '#2a2424');
      this.remove();
      return;
    }
    // Grow in, shrink out.
    const k = t < 0.1 ? 0.5 + t * 5 : t > this.life - 0.15 ? Math.max(0.3, (this.life - t) / 0.15) : 1;
    const box: Rect = { x: this.x - this.w / 2, y: this.y - this.h * k, w: this.w, h: this.h * k };
    for (const e of this.world.targets('player')) {
      if (e.dead) continue;
      const last = this.hitAt.get(e.id);
      if (last !== undefined && this.world.time - last < this.tick) continue;
      let hit = false;
      for (const hb of e.hurtboxes()) if (rectsOverlap(box, hb)) hit = true;
      if (!hit) continue;
      this.hitAt.set(e.id, this.world.time);
      e.damage({ amount: this.dmg, kind: 'fire', owner: this.owner ?? this, x: this.x, y: this.y - this.h * 0.5, dir: e.x < this.x ? -1 : 1 });
    }
    this.emberT -= dt;
    if (this.emberT <= 0) {
      this.emberT = this.tall ? 0.05 : 0.12;
      this.world.particles.add({
        kind: 'px',
        x: this.x + fxRng.range(-this.w / 2, this.w / 2),
        y: this.y - fxRng.range(this.h * 0.3, this.h * 0.9),
        vx: fxRng.range(-12, 12),
        vy: fxRng.range(-70, -30),
        life: fxRng.range(0.25, 0.5),
        color: fxRng.pick(['#ffd040', '#ff9a2e', '#ffe890']),
        color2: '#e2491d',
      });
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.age < this.delay) return;
    const t = this.age - this.delay;
    const s = sprites.get(this.tall ? 'fire_pillar' : 'fire_small');
    const n = s.frameCount;
    // First frames erupt, middle frames loop, last frames die down.
    let f: number;
    if (t < 0.1) f = Math.floor((t / 0.1) * 2);
    else if (t > this.life - 0.16) f = n - 2 + Math.min(1, Math.floor(((t - (this.life - 0.16)) / 0.16) * 2));
    else f = 2 + (Math.floor(t * 14 + this.id) % (n - 4));
    s.draw(g, this.x, this.y, f, { flip: (this.id & 1) === 1 });
  }
}

/** Highest floor near (x, y) for placing ground fires (null over pits). */
export function floorNear(world: World, x: number, y: number, up = 16, down = 40): number | null {
  const h = world.terrain.floorAt(x, y - up, y + down, { solidTolerance: 4 });
  return h ? h.y : null;
}
