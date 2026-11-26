// Shared gameplay constants and small types.

export const GRAVITY = 900; // px/s^2
export const MAX_FALL = 430; // px/s

/** Render layers (higher draws later). */
export const Z = {
  BACK_PROP: 5,
  PROP: 10,
  HOSTAGE: 20,
  PICKUP: 25,
  ENEMY: 30,
  VEHICLE: 40,
  PLAYER: 50,
  BOSS: 28,
  PROJECTILE: 60,
  EXPLOSION: 70,
  FX: 75,
  FRONT: 90,
} as const;

export type Team = 'player' | 'enemy' | 'neutral';

export type DamageKind = 'bullet' | 'explosion' | 'fire' | 'melee' | 'laser' | 'crush' | 'electric';

export interface Damage {
  amount: number;
  kind: DamageKind;
  /** The entity that ultimately caused it (player, vehicle, enemy). Used for scoring. */
  owner?: import('./entity').Entity | null;
  /** Point of impact (world). */
  x?: number;
  y?: number;
  /** Horizontal direction of the hit (-1/1), for knockback/death animations. */
  dir?: number;
}

export interface DifficultyParams {
  /** Multiplies enemy fire cooldowns (higher = slower fire). */
  enemyFireDelay: number;
  /** Multiplies enemy projectile speeds. */
  enemyShotSpeed: number;
  /** Multiplies enemy & boss HP. */
  enemyHp: number;
  /** Chance multiplier that an enemy decides to attack when able. */
  aggression: number;
  /** Score multiplier. */
  score: number;
}

export const DIFFICULTY: DifficultyParams[] = [
  { enemyFireDelay: 1.45, enemyShotSpeed: 0.8, enemyHp: 0.8, aggression: 0.7, score: 0.8 },
  { enemyFireDelay: 1.0, enemyShotSpeed: 1.0, enemyHp: 1.0, aggression: 1.0, score: 1.0 },
  { enemyFireDelay: 0.72, enemyShotSpeed: 1.18, enemyHp: 1.3, aggression: 1.3, score: 1.5 },
];

export const DIFFICULTY_NAMES = ['EASY', 'NORMAL', 'HARD'];
