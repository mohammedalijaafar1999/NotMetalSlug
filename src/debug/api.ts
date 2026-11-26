// window.__game: debug/test API used by automated playtests (Playwright) and for manual debugging.
// URL params: ?mission=N ?level=id ?autoplay=1 ?invincible=1 ?seed=N ?speed=N ?fast=1 ?2p=1
//             ?chars=dex,juno ?hitboxes=1 ?mute=1 ?difficulty=0..2

import { app } from '../app';
import { input, type ActionMask } from '../engine/input';
import { audio } from '../engine/audio';
import { sprites } from '../engine/sprites';
import { GameplayScene } from '../scenes/gameplay';
import { GameSession } from '../game/session';
import { flow } from '../scenes/flow';
import { entityTypes } from '../game/registry';
import { allLevels } from '../game/level';
import { allWeapons } from '../game/weapons';
import type { Difficulty } from '../engine/storage';

export const errors: string[] = [];

function gameplay(): GameplayScene | null {
  const s = app.scenes.stack.find((x) => x instanceof GameplayScene);
  return (s as GameplayScene) ?? null;
}

export function startMission(n: number, opts: { chars?: string[]; twoPlayer?: boolean; levelId?: string; difficulty?: Difficulty } = {}): void {
  const s = new GameSession({
    characters: [opts.chars?.[0] ?? 'dex', opts.chars?.[1] ?? 'juno'],
    mission: n,
    twoPlayer: !!opts.twoPlayer,
    difficulty: opts.difficulty,
  });
  if (opts.levelId) app.scenes.set(new GameplayScene(s, opts.levelId), { fade: false });
  else app.scenes.set(new GameplayScene(s), { fade: false });
}

export function installDebugApi(): void {
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    errors.push(args.map((a) => (a instanceof Error ? a.stack || a.message : String(a))).join(' '));
    origError(...args);
  };
  window.addEventListener('error', (e) => errors.push(`${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => errors.push(`unhandled rejection: ${String((e as PromiseRejectionEvent).reason)}`));

  const api = {
    app,
    errors,
    get scene(): string {
      return app.scenes.current?.name ?? '';
    },
    sceneStack(): string[] {
      return app.scenes.stack.map((s) => s.name ?? '?');
    },
    startMission,
    world() {
      return gameplay()?.world ?? null;
    },
    gameplay,
    /** Compact state snapshot for tests. */
    state() {
      const g = gameplay();
      if (!g) return { scene: app.scenes.current?.name ?? '' };
      const w = g.world;
      return {
        scene: app.scenes.current?.name ?? '',
        mission: g.def.mission,
        level: g.def.id,
        phase: g.phase,
        worldState: w.state,
        time: w.time,
        camX: Math.round(w.camera.x),
        camY: Math.round(w.camera.y),
        levelW: g.def.width,
        locked: w.level.locked,
        locks: w.level.lockStates(),
        boss: w.boss ? { name: w.bossName, hp: w.boss.hp, maxHp: w.boss.maxHp } : null,
        entities: w.entities.length,
        enemies: w.entities.filter((e) => e.team === 'enemy' && e.hittable).length,
        stats: { ...w.stats },
        players: w.players.map((p) => ({
          index: p.index,
          state: p.state,
          x: Math.round(p.x),
          y: Math.round(p.y),
          lives: p.profile.lives,
          score: p.profile.score,
          weapon: p.weapon.id,
          ammo: isFinite(p.ammo) ? p.ammo : -1,
          bombs: p.bombs,
          vehicle: p.vehicle?.type ?? null,
        })),
      };
    },
    setInput(i: number, mask: ActionMask | null) {
      input.setVirtual(i, mask);
    },
    /** Run n simulation steps synchronously (works while the RAF loop is paused with manual=true). */
    step(n = 1) {
      for (let i = 0; i < n; i++) app.loop.stepOnce();
    },
    manual(on: boolean) {
      app.loop.manual = on;
    },
    speed(k: number) {
      app.loop.speed = Math.max(1, Math.floor(k));
    },
    invincible(on = true) {
      app.debug.invincible = on;
      const w = gameplay()?.world;
      if (w) for (const p of w.players) p.godMode = on;
    },
    autopilot(on = true) {
      app.debug.autopilot = on;
      gameplay()?.enableAutopilot(on);
    },
    hitboxes(on = true) {
      app.debug.showHitboxes = on;
    },
    warp(x: number) {
      const w = gameplay()?.world;
      if (!w) return;
      w.level.warp(x);
      for (const p of w.players) {
        const t = p.vehicle ?? p;
        t.x = x + 60;
        t.y = w.camera.y + 20;
        t.vy = 0;
        (t as any).onGround = false;
      }
    },
    give(weaponId: string) {
      const w = gameplay()?.world;
      if (w) for (const p of w.players) p.giveWeapon(weaponId);
    },
    spawn(type: string, x?: number, y?: number, props: Record<string, any> = {}) {
      const w = gameplay()?.world;
      if (!w) return null;
      const e = w.spawn(type, x ?? w.camera.x + 300, y, props);
      return e ? { id: e.id, type: e.type } : null;
    },
    killEnemies() {
      const w = gameplay()?.world;
      if (!w) return;
      for (const e of w.entities) if (e.team === 'enemy' && e.hittable) e.damage({ amount: 9999, kind: 'explosion', owner: w.players[0] ?? null });
    },
    entityTypes: () => entityTypes().map((t) => ({ type: t.type, category: t.category })),
    levels: () => allLevels().map((l) => ({ id: l.id, mission: l.mission, name: l.name, width: l.width })),
    weapons: () => allWeapons().map((w) => w.id),
    sprites: () => sprites.names(),
    sfx: () => audio.sfxNames(),
    songs: () => audio.songNames(),
    flow,
  };
  (window as any).__game = api;
}

/** Apply URL debug params after boot. Returns true if it started something. */
export function applyUrlParams(): boolean {
  const q = app.params;
  if (q.get('invincible') === '1') app.debug.invincible = true;
  if (q.get('autoplay') === '1') app.debug.autopilot = true;
  if (q.get('hitboxes') === '1') app.debug.showHitboxes = true;
  if (q.get('fast') === '1') app.debug.fast = true;
  if (q.has('seed')) app.debug.seed = parseInt(q.get('seed')!, 10) || 1;
  if (q.has('speed')) app.loop.speed = Math.max(1, parseInt(q.get('speed')!, 10) || 1);
  if (q.get('mute') === '1') audio.setMuted(true);
  const chars = q.get('chars')?.split(',');
  const diff = q.has('difficulty') ? (Math.max(0, Math.min(2, parseInt(q.get('difficulty')!, 10))) as Difficulty) : undefined;
  let started = false;
  if (q.has('level')) {
    startMission(0, { levelId: q.get('level')!, chars, twoPlayer: q.get('2p') === '1', difficulty: diff });
    started = true;
  } else if (q.has('mission')) {
    startMission(parseInt(q.get('mission')!, 10) || 1, { chars, twoPlayer: q.get('2p') === '1', difficulty: diff });
    started = true;
  }
  if (started) {
    const w = gameplay()?.world;
    if (q.has('give') && w) setTimeout(() => w.players.forEach((p) => p.giveWeapon(q.get('give')!)), 600);
    // ?spawn=type@xOffset[@y],type2@xOffset  (x relative to camera left; y absolute, default floor)
    if (q.has('spawn') && w) {
      for (const part of q.get('spawn')!.split(',')) {
        const [type, xo, y] = part.split('@');
        w.spawn(type, w.camera.x + (parseFloat(xo) || 260), y !== undefined ? parseFloat(y) : undefined);
      }
    }
    if (q.has('warp') && w) (window as any).__game.warp(parseFloat(q.get('warp')!));
  }
  return started;
}
