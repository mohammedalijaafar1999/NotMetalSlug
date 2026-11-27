// m6_ladle - a crane ladle full of molten iron that tips over and pours (IRON CITADEL foundry).
// Cycle: IDLE (hangs, sways) -> TILT (0.9 s: tips toward the spout, drips, a glowing target ring
// pulses on the floor where the stream will land) -> POUR (1.3 s: a column of molten metal that
// burns anything under it; props.splash globs arc out to the sides, each landing spot marked first)
// -> RIGHT ITSELF. Pour it into a molten channel for scenery, or across the walkway as a timed hazard.
//   spawn: { type: 'm6_ladle', x: <stream x>, y: <where the stream lands (floor/molten surface)>,
//            trigger: <early>, props: { cycle: 5, offset: 0, height: 120 (lip above y), splash: 2 } }

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { rectsOverlap } from '../../../engine/math';
import { registerEntity } from '../../../game/registry';
import { Actor, Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { Hostage } from '../../../game/hostage';
import { Projectile } from '../../../game/projectile';
import { ramp, rotPts, shaded } from '../../vehicles/art';
import { GroundMarker } from '../../bosses/common/fx';
import { M6 } from '../../themes/m6/palette';

const TILTS = [0, 0.2, 0.42, 0.66, 0.9];
const LW = 48;
const LH = 46;
/** Bail pivot in sprite space. */
const PX = 24;
const PY = 6;
/** Upright spout lip (sprite space, relative to the pivot). */
const LIP: [number, number] = [15, 9];

function lipOffset(a: number): [number, number] {
  const [x, y] = rotPts([PX + LIP[0], PY + LIP[1]], PX, PY, a);
  return [x - PX, y - PY];
}

sprites.define({
  name: 'm6_ladle',
  w: LW,
  h: LH,
  ox: PX,
  oy: PY,
  frames: TILTS.length,
  draw: (p, f) => {
    const a = TILTS[f];
    const R = (pts: number[]) => rotPts(pts, PX, PY, a);
    // bail (handle): from the hook eye down to the trunnion pins on both sides
    const [blx, bly] = R([PX - 13, PY + 7]);
    const [brx, bry] = R([PX + 13, PY + 7]);
    p.line(PX, PY - 5, blx, bly, M6.ironD, 2);
    p.line(PX, PY - 5, brx, bry, M6.ironD, 2);
    p.rect(PX - 2, PY - 6, 4, 3, M6.ironL);
    // bucket: tapered crucible with brass bands and a spout on the right
    const body = R([PX - 14, PY + 8, PX + 14, PY + 8, PX + 11, PY + 34, PX - 11, PY + 34]);
    shaded(p, (m) => m.poly(body, '#fff'), ramp(M6.ironL, 0.28, -0.36));
    const spout = R([PX + 13, PY + 8, PX + 19, PY + 7, PX + 15, PY + 14]);
    shaded(p, (m) => m.poly(spout, '#fff'), ramp(M6.ironL, 0.28, -0.36));
    for (const by of [14, 27]) {
      const band = R([PX - 14 + (by - 8) * 0.12, PY + by, PX + 14 - (by - 8) * 0.12, PY + by, PX + 14 - (by + 3 - 8) * 0.12, PY + by + 3, PX - 14 + (by + 3 - 8) * 0.12, PY + by + 3]);
      shaded(p, (m) => m.poly(band, '#fff'), ramp(M6.brassD, 0.34, -0.3));
    }
    // trunnion pins where the bail holds the bucket
    for (const sx of [-13, 13]) {
      const [tx, ty] = R([PX + sx, PY + 7]);
      p.circle(tx, ty, 2, M6.steelLL);
      p.px(Math.round(tx), Math.round(ty), M6.ironD);
    }
    // molten surface at the rim (more of it shows as it tips)
    const rim = R([PX - 12, PY + 9, PX + 13, PY + 9, PX + 13, PY + 11, PX - 12, PY + 11]);
    p.poly(rim, M6.molten);
    const rimHi = R([PX - 8, PY + 9, PX + 10, PY + 9, PX + 10, PY + 10, PX - 8, PY + 10]);
    p.poly(rimHi, M6.moltenLL);
    // glow on the bucket lip
    const [lx, ly] = R([PX + 16, PY + 8]);
    p.px(Math.round(lx), Math.round(ly), M6.moltenL);
  },
});

sprites.define({
  name: 'm6_glob',
  w: 5,
  h: 5,
  ox: 2,
  oy: 2,
  frames: 2,
  draw: (p, f) => {
    p.circle(2, 2, 2.2, M6.molten);
    p.circle(1.6, 1.6, 1.2, f ? M6.moltenLL : M6.moltenL);
  },
});

/** A blob of molten iron flung out of the pour: arcs, burns what it touches, splats on the floor. */
export class MoltenGlob extends Projectile {
  constructor(x: number, y: number, vx: number, vy: number) {
    super({ team: 'enemy', x, y, vx, vy, gravity: 420, damage: 1, kind: 'fire', w: 4, h: 4, life: 3, sprite: 'm6_glob', fps: 14 });
    this.offscreenMargin = 120;
  }
  protected override onHitTerrain(): void {
    this.world.particles.splash(this.x, this.y - 1, 6, M6.moltenL);
    this.world.particles.smokePuffs(this.x, this.y - 3, 1, 2, '#4a3a3a', '#2a2026');
    this.remove();
  }
}

type LadleState = 'idle' | 'tilt' | 'pour' | 'right';
const TILT_T = 0.9;
const POUR_T = 1.3;
const RIGHT_T = 0.7;

export class Ladle extends Entity {
  state: LadleState = 'idle';
  stateTime = 0;
  cycle = 5;
  height = 120;
  splash = 2;
  /** Current tilt angle. */
  tilt = 0;
  private idleT = 2;

  constructor() {
    super();
    this.z = Z.PROP + 3;
    this.team = 'neutral';
    this.hittable = false;
  }

  override spawned(): void {
    const P = this.props;
    this.cycle = typeof P.cycle === 'number' ? P.cycle : 5;
    this.height = typeof P.height === 'number' ? P.height : 120;
    this.splash = typeof P.splash === 'number' ? P.splash : 2;
    this.idleT = Math.max(0.6, this.cycle - (TILT_T + POUR_T + RIGHT_T));
    const off = typeof P.offset === 'number' ? P.offset : 0;
    this.stateTime = Math.min(this.idleT * 0.9, ((off % this.cycle) + this.cycle) % this.cycle);
    this.w = 14;
    this.h = this.height;
  }

  /** Pivot (hook point) position: placed so that the fully tilted lip sits right above the stream x. */
  get pivotX(): number {
    return this.x - lipOffset(TILTS[TILTS.length - 1])[0];
  }
  get pivotY(): number {
    return this.y - this.height - lipOffset(TILTS[TILTS.length - 1])[1];
  }

  get pouring(): boolean {
    return this.state === 'pour';
  }

  private set(s: LadleState): void {
    this.state = s;
    this.stateTime = 0;
  }

  override update(dt: number): void {
    this.stateTime += dt;
    const vis = this.onScreen(40);
    const maxA = TILTS[TILTS.length - 1];
    switch (this.state) {
      case 'idle':
        this.tilt = Math.sin(this.age * 1.3) * 0.03;
        if (this.stateTime >= this.idleT) {
          this.set('tilt');
          if (vis) {
            // mark where the stream will land (the top-most floor under it: a catwalk over a channel)
            const fy = this.world.terrain.floorAt(this.x, this.y - this.height + 8, this.y)?.y ?? this.y;
            this.world.add(new GroundMarker(this.x, fy, TILT_T + 0.05, 'cross', 7));
            this.world.sfx('mortar_whistle', this.x, { vol: 0.35, pitch: 0.55 });
          }
        }
        break;
      case 'tilt': {
        const k = this.stateTime / TILT_T;
        this.tilt = maxA * k * k;
        if (vis && k > 0.5 && fxRng.chance(dt * 10)) {
          this.world.particles.add({ kind: 'px', x: this.x + fxRng.range(-1, 1), y: this.y - this.height, vx: 0, vy: 40, gravity: 500, life: 0.6, color: M6.moltenL, color2: M6.molten, size: 1 });
        }
        if (k >= 1) {
          this.set('pour');
          this.launchSplashes(vis);
          if (vis) this.world.sfx('fire_burst', this.x, { vol: 0.7, pitch: 0.7 });
        }
        break;
      }
      case 'pour':
        this.tilt = maxA + Math.sin(this.stateTime * 20) * 0.01;
        this.burnColumn();
        if (vis && fxRng.chance(dt * 30)) {
          this.world.particles.add({ kind: 'px', x: this.x + fxRng.range(-3, 3), y: this.y - 2, vx: fxRng.range(-70, 70), vy: fxRng.range(-150, -60), gravity: 500, life: fxRng.range(0.3, 0.6), color: M6.moltenLL, color2: M6.molten, size: fxRng.pick([1, 1, 2]) });
        }
        if (vis && fxRng.chance(dt * 6)) this.world.particles.smokePuffs(this.x, this.y - 6, 1, 3, '#5a4448', '#2a2026');
        if (this.stateTime >= POUR_T) this.set('right');
        break;
      case 'right': {
        const k = this.stateTime / RIGHT_T;
        this.tilt = maxA * (1 - k);
        if (k >= 1) {
          this.tilt = 0;
          this.set('idle');
        }
        break;
      }
    }
  }

  private launchSplashes(vis: boolean): void {
    if (!vis) return;
    for (let i = 0; i < this.splash; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      const dist = 26 + this.world.rng.range(0, 34);
      const tx = this.x + dir * dist;
      const ty = this.world.terrain.groundBelow(tx, this.y - 40) ?? this.y;
      const T = 0.85 + this.world.rng.range(0, 0.25);
      const x0 = this.x;
      const y0 = this.y - 4;
      const g = 420;
      const vx = (tx - x0) / T;
      const vy = (ty - 2 - y0 - 0.5 * g * T * T) / T;
      this.world.add(new MoltenGlob(x0, y0, vx, vy));
      this.world.add(new GroundMarker(tx, ty, T, 'cross', 6));
    }
  }

  /** The stream burns anything inside it. */
  private burnColumn(): void {
    const r = { x: this.x - 4, y: this.y - this.height, w: 8, h: this.height };
    for (const e of this.world.entities) {
      if (e.dead || !(e instanceof Actor) || e instanceof Hostage) continue;
      if (!rectsOverlap(r, e.box)) continue;
      const anyE = e as any;
      if (anyE.isPlayer) {
        if (anyE.state === 'play' || anyE.state === 'respawn') e.damage({ amount: 99, kind: 'fire', x: e.x, y: e.y - 10, dir: e.x < this.x ? -1 : 1 });
      } else if (anyE.isVehicle) {
        if (anyE.driver && Math.floor(this.stateTime * 6) !== Math.floor((this.stateTime - 1 / 60) * 6)) e.damage({ amount: 1, kind: 'fire', x: e.x, y: e.y - 10 });
      } else if (e.hittable && e.team === 'enemy') {
        e.damage({ amount: 99, kind: 'fire', owner: null, x: e.x, y: e.y - 10, dir: e.x < this.x ? -1 : 1 });
      }
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    const px = Math.round(this.pivotX);
    const py = Math.round(this.pivotY);
    // crane cable from above + hook block
    g.fillStyle = M6.outline;
    g.fillRect(px - 2, py - 300, 4, 300 - 10);
    g.fillStyle = M6.steelL;
    g.fillRect(px - 1, py - 300, 1, 300 - 10);
    g.fillRect(px + 1, py - 300, 1, 300 - 10);
    sprites.get('m6d_hook').draw(g, px, py - 16);
    // ladle frame from the tilt angle
    let f = 0;
    for (let i = 0; i < TILTS.length; i++) if (Math.abs(TILTS[i] - this.tilt) < Math.abs(TILTS[f] - this.tilt)) f = i;
    sprites.get('m6_ladle').draw(g, px, py, f);
    // the pour: a wobbling column of molten metal from the lip to the floor
    if (this.state === 'pour' || (this.state === 'right' && this.stateTime < 0.15)) {
      const t = this.world.time;
      const top = Math.round(this.y - this.height);
      const bot = Math.round(this.y);
      const thin = this.state === 'right' || this.stateTime < 0.08;
      for (let y = top; y < bot; y += 2) {
        const wob = Math.round(Math.sin(y * 0.35 + t * 18) * 0.8);
        const x = Math.round(this.x) + wob;
        const w = thin ? 2 : 6;
        g.fillStyle = M6.moltenD;
        g.fillRect(x - w / 2, y, w, 2);
        if (!thin) {
          g.fillStyle = M6.molten;
          g.fillRect(x - 2, y, 4, 2);
          g.fillStyle = (y + Math.floor(t * 40)) % 6 < 3 ? M6.moltenLL : M6.moltenL;
          g.fillRect(x - 1, y, 2, 2);
        }
      }
      // splash crown + glow where it lands
      g.globalAlpha = 0.25 + 0.1 * Math.sin(t * 30);
      g.fillStyle = M6.glow;
      g.fillRect(Math.round(this.x) - 14, bot - 10, 28, 10);
      g.globalAlpha = 1;
      g.fillStyle = M6.moltenL;
      g.fillRect(Math.round(this.x) - 5, bot - 2, 10, 2);
      g.fillStyle = M6.moltenLL;
      g.fillRect(Math.round(this.x) - 3, bot - 3, 6, 1);
    }
  }
}

registerEntity(
  'm6_ladle',
  'hazard',
  () => new Ladle(),
  'Crane ladle (mission 6): x = where the molten stream lands, y = that floor/surface y; cycles IDLE -> TILT (0.9 s, ' +
    'drips + target marker) -> POUR (1.3 s burning column, props.splash globs with landing markers) -> upright. ' +
    'props.cycle (s, default 5), offset (s), height (lip above y, default 120), splash (default 2).',
);
