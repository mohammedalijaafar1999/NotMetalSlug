// Mission 1 - PALM HARBOR: the level is valid and built to the docs and the boss notes, the
// invincible autopilot completes it, and the mission mechanics work (the river ford mud ends the
// BULLDOG beat, the stockade gate bursts when the GRINDER drives in, solids can be walked off).
import { describe, expect, it } from 'vitest';
import { makeWorld, simulateMission, step } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import { VIEW_H, VIEW_W } from '../src/engine/renderer';
import { wrapText } from '../src/engine/font';
import { getLevel, type LevelDef } from '../src/game/level';
import { getTheme } from '../src/game/theme';
import { getEntityType } from '../src/game/registry';
import type { World } from '../src/game/world';
import type { Entity } from '../src/game/entity';
import { M1 } from '../src/content/themes/m1/layout';
import { ARENAS } from '../src/content/levels/m1/encounters';
import { BOG_TIME, RiverBog } from '../src/content/levels/m1/bog';
import { StockadeGate } from '../src/content/levels/m1/gate';
import { Grinder } from '../src/content/bosses/boss_m1';

const def = (): LevelDef => getLevel('m1')!;

function stepUntil(w: World, pred: () => boolean, maxSeconds: number, bots: Bot[] = []): boolean {
  for (let i = 0; i < maxSeconds * 60; i++) {
    if (pred()) return true;
    step(w, 1, bots);
  }
  return pred();
}

function allSpawns(L: LevelDef) {
  return [...(L.entities ?? []), ...(L.locks ?? []).flatMap((l) => l.waves.flatMap((wv) => wv.spawns))];
}

describe('mission m1 - level data', () => {
  it('is registered with its theme, music, boss and briefing', () => {
    const L = def();
    expect(L).toBeTruthy();
    expect(L.mission).toBe(1);
    expect(L.name).toBe('PALM HARBOR');
    expect(L.theme).toBe('m1');
    expect(L.music).toBe('m1');
    expect(L.bossMusic).toBe('boss');
    expect(L.bossName).toBe('GRINDER');
    expect(L.width).toBeGreaterThanOrEqual(4500);
    expect(L.width).toBeLessThanOrEqual(8000);
    expect(L.timeLimit).toBeGreaterThanOrEqual(60);
    expect(L.timeLimit).toBeLessThanOrEqual(99);
    expect(L.briefing).toBe(L.briefing!.toUpperCase());
    expect(wrapText(L.briefing!, 178).length).toBeLessThanOrEqual(11);
  });

  it('has checkpoints at least every ~1200 px and 3-6 arenas of 2-4 waves', () => {
    const L = def();
    const cps = [0, ...(L.checkpoints ?? [])];
    for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1]).toBeLessThanOrEqual(1200);
    expect(M1.bossL - cps[cps.length - 1]).toBeLessThanOrEqual(1200);
    const arenas = (L.locks ?? []).filter((l) => !l.boss);
    expect(arenas.length).toBeGreaterThanOrEqual(3);
    expect(arenas.length).toBeLessThanOrEqual(6);
    for (const a of arenas) {
      expect(a.waves.length).toBeGreaterThanOrEqual(2);
      expect(a.waves.length).toBeLessThanOrEqual(4);
    }
  });

  it('has 8-10 hostages (tied, caged and wandering) and weapon crates in the open', () => {
    const specs = allSpawns(def());
    const hostages = specs.filter((s) => s.type === 'hostage');
    expect(hostages.length).toBeGreaterThanOrEqual(8);
    expect(hostages.length).toBeLessThanOrEqual(10);
    const modes = new Set(hostages.map((h) => h.props?.mode ?? 'tied'));
    expect([...modes].sort()).toEqual(['caged', 'tied', 'wander']);
    // An H early on, and the good weapons come from hostages.
    const firstH = hostages.find((h) => h.props?.drop === 'H')!;
    expect(firstH.x).toBeLessThan(600);
    const weaponPickups = specs.filter((s) => s.type === 'pickup' && /^[HRSFLCB]$/.test(s.props?.item));
    expect(weaponPickups.length).toBeGreaterThanOrEqual(2);
  });

  it('parks the BULLDOG 35-45% into the level and keeps machine counts tutorial-sized', () => {
    const L = def();
    const specs = allSpawns(L);
    const tank = specs.filter((s) => s.type === 'tank');
    expect(tank.length).toBe(1);
    expect(tank[0].x / L.width).toBeGreaterThanOrEqual(0.35);
    expect(tank[0].x / L.width).toBeLessThanOrEqual(0.45);
    const count = (t: string) => specs.filter((s) => s.type === t).length;
    expect(count('light_tank')).toBeLessThanOrEqual(2);
    for (const s of specs.filter((x) => x.type === 'light_tank')) expect(s.x).toBeGreaterThan(tank[0].x);
    expect(count('mortar')).toBeLessThanOrEqual(1);
    expect(count('sniper')).toBeLessThanOrEqual(1);
    expect(count('bunker')).toBe(1);
    expect(count('heli')).toBe(1);
    expect(count('jeep')).toBe(1);
    expect(count('truck')).toBe(1);
    // Paratroopers only in one arena.
    const paraLocks = (L.locks ?? []).filter((l) => l.waves.some((wv) => wv.spawns.some((s) => s.type === 'paratrooper')));
    expect(paraLocks.length).toBe(1);
  });

  it('never spawns wave infantry off the left edge of an arena (they would never walk in)', () => {
    for (const l of def().locks ?? []) {
      for (const wv of l.waves) {
        for (const s of wv.spawns) {
          if (getEntityType(s.type)?.category !== 'enemy') continue;
          expect(s.x, `${s.type} in lock ${l.x}`).toBeGreaterThanOrEqual(l.x + 8);
        }
      }
    }
  });

  it('builds the boss arena exactly to the GRINDER notes', () => {
    const L = def();
    const boss = (L.locks ?? []).find((l) => l.boss)!;
    expect(boss.x).toBe(M1.bossL);
    expect(boss.announce).toBeUndefined();
    expect(boss.waves).toEqual([{ spawns: [{ type: 'boss_m1', x: M1.bossL + 282 }] }]);
    expect(L.width).toBeGreaterThanOrEqual(M1.bossL + VIEW_W);
    const w = makeWorld(L);
    const T = w.terrain;
    // Flat, unbroken ground across the arena and out to where the boss drives in from.
    const gy = T.groundTopAt(M1.bossL + 1);
    for (let x = M1.bossL; x <= Math.min(L.width - 1, M1.bossL + 504); x += 2) expect(T.groundTopAt(x)).toBe(gy);
    // Nothing else in the arena: no platforms, solids or water.
    const inArena = (x1: number, x2: number) => x2 > M1.bossL && x1 < M1.bossL + VIEW_W;
    for (const p of L.platforms ?? []) expect(inArena(p.x, p.x + p.w)).toBe(false);
    for (const s of L.solids ?? []) expect(inArena(s.x, s.x + s.w)).toBe(false);
    for (const wt of L.water ?? []) expect(inArena(wt.x, wt.x + wt.w)).toBe(false);
    // No props / hazards / pickups placed inside the arena.
    for (const s of L.entities ?? []) {
      const cat = getEntityType(s.type)?.category;
      if (cat === 'prop' || cat === 'hazard' || cat === 'pickup') expect(inArena(s.x - 20, s.x + 20), `${s.type}@${s.x}`).toBe(false);
    }
    // Camera at the bottom with >= 120 px of sky above the ground line.
    w.level.warp(M1.bossL);
    step(w, 2);
    expect(w.camera.y).toBe(L.height - VIEW_H);
    expect(gy - w.camera.y).toBeGreaterThanOrEqual(120);
  });

  it('uses only decor kinds the m1 theme draws, and the theme is complete', () => {
    const th = getTheme('m1');
    expect(th.id).toBe('m1');
    const kinds = Object.keys(th.decor ?? {});
    expect(kinds.length).toBeGreaterThanOrEqual(6);
    for (const d of def().decor ?? []) expect(kinds, d.kind).toContain(d.kind);
    expect(th.renderBackground).toBeTypeOf('function');
    expect(th.renderOverlay).toBeTypeOf('function');
    expect(th.groundEdge).toBeTypeOf('function');
    expect(th.groundEdgeUp).toBeGreaterThan(0);
    expect(th.solidTile).toBeTypeOf('function');
    expect(th.platform).toBeTypeOf('function');
    expect(th.water).toBeTruthy();
  });

  it('keeps the arenas inside the level and in order', () => {
    const xs = Object.values(ARENAS);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1] + VIEW_W);
    expect(M1.bossL).toBeGreaterThan(xs[xs.length - 1] + VIEW_W + VIEW_W); // >= 1 calm screen
  });
});

describe('mission m1 - mechanics', () => {
  it('the river ford sinks a driven BULLDOG; the pilot is thrown clear and wades on', () => {
    const w = makeWorld('m1', { god: false });
    const p = w.players[0];
    step(w, 30);
    w.level.warp(M1.riverX0 - 360);
    p.x = M1.riverX0 - 250;
    p.y = w.camera.y + 20;
    step(w, 60);
    // Clear the bunker and its troops so only the mud matters.
    for (const e of w.entities) if (e.team === 'enemy') e.remove();
    const tank = w.spawn('tank', p.x + 2) as any;
    step(w, 2);
    tank.enter(p);
    expect(p.vehicle).toBe(tank);
    let entered = -1;
    let i = 0;
    for (; i < 60 * 12 && !tank.destroyed; i++) {
      for (const e of w.entities) if (e.team === 'enemy') e.remove();
      input.setVirtual(0, { right: true });
      step(w, 1);
      if (entered < 0 && tank.inWater) entered = i;
    }
    input.setVirtual(0, null);
    expect(entered).toBeGreaterThan(0);
    expect(tank.destroyed).toBe(true);
    expect((i - entered) / 60).toBeLessThan(BOG_TIME + 0.6);
    expect(tank.x).toBeLessThan(M1.riverX1);
    const bog = w.entities.find((e) => e instanceof RiverBog) as RiverBog | undefined;
    expect(bog).toBeTruthy();
    expect(bog!.wrecked).toBe(1);
    // The pilot survives (thrown clear, invulnerable while the wreck blows up) and can wade across.
    expect(p.vehicle).toBeNull();
    step(w, 120);
    expect(p.state).toBe('play');
    for (let k = 0; k < 60 * 6 && p.x < M1.riverX1 + 40; k++) {
      for (const e of w.entities) if (e.team === 'enemy') e.remove();
      input.setVirtual(0, { right: true, jump: k % 40 < 8 });
      step(w, 1);
    }
    input.setVirtual(0, null);
    expect(p.state).toBe('play');
    expect(p.x).toBeGreaterThan(M1.riverX1 + 20);
  });

  it('soldiers on foot just wade through the ford', () => {
    const w = makeWorld('m1', { god: true });
    const p = w.players[0];
    step(w, 30);
    w.level.warp(M1.riverX0 - 360);
    p.x = M1.riverX0 - 60;
    p.y = w.camera.y + 20;
    let wet = false;
    for (let k = 0; k < 60 * 8 && p.x < M1.riverX1 + 30; k++) {
      for (const e of w.entities) if (e.team === 'enemy') e.remove();
      input.setVirtual(0, { right: true });
      step(w, 1);
      if (p.inWater) wet = true;
    }
    input.setVirtual(0, null);
    expect(wet).toBe(true);
    expect(p.x).toBeGreaterThan(M1.riverX1 + 20);
  });

  it('walking off the basalt outcrop steps down on the far side (no snap back across the box)', () => {
    const w = makeWorld('m1', { god: true });
    const p = w.players[0];
    step(w, 30);
    const s = def().solids![0];
    w.level.warp(s.x - 200);
    p.x = s.x + s.w / 2;
    p.y = s.y;
    p.vy = 0;
    step(w, 2);
    let minX = p.x;
    for (let k = 0; k < 40; k++) {
      for (const e of w.entities) if (e.team === 'enemy') e.remove();
      input.setVirtual(0, { right: true });
      step(w, 1);
      minX = Math.min(minX, p.x);
    }
    input.setVirtual(0, null);
    expect(minX).toBeGreaterThanOrEqual(s.x + s.w / 2 - 1);
    expect(p.x).toBeGreaterThan(s.x + s.w);
    expect(p.onGround).toBe(true);
  });

  it('the GRINDER smashes through the stockade gate on its entrance', () => {
    const w = makeWorld('m1', { god: true });
    const bots = w.players.map((pl) => new Bot(pl.index));
    step(w, 30, bots);
    w.level.warp(M1.bossL - VIEW_W - 40);
    for (const pl of w.players) {
      pl.x = M1.bossL - VIEW_W + 40;
      pl.y = w.camera.y + 20;
    }
    const gateOf = () => w.entities.find((e: Entity) => e instanceof StockadeGate) as StockadeGate | undefined;
    expect(stepUntil(w, () => !!gateOf(), 20, bots)).toBe(true);
    expect(gateOf()!.broken).toBe(false);
    expect(stepUntil(w, () => w.boss instanceof Grinder, 30, bots)).toBe(true);
    expect(stepUntil(w, () => gateOf()!.broken, 4, bots)).toBe(true);
    for (let k = 0; k < 2; k++) input.setVirtual(k, null);
  });
});

describe('mission m1 - autopilot', () => {
  it('the invincible autopilot completes PALM HARBOR', () => {
    const r = simulateMission('m1', 900);
    if (!r.completed) console.log(JSON.stringify(r));
    expect(r.completed).toBe(true);
    expect(r.rescues).toBeGreaterThanOrEqual(8);
  }, 300_000);

  it('completes with another seed too', () => {
    const r = simulateMission('m1', 900, 3);
    if (!r.completed) console.log(JSON.stringify(r));
    expect(r.completed).toBe(true);
  }, 300_000);
});
