// Player weapons. Each weapon is data + a fire() function that spawns projectiles.
// Weapons are picked up from crates (letter shown on the crate) and revert to the pistol
// when ammo runs out. Register new ones with registerWeapon() (see src/content/weapons/).

import { drawGunAt, gunSpec, PLAYER_GUNS, type GunKind } from '../art/humanoid';
import { sprites } from '../engine/sprites';
import { fxRng } from '../engine/rng';
import type { PlayOpts } from '../engine/audio';
import { Bullet } from './projectile';
import type { Player } from './player';
import type { World } from './world';

/**
 * Canonical SFX names (docs/DESIGN.md) used by the player and weapon content. Playing them
 * through wsfx() catches typos at compile time; tests/weapons.test.ts checks the list against
 * the design document.
 */
export const WEAPON_SFX = [
  'pistol',
  'hmg',
  'rocket_fire',
  'shotgun',
  'flame',
  'laser',
  'homing_fire',
  'bouncer_fire',
  'bouncer_bounce',
  'knife',
  'throw',
  'firebomb_burst',
  'out_of_ammo',
  'grenade_bounce',
  'shell_casing',
  'jump',
  'land',
  'player_die',
  'respawn',
  'explosion_small',
  'explosion',
  'explosion_big',
  'fire_burst',
  'metal_hit',
  'ricochet',
] as const;
export type WeaponSfx = (typeof WEAPON_SFX)[number];

/** Play a canonical weapon/player sound (positional). */
export function wsfx(world: World, name: WeaponSfx, x?: number, opts: PlayOpts = {}): void {
  world.sfx(name, x, opts);
}

/** Spent casing ejected per shot (cosmetic particles). */
export type CasingKind = 'small' | 'brass' | 'shell' | 'big';

export interface WeaponDef {
  id: string;
  /** Display name, also announced by voice. */
  name: string;
  /** Letter printed on the pickup crate. */
  letter: string;
  /** Ammo granted per pickup (Infinity for the pistol). */
  ammo: number;
  /** Hold fire for continuous shooting. */
  auto: boolean;
  /** Seconds between shots. */
  cooldown: number;
  /** Upper-body sprite set used while holding it (must exist for every character). */
  gun: GunKind;
  /** HUD / crate color. */
  color: string;
  /** Ammo consumed per shot. */
  ammoPerShot?: number;
  /** Counts as "heavy" for character perks (+ammo). */
  heavy: boolean;
  /** Spawn projectiles. (x, y) = muzzle in world space, angle = world-space aim angle. */
  fire(p: Player, x: number, y: number, angle: number): void;
  /** Sound played per shot. */
  sfx: string;
  /** Play the shot sound at most this often (s) - continuous weapons. */
  sfxInterval?: number;
  /** Show the standard muzzle flash. */
  flash?: boolean;
  /** Muzzle flash sprite (default 'muzzle_flash'). Drawn rotated to the aim, following the shooter. */
  muzzle?: string;
  /** Screen shake magnitude per shot (heavy recoil). */
  recoil?: number;
  /** Spent casing ejected per shot. */
  casing?: CasingKind;
  /** Aim rotation speed while the trigger is held (rad/s). Lower = bullets fan through the diagonals. Default 15. */
  sweep?: number;
  /** Auto weapons: a tap fires at least this many shots (burst). */
  burst?: number;
}

const weapons = new Map<string, WeaponDef>();

export function registerWeapon(w: WeaponDef): void {
  weapons.set(w.id, w);
}

export function getWeapon(id: string): WeaponDef {
  return weapons.get(id) ?? weapons.get('pistol')!;
}

export function hasWeapon(id: string): boolean {
  return weapons.has(id);
}

export function allWeapons(): WeaponDef[] {
  return [...weapons.values()];
}

// ------------------------------------------------------------------ shared cosmetic helpers

const CASING_COLORS: Record<CasingKind, [string, string]> = {
  small: ['#e8c050', '#a07820'],
  brass: ['#f0c848', '#b08020'],
  shell: ['#d83a2a', '#e8c050'],
  big: ['#c8a040', '#806020'],
};

/** Eject a spent casing from (x, y): flies up and backwards, tumbles and bounces on the ground. */
export function ejectCasing(world: World, x: number, y: number, facing: number, kind: CasingKind): void {
  const [c1] = CASING_COLORS[kind];
  const big = kind === 'shell' || kind === 'big';
  world.particles.add({
    kind: 'debris',
    x,
    y,
    vx: -facing * fxRng.range(35, 80),
    vy: -fxRng.range(90, 150),
    life: fxRng.range(0.7, 1.0),
    color: c1,
    size: big ? 1.5 : 1,
    size2: big ? 1.5 : 1,
    gravity: 620,
    bounce: 0.4,
    rot: fxRng.range(0, 6),
    vr: fxRng.range(-20, 20),
  });
}

// ------------------------------------------------------------------ shared sprites

// Weapon icons `gun_<kind>` (dropped empty guns, HUD/menus): the same art the characters hold.
for (const g of PLAYER_GUNS) {
  sprites.define({
    name: `gun_${g}`,
    w: 26,
    h: 12,
    ox: 13,
    oy: 6,
    draw: (p) => {
      const s = gunSpec(g)!;
      drawGunAt(p, g, 13 - (s.back + s.front) / 2, 5.5, 0);
    },
  });
}

// Knife hit: a bright diagonal slash with a sparkle.
sprites.define({
  name: 'knife_slash',
  w: 18,
  h: 18,
  ox: 9,
  oy: 9,
  frames: 4,
  outline: null,
  draw: (p, f) => {
    const k = [0.55, 1, 0.9, 0.6][f];
    const x0 = 9 - 7 * k;
    const y0 = 9 - 7 * k;
    const x1 = 9 + 7 * k;
    const y1 = 9 + 7 * k;
    if (f < 3) {
      p.capsule(x0, y0, x1, y1, f === 1 ? 1.6 : 1, '#8ad8ff');
      p.capsule(x0 + 1, y0 + 1, x1 - 1, y1 - 1, f === 1 ? 0.8 : 0.5, '#ffffff');
    }
    if (f >= 1) {
      const r = [0, 3, 4.5, 3][f];
      p.line(9 - r, 9, 9 + r, 9, '#ffffff');
      p.line(9, 9 - r, 9, 9 + r, '#ffffff');
      if (f === 3) p.dither(5, 5, 8, 8, '#d8f4ff', 0);
    }
  },
});

// ------------------------------------------------------------------ bullet sprites

sprites.define({
  name: 'bullet_hmg',
  w: 11,
  h: 3,
  ox: 6,
  oy: 1,
  outline: null,
  draw: (p) => {
    p.rect(0, 1, 3, 1, '#c86a18');
    p.rect(2, 0, 9, 3, '#ffa020');
    p.rect(4, 1, 7, 1, '#fff2a0');
    p.px(10, 1, '#ffffff');
  },
});

sprites.define({
  name: 'muzzle_pistol',
  w: 9,
  h: 7,
  ox: 0,
  oy: 3,
  frames: 2,
  outline: null,
  draw: (p, f) => {
    if (f === 0) {
      p.poly([0, 3.5, 4, 0.5, 8.5, 3.5, 4, 6.5], '#ffcf3c');
      p.poly([1, 3.5, 4, 2, 6.5, 3.5, 4, 5], '#ffffff');
    } else {
      p.poly([0, 3.5, 3, 1.5, 5.5, 3.5, 3, 5.5], '#ff9a2e');
      p.circle(2.5, 3.5, 1.3, '#fff6a0');
    }
  },
});

sprites.define({
  name: 'muzzle_hmg',
  w: 14,
  h: 11,
  ox: 0,
  oy: 5,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    // Three-pronged star flash that alternates shape so rapid fire flickers.
    const L = [13, 10, 7][f];
    const W = [4.5, 3.5, 2.5][f];
    p.poly([0, 5.5, L * 0.45, 5.5 - W, L, 5.5, L * 0.45, 5.5 + W], f === 2 ? '#ff8a20' : '#ffc030');
    p.poly([1, 5.5, L * 0.4, 5.5 - W * 0.55, L * 0.8, 5.5, L * 0.4, 5.5 + W * 0.55], '#fff3a0');
    if (f === 0) {
      p.line(3, 1, 6, 4, '#ffd040');
      p.line(3, 10, 6, 7, '#ffd040');
    }
    p.circle(1.5, 5.5, 1.5, '#ffffff');
  },
});

// ------------------------------------------------------------------ core weapons

registerWeapon({
  id: 'pistol',
  name: 'PISTOL',
  letter: 'P',
  ammo: Infinity,
  auto: false,
  cooldown: 0.11,
  gun: 'pistol',
  color: '#c0c0c0',
  heavy: false,
  sfx: 'pistol',
  flash: true,
  muzzle: 'muzzle_pistol',
  casing: 'small',
  fire(p, x, y, a) {
    p.world.add(new Bullet(p, x, y, a, 420, 1));
  },
});

registerWeapon({
  id: 'hmg',
  name: 'HEAVY MACHINE GUN',
  letter: 'H',
  ammo: 200,
  auto: true,
  cooldown: 0.065,
  gun: 'heavy',
  color: '#ffcf3a',
  heavy: true,
  sfx: 'hmg',
  flash: true,
  muzzle: 'muzzle_hmg',
  casing: 'brass',
  sweep: 5,
  burst: 4,
  fire(p, x, y, a) {
    const spread = (p.world.rng.next() - 0.5) * 0.07;
    const off = (p.shotCounter % 2 === 0 ? -1 : 1) * 1.5;
    const b = p.world.add(new Bullet(p, x - Math.sin(a) * off, y + Math.cos(a) * off, a + spread, 480, 1));
    b.spriteName = 'bullet_hmg';
  },
});
