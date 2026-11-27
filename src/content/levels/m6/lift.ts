// m6_lift - the maintenance lift that climbs the reactor shaft (IRON CITADEL vertical section).
// A grated platform between two guide rails: step on it at the bottom and it climbs to the upper
// floor (it carries players, vehicles, soldiers and robots). If nobody rides it, it sinks back so a
// second player (or a fallen one) can catch it. Optional scripted ambushes fire at given points of
// the first ride (drones swooping in, jetpacks dropping from above...).
//   spawn: { type: 'm6_lift', x: <centre>, y: <bottom stop = floor y>, trigger: <early>,
//            props: { top: <upper stop y>, w: 88, speed: 46,
//                     events: [{ at: 0..1, type, dx, dy?, props? }] } }  (dx/dy relative to the camera)

import { sprites } from '../../../engine/sprites';
import { registerEntity } from '../../../game/registry';
import { Actor, Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import type { Surface } from '../../../game/terrain';
import type { PixelArt } from '../../../engine/pixelart';
import { ramp, shaded } from '../../vehicles/art';
import { M6 } from '../../themes/m6/palette';

export interface LiftEvent {
  /** Ride progress 0..1 at which this fires (first ride only). */
  at: number;
  type: string;
  /** Spawn x relative to the camera's left edge. */
  dx: number;
  /** Spawn y relative to the camera's top (omit = entity default). */
  dy?: number;
  props?: Record<string, any>;
}

type LiftState = 'bottom' | 'up' | 'top' | 'down';

const DECK_H = 7;

function deckArt(w: number): (p: PixelArt) => void {
  return (p) => {
    // grated deck
    for (let x = 0; x < w; x++) {
      p.px(x, 0, M6.steelLLL);
      p.px(x, 1, M6.steelLL);
      p.px(x, 2, x % 3 === 0 ? M6.steelL : M6.steelDD);
      p.px(x, 3, x % 3 === 0 ? M6.steelD : M6.steelDD);
      p.px(x, 4, M6.steelL);
      p.px(x, 5, M6.ironD);
    }
    // hazard-striped end plates
    for (const x0 of [0, w - 8]) for (let y = 0; y < 6; y++) for (let x = x0; x < x0 + 8; x++) p.px(x, y, (x + y) % 6 < 3 ? M6.hazard : M6.hazardD);
    // truss underneath
    for (let x = 4; x < w - 4; x++) p.px(x, 10, M6.iron);
    for (let i = 4; i + 8 <= w - 4; i += 8) {
      p.line(i, 6, i + 4, 10, M6.iron);
      p.line(i + 4, 10, i + 8, 6, M6.iron);
    }
    // motor box with a status lamp
    shaded(p, (m) => m.rect(w / 2 - 8, 6, 16, 8, '#fff'), ramp(M6.iron, 0.3, -0.3));
    p.rect(w / 2 - 2, 9, 4, 2, M6.outline);
  };
}

sprites.define({ name: 'm6_lift_deck', w: 88, h: 15, ox: 0, oy: 0, draw: deckArt(88) });

// railing posts on the deck ends (with a top rail)
sprites.define({
  name: 'm6_lift_rail',
  w: 4,
  h: 16,
  ox: 2,
  oy: 16,
  draw: (p) => {
    p.rect(1, 2, 2, 14, M6.ironL);
    p.rect(2, 2, 1, 14, M6.iron);
    p.rect(0, 0, 4, 3, M6.hazard);
    p.px(0, 0, '#ffe080');
  },
});

export class Lift extends Entity {
  state: LiftState = 'bottom';
  stateTime = 0;
  bottomY = 0;
  topY = 0;
  speed = 46;
  /** Current deck y. */
  deckY = 0;
  private surf: Surface | null = null;
  private riderT = 0;
  private emptyT = 0;
  private events: LiftEvent[] = [];
  private fired = new Set<number>();
  private firstRide = true;
  private engineT = 0;
  rides = 0;

  constructor() {
    super();
    this.z = Z.PROP - 1;
    this.team = 'neutral';
    this.hittable = false;
    this.persistent = true;
    this.w = 88;
    this.h = 8;
  }

  override spawned(): void {
    const P = this.props;
    this.w = 88;
    this.bottomY = this.y;
    this.topY = typeof P.top === 'number' ? P.top : this.y - 120;
    this.speed = typeof P.speed === 'number' ? P.speed : 46;
    this.events = Array.isArray(P.events) ? P.events : [];
    this.deckY = this.bottomY;
    this.surf = this.world.terrain.addSurface(this.x - this.w / 2, this.deckY, this.x + this.w / 2, this.deckY, { oneWay: true, owner: this, material: 'metal', dynamic: true });
  }

  /** Ride progress 0 (bottom) .. 1 (top). */
  get progress(): number {
    return (this.bottomY - this.deckY) / Math.max(1, this.bottomY - this.topY);
  }

  /** Standing on the deck, or hopping above it (jumping while riding still counts). */
  private riding(a: Actor): boolean {
    if (Math.abs(a.x - this.x) > this.w / 2 + 1) return false;
    if (a.onGround) return Math.abs(a.y - this.deckY) < 2.5;
    return a.y <= this.deckY + 2.5 && a.y > this.deckY - 90;
  }

  /** Is any player (or their vehicle) riding the deck? */
  playerAboard(): boolean {
    for (const p of this.world.players) {
      if (!p.isActive) continue;
      const a: Actor = (p.vehicle ?? p) as Actor;
      if (this.riding(a)) return true;
    }
    return false;
  }

  private set(s: LiftState): void {
    this.state = s;
    this.stateTime = 0;
  }

  override update(dt: number): void {
    this.stateTime += dt;
    const aboard = this.playerAboard();
    if (aboard) {
      this.riderT += dt;
      this.emptyT = 0;
    } else {
      this.riderT = 0;
      this.emptyT += dt;
    }
    let v = 0;
    switch (this.state) {
      case 'bottom':
        if (this.riderT > 0.35) {
          this.set('up');
          this.world.sfx('alarm', this.x, { vol: 0.45 });
        }
        break;
      case 'up': {
        v = -this.speed * Math.min(1, 0.3 + this.stateTime * 1.6);
        if (this.emptyT > 1.6) this.set('down');
        break;
      }
      case 'top': {
        const someoneBelow = this.world.players.some((p) => p.isActive && (p.vehicle ?? p).y > this.topY + 40);
        if (this.emptyT > 2 && someoneBelow) this.set('down');
        break;
      }
      case 'down':
        v = this.speed * 1.4;
        break;
    }
    if (v !== 0) {
      let ny = this.deckY + v * dt;
      if (ny <= this.topY) {
        ny = this.topY;
        this.set('top');
        if (this.firstRide) this.firstRide = false;
        this.rides++;
        this.world.shake(1, 0.12);
        this.world.sfx('metal_hit', this.x, { vol: 0.5, pitch: 0.7 });
      } else if (ny >= this.bottomY) {
        ny = this.bottomY;
        this.set('bottom');
        this.world.sfx('metal_hit', this.x, { vol: 0.4, pitch: 0.7 });
      }
      this.deckY = ny;
      this.engineT -= dt;
      if (this.engineT <= 0 && this.onScreen(40)) {
        this.engineT = 0.4;
        this.world.sfx('engine', this.x, { vol: 0.35, pitch: 0.8 });
      }
    }
    if (this.surf) this.world.terrain.moveSurface(this.surf, this.x - this.w / 2, this.deckY, this.x + this.w / 2, this.deckY);
    this.y = this.deckY + DECK_H;
    // scripted ambushes during the first climb
    if (this.firstRide && this.state === 'up') {
      const k = this.progress;
      this.events.forEach((e, i) => {
        if (this.fired.has(i) || k < e.at) return;
        this.fired.add(i);
        const cam = this.world.camera;
        this.world.spawn(e.type, cam.x + e.dx, e.dy === undefined ? undefined : cam.y + e.dy, { ...(e.props ?? {}) });
      });
    }
  }

  override render(g: CanvasRenderingContext2D): void {
    const x0 = Math.round(this.x - this.w / 2);
    const x1 = Math.round(this.x + this.w / 2);
    const dy = Math.round(this.deckY);
    const top = Math.round(this.topY) - 90;
    const bot = Math.round(this.bottomY) + 30;
    // guide rails with rungs
    for (const rx of [x0 - 6, x1 + 1]) {
      g.fillStyle = M6.outline;
      g.fillRect(rx, top, 5, bot - top);
      g.fillStyle = M6.ironD;
      g.fillRect(rx + 1, top, 3, bot - top);
      g.fillStyle = M6.iron;
      g.fillRect(rx + 1, top, 1, bot - top);
      g.fillStyle = M6.steelL;
      for (let y = top + ((this.x | 0) % 12); y < bot; y += 12) g.fillRect(rx + 1, y, 3, 1);
    }
    // cables to the winch above
    g.fillStyle = M6.steelL;
    g.fillRect(x0 + 10, top, 1, dy - top);
    g.fillRect(x1 - 11, top, 1, dy - top);
    g.fillStyle = M6.steelDD;
    g.fillRect(x0 + 11, top, 1, dy - top);
    g.fillRect(x1 - 10, top, 1, dy - top);
    // deck + railings
    sprites.get('m6_lift_deck').draw(g, x0, dy);
    const rail = sprites.get('m6_lift_rail');
    rail.draw(g, x0 + 2, dy);
    rail.draw(g, x1 - 2, dy);
    g.fillStyle = M6.ironL;
    g.fillRect(x0 + 2, dy - 15, 1, 1);
    // status lamp on the motor box: green while moving, amber when waiting
    const moving = this.state === 'up' || this.state === 'down';
    const on = moving ? Math.floor(this.world.time * 8) % 2 === 0 : true;
    g.fillStyle = moving ? (on ? '#7aff6a' : '#2a7a2a') : M6.amber;
    g.fillRect(Math.round(this.x) - 1, dy + 9, 2, 2);
  }
}

registerEntity(
  'm6_lift',
  'misc',
  () => new Lift(),
  'Reactor-shaft lift (mission 6): x = centre, y = bottom stop (floor y); props.top = upper stop y, speed (46), ' +
    'events [{ at: 0..1, type, dx, dy?, props }] = ambush spawns relative to the camera during the first climb. ' +
    'Starts climbing when a player stands on it, sinks back when left empty with a player below. 88 px wide deck.',
);

