// boss_m4 LEVIATHAN: the autopilot beats it from the dock, the intro is unhittable, every phase is
// reached, and the attacks keep their fairness contracts (telegraph times, jumpable heights).
import { describe, expect, it } from 'vitest';
import { makeWorld, step, simulateMission, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import { getEntityType } from '../src/game/registry';
import type { World } from '../src/game/world';
import { Leviathan, LEVIATHAN_HP, DIVE_SINK } from '../src/content/bosses/m4/leviathan';
import { Torpedo } from '../src/content/bosses/m4/weapons';
import * as A from '../src/content/bosses/m4/art';

/** Walk the bot to the arena until the boss exists. */
function toBoss(seed = 1): { w: World; bots: Bot[]; boss: Leviathan } {
  const w = makeWorld('bosstest_m4', { seed, god: true });
  const bots = w.players.map((p) => new Bot(p.index));
  for (let i = 0; i < 60 * 40 && !w.boss; i++) step(w, 1, bots);
  expect(w.boss, 'boss spawned').toBeTruthy();
  return { w, bots, boss: w.boss as Leviathan };
}

function release(): void {
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
}

describe('boss_m4 LEVIATHAN', () => {
  it('is registered as a boss', () => {
    expect(getEntityType('boss_m4')?.category).toBe('boss');
  });

  it('is not hittable during its intro, then becomes hittable', () => {
    const { w, bots, boss } = toBoss();
    expect(boss.introDone).toBe(false);
    const hp0 = boss.hp;
    let t = 0;
    while (!boss.introDone && t < 5) {
      // Direct hits and blasts on every zone must do nothing while it rises.
      for (const z of boss.zones) {
        expect(boss.damage({ amount: 50, kind: 'explosion', owner: w.players[0], x: z.x + z.w / 2, y: z.y + z.h / 2 })).toBe(false);
      }
      expect(boss.hittable).toBe(false);
      step(w, 1, bots);
      t += DT;
    }
    release();
    expect(boss.hp).toBe(hp0);
    expect(t).toBeLessThan(3.05);
    expect(boss.introDone).toBe(true);
    expect(boss.hittable).toBe(true);
    const tower = boss.zones.find((z) => z.id === 'tower')!;
    expect(boss.damage({ amount: 4, kind: 'bullet', owner: w.players[0], x: tower.x + tower.w / 2, y: tower.y + tower.h / 2 })).toBe(true);
    expect(boss.hp).toBeLessThan(hp0);
  });

  it('is beaten by the autopilot on foot from the dock, reaching every phase', () => {
    const { w, bots, boss } = toBoss();
    const phases = new Set<number>();
    let t = 0;
    let maxSink = 0;
    let towerOnlyWhileDiving = true;
    while (w.state !== 'complete' && t < 300) {
      step(w, 1, bots);
      t += DT;
      if (!boss.dead && !boss.dying) {
        phases.add(boss.phase);
        maxSink = Math.max(maxSink, boss.sink);
        if (boss.phase >= 2 && boss.sink >= DIVE_SINK - 0.5 && boss.zones.some((z) => z.id !== 'tower' && z.mul > 0)) towerOnlyWhileDiving = false;
      }
    }
    release();
    expect(w.state).toBe('complete');
    expect([...phases].sort()).toEqual([0, 1, 2]);
    expect(maxSink).toBeGreaterThanOrEqual(DIVE_SINK - 0.5);
    expect(towerOnlyWhileDiving).toBe(true);
    // Every attack was used.
    for (const k of ['torpedo', 'missiles', 'laser', 'claw']) expect(boss.attacks[k] ?? 0, k).toBeGreaterThan(0);
    // Most of the damage came through the weak points.
    const total = Object.values(boss.dmgLog).reduce((a, b) => a + b, 0);
    const weak = (boss.dmgLog.tower ?? 0) + (boss.dmgLog.podF ?? 0) + (boss.dmgLog.podA ?? 0) + (boss.dmgLog.mouth ?? 0);
    expect(weak / total).toBeGreaterThan(0.6);
    console.log(`[boss_m4] autopilot win in ${t.toFixed(1)} s, dmg by zone`, JSON.stringify(boss.dmgLog));
  }, 120_000);

  it('completes the test mission with simulateMission', () => {
    const r = simulateMission('bosstest_m4', 300);
    expect(r.completed).toBe(true);
    expect(r.seconds).toBeLessThan(150);
  }, 120_000);

  it('scales HP with difficulty', () => {
    for (const [d, k] of [
      [0, 0.8],
      [1, 1],
      [2, 1.3],
    ] as const) {
      const w = makeWorld('bosstest_m4', { difficulty: d });
      const b = w.spawn('boss_m4', 820) as Leviathan;
      step(w, 2);
      expect(b.maxHp).toBe(Math.round(LEVIATHAN_HP * k));
    }
  });

  it('torpedoes ride up onto the dock low enough to jump, and lasers telegraph before they hurt', () => {
    const { w, bots, boss } = toBoss();
    let deckTorpedo: Torpedo | null = null;
    let aimSeen = -1;
    let fireSeen = -1;
    let t = 0;
    while (t < 90 && (!deckTorpedo || fireSeen < 0)) {
      step(w, 1, bots);
      t += DT;
      for (const e of w.entities) if (e instanceof Torpedo && e.onDeck && !deckTorpedo) deckTorpedo = e;
      if (boss.beam.mode === 'aim' && aimSeen < 0) aimSeen = t;
      if (boss.beam.mode === 'fire' && aimSeen >= 0 && fireSeen < 0) fireSeen = t;
      if (boss.beam.mode === 'off' && fireSeen < 0) aimSeen = -1;
    }
    release();
    expect(deckTorpedo, 'a torpedo reached the dock').toBeTruthy();
    // Sits on the deck, at most 8 px tall: a standing jump (~50 px) clears it.
    expect(deckTorpedo!.bottom).toBeGreaterThan(boss.deckY - 1);
    expect(deckTorpedo!.h).toBeLessThanOrEqual(8);
    expect(fireSeen - aimSeen).toBeGreaterThanOrEqual(0.75);
  }, 60_000);

  it('the laser whip can be jumped from the dock', () => {
    // Geometry check: at the end of a sweep the beam crosses a player standing at the left quarter
    // well below the jump apex (~50 px), and the far end of the arena is never swept.
    const { w, boss } = toBoss();
    for (let i = 0; i < 60 * 4; i++) step(w, 1);
    const lens = boss.lensPos();
    const ext = 18 - boss.scopeExt * 18; // lens when the periscope is up
    const ey = lens.y - ext;
    const endX = boss.facing < 0 ? boss.arenaL + 24 : boss.arenaR - 24;
    const px = boss.arenaL + 96;
    const h = ((boss.deckY - ey) * (px - endX)) / (lens.x - endX);
    expect(h).toBeLessThan(36);
    expect(endX).toBeGreaterThan(boss.arenaL + 16);
    expect(A.CLAW_H).toBeLessThan(40);
  });
});
