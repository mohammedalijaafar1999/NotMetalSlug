// Chaos fuzz: every mission level, solo and co-op, mortal and invincible players driven by
// random-but-sticky action masks interleaved with the autopilot, with world invariants checked
// every frame (see tests/fuzz-harness.ts).
//
// Default run: a few simulated minutes per case, well under a minute in total.
// Heavier variant: FUZZ_HEAVY=1 npx vitest run tests/fuzz.test.ts (more seeds, longer runs, every
// difficulty). FUZZ_LEVEL=m3 / FUZZ_SEED=3042 narrow it down for reproduction, FUZZ_VERBOSE=1
// prints one coverage line per case.
import { afterEach, describe, expect, it } from 'vitest';
import { input } from '../src/engine/input';
import { allLevels } from '../src/game/level';
import { runFuzz, type FuzzCase } from './fuzz-harness';

const HEAVY = !!process.env.FUZZ_HEAVY;
const ONLY_LEVEL = process.env.FUZZ_LEVEL;
const ONLY_SEED = process.env.FUZZ_SEED ? parseInt(process.env.FUZZ_SEED, 10) : null;

const missionLevels = allLevels()
  .filter((l) => l.mission >= 1 && l.mission <= 6)
  .filter((l) => !ONLY_LEVEL || l.id === ONLY_LEVEL);

function casesFor(levelId: string, mission: number): FuzzCase[] {
  const def = missionLevels.find((l) => l.id === levelId)!;
  const base = mission * 1000;
  const secs = HEAVY ? 420 : 150;
  const seeds = HEAVY ? [1, 2, 3, 4] : [1];
  const out: FuzzCase[] = [];
  // Warp points: in front of each arena (a little before its trigger).
  const lockXs = (def.locks ?? []).map((l) => Math.max(0, (l.trigger ?? l.x) - 420));
  for (const s of seeds) {
    const seed = base + s;
    out.push({ level: levelId, seed, seconds: secs, players: 1, god: [false, false], timer: true });
    out.push({ level: levelId, seed: seed + 10, seconds: secs, players: 1, god: [true, false], chaos: 0.6 });
    out.push({ level: levelId, seed: seed + 20, seconds: secs, players: 2, god: [false, true] });
    out.push({ level: levelId, seed: seed + 30, seconds: secs, players: 1, god: [false, false], joinP2At: 20 + s * 7, timer: true });
    // Later sections: start in front of later arenas so every set piece gets chaos-tested.
    const picks = HEAVY ? lockXs : lockXs.filter((_, i) => i % 2 === 1 || i === lockXs.length - 1);
    picks.forEach((x, k) => {
      out.push({
        level: levelId,
        seed: seed + 40 + k,
        seconds: HEAVY ? 240 : 80,
        players: k % 2 ? 2 : 1,
        god: [k % 3 === 0, k % 2 === 0],
        warpX: x,
        timer: k % 2 === 0,
        difficulty: HEAVY ? ((k % 3) as 0 | 1 | 2) : 2,
      });
    });
  }
  return out.filter((c) => ONLY_SEED === null || c.seed === ONLY_SEED);
}

afterEach(() => {
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
});

describe('chaos fuzz', () => {
  for (const l of missionLevels) {
    it(
      `${l.id}: random sticky inputs + autopilot keep every invariant`,
      () => {
        const all: string[] = [];
        for (const c of casesFor(l.id, l.mission)) {
          const r = runFuzz(c);
          if (process.env.FUZZ_VERBOSE)
            console.log(
              `${r.name}: ${r.simSeconds}s cam=${r.maxCamX} locks ${r.locksDone}/${r.locks} deaths=${r.deaths} continues=${r.continues} vehicles=${r.vehiclesEntered} maxEnt=${r.maxEntities}${r.completed ? ' COMPLETE' : ''} violations=${r.violations.length}`,
            );
          all.push(...r.violations);
        }
        expect(all, all.join('\n')).toEqual([]);
      },
      HEAVY ? 900_000 : 60_000,
    );
  }
});
