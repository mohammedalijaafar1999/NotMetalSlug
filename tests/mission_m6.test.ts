// Mission 6 - IRON CITADEL: level contract (structure, boss arena to the boss's spec), the mission
// mechanics (conveyors, presses + scrap presses, molten channels, the ladle, the reactor lift), the
// invincible autopilot finishing the mission, and mission complete -> tally -> ending.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeWorld, step, simulateMission, DT } from './helpers';
import { getLevel, type LevelDef } from '../src/game/level';
import { getEntityType } from '../src/game/registry';
import { getTheme } from '../src/game/theme';
import { VIEW_W } from '../src/engine/renderer';
import { input } from '../src/engine/input';
import { Bot } from '../src/debug/bot';
import type { World } from '../src/game/world';
import type { Player } from '../src/game/player';
import type { Vehicle } from '../src/game/vehicle';
import { Conveyor } from '../src/content/levels/m6/conveyor';
import { Crusher } from '../src/content/levels/m6/crusher';
import { MoltenPool } from '../src/content/levels/m6/molten';
import { Ladle, MoltenGlob } from '../src/content/levels/m6/ladle';
import { Lift } from '../src/content/levels/m6/lift';
import { BOSS_LOCK, GU, M6_W } from '../src/content/levels/m6';
import { app } from '../src/app';
import { SceneManager } from '../src/engine/scene';
import { flow } from '../src/scenes/flow';
import { installUiFlow } from '../src/scenes/install';
import { GameSession } from '../src/game/session';

const L = getLevel('m6')!;

/** A flat test bench in the m6 theme (floor y 180), optional pit and shaft. */
function bench(extra: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'm6_bench',
    mission: 0,
    name: 'BENCH',
    theme: 'm6',
    music: 'm6',
    width: 1600,
    height: 216,
    start: { x: 60 },
    ground: [
      [
        [0, 180],
        [1600, 180],
      ],
    ],
    ...extra,
  };
}

/** World with one mortal player standing at x (no respawn invulnerability). */
function benchWorld(def: LevelDef, x = 100): { w: World; p: Player } {
  const w = makeWorld(def, { god: false });
  step(w, 90);
  const p = w.players[0];
  p.x = x;
  p.invuln = 0;
  return { w, p };
}

function release(): void {
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
}

describe('mission 6 level', () => {
  it('is registered with its theme, music, boss and briefing', () => {
    expect(L).toBeTruthy();
    expect(L.mission).toBe(6);
    expect(L.theme).toBe('m6');
    expect(getTheme('m6').id).toBe('m6');
    expect(L.music).toBe('m6');
    expect(L.bossMusic).toBe('boss_final');
    expect(L.bossName).toBe('JUGGERNAUT');
    expect(L.name).toBe('IRON CITADEL');
    expect(L.briefing && L.briefing.length).toBeGreaterThan(80);
    expect(L.briefing).toBe(L.briefing!.toUpperCase());
    expect(L.width).toBeGreaterThanOrEqual(4500);
    expect(L.width).toBeLessThanOrEqual(8000);
    expect(L.timeLimit).toBeGreaterThanOrEqual(60);
    expect(L.timeLimit).toBeLessThanOrEqual(99);
  });

  it('follows the mission structure (hostages, crates, locks, checkpoints, vehicle)', () => {
    const specs = [...(L.entities ?? []), ...(L.locks ?? []).flatMap((l) => l.waves.flatMap((w) => w.spawns))];
    const hostages = specs.filter((s) => s.type === 'hostage');
    expect(hostages.length).toBeGreaterThanOrEqual(9);
    expect(hostages.length).toBeLessThanOrEqual(12);
    // hostages hand out the good weapons
    const drops = hostages.map((h) => h.props?.drop);
    for (const wpn of ['H', 'R', 'S', 'F', 'L', 'C']) expect(drops, wpn).toContain(wpn);
    // weapon crates in the open, bomb crates before arenas
    expect(specs.filter((s) => s.type === 'crate_prop' && /^[HRSFLCB]$/.test(s.props?.drop ?? '')).length).toBeGreaterThanOrEqual(2);
    const bombs = specs.filter((s) => s.type === 'pickup' && s.props?.item === 'bomb').map((s) => s.x);
    const locks = L.locks ?? [];
    const arenas = locks.filter((l) => !l.boss);
    expect(arenas.length).toBeGreaterThanOrEqual(3);
    expect(arenas.length).toBeLessThanOrEqual(6);
    for (const l of arenas) {
      expect(l.waves.length).toBeGreaterThanOrEqual(2);
      expect(bombs.some((x) => x < l.x + VIEW_W && x > l.x - 900), `bomb before lock ${l.x}`).toBe(true);
    }
    // a gauntlet with 4 waves
    expect(Math.max(...arenas.map((l) => l.waves.length))).toBeGreaterThanOrEqual(4);
    // checkpoints at least every ~1200 px
    const cps = [0, ...(L.checkpoints ?? []), BOSS_LOCK];
    for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1], `checkpoint gap at ${cps[i]}`).toBeLessThanOrEqual(1250);
    // the vehicle beat, the signature enemy, the mechanics
    expect(specs.some((s) => s.type === 'mech')).toBe(true);
    expect(specs.filter((s) => s.type === 'robot').length).toBeGreaterThanOrEqual(15);
    for (const t of ['m6_conveyor', 'm6_crusher', 'm6_molten', 'm6_ladle', 'm6_lift']) expect(specs.some((s) => s.type === t), t).toBe(true);
    // every decor kind has a renderer in the theme
    const decor = getTheme('m6').decor ?? {};
    for (const d of L.decor ?? []) expect(decor[d.kind], `decor ${d.kind}`).toBeTruthy();
    // molten channels are deadly water and pits narrow enough to jump
    expect((L.water ?? []).every((wt) => wt.deadly)).toBe(true);
    for (let i = 1; i < L.ground.length; i++) {
      const gap = L.ground[i][0][0] - L.ground[i - 1][L.ground[i - 1].length - 1][0];
      expect(gap, 'pit width').toBeLessThanOrEqual(130);
    }
  });

  it('builds the boss arena exactly to the JUGGERNAUT spec', () => {
    const boss = (L.locks ?? []).find((l) => l.boss)!;
    expect(boss.x).toBe(BOSS_LOCK);
    expect(L.width).toBe(BOSS_LOCK + VIEW_W);
    expect(M6_W).toBe(L.width);
    expect(boss.announce).toBeUndefined();
    expect(boss.waves.length).toBe(1);
    expect(boss.waves[0].spawns).toEqual([{ type: 'boss_m6', x: BOSS_LOCK + 290 }]);
    expect(getEntityType('boss_m6')?.category).toBe('boss');
    const w = makeWorld('m6');
    const T = w.terrain;
    for (let x = BOSS_LOCK - 40; x <= BOSS_LOCK + VIEW_W; x += 2) expect(T.groundTopAt(x), `floor at ${x}`).toBe(GU);
    // nothing else in the arena: no platforms, solids or water
    const inArena = (x0: number, x1: number) => x1 > BOSS_LOCK && x0 < BOSS_LOCK + VIEW_W;
    for (const p of L.platforms ?? []) expect(inArena(p.x, p.x + p.w), `platform at ${p.x}`).toBe(false);
    for (const s of L.solids ?? []) expect(inArena(s.x, s.x + s.w), `solid at ${s.x}`).toBe(false);
    for (const wt of L.water ?? []) expect(inArena(wt.x, wt.x + wt.w), `water at ${wt.x}`).toBe(false);
    // camera pinned to the top there: floor at screen y 198 (>= 196, below the HUD boss bar)
    const b = w.camera.boundsAt(BOSS_LOCK);
    expect(b.minY).toBe(0);
    expect(b.maxY).toBe(0);
    expect(GU - b.minY).toBeGreaterThanOrEqual(196);
  });
});

describe('mission 6 mechanics', () => {
  it('conveyors carry whatever stands on them and stop at walls', () => {
    const { w, p } = benchWorld(bench({ solids: [{ x: 520, y: 150, w: 30, h: 30 }] }), 380);
    const c = w.spawn('m6_conveyor', 450, 180, { w: 200, speed: 40 }) as Conveyor;
    const crate = w.spawn('crate_prop', 420, undefined)!;
    step(w, 30);
    const px0 = p.x;
    const cx0 = crate.x;
    step(w, 60);
    expect(c.speed).toBe(40);
    expect(p.x - px0).toBeGreaterThan(30);
    expect(p.x - px0).toBeLessThan(50);
    expect(crate.x - cx0).toBeGreaterThan(30);
    // ...until the wall stops them
    step(w, 60 * 6);
    expect(crate.x + crate.w / 2).toBeLessThanOrEqual(520.5);
    expect(crate.x + crate.w / 2).toBeGreaterThan(505);
    expect(p.x + p.w / 2).toBeLessThanOrEqual(520.5);
    // a belt running left carries them back
    c.speed = -40;
    const back = p.x;
    step(w, 60);
    expect(back - p.x).toBeGreaterThan(30);
  });

  it('presses telegraph for >= 0.7 s, then crush anyone under them (soldiers too)', () => {
    const { w, p } = benchWorld(bench(), 600);
    const cr = w.spawn('m6_crusher', 600, 180, { cycle: 3.4 }) as Crusher;
    const robot = w.spawn('robot', 612, undefined, { behavior: 'sleep' })!;
    let warnT = 0;
    let sawWarn = false;
    for (let i = 0; i < 60 * 4 && cr.state !== 'slam'; i++) {
      step(w, 1);
      p.x = 600;
      p.invuln = 0;
      if (cr.state === 'warn') {
        sawWarn = true;
        warnT += DT;
      }
      expect(p.state === 'play' || p.state === 'respawn', 'safe while the head is up').toBe(true);
    }
    expect(sawWarn).toBe(true);
    expect(warnT).toBeGreaterThanOrEqual(0.7);
    step(w, 20);
    expect(p.state).toBe('dying');
    expect(robot.hp <= 0 || robot.dead).toBe(true);
    // a player beside the press is never touched
    const { w: w2, p: p2 } = benchWorld(bench(), 640);
    w2.spawn('m6_crusher', 600, 180, { cycle: 3.4 });
    for (let i = 0; i < 60 * 8; i++) {
      step(w2, 1);
      p2.x = 640;
      p2.invuln = 0;
    }
    expect(p2.state).toBe('play');
  });

  it('the scrap press wrecks a vehicle that rolls under it and throws the pilot clear', () => {
    const { w, p } = benchWorld(bench(), 400);
    const mech = w.spawn('mech', 400, undefined) as unknown as Vehicle;
    step(w, 10);
    mech.enter(p);
    const cr = w.spawn('m6_crusher', 500, 180, { scrap: true }) as Crusher;
    step(w, 10);
    let wrecked = false;
    for (let i = 0; i < 60 * 6 && !wrecked; i++) {
      input.setVirtual(0, { right: (mech.x ?? 0) < 500 });
      step(w, 1);
      wrecked = (mech as any).destroyed === true;
    }
    release();
    expect(cr.scrap).toBe(true);
    expect(wrecked).toBe(true);
    step(w, 30);
    expect(p.vehicle).toBeNull();
    expect(p.state === 'play' || p.state === 'respawn').toBe(true);
  });

  it('molten channels burn players and soldiers that fall in', () => {
    const def = bench({
      ground: [
        [
          [0, 180],
          [400, 180],
        ],
        [
          [428, 180],
          [1600, 180],
        ],
      ],
      water: [{ x: 400, y: 192, w: 28, h: 24, deadly: true }],
    });
    const { w, p } = benchWorld(def, 360);
    const pool = w.spawn('m6_molten', 414, 192, { w: 28, floor: 180 }) as MoltenPool;
    step(w, 1);
    expect(pool.floorY).toBe(180);
    // a soldier walked into the channel
    const r = w.spawn('rifleman', 414, 150, { behavior: 'idle' })!;
    step(w, 40);
    expect(r.hp <= 0 || r.dead).toBe(true);
    // the player steps in
    p.x = 414;
    p.y = 170;
    p.invuln = 0;
    let died = false;
    for (let i = 0; i < 60 && !died; i++) {
      step(w, 1);
      died = p.state === 'dying';
    }
    expect(died).toBe(true);
  });

  it('the ladle tips (telegraph) before every pour; the stream and its splashes burn', () => {
    const { w, p } = benchWorld(bench(), 700);
    const la = w.spawn('m6_ladle', 500, 180, { cycle: 4.2, splash: 2 }) as Ladle;
    let tiltT = 0;
    for (let i = 0; i < 60 * 6 && la.state !== 'pour'; i++) {
      step(w, 1);
      if (la.state === 'tilt') tiltT += DT;
    }
    expect(la.state).toBe('pour');
    expect(tiltT).toBeGreaterThanOrEqual(0.85);
    expect(w.entities.some((e) => e instanceof MoltenGlob)).toBe(true);
    p.x = 500;
    p.invuln = 0;
    step(w, 6);
    expect(p.state).toBe('dying');
  });

  it('the reactor lift carries players up to the hangar floor', () => {
    const def = bench({
      ground: [
        [
          [0, 180],
          [396, 180],
          [396, 60],
          [1600, 60],
        ],
      ],
    });
    const w = makeWorld(def, { god: true });
    step(w, 60);
    const lift = w.spawn('m6_lift', 350, 180, { top: 60, speed: 46 }) as Lift;
    step(w, 2);
    const p = w.players[0];
    p.x = 350;
    p.y = 180;
    step(w, 60 * 5);
    expect(lift.state).toBe('top');
    expect(Math.abs(p.y - 60)).toBeLessThan(3);
    // walk off onto the upper floor
    input.setVirtual(0, { right: true });
    step(w, 60);
    release();
    expect(p.x).toBeGreaterThan(400);
    expect(p.y).toBe(60);
  });
});

describe('mission 6 playthrough', () => {
  it('the invincible autopilot completes the mission', () => {
    const r = simulateMission('m6', 900);
    if (!r.completed) console.log('m6', JSON.stringify(r));
    expect(r.completed).toBe(true);
    expect(r.rescues).toBeGreaterThanOrEqual(8);
  }, 300_000);

  it('two autopilots complete it on hard with another seed', () => {
    const w = makeWorld('m6', { seed: 7, god: true, players: 2, difficulty: 2 });
    const bots = w.players.map((pl) => new Bot(pl.index));
    for (let i = 0; i < 900 / DT && w.state !== 'complete'; i++) step(w, 1, bots);
    release();
    expect(w.state).toBe('complete');
  }, 300_000);
});

// ------------------------------------------------------------------ mission complete -> tally -> ending

function fakeCtx(): any {
  const store: Record<string | symbol, any> = { globalAlpha: 1 };
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createImageData') return (w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (k === 'createPattern') return () => ({});
      if (k === 'measureText') return () => ({ width: 0 });
      return () => undefined;
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
}

describe('mission 6 ending', () => {
  const g = fakeCtx() as CanvasRenderingContext2D;
  const hadDocument = 'document' in globalThis;
  beforeAll(() => {
    if (!hadDocument) (globalThis as any).document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => fakeCtx() }), getElementById: () => null };
    app.scenes = new SceneManager();
    app.scenes.onChange = () => input.flush();
    installUiFlow();
  });
  afterAll(() => {
    if (!hadDocument) delete (globalThis as any).document;
    release();
  });
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      input.poll(DT);
      app.scenes.update(DT);
      if (i % 4 === 0) app.scenes.render(g);
    }
  };
  const fire = () => {
    input.setVirtual(0, null);
    input.poll(DT);
    input.setVirtual(0, { fire: true });
    input.poll(DT);
    app.scenes.update(DT);
    input.setVirtual(0, null);
    input.poll(DT);
    app.scenes.update(DT);
  };

  it('clearing the Iron Citadel goes mission complete -> tally -> ending', () => {
    const s = new GameSession({ characters: ['dex', 'juno'], twoPlayer: false, mission: 6 });
    flow.missionComplete(s, { mission: 6, kills: 120, rescues: 10, time: 400, shotsFired: 3000, playerRescues: [10], levelId: 'm6' });
    run(0.6);
    expect(app.scenes.current?.name).toBe('tally');
    run(1.5);
    fire(); // skip the count-up
    fire(); // continue
    for (let i = 0; i < 20 && app.scenes.current?.name === 'tally'; i++) {
      run(0.5);
      fire();
    }
    run(0.8);
    expect(app.scenes.current?.name).toBe('ending');
  });
});
