// Pickups: weapon cases (letter badge), bomb / fire-bomb cases, score items, 1UPs and vehicle fuel.
// Spawn spec strings (used by hostages, crates and enemies via props.drop):
//   'H','R','S','F','L','C','B'  weapon case by letter     'bomb'  +10 grenades (vehicle: +10 shells)
//   'firebomb'  switch to fire bombs (+10)                  'fuel'  repair vehicle 50%
//   'life'  extra life                                      'points' | 'points:5000' | 'item:<sprite>'
//   'random' weighted random
// Dropped items pop up, bounce twice and settle; everything sparkles now and then. Items stay until
// collected, except old ones the camera has left behind: after 25 s at/behind the left edge they
// blink for 2 s and vanish.

import { sprites } from '../engine/sprites';
import { audio, type PlayOpts } from '../engine/audio';
import { PixelArt, shade } from '../engine/pixelart';
import { fxRng } from '../engine/rng';
import { rectsOverlap } from '../engine/math';
import { Actor } from './entity';
import { Z } from './constants';
import { allWeapons, getWeapon } from './weapons';
import { registerEntity } from './registry';
import type { World } from './world';
import type { Player } from './player';

/**
 * Canonical SFX names (docs/DESIGN.md) used by items, props and hostages. Played through isfx() so
 * the names stay type-checked; tests/vehicles.test.ts checks this list against the design document.
 */
export const ITEM_SFX = [
  'pickup',
  'pickup_weapon',
  'pickup_points',
  'extra_life',
  'rescue',
  'coin',
  'fuel',
  'metal_hit',
  'crate_break',
  'glass_break',
  'mine_beep',
  'explosion_small',
  'explosion',
  'explosion_big',
  'fire_burst',
  'ricochet',
] as const;
export type ItemSfx = (typeof ITEM_SFX)[number];

/** Play a canonical item/prop sound (positional). */
export function isfx(world: World, name: ItemSfx, x?: number, opts: PlayOpts = {}): void {
  world.sfx(name, x, opts);
}

export type PickupKind = 'weapon' | 'bomb' | 'firebomb' | 'points' | 'life' | 'fuel';

/** Score items (sprite name -> points). Content can add more. The first four are the 'points' randoms. */
export const SCORE_ITEMS: Record<string, number> = {
  item_coin: 100,
  item_ration: 500,
  item_watch: 1000,
  item_medal: 2000,
  item_gem: 5000,
  item_goldbar: 10000,
  // Themed finds (place with 'item:<name>'): tropical, desert, snow, harbor, factory.
  item_banana: 300,
  item_coconut: 600,
  item_pineapple: 800,
  item_scarab: 3000,
  item_idol: 8000,
  item_cocoa: 400,
  item_snowglobe: 2500,
  item_bottle: 1500,
  item_cog: 1200,
};

/** Seconds an item may linger behind the camera's left edge before it blinks out. */
export const PICKUP_LINGER = 25;
const BLINK_OUT = 2;

// ------------------------------------------------------------------ art helpers

/** 5x5 bold glyphs for case badges. */
const BADGE: Record<string, string[]> = {
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  B: ['####.', '#...#', '####.', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '####.', '#....', '#####'],
  F: ['#####', '#....', '####.', '#....', '#....'],
  G: ['.####', '#....', '#..##', '#...#', '.###.'],
  H: ['#...#', '#...#', '#####', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '#####'],
  K: ['#...#', '#..#.', '###..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  P: ['####.', '#...#', '####.', '#....', '#....'],
  R: ['####.', '#...#', '####.', '#..#.', '#...#'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '.###.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  Z: ['#####', '...#.', '..#..', '.#...', '#####'],
};

function badgeGlyph(p: PixelArt, ch: string, x: number, y: number, c: string): void {
  const g = BADGE[ch] ?? BADGE.X;
  for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) if (g[yy][xx] === '#') p.px(x + xx, y + yy, c);
}

// 3x5 mini font (labels on small items).
const MINI: Record<string, string[]> = {
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  A: ['###', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['###', '#..', '#..', '#..', '###'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  P: ['###', '#.#', '###', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
};

export function miniText(p: PixelArt, s: string, x: number, y: number, c: string): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = MINI[ch];
    if (g) for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 3; xx++) if (g[yy][xx] === '#') p.px(cx + xx, y + yy, c);
    cx += 4;
  }
}

/** Edge-lit fill (light top/left, dark bottom/right) of a shape drawn by `mask`. */
function lit(p: PixelArt, mask: (m: PixelArt) => void, base: string, light = 0.3, dark = -0.3): void {
  const m = new PixelArt(p.w, p.h);
  m.ox = p.ox;
  m.oy = p.oy;
  mask(m);
  const L = shade(base, light);
  const D = shade(base, dark);
  const L2 = shade(base, light * 0.5);
  const D2 = shade(base, dark * 0.5);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (!m.opaque(x, y)) continue;
      const c = !m.opaque(x, y - 1) ? L : !m.opaque(x, y + 1) ? D : !m.opaque(x - 1, y) ? L2 : !m.opaque(x + 1, y) ? D2 : base;
      p.px(x - p.ox, y - p.oy, c);
    }
}

/** Default case badge colors per letter (used when the weapon isn't registered (yet) or for contrast). */
const LETTER_COLORS: Record<string, string> = {
  H: '#ffcf3a',
  R: '#ff4a3a',
  S: '#e8e4d8',
  F: '#ff8a1a',
  L: '#4ad8ff',
  C: '#d070ff',
  B: '#8ae05a',
};

/** Badge color for a weapon letter: the registered weapon's color, distinct defaults for H R S F L C B. */
function letterColor(letter: string): string {
  return LETTER_COLORS[letter] ?? allWeapons().find((w) => w.letter === letter)?.color ?? '#ffffff';
}

/** Olive steel supply case with a carry handle and corner guards. Frame 1 = glint. */
function drawCase(p: PixelArt, body: string, glint: boolean): void {
  // Handle.
  p.rect(5, 0, 6, 1, '#4a4a52');
  p.rect(5, 0, 1, 3, '#4a4a52');
  p.rect(10, 0, 1, 3, '#4a4a52');
  p.px(6, 0, '#8a8a96');
  // Body (lid + box).
  lit(p, (m) => m.rect(0, 2, 16, 12, '#fff'), body);
  p.hline(1, 14, 5, shade(body, -0.38));
  p.hline(1, 14, 4, shade(body, 0.12));
  // Corner guards.
  for (const [cx, cy] of [
    [0, 2],
    [14, 2],
    [0, 12],
    [14, 12],
  ]) {
    p.rect(cx, cy, 2, 2, '#9aa0ac');
    p.px(cx + (cx ? 1 : 0), cy + (cy > 5 ? 1 : 0), '#5c6372');
  }
  // Latch.
  p.rect(7, 4, 2, 2, '#c8ccd4');
  p.px(8, 5, '#5c6372');
  if (glint) {
    p.px(2, 3, '#ffffff');
    p.px(3, 3, '#ffffff');
  }
}

function defineWeaponCase(letter: string): void {
  sprites.define({
    name: `crate_${letter}`,
    w: 16,
    h: 14,
    frames: 2,
    draw: (p, f) => {
      const glint = f === 1;
      const col = letterColor(letter);
      drawCase(p, '#6a7a3e', glint);
      // Letter badge.
      lit(p, (m) => m.rect(3.5, 6.5, 9, 7, '#fff'), glint ? shade(col, 0.15) : col, 0.35, -0.35);
      badgeGlyph(p, letter, 5.5, 7.5, '#1e1a22');
      if (glint) {
        p.px(4, 7, '#ffffff');
        p.px(11, 12, shade(col, 0.5));
      }
    },
  });
}

// Cases for the canonical letters now; any other registered weapon letter is added on demand.
for (const l of Object.keys(LETTER_COLORS)) defineWeaponCase(l);

let extraCasesChecked = 0;
export function ensureCrateSprites(): void {
  const ws = allWeapons();
  if (ws.length === extraCasesChecked) return;
  extraCasesChecked = ws.length;
  for (const w of ws) if (w.letter && w.id !== 'pistol' && !sprites.has(`crate_${w.letter}`)) defineWeaponCase(w.letter);
}

sprites.define({
  name: 'crate_bomb',
  w: 16,
  h: 14,
  frames: 2,
  draw: (p, f) => {
    drawCase(p, '#5e6e36', f === 1);
    lit(p, (m) => m.rect(3.5, 6.5, 9, 7, '#fff'), '#e8dcb0', 0.2, -0.3);
    // Grenade icon.
    p.circle(8, 10.5, 2.4, '#3e5a26');
    p.px(7, 9, '#7aa04a');
    p.rect(7, 7.5, 2, 1.5, '#8a8a96');
    p.px(9, 7, '#8a8a96');
    p.px(10, 8, '#8a8a96');
  },
});

sprites.define({
  name: 'crate_firebomb',
  w: 16,
  h: 14,
  frames: 2,
  draw: (p, f) => {
    drawCase(p, '#8a3424', f === 1);
    lit(p, (m) => m.rect(3.5, 6.5, 9, 7, '#fff'), '#ffe0a0', 0.2, -0.3);
    // Flame icon.
    p.poly([5.5, 13, 6, 9.5, 7.5, 10.5, 8, 7, 9.5, 9.5, 10, 8.5, 10.8, 13], f ? '#ffb020' : '#ff6a1a');
    p.poly([7, 13, 7.6, 10.8, 8.5, 11.6, 9.4, 13], '#ffe070');
  },
});

sprites.define({
  name: 'item_fuel',
  w: 12,
  h: 14,
  frames: 2,
  draw: (p, f) => {
    // Jerry can: handles on top, spout, embossed cross.
    p.rect(3, 0, 6, 1, '#3a3a40');
    p.rect(3, 0, 1, 2, '#3a3a40');
    p.rect(8, 0, 1, 2, '#3a3a40');
    p.rect(9.5, 0.5, 2, 2.5, '#6a6a72');
    lit(p, (m) => m.poly([0.5, 3, 10, 2, 11.5, 3.5, 11.5, 14, 0.5, 14], '#fff'), f ? '#e0483a' : '#c83a2a');
    p.line(2.5, 5, 9.5, 12, '#ff7a5a');
    p.line(9.5, 5, 2.5, 12, '#ff7a5a');
    p.line(3, 5, 10, 12, '#8a2418');
    p.line(10, 5, 3, 12, '#8a2418');
    if (f) p.px(1, 4, '#ffffff');
  },
});

sprites.define({
  name: 'item_1up',
  w: 17,
  h: 11,
  frames: 2,
  draw: (p, f) => {
    lit(p, (m) => m.capsule(4.5, 5.5, 12.5, 5.5, 5, '#fff'), f ? '#3ad860' : '#22b048', 0.35, -0.35);
    miniText(p, '1UP', 2.5, 3, '#ffffff');
    p.hline(3, 13, 9, f ? '#1c8a36' : '#167a2e');
    if (f) {
      p.px(2, 2, '#e0ffe0');
      p.px(3, 2, '#e0ffe0');
    }
  },
});

// ---- score items

sprites.define({
  name: 'item_coin',
  w: 9,
  h: 9,
  frames: 4,
  draw: (p, f) => {
    const w = [4, 2.8, 1, 2.8][f];
    p.ellipse(4.5, 4.5, w, 4, '#b8801a');
    if (w > 1.5) {
      p.ellipse(4.5, 4.5, w - 0.9, 3.2, '#f0c030');
      p.ellipse(4.2, 4.2, Math.max(0.6, w - 1.9), 2.2, '#ffe070');
      if (f === 0) {
        p.px(4, 3, '#b8801a');
        p.px(4, 4, '#b8801a');
        p.px(4, 5, '#b8801a');
      }
    } else p.rect(4, 1, 1, 7, '#ffe070');
  },
});

sprites.define({
  name: 'item_ration',
  w: 12,
  h: 10,
  draw: (p) => {
    // Field ration tin with a striped label.
    lit(p, (m) => m.rect(0, 1, 12, 9, '#fff'), '#8a96a0');
    p.rect(0, 3, 12, 5, '#c8402a');
    p.hline(0, 11, 3, '#e8684a');
    p.rect(4, 4, 4, 3, '#f4e6c0');
    p.px(5, 5, '#c8402a');
    p.px(6, 5, '#c8402a');
  },
});

sprites.define({
  name: 'item_watch',
  w: 10,
  h: 12,
  draw: (p) => {
    p.rect(4, 0, 2, 3, '#c89a3a');
    lit(p, (m) => m.circle(5, 7, 4.5, '#fff'), '#e0b030');
    p.circle(5, 7, 3.1, '#fffaf0');
    p.line(5, 7, 5, 4.5, '#2a2430');
    p.line(5, 7, 7, 7, '#2a2430');
    p.px(5, 7, '#c8402a');
  },
});

sprites.define({
  name: 'item_medal',
  w: 10,
  h: 13,
  draw: (p) => {
    p.poly([1, 0, 9, 0, 7, 5, 3, 5], '#c8402a');
    p.rect(4, 0, 2, 5, '#f4e6c0');
    lit(p, (m) => m.circle(5, 8.5, 4, '#fff'), '#e8b828');
    p.poly([5, 6, 5.8, 7.8, 7.6, 8, 6.2, 9.2, 6.6, 11, 5, 10, 3.4, 11, 3.8, 9.2, 2.4, 8, 4.2, 7.8], '#fff2a0');
  },
});

sprites.define({
  name: 'item_gem',
  w: 11,
  h: 10,
  frames: 2,
  draw: (p, f) => {
    p.poly([2, 0, 9, 0, 11, 3, 5.5, 10, 0, 3], '#1a90c8');
    p.poly([2.6, 0.8, 8.4, 0.8, 9.8, 3, 5.5, 8.6, 1.2, 3], '#3ad0ff');
    p.poly([3.5, 3, 7.5, 3, 5.5, 7.5], f ? '#c0f4ff' : '#8ae4ff');
    p.hline(1, 9, 3, '#e0f8ff');
    p.px(3, 1, '#ffffff');
    if (f) p.px(8, 2, '#ffffff');
  },
});

sprites.define({
  name: 'item_goldbar',
  w: 14,
  h: 8,
  draw: (p) => {
    p.poly([2.5, 0, 11.5, 0, 14, 8, 0, 8], '#b07c14');
    p.poly([3, 0.6, 11, 0.6, 12, 3.6, 2, 3.6], '#ffe070');
    p.poly([1.5, 4.4, 12.5, 4.4, 13.2, 7.4, 0.8, 7.4], '#e0a828');
    p.px(4, 1, '#ffffff');
    p.px(5, 1, '#ffffff');
  },
});

sprites.define({
  name: 'item_banana',
  w: 12,
  h: 9,
  draw: (p) => {
    for (let i = 0; i < 3; i++) {
      p.capsule(1.5 + i * 0.6, 2 + i * 2, 9.5, 6 + i * 0.4, 1.3, i === 1 ? '#ffe04a' : '#f0c828');
    }
    p.line(3, 3, 9, 5.5, '#fff2a0');
    p.rect(9.5, 5, 2, 2, '#6a4a20');
    p.px(1, 2, '#4a3a18');
  },
});

sprites.define({
  name: 'item_coconut',
  w: 10,
  h: 12,
  draw: (p) => {
    // Coconut drink with a straw and a little umbrella.
    lit(p, (m) => m.circle(5, 8, 4, '#fff'), '#8a5a30');
    p.ellipse(5, 5, 3.2, 1.2, '#f4ecd8');
    p.line(6, 5, 8, 0, '#ff5a8a');
    p.poly([1, 2, 3.5, 0, 6, 2], '#3ad0a0');
    p.line(3.5, 2, 3.5, 5, '#c8a060');
    p.px(3, 7, '#c8945a');
  },
});

sprites.define({
  name: 'item_pineapple',
  w: 9,
  h: 14,
  draw: (p) => {
    p.poly([4.5, 0, 6, 4, 4.5, 3, 3, 4], '#3aa04a');
    p.poly([1.5, 2, 4.5, 4.5, 2.5, 5], '#2a8a3a');
    p.poly([7.5, 2, 4.5, 4.5, 6.5, 5], '#2a8a3a');
    lit(p, (m) => m.ellipse(4.5, 9.5, 4, 4.5, '#fff'), '#e8b028');
    for (let y = 6; y <= 13; y += 2) for (let x = 1 + (y % 4 ? 1 : 0); x <= 8; x += 2) p.px(x, y, '#b07818');
  },
});

sprites.define({
  name: 'item_scarab',
  w: 11,
  h: 9,
  frames: 2,
  draw: (p, f) => {
    p.line(1, 2, 3, 3, '#a07818');
    p.line(10, 2, 8, 3, '#a07818');
    p.line(1, 8, 3, 6, '#a07818');
    p.line(10, 8, 8, 6, '#a07818');
    lit(p, (m) => m.ellipse(5.5, 5, 3.6, 3.6, '#fff'), '#e8b828');
    p.vline(5.5, 2.5, 8, '#a07818');
    p.circle(5.5, 1.6, 1.4, '#d0a020');
    p.px(4, 4, f ? '#7af0e0' : '#3ac8c0');
    p.px(7, 4, f ? '#7af0e0' : '#3ac8c0');
  },
});

sprites.define({
  name: 'item_idol',
  w: 9,
  h: 14,
  draw: (p) => {
    // Little golden statuette: round head, folded arms, pedestal.
    lit(p, (m) => m.circle(4.5, 3, 2.8, '#fff'), '#f0c030');
    lit(p, (m) => m.poly([1.5, 6, 7.5, 6, 6.5, 11, 2.5, 11], '#fff'), '#e0a828');
    p.hline(2.5, 6.5, 8, '#b07c14');
    p.px(3.5, 2.5, '#6a4a10');
    p.px(5.5, 2.5, '#6a4a10');
    lit(p, (m) => m.rect(0.5, 11, 8, 3, '#fff'), '#8a5a2a');
    p.px(3, 1, '#ffffff');
  },
});

sprites.define({
  name: 'item_cocoa',
  w: 11,
  h: 11,
  frames: 2,
  draw: (p, f) => {
    // Steam.
    p.px(4 + (f ? 1 : 0), 0, '#e8eef4');
    p.px(5 - (f ? 1 : 0), 1, '#e8eef4');
    p.px(6 + (f ? 1 : 0), 2, '#e8eef4');
    p.ring(8.5, 6.5, 2.2, '#c84a3a', 1);
    lit(p, (m) => m.rect(1, 3.5, 7, 7.5, '#fff'), '#d8503a');
    p.rect(1.5, 3.5, 6, 1.5, '#6a3a20');
    p.rect(3, 3, 2, 1.5, '#fff8f0');
    p.hline(1, 7, 7, '#f4e6c0');
  },
});

sprites.define({
  name: 'item_snowglobe',
  w: 10,
  h: 12,
  frames: 2,
  draw: (p, f) => {
    p.circle(5, 5, 4.5, '#bfe6ff');
    p.circle(4.5, 4.5, 3.6, '#d8f2ff');
    p.tri(5, 2, 7, 7, 3, 7, '#2a8a4a');
    p.rect(4.5, 7, 1, 1, '#6a4a2a');
    p.px(f ? 3 : 7, 3, '#ffffff');
    p.px(f ? 6 : 2, 5, '#ffffff');
    p.px(3, 2, '#ffffff');
    lit(p, (m) => m.poly([1, 9, 9, 9, 10, 12, 0, 12], '#fff'), '#8a4a2a');
  },
});

sprites.define({
  name: 'item_bottle',
  w: 13,
  h: 7,
  draw: (p) => {
    // Message in a bottle.
    lit(p, (m) => m.capsule(3.5, 3.5, 9, 3.5, 3, '#fff'), '#3aa878');
    p.rect(10.5, 2, 2, 3, '#c89a5a');
    p.rect(4, 2.5, 5, 2, '#f4e6c0');
    p.hline(3, 9, 1, '#9af0c8');
  },
});

sprites.define({
  name: 'item_cog',
  w: 10,
  h: 10,
  frames: 2,
  draw: (p, f) => {
    const a0 = f ? Math.PI / 8 : 0;
    for (let i = 0; i < 8; i++) {
      const a = a0 + (i / 8) * Math.PI * 2;
      p.rotRect(5 + Math.cos(a) * 3.8, 5 + Math.sin(a) * 3.8, 1.2, 1.2, a, '#b07c24');
    }
    lit(p, (m) => m.circle(5, 5, 3.6, '#fff'), '#d8a038');
    p.circle(5, 5, 1.3, '#4a3418');
  },
});

// ---- UI / FX sprites

/** Rescued-hostage icon for the HUD (mechanic in a blue cap). Origin bottom-center. */
sprites.define({
  name: 'hud_hostage',
  w: 7,
  h: 8,
  draw: (p) => {
    p.rect(1, 6, 5, 2, '#e8782a');
    p.rect(1, 6, 1, 2, '#ff9a4a');
    p.circle(3.5, 4, 2.6, '#f0c098');
    p.rect(1, 1, 5, 2, '#3a6ab0');
    p.rect(4, 2, 3, 1, '#2a4a8a');
    p.px(2, 1, '#6a9ae0');
    p.px(4, 4, '#2a1a14');
    p.rect(3, 5, 3, 1, '#5a3a22');
  },
});

/** Twinkle on items: dot -> cross -> star -> cross. */
sprites.define({
  name: 'pickup_sparkle',
  w: 7,
  h: 7,
  ox: 3,
  oy: 3,
  frames: 4,
  outline: null,
  draw: (p, f) => {
    const r = [0, 1, 3, 1][f];
    p.px(3, 3, '#ffffff');
    if (r > 0) {
      p.line(3 - r, 3, 3 + r, 3, f === 2 ? '#fff6b0' : '#ffffff');
      p.line(3, 3 - r, 3, 3 + r, f === 2 ? '#fff6b0' : '#ffffff');
    }
    if (f === 2) {
      p.px(2, 2, '#ffffff');
      p.px(4, 4, '#ffffff');
      p.px(4, 2, '#ffffff');
      p.px(2, 4, '#ffffff');
    }
  },
});

// ------------------------------------------------------------------ entity

export class Pickup extends Actor {
  kind: PickupKind;
  weaponId: string | null = null;
  points = 0;
  spriteName: string;
  collectedBy: Player | null = null;
  private bob = 0;
  private bounces = 0;
  private squash = 0;
  private sparkleT: number;
  private glintT: number;
  /** >= 0 while blinking out (seconds left). */
  private blinkOut = -1;

  constructor(kind: PickupKind, opts: { weapon?: string; points?: number; sprite?: string } = {}) {
    super();
    this.kind = kind;
    this.team = 'neutral';
    this.hittable = false;
    this.z = Z.PICKUP;
    this.weaponId = opts.weapon ?? null;
    this.points = opts.points ?? 0;
    ensureCrateSprites();
    if (kind === 'weapon') this.spriteName = `crate_${getWeapon(this.weaponId ?? 'hmg').letter}`;
    else if (kind === 'bomb') this.spriteName = 'crate_bomb';
    else if (kind === 'firebomb') this.spriteName = 'crate_firebomb';
    else if (kind === 'fuel') this.spriteName = 'item_fuel';
    else if (kind === 'life') this.spriteName = 'item_1up';
    else this.spriteName = opts.sprite && sprites.has(opts.sprite) ? opts.sprite : 'item_coin';
    if (kind === 'points' && !this.points) this.points = SCORE_ITEMS[this.spriteName] ?? 500;
    const s = sprites.get(this.spriteName);
    this.w = Math.min(14, s.w);
    this.h = Math.min(13, s.h);
    this.sparkleT = fxRng.range(0.3, 1.5);
    this.glintT = fxRng.range(0.5, 2);
  }

  override update(dt: number): void {
    const wasGround = this.onGround;
    this.moveAndCollide(dt);
    if (this.dead) return;
    if (this.landed && !wasGround) {
      if (this.landVy > 80 && this.bounces < 2) {
        // Bounce (each one lower).
        this.bounces++;
        this.jump(this.landVy * (this.bounces === 1 ? 0.42 : 0.3));
        this.squash = 0.08;
        this.world.particles.dust(this.x, this.y, 2);
      } else {
        this.vx = 0;
        this.squash = 0.06;
      }
    }
    if (this.onGround) this.vx *= Math.pow(0.02, dt);
    if (this.squash > 0) this.squash -= dt;
    this.bob += dt;
    this.fx(dt);
    // Left behind for a long time: blink out.
    if (this.blinkOut >= 0) {
      this.blinkOut -= dt;
      if (this.blinkOut <= 0) {
        this.remove();
        return;
      }
    } else if (this.age > PICKUP_LINGER && this.x - this.w / 2 < this.world.camera.x + 4) {
      this.blinkOut = BLINK_OUT;
    }
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

  /** Cosmetic twinkles and case glints. */
  private fx(dt: number): void {
    this.sparkleT -= dt;
    this.glintT -= dt;
    if (this.glintT < -0.16) this.glintT = fxRng.range(1.2, 2.4);
    if (this.sparkleT <= 0) {
      this.sparkleT = this.kind === 'points' || this.kind === 'life' ? fxRng.range(0.5, 1.1) : fxRng.range(0.9, 1.8);
      if (this.onScreen(0)) {
        const sx = this.x + fxRng.range(-this.w / 2, this.w / 2);
        const sy = this.y - fxRng.range(1, this.h);
        this.world.effect('pickup_sparkle', sx, sy, { fps: 14, z: Z.PICKUP + 1 });
      }
    }
  }

  collect(p: Player): void {
    const w = this.world;
    this.collectedBy = p;
    const v = p.vehicle;
    const ty = this.top - 2;
    switch (this.kind) {
      case 'weapon': {
        const def = getWeapon(this.weaponId ?? 'hmg');
        if (v) {
          // Vehicles convert weapon cases into points (and a little repair).
          v.repair(5);
          w.addScore(p, 500, { x: this.x, y: ty });
        } else {
          p.giveWeapon(def.id);
          w.floatText(def.letter, this.x, ty, letterColor(def.letter));
        }
        isfx(w, 'pickup_weapon');
        audio.say(def.name.toLowerCase());
        break;
      }
      case 'bomb':
        if (v && v.refillAmmo(10)) {
          w.floatText('AMMO+10', this.x, ty, '#a0e060');
        } else {
          p.addBombs(10, p.bombKind);
          w.floatText('BOMB+10', this.x, ty, '#a0e060');
        }
        isfx(w, 'pickup');
        break;
      case 'firebomb':
        if (v && v.refillAmmo(10)) {
          w.floatText('AMMO+10', this.x, ty, '#ff8a3a');
        } else {
          p.addBombs(10, 'firebomb');
          w.floatText('FIRE BOMB', this.x, ty, '#ff8a3a');
          audio.say('fire bomb');
        }
        isfx(w, 'pickup');
        break;
      case 'fuel':
        if (v) {
          v.repair(v.maxHp * 0.5);
          w.floatText('REPAIR', this.x, ty, '#80e0ff');
        }
        w.addScore(p, 300, v ? undefined : { x: this.x, y: ty });
        isfx(w, 'fuel');
        break;
      case 'life':
        p.profile.lives = Math.min(9, p.profile.lives + 1);
        w.floatText('1UP', this.x, ty, '#40ff60');
        isfx(w, 'extra_life');
        break;
      case 'points':
        w.addScore(p, this.points, { x: this.x, y: ty });
        isfx(w, this.spriteName === 'item_coin' ? 'coin' : 'pickup_points');
        break;
    }
    // Pop: ring + twinkles.
    const cy = this.y - this.h / 2;
    w.particles.add({ kind: 'ring', x: this.x, y: cy, life: 0.22, color: '#fff6c0', size: 2, size2: 12 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.6;
      w.particles.add({ kind: 'px', x: this.x, y: cy, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20, life: 0.3, color: '#ffffff', color2: '#ffe070', drag: 3 });
    }
    w.emit({ type: 'pickup', kind: this.kind === 'weapon' ? `weapon:${this.weaponId}` : this.kind, player: p });
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.blinkOut >= 0 && Math.floor(this.blinkOut * (this.blinkOut < 0.8 ? 20 : 10)) % 2 === 0) return;
    const s = sprites.get(this.spriteName);
    let frame = 0;
    if (s.frameCount > 1) {
      if (this.kind === 'points') frame = Math.floor(this.bob * (this.spriteName === 'item_coin' ? 10 : 3));
      else if (this.kind === 'life') frame = Math.floor(this.bob * 4) % 2;
      else frame = this.glintT < 0 ? 1 : 0;
    }
    const yo = this.squash > 0 ? 1 : 0;
    s.draw(g, this.x, this.y + yo, frame);
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
  if (s === 'life' || s === '1up') return new Pickup('life');
  if (s.startsWith('points')) {
    const n = parseInt(s.split(':')[1] ?? '', 10);
    if (n) {
      const classic = ['item_coin', 'item_ration', 'item_watch', 'item_medal', 'item_gem', 'item_goldbar'];
      const sprite = classic.reduce((best, k) => (Math.abs(SCORE_ITEMS[k] - n) < Math.abs(SCORE_ITEMS[best] - n) ? k : best), 'item_coin');
      return new Pickup('points', { points: n, sprite });
    }
    const sprite = world.rng.pick(Object.keys(SCORE_ITEMS).slice(0, 4));
    return new Pickup('points', { sprite });
  }
  if (s.startsWith('item:')) {
    const name = s.slice(5);
    return new Pickup('points', { sprite: name.startsWith('item_') ? name : `item_${name}` });
  }
  const w = allWeapons().find((x) => x.letter === s || x.id === s);
  if (w && w.id !== 'pistol') return new Pickup('weapon', { weapon: w.id });
  // Unknown weapon letter (content not loaded yet): fall back to HMG.
  if (s.length === 1) return new Pickup('weapon', { weapon: 'hmg' });
  console.warn(`[pickup] unknown spec "${spec}"`);
  return null;
}

/** Drop a pickup that pops up out of (x, y) and bounces. */
export function dropPickup(world: World, x: number, y: number, spec: string, vx = 0): Pickup | null {
  const p = makePickup(world, spec);
  if (!p) return null;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = -170;
  world.add(p);
  return p;
}

registerEntity(
  'pickup',
  'pickup',
  (w, s) => makePickup(w, String(s.props?.item ?? 'random')) ?? new Pickup('points'),
  'Item on the ground. props.item = spec string (H, bomb, firebomb, points:500, item:pineapple, life, fuel, random...)',
);
