// HORNET KING (boss_m2): intro invulnerability, phases, attacks, fairness and autopilot completion.
import { describe, expect, it } from 'vitest';
import { makeWorld, simulateMission, step, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import { getEntityType } from '../src/game/registry';
import { getLevel } from '../src/game/level';
import { VIEW_W } from '../src/engine/renderer';
import type { World } from '../src/game/world';
import type { HornetKing } from '../src/content/bosses/boss_m2';

const LOCK_X = 1100;

/** World with the camera already at the boss lock and the player in the arena. */
function arenaWorld(seed = 1, difficulty: 0 | 1 | 2 = 1): World {
  const w = makeWorld('bosstest_m2', { seed, difficulty });
  w.level.warp(LOCK_X);
  const p = w.players[0];
  p.x = LOCK_X + 90;
  p.y = 184;
  step(w, 1);
  return w;
}

function bossOf(w: World): HornetKing | null {
  return (w.boss as HornetKing | null) ?? null;
}

/** Step until the boss exists (lock engaged + wave delay). */
function waitBoss(w: World, maxSteps = 600, bots: Bot[] = []): HornetKing {
  for (let i = 0; i < maxSteps && !w.boss; i++) step(w, 1, bots);
  const b = bossOf(w);
  if (!b) throw new Error('boss did not spawn');
  return b;
}

function releaseInput(): void {
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
}

describe('boss_m2 HORNET KING', () => {
  it('is registered as a boss and the test arena references it', () => {
    expect(getEntityType('boss_m2')?.category).toBe('boss');
    const L = getLevel('bosstest_m2')!;
    const lock = L.locks!.find((l) => l.boss)!;
    expect(lock.waves[0].spawns[0].type).toBe('boss_m2');
  });

  it('is not hittable during its intro, then becomes hittable', () => {
    const w = arenaWorld();
    const b = waitBoss(w);
    const p = w.players[0];
    let introSteps = 0;
    while (!b.introDone && introSteps < 400) {
      expect(b.hittable).toBe(false);
      expect(b.damage({ amount: 50, kind: 'explosion', owner: p, x: b.x, y: b.y })).toBe(false);
      for (const z of b.zones) expect(z.w).toBeGreaterThan(0);
      step(w, 1);
      introSteps++;
    }
    expect(b.hp).toBe(b.maxHp);
    expect(introSteps * DT).toBeLessThan(3.05);
    expect(introSteps * DT).toBeGreaterThan(1);
    expect(b.introDone).toBe(true);
    expect(b.hittable).toBe(true);
    expect(b.damage({ amount: 1, kind: 'bullet', owner: p, x: b.x, y: b.y + 10 })).toBe(true);
    expect(b.hp).toBeLessThan(b.maxHp);
  });

  it('player bullets fired at it during the intro do nothing', () => {
    const w = arenaWorld();
    const bots = [new Bot(0)];
    const b = waitBoss(w, 600, bots);
    for (let i = 0; i < 90 && !b.introDone; i++) step(w, 1, bots);
    releaseInput();
    expect(b.hp).toBe(b.maxHp);
  });

  it('reaches every phase (rotor tears off at 50 %, burns at 20 %) and dies into a wreck', () => {
    const w = arenaWorld();
    const b = waitBoss(w);
    for (let i = 0; i < 300 && !b.introDone; i++) step(w, 1);
    const p = w.players[0];
    const phases: number[] = [];
    const states = new Set<string>();
    let completed = false;
    for (let i = 0; i < 60 * 120 && !completed; i++) {
      if (i % 20 === 0 && b.hittable && !b.dying) b.damage({ amount: 3, kind: 'bullet', owner: p, x: b.x, y: b.y + 20 });
      step(w, 1);
      if (!phases.includes(b.phase)) phases.push(b.phase);
      states.add(b.state);
      completed = w.state === 'complete';
    }
    expect(phases).toEqual([0, 1, 2]);
    expect(states.has('tear')).toBe(true);
    expect(states.has('burn')).toBe(true);
    expect(b.pylonOn).toBe(false);
    expect(b.dmgState).toBe(3);
    expect(completed).toBe(true);
    expect(w.query((e) => e.constructor.name === 'Wreck').length).toBeGreaterThan(0);
    expect(w.query((e) => e.constructor.name === 'TornRotor').length).toBe(1);
  });

  it('uses all its attacks and is fair: telegraphed sweeps, slow readable projectiles', () => {
    const w = arenaWorld(3);
    const b = waitBoss(w);
    const p = w.players[0];
    const fast: number[] = [];
    let prev = b.state;
    const badSweep: string[] = [];
    for (let i = 0; i < 60 * 80; i++) {
      if (i === 60 * 40 && !b.dying) b.damage({ amount: b.hp - b.maxHp * 0.45, kind: 'explosion', owner: p, x: b.x, y: b.y });
      step(w, 1);
      if (b.state !== prev) {
        if (b.state === 'sweepFire' && prev !== 'sweepAim') badSweep.push(prev);
        prev = b.state;
      }
      for (const e of w.query((x) => x.team === 'enemy' && (x as any).damageAmount !== undefined)) {
        const sp = Math.hypot(e.vx, e.vy);
        if ((e as any).spriteName === 'bullet_enemy' && sp > 200) fast.push(sp);
        if ((e as any).spriteName === 'bm2_missile' && sp > 240) fast.push(sp);
      }
    }
    expect(fast).toEqual([]);
    expect(badSweep).toEqual([]);
    const used = new Set(b.attackLog);
    expect(used.has('sweep')).toBe(true);
    expect(used.has('salvo')).toBe(true);
    expect(used.has('carpet')).toBe(true);
    expect(used.has('rain')).toBe(true);
  });

  it('never flies so low that it overlaps a standing player', () => {
    const w = arenaWorld(5);
    const b = waitBoss(w);
    let minGap = Infinity;
    for (let i = 0; i < 60 * 60; i++) {
      if (i === 60 * 30 && !b.dying) b.damage({ amount: b.hp - b.maxHp * 0.15, kind: 'explosion', owner: w.players[0], x: b.x, y: b.y });
      step(w, 1);
      if (b.dying) break;
      const lowest = Math.max(...b.zones.map((z) => z.y + z.h));
      minGap = Math.min(minGap, b.groundY - 26 - lowest);
    }
    expect(minGap).toBeGreaterThan(4);
  });

  it('stays inside the locked arena (hull mostly on screen) while fighting', () => {
    const w = arenaWorld(7);
    const b = waitBoss(w);
    for (let i = 0; i < 300 && !b.introDone; i++) step(w, 1);
    let worst = 0;
    for (let i = 0; i < 60 * 50; i++) {
      step(w, 1);
      const cx = w.camera.x;
      const out = Math.max(0, cx + 16 - b.x, b.x - (cx + VIEW_W - 16));
      worst = Math.max(worst, out);
    }
    expect(worst).toBe(0);
  });

  it('chin-gun sweeps never reach a player standing under the hull', () => {
    const w = arenaWorld(11);
    const b = waitBoss(w);
    for (let i = 0; i < 300 && !b.introDone; i++) step(w, 1);
    const p = w.players[0];
    p.godMode = false;
    let deaths = 0;
    let sweeps = 0;
    const bullets = new Set<number>();
    w.on('playerDied', () => deaths++);
    for (let i = 0; i < 60 * 30; i++) {
      b.attackCd = 99;
      if (b.state === 'hover') {
        (b as any).setState('sweepMove');
        sweeps++;
      }
      if (b.state === 'sweepAim' || b.state === 'sweepFire') {
        p.x = b.x - b.facing * 8;
        p.vx = 0;
      }
      step(w, 1);
      for (const e of w.query((x) => (x as any).spriteName === 'bullet_enemy')) bullets.add(e.id);
    }
    expect(sweeps).toBeGreaterThanOrEqual(3);
    expect(bullets.size).toBeGreaterThan(30);
    expect(deaths).toBe(0);
  });

  it('missile rain always leaves a free slot right next to the player', () => {
    const w = arenaWorld(13);
    const b = waitBoss(w) as any;
    for (let px = b.arenaL + 4; px < b.arenaR - 4; px += 9) {
      for (const n of [5, 6]) {
        const hits: number[] = b.pickRainSlots(px, n);
        expect(hits.length).toBeLessThanOrEqual(n);
        // The slot under the player is targeted (forces a move)...
        expect(hits.some((x) => Math.abs(x - px) <= 24.5)).toBe(true);
        // ...but a neighbouring slot (48 px away) is free.
        const free = [-48, 48].some((dx) => {
          const sx = hits.reduce((best, x) => (Math.abs(x - px) < Math.abs(best - px) ? x : best), hits[0]) + dx;
          return sx > b.arenaL && sx < b.arenaR && !hits.some((x) => Math.abs(x - sx) < 1);
        });
        expect(free).toBe(true);
      }
    }
  });

  it('carpet bombs land at least 60 px apart (stand between the shadows)', () => {
    const w = arenaWorld(17);
    const b = waitBoss(w) as any;
    for (let i = 0; i < 300 && !b.introDone; i++) step(w, 1);
    b.runDir = b.facing;
    b.setState('carpetGo');
    const seen = new Map<number, number>();
    for (let i = 0; i < 60 * 8 && b.state !== 'reload'; i++) {
      step(w, 1);
      for (const e of w.query((x) => x.constructor.name === 'CarpetBomb')) seen.set(e.id, (e as any).tx);
    }
    const xs = [...seen.values()].sort((a, c) => a - c);
    expect(xs.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(58);
  });

  it('a simple dodging player (not invincible) survives whole fights', () => {
    // Stays under the hull (sweep-safe) and keeps out of marked missile / bomb impact spots without
    // ever walking through one. Script damage stands in for some of the player's gun.
    for (const seed of [1, 2, 3]) {
      const w = arenaWorld(seed);
      const p = w.players[0];
      let deaths = 0;
      w.on('playerDied', () => deaths++);
      for (let i = 0; i < 60 * 120 && w.state !== 'complete'; i++) {
        const b = bossOf(w);
        const mask: Record<string, boolean> = {};
        if (b && b.introDone && !b.dying) {
          p.godMode = false;
          const threats: { x: number; r: number }[] = [];
          for (const e of w.query((x) => x.constructor.name === 'LockMark')) threats.push({ x: e.x, r: 30 });
          for (const e of w.query((x) => x.constructor.name === 'CarpetBomb')) threats.push({ x: (e as any).tx, r: 25 });
          const safe = (x: number) => threats.every((th) => Math.abs(th.x - x) > th.r);
          const crosses = (a: number, c: number) => threats.some((th) => th.x + th.r > Math.min(a, c) && th.x - th.r < Math.max(a, c));
          const want = Math.max(b.arenaL + 10, Math.min(b.arenaR - 10, b.x - b.facing * 12));
          let target = want;
          if (!safe(p.x)) {
            let best = Infinity;
            for (let dx = 0; dx < 400; dx += 2)
              for (const sg of [-1, 1]) {
                const x = p.x + sg * dx;
                if (x > b.arenaL + 8 && x < b.arenaR - 8 && safe(x) && dx < best) {
                  best = dx;
                  target = x;
                }
              }
          } else if (crosses(p.x, want)) target = p.x;
          if (target > p.x + 3) mask.right = true;
          else if (target < p.x - 3) mask.left = true;
          mask.up = true;
          mask.fire = i % 6 < 3;
          if (i % 10 === 0 && b.hittable) b.damage({ amount: 1, kind: 'bullet', owner: p, x: b.x, y: b.y + 16 });
        }
        input.setVirtual(0, mask);
        step(w, 1);
      }
      releaseInput();
      expect(w.state, `seed ${seed}`).toBe('complete');
      expect(deaths, `seed ${seed}`).toBe(0);
    }
  }, 60_000);

  it('is defeated by the invincible autopilot within the time budget', () => {
    const r = simulateMission('bosstest_m2', 300);
    if (!r.completed) console.log('bosstest_m2', JSON.stringify(r));
    expect(r.completed).toBe(true);
  }, 120_000);
});
