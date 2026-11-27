// Mission 2 set piece: the Legion's timber rail bridge over the dry gorge, rigged with charges.
//
// m2_bridge (prop): x = deck center, y = deck surface y, props.spans (default 5, 66 px each).
//   Owns one one-way deck surface per span (drawn by the entity, not the theme). Trestle bents stand
//   on the riverbed BRIDGE_DROP px below the deck. arm() starts a 2.2 s telegraph (blinking charges,
//   beeps, banner), then the bents blow one after another from the far end: each blast removes the
//   spans it carries, throws planks and beams, and wrecks any vehicle standing on them (its pilot is
//   thrown clear, as when a vehicle is destroyed). Blasts only hurt enemies, never players.
// m2_detonator (misc): put it in a lock wave. It arms the nearest bridge and blocks the wave until
//   the bridge is down, so the lock releases right after the collapse.

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import type { PixelArt } from '../../../engine/pixelart';
import { Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { registerEntity } from '../../../game/registry';
import type { Surface } from '../../../game/terrain';
import { isVehicle } from '../../../game/vehicle';
import { FlyingPart } from '../../bosses/common/kit';
import { C } from '../../themes/m2/palette';

export const SPAN = 66;
/** Deck surface to riverbed. */
export const BRIDGE_DROP = 44;
const ARM_TIME = 2.2;
const BLAST_GAP = 0.24;

// ------------------------------------------------------------------ art

/** One deck span: rails on ties over a riveted girder, handrail posts behind. */
sprites.define({
  name: 'm2_bspan',
  w: SPAN,
  h: 20,
  oy: 6,
  ox: SPAN / 2,
  draw: (p: PixelArt) => {
    // Handrail (behind the deck).
    p.rect(0, 0, SPAN, 1, C.woodL);
    p.rect(0, 1, SPAN, 1, C.woodD);
    for (let x = 1; x < SPAN; x += 11) p.rect(x, 0, 2, 6, C.wood);
    // Ties with rails on top (deck surface = row 6).
    for (let x = 0; x < SPAN; x++) {
      const tie = x % 6 < 4;
      p.px(x, 6, tie ? C.woodHi : C.woodL);
      p.px(x, 7, tie ? C.wood : C.woodD);
      p.px(x, 8, C.woodD);
    }
    p.rect(0, 4, SPAN, 1, C.steelHi);
    p.rect(0, 5, SPAN, 1, C.steelD);
    // Girder.
    p.rect(0, 9, SPAN, 9, C.rust);
    p.rect(0, 9, SPAN, 1, C.rustL);
    p.rect(0, 16, SPAN, 2, C.rustD);
    for (let x = 4; x < SPAN; x += 8) {
      p.px(x, 11, C.rustD);
      p.px(x, 14, C.rustD);
      p.rect(x + 3, 10, 1, 6, C.rustD);
    }
    // Lattice web.
    for (let x = 0; x < SPAN; x += 8) {
      p.line(x, 15, x + 4, 11, C.rustD);
      p.line(x + 4, 11, x + 8, 15, C.rustD);
    }
    p.rect(0, 18, SPAN, 2, C.ink);
  },
});

/** Timber trestle bent from the girder to the riverbed (0 intact, 1 blown stump). */
sprites.define({
  name: 'm2_bpier',
  w: 34,
  h: BRIDGE_DROP - 10,
  frames: 2,
  draw: (p, f) => {
    const H = BRIDGE_DROP - 10;
    if (f === 0) {
      // Battered posts widening toward the footing.
      p.line(13, 0, 6, H - 3, C.woodD, 3);
      p.line(21, 0, 28, H - 3, C.woodD, 3);
      p.line(13, 0, 7, H - 3, C.wood, 1);
      p.line(17, 0, 17, H - 3, C.wood, 3);
      p.line(16, 0, 16, H - 3, C.woodL, 1);
      // X bracing + girts.
      for (let y = 4; y < H - 6; y += 12) {
        p.line(9, y, 25, y + 10, C.woodD, 2);
        p.line(25, y, 9, y + 10, C.wood, 2);
        p.rect(8, y, 18, 2, C.woodD);
        p.rect(8, y, 18, 1, C.woodL);
      }
      // Stone footing.
      p.rect(3, H - 4, 28, 4, C.stoneM);
      p.rect(3, H - 4, 28, 1, C.stoneL);
    } else {
      p.rect(3, H - 4, 28, 4, '#6a5a4a');
      p.poly([7, H - 4, 9, H - 13, 11, H - 9, 13, H - 16, 15, H - 4], '#3a2a22');
      p.poly([19, H - 4, 21, H - 11, 23, H - 14, 26, H - 8, 28, H - 4], '#4a3428');
      p.px(13, H - 15, '#ff8a3a');
      p.px(22, H - 13, '#ff8a3a');
    }
  },
});

/** Demolition charge strapped to a bent (0 dark, 1 lit). */
sprites.define({
  name: 'm2_charge',
  w: 7,
  h: 6,
  frames: 2,
  draw: (p, f) => {
    p.rect(0, 1, 7, 5, '#b04030');
    p.rect(0, 1, 7, 1, '#e06048');
    p.rect(2, 1, 1, 5, '#e8d8a0');
    p.rect(4, 1, 1, 5, '#e8d8a0');
    p.rect(5, 0, 2, 2, f ? '#ff3020' : '#501810');
    if (f) p.px(6, 0, '#ffd0c0');
  },
});

/** Bridge debris: 0 plank, 1 girder chunk, 2 rail, 3 timber, 4 tie bundle. */
sprites.define({
  name: 'm2_bdebris',
  w: 18,
  h: 8,
  ox: 9,
  oy: 4,
  frames: 5,
  draw: (p, f) => {
    if (f === 0) {
      p.rect(1, 3, 15, 3, C.wood);
      p.rect(1, 3, 15, 1, C.woodHi);
      p.px(5, 4, C.woodDD);
    } else if (f === 1) {
      p.rect(2, 1, 14, 6, C.rust);
      p.rect(2, 1, 14, 1, C.rustL);
      p.line(3, 6, 7, 2, C.rustD);
      p.line(7, 2, 11, 6, C.rustD);
      p.px(15, 1, '#3a2a22');
    } else if (f === 2) {
      p.rect(0, 3, 18, 2, C.steelL);
      p.rect(0, 3, 18, 1, C.steelHi);
      p.rect(0, 5, 18, 1, C.steelD);
    } else if (f === 3) {
      p.rect(3, 2, 12, 4, C.woodD);
      p.rect(3, 2, 12, 1, C.wood);
      p.poly([15, 2, 17, 3, 15, 6], C.woodDD);
    } else {
      p.rect(2, 2, 6, 5, C.wood);
      p.rect(9, 3, 6, 4, C.woodD);
      p.rect(2, 2, 6, 1, C.woodHi);
    }
  },
});

/** Heap of fallen deck in the riverbed (0, 1 variants). */
sprites.define({
  name: 'm2_brubble',
  w: 64,
  h: 16,
  frames: 2,
  draw: (p, f) => {
    if (f === 0) {
      p.poly([2, 16, 10, 9, 22, 11, 30, 5, 44, 8, 56, 10, 62, 16], '#5a3e2a');
      p.line(6, 13, 30, 6, C.wood, 3);
      p.line(28, 12, 58, 9, C.rust, 3);
      p.line(29, 11, 57, 8, C.rustL, 1);
      p.line(14, 15, 40, 13, C.steelL, 1);
      p.rect(44, 5, 3, 7, C.woodD);
    } else {
      p.poly([4, 16, 14, 8, 26, 10, 38, 6, 50, 11, 60, 16], '#4a3424');
      p.line(10, 12, 40, 9, C.rust, 3);
      p.line(36, 14, 58, 12, C.wood, 2);
      p.line(20, 15, 22, 5, C.woodD, 2);
    }
    for (let x = 6; x < 60; x += 9) p.px(x, 14, '#2a1e18');
  },
});

// ------------------------------------------------------------------ entity

type BridgeState = 'intact' | 'armed' | 'blowing' | 'down';

export class Bridge extends Entity {
  spans: number;
  deck: (Surface | null)[] = [];
  state: BridgeState = 'intact';
  private t = 0;
  /** Bent indices (0..spans) in blast order (far end first) and the time each blows. */
  private blown: boolean[] = [];
  private nextBlast = 0;
  private fireT: number[] = [];
  /** Rubble heaps (x positions) after the collapse. */
  private rubble: Array<{ x: number; f: number }> = [];
  private beep = 0;

  constructor(props: Record<string, any>) {
    super();
    this.spans = Math.max(1, Math.round(props.spans ?? 5));
    this.w = this.spans * SPAN;
    this.h = 10;
    this.z = Z.BACK_PROP;
    this.persistent = true;
    this.team = 'neutral';
  }

  get x1(): number {
    return Math.round(this.x - this.w / 2);
  }

  get deckY(): number {
    return Math.round(this.y);
  }

  override spawned(): void {
    const T = this.world.terrain;
    for (let i = 0; i < this.spans; i++) {
      const a = this.x1 + i * SPAN;
      this.deck.push(T.addSurface(a, this.deckY, a + SPAN, this.deckY, { oneWay: true, owner: this, material: 'bridge' }));
    }
    this.blown = new Array(this.spans + 1).fill(false);
    this.fireT = new Array(this.spans + 1).fill(0);
  }

  /** Start the countdown (idempotent). */
  arm(): void {
    if (this.state !== 'intact') return;
    this.state = 'armed';
    this.t = 0;
    this.world.announce('BRIDGE RIGGED!', { color: '#ff8a3a', time: 1.8 });
    this.world.sfx('warning', this.x, { vol: 0.8 });
  }

  get down(): boolean {
    return this.state === 'down';
  }

  bentX(i: number): number {
    return this.x1 + i * SPAN;
  }

  override update(dt: number): void {
    this.t += dt;
    if (this.state === 'armed') {
      this.beep -= dt;
      if (this.beep <= 0) {
        this.beep = this.t > ARM_TIME * 0.6 ? 0.16 : 0.3;
        this.world.sfx('mine_beep', this.x, { vol: 0.6, pitch: 1 + this.t * 0.15 });
      }
      if (this.t >= ARM_TIME) {
        this.state = 'blowing';
        this.t = 0;
        this.nextBlast = 0;
      }
    } else if (this.state === 'blowing') {
      // Bents blow from the far (right) end toward the near end.
      while (this.nextBlast <= this.spans && this.t >= this.nextBlast * BLAST_GAP) {
        this.blowBent(this.spans - this.nextBlast);
        this.nextBlast++;
      }
      if (this.nextBlast > this.spans && this.t > this.spans * BLAST_GAP + 0.6) this.state = 'down';
    }
    for (let i = 0; i < this.fireT.length; i++) if (this.fireT[i] > 0) this.fireT[i] -= dt;
    // Smoke + embers from the stumps after the collapse.
    if ((this.state === 'down' || this.state === 'blowing') && fxRng.chance(dt * 3)) {
      const i = fxRng.int(0, this.spans);
      if (this.blown[i]) {
        const x = this.bentX(i) + fxRng.range(-6, 6);
        this.world.particles.add({ kind: 'smoke', x, y: this.deckY + BRIDGE_DROP - 10, vx: -8, vy: -16, life: 1.2, color: '#5a5058', color2: '#3a3440', size: 2, size2: 5, drag: 1 });
      }
    }
  }

  private blowBent(i: number): void {
    if (this.blown[i]) return;
    this.blown[i] = true;
    this.fireT[i] = 2.5;
    const W = this.world;
    const bx = this.bentX(i);
    const y = this.deckY;
    W.explode(bx, y + 8, { radius: 28, damage: 8, team: 'player', owner: null, size: 'large', shake: 5, debris: ['#946434', '#6c4424', '#9c5230'] });
    W.effect('explosion_medium', bx + fxRng.range(-6, 6), y + 22);
    W.particles.dust(bx, y + BRIDGE_DROP, 10, '#d8b27a');
    // Remove the spans resting on this bent.
    for (const s of [i - 1, i]) if (s >= 0 && s < this.spans) this.dropSpan(s);
    // Planks and beams.
    for (let k = 0; k < 7; k++) {
      const f = k % 5;
      W.add(
        new FlyingPart('m2_bdebris', f, bx + fxRng.range(-20, 20), y + fxRng.range(-2, 8), fxRng.range(-110, 110), fxRng.range(-260, -120), {
          vr: fxRng.range(-10, 10),
          life: fxRng.range(2.5, 4),
          burn: k % 3 === 0,
          z: Z.FX - 2,
        }),
      );
    }
  }

  private dropSpan(s: number): void {
    const surf = this.deck[s];
    if (!surf) return;
    const W = this.world;
    const a = this.x1 + s * SPAN;
    // Vehicles on this span are wrecked by the blast (pilot thrown clear).
    for (const e of W.query((q) => isVehicle(q))) {
      const v = e as any;
      if (v.destroyed) continue;
      if (e.x >= a - 6 && e.x <= a + SPAN + 6 && Math.abs(e.y - this.deckY) < 6) v.startDestruction();
    }
    W.terrain.remove(surf);
    this.deck[s] = null;
    this.rubble.push({ x: a + SPAN / 2 + fxRng.range(-8, 8), f: s % 2 });
    W.sfx('crate_break', a + SPAN / 2, { vol: 0.8, pitch: 0.7 });
    // The falling span as a big tumbling piece.
    W.add(new FlyingPart('m2_bspan', 0, a + SPAN / 2, this.deckY, fxRng.range(-20, 20), fxRng.range(-60, -20), { vr: fxRng.range(-1.2, 1.2), life: 1.1, gravity: 700, z: Z.BACK_PROP + 1 }));
  }

  override render(g: CanvasRenderingContext2D): void {
    const y = this.deckY;
    const pier = sprites.get('m2_bpier');
    const span = sprites.get('m2_bspan');
    const charge = sprites.get('m2_charge');
    // Rubble in the riverbed.
    for (const r of this.rubble) sprites.get('m2_brubble').draw(g, r.x, y + BRIDGE_DROP + 1, r.f);
    // Bents.
    for (let i = 0; i <= this.spans; i++) {
      const bx = this.bentX(i);
      if (i === 0 || i === this.spans) continue; // the ends rest on the cliffs
      pier.draw(g, bx, y + BRIDGE_DROP, this.blown[i] ? 1 : 0);
    }
    // Deck spans.
    for (let s = 0; s < this.spans; s++) if (this.deck[s]) span.draw(g, this.x1 + s * SPAN + SPAN / 2, y);
    // Charges on the bents (and the abutment ends).
    if (this.state !== 'down') {
      const lit = this.state === 'armed' ? Math.floor(this.t * (this.t > ARM_TIME * 0.6 ? 12 : 6)) % 2 : Math.floor(this.age * 1.2) % 4 === 0 ? 1 : 0;
      for (let i = 0; i <= this.spans; i++) {
        if (this.blown[i]) continue;
        const bx = this.bentX(i);
        const off = i === 0 ? 6 : i === this.spans ? -6 : 0;
        charge.draw(g, bx + off, y + 18, lit);
        if (i > 0 && i < this.spans) charge.draw(g, bx - 2, y + 30, lit);
      }
      // Detonation wire along the girder.
      if (this.state === 'armed') {
        g.fillStyle = '#c03020';
        g.fillRect(this.x1, y + 13, this.w, 1);
      }
    }
    // Burning stumps.
    for (let i = 0; i <= this.spans; i++) {
      if (!this.blown[i] || this.fireT[i] <= 0) continue;
      const bx = this.bentX(i);
      const k = Math.floor(this.age * 14 + i) % 3;
      g.fillStyle = '#ff8a3a';
      g.fillRect(bx - 3, y + BRIDGE_DROP - 16 - k, 3, 5 + k);
      g.fillStyle = '#ffe080';
      g.fillRect(bx - 2, y + BRIDGE_DROP - 13 - k, 1, 3);
    }
  }
}

registerEntity(
  'm2_bridge',
  'prop',
  (_w, s) => new Bridge(s.props ?? {}),
  'Mission 2 rigged timber rail bridge: x = deck center, y = deck surface, props.spans (5 x 66 px). One-way deck drawn by itself, trestle bents on the riverbed 44 px below. arm() (via m2_detonator in a lock wave) -> 2.2 s blinking/beeping telegraph + banner, then the bents blow from the far end: spans fall, vehicles on them are wrecked (pilot thrown clear); blasts hurt enemies only.',
);

/** Invisible wave helper: arms the nearest m2_bridge and blocks the wave until it is down. */
class Detonator extends Entity {
  private bridge: Bridge | null = null;
  private after = 0;

  constructor() {
    super();
    this.blocksProgress = true;
    this.persistent = true;
    this.hittable = false;
    this.w = 1;
    this.h = 1;
  }

  override spawned(): void {
    const all = this.world.query((e) => e instanceof Bridge) as Bridge[];
    let best: Bridge | null = null;
    for (const b of all) if (!best || Math.abs(b.x - this.x) < Math.abs(best.x - this.x)) best = b;
    this.bridge = best;
    best?.arm();
  }

  override update(dt: number): void {
    if (!this.bridge || this.bridge.dead) {
      this.remove();
      return;
    }
    if (this.bridge.down) {
      this.after += dt;
      if (this.after > 0.5) this.remove();
    }
  }
}

registerEntity('m2_detonator', 'misc', () => new Detonator(), 'Mission 2 lock-wave helper: arms the nearest m2_bridge and blocks the wave until the bridge has collapsed.');
