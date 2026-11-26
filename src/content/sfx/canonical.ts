// The canonical audio contract (docs/DESIGN.md "Audio contract"). Code may only use these names;
// tests check every one is defined.

export const SFX_CATEGORIES = {
  weapons: ['pistol', 'hmg', 'rocket_fire', 'shotgun', 'flame', 'laser', 'homing_fire', 'bouncer_fire', 'bouncer_bounce', 'knife', 'throw', 'firebomb_burst', 'out_of_ammo', 'grenade_bounce', 'shell_casing'],
  player: ['jump', 'land', 'player_die', 'respawn'],
  explosive: ['explosion_small', 'explosion', 'explosion_big', 'fire_burst'],
  pickups: ['pickup', 'pickup_weapon', 'pickup_points', 'extra_life', 'rescue', 'coin', 'fuel'],
  enemies: [
    'enemy_die',
    'enemy_die2',
    'enemy_rifle',
    'enemy_alert',
    'enemy_throw',
    'enemy_rocket',
    'enemy_flame',
    'mortar_fire',
    'mortar_whistle',
    'sniper_charge',
    'sniper_shot',
    'saber_swing',
    'whistle',
    'robot_shot',
    'robot_die',
    'jetpack',
    'parachute',
    'harpoon',
    'splash',
  ],
  machines: ['tank_cannon', 'tank_tread', 'heli_rotor', 'heli_gun', 'turret_fire', 'drone_buzz', 'jet_flyby', 'metal_hit', 'ricochet', 'mine_beep', 'crate_break', 'glass_break', 'engine'],
  vehicles: ['vehicle_enter', 'vehicle_exit', 'vehicle_hit', 'vehicle_cannon', 'vehicle_vulcan', 'mech_step', 'mech_missile', 'gyro_rotor', 'alarm'],
  boss: ['boss_roar', 'boss_die', 'warning', 'boss_charge', 'boss_laser', 'boss_hit'],
  ui: ['menu_move', 'menu_select', 'menu_back', 'pause', 'tally_bonus', 'tally_tick', 'banner', 'start_game', 'typewriter', 'countdown_tick'],
} as const;

export type SfxName = (typeof SFX_CATEGORIES)[keyof typeof SFX_CATEGORIES][number];

export const SFX_NAMES: readonly SfxName[] = Object.values(SFX_CATEGORIES).flat();

export const SONG_NAMES = [
  'title',
  'select',
  'briefing',
  'm1',
  'm2',
  'm3',
  'm4',
  'm5',
  'm6',
  'boss',
  'boss_final',
  'mission_complete',
  'tally',
  'gameover',
  'ending',
  'credits',
] as const;

export type SongName = (typeof SONG_NAMES)[number];

/** Songs that play once (jingles); every other song loops. */
export const JINGLES: readonly SongName[] = ['mission_complete', 'gameover'];
