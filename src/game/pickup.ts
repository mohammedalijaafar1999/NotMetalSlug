// Pickups: weapon crates (letter), bomb crates, score items, 1UPs and vehicle fuel.
// Spawn spec strings (used by hostages, crates and enemies via props.drop):
//   'H','R','S','F','L','C','B'  weapon crate by letter     'bomb'  +10 grenades
//   'firebomb'  switch to fire bombs (+10)                  'fuel'  repair vehicle
//   'life'  extra life                                      'points' | 'points:5000' | 'item:<sprite>'
//   'random' weighted random

import { sprites } from '../engine/sprites';
import { audio } from '../engine/audio';
import { PixelArt } from '../engine/pixelart';
import { rectsOverlap } from '../engine/math';
import { Actor } from './entity';
import { Z } from './constants';
import { allWeapons, getWeapon } from './weapons';
import { registerEntity } from './registry';
import type { World } from './world';
import type { Player } from './player';

export type PickupKind = 'weapon' | 'bomb' | 'firebomb' | 'points' | 'life' | 'fuel';

/** Score items (sprite name -> points). Content can add more. */
export const SCORE_ITEMS: Record<string, number> = {
  item_coin: 100,
  item_ration: 500,
  item_watch: 1000,
  item_medal: 2000,
  item_gem: 5000,
  item_goldbar: 10000,
};

// 3x5 mini font for crate letters.
const MINI: Record<string, string[]> = {
  A: ['###', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['###', '#..', '#..', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['###', '#..', '#.#', '#.#', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  P: ['###', '#.#', '###', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Z: ['###', '..#', '.#.', '#..', '###'],
};

export function miniText(p: PixelArt, s: string, x: number, y: number, c: string): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = MINI[ch];
    if (g) for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (g[yy][xx] === '#') p.px(cx + xx, y + yy, c);
    cx += 4;
  }
}

function defineCrate(name: string, letter: string, color: string): void {
  sprites.fallback({
    name,
    w: 14,
    h: 13,
    frames: 2,
    draw: (p, f) => {
      p.rect(0, 1, 14, 12, '#8a5a2e');
      p.rect(0, 1, 14, 2, '#b07a40');
      p.rect(0, 11, 14, 2, '#5a3a1a');
      p.rect(1, 3, 12, 8, '#2a1a10');
      p.rect(2, 4, 10, 6, f ? color : '#f8f0d0');
      miniText(p, letter, 5, 4.5, f ? '#ffffff' : color);
    },
  });
}

// Lazily define crates for every registered weapon (weapons may register after this module).
let cratesDefined = false;
export function ensureCrateSprites(): void {
  if (cratesDefined) return;
  cratesDefined = true;
  for (const w of allWeapons()) if (w.letter && w.id !== 'pistol') defineCrate(`crate_${w.letter}`, w.letter, w.color);
}

sprites.fallback({
  name: 'crate_bomb',
  w: 14,
  h: 13,
  frames: 2,
  draw: (p, f) => {
    p.rect(0, 1, 14, 12, '#5a6a3a');
    p.rect(0, 1, 14, 2, '#7a8a4a');
    p.rect(0, 11, 14, 2, '#3a4422');
    p.circle(7, 7, 3.5, f ? '#a0c060' : '#3a4a1e');
    p.px(6, 5, '#d0e0a0');
    p.rect(6, 2, 2, 2, '#c0c0c0');
  },
});

sprites.fallback({
  name: 'crate_firebomb',
  w: 14,
  h: 13,
  frames: 2,
  draw: (p, f) => {
    p.rect(0, 1, 14, 12, '#8a2a1a');
    p.rect(0, 1, 14, 2, '#c04a2a');
    p.rect(0, 11, 14, 2, '#5a1a0a');
    p.circle(7, 7.5, 3.5, f ? '#ffd040' : '#ff7a20');
    p.tri(5, 6, 7, 2, 9, 6, f ? '#ff7a20' : '#ffd040');
  },
});

sprites.fallback({
  name: 'item_fuel',
  w: 10,
  h: 13,
  frames: 2,
  draw: (p, f) => {
    p.rect(1, 2, 8, 11, f ? '#e04a2a' : '#c03a1a');
    p.rect(1, 2, 8, 2, '#f07a5a');
    p.rect(6, 0, 3, 3, '#3a3a3a');
    miniText(p, 'F', 3.5, 6, '#ffffff');
  },
});

sprites.fallback({
  name: 'item_1up',
  w: 14,
  h: 11,
  frames: 2,
  draw: (p, f) => {
    p.rect(0, 0, 14, 11, f ? '#30c050' : '#20a040');
    p.rect(1, 1, 12, 9, '#f8fff0');
    miniText(p, 'XL', 2, 3, f ? '#20a040' : '#105020');
    p.rect(1, 3, 1, 5, '#20a040');
  },
});

// Score items.
sprites.fallback({ name: 'item_coin', w: 8, h: 8, frames: 4, draw: (p, f) => { const w = [3.5, 2.5, 1, 2.5][f]; p.ellipse(4, 4, w, 3.6, '#f0c030'); p.ellipse(4, 4, Math.max(0.5, w - 1.2), 2.4, '#ffe070'); } });
sprites.fallback({ name: 'item_ration', w: 12, h: 9, draw: (p) => { p.rect(0, 2, 12, 7, '#6a7a3a'); p.rect(0, 2, 12, 2, '#8a9a4a'); miniText(p, 'MRE', 0.5, 3.5, '#f0f0c0'); } });
sprites.fallback({ name: 'item_watch', w: 9, h: 11, draw: (p) => { p.rect(3, 0, 3, 11, '#6a4a2a'); p.circle(4.5, 5.5, 3.6, '#e0c040'); p.circle(4.5, 5.5, 2.6, '#ffffff'); p.line(4.5, 5.5, 4.5, 3.5, '#202020'); p.line(4.5, 5.5, 6, 5.5, '#202020'); } });
sprites.fallback({ name: 'item_medal', w: 9, h: 12, draw: (p) => { p.tri(1, 0, 4.5, 6, 8, 0, '#c02a2a'); p.rect(3, 0, 3, 4, '#2a4ac0'); p.circle(4.5, 8, 3.5, '#f0c030'); p.circle(4.5, 8, 1.6, '#ffe890'); } });
sprites.fallback({ name: 'item_gem', w: 10, h: 9, frames: 2, draw: (p, f) => { p.poly([2, 0, 8, 0, 10, 3, 5, 9, 0, 3], '#3ad0ff'); p.poly([3, 1, 7, 1, 8, 3, 5, 7, 2, 3], f ? '#c0f4ff' : '#8ae4ff'); p.px(3, 1, '#ffffff'); } });
sprites.fallback({ name: 'item_goldbar', w: 13, h: 7, draw: (p) => { p.poly([2, 0, 11, 0, 13, 7, 0, 7], '#d8a020'); p.poly([3, 1, 10, 1, 11, 3, 2, 3], '#ffe070'); } });

export class Pickup extends Actor {
  kind: PickupKind;
  weaponId: string | null = null;
  points = 0;
  spriteName: string;
  private bob = 0;
  collectedBy: Player | null = null;

  constructor(kind: PickupKind, opts: { weapon?: string; points?: number; sprite?: string } = {}) {
    super();
    this.kind = kind;
    this.team = 'neutral';
    this.hittable = false;
    this.z = Z.PICKUP;
    this.w = 12;
    this.h = 12;
    this.weaponId = opts.weapon ?? null;
    this.points = opts.points ?? 0;
    ensureCrateSprites();
    if (kind === 'weapon') this.spriteName = `crate_${getWeapon(this.weaponId ?? 'hmg').letter}`;
    else if (kind === 'bomb') this.spriteName = 'crate_bomb';
    else if (kind === 'firebomb') this.spriteName = 'crate_firebomb';
    else if (kind === 'fuel') this.spriteName = 'item_fuel';
    else if (kind === 'life') this.spriteName = 'item_1up';
    else this.spriteName = opts.sprite ?? 'item_coin';
    if (kind === 'points' && !this.points) this.points = SCORE_ITEMS[this.spriteName] ?? 500;
  }

  override update(dt: number): void {
    this.moveAndCollide(dt);
    if (this.onGround) this.vx *= 0.8;
    this.bob += dt;
    if (this.age < 0.25) return;
    for (const p of this.world.players) {
      if (p.state !== 'play' && p.state !== 'vehicle') continue;
      const target = p.vehicle ?? p;
      if (rectsOverlap(this.box, target.box)) {
        this.collect(p);
        return;
      }
    }
  }

  collect(p: Player): void {
    const w = this.world;
    this.collectedBy = p;
    switch (this.kind) {
      case 'weapon': {
        const def = getWeapon(this.weaponId ?? 'hmg');
        if (p.vehicle) {
          // Vehicles convert weapon crates into points (and a little repair).
          p.vehicle.repair(5);
          w.addScore(p, 500, { x: this.x, y: this.top });
        } else {
          p.giveWeapon(def.id);
          w.floatText(def.letter, this.x, this.top - 2, def.color);
        }
        w.sfx('pickup_weapon');
        audio.say(def.name.toLowerCase());
        break;
      }
      case 'bomb':
        p.addBombs(10, p.bombKind);
        w.sfx('pickup');
        w.floatText('BOMB+10', this.x, this.top - 2, '#a0e060');
        break;
      case 'firebomb':
        p.addBombs(10, 'firebomb');
        w.sfx('pickup');
        w.floatText('FIRE BOMB', this.x, this.top - 2, '#ff8a3a');
        audio.say('fire bomb');
        break;
      case 'fuel':
        if (p.vehicle) p.vehicle.repair(p.vehicle.maxHp * 0.5);
        w.addScore(p, 300, { x: this.x, y: this.top });
        w.sfx('pickup');
        break;
      case 'life':
        p.profile.lives = Math.min(9, p.profile.lives + 1);
        w.floatText('1UP', this.x, this.top - 2, '#40ff60');
        w.sfx('extra_life');
        break;
      case 'points':
        w.addScore(p, this.points, { x: this.x, y: this.top });
        w.sfx('pickup_points');
        break;
    }
    w.emit({ type: 'pickup', kind: this.kind === 'weapon' ? `weapon:${this.weaponId}` : this.kind, player: p });
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const s = sprites.get(this.spriteName);
    const blink = Math.floor(this.bob * 4) % 2;
    const yo = this.onGround ? 0 : 0;
    s.draw(g, this.x, this.y + yo, s.frameCount > 1 ? (this.kind === 'points' ? Math.floor(this.bob * 8) : blink) : 0);
  }
}

/** Create a pickup from a spec string (see header). */
export function makePickup(world: World, spec: string): Pickup | null {
  let s = spec;
  if (s === 'random') {
    s = world.rng.weighted<string>([
      ['H', 4],
      ['bomb', 3],
      ['points', 4],
      ['R', 1.5],
      ['S', 1.5],
      ['F', 1.2],
      ['L', 1],
      ['C', 1],
      ['B', 0.8],
    ]);
  }
  if (s === 'bomb') return new Pickup('bomb');
  if (s === 'firebomb') return new Pickup('firebomb');
  if (s === 'fuel') return new Pickup('fuel');
  if (s === 'life') return new Pickup('life');
  if (s.startsWith('points')) {
    const n = parseInt(s.split(':')[1] ?? '', 10);
    if (n) {
      const sprite = Object.entries(SCORE_ITEMS).reduce((best, [k, v]) => (Math.abs(v - n) < Math.abs(SCORE_ITEMS[best] - n) ? k : best), 'item_coin');
      return new Pickup('points', { points: n, sprite });
    }
    const sprite = world.rng.pick(Object.keys(SCORE_ITEMS).slice(0, 4));
    return new Pickup('points', { sprite });
  }
  if (s.startsWith('item:')) return new Pickup('points', { sprite: s.slice(5) });
  const w = allWeapons().find((x) => x.letter === s || x.id === s);
  if (w && w.id !== 'pistol') return new Pickup('weapon', { weapon: w.id });
  // Unknown weapon letter (content not loaded yet): fall back to HMG.
  if (s.length === 1) return new Pickup('weapon', { weapon: 'hmg' });
  console.warn(`[pickup] unknown spec "${spec}"`);
  return null;
}

/** Drop a pickup that pops up out of (x, y). */
export function dropPickup(world: World, x: number, y: number, spec: string, vx = 0): Pickup | null {
  const p = makePickup(world, spec);
  if (!p) return null;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = -150;
  world.add(p);
  return p;
}

registerEntity(
  'pickup',
  'pickup',
  (w, s) => makePickup(w, String(s.props?.item ?? 'random')) ?? new Pickup('points'),
  'Item on the ground. props.item = spec string (H, bomb, points:500, life, fuel, random...)',
);
