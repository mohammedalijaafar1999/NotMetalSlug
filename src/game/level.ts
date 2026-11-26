// Level definitions (pure data) and the runtime that drives spawns, camera locks (arenas),
// checkpoints, the mission timer and terrain/background rendering via the level's theme.

import { VIEW_W } from '../engine/renderer';
import type { SpawnSpec } from './registry';
import type { World } from './world';
import type { Entity } from './entity';
import { getTheme, ThemeRenderer } from './theme';

/** Missions register their LevelDef with registerLevel(). */
export interface LevelDef {
  id: string;
  /** Mission number 1..6 (0 = test/sandbox). */
  mission: number;
  name: string;
  subtitle?: string;
  /** Briefing text shown before the mission. */
  briefing?: string;
  /** Registered theme id. */
  theme: string;
  /** Song names. */
  music: string;
  bossMusic?: string;
  /** Level size in px. height >= 216. */
  width: number;
  height: number;
  /** Player spawn (feet). If y omitted: top floor at x. */
  start: { x: number; y?: number };
  /** Ground polylines [[x,y],...] with ascending x. Equal x on consecutive points = vertical cliff. Gaps = pits. */
  ground: Array<Array<[number, number]>>;
  /** One-way platforms. y2 makes a sloped platform (y at x, y2 at x+w). */
  platforms?: PlatformDef[];
  /** Static solid blocks (walls, buildings you can stand on). */
  solids?: SolidDef[];
  water?: WaterDef[];
  /** Camera vertical bounds keys: [cameraLeftX, minTopY, maxTopY]. Default: bottom of level. */
  camera?: Array<[number, number, number]>;
  /** Sections where the camera scrolls by itself. */
  autoScroll?: Array<{ x1: number; x2: number; speed: number }>;
  /** Camera-left x positions that act as checkpoints (timer reset, respawn). */
  checkpoints?: number[];
  /** One-off spawns triggered by camera progress. */
  entities?: SpawnSpec[];
  /** Camera-lock arenas. */
  locks?: LockDef[];
  /** Theme-rendered scenery. */
  decor?: DecorDef[];
  /** Seconds per checkpoint segment on the HUD timer (default 99 "units"). */
  timeLimit?: number;
  /** Name shown on the boss health bar. */
  bossName?: string;
  /** Players start inside this vehicle type (e.g. 'gyrocopter'). */
  startVehicle?: string;
  /** Completing: reaching this camera-left x completes the mission (if no boss). */
  endX?: number;
}

export interface PlatformDef {
  x: number;
  y: number;
  w: number;
  /** End height for sloped platforms (default = y). */
  y2?: number;
  style?: string;
}

export interface SolidDef {
  x: number;
  y: number;
  w: number;
  h: number;
  style?: string;
}

export interface WaterDef {
  x: number;
  y: number;
  w: number;
  h: number;
  deadly?: boolean;
}

export interface WaveDef {
  spawns: SpawnSpec[];
  /** Seconds to wait after the previous wave is cleared (default 0.5). */
  delay?: number;
}

export interface LockDef {
  /** Camera-left x the camera locks at. */
  x: number;
  /** Camera-left x that engages the lock (default = x). */
  trigger?: number;
  waves: WaveDef[];
  /** Boss arena: the mission completes when the boss dies (boss entity calls level.bossDefeated()). */
  boss?: boolean;
  /** Switch to this song when the lock engages. */
  music?: string;
  /** Big banner text when engaged (e.g. 'WARNING!'). */
  announce?: string;
}

export interface DecorDef {
  /** Theme decor kind, e.g. 'palm', 'hut', 'sign'. */
  kind: string;
  x: number;
  /** Usually the ground y the decor stands on. */
  y: number;
  layer?: 'back' | 'front';
  props?: Record<string, any>;
}

const levels = new Map<string, LevelDef>();

export function registerLevel(def: LevelDef): void {
  levels.set(def.id, def);
}

export function getLevel(id: string): LevelDef | undefined {
  return levels.get(id);
}

/** Level for mission n (1..6). */
export function levelForMission(n: number): LevelDef | undefined {
  return [...levels.values()].find((l) => l.mission === n);
}

export function allLevels(): LevelDef[] {
  return [...levels.values()].sort((a, b) => a.mission - b.mission);
}

interface LockState {
  def: LockDef;
  index: number;
  state: 'idle' | 'active' | 'done';
  wave: number;
  timer: number;
  tracked: Entity[];
}

export class LevelRuntime {
  readonly def: LevelDef;
  readonly world: World;
  readonly theme: ThemeRenderer;
  private pendingSpawns: SpawnSpec[];
  private locks: LockState[];
  activeLock: LockState | null = null;
  checkpointX = 0;
  private nextCheckpoint = 0;
  private checkpoints: number[];
  /** HUD timer (counts down; 0 = time over). */
  timeLeft: number;
  readonly timeLimit: number;
  /** Seconds per timer unit. */
  readonly timeUnit = 1.2;
  private timeAcc = 0;
  /** Show the "GO →" prompt for this many seconds. */
  goTimer = 0;
  bossDefeatedFlag = false;
  timerEnabled = true;
  /** Called when the timer hits zero (scene kills players). */
  onTimeUp: (() => void) | null = null;

  constructor(world: World, def: LevelDef) {
    this.world = world;
    this.def = def;
    this.theme = new ThemeRenderer(getTheme(def.theme), def, world.terrain);
    this.pendingSpawns = (def.entities ?? []).slice().sort((a, b) => trig(a) - trig(b));
    this.locks = (def.locks ?? []).map((l, i) => ({ def: l, index: i, state: 'idle', wave: -1, timer: 0, tracked: [] }));
    this.checkpoints = (def.checkpoints ?? []).slice().sort((a, b) => a - b);
    this.timeLimit = def.timeLimit ?? 99;
    this.timeLeft = this.timeLimit;
    buildTerrain(world, def);
    world.camera.setLevel(
      def.width,
      def.height,
      (def.camera ?? []).map(([x, minY, maxY]) => ({ x, minY, maxY })),
      def.autoScroll ?? [],
    );
  }

  get locked(): boolean {
    return this.activeLock !== null;
  }

  get bossActive(): boolean {
    return !!this.activeLock?.def.boss;
  }

  resetTimer(): void {
    this.timeLeft = this.timeLimit;
    this.timeAcc = 0;
  }

  private spawnSpec(s: SpawnSpec, waveId = -1): Entity | null {
    const e = this.world.spawn(s.type, s.x, s.y, s.props ?? {});
    if (e) e.waveId = waveId;
    return e;
  }

  update(dt: number): void {
    const cam = this.world.camera;
    const right = cam.x + VIEW_W;
    // One-off spawns.
    while (this.pendingSpawns.length && trig(this.pendingSpawns[0]) <= right) {
      this.spawnSpec(this.pendingSpawns.shift()!);
    }
    // Checkpoints.
    while (this.nextCheckpoint < this.checkpoints.length && cam.x >= this.checkpoints[this.nextCheckpoint]) {
      this.checkpointX = this.checkpoints[this.nextCheckpoint++];
      this.resetTimer();
      this.world.emit({ type: 'checkpoint', x: this.checkpointX });
    }
    // Locks.
    if (!this.activeLock) {
      const l = this.locks.find((s) => s.state === 'idle' && cam.x >= (s.def.trigger ?? s.def.x) - 0.5);
      if (l) this.engage(l);
    }
    const a = this.activeLock;
    if (a) {
      const waveCleared = a.tracked.every((e) => e.dead || !e.blocksProgress);
      if (waveCleared) {
        if (a.wave + 1 < a.def.waves.length) {
          a.timer -= dt;
          if (a.timer <= 0) {
            a.wave++;
            a.tracked = [];
            for (const s of a.def.waves[a.wave].spawns) {
              const e = this.spawnSpec(s, a.index * 100 + a.wave);
              if (e) a.tracked.push(e);
            }
            const next = a.def.waves[a.wave + 1];
            a.timer = next?.delay ?? 0.5;
          }
        } else if (!a.def.boss) {
          this.release(a);
        }
      }
    }
    // End of level without boss.
    if (this.def.endX !== undefined && cam.x >= this.def.endX && !this.bossDefeatedFlag) this.bossDefeated();
    // Timer.
    if (this.goTimer > 0) this.goTimer -= dt;
    if (this.timerEnabled && this.world.state === 'play' && this.world.activePlayers().length > 0) {
      this.timeAcc += dt;
      while (this.timeAcc >= this.timeUnit) {
        this.timeAcc -= this.timeUnit;
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        if (this.timeLeft === 0) {
          this.onTimeUp?.();
          this.resetTimer();
        }
      }
    }
  }

  private engage(l: LockState): void {
    l.state = 'active';
    l.wave = -1;
    l.tracked = [];
    l.timer = l.def.waves[0]?.delay ?? 0.6;
    this.activeLock = l;
    this.world.camera.lockX = l.def.x;
    this.resetTimer();
    this.world.emit({ type: 'lock', x: l.def.x });
    if (l.def.announce) this.world.announce(l.def.announce, { color: '#ff4040', time: 2.2 });
    if (l.def.music) this.musicRequest = l.def.music;
  }

  /** Song the gameplay scene should switch to (consumed by the scene). */
  musicRequest: string | null = null;

  private release(l: LockState): void {
    l.state = 'done';
    this.activeLock = null;
    this.world.camera.lockX = null;
    this.goTimer = 3;
    this.resetTimer();
    this.world.emit({ type: 'unlock' });
  }

  /** Called by the boss when its death sequence finishes (or reaching endX). */
  bossDefeated(): void {
    if (this.bossDefeatedFlag) return;
    this.bossDefeatedFlag = true;
    if (this.activeLock) {
      this.activeLock.state = 'done';
      this.activeLock = null;
    }
    this.world.state = 'complete';
    this.world.emit({ type: 'missionComplete' });
  }

  /** Debug: warp the camera to x (skips intermediate spawns/locks). */
  warp(x: number): void {
    const cam = this.world.camera;
    cam.lockX = null;
    this.activeLock = null;
    for (const l of this.locks) if ((l.def.trigger ?? l.def.x) < x - 1) l.state = 'done';
    this.pendingSpawns = this.pendingSpawns.filter((s) => trig(s) > x + VIEW_W);
    cam.x = x;
    cam.minX = x;
  }

  /** Remaining lock definitions (debug / tests). */
  lockStates(): { x: number; state: string; boss: boolean }[] {
    return this.locks.map((l) => ({ x: l.def.x, state: l.state, boss: !!l.def.boss }));
  }

  // ---- rendering (delegated to theme)
  renderBackground(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    this.theme.renderBackground(g, cx, cy, this.world.time);
  }
  renderTerrain(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    this.theme.renderTerrain(g, cx, cy, this.world.time);
  }
  renderFront(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    this.theme.renderFront(g, cx, cy, this.world.time);
  }
  renderOverlay(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    this.theme.renderOverlay(g, cx, cy, this.world.time);
  }
}

function trig(s: SpawnSpec): number {
  return s.trigger ?? s.x - 8;
}

/** Build terrain geometry from a level definition. */
export function buildTerrain(world: World, def: LevelDef): void {
  const T = world.terrain;
  for (const line of def.ground) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x1, y1] = line[i];
      const [x2, y2] = line[i + 1];
      if (x2 === x1) continue; // vertical cliff: handled as ground mass
      T.addSurface(x1, y1, x2, y2, { ground: true, oneWay: false, material: 'ground' });
    }
  }
  for (const p of def.platforms ?? []) {
    T.addSurface(p.x, p.y, p.x + p.w, p.y2 ?? p.y, { oneWay: true, material: p.style ?? 'platform' });
  }
  for (const s of def.solids ?? []) {
    T.addSolid(s.x, s.y, s.w, s.h, { material: s.style ?? 'solid' });
  }
  for (const w of def.water ?? []) T.addWater(w.x, w.y, w.w, w.h, !!w.deadly);
}
