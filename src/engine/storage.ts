// Persistent settings, high scores and progress (localStorage, failure-tolerant).

import { DEFAULT_BINDINGS, type Bindings } from './input';

const KEY_SETTINGS = 'ironruckus.settings.v1';
const KEY_SCORES = 'ironruckus.scores.v1';
const KEY_PROGRESS = 'ironruckus.progress.v1';

export type Difficulty = 0 | 1 | 2; // easy, normal, hard

export interface Settings {
  masterVol: number;
  musicVol: number;
  sfxVol: number;
  voiceVol: number;
  voice: boolean;
  difficulty: Difficulty;
  lives: number;
  timer: boolean;
  shake: boolean;
  crt: boolean;
  pixelPerfect: boolean;
  showFps: boolean;
  /** Blood-free "classic" flashes are always on; this toggles big screen flashes. */
  flashes: boolean;
  bindings: { p1: Bindings; p2: Bindings };
}

export const DEFAULT_SETTINGS: Settings = {
  masterVol: 0.8,
  musicVol: 0.55,
  sfxVol: 0.8,
  voiceVol: 0.9,
  voice: true,
  difficulty: 1,
  lives: 3,
  timer: true,
  shake: true,
  crt: false,
  pixelPerfect: false,
  showFps: false,
  flashes: true,
  bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)),
};

export interface HighScore {
  name: string;
  score: number;
  /** Highest mission reached (1-6, 7 = game cleared). */
  mission: number;
  character: string;
  date: string;
}

export interface Progress {
  /** Highest mission number unlocked for Mission Select (1..6). */
  unlocked: number;
  /** Has the player beaten the game? */
  cleared: boolean;
  /** Total stats. */
  totalKills: number;
  totalRescues: number;
  plays: number;
}

const DEFAULT_PROGRESS: Progress = { unlocked: 1, cleared: false, totalKills: 0, totalRescues: 0, plays: 0 };

const DEFAULT_SCORES: HighScore[] = [
  { name: 'ACE', score: 300000, mission: 6, character: 'dex', date: '' },
  { name: 'RUK', score: 250000, mission: 5, character: 'juno', date: '' },
  { name: 'GUN', score: 200000, mission: 5, character: 'brick', date: '' },
  { name: 'BOB', score: 150000, mission: 4, character: 'mika', date: '' },
  { name: 'ZAP', score: 120000, mission: 4, character: 'dex', date: '' },
  { name: 'KAT', score: 90000, mission: 3, character: 'juno', date: '' },
  { name: 'MAX', score: 70000, mission: 3, character: 'brick', date: '' },
  { name: 'JET', score: 50000, mission: 2, character: 'mika', date: '' },
  { name: 'DOC', score: 30000, mission: 2, character: 'dex', date: '' },
  { name: 'NUB', score: 10000, mission: 1, character: 'juno', date: '' },
];

function load<T>(key: string, def: T): T {
  try {
    if (typeof localStorage === 'undefined') return structuredClone(def);
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(def);
    const parsed = JSON.parse(raw);
    if (Array.isArray(def)) return (Array.isArray(parsed) ? parsed : structuredClone(def)) as T;
    return deepMerge(structuredClone(def), parsed);
  } catch {
    return structuredClone(def);
  }
}

function save(key: string, v: unknown): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full / blocked: ignore */
  }
}

function deepMerge<T>(base: T, over: any): T {
  if (over === null || typeof over !== 'object') return base;
  for (const k of Object.keys(base as any)) {
    const bv = (base as any)[k];
    const ov = over[k];
    if (ov === undefined) continue;
    if (bv && typeof bv === 'object' && !Array.isArray(bv)) (base as any)[k] = deepMerge(bv, ov);
    else if (Array.isArray(bv)) (base as any)[k] = Array.isArray(ov) ? ov : bv;
    else if (typeof ov === typeof bv) (base as any)[k] = ov;
  }
  return base;
}

export const settings: Settings = load(KEY_SETTINGS, DEFAULT_SETTINGS);

export function saveSettings(): void {
  save(KEY_SETTINGS, settings);
}

export function resetSettings(): void {
  const keep = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as Settings;
  Object.assign(settings, keep);
  saveSettings();
}

let scores: HighScore[] = load(KEY_SCORES, DEFAULT_SCORES);

export function getHighScores(): HighScore[] {
  return scores.slice().sort((a, b) => b.score - a.score).slice(0, 10);
}

export function qualifiesForHighScore(score: number): boolean {
  const list = getHighScores();
  return score > 0 && (list.length < 10 || score > list[list.length - 1].score);
}

/** Insert a score; returns its rank (0-based) or -1 if it didn't place. */
export function addHighScore(h: HighScore): number {
  scores.push(h);
  scores = scores.sort((a, b) => b.score - a.score).slice(0, 10);
  save(KEY_SCORES, scores);
  return scores.indexOf(h);
}

export function resetHighScores(): void {
  scores = structuredClone(DEFAULT_SCORES);
  save(KEY_SCORES, scores);
}

export const progress: Progress = load(KEY_PROGRESS, DEFAULT_PROGRESS);

export function saveProgress(): void {
  save(KEY_PROGRESS, progress);
}

export function unlockMission(n: number): void {
  if (n > progress.unlocked) {
    progress.unlocked = Math.min(6, n);
    saveProgress();
  }
}
