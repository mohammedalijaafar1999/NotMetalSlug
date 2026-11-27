// Mission 4 - RUSTWATER DOCKS: level data, the LEVIATHAN arena contract, the autopilot run and the
// mission mechanics (pontoons, the gantry magnet, the lift bridge, deep-water canals).
import { describe, it, expect } from 'vitest';
import { makeWorld, step, simulateMission } from './helpers';
import { getLevel, type LevelDef } from '../src/game/level';
import { getTheme, themeIds } from '../src/game/theme';
import { getEntityType } from '../src/game/registry';
import { VIEW_W } from '../src/engine/renderer';
import { wrapText } from '../src/engine/font';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import type { Vehicle } from '../src/game/vehicle';
import type { World } from '../src/game/world';
import { Pontoon } from '../src/content/levels/m4/pontoon';
import { MagnetCrane } from '../src/content/levels/m4/magnet';
import { LiftBridge } from '../src/content/levels/m4/bridge';
import { HarborWater } from '../src/content/levels/m4/harbor';
import { openHarbour } from '../src/content/themes/m4/weather';

const def = getLevel('m4')!;
const specs = () => [...(def.entities ?? []), ...(def.locks ?? []).flatMap((l) => l.waves.flatMap((w) => w.spawns))];
const bossLock = () => def.locks!.find((l) => l.boss)!;

function killEnemies(w: World): void {
  for (const e of w.entities) if (e.team === 'enemy' && e.hittable && !e.dead) e.damage({ amount: 9999, kind: 'explosion', owner: w.players[0] });
}

/** Small flat test level on the m4 theme: street y 180 with a deep canal at 600..800. */
const TEST_LEVEL: LevelDef = {
  id: 'm4_mechanics_test',
  mission: 0,
  name: 'M4 TEST',
  theme: 'm4',
  music: 'm4',
  width: 1600,
  height: 216,
  start: { x: 60 },
  ground: [
    [
      [0, 180],
      [600, 180],
    ],
    [
      [800, 180],
      [1600, 180],
    ],
  ],
  water: [{ x: 600, y: 182, w: 200, h: 34, deadly: true }],
};

describe('mission 4 level', () => {
  it('is registered as mission 4 with its theme, music and boss', () => {
    expect(def).toBeTruthy();
    expect(def.mission).toBe(4);
    expect(def.theme).toBe('m4');
    expect(themeIds()).toContain('m4');
    expect(def.music).toBe('m4');
    expect(def.bossMusic).toBe('boss');
    expect(def.bossName).toBe('LEVIATHAN');
    expect(def.name).toBe('RUSTWATER DOCKS');
    expect(def.subtitle).toBeTruthy();
    expect(wrapText(def.briefing!, 178).length).toBeLessThanOrEqual(11);
    expect(def.briefing).toBe(def.briefing!.toUpperCase());
  });

  it('follows the level design rules', () => {
    expect(def.width).toBeGreaterThanOrEqual(4500);
    expect(def.width).toBeLessThanOrEqual(8000);
    expect(def.timeLimit).toBeGreaterThanOrEqual(60);
    expect(def.timeLimit).toBeLessThanOrEqual(99);
    const all = specs();
    const hostages = all.filter((s) => s.type === 'hostage');
    expect(hostages.length).toBeGreaterThanOrEqual(9);
    expect(hostages.length).toBeLessThanOrEqual(12);
    const modes = new Set(hostages.map((h) => h.props?.mode ?? 'tied'));
    expect(modes).toEqual(new Set(['tied', 'caged', 'wander']));
    // Hostages hand out the good weapons.
    const drops = new Set(hostages.map((h) => h.props?.drop));
    for (const wpn of ['H', 'S', 'F', 'R', 'C', 'L']) expect(drops.has(wpn), `hostage drop ${wpn}`).toBe(true);
    // Weapon crates in the open.
    const crates = all.filter((s) => s.type === 'crate_prop' && /^[HRSFLCB]$/.test(String(s.props?.drop ?? '')));
    expect(crates.length).toBeGreaterThanOrEqual(2);
    // 3-6 locks, non-boss ones with 2-4 waves of 3-6 spawns.
    const locks = def.locks!;
    expect(locks.length).toBeGreaterThanOrEqual(3);
    expect(locks.length).toBeLessThanOrEqual(6);
    for (const l of locks.filter((k) => !k.boss)) {
      expect(l.waves.length).toBeGreaterThanOrEqual(2);
      expect(l.waves.length).toBeLessThanOrEqual(4);
      for (const w of l.waves) {
        expect(w.spawns.length).toBeGreaterThanOrEqual(3);
        expect(w.spawns.length).toBeLessThanOrEqual(6);
      }
    }
    // Checkpoints at least every ~1200 px up to the boss.
    const cps = [0, ...def.checkpoints!, bossLock().x];
    for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1], `checkpoint gap after ${cps[i - 1]}`).toBeLessThanOrEqual(1200);
    // Signature enemies and the roster asked for.
    const types = new Set(all.map((s) => s.type));
    for (const t of ['frogman', 'gunboat', 'flametrooper', 'jetpack', 'shield_trooper', 'officer', 'truck', 'turret', 'heli', 'light_tank', 'sniper', 'tank']) expect(types.has(t), t).toBe(true);
    for (const s of all) expect(getEntityType(s.type), s.type).toBeTruthy();
  });

  it('uses only decor kinds the theme draws, with plenty of variety', () => {
    const theme = getTheme('m4');
    const kinds = new Set((def.decor ?? []).map((d) => d.kind));
    for (const k of kinds) expect(theme.decor?.[k], `decor kind ${k}`).toBeTypeOf('function');
    expect(Object.keys(theme.decor ?? {}).length).toBeGreaterThanOrEqual(12);
    expect(kinds.size).toBeGreaterThanOrEqual(10);
  });

  it('has a full screen of calm before the boss lock', () => {
    const L = bossLock();
    const calmFrom = (L.trigger ?? L.x) - VIEW_W;
    const enemies = (def.entities ?? []).filter((s) => getEntityType(s.type)?.category === 'enemy' && s.x > calmFrom - VIEW_W * 0.25);
    expect(enemies).toEqual([]);
  });

  it('builds the boss arena to the LEVIATHAN contract', () => {
    const L = bossLock();
    const Lx = L.x;
    expect(L.trigger).toBe(Lx - 40);
    expect(L.announce).toBe('WARNING!');
    expect(L.waves).toHaveLength(1);
    expect(L.waves[0].spawns).toEqual([{ type: 'boss_m4', x: Lx + 300 }]);
    expect(def.width).toBeGreaterThanOrEqual(Lx + 384);
    expect(Lx).toBeLessThanOrEqual(def.width - VIEW_W);
    const w = makeWorld('m4');
    const T = w.terrain;
    // Flat, clear deck at y 180 from L to L+148, then deep water.
    for (let x = Lx; x < Lx + 148; x += 4) {
      expect(T.groundTopAt(x)).toBe(180);
      expect(T.topFloorAt(x)).toBe(180);
      expect(T.waterAt(x, 179)).toBeNull();
    }
    for (const s of def.solids ?? []) expect(s.x + s.w <= Lx || s.x >= Lx + 148).toBe(true);
    for (const p of def.platforms ?? []) expect(p.x + p.w <= Lx || p.x >= Lx + 148).toBe(true);
    for (const s of specs()) if (getEntityType(s.type)?.category === 'prop' || getEntityType(s.type)?.category === 'hazard') expect(s.x < Lx - 20 || s.x > Lx + 160, `${s.type}@${s.x}`).toBe(true);
    for (let x = Lx + 150; x < Lx + 384; x += 8) {
      const wt = T.waterAt(x, 200);
      expect(wt, `water at ${x}`).toBeTruthy();
      expect(wt!.deadly).toBe(true);
      expect(wt!.y).toBe(190);
      expect(wt!.h).toBeGreaterThanOrEqual(70);
      expect(T.groundTopAt(x) >= 250).toBe(true);
    }
    // Camera sits at the top of the level (y 0) in the arena.
    expect(w.camera.boundsAt(Lx)).toEqual({ minY: 0, maxY: 0 });
    // The background opens onto the harbour there.
    expect(openHarbour(def, Lx)).toBe(1);
    expect(openHarbour(def, 0)).toBe(0);
  });
});

describe('mission 4 autopilot', () => {
  it('the invincible autopilot completes RUSTWATER DOCKS', () => {
    const r = simulateMission('m4', 900);
    if (!r.completed) console.log('m4', JSON.stringify(r));
    expect(r.completed).toBe(true);
    expect(r.rescues).toBeGreaterThanOrEqual(9);
  }, 240_000);
});

describe('mission 4 mechanics', () => {
  it('pontoons bob on the water, dip under a rider and carry the player', () => {
    const w = makeWorld(TEST_LEVEL, { god: true });
    step(w, 2);
    const pon = w.spawn('m4_pontoon', 700, undefined, { w: 48 }) as Pontoon;
    step(w, 1);
    expect(pon.deck).toBeTruthy();
    const ys: number[] = [];
    for (let i = 0; i < 120; i++) {
      step(w, 1);
      ys.push(pon.deck!.y1);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(1);
    expect(Math.min(...ys)).toBeGreaterThan(176);
    expect(Math.max(...ys)).toBeLessThan(184);
    // A player standing on it rides it and pushes it down a little.
    const p = w.players[0];
    w.camera.x = 520;
    p.state = 'play';
    p.x = 700;
    p.y = pon.deck!.y1 - 2;
    p.vy = 0;
    step(w, 30);
    expect(p.onGround).toBe(true);
    expect(p.groundSurface).toBe(pon.deck);
    const dipped: number[] = [];
    for (let i = 0; i < 90; i++) {
      step(w, 1);
      dipped.push(pon.deck!.y1);
      expect(Math.abs(p.y - pon.deck!.y1)).toBeLessThan(1.5);
    }
    expect(Math.max(...dipped)).toBeGreaterThan(Math.max(...ys) + 1);
  });

  it('falling into a deep canal splashes and costs a life; you drop back in on solid ground', () => {
    const w = makeWorld(TEST_LEVEL, { god: false });
    const harbor = w.spawn('m4_harbor', 0) as HarborWater;
    step(w, 60);
    const p = w.players[0];
    w.camera.x = 450;
    w.camera.minX = 450;
    const lives = p.profile.lives;
    p.x = 700;
    p.y = 120;
    p.vy = 0;
    p.onGround = false;
    let fell = false;
    for (let i = 0; i < 240 && !fell; i++) {
      step(w, 1);
      if (p.profile.lives < lives) fell = true;
    }
    expect(harbor.splashes).toBeGreaterThanOrEqual(1);
    expect(fell).toBe(true);
    step(w, 180);
    expect(p.state).toBe('play');
    expect(p.onGround).toBe(true);
    expect(w.terrain.waterAt(p.x, p.y - 2)?.deadly ?? false).toBe(false);
  });

  it('the gantry magnet snatches a piloted tank and throws the pilot clear (once)', () => {
    const w = makeWorld(TEST_LEVEL, { god: true });
    step(w, 30);
    const p = w.players[0];
    const tank = w.spawn('tank', p.x + 10) as Vehicle;
    step(w, 2);
    tank.enter(p);
    expect(p.vehicle).toBe(tank);
    const mag = w.spawn('m4_magnet', p.x + 200) as MagnetCrane;
    step(w, 30);
    expect(mag.state).toBe('idle');
    // Roll the tank under the gantry.
    tank.x = mag.x - 70;
    let grabbed = -1;
    for (let i = 0; i < 180 && grabbed < 0; i++) {
      step(w, 1);
      if (mag.taken > 0) grabbed = i;
    }
    expect(grabbed).toBeGreaterThan(40); // the warning (arm) phase comes first
    expect(p.vehicle).toBeNull();
    expect(p.state).toBe('play');
    expect(p.invuln).toBeGreaterThan(1);
    expect(tank.dead).toBe(true);
    expect(w.query((e) => (e as any).isVehicle === true)).toHaveLength(0);
    step(w, 240);
    expect(mag.state).toBe('done');
    expect(mag.carried).toBeNull();
    // On foot the magnet ignores you.
    p.x = mag.x;
    step(w, 120);
    expect(mag.taken).toBe(1);
  });

  it('the slip lift bridge stays up through the gauntlet and comes down for the final wave', () => {
    const w = makeWorld('m4', { god: true });
    step(w, 2);
    w.level.warp(5200);
    const bots = [new Bot(0)];
    let bridge: LiftBridge | null = null;
    let lowerWave = -1;
    const lock = () => w.level.activeLock;
    for (let i = 0; i < 60 * 120; i++) {
      step(w, 1, bots);
      bridge ??= (w.entities.find((e) => e instanceof LiftBridge) as LiftBridge) ?? null;
      const a = lock();
      if (a && a.def.x === 5600) {
        if (bridge && bridge.lowering && lowerWave < 0) lowerWave = a.wave;
        if (bridge && a.wave < a.def.waves.length - 1) {
          expect(bridge.progress).toBe(0);
          expect(w.terrain.floorAt(5930, 0, 400)).toBeNull();
        }
        if (i % 30 === 0) killEnemies(w);
      }
      if (w.level.lockStates().find((l) => l.x === 5600)?.state === 'done') break;
    }
    for (let k = 0; k < 2; k++) input.setVirtual(k, null);
    expect(bridge).toBeTruthy();
    expect(lowerWave).toBe(3);
    step(w, 120);
    expect(bridge!.progress).toBe(1);
    expect(w.terrain.floorAt(5930, 100, 300)?.y).toBe(180);
  }, 60_000);
});
