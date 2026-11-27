// m6_conveyor - a conveyor belt set into the floor (or on top of a solid block) in the IRON CITADEL.
// Everything standing on it rides along: players, soldiers, robots, vehicles, pickups, crates,
// hostages. The belt stops riders at walls and solids just like walking would. Chevrons painted on
// the frame and the moving slats show the direction at a glance.
//   spawn: { type: 'm6_conveyor', x: <belt centre>, y: <belt surface = floor y>, trigger: <early>,
//            props: { w: <belt length, default 96>, speed: <px/s, + = right, default 36> } }

import { sprites } from '../../../engine/sprites';
import { shade } from '../../../engine/pixelart';
import { registerEntity } from '../../../game/registry';
import { Actor, Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { M6 } from '../../themes/m6/palette';

const TILE = 12;
const BELT_H = 9;
const PHASES = 6;

// Belt tile: rubber tread with slats on top, steel frame with a roller below, chevron on the side.
sprites.define({
  name: 'm6_belt',
  w: TILE,
  h: BELT_H,
  ox: 0,
  oy: 0,
  outline: null,
  frames: PHASES,
  draw: (p, f) => {
    // tread (rows 0-2): slats every 6 px moving with the phase
    for (let x = 0; x < TILE; x++) {
      const slat = (x - f + 120) % 6 === 0;
      p.px(x, 0, slat ? '#6a6270' : '#4a4450');
      p.px(x, 1, slat ? '#3a343e' : '#2c2830');
      p.px(x, 2, '#1c181e');
    }
    // frame (rows 3-8): steel side plate with a roller hub and a painted chevron
    for (let x = 0; x < TILE; x++) {
      p.px(x, 3, M6.steelLL);
      p.px(x, 4, M6.steelL);
      p.px(x, 5, M6.steel);
      p.px(x, 6, M6.steel);
      p.px(x, 7, M6.steelD);
      p.px(x, 8, M6.outline);
    }
    // roller hub with rotating spokes
    const cx = 6;
    p.px(cx - 1, 5, M6.steelDD);
    p.px(cx, 5, M6.steelDD);
    p.px(cx - 1, 6, M6.steelDD);
    p.px(cx, 6, M6.steelDD);
    const sp = f % 3;
    p.px(cx - 1 + (sp === 0 ? 0 : 1), sp === 2 ? 6 : 5, M6.steelLL);
    // chevron (points right; the tile is flipped for left-moving belts): scrolls with the phase
    const cv = (f * 2) % TILE;
    for (const off of [0]) {
      const x = (cv + off) % TILE;
      p.px(x, 4, M6.amber);
      p.px((x + 1) % TILE, 5, M6.amber);
      p.px(x, 6, M6.amber);
    }
  },
});

// End drum (right end; flipped for the left end).
sprites.define({
  name: 'm6_belt_end',
  w: 6,
  h: BELT_H + 1,
  ox: 0,
  oy: 1,
  frames: 3,
  draw: (p, f) => {
    p.circle(1.5, 4.5, 4.2, M6.steelD);
    p.circle(1.2, 4.2, 3.4, M6.steel);
    p.circle(1, 4, 2.2, M6.steelL);
    const a = (f / 3) * Math.PI * 2;
    p.line(1.5, 4.5, 1.5 + Math.cos(a) * 3, 4.5 + Math.sin(a) * 3, M6.steelDD);
    p.px(1, 3, M6.steelLLL);
    p.rect(0, 0, 2, 1, '#4a4450');
  },
});

export class Conveyor extends Entity {
  speed = 36;
  private phase = 0;

  constructor() {
    super();
    this.z = Z.BACK_PROP + 1;
    this.team = 'neutral';
    this.hittable = false;
    this.w = 96;
    this.h = BELT_H;
  }

  override spawned(): void {
    this.w = typeof this.props.w === 'number' ? this.props.w : 96;
    this.speed = typeof this.props.speed === 'number' ? this.props.speed : 36;
  }

  get x0(): number {
    return this.x - this.w / 2;
  }
  get x1(): number {
    return this.x + this.w / 2;
  }

  /** Is this actor riding the belt? */
  riding(a: Actor): boolean {
    return a.onGround && a.collideTerrain && Math.abs(a.y - this.y) < 1.5 && a.x >= this.x0 && a.x <= this.x1;
  }

  override update(dt: number): void {
    this.phase += this.speed * dt;
    const dx = this.speed * dt;
    if (dx === 0) return;
    for (const e of this.world.entities) {
      if (e.dead || !(e instanceof Actor)) continue;
      const anyE = e as any;
      if (anyE.isPlayer && anyE.state === 'vehicle') continue;
      if (!this.riding(e)) continue;
      carry(e, dx);
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    const x0 = Math.round(this.x0);
    const x1 = Math.round(this.x1);
    const y = Math.round(this.y) - 1;
    const right = this.speed >= 0;
    // (flipped tiles mirror the motion, so the phase always counts up)
    const f = Math.floor(Math.abs(this.phase)) % PHASES;
    const belt = sprites.get('m6_belt');
    // tiles laid from the start; the last one is clipped by drawing only what fits
    g.save();
    g.beginPath();
    g.rect(x0, y - 1, x1 - x0, BELT_H + 2);
    g.clip();
    for (let x = x0; x < x1; x += TILE) belt.draw(g, right ? x : x + TILE, y, f, right ? undefined : { flip: true });
    g.restore();
    const drum = Math.floor(Math.abs(this.phase) / 3) % 3;
    const end = sprites.get('m6_belt_end');
    end.draw(g, x1, y, right ? drum : 2 - drum);
    end.draw(g, x0, y, right ? 2 - drum : drum, { flip: true });
    // a faint highlight line where riders stand
    g.fillStyle = shade('#4a4450', 0.35);
    g.fillRect(x0, y, x1 - x0, 1);
  }
}

/** Move an actor horizontally by dx unless a wall/solid/cliff is in the way (like walking). */
export function carry(a: Actor, dx: number): boolean {
  const T = a.world.terrain;
  const nx = a.x + dx;
  const dir = dx > 0 ? 1 : -1;
  const hw = a.w / 2;
  if (T.groundTopAt(nx + dir * hw) < a.y - a.stepUp) return false;
  const s = T.solidOverlap({ x: nx - hw, y: a.y - a.h, w: a.w, h: a.h - 0.5 }, a);
  if (s && s.y < a.y - a.stepUp) return false;
  a.x = nx;
  return true;
}

registerEntity(
  'm6_conveyor',
  'misc',
  () => new Conveyor(),
  'Conveyor belt (mission 6): x = belt centre, y = the floor/solid top it lies on; props.w (default 96), speed ' +
    '(px/s, + = right, default 36). Carries everything standing on it (players, enemies, vehicles, pickups, crates). ' +
    'Spawn it early (trigger) so it is visible before it scrolls in.',
);
