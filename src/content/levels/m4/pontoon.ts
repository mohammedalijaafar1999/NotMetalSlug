// m4_pontoon - a floating pontoon (timber deck on rusty drums) moored in a canal. Its deck is a
// one-way platform that bobs gently on the swell and dips a little under a rider's weight, so the
// canals feel like water rather than floors. Players, enemies and vehicles ride it like any platform.
// props: w (deck width, default 44), bob (swell amplitude px, default 1.5), phase (s).
// Spawn with y omitted over water: the deck floats 3 px above the surface (on dry ground it rests
// on the floor, e.g. in the entity tests).

import { registerEntity } from '../../../game/registry';
import { Actor, Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { fxRng } from '../../../engine/rng';
import { PixelArt } from '../../../engine/pixelart';
import type { Surface } from '../../../game/terrain';
import { D4 } from '../../themes/m4/decor';

const FREEBOARD = 3;
const DIP = 3;

const artCache = new Map<number, HTMLCanvasElement>();

/** Deck + drums art for width w (outline included: (w+2) x 16; deck top at row 1). */
export function pontoonArt(w: number): PixelArt {
  const H = 14;
  const p = new PixelArt(w + 2, H + 2);
  const X = 1;
  const Y = 1;
  // Floats under the deck: orange-painted drums (mostly submerged; the water overlay tints them).
  for (let dx = 5; dx < w - 4; dx += 14) {
    const cx = X + dx + 3;
    p.ellipse(cx, Y + 9, 5.5, 4.5, '#a8582c');
    p.ellipse(cx - 1, Y + 8, 3.5, 2.5, '#d07a3a');
    p.rect(cx - 5, Y + 8, 11, 1, '#6a3420');
  }
  // Deck: pale weathered planks with dark gaps, bright top edge (top-left light) so it reads as
  // something to land on against the dark water.
  p.rect(X, Y, w, 5, '#a87a4a');
  p.rect(X, Y, w, 1, '#e0bc80');
  p.rect(X, Y + 1, w, 1, '#c49a62');
  p.rect(X, Y + 4, w, 1, '#5a3a24');
  for (let x = X + 6; x < X + w - 1; x += 7) {
    p.rect(x, Y + 1, 1, 3, '#6a4428');
    p.px(x + 1, Y + 1, '#ecd09a');
  }
  // Painted safety ends (white) and cleats.
  p.rect(X, Y, 2, 4, '#e8e4f0');
  p.rect(X + w - 2, Y, 2, 4, '#e8e4f0');
  p.rect(X + 3, Y - 1, 3, 1, D4.iron);
  p.rect(X + w - 6, Y - 1, 3, 1, D4.iron);
  p.outline(D4.ink);
  return p;
}

export class Pontoon extends Entity {
  deck: Surface | null = null;
  private baseY = 0;
  private dip = 0;
  private bob: number;
  private phase: number;
  private deckW: number;

  constructor(props: Record<string, any> = {}) {
    super();
    this.deckW = Math.max(16, Math.round(Number(props.w) || 44));
    this.bob = typeof props.bob === 'number' ? props.bob : 1.5;
    this.phase = typeof props.phase === 'number' ? props.phase : 0;
    this.w = this.deckW;
    this.h = 6;
    this.z = Z.BACK_PROP;
    this.hittable = false;
  }

  override spawned(): void {
    const T = this.world.terrain;
    const water = T.water.find((wt) => this.x >= wt.x && this.x < wt.x + wt.w && this.y >= wt.y - 40);
    this.baseY = water ? water.y - FREEBOARD : this.y;
    this.y = this.baseY;
    this.deck = T.addSurface(this.x - this.deckW / 2, this.y, this.x + this.deckW / 2, this.y, { oneWay: true, owner: this, material: 'wood', dynamic: true });
  }

  /** Anyone standing on the deck? */
  private ridden(): boolean {
    const d = this.deck;
    if (!d) return false;
    for (const e of this.world.entities) if (!e.dead && e instanceof Actor && e.onGround && e.groundSurface === d) return true;
    return false;
  }

  override update(dt: number): void {
    const d = this.deck;
    if (!d) return;
    const rider = this.ridden();
    this.dip += ((rider ? DIP : 0) - this.dip) * Math.min(1, dt * 6);
    const t = this.world.time + this.phase;
    const y = this.baseY + Math.sin(t * 1.7) * this.bob + Math.sin(t * 0.63 + 1) * this.bob * 0.4 + this.dip;
    this.y = y;
    this.world.terrain.moveSurface(d, this.x - this.deckW / 2, y, this.x + this.deckW / 2, y);
    if (rider && fxRng.chance(dt * 3)) this.world.particles.splash(this.x + fxRng.range(-this.deckW / 2, this.deckW / 2), this.baseY + FREEBOARD, 2, '#9ab4d8');
    // Tidy up far behind the camera (no ghost platforms).
    if (this.right < this.world.camera.x - 200) this.remove();
  }

  override remove(): void {
    if (this.deck) {
      this.world.terrain.remove(this.deck);
      this.deck = null;
    }
    super.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    let c = artCache.get(this.deckW);
    if (!c) {
      c = pontoonArt(this.deckW).toCanvas();
      artCache.set(this.deckW, c);
    }
    g.drawImage(c, Math.round(this.x - this.deckW / 2) - 1, Math.round(this.y) - 1);
  }
}

registerEntity(
  'm4_pontoon',
  'misc',
  (_w, s) => new Pontoon(s.props ?? {}),
  'Floating pontoon (mission 4): one-way timber deck on drums that bobs on the water and dips under a rider. Spawn over water with y omitted (deck 3 px above the surface). props.w deck width (44), bob (1.5 px), phase (s).',
);
