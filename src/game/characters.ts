// Playable characters (the Ruckus Squad). Each has a look (humanoid style) and a small perk.
// Sprite sets are named `char_<id>` (player 1 colors) and `char_<id>_p2` (player 2 colors).

import { defineHumanoidSet, type HumanoidStyle } from '../art/humanoid';

export interface CharacterDef {
  id: string;
  /** Short display name (HUD). */
  name: string;
  full: string;
  bio: string;
  perk: string;
  perkDesc: string;
  /** HUD accent color. */
  color: string;
  style: HumanoidStyle;
  /** Overrides applied for the player-2 palette. */
  p2: Partial<HumanoidStyle>;
  runMul: number;
  jumpMul: number;
  pistolCooldownMul: number;
  bombs: number;
  heavyAmmoMul: number;
  grenadeRadiusMul: number;
  meleeMul: number;
}

const chars = new Map<string, CharacterDef>();

export function registerCharacter(c: CharacterDef): void {
  chars.set(c.id, c);
  defineHumanoidSet(`char_${c.id}`, c.style, ['pistol', 'heavy', 'rocket', 'shotgun', 'flamer']);
  defineHumanoidSet(`char_${c.id}_p2`, { ...c.style, ...c.p2 }, ['pistol', 'heavy', 'rocket', 'shotgun', 'flamer']);
}

export function getCharacter(id: string): CharacterDef {
  return chars.get(id) ?? chars.values().next().value!;
}

export function characters(): CharacterDef[] {
  return [...chars.values()];
}

registerCharacter({
  id: 'dex',
  name: 'DEX',
  full: 'DEX CALLOWAY',
  bio: 'Squad leader. Never misses a briefing, rarely misses a shot.',
  perk: 'STEADY HAND',
  perkDesc: 'Pistol fires 35% faster',
  color: '#ff6a3a',
  style: {
    skin: '#f0b48a',
    hair: '#4a2e1c',
    hairStyle: 'spiky',
    shirt: '#3a62b0',
    pants: '#b89a68',
    boots: '#4a3424',
    belt: '#2e2018',
    vest: '#5a6a3a',
    headgear: 'bandana',
    headgearColor: '#d8402a',
    headgearAccent: '#a82a1a',
    sleeves: 'short',
    gloves: '#3a2a20',
  },
  p2: { shirt: '#8a3ab0', headgearColor: '#2ab0d8', headgearAccent: '#1a80a8' },
  runMul: 1,
  jumpMul: 1,
  pistolCooldownMul: 0.65,
  bombs: 10,
  heavyAmmoMul: 1,
  grenadeRadiusMul: 1,
  meleeMul: 1,
});

registerCharacter({
  id: 'juno',
  name: 'JUNO',
  full: 'JUNO VEGA',
  bio: 'Demolitions expert. Believes every problem has an explosive solution.',
  perk: 'DEMOLITIONS',
  perkDesc: '+5 bombs, bigger blasts',
  color: '#ff4f9a',
  style: {
    skin: '#d89a70',
    hair: '#1e1418',
    hairStyle: 'ponytail',
    shirt: '#4f7a3a',
    pants: '#6a6a4a',
    boots: '#2e2a26',
    belt: '#3a2a1a',
    strap: '#7a5a2a',
    headgear: 'beret',
    headgearColor: '#8a1e32',
    headgearAccent: '#e0c040',
    sleeves: 'short',
    sunglasses: true,
  },
  p2: { shirt: '#2a6a8a', headgearColor: '#1e3a8a' },
  runMul: 1,
  jumpMul: 1,
  pistolCooldownMul: 1,
  bombs: 15,
  heavyAmmoMul: 1,
  grenadeRadiusMul: 1.3,
  meleeMul: 1,
});

registerCharacter({
  id: 'brick',
  name: 'BRICK',
  full: 'BRUNO "BRICK" OKAFOR',
  bio: 'Heavy weapons specialist. Carries extra ammo the way others carry snacks.',
  perk: 'HEAVY LIFTER',
  perkDesc: '+50% heavy weapon ammo',
  color: '#ffb02a',
  style: {
    skin: '#8a5a3a',
    hair: '#1a1210',
    hairStyle: 'bald',
    beard: '#1a1210',
    shirt: '#5a5a62',
    pants: '#3a3e4a',
    boots: '#22201e',
    belt: '#2a1e14',
    vest: '#d07a2a',
    headgear: 'goggles',
    headgearColor: '#3a3430',
    sleeves: 'short',
    build: 1.18,
  },
  p2: { vest: '#2a9ad0', shirt: '#3a5a4a' },
  runMul: 0.95,
  jumpMul: 0.97,
  pistolCooldownMul: 1,
  bombs: 10,
  heavyAmmoMul: 1.5,
  grenadeRadiusMul: 1,
  meleeMul: 1.5,
});

registerCharacter({
  id: 'mika',
  name: 'MIKA',
  full: 'MIKA SATO',
  bio: 'Scout and close-quarters ace. First in, last out, never out of breath.',
  perk: 'QUICK FEET',
  perkDesc: 'Faster run, higher jump, deadly knife',
  color: '#3ad0a0',
  style: {
    skin: '#f2c8a0',
    hair: '#2a1e2e',
    hairStyle: 'bob',
    shirt: '#2a8a8a',
    pants: '#5a5a6a',
    boots: '#2a2a32',
    belt: '#20202a',
    headgear: 'cap',
    headgearColor: '#e8e4da',
    headgearAccent: '#2a8a8a',
    sleeves: 'long',
    scarf: '#d83a3a',
  },
  p2: { shirt: '#8a6a2a', scarf: '#3a6ad8', headgearAccent: '#8a6a2a' },
  runMul: 1.12,
  jumpMul: 1.06,
  pistolCooldownMul: 1,
  bombs: 10,
  heavyAmmoMul: 1,
  grenadeRadiusMul: 1,
  meleeMul: 2,
});
