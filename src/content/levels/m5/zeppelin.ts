// m5_fuel_zeppelin - the Legion's fuel tanker zeppelin, a destructible set piece for STORMFRONT.
//  - A big rust-red tanker with hazard bands, three glowing fuel cells along the flank and a tanker
//    gondola. It hovers in place (nose toward props.facing, default -1) and spawns its two escort
//    ball turrets (spine + gondola keel). Its hull gently pushes gyros out (you cannot fly through).
//  - 110 HP (x difficulty), 5000 pts. Damaged it leaks burning fuel; critical it burns and smokes.
//  - Destroyed: an alarm, a 1.7 s chain of blasts along the envelope while the cells flare white,
//    then a huge fireball that destroys every enemy around it (drones, jetpacks, its turrets...) and
//    singes a gyro that hangs around too close (one explosion hit). The burnt halves fall away.
//    It keeps blocking its wave until the fireball goes off.
// Spawn with explicit x/y = envelope centre (it does not fall). props: facing, drop, turrets (false
// = no escort turrets).

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { PixelArt, mixColor, shade } from '../../../engine/pixelart';
import type { Rect } from '../../../engine/math';
import { Entity } from '../../../game/entity';
import { Enemy } from '../../../game/enemy';
import { Z, type Damage } from '../../../game/constants';
import { registerEntity } from '../../../game/registry';
import { flames, smoke, sparkBurst } from '../../bosses/common/kit';
import { Pen } from '../../machines/common';
import { P5 } from '../../themes/m5/palette';
import { bayer } from '../../themes/m5/sky';

// ------------------------------------------------------------------ layout (local, facing right)

const LEN = 212;
const BODY_H = 60;
const W = 236;
const H = 100;
const OX = 116;
const OY = 40;
const CELLS = [-52, -2, 48];
const CELL_Y = 13;
const ENGINES: [number, number][] = [
  [-86, 12],
  [66, 36],
];
const TURRET_TOP: [number, number] = [-28, -30];
const TURRET_BOTTOM: [number, number] = [12, 47];
const HOLES = [
  [30, -12, 5],
  [-40, -4, 4],
  [70, 6, 4],
  [-8, -20, 4],
  [-74, -10, 3],
  [8, 2, 5],
];
export const ZEP_HP = 110;
const FUSE = 1.7;

function zHalf(x: number): number {
  const u = Math.max(-1, Math.min(1, x / (LEN / 2)));
  const hh = BODY_H / 2;
  if (u >= 0) return hh * Math.pow(Math.max(0, 1 - Math.pow(u, 2.3)), 1 / 2.3);
  const a = -u;
  return hh * Math.pow(Math.max(0, 1 - Math.pow(a, 1.9)), 1 / 1.9) * (1 - 0.1 * a);
}

const RED = ['#3a1010', '#5e1a16', '#88281e', '#b03e2a', '#d86a46'];

function pick(ramp: string[], t: number, x: number, y: number): string {
  const s = Math.max(0, Math.min(0.9999, t)) * (ramp.length - 1);
  const i = Math.floor(s);
  const f = s - i;
  // Banded shading: dither only across the middle of each step.
  return f > 0.35 + bayer(x, y) * 0.3 ? ramp[Math.min(ramp.length - 1, i + 1)] : ramp[i];
}

/** The tanker zeppelin, stage 0 intact / 1 holed / 2 critical. */
function zepArt(stage: number): PixelArt {
  const p = new PixelArt(W, H);
  const d = new Pen(p, OX, OY);
  const L = LEN / 2;
  // Tanker gondola (behind the belly).
  d.rect(-62, 26, 124, 16, P5.hullD);
  d.rect(-60, 27, 120, 13, P5.hull);
  d.rect(-60, 27, 120, 1, P5.hullLL);
  d.rect(-60, 38, 120, 2, P5.hullDD);
  for (let x = -54; x < 56; x += 18) {
    d.rect(x, 29, 12, 8, P5.hullL);
    d.rect(x, 29, 12, 1, P5.hullLL);
    d.circle(x + 6, 33, 2.2, P5.brassD);
    d.circle(x + 5.6, 32.6, 1.4, P5.brass);
  }
  d.poly([60, 27, 68, 32, 60, 40], P5.hullD);
  d.rect(-40, 42, 2, 6, P5.hullDD);
  d.rect(30, 42, 2, 4, P5.hullDD);
  d.rect(4, 40, 18, 4, P5.hullDD);
  d.rect(5, 40, 16, 2, P5.hullD);
  // Tail fins with hazard stripes.
  const fin = (pts: number[]) => {
    const m = new PixelArt(W, H);
    new Pen(m, OX, OY).poly(pts, '#ffffff');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.opaque(x, y)) p.px(x, y, Math.floor((x + y) / 4) % 2 ? '#e8c040' : '#2a2226');
  };
  fin([-L + 34, -4, -L + 12, -28, -L - 6, -28, -L + 2, -4]);
  fin([-L + 34, 4, -L + 12, 26, -L - 6, 26, -L + 2, 4]);
  d.rect(-L - 8, -1, 44, 3, P5.hullD);
  d.rect(-L - 8, -1, 44, 1, P5.hullL);
  // Envelope.
  for (let x = Math.ceil(-L); x <= Math.floor(L); x++) {
    const hh = zHalf(x);
    if (hh < 0.5) continue;
    const u = x / L;
    for (let y = Math.floor(-hh); y <= Math.ceil(hh); y++) {
      const v = (y + 0.5) / hh;
      if (Math.abs(v) > 1.02) continue;
      let lt = 0.66 - v * 0.52 - Math.max(0, Math.abs(u) - 0.7) * 0.9;
      if (v > -0.74 && v < -0.54 && Math.abs(u) < 0.6) lt += 0.25;
      if (Math.round(x) % 18 === 0 && Math.abs(v) < 0.96) lt -= 0.22;
      let c = pick(RED, lt, OX + x, OY + y);
      // Hazard bands near nose and tail.
      const band = (x > L * 0.5 && x < L * 0.5 + 9) || (x > -L * 0.62 && x < -L * 0.62 + 9);
      if (band && Math.abs(v) < 0.97) c = Math.floor((x + y + 400) / 4) % 2 ? shade('#e8c040', (lt - 0.5) * 0.5) : '#2a2226';
      p.px(OX + x, OY + y, c);
    }
  }
  // Brass nose cap.
  for (let x = Math.floor(L * 0.92); x <= L; x++) {
    const hh = zHalf(x);
    for (let y = Math.floor(-hh); y <= Math.ceil(hh); y++) {
      if (Math.abs(y / Math.max(1, hh)) > 1) continue;
      const lt = 0.6 - (y / Math.max(1, hh)) * 0.5;
      d.px(x, y, lt > 0.75 ? P5.brassL : lt > 0.4 ? P5.brass : P5.brassD);
    }
  }
  // Flame warning roundel.
  d.circle(24, -4, 9, '#2a2226');
  d.circle(24, -4, 7.6, '#efe6c8');
  d.poly([24, -11, 29, -3, 27, 2, 21, 2, 19, -3], '#e0782c');
  d.poly([24, -6, 26.5, -1, 24, 2, 21.5, -1], '#ffd040');
  // Fuel cells along the flank.
  for (const cx of CELLS) {
    d.cap(cx - 11, CELL_Y, cx + 11, CELL_Y, 5.4, '#2a2226');
    d.cap(cx - 11, CELL_Y - 0.5, cx + 11, CELL_Y - 0.5, 4.6, P5.hull);
    d.rect(cx - 10, CELL_Y - 5, 20, 1, P5.hullLL);
    for (const ex of [cx - 13, cx + 12]) {
      d.rect(ex, CELL_Y - 5, 2, 10, P5.brassD);
      d.rect(ex, CELL_Y - 5, 1, 10, P5.brass);
    }
    // Sight glass (amber fuel; white-hot when critical).
    d.rect(cx - 8, CELL_Y - 2, 16, 4, P5.dark);
    d.rect(cx - 7, CELL_Y - 1, 14, 2, stage === 2 ? '#fff2a0' : '#f0a030');
    d.rect(cx - 7, CELL_Y - 1, 14 - (stage ? 5 : 0), 1, stage === 2 ? '#ffffff' : '#ffd060');
  }
  // Pipes between the cells and down to the gondola.
  d.rect(-40, CELL_Y + 6, 82, 1, P5.brassD);
  for (const cx of CELLS) d.rect(cx, CELL_Y + 5, 1, 9, P5.brassD);
  // Engine pods.
  for (const [ex, ey] of ENGINES) {
    d.rect(ex - 1, ey - 6, 3, 4, P5.hullD);
    d.cap(ex - 8, ey, ex + 7, ey, 3.4, P5.hullD);
    d.cap(ex - 8, ey - 0.5, ex + 7, ey - 0.5, 2.8, P5.hull);
    d.rect(ex - 7, ey - 3, 13, 1, P5.hullLL);
    d.rect(ex + 2, ey - 3, 2, 7, P5.brass);
  }
  // Damage.
  if (stage >= 1) {
    const n = stage === 1 ? 3 : HOLES.length;
    for (let i = 0; i < n; i++) {
      const [hx, hy, hr] = HOLES[i];
      d.circle(hx, hy, hr + 1.5, '#2a1410');
      d.circle(hx, hy, hr, P5.dark);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + i;
        d.px(Math.round(hx + Math.cos(a) * (hr + 1)), Math.round(hy + Math.sin(a) * (hr + 1)), k % 2 ? '#e0782c' : '#ffb040');
      }
      // Exposed frame rib.
      d.rect(hx - 1, hy - hr + 1, 1, hr * 2 - 1, '#6a5a4a');
    }
  }
  if (stage === 2) {
    // Scorch.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = p.getRaw(x, y);
        if (!(v >>> 24)) continue;
        const k = ((x * 37 + y * 91) % 23) / 23;
        if (k < 0.18) p.px(x, y, mixColor('#2a1410', '#5e1a16', k * 4));
      }
    }
  }
  return p;
}

const artCache = new Map<number, PixelArt>();
function art(stage: number): PixelArt {
  let a = artCache.get(stage);
  if (!a) {
    a = zepArt(stage);
    artCache.set(stage, a);
  }
  return a;
}

sprites.define({ name: 'm5_zep', w: W, h: H, ox: OX, oy: OY, frames: 3, draw: (p, f) => p.blit(art(f), 0, 0) });

/** Burnt halves for the wreck: 0 front (nose), 1 rear (tail). Same origin as the ship. */
sprites.define({
  name: 'm5_zep_half',
  w: W,
  h: H,
  ox: OX,
  oy: OY,
  frames: 2,
  draw: (p, f) => {
    const src = art(2);
    for (let y = 0; y < H; y++) {
      const brk = OX + 4 + Math.round(Math.sin(y * 0.9) * 3 + ((y * 7) % 5) - 2);
      for (let x = 0; x < W; x++) {
        const front = x >= brk;
        if (front !== (f === 0)) continue;
        const v = src.getRaw(x, y);
        if (!(v >>> 24)) continue;
        // Darken (burnt) with ember speckles near the break.
        const r = v & 255;
        const g = (v >>> 8) & 255;
        const b = (v >>> 16) & 255;
        const k = 0.45;
        let c = `#${[r, g, b].map((n) => Math.round(n * k).toString(16).padStart(2, '0')).join('')}`;
        const nearBreak = Math.abs(x - brk) < 5;
        if (nearBreak && (x * 13 + y * 7) % 5 === 0) c = (x + y) % 2 ? '#ff8a3a' : '#ffd060';
        p.px(x, y, c);
      }
    }
  },
});

// ------------------------------------------------------------------ wreck half

class ZepHalf extends Entity {
  private rot = 0;
  private vr: number;
  private fxT = 0;
  constructor(
    x: number,
    y: number,
    private frame: number,
    vx: number,
    vy: number,
    vr: number,
    facing: 1 | -1,
  ) {
    super();
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.vr = vr;
    this.facing = facing;
    this.anchor = 'center';
    this.z = Z.ENEMY - 4;
    this.persistent = true;
  }

  override update(dt: number): void {
    this.vy = Math.min(this.vy + 260 * dt, 220);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vr * dt;
    this.fxT -= dt;
    if (this.fxT <= 0) {
      this.fxT = 0.07;
      const ox = (this.frame === 0 ? 40 : -40) * this.facing;
      flames(this.world, this.x + ox + fxRng.range(-20, 20), this.y + fxRng.range(-10, 10), { n: 1, size: 2.5, life: 0.4 });
      smoke(this.world, this.x + ox, this.y - 6, { n: 1, size: 3, size2: 9, life: 1.1 });
    }
    if (this.y > this.world.camera.y + 340) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    sprites.get('m5_zep_half').draw(g, this.x, this.y, this.frame, { flip: this.facing < 0, rot: this.rot });
  }
}

// ------------------------------------------------------------------ entity

export class FuelZeppelin extends Enemy {
  readonly turrets: Entity[] = [];
  private withTurrets: boolean;
  private killer: Entity | null = null;
  private leakT = 0;
  private popT = 0;
  private blasted = false;
  private boxes: Rect[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];

  constructor(props: Record<string, any> = {}) {
    super();
    this.anchor = 'center';
    this.w = 200;
    this.h = 56;
    this.hp = this.maxHp = ZEP_HP;
    this.scoreValue = 5000;
    this.meleeable = false;
    this.gravityScale = 0;
    this.collideTerrain = false;
    this.facing = props.facing === 1 ? 1 : -1;
    this.withTurrets = props.turrets !== false;
    this.deathSfx = null;
    this.deathDuration = FUSE + 0.6;
    this.z = Z.ENEMY - 3;
  }

  /** World position of a local (facing right) point. */
  at(lx: number, ly: number): { x: number; y: number } {
    return { x: this.x + lx * this.facing, y: this.y + ly };
  }

  override spawned(): void {
    super.spawned();
    if (this.props.facing === undefined) this.facing = -1;
    if (this.withTurrets) {
      const top = this.at(TURRET_TOP[0], TURRET_TOP[1]);
      const bot = this.at(TURRET_BOTTOM[0], TURRET_BOTTOM[1]);
      for (const [pt, mount] of [
        [top, 'top'],
        [bot, 'bottom'],
      ] as const) {
        const t = this.world.spawn('airship_turret', pt.x, pt.y, { mount, facing: this.facing });
        if (t) this.turrets.push(t);
      }
    }
  }

  override hurtboxes(): Rect[] {
    const [a, b, c] = this.boxes;
    a.x = this.x - 104;
    a.y = this.y - 13;
    a.w = 208;
    a.h = 26;
    b.x = this.x - 80;
    b.y = this.y - 27;
    b.w = 160;
    b.h = 54;
    c.x = this.x - 60;
    c.y = this.y + 26;
    c.w = 120;
    c.h = 16;
    return this.boxes;
  }

  get hpFrac(): number {
    return this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
  }

  get stage(): number {
    if (this.dying) return 2;
    const f = this.hpFrac;
    return f > 0.66 ? 0 : f > 0.33 ? 1 : 2;
  }

  override damage(d: Damage): boolean {
    if (!this.dying && d.owner) this.killer = d.owner;
    return super.damage(d);
  }

  override onDamaged(d: Damage): void {
    const x = d.x ?? this.cx;
    const y = d.y ?? this.cy;
    if (d.kind === 'bullet' || d.kind === 'laser') sparkBurst(this.world, x, y, 2, '#ffd080', 90);
    if (fxRng.chance(0.3)) this.world.sfx('metal_hit', this.x, { vol: 0.3, pitch: fxRng.range(0.8, 1.0) });
    this.flash = 0.05;
  }

  /** Gyros cannot fly through the envelope: ease them out along the hull normal. */
  private pushPlayers(): void {
    for (const p of this.world.players) {
      const v = p.vehicle;
      if (!v || (v as any).destroyed) continue;
      const vx = v.x;
      const vy = v.y - v.h / 2;
      const rx = 104 + v.w / 2 - 6;
      const ry = 28 + v.h / 2 - 4;
      const nx = (vx - this.x) / rx;
      const ny = (vy - this.y) / ry;
      const k = nx * nx + ny * ny;
      if (k >= 1) continue;
      const len = Math.hypot(nx / rx, ny / ry) || 1;
      const push = 2.5;
      v.x += ((nx / rx) / len) * push;
      v.y += ((ny / ry) / len) * push + (ny === 0 ? -push : 0);
      if (ny < 0 && v.vy > 0) v.vy = 0;
      if (ny > 0 && v.vy < 0) v.vy = 0;
    }
  }

  think(dt: number): void {
    this.pushPlayers();
    // Damage FX: leaking burning fuel, then fire + smoke.
    const st = this.stage;
    if (st >= 1 && this.onScreen(20)) {
      this.leakT -= dt;
      if (this.leakT <= 0) {
        this.leakT = st === 2 ? 0.05 : 0.12;
        const n = st === 1 ? 3 : HOLES.length;
        const [hx, hy] = HOLES[Math.floor(fxRng.next() * n)];
        const p = this.at(hx, hy);
        flames(this.world, p.x, p.y, { n: 1, size: 2, life: 0.35 });
        if (st === 2) smoke(this.world, p.x, p.y - 4, { n: 1, size: 3, size2: 8, life: 1.0 });
        else this.world.particles.add({ kind: 'px', x: p.x, y: p.y + 2, vx: fxRng.range(-6, 6), vy: fxRng.range(20, 50), life: 0.7, color: '#ffb040', color2: '#e05a20', gravity: 220 });
      }
    }
  }

  override die(d?: Damage): void {
    super.die(d);
    // Keep the wave waiting until the fireball.
    this.blocksProgress = true;
    this.vx = 0;
    this.vy = 0;
    this.world.sfx('alarm', this.x, { vol: 0.8 });
    this.world.sfx('explosion', this.x, { vol: 0.8 });
  }

  override updateDeath(dt: number): void {
    this.pushPlayers();
    this.vx = 0;
    this.vy = 0;
    if (this.blasted) return;
    this.popT -= dt;
    if (this.popT <= 0) {
      this.popT = 0.13;
      const lx = fxRng.range(-95, 95);
      const ly = fxRng.range(-20, 22);
      const p = this.at(lx, ly);
      this.world.effect(fxRng.chance(0.5) ? 'explosion_small' : 'explosion_medium', p.x, p.y, { fps: 20 });
      flames(this.world, p.x, p.y, { n: 3, size: 3, life: 0.5 });
      if (fxRng.chance(0.5)) this.world.sfx('explosion_small', p.x, { vol: 0.6 });
      this.world.shake(1.5, 0.1);
    }
    if (this.deathTime >= FUSE) this.fireball();
  }

  private fireball(): void {
    this.blasted = true;
    const w = this.world;
    const owner = this.killer;
    // The big one: wipes out the escorts around it (credited to the shooter)...
    w.explode(this.x, this.y, { radius: 132, damage: 40, team: 'player', owner, size: 'none', shake: 0, sfx: null });
    // ...and singes a gyro hanging around right next to it.
    w.explode(this.x, this.y, { radius: 70, damage: 1, team: 'enemy', owner: this, size: 'none', shake: 0, sfx: null });
    for (const t of this.turrets) if (!t.dead && t.hittable) t.damage({ amount: 999, kind: 'explosion', owner });
    for (let i = 0; i < 7; i++) {
      const p = this.at(-90 + i * 30, fxRng.range(-14, 14));
      w.effect(i % 2 ? 'explosion_large' : 'explosion_huge', p.x, p.y, { fps: 14 + i });
    }
    w.particles.debris(this.x, this.y, 30, ['#88281e', '#b03e2a', '#4c4e5a', '#d4a23a', '#2a2226'], 300);
    smoke(w, this.x, this.y, { n: 14, size: 6, size2: 16, life: 1.6, spread: 70 });
    flames(w, this.x, this.y, { n: 12, size: 4, life: 0.8, spread: 60 });
    w.sfx('explosion_big', this.x, { vol: 1 });
    w.sfx('fire_burst', this.x, { vol: 0.8 });
    w.shake(7, 0.6);
    w.flash('#ffe0a0', 0.45);
    w.hitstop(0.06);
    // The halves fall away, burning.
    w.add(new ZepHalf(this.x, this.y, 0, 30 * this.facing, -40, 0.5 * this.facing, this.facing));
    w.add(new ZepHalf(this.x, this.y, 1, -26 * this.facing, -20, -0.42 * this.facing, this.facing));
    this.blocksProgress = false;
    this.hidden = true;
  }

  private hidden = false;

  override render(g: CanvasRenderingContext2D): void {
    if (this.hidden) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const flip = this.facing < 0;
    const t = this.world.time;
    const flash = this.flash > 0 || (this.dying && Math.floor(this.deathTime * 14) % 2 === 0 && this.deathTime > FUSE - 0.6);
    sprites.get('m5_zep').draw(g, x, y, this.stage, { flip, flash });
    // Props.
    ENGINES.forEach(([ex, ey], i) => {
      const lx = ex - 11;
      sprites.get('m5_prop_l').draw(g, x + lx * this.facing, y + ey, Math.floor(t * 28 + i) % 4);
    });
    // Fuel cell glow pulse (faster when hurt; strobing white while the fuse burns).
    const rate = this.dying ? 14 : this.stage === 2 ? 6 : this.stage === 1 ? 3.5 : 2;
    const pulse = 0.5 + 0.5 * Math.sin(t * rate);
    g.globalAlpha = (this.dying ? 0.6 : 0.25) * pulse;
    g.fillStyle = this.dying ? '#ffffff' : '#ffc040';
    for (const cx of CELLS) {
      const px = x + (cx - 9) * this.facing - (flip ? 18 : 0);
      g.fillRect(px, y + CELL_Y - 3, 18, 6);
    }
    g.globalAlpha = 1;
  }
}

registerEntity(
  'm5_fuel_zeppelin',
  'enemy',
  (_w, s) => new FuelZeppelin(s.props ?? {}),
  'Mission 5 set piece: Legion fuel tanker zeppelin (110 HP x difficulty, 5000 pts) hovering at x/y (envelope centre) with two escort airship_turrets (spine + keel; props.turrets=false for none). Pushes gyros out of its hull. Destroyed: 1.7 s chain of blasts, then a huge fireball that destroys nearby enemies (and singes a gyro right next to it). Blocks its wave until the fireball. props.facing (default -1), drop',
);
