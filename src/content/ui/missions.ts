// Mission presentation data for the briefing card, mission select and tally. Real LevelDefs
// (registered by the mission modules) override name/subtitle/briefing/bossName when present.

import { levelForMission, type LevelDef } from '../../game/level';

export interface MissionInfo {
  mission: number;
  name: string;
  subtitle: string;
  briefing: string;
  boss: string;
  /** Accent color for cards. */
  color: string;
  /** Sky/ground colors for the little preview illustration. */
  sky: [string, string];
  ground: string;
  /** One-line teaser for mission select. */
  teaser: string;
}

export const MISSION_COUNT = 6;

export const MISSIONS: MissionInfo[] = [
  {
    mission: 1,
    name: 'PALM HARBOR',
    subtitle: 'OPERATION BEACHHEAD',
    briefing:
      'THE RUSTCOAT LEGION HAS STORMED PALM HARBOR AND ROUNDED UP THE ISLAND MECHANICS. HIT THE BEACH, PUSH THROUGH THE JUNGLE VILLAGE AND FREE EVERY HOSTAGE YOU FIND. A MINI-TANK IS PARKED IN THE VILLAGE DEPOT. BORROW IT.',
    boss: 'GRINDER',
    color: '#4fc85a',
    sky: ['#3a8ad8', '#bfe6ff'],
    ground: '#3a7a2e',
    teaser: 'BEACH AND JUNGLE VILLAGE',
  },
  {
    mission: 2,
    name: 'DUSTWIND CANYON',
    subtitle: 'OPERATION SANDSTORM',
    briefing:
      'LEGION CONVOYS ARE HAULING STOLEN MACHINERY THROUGH DUSTWIND CANYON. AMBUSH THE TRUCKS, WATCH THE RUINS FOR BAZOOKA NESTS AND BRING DOWN THE GUNSHIP GUARDING THE OIL DERRICKS.',
    boss: 'HORNET KING',
    color: '#e8a040',
    sky: ['#d8783a', '#ffd890'],
    ground: '#a8703a',
    teaser: 'DESERT RUINS AND DERRICKS',
  },
  {
    mission: 3,
    name: 'FROSTBITE PASS',
    subtitle: 'OPERATION COLD SNAP',
    briefing:
      'THE ONLY ROAD NORTH CLIMBS FROSTBITE PASS. RIDE THE CABLE CARS, CROSS THE FROZEN LAKE AND CRACK THE FROST BASTION, A FORTRESS WALL BRISTLING WITH CANNONS. A STRIDER WALKER IS WAITING UP THERE.',
    boss: 'FROST BASTION',
    color: '#9ad8ff',
    sky: ['#5a7aa8', '#d8e8f8'],
    ground: '#e8f0f8',
    teaser: 'SNOWY PEAKS AND CABLE CARS',
  },
  {
    mission: 4,
    name: 'RUSTWATER DOCKS',
    subtitle: 'OPERATION LOW TIDE',
    briefing:
      'RUSTWATER HARBOR IS CRAWLING WITH FROGMEN AND GUNBOATS. FIGHT THROUGH THE FLOODED STREETS AT DUSK AND SINK THE LEVIATHAN SUBMARINE BEFORE IT SLIPS OUT OF PORT.',
    boss: 'LEVIATHAN',
    color: '#ff8a5a',
    sky: ['#4a2a5a', '#e8784a'],
    ground: '#5a5a6a',
    teaser: 'RAINY HARBOR AT DUSK',
  },
  {
    mission: 5,
    name: 'STORMFRONT',
    subtitle: 'OPERATION THUNDER ROAD',
    briefing:
      'MARSHAL GRISTLE IS HIDING HIS FLAGSHIP ABOVE THE STORM CLOUDS. TAKE THE DRAGONFLY GYROCOPTER, PUNCH THROUGH THE ESCORT FIGHTERS AND GUT THE THUNDERHEAD FROM THE INSIDE OUT.',
    boss: 'THUNDERHEAD',
    color: '#c8a8ff',
    sky: ['#2a3a6a', '#8aa0d0'],
    ground: '#c8d0e0',
    teaser: 'SKY BATTLE ABOVE THE CLOUDS',
  },
  {
    mission: 6,
    name: 'IRON CITADEL',
    subtitle: 'OPERATION IRON FIST',
    briefing:
      'THIS IS IT: THE IRON CITADEL, GRISTLE\'S FORTRESS-FACTORY. SMASH THE FURNACES, FREE THE LAST CAPTIVES AND STOP THE JUGGERNAUT WALKER BEFORE IT TAKES ITS FIRST STEP. GOOD LUCK, RUCKUS SQUAD.',
    boss: 'JUGGERNAUT',
    color: '#ff4a3a',
    sky: ['#2a0a1a', '#a83a2a'],
    ground: '#3a2a2a',
    teaser: 'THE LEGION FORTRESS-FACTORY',
  },
];

/** Presentation info for mission n, merged with its registered LevelDef (if any). */
export function missionInfo(n: number): MissionInfo & { level?: LevelDef } {
  const base = MISSIONS[Math.max(0, Math.min(MISSION_COUNT - 1, n - 1))];
  const lvl = n >= 1 ? levelForMission(n) : undefined;
  const info: MissionInfo & { level?: LevelDef } = { ...base, mission: n };
  if (n < 1 || n > MISSION_COUNT) {
    info.name = 'PROVING GROUNDS';
    info.subtitle = 'TRAINING EXERCISE';
    info.briefing = 'LIVE-FIRE TRAINING. SHOOT EVERYTHING THAT SHOOTS BACK AND FREE THE VOLUNTEER HOSTAGE.';
    info.boss = 'NONE';
    info.teaser = 'TEST RANGE';
  }
  if (lvl) {
    info.level = lvl;
    if (lvl.name) info.name = lvl.name.toUpperCase();
    if (lvl.subtitle) info.subtitle = lvl.subtitle.toUpperCase();
    if (lvl.briefing) info.briefing = lvl.briefing.toUpperCase();
    if (lvl.bossName) info.boss = lvl.bossName.toUpperCase();
  }
  return info;
}

/** Count hostages placed in a level (one-off spawns + arena waves). */
export function countHostages(def: LevelDef | undefined): number {
  if (!def) return 0;
  let n = 0;
  for (const s of def.entities ?? []) if (s.type === 'hostage') n++;
  for (const l of def.locks ?? []) for (const w of l.waves) for (const s of w.spawns) if (s.type === 'hostage') n++;
  return n;
}
