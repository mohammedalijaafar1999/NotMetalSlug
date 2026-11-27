// Camera-lock arenas must always be clearable: wave enemies never idle out of view.
import { describe, expect, it } from 'vitest';
import { makeWorld, step } from './helpers';
import type { LevelDef } from '../src/game/level';
import { LOCK_AWAY_GIVEUP } from '../src/game/level';

const base = (id: string, spawns: { type: string; x: number; props?: Record<string, any> }[]): LevelDef => ({
  id,
  mission: 0,
  name: 'ARENA TEST',
  theme: 'default',
  music: 'm1',
  width: 2000,
  height: 216,
  start: { x: 560 },
  ground: [[[0, 180], [2000, 180]]],
  locks: [{ x: 400, trigger: 0, waves: [{ spawns }] }],
});

describe('arena locks', () => {
  it('a soldier who would hold his range just past the screen edge walks back into view', () => {
    const w = makeWorld(base('arena_leash', [{ type: 'rifleman', x: 388, props: { behavior: 'guard', facing: 1 } }]), { god: true });
    step(w, 60 * 5);
    const r = w.query((e) => e.type === 'rifleman')[0];
    expect(r).toBeTruthy();
    expect(w.level.locked).toBe(true);
    expect(r.onScreen(-8)).toBe(true);
  });

  it('a wave enemy that can never come into view stops blocking the arena', () => {
    const w = makeWorld(base('arena_giveup', [{ type: 'turret', x: 300 }]), { god: true });
    step(w, 60 * 3);
    expect(w.level.locked).toBe(true);
    step(w, 60 * (LOCK_AWAY_GIVEUP + 2));
    expect(w.level.locked).toBe(false);
    expect(w.level.lockStates()[0].state).toBe('done');
  });
});
