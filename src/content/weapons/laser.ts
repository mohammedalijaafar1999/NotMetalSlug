// L - LASER: an instant beam that stays on while fire is held, pierces every enemy along it,
// is stopped by terrain and drains ammo every tick. The beam follows the aim each frame, so
// sweeping up/down while firing carves through everything. Bright white core, flickering glow.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { angleDiff, segmentRect } from '../../engine/math';
import { registerWeapon } from '../../game/weapons';
import { Entity } from '../../game/entity';
import { Z } from '../../game/constants';
import type { World } from '../../game/world';
import type { Player } from '../../game/player';

export const LASER_TICK = 0.05;
export const LASER_DAMAGE = 1;
export const LASER_RANGE = 460;

sprites.define({
  name: 'laser_beam',
  w: 16,
  h: 11,
  ox: 0,
  oy: 5,
  frames: 5,
  outline: null,
  draw: (p, f) => {
    // Frames 0-2: full beam (flicker), 3-4: thinning out.
    const outer = [4.5, 5.5, 5, 2.5, 1.5][f];
    const inner = [3, 3.5, 3.2, 1.6, 1][f];
    for (let x = 0; x < 16; x++) {
      const wob = f < 3 && (x + f * 5) % 7 === 0 ? 1 : 0;
      p.rect(x, 5.5 - outer - wob, 1, (outer + wob) * 2, '#1a78d8');
      p.rect(x, 5.5 - inner, 1, inner * 2, '#4ad8ff');
      if (f < 4) p.rect(x, 5.5 - Math.min(1.5, inner * 0.5), 1, Math.min(3, inner), '#d8fcff');
      if (f < 3) p.rect(x, 5, 1, 1, '#ffffff');
    }
    if (f < 3) for (let i = 0; i < 3; i++) p.px((i * 6 + f * 3) % 16, f % 2 ? 1 : 9, '#8af4ff');
  },
});

sprites.define({
  name: 'laser_flare',
  w: 16,
  h: 16,
  ox: 6,
  oy: 8,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    const r = [6, 7, 5.5][f];
    p.circle(6.5, 8, r, '#1a78d8');
    p.circle(6.5, 8, r * 0.72, '#4ad8ff');
    p.circle(6.5, 8, r * 0.45, '#ffffff');
    p.line(6.5 - r - 1, 8, 6.5 + r + 2, 8, '#d8fcff');
    p.line(6.5, 8 - r - 1, 6.5, 8 + r + 1, '#d8fcff');
  },
});

sprites.define({
  name: 'laser_hit',
  w: 14,
  h: 14,
  ox: 7,
  oy: 7,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    const r = [4, 5.5, 4.5][f];
    p.circle(7, 7, r, '#4ad8ff');
    p.circle(7, 7, r * 0.55, '#ffffff');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + f * 0.4;
      p.line(7, 7, 7 + Math.cos(a) * (r + 2.5), 7 + Math.sin(a) * (r + 2.5), '#d8fcff');
    }
  },
});

/** Beam end point: first solid terrain point along the aim, or max range. */
export function traceBeam(world: World, x: number, y: number, a: number): { x: number; y: number; len: number; blocked: boolean } {
  const ex = x + Math.cos(a) * LASER_RANGE;
  const ey = y + Math.sin(a) * LASER_RANGE;
  const hit = world.terrain.raycast(x, y, ex, ey, 2);
  if (hit) return { x: hit.x, y: hit.y, len: Math.hypot(hit.x - x, hit.y - y), blocked: true };
  return { x: ex, y: ey, len: LASER_RANGE, blocked: false };
}

/** The visible beam. Lives while the owner keeps firing (fire() refreshes it every tick). */
export class LaserBeam extends Entity {
  readonly player: Player;
  ang = 0;
  len = 0;
  ex = 0;
  ey = 0;
  blocked = false;
  /** Aim angle at the previous damage tick (the arc swept since then is damaged too). */
  tickAngle: number | null = null;
  private sinceRefresh = 0;
  private fadeT = -1;
  private sparkT = 0;

  constructor(p: Player) {
    super();
    this.player = p;
    this.owner = p;
    this.team = 'player';
    this.anchor = 'center';
    this.persistent = true;
    this.z = Z.PROJECTILE + 3;
  }

  get fading(): boolean {
    return this.fadeT >= 0;
  }

  refresh(x: number, y: number, a: number): void {
    if (this.fadeT >= 0) this.tickAngle = null; // re-ignited: no sweep from the old angle
    this.sinceRefresh = 0;
    this.fadeT = -1;
    this.place(x, y, a);
  }

  private place(x: number, y: number, a: number): void {
    this.x = x;
    this.y = y;
    this.ang = a;
    const end = traceBeam(this.world, x, y, a);
    this.ex = end.x;
    this.ey = end.y;
    this.len = end.len;
    this.blocked = end.blocked;
  }

  override update(dt: number): void {
    const p = this.player;
    this.sinceRefresh += dt;
    const holding = p.state === 'play' && p.weapon.id === 'laser';
    // Cut crisply when the trigger is released (or the gun stopped feeding the beam).
    if (!holding || !p.inp.held('fire') || this.sinceRefresh > LASER_TICK * 1.8) {
      if (this.fadeT < 0) this.fadeT = 0;
    }
    if (this.fadeT >= 0) {
      this.fadeT += dt;
      if (this.fadeT > 0.1) {
        this.remove();
        return;
      }
    }
    if (holding) {
      // Stick to the gun every frame so aim changes sweep the beam smoothly.
      const m = p.muzzle();
      this.place(m.x, m.y, p.worldAim());
    }
    this.sparkT -= dt;
    if (this.sparkT <= 0 && !this.fading) {
      this.sparkT = 0.04;
      if (this.blocked) {
        this.world.particles.sparks(this.ex, this.ey, 2, fxRng.chance(0.5) ? '#8af4ff' : '#ffffff', 110);
        if (fxRng.chance(0.3)) this.world.particles.add({ kind: 'smoke', x: this.ex, y: this.ey - 2, vx: fxRng.range(-6, 6), vy: -20, life: 0.4, color: '#4a4a58', color2: '#2a2a34', size: 1, size2: 3 });
      }
      // Energy motes drifting off the beam.
      const t = fxRng.range(0.1, 0.9);
      this.world.particles.add({
        kind: 'px',
        x: this.x + (this.ex - this.x) * t,
        y: this.y + (this.ey - this.y) * t,
        vx: fxRng.range(-20, 20),
        vy: fxRng.range(-30, 0),
        life: fxRng.range(0.15, 0.3),
        color: '#d8fcff',
        color2: '#4ad8ff',
      });
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    const beam = sprites.get('laser_beam');
    const frame = this.fading ? (this.fadeT < 0.06 ? 3 : 4) : this.world.frame % 3;
    const img = beam.canvas(frame);
    const segW = beam.w;
    const ih = img.height;
    g.save();
    g.translate(Math.round(this.x), Math.round(this.y));
    g.rotate(this.ang);
    for (let d = 0; d < this.len; d += segW) {
      const w = Math.min(segW, this.len - d);
      if (w <= 0.5) break;
      g.drawImage(img, 1, 0, w, ih, d, -beam.oy - 1, w, ih);
    }
    g.restore();
    if (!this.fading) {
      const fl = sprites.get('laser_flare');
      fl.draw(g, this.x, this.y, this.world.frame % 3, { rot: this.ang });
      if (this.blocked || this.len < LASER_RANGE) sprites.get('laser_hit').draw(g, this.ex, this.ey, this.world.frame % 3);
    }
  }
}

const beams = new WeakMap<Player, LaserBeam>();

/** Current beam of a player (if any). */
export function laserBeamOf(p: Player): LaserBeam | null {
  const b = beams.get(p);
  return b && !b.dead && b.world === p.world ? b : null;
}

registerWeapon({
  id: 'laser',
  name: 'LASER',
  letter: 'L',
  ammo: 200,
  auto: true,
  cooldown: LASER_TICK,
  gun: 'laser',
  color: '#4ad8ff',
  heavy: true,
  sfx: 'laser',
  sfxInterval: 0.2,
  flash: false,
  sweep: 3.6,
  fire(p, x, y, a) {
    const w = p.world;
    let beam = laserBeamOf(p);
    if (!beam) {
      beam = new LaserBeam(p);
      beams.set(p, beam);
      w.add(beam);
    }
    beam.refresh(x, y, a);
    // Hitscan: everything along the beam takes one damage tick. When the aim swept since the
    // last tick, the arc in between is tested too so fast sweeps never skip a target.
    const dir = Math.cos(a) > 0.05 ? 1 : Math.cos(a) < -0.05 ? -1 : p.facing;
    const prev = beam.tickAngle ?? a;
    const diff = angleDiff(prev, a);
    const n = Math.min(8, Math.max(1, Math.ceil(Math.abs(diff) / 0.035)));
    const hit = new Set<number>();
    for (let k = 0; k < n; k++) {
      const ra = k === 0 ? a : prev + (diff * k) / n;
      const end = k === 0 ? { x: beam.ex, y: beam.ey } : traceBeam(w, x, y, ra);
      for (const t of w.targets('player')) {
        if (t.dead || hit.has(t.id)) continue;
        let tt = -1;
        for (const hb of t.hurtboxes()) {
          const s = segmentRect(x, y, end.x, end.y, hb);
          if (s >= 0 && (tt < 0 || s < tt)) tt = s;
        }
        if (tt < 0) continue;
        hit.add(t.id);
        const hx = x + (end.x - x) * tt;
        const hy = y + (end.y - y) * tt;
        t.damage({ amount: LASER_DAMAGE, kind: 'laser', owner: p, x: hx, y: hy, dir });
        if (fxRng.chance(0.6)) w.particles.sparks(hx, hy, 2, fxRng.chance(0.5) ? '#8af4ff' : '#ffffff', 100);
      }
    }
    beam.tickAngle = a;
  },
});
