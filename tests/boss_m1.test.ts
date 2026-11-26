// GRINDER (boss_m1): the autopilot can beat it, the entrance is invulnerable, every phase is reached,
// and every attack can be dodged by a one-hit-death player on foot.
import { describe, expect, it } from 'vitest';
import { makeWorld, step, simulateMission, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import { Grinder, GRINDER_PHASES } from '../src/content/bosses/boss_m1';
import { GroundMarker, Lobbed, Wreck } from '../src/content/bosses/common/kit';
import { getEntityType } from '../src/game/registry';
import { getLevel } from '../src/game/level';
import type { World } from '../src/game/world';
import type { Player } from '../src/game/player';

const L = 420; // boss lock x of the test arena

/** World with the camera at the boss lock and player 1 standing in the arena. */
function arena(god = true, difficulty: 0 | 1 | 2 = 1): { w: World; p: Player } {
  const w = makeWorld('bosstest_m1', { god, difficulty });
  const p = w.players[0];
  w.level.warp(L);
  p.x = L + 40;
  p.y = w.camera.y + 20;
  p.vy = 0;
  return { w, p };
}

function stepUntil(w: World, pred: () => boolean, maxSeconds = 10): boolean {
  for (let i = 0; i < maxSeconds * 60; i++) {
    if (pred()) return true;
    step(w, 1);
  }
  return pred();
}

function waitBoss(w: World): Grinder {
  stepUntil(w, () => !!w.boss, 3);
  expect(w.boss).toBeInstanceOf(Grinder);
  return w.boss as Grinder;
}

/** Boss idle in the given phase, no troops or shells around. */
function readyInPhase(w: World, b: Grinder, phase: number): void {
  expect(stepUntil(w, () => b.state === 'idle', 6)).toBe(true);
  if (phase > 0) {
    b.hp = b.maxHp * (phase === 1 ? 0.45 : 0.2);
    expect(stepUntil(w, () => b.state === 'stagger', 12)).toBe(true);
    expect(stepUntil(w, () => b.state === 'idle', 6)).toBe(true);
  }
  expect(b.phase).toBe(phase);
  for (const e of w.query((x) => x.type === 'rifleman' || x instanceof Lobbed)) e.remove();
}

describe('boss_m1 GRINDER', () => {
  it('is registered as a boss and the test arena follows the documented layout', () => {
    expect(getEntityType('boss_m1')?.category).toBe('boss');
    const lvl = getLevel('bosstest_m1')!;
    const lock = lvl.locks!.find((l) => l.boss)!;
    expect(lock.x).toBe(L);
    expect(lock.announce).toBeUndefined();
    expect(lock.waves[0].spawns[0]).toMatchObject({ type: 'boss_m1', x: L + 282 });
  });

  it('the invincible autopilot defeats it within 150 s of fighting (several seeds)', () => {
    for (const seed of [1, 2, 3]) {
      const w = makeWorld('bosstest_m1', { seed, god: true });
      const bots = w.players.map((p) => new Bot(p.index));
      let spawnT = -1;
      let t = 0;
      for (; t < 300 && w.state !== 'complete'; t += DT) {
        step(w, 1, bots);
        if (spawnT < 0 && w.boss) spawnT = t;
      }
      for (let k = 0; k < 2; k++) input.setVirtual(k, null);
      expect(w.state, `seed ${seed}`).toBe('complete');
      expect(t - spawnT, `seed ${seed} fight seconds`).toBeLessThan(150);
    }
  }, 60_000);

  it('completes the test mission (simulateMission)', () => {
    const r = simulateMission('bosstest_m1', 300);
    expect(r.completed).toBe(true);
  }, 60_000);

  it('cannot be hurt during its entrance (< 3 s), then can', () => {
    const { w, p } = arena();
    const b = waitBoss(w);
    const hp = b.hp;
    let t = 0;
    while (!b.introDone && t < 5) {
      expect(b.hittable).toBe(false);
      expect(b.damage({ amount: 50, kind: 'explosion', owner: p, x: b.x - 60, y: b.groundY - 40 })).toBe(false);
      w.explode(b.x - 60, b.groundY - 30, { radius: 90, damage: 50, team: 'player', owner: p, size: 'none', sfx: null });
      step(w, 1);
      t += DT;
    }
    expect(b.hp).toBe(hp);
    expect(t).toBeLessThan(3);
    expect(b.hittable).toBe(true);
    expect(b.damage({ amount: 5, kind: 'bullet', owner: p, x: b.frontX + 2, y: b.groundY - 20 })).toBe(true);
    expect(b.hp).toBeLessThan(hp);
  });

  it('reaches every phase, with its damage beats, in an autopilot fight', () => {
    const w = makeWorld('bosstest_m1', { seed: 4, god: true });
    const bots = w.players.map((p) => new Bot(p.index));
    let b: Grinder | null = null;
    const seen: Set<string>[] = [new Set(), new Set(), new Set()];
    for (let i = 0; i < 300 * 60 && w.state !== 'complete'; i++) {
      step(w, 1, bots);
      if (!b && w.boss) b = w.boss as Grinder;
      if (b && !b.dying) seen[b.phase].add(b.state);
      if (b?.dying) break;
    }
    for (let k = 0; k < 2; k++) input.setVirtual(k, null);
    expect(b).toBeTruthy();
    expect(b!.maxPhase).toBe(2);
    expect(b!.skirtOff).toBe(true);
    expect(b!.stackGone).toBe(true);
    expect(b!.armourOff).toBe(true);
    expect(b!.armorMul).toBeGreaterThan(1);
    // Phase 1 teaches the volley, the hatch and the charge; phase 2 adds the flame vents.
    for (const s of ['volley', 'deploy', 'rev', 'charge', 'slam', 'reverse']) expect(seen[0].has(s), `phase 0 ${s}`).toBe(true);
    expect(seen[1].has('flame'), 'phase 1 flame').toBe(true);
    expect(seen[2].has('stagger') && seen[2].has('rev'), 'phase 2 stagger + charge').toBe(true);
    // The stack is the weak point.
    expect(b!.dmgLog.stack ?? 0).toBeGreaterThan(0);
  }, 60_000);

  for (const phase of [0, 1, 2]) {
    it(`phase ${phase}: the blade charge stops at the hazard post; left of it is safe, in the lane is not`, () => {
      const pocket = GRINDER_PHASES[phase].pocket;
      // Safe: standing just left of the stop line.
      {
        const { w, p } = arena();
        const b = waitBoss(w);
        readyInPhase(w, b, phase);
        p.godMode = false;
        p.x = L + pocket - p.w / 2 - 1;
        b.forceAttack('charge');
        expect(stepUntil(w, () => b.state === 'rev', 3)).toBe(true);
        expect(b.stopX).toBe(L + pocket);
        expect(stepUntil(w, () => b.state === 'slam', 6)).toBe(true);
        expect(Math.round(b.frontX)).toBe(L + pocket);
        expect(p.state).toBe('play');
        // The blade stays put while stuck, then backs off (phase 3 also lobs shells while reversing).
        expect(stepUntil(w, () => b.state === 'reverse', 3)).toBe(true);
        expect(p.state).toBe('play');
        expect(b.frontX).toBeGreaterThanOrEqual(L + pocket - 0.01);
      }
      // Unsafe: standing in the lane in front of the blade.
      {
        const { w, p } = arena();
        const b = waitBoss(w);
        readyInPhase(w, b, phase);
        p.godMode = false;
        p.x = L + pocket + 30;
        b.forceAttack('charge');
        stepUntil(w, () => b.state === 'slam', 8);
        expect(p.state).toBe('dying');
      }
    });
  }

  it('the charge leaves enough time to reach the pocket from right in front of the blade', () => {
    for (const phase of [0, 1, 2]) {
      const { w, p } = arena();
      const b = waitBoss(w);
      readyInPhase(w, b, phase);
      p.godMode = false;
      p.x = b.frontX - 12;
      b.forceAttack('charge');
      expect(stepUntil(w, () => b.state === 'rev', 3)).toBe(true);
      // React after 0.25 s and run left at full speed.
      step(w, 15);
      input.setVirtual(0, { left: true });
      stepUntil(w, () => b.state === 'slam' || p.state !== 'play', 6);
      input.setVirtual(0, null);
      expect(p.state, `phase ${phase}`).toBe('play');
    }
  });

  it('the hull is solid: players are pushed out in front of it', () => {
    const { w, p } = arena();
    const b = waitBoss(w);
    stepUntil(w, () => b.state === 'idle', 6);
    p.x = b.x;
    step(w, 1);
    expect(p.x + p.w / 2).toBeLessThanOrEqual(b.frontX + 6.01);
    p.x = b.rearX - 4;
    step(w, 1);
    expect(p.x + p.w / 2).toBeLessThanOrEqual(b.frontX + 6.01);
  });

  it('flame vents (phase 2+) cannot reach a player near the left edge', () => {
    for (const phase of [1, 2]) {
      const { w, p } = arena();
      const b = waitBoss(w);
      readyInPhase(w, b, phase);
      p.godMode = false;
      p.x = L + 40;
      b.forceAttack('flame');
      expect(stepUntil(w, () => b.state === 'flame', 4)).toBe(true);
      expect(stepUntil(w, () => b.state === 'idle', 6)).toBe(true);
      expect(p.state, `phase ${phase}`).toBe('play');
    }
  });

  it('cannon shells show where they land and the hatch deploys riflemen', () => {
    const { w } = arena();
    const b = waitBoss(w);
    stepUntil(w, () => b.state === 'idle', 6);
    b.forceAttack('volley');
    expect(stepUntil(w, () => w.query((e) => e instanceof Lobbed).length > 0, 4)).toBe(true);
    const shell = w.query((e): e is Lobbed => e instanceof Lobbed)[0];
    step(w, 1);
    const marker = w.query((e): e is GroundMarker => e instanceof GroundMarker)[0];
    expect(marker).toBeTruthy();
    expect(marker.x).toBeCloseTo(shell.tx, 5);
    expect(shell.flight).toBeGreaterThanOrEqual(1.0);
    stepUntil(w, () => b.state === 'idle', 6);
    b.forceAttack('deploy');
    expect(stepUntil(w, () => w.query((e) => e.type === 'rifleman').length > 0, 4)).toBe(true);
  });

  it('dies with a long death sequence, completes the mission and leaves a burning wreck', () => {
    const { w, p } = arena();
    const b = waitBoss(w);
    stepUntil(w, () => b.introDone, 4);
    b.damage({ amount: 99999, kind: 'explosion', owner: p, x: b.x, y: b.groundY - 40 });
    expect(b.dying).toBe(true);
    step(w, 60 * 3);
    expect(w.state).toBe('play');
    expect(b.turretGone).toBe(true);
    stepUntil(w, () => w.state === 'complete', 4);
    expect(w.state).toBe('complete');
    expect(w.query((e) => e instanceof Wreck).length).toBe(1);
    expect(p.profile.score).toBeGreaterThanOrEqual(20000);
  });
});
