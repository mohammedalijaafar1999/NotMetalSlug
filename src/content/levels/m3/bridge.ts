// m3_weak_bridge: a rickety plank trestle bridge over the creek ravine. People cross it fine; a
// player war machine (the STRIDER walker) is far over the posted weight limit: the planks crack
// (creaks, splinters) and the bridge gives way a moment after it steps on. The ravine's icy creek
// finishes off any vehicle that ends up down there (its pilot is thrown clear by the usual
// vehicle destruction), so the mission continues on foot towards the cable car.
//
// Spawn at the bridge's LEFT end on the deck height: { type: 'm3_weak_bridge', x, y: deckY,
// trigger: x - 420, props: { w: 160, floor: ravineFloorY } }.
// props: w (deck length, default 128), floor (ravine floor y for the trestle legs and the wreck
// zone, default y + 56), creak (s between the first heavy step and the collapse, default 0.4).

import { Entity, Actor } from '../../../game/entity';
import { registerEntity } from '../../../game/registry';
import { Z } from '../../../game/constants';
import type { Surface } from '../../../game/terrain';
import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { P3 } from '../../themes/m3/palette';

interface Plank {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  t: number;
}

export class WeakBridge extends Entity {
  deck: Surface | null = null;
  len = 128;
  floorY = 0;
  creak = 0.4;
  /** Seconds a heavy vehicle has been on the deck. */
  load = 0;
  broken = false;
  private brokenT = 0;
  private planks: Plank[] = [];
  private creakT = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.team = 'neutral';
    this.hittable = false;
    this.persistent = true;
    this.z = Z.BACK_PROP;
    this.props = props;
  }

  override spawned(): void {
    this.len = this.props.w ?? 128;
    this.floorY = this.props.floor ?? this.y + 56;
    this.creak = this.props.creak ?? 0.4;
    this.w = this.len;
    this.h = 8;
    this.deck = this.world.terrain.addSurface(this.x, this.y, this.x + this.len, this.y, { oneWay: true, owner: this, material: 'wood', dynamic: true });
  }

  /** Player vehicles (driven or not) currently standing on the deck. */
  private heavyOnDeck(): Actor | null {
    for (const e of this.world.query((q) => (q as { isVehicle?: boolean }).isVehicle === true)) {
      const a = e as Actor;
      if (a.onGround && this.deck && a.groundSurface === this.deck) return a;
    }
    return null;
  }

  override update(dt: number): void {
    if (!this.broken) {
      const v = this.heavyOnDeck();
      if (v) {
        this.load += dt;
        this.creakT -= dt;
        if (this.creakT <= 0) {
          this.creakT = 0.13;
          this.world.sfx('crate_break', v.x, { vol: 0.45, pitch: 0.6 + this.load });
          this.world.particles.debris(v.x + fxRng.range(-10, 10), this.y + 2, 3, [P3.wood, P3.woodD, P3.snow], 70);
          this.world.shake(1, 0.1);
        }
        if (this.load >= this.creak) this.collapse(v.x);
      }
    } else {
      this.brokenT += dt;
    }
    // The icy creek wrecks any vehicle that lands in the ravine.
    for (const e of this.world.query((q) => (q as { isVehicle?: boolean }).isVehicle === true)) {
      const v = e as Actor & { destroyed?: boolean; startDestruction?: () => void };
      if (v.destroyed || !v.startDestruction) continue;
      if (v.x > this.x - 4 && v.x < this.x + this.len + 4 && v.y > this.y + 16 && v.y <= this.floorY + 8) {
        this.world.particles.splash(v.x, v.y - 2, 12);
        this.world.sfx('splash', v.x, { vol: 0.9 });
        v.startDestruction();
      }
    }
    // Plank debris.
    for (const p of this.planks) {
      p.t += dt;
      if (p.y < this.floorY - 2) {
        p.vy += 700 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      } else {
        p.y = this.floorY - 2;
        p.vx *= 0.9;
        p.vr *= 0.8;
      }
    }
    if (this.broken && this.x + this.len < this.world.camera.x - 300) this.remove();
  }

  /** Break the deck: the planks fall into the ravine. */
  collapse(atX = this.x + this.len / 2): void {
    if (this.broken) return;
    this.broken = true;
    this.brokenT = 0;
    if (this.deck) this.world.terrain.remove(this.deck);
    this.deck = null;
    const W = this.world;
    W.sfx('crate_break', atX, { vol: 1, pitch: 0.7 });
    W.sfx('explosion_small', atX, { vol: 0.6, pitch: 0.6 });
    W.shake(3, 0.35);
    for (let x = this.x + 4; x < this.x + this.len - 4; x += 10) {
      const near = 1 - Math.min(1, Math.abs(x - atX) / this.len);
      this.planks.push({ x, y: this.y + 1, vx: fxRng.range(-40, 40), vy: fxRng.range(-120, -20) * near, rot: 0, vr: fxRng.range(-8, 8), t: 0 });
    }
    W.particles.debris(atX, this.y, 14, [P3.wood, P3.woodD, P3.woodHi, P3.snow], 180);
    W.particles.smokePuffs(atX, this.y, 4, 10, '#e8f0f8', '#b8c8dc');
  }

  override remove(): void {
    if (this.deck) this.world.terrain.remove(this.deck);
    this.deck = null;
    super.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (!this.onScreen(80) && !(this.x < this.world.camera.x + 400 && this.x + this.len > this.world.camera.x)) return;
    const bent = sprites.get('m3_bridge_bent');
    const deck = sprites.get('m3_bridge_deck');
    const legH = Math.max(8, this.floorY - this.y - 4);
    // Trestle bents (cropped to the ravine depth); they stay standing as broken stumps.
    const bents = Math.max(2, Math.round(this.len / 56) + 1);
    for (let i = 0; i < bents; i++) {
      const bx = Math.round(this.x + 8 + ((this.len - 16) * i) / (bents - 1));
      const top = this.broken ? this.y + 14 + (i % 2) * 8 : this.y + 4;
      const h = Math.max(4, this.floorY - top);
      const c = bent.canvas(0);
      const srcH = Math.min(c.height, h + 1);
      g.drawImage(c, 0, c.height - srcH, c.width, srcH, bx - bent.ox - 1, Math.round(this.floorY - srcH + 1), c.width, srcH);
    }
    void legH;
    if (!this.broken) {
      const cracked = this.load > 0 ? 1 : 0;
      for (let x = 0; x < this.len; x += 16) {
        const w = Math.min(16, this.len - x);
        const c = deck.canvas(cracked && Math.floor(x / 16) % 2 === 0 ? 1 : 0);
        const shakeY = this.load > 0 ? Math.round(fxRng.range(0, 1)) : 0;
        g.drawImage(c, 1, 0, w, c.height, Math.round(this.x + x), Math.round(this.y) - 1 + shakeY, w, c.height);
      }
      // Rope hand-rails.
      g.fillStyle = '#5a3a22';
      for (const px of [this.x + 1, this.x + this.len - 2]) g.fillRect(Math.round(px), Math.round(this.y) - 12, 2, 12);
      for (let x = 0; x <= this.len; x++) {
        const t = x / this.len;
        const sag = Math.sin(t * Math.PI) * 4;
        g.fillStyle = '#8a6a44';
        g.fillRect(Math.round(this.x + x), Math.round(this.y - 11 + sag), 1, 1);
      }
    } else {
      const plank = sprites.get('m3_plank');
      for (const p of this.planks) plank.draw(g, Math.round(p.x), Math.round(p.y), 0, { rot: Math.round(p.rot * 4) / 4 });
      // Torn stubs at both banks.
      const c = deck.canvas(1);
      g.drawImage(c, 1, 0, 10, c.height, Math.round(this.x), Math.round(this.y) - 1, 10, c.height);
      g.drawImage(c, 1, 0, 8, c.height, Math.round(this.x + this.len - 8), Math.round(this.y) - 1, 8, c.height);
    }
  }
}

registerEntity(
  'm3_weak_bridge',
  'misc',
  (_w, s) => new WeakBridge(s.props ?? {}),
  'FROSTBITE PASS plank bridge over a ravine: holds people, collapses under a player vehicle (props.w deck length, props.floor ravine floor y, ' +
    'props.creak); any vehicle that ends up in the ravine is wrecked (its pilot is thrown clear). Spawn at the left end on the deck: x, y = deck.',
);
