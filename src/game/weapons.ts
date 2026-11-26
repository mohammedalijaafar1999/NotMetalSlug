// Player weapons. Each weapon is data + a fire() function that spawns projectiles.
// Weapons are picked up from crates (letter shown on the crate) and revert to the pistol
// when ammo runs out. Register new ones with registerWeapon().

import type { GunKind } from '../art/humanoid';
import { Bullet } from './projectile';
import type { Player } from './player';

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
  /** Show the standard muzzle flash. */
  flash?: boolean;
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
  cooldown: 0.07,
  gun: 'heavy',
  color: '#ffcf3a',
  heavy: true,
  sfx: 'hmg',
  flash: true,
  fire(p, x, y, a) {
    const spread = (p.world.rng.next() - 0.5) * 0.07;
    const off = (p.shotCounter % 2 === 0 ? -1 : 1) * 1.5;
    p.world.add(new Bullet(p, x - Math.sin(a) * off, y + Math.cos(a) * off, a + spread, 470, 1));
  },
});
