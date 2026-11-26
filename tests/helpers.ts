// Test helpers: headless worlds and mission simulation (no DOM, no audio).
import '../src/content/index';
import { World } from '../src/game/world';
import { LevelRuntime, getLevel, type LevelDef } from '../src/game/level';
import { GameSession } from '../src/game/session';
import { Player } from '../src/game/player';
import { input } from '../src/engine/input';
import { Bot } from '../src/debug/bot';
import type { Vehicle } from '../src/game/vehicle';

export const DT = 1 / 60;

export function makeWorld(def: LevelDef | string, opts: { seed?: number; players?: number; god?: boolean; difficulty?: 0 | 1 | 2 } = {}): World {
  const d = typeof def === 'string' ? getLevel(def)! : def;
  if (!d) throw new Error('no level ' + def);
  const session = new GameSession({ characters: ['dex', 'juno'], twoPlayer: (opts.players ?? 1) > 1, mission: d.mission, difficulty: opts.difficulty ?? 1 });
  const w = new World(d.width, d.height, session, opts.seed ?? 1);
  w.silent = true;
  w.level = new LevelRuntime(w, d);
  w.level.timerEnabled = false;
  const sy = d.start.y ?? w.terrain.topFloorAt(d.start.x) ?? d.height - 40;
  w.camera.snapTo(d.start.x, sy);
  for (const prof of session.players) {
    if (!prof.joined) continue;
    const p = new Player(prof);
    p.x = d.start.x + prof.index * 20;
    p.y = w.camera.y - 8;
    p.godMode = opts.god ?? true;
    w.add(p);
    w.players.push(p);
    if (d.startVehicle) {
      const v = w.spawn(d.startVehicle, p.x, p.y + 40) as Vehicle | null;
      if (v && (v as any).isVehicle) {
        p.state = 'play';
        p.hittable = true;
        v.enter(p);
      }
    }
  }
  return w;
}

export function step(w: World, n = 1, bots: Bot[] = []): void {
  for (let i = 0; i < n; i++) {
    for (const b of bots) b.update(w);
    input.poll(DT);
    w.update(DT);
  }
}

export interface SimResult {
  completed: boolean;
  seconds: number;
  camX: number;
  maxCamX: number;
  kills: number;
  rescues: number;
  stuckAt: number | null;
  locks: { x: number; state: string; boss: boolean }[];
  deaths: number;
}

/** Run a mission with autopilot (invincible) until complete or timeout. */
export function simulateMission(levelId: string, maxSeconds = 600, seed = 1): SimResult {
  const w = makeWorld(levelId, { seed, god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  let deaths = 0;
  w.on('playerDied', () => deaths++);
  let maxCam = 0;
  let lastProgressT = 0;
  let lastCam = -1;
  const steps = Math.round(maxSeconds / DT);
  let i = 0;
  for (; i < steps && w.state !== 'complete'; i++) {
    step(w, 1, bots);
    if (w.camera.x > lastCam + 1) {
      lastCam = w.camera.x;
      lastProgressT = i * DT;
    }
    maxCam = Math.max(maxCam, w.camera.x);
  }
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
  const secs = i * DT;
  return {
    completed: w.state === 'complete',
    seconds: Math.round(secs),
    camX: Math.round(w.camera.x),
    maxCamX: Math.round(maxCam),
    kills: w.stats.kills,
    rescues: w.stats.rescues,
    stuckAt: w.state === 'complete' ? null : Math.round(lastProgressT),
    locks: w.level.lockStates(),
    deaths,
  };
}
