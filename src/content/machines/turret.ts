// turret — emplaced gun on a sandbagged concrete pedestal (14 HP).
//  kind 'mg'     : manned twin machine gun behind a shield; 4-round bursts.
//  kind 'cannon' : armored dome with a short cannon; lobs arcing shells.
//  kind 'flak'   : twin anti-air gun; shells burst overhead into slow falling fragments
//                  (aimed straight at flying players).
// Every shot is telegraphed: the barrel swings onto you, then the muzzle glows.
// props: kind ('mg' default | 'cannon' | 'flak'), dir (-1|1: fixed facing; the gun cannot turn,
//        so you can flank it) — without dir it slowly turns to face you. facing works like dir. drop.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import { Shell } from '../../game/projectile';
import { MC, Machine, Pen, FlyingPart, FlakShell, plate, rivetRow, cog, charr, sandbag, ballistic, angleFrame, msfx, drawHumanClip, CREW_GUNNER } from './common';

type Kind = 'mg' | 'cannon' | 'flak';

const BASE_W = 36;
const BASE_H = 13;
/** Gun pivot relative to the turret's feet. */
const PIV_DY = -13;
const AIM_N = 6;

interface KindSpec {
  w: number;
  h: number;
  ox: number;
  oy: number;
  a0: number;
  a1: number;
  /** Barrel length from the pivot to the muzzle. */
  len: number;
  /** Barrel axis offset from the pivot (perpendicular, up negative). */
  lift: number;
}

const SPEC: Record<Kind, KindSpec> = {
  mg: { w: 38, h: 34, ox: 14, oy: 24, a0: 0, a1: 0.9, len: 19, lift: -2 },
  cannon: { w: 42, h: 30, ox: 14, oy: 22, a0: 0, a1: 0.9, len: 18, lift: -4 },
  flak: { w: 40, h: 38, ox: 14, oy: 28, a0: 0.35, a1: 1.4, len: 21, lift: -3 },
};

function aimOf(k: Kind, f: number): number {
  const s = SPEC[k];
  return s.a0 + (f / (AIM_N - 1)) * (s.a1 - s.a0);
}

// ------------------------------------------------------------------ art

sprites.define({
  name: 'mach_turret_base',
  w: BASE_W,
  h: BASE_H,
  frames: 2,
  draw: (p, f) => {
    const d = new Pen(p);
    // Concrete pedestal.
    d.poly([6, 13, 9, 5, 27, 5, 30, 13], MC.conc);
    d.poly([9, 5, 27, 5, 26.5, 6, 9.5, 6], MC.concL);
    d.poly([6, 13, 9, 5, 10, 5, 7.5, 13], MC.concL);
    d.poly([27, 5, 30, 13, 28.5, 13, 26, 6], MC.concD);
    d.line(14, 8, 16, 11, MC.concD);
    d.line(16, 11, 15, 13, MC.concD);
    // Mount ring.
    plate(d, 12, 3, 12, 3, MC.steel, { hi: 0.3 });
    // Sandbag walls (front stack is taller).
    sandbag(d, 24, 9, 7, 4);
    sandbag(d, 29, 9, 7, 4, MC.sandD);
    sandbag(d, 26, 5.5, 8, 4);
    sandbag(d, 0, 9, 7, 4, MC.sandD);
    sandbag(d, 5, 9, 6, 4);
    sandbag(d, 1, 6, 7, 3.6, MC.sand);
    if (f === 1) charr(p, 3, 0.02);
  },
});

function drawGun(p: PixelArt, k: Kind, a: number, crew = true): void {
  const s = SPEC[k];
  const d = new Pen(p);
  const cs = Math.cos(-a);
  const sn = Math.sin(-a);
  const PX = s.ox;
  const PY = s.oy;
  const at = (t: number, side = 0): [number, number] => [PX + cs * t - sn * side, PY + sn * t + cs * side];
  const capA = (t0: number, t1: number, side: number, r: number, c: string) => {
    const [x0, y0] = at(t0, side);
    const [x1, y1] = at(t1, side);
    d.cap(x0, y0, x1, y1, r, c);
  };
  if (k === 'mg') {
    // Gunner crouched behind the gun, hands on the spade grips (hips hidden by the sandbags).
    const [gx, gy] = at(-6, s.lift + 1.5);
    const fx = PX - 11;
    const fy = PY + 11;
    const shx = fx + 2;
    const shy = fy - 7 - 10;
    if (crew) drawHumanClip(p, fx, fy, { hip: [0, -7], footB: [-4, 0], footF: [4, 0], lean: 2, gun: 'none', handF: [gx - shx + 0.5, gy - shy], handB: [gx - shx - 1, gy - shy + 1], expr: 'normal' }, CREW_GUNNER, -10, PY + 3);
    // Pintle post.
    d.rect(PX - 1, PY, 3, 6, MC.steelD);
    d.px(PX - 1, PY, MC.steelL);
    // Twin barrels + receiver + ammo belt box.
    capA(-4, s.len, s.lift - 1.1, 0.75, MC.steelD);
    capA(-4, s.len, s.lift + 1.1, 0.75, MC.steelD);
    capA(0, s.len - 2, s.lift - 1.6, 0.35, MC.steelL);
    capA(s.len - 2.5, s.len, s.lift - 1.1, 1.1, MC.steel);
    capA(s.len - 2.5, s.len, s.lift + 1.1, 1.1, MC.steel);
    capA(-6, 3, s.lift, 2.1, MC.steel);
    capA(-5, 2, s.lift - 1.2, 0.55, MC.steelLL);
    const [ax, ay] = at(-1, s.lift + 4);
    d.rect(ax - 2, ay - 1, 5, 4, MC.olive);
    d.rect(ax - 2, ay - 1, 5, 1, MC.oliveL);
    d.px(ax + 2, ay + 2, MC.oliveD);
    capA(-7, -6, s.lift + 1.5, 0.9, MC.steelD);
    // Shield in front of the receiver (tilts back with the barrel).
    const [sx0, sy0] = at(3, s.lift - 7);
    const [sx1, sy1] = at(3, s.lift + 6);
    const [sx2, sy2] = at(5, s.lift + 5);
    const [sx3, sy3] = at(5, s.lift - 6);
    d.poly([sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3], MC.olive);
    d.cap(sx0, sy0, sx1, sy1, 0.55, MC.oliveLL);
    d.cap(sx3, sy3, sx2, sy2, 0.5, MC.oliveD);
    const [cx, cy] = at(4, s.lift + 3);
    d.px(cx, cy, MC.rust);
  } else if (k === 'cannon') {
    // Barrel.
    capA(0, s.len, s.lift, 1.7, MC.steel);
    capA(2, s.len - 2, s.lift - 0.9, 0.5, MC.steelLL);
    capA(s.len - 3.5, s.len, s.lift, 2.2, MC.steelD);
    // Armored dome.
    d.poly([PX - 12, PY + 3, PX - 12, PY - 3, PX - 8, PY - 9, PX + 2, PY - 10, PX + 8, PY - 7, PX + 10, PY - 2, PX + 10, PY + 3], MC.olive);
    d.poly([PX - 12, PY - 3, PX - 8, PY - 9, PX + 2, PY - 10, PX + 2, PY - 9, PX - 7.5, PY - 8, PX - 11, PY - 2.5], MC.oliveLL);
    d.rect(PX - 12, PY + 1, 22, 2, MC.oliveD);
    d.rect(PX + 8, PY - 6, 2, 8, MC.oliveD);
    rivetRow(d, PX - 10, PX + 6, PY - 1, 4, MC.olive);
    d.rect(PX - 4, PY - 6, 7, 1, MC.black);
    cog(d, PX - 6, PY - 3, 2);
    // Mantlet.
    const [mx, my] = at(1, s.lift);
    d.circle(mx, my, 3, MC.oliveD);
    d.circle(mx - 0.5, my - 0.5, 2, MC.olive);
  } else {
    // Flak: gunner seated behind the mount cranking the hand wheel; twin long barrels.
    if (crew) drawHumanClip(p, PX - 12, PY + 6, { hip: [0, -7], footB: [4, -1], footF: [7, 0], lean: 1.5, gun: 'none', handF: [8, 6], handB: [7, 7], expr: 'normal' }, CREW_GUNNER, -10, PY + 3);
    d.rect(PX - 14, PY - 2, 6, 2, MC.steelD); // seat
    d.rect(PX - 12, PY, 2, 5, MC.steelD);
    d.rect(PX - 1, PY - 1, 3, 7, MC.steelD); // post
    // Hand wheel on the pedestal.
    d.circle(PX - 4, PY + 1, 2.2, MC.steelD);
    d.circle(PX - 4, PY + 1, 0.9, MC.steelL);
    // Barrels (long, with flash hiders).
    capA(2, s.len, s.lift - 1.6, 0.85, MC.steelD);
    capA(2, s.len, s.lift + 1.6, 0.85, MC.steelD);
    capA(4, s.len - 3, s.lift - 2.1, 0.35, MC.steelL);
    capA(s.len - 3.5, s.len, s.lift - 1.6, 1.35, MC.steel);
    capA(s.len - 3.5, s.len, s.lift + 1.6, 1.35, MC.steel);
    // Breech cradle + ammo clips.
    capA(-4, 4, s.lift, 2.8, MC.olive);
    capA(-3, 3, s.lift - 1.6, 0.7, MC.oliveL);
    const [bx, by] = at(-1, s.lift - 4);
    d.rect(bx - 1, by - 1, 3, 3, MC.brass);
    d.px(bx - 1, by - 1, MC.brassL);
  }
}

for (const k of ['mg', 'cannon', 'flak'] as Kind[]) {
  const s = SPEC[k];
  sprites.define({
    name: `mach_turret_${k}`,
    w: s.w,
    h: s.h,
    ox: s.ox,
    oy: s.oy,
    frames: AIM_N + 1,
    draw: (p, f) => {
      if (f === AIM_N) {
        drawGun(p, k, aimOf(k, 2), false);
        charr(p, 9);
        return;
      }
      drawGun(p, k, aimOf(k, f));
    },
  });
}

// ------------------------------------------------------------------ behaviour

export class Turret extends Machine {
  kind: Kind;
  fixed: boolean;
  aim: number;
  wantAim: number;
  fireT = 0;
  burst = 0;
  burstT = 0;
  turnT = 0;
  recoil = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.kind = props.kind === 'cannon' || props.kind === 'flak' ? props.kind : 'mg';
    const dir = props.dir ?? props.facing;
    this.fixed = dir === 1 || dir === -1;
    if (this.fixed) this.facing = dir;
    this.w = 30;
    this.h = 26;
    this.hp = this.maxHp = 14;
    this.scoreValue = this.kind === 'mg' ? 500 : 600;
    this.boom = 'large';
    this.blast = { radius: 26, damage: 4 };
    this.crewOut = this.kind === 'cannon' ? [] : ['mach_crew'];
    this.debris = [MC.olive, MC.oliveD, MC.steel, MC.sand, MC.sandD, MC.conc];
    this.smokeAt = [
      [0, -18],
      [-6, -12],
    ];
    this.wreckTime = 2.6;
    this.aim = SPEC[this.kind].a0 + 0.1;
    this.wantAim = this.aim;
  }

  override spawned(): void {
    super.spawned();
    if (this.fixed) this.facing = (this.props.dir ?? this.props.facing) as 1 | -1;
    this.fireT = this.fireDelay(1.0);
    this.setState('idle');
  }

  private get spec(): KindSpec {
    return SPEC[this.kind];
  }

  /** Muzzle position in world coordinates. */
  muzzle(): { x: number; y: number } {
    const s = this.spec;
    const a = -this.aim;
    const lx = Math.cos(a) * s.len - Math.sin(a) * s.lift;
    const ly = Math.sin(a) * s.len + Math.cos(a) * s.lift;
    return { x: this.x + lx * this.facing, y: this.y + PIV_DY + ly };
  }

  think(dt: number): void {
    const t = this.target();
    const s = this.spec;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 12);
    // Turn around (only unfixed turrets, slowly).
    if (t && !this.fixed && Math.sign(t.x - this.x) !== this.facing && Math.abs(t.x - this.x) > 12) {
      this.turnT += dt;
      if (this.turnT > 0.9) {
        this.facing = this.facing > 0 ? -1 : 1;
        this.turnT = 0;
        this.setState('idle');
      }
    } else this.turnT = 0;
    const inFront = t ? Math.sign(t.x - this.x) === this.facing || Math.abs(t.x - this.x) < 8 : false;
    // Track the target with the barrel.
    if (t && inFront) {
      const p = { x: this.x, y: this.y + PIV_DY };
      const dx = Math.abs(t.cx - p.x) + 1;
      let want = Math.atan2(p.y - t.cy, dx);
      if (this.kind === 'flak') {
        const flying = t.bottom < this.world.terrain.groundTopAt(t.x) - 40;
        if (!flying) want = Math.atan2(p.y - (t.cy - 70), dx);
      } else if (this.kind === 'cannon') {
        const sol = this.solve(t.x, t.y - 2);
        want = Math.atan2(-sol.vy, Math.abs(sol.vx));
      }
      this.wantAim = Math.max(s.a0, Math.min(s.a1, want));
    } else this.wantAim = s.a0 + (s.a1 - s.a0) * 0.2;
    const rate = this.kind === 'mg' ? 2.6 : this.kind === 'flak' ? 1.8 : 1.3;
    this.aim += Math.sign(this.wantAim - this.aim) * Math.min(Math.abs(this.wantAim - this.aim), rate * dt);

    switch (this.state) {
      case 'idle':
        this.fireT -= dt;
        if (this.fireT <= 0 && t && inFront && this.canAttack()) this.setState('windup');
        break;
      case 'windup': {
        const wind = this.kind === 'mg' ? 0.45 : this.kind === 'flak' ? 0.5 : 0.6;
        if (!t || !inFront) {
          this.setState('idle');
          break;
        }
        if (this.stateTime > wind && Math.abs(this.aim - this.wantAim) < 0.12) {
          this.setState('fire');
          this.burst = this.kind === 'mg' ? 4 : this.kind === 'flak' ? 2 : 1;
          this.burstT = 0;
        }
        break;
      }
      case 'fire':
        this.burstT -= dt;
        if (this.burstT <= 0 && this.burst > 0) {
          this.burst--;
          this.burstT = this.kind === 'mg' ? 0.11 : 0.28;
          this.fire();
        }
        if (this.burst <= 0 && this.burstT <= 0) {
          this.fireT = this.fireDelay(this.kind === 'mg' ? 1.9 : this.kind === 'flak' ? 2.4 : 2.7);
          this.setState('idle');
        }
        break;
    }
    this.vx = 0;
    this.moveAndCollide(dt);
  }

  private solve(tx: number, ty: number): { vx: number; vy: number } {
    const m = this.muzzle();
    const T = Math.max(0.7, Math.min(1.4, 0.5 + Math.abs(tx - m.x) / 300)) / this.world.difficulty.enemyShotSpeed;
    return ballistic(m.x, m.y, tx, ty, 220, T);
  }

  private fire(): void {
    if (!this.canAttack()) return;
    const t = this.target();
    const m = this.muzzle();
    const ang = this.facing > 0 ? -this.aim : Math.PI + this.aim;
    if (this.kind === 'mg') {
      this.shoot(m.x, m.y, { angle: ang, speed: 160, spread: 0.03 });
      const fx = this.world.effect('muzzle_flash', m.x, m.y, { fps: 30 });
      fx.rot = ang;
      msfx(this, 'turret_fire', { vol: 0.6 });
      this.world.particles.add({ kind: 'px', x: this.x, y: this.y - 14, vx: -this.facing * fxRng.range(20, 50), vy: fxRng.range(-60, -30), life: 0.5, color: MC.brass, gravity: 500 });
      this.recoil = 1.5;
    } else if (this.kind === 'cannon') {
      const tx = t ? t.x : m.x + this.facing * 120;
      const ty = t ? t.y - 2 : this.y;
      const v = this.solve(tx, ty);
      this.world.add(new Shell({ team: 'enemy', owner: this, x: m.x, y: m.y, vx: v.vx, vy: v.vy, gravity: 220, radius: 18, damage: 5, sprite: 'mach_shell' }));
      const fx = this.world.effect('mach_flash', m.x, m.y, { fps: 24 });
      fx.rot = Math.atan2(v.vy, v.vx);
      this.world.particles.smokePuffs(m.x, m.y, 2, 3, '#a8a098', '#6a6470');
      msfx(this, 'tank_cannon', { vol: 0.8 });
      this.recoil = 3;
      this.jolt = 0.06;
    } else {
      const sp = this.shotSpeed(170);
      let fuse = 0.9;
      if (t) {
        const flying = t.bottom < this.world.terrain.groundTopAt(t.x) - 40;
        const ty = flying ? t.cy : t.cy - 70;
        fuse = Math.max(0.35, Math.min(1.6, Math.hypot(t.cx - m.x, ty - m.y) / sp));
      }
      const a2 = ang + this.world.rng.range(-0.05, 0.05);
      this.world.add(new FlakShell(this, m.x, m.y, Math.cos(a2) * sp, Math.sin(a2) * sp, fuse));
      const fx = this.world.effect('muzzle_flash', m.x, m.y, { fps: 30 });
      fx.rot = ang;
      msfx(this, 'mortar_fire', { vol: 0.7 });
      this.recoil = 2;
    }
  }

  override onExplode(): void {
    this.world.add(
      new FlyingPart(`mach_turret_${this.kind}`, AIM_N, this.x, this.y + PIV_DY - 4, -this.facing * fxRng.range(40, 80), -fxRng.range(220, 280), fxRng.range(6, 10) * (fxRng.chance(0.5) ? 1 : -1), { flip: this.facing < 0, life: 2.2 }),
    );
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.hidden) return;
    const flip = this.facing < 0;
    const flash = this.flash > 0;
    const x = this.x + this.joltX;
    const base = sprites.get('mach_turret_base');
    if (this.wrecked) {
      base.draw(g, x, this.y, 1, { flip });
      return;
    }
    const s = this.spec;
    const f = angleFrame(this.aim, s.a0, s.a1, AIM_N);
    const rx = -this.facing * Math.round(this.recoil);
    // Gun first for the flak/mg gunner's legs to sit behind the sandbags.
    sprites.get(`mach_turret_${this.kind}`).draw(g, x + rx, this.y + PIV_DY, f, { flip, flash });
    base.draw(g, x, this.y, 0, { flip, flash });
    if (this.state === 'windup' && Math.floor(this.stateTime * 14) % 2 === 0) {
      const m = this.muzzle();
      sprites.get('mach_glow').draw(g, m.x, m.y, Math.min(2, Math.floor(this.stateTime * 5)));
    }
  }
}

registerEntity(
  'turret',
  'enemy',
  (_w, s) => new Turret(s.props),
  "Emplaced gun on a sandbagged pedestal (14 HP): telegraphed (barrel swing + muzzle glow). props.kind 'mg' (bursts) | 'cannon' (arcing shells) | 'flak' (air-burst shells, aims at flyers); props.dir -1|1 fixed facing (else turns to face you slowly); props.drop",
);
