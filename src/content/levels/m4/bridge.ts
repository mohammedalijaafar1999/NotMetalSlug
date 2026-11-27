// m4_bridge - a vertical-lift bridge over a harbour slip. Two lattice towers stand on the banks; the
// steel deck hangs high between them (so gunboats can use the slip) and comes down to street level
// when the arena it belongs to reaches its final wave (props.lockX + props.wave, default: the last
// wave) - the Legion's reinforcements then charge across it - or when that lock is cleared.
// Without lockX it lowers 1.5 s after spawning (tests, sandboxes).
// Place it with x = the slip's left edge (the left bank's end) and props.w = the slip width; the
// deck is a one-way platform from x-2 to x+w+2 at the bank height (y omitted = floor at x-4).
// props: w (default 160), lockX, wave, raised (deck height above the banks while up, default 130).

import { registerEntity } from '../../../game/registry';
import { Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { fxRng } from '../../../engine/rng';
import { PixelArt, shade } from '../../../engine/pixelart';
import type { Surface } from '../../../game/terrain';
import { D4, glow } from '../../themes/m4/decor';

const TOWER_H = 168;
const LOWER_TIME = 1.25;
const PAINT = '#4e6a78';
const PAINT_L = '#6e8c98';
const PAINT_D = '#2e3e4a';

const deckCache = new Map<number, HTMLCanvasElement>();
let towerCanvas: HTMLCanvasElement | null = null;

/** Steel deck art (w+2 x 14, outline included): girder with hazard edge and a railing. */
export function deckArt(w: number): PixelArt {
  const p = new PixelArt(w + 4, 16);
  const X = 1;
  // Railing above the deck (rows 0..5).
  for (let x = X; x < X + w + 2; x++) {
    p.px(x, 1, D4.ironL);
    if ((x - X) % 10 === 0) p.rect(x, 1, 1, 6, D4.iron);
  }
  p.rect(X, 4, w + 2, 1, D4.iron);
  // Deck plate + girder.
  p.rect(X, 6, w + 2, 2, '#9a98a8');
  p.rect(X, 6, w + 2, 1, '#c8c6d4');
  p.rect(X, 8, w + 2, 6, PAINT);
  p.rect(X, 8, w + 2, 1, PAINT_L);
  p.rect(X, 13, w + 2, 1, PAINT_D);
  for (let x = X + 3; x < X + w; x += 8) {
    p.line(x, 9, x + 4, 12, PAINT_D, 1);
    p.line(x + 4, 9, x + 8, 12, shade(PAINT, -0.12), 1);
  }
  // Hazard ends.
  for (const ex of [X, X + w - 4]) for (let k = 0; k < 5; k++) p.rect(ex + k, 9, 1, 4, k % 2 ? '#1c1824' : '#c8a838');
  p.outline(D4.ink);
  return p;
}

/** Lattice tower (16 x TOWER_H) with a sheave house on top. */
export function towerArt(): PixelArt {
  const W = 18;
  const p = new PixelArt(W, TOWER_H);
  const B = TOWER_H - 1;
  p.rect(2, 12, 2, B - 12, PAINT);
  p.rect(14, 12, 2, B - 12, PAINT_D);
  p.rect(2, 12, 1, B - 12, PAINT_L);
  for (let y = 16; y < B - 4; y += 12) {
    p.line(4, y, 13, y + 10, PAINT, 1);
    p.line(13, y, 4, y + 10, PAINT_D, 1);
    p.rect(3, y, 12, 1, shade(PAINT, -0.1));
  }
  // Foot.
  p.rect(0, B - 5, W, 6, D4.iron);
  p.rect(0, B - 5, W, 1, D4.ironL);
  // Sheave house.
  p.rect(0, 2, W, 11, PAINT);
  p.rect(0, 2, W, 1, PAINT_L);
  p.rect(0, 2, 1, 11, PAINT_L);
  p.rect(W - 1, 3, 1, 10, PAINT_D);
  p.circle(9, 7, 3, D4.iron);
  p.circle(9, 7, 1, D4.ironH);
  p.rect(3, 0, 12, 2, PAINT_D);
  p.outline(D4.ink);
  return p;
}

export class LiftBridge extends Entity {
  deck: Surface | null = null;
  /** 0 = up, 1 = down. */
  progress = 0;
  lowering = false;
  private spanW: number;
  private raised: number;
  private lockX: number | null;
  private triggerWave: number | null;
  private bankY = 0;
  private landed = false;

  constructor(props: Record<string, any> = {}) {
    super();
    this.spanW = Math.max(40, Math.round(Number(props.w) || 160));
    this.raised = typeof props.raised === 'number' ? props.raised : 130;
    this.lockX = typeof props.lockX === 'number' ? props.lockX : null;
    this.triggerWave = typeof props.wave === 'number' ? props.wave : null;
    this.w = this.spanW + 40;
    this.h = TOWER_H;
    this.z = Z.BACK_PROP;
    this.hittable = false;
    this.persistent = true;
  }

  override spawned(): void {
    const T = this.world.terrain;
    const fy = T.floorAt(this.x - 4, -Infinity, Infinity);
    this.bankY = fy ? fy.y : this.y;
    this.y = this.bankY;
  }

  get deckY(): number {
    const t = this.progress;
    // Ease in (heavy deck accelerating down), small settle at the end.
    const e = t * t * (3 - 2 * t);
    return this.bankY - this.raised * (1 - e);
  }

  private shouldLower(): boolean {
    const lvl = this.world.level;
    if (this.lockX === null || !lvl) return this.age > 1.5;
    const a = lvl.activeLock;
    if (a && Math.abs(a.def.x - this.lockX) < 1) {
      const last = a.def.waves.length - 1;
      return a.wave >= (this.triggerWave ?? last);
    }
    const st = lvl.lockStates().find((l) => Math.abs(l.x - this.lockX!) < 1);
    return st?.state === 'done';
  }

  override update(dt: number): void {
    const W = this.world;
    if (!this.lowering && this.progress < 1 && this.shouldLower()) {
      this.lowering = true;
      W.sfx('alarm', this.x + this.spanW / 2, { vol: 0.7 });
    }
    if (this.lowering && this.progress < 1) {
      this.progress = Math.min(1, this.progress + dt / LOWER_TIME);
      if (Math.floor(this.age / 0.36) !== Math.floor((this.age - dt) / 0.36)) W.sfx('engine', this.x + this.spanW / 2, { vol: 0.6, pitch: 0.6 });
      if (this.progress >= 1 && !this.landed) this.land();
    }
    const y = this.deckY;
    if (this.deck) W.terrain.moveSurface(this.deck, this.x - 2, y, this.x + this.spanW + 2, y);
  }

  private land(): void {
    const W = this.world;
    this.landed = true;
    this.deck = W.terrain.addSurface(this.x - 2, this.bankY, this.x + this.spanW + 2, this.bankY, { oneWay: true, owner: this, material: 'metal', dynamic: true });
    W.sfx('metal_hit', this.x + this.spanW / 2, { vol: 1 });
    W.shake(3, 0.3);
    for (const ex of [this.x, this.x + this.spanW]) {
      W.particles.sparks(ex, this.bankY, 8, '#ffe080', 140);
      W.particles.dust(ex, this.bankY, 4, '#8a86a0');
    }
    W.particles.splash(this.x + this.spanW / 2 + fxRng.range(-30, 30), this.bankY + 4, 10);
  }

  override render(g: CanvasRenderingContext2D): void {
    const cam = this.world.camera;
    if (this.x + this.spanW + 40 < cam.x || this.x - 40 > cam.x + 400) return;
    if (!towerCanvas) towerCanvas = towerArt().toCanvas();
    let dc = deckCache.get(this.spanW);
    if (!dc) {
      dc = deckArt(this.spanW).toCanvas();
      deckCache.set(this.spanW, dc);
    }
    const lx = Math.round(this.x) - 18;
    const rx = Math.round(this.x + this.spanW);
    const top = Math.round(this.bankY) - TOWER_H;
    g.drawImage(towerCanvas, lx, top);
    g.drawImage(towerCanvas, rx, top);
    const dy = Math.round(this.deckY);
    // Hoist cables from the sheaves to the deck ends.
    g.fillStyle = '#2a2632';
    for (const cx of [lx + 9, rx + 9]) g.fillRect(cx, top + 10, 1, Math.max(0, dy - top - 10));
    g.drawImage(dc, Math.round(this.x) - 3, dy - 7);
    // Warning lights on the tower tops (blink fast while moving).
    const t = this.world.time;
    const moving = this.lowering && this.progress < 1;
    const on = moving ? t % 0.3 < 0.15 : t % 1.6 < 0.3;
    if (on && this.progress < 1) {
      for (const cx of [lx + 9, rx + 9]) {
        glow(g, cx, top + 1, 5, '#ff4038', 0.9);
        g.fillStyle = '#ff8a70';
        g.fillRect(cx, top, 1, 2);
      }
    }
  }
}

registerEntity(
  'm4_bridge',
  'misc',
  (_w, s) => new LiftBridge(s.props ?? {}),
  'Mission 4 vertical-lift bridge over a slip: lattice towers on both banks, the deck hangs props.raised (130) px above the banks so boats can pass, and comes down (1.25 s, alarm + clang) when the lock at props.lockX reaches wave props.wave (default its last wave) or is cleared; without lockX it lowers after 1.5 s. x = slip left edge, props.w = slip width; the lowered deck is a one-way platform at bank height.',
);
