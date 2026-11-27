// Mission 2 DUSTWIND CANYON: level contract, the HORNET KING arena, the rigged bridge set piece,
// the mesa climb, and autopilot completion.
import { describe, expect, it } from 'vitest';
import { makeWorld, simulateMission, step } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import { getLevel, type LevelDef } from '../src/game/level';
import { getTheme } from '../src/game/theme';
import { VIEW_H, VIEW_W } from '../src/engine/renderer';
import type { SpawnSpec } from '../src/game/registry';
import { M2_BOSS_X, M2_BRIDGE } from '../src/content/levels/m2';
import { BRIDGE_DROP, SPAN, type Bridge } from '../src/content/levels/m2/bridge';
import type { Vehicle } from '../src/game/vehicle';
import type { Incoming } from '../src/content/levels/m2/incoming';

function level(): LevelDef {
  const L = getLevel('m2');
  if (!L) throw new Error('level m2 not registered');
  return L;
}

/** Every spawn spec of the level (one-off entities and lock waves). */
function allSpawns(L: LevelDef): SpawnSpec[] {
  return [...(L.entities ?? []), ...(L.locks ?? []).flatMap((l) => l.waves.flatMap((w) => w.spawns))];
}

const WEAPON_LETTERS = ['H', 'R', 'S', 'F', 'L', 'C', 'B'];

describe('mission 2 DUSTWIND CANYON - level contract', () => {
  it('is registered with its theme, music and boss', () => {
    const L = level();
    expect(L.mission).toBe(2);
    expect(L.name).toBe('DUSTWIND CANYON');
    expect(L.theme).toBe('m2');
    expect(getTheme('m2').id).toBe('m2');
    expect(L.music).toBe('m2');
    expect(L.bossMusic).toBe('boss');
    expect(L.bossName).toBe('HORNET KING');
    expect(L.subtitle).toBeTruthy();
    expect(L.width).toBeGreaterThanOrEqual(4500);
    expect(L.width).toBeLessThanOrEqual(8000);
    expect(L.timeLimit).toBeGreaterThanOrEqual(60);
    expect(L.timeLimit).toBeLessThanOrEqual(99);
  });

  it('has an uppercase briefing that fits the card', () => {
    const b = level().briefing ?? '';
    expect(b).toBe(b.toUpperCase());
    // Greedy wrap at ~36 characters per line: at most 11 lines.
    let lines = 1;
    let len = 0;
    for (const word of b.split(/\s+/)) {
      if (len && len + 1 + word.length > 36) {
        lines++;
        len = word.length;
      } else len += (len ? 1 : 0) + word.length;
    }
    expect(lines).toBeLessThanOrEqual(11);
  });

  it('has 8-11 hostages (mixed modes) and weapon pickups in the open', () => {
    const L = level();
    const hostages = allSpawns(L).filter((s) => s.type === 'hostage');
    expect(hostages.length).toBeGreaterThanOrEqual(8);
    expect(hostages.length).toBeLessThanOrEqual(11);
    const modes = new Set(hostages.map((h) => h.props?.mode ?? 'tied'));
    expect(modes).toEqual(new Set(['tied', 'caged', 'wander']));
    // Hostages hand out the good weapons.
    const drops = hostages.map((h) => String(h.props?.drop ?? ''));
    expect(drops.filter((d) => WEAPON_LETTERS.includes(d)).length).toBeGreaterThanOrEqual(5);
    const crates = (L.entities ?? []).filter((s) => s.type === 'pickup' && WEAPON_LETTERS.includes(String(s.props?.item)));
    expect(crates.length).toBeGreaterThanOrEqual(2);
  });

  it('has 3-6 arenas of 2-4 waves, a bomb supply before each, and checkpoints every <= 1200 px', () => {
    const L = level();
    const arenas = (L.locks ?? []).filter((l) => !l.boss);
    expect(arenas.length).toBeGreaterThanOrEqual(3);
    expect(arenas.length).toBeLessThanOrEqual(6);
    for (const a of arenas) {
      expect(a.waves.length).toBeGreaterThanOrEqual(2);
      expect(a.waves.length).toBeLessThanOrEqual(4);
      // A bomb pickup / bomb crate within ~700 px before the arena.
      const bombs = (L.entities ?? []).filter((s) => (s.props?.item === 'bomb' || s.props?.drop === 'bomb') && s.x < a.x + VIEW_W && s.x > a.x - 700);
      expect(bombs.length, `bombs before lock ${a.x}`).toBeGreaterThan(0);
    }
    const cps = [0, ...(L.checkpoints ?? []), M2_BOSS_X];
    for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1], `checkpoint gap at ${cps[i]}`).toBeLessThanOrEqual(1200);
  });

  it('uses the signature trucks with bazooka troops, a vehicle beat and a mix of the roster', () => {
    const L = level();
    const sp = allSpawns(L);
    const types = new Set(sp.map((s) => s.type));
    expect(sp.some((s) => s.type === 'truck' && s.props?.troop === 'bazooka')).toBe(true);
    for (const t of ['rifleman', 'grenadier', 'bazooka', 'saber', 'shield_trooper', 'mortar', 'sniper', 'jeep', 'truck', 'heli', 'light_tank', 'bunker', 'turret', 'mech', 'officer']) {
      expect(types.has(t), t).toBe(true);
    }
  });

  it('uses at least six of its own decor kinds', () => {
    const L = level();
    const theme = getTheme('m2');
    const kinds = new Set((L.decor ?? []).map((d) => d.kind));
    for (const k of kinds) expect(theme.decor?.[k], `decor kind ${k}`).toBeTruthy();
    expect(kinds.size).toBeGreaterThanOrEqual(6);
  });
});

describe('mission 2 - HORNET KING arena', () => {
  it('is a flat, clear screen at the level bottom with room for the torn rotor', () => {
    const L = level();
    const lock = (L.locks ?? []).find((l) => l.boss)!;
    expect(lock).toBeTruthy();
    expect(lock.x).toBe(M2_BOSS_X);
    expect(lock.music).toBe('boss');
    expect(lock.announce?.startsWith('WARNING')).toBe(true);
    expect(lock.waves[0].spawns[0].type).toBe('boss_m2');
    const w = makeWorld('m2');
    const x0 = lock.x;
    const groundY = w.terrain.groundTopAt(x0 + VIEW_W / 2);
    expect(groundY).toBe(L.height - 32);
    // One flat height across the arena plus ~150 px either side.
    for (let x = x0 - 150; x <= x0 + VIEW_W + 150; x += 4) expect(w.terrain.groundTopAt(x), `ground at ${x}`).toBe(groundY);
    expect(L.width).toBeGreaterThanOrEqual(x0 + VIEW_W + 150);
    // Nothing but ground inside the locked screen.
    const inside = (a: number, b: number) => b > x0 && a < x0 + VIEW_W;
    for (const p of L.platforms ?? []) expect(inside(p.x, p.x + p.w), `platform at ${p.x}`).toBe(false);
    for (const s of L.solids ?? []) expect(inside(s.x, s.x + s.w), `solid at ${s.x}`).toBe(false);
    for (const wt of L.water ?? []) expect(inside(wt.x, wt.x + wt.w), `water at ${wt.x}`).toBe(false);
    for (const d of L.decor ?? []) if (d.layer === 'front') expect(inside(d.x - 8, d.x + 8), `front decor ${d.kind}`).toBe(false);
    // Camera at the level bottom (no camera keys around the arena).
    const bounds = w.camera.boundsAt(x0);
    expect(bounds.minY).toBe(L.height - VIEW_H);
    expect(bounds.maxY).toBe(L.height - VIEW_H);
    // No regular enemies are still pending inside the arena.
    for (const s of L.entities ?? []) if (s.x > x0 - 40 && s.x < x0 + VIEW_W + 160) expect(['hostage', 'pickup'], `${s.type} at ${s.x}`).toContain(s.type);
  });

  it('leaves time to spare on Hard: a pistol + 10 grenades fight ends with >= 25 % of the timer left', () => {
    // A tidy scripted player (under the hull, out of marked spots, aiming up, grenades in the
    // re-arm hover) needed 70-76 s on Hard; a human is slower, and TIME UP costs a life.
    const w = makeWorld('m2', { seed: 2, difficulty: 2 });
    const p = w.players[0];
    w.level.warp(M2_BOSS_X - 300);
    p.x = M2_BOSS_X - 200;
    step(w, 30);
    for (const e of w.entities) if (e.team === 'enemy') e.remove();
    p.bombs = 10;
    let timeUps = 0;
    w.level.timerEnabled = true;
    w.level.onTimeUp = () => timeUps++;
    let leftAtKill = -1;
    for (let i = 0; i < 60 * 200 && w.state !== 'complete'; i++) {
      const b = w.boss as any;
      const mask: Record<string, boolean> = {};
      if (!w.level.locked) mask.right = true;
      if (b && b.dying && leftAtKill < 0) leftAtKill = w.level.timeLeft;
      if (b && b.introDone && !b.dying) {
        const threats: { x: number; r: number }[] = [];
        for (const e of w.query((x) => x.constructor.name === 'LockMark')) threats.push({ x: e.x, r: 30 });
        for (const e of w.query((x) => x.constructor.name === 'CarpetBomb')) threats.push({ x: (e as any).tx, r: 25 });
        const safe = (x: number) => threats.every((th) => Math.abs(th.x - x) > th.r);
        const crosses = (a: number, c: number) => threats.some((th) => th.x + th.r > Math.min(a, c) && th.x - th.r < Math.max(a, c));
        let target = Math.max(b.arenaL + 10, Math.min(b.arenaR - 10, b.x - b.facing * 12));
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
        } else if (crosses(p.x, target)) target = p.x;
        if (target > p.x + 3) mask.right = true;
        else if (target < p.x - 3) mask.left = true;
        mask.up = true;
        mask.fire = i % 8 < 4;
        if (p.bombs > 0 && b.state === 'reload' && i % 30 === 0) {
          mask.bomb = true;
          mask.up = false;
        }
      }
      input.setVirtual(0, mask);
      step(w, 1);
    }
    input.setVirtual(0, null);
    expect(w.state).toBe('complete');
    expect(timeUps).toBe(0);
    expect(leftAtKill).toBeGreaterThanOrEqual(0.25 * level().timeLimit!);
  }, 60_000);
});

describe('mission 2 - rigged rail bridge', () => {
  /** World with the camera at the bridge, the bridge spawned, the player on the deck. */
  function bridgeWorld(god: boolean) {
    const w = makeWorld('m2', { god });
    w.level.warp(M2_BRIDGE.x1 + 20); // past the bridge lock (no waves), level bridge spawn skipped
    const cx = M2_BRIDGE.x1 + (M2_BRIDGE.spans * SPAN) / 2;
    const bridge = w.spawn('m2_bridge', cx, M2_BRIDGE.y, { spans: M2_BRIDGE.spans }) as Bridge;
    const p = w.players[0];
    p.x = M2_BRIDGE.x1 + 150;
    p.y = M2_BRIDGE.y - 30;
    p.vy = 0;
    step(w, 60);
    return { w, bridge, p };
  }

  it('carries the player on its deck until it is blown', () => {
    const { w, bridge, p } = bridgeWorld(true);
    expect(bridge.deck.every((s) => !!s)).toBe(true);
    expect(p.onGround).toBe(true);
    expect(Math.round(p.y)).toBe(M2_BRIDGE.y);
    step(w, 120);
    expect(Math.round(p.y)).toBe(M2_BRIDGE.y);
  });

  it('a detonator arms it, telegraphs, collapses it span by span and only then releases the wave', () => {
    const { w, bridge, p } = bridgeWorld(false);
    const mech = w.spawn('mech', M2_BRIDGE.x1 + 60, M2_BRIDGE.y) as Vehicle;
    step(w, 30);
    expect(Math.round(mech.y)).toBe(M2_BRIDGE.y);
    const det = w.spawn('m2_detonator', bridge.x, M2_BRIDGE.y)!;
    expect(det.blocksProgress).toBe(true);
    step(w, 1);
    expect(bridge.state).toBe('armed');
    // Telegraph: nothing falls for the first 2 s.
    step(w, 120);
    expect(bridge.deck.every((s) => !!s)).toBe(true);
    expect(Math.round(p.y)).toBe(M2_BRIDGE.y);
    let sawPartial = false;
    for (let i = 0; i < 600 && !bridge.down; i++) {
      step(w, 1);
      const n = bridge.deck.filter((s) => !!s).length;
      if (n > 0 && n < bridge.deck.length) sawPartial = true;
    }
    expect(bridge.down).toBe(true);
    expect(sawPartial).toBe(true);
    expect(bridge.deck.every((s) => s === null)).toBe(true);
    expect(w.terrain.surfaces.some((s) => s.owner === bridge && !s.disabled)).toBe(false);
    // The detonator leaves shortly after the collapse so the lock can release.
    step(w, 60);
    expect(det.dead).toBe(true);
    // Everyone dropped into the riverbed; the blasts never hurt the (mortal) player.
    step(w, 60);
    expect(p.dead).toBe(false);
    expect(['play', 'respawn']).toContain(p.state);
    expect(Math.round(p.y)).toBe(M2_BRIDGE.y + BRIDGE_DROP);
    // The walker parked on the deck was wrecked with the span.
    expect((mech as any).destroyed || mech.dead).toBe(true);
  });

  it('no walker survives it: not one in the air over a falling span, nor one parked on the far abutment', () => {
    const { w, bridge, p } = bridgeWorld(true);
    const x2 = M2_BRIDGE.x1 + M2_BRIDGE.spans * SPAN;
    // The pilot waits on the far abutment (where the lock screen ends) ...
    const parked = w.spawn('mech', x2 + 30, M2_BRIDGE.y) as Vehicle;
    p.x = x2 + 30;
    step(w, 20);
    p.enterVehicle(parked);
    step(w, 20);
    expect(p.vehicle).toBe(parked);
    w.spawn('m2_detonator', bridge.x, M2_BRIDGE.y);
    for (let i = 0; i < 300 && bridge.state !== 'blowing'; i++) step(w, 1);
    // ... while an empty one is hopping over the far span as it drops.
    const hopping = w.spawn('mech', x2 - 30, M2_BRIDGE.y - 60) as Vehicle;
    hopping.vy = -200;
    for (let i = 0; i < 600 && !bridge.down; i++) step(w, 1);
    step(w, 90);
    expect((parked as any).destroyed || parked.dead).toBe(true);
    expect((hopping as any).destroyed || hopping.dead).toBe(true);
    expect(p.vehicle).toBeFalsy();
    expect(['play', 'respawn']).toContain(p.state);
  });
});

describe('mission 2 - incoming-vehicle warning', () => {
  it('telegraphs first, spawns the vehicle after the delay and blocks until it is gone', () => {
    const w = makeWorld('m2');
    w.level.warp(5300);
    w.players[0].x = 5400;
    w.players[0].y = 380;
    step(w, 30);
    const x = w.camera.x - 60;
    const inc = w.spawn('m2_incoming', x, undefined, { type: 'jeep', delay: 1.2, props: { facing: 1, stopX: w.camera.x + 120 } }) as Incoming;
    expect(inc.blocksProgress).toBe(true);
    step(w, 60);
    expect(inc.child).toBe(null);
    expect(w.entities.some((e) => e.type === 'jeep')).toBe(false);
    step(w, 20);
    const jeep = inc.child!;
    expect(jeep?.type).toBe('jeep');
    step(w, 60);
    expect(inc.dead).toBe(false);
    jeep.damage({ amount: 9999, kind: 'explosion', owner: w.players[0] });
    for (let i = 0; i < 1200 && !inc.dead; i++) step(w, 1);
    expect(inc.dead).toBe(true);
  });

  it('without a type it just goes away', () => {
    const w = makeWorld('m2');
    const inc = w.spawn('m2_incoming', w.camera.x + 100, undefined, {})!;
    step(w, 2);
    expect(inc.dead).toBe(true);
  });

  it('is used for every vehicle that enters an arena from behind the player', () => {
    for (const lock of level().locks ?? []) {
      for (const wave of lock.waves) {
        for (const s of wave.spawns) {
          if (['truck', 'jeep', 'light_tank'].includes(s.type)) expect(s.x, `${s.type} at ${s.x} enters from the left of lock ${lock.x}`).toBeGreaterThan(lock.x + VIEW_W);
        }
      }
    }
  });
});

describe('mission 2 - mesa climb', () => {
  it('lets the camera rise for the climb and returns to the bottom for the oil field', () => {
    const w = makeWorld('m2');
    const L = level();
    const bottom = L.height - VIEW_H;
    expect(w.camera.boundsAt(3800).minY).toBeLessThan(bottom - 150);
    expect(w.camera.boundsAt(4400).minY).toBeLessThan(bottom - 150);
    expect(w.camera.boundsAt(5600).minY).toBe(bottom);
    // The mesa top is ~200 px above the canyon floor.
    expect(w.terrain.groundTopAt(4300)).toBeLessThan(w.terrain.groundTopAt(3600) - 150);
  });
});

describe('mission 2 - autopilot', () => {
  it('the invincible autopilot completes the mission', () => {
    const r = simulateMission('m2', 900);
    if (!r.completed) console.log(JSON.stringify(r));
    expect(r.completed).toBe(true);
    expect(r.rescues).toBeGreaterThanOrEqual(6);
  }, 300_000);

  it('completes it on other seeds and on hard', () => {
    for (const [seed, difficulty] of [
      [2, 1],
      [3, 1],
      [4, 2],
    ] as const) {
      const r = simulateDiag(seed, difficulty, 900);
      expect(r.completed, `seed ${seed} difficulty ${difficulty}: ${r.info}`).toBe(true);
    }
  }, 600_000);
});

/** Autopilot run (invincible) that reports what blocks the active lock when it does not finish. */
function simulateDiag(seed: number, difficulty: 0 | 1 | 2, maxSeconds: number): { completed: boolean; info: string } {
  const w = makeWorld('m2', { seed, god: true, difficulty });
  const bots = w.players.map((p) => new Bot(p.index));
  let i = 0;
  for (; i < maxSeconds * 60 && w.state !== 'complete'; i++) step(w, 1, bots);
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
  const al = (w.level as any).activeLock;
  const blockers = al ? al.tracked.filter((e: any) => !e.dead && e.blocksProgress).map((e: any) => `${e.type}@${Math.round(e.x)},${Math.round(e.y)}:${e.state ?? ''}:hp${e.hp}`) : [];
  const p = w.players[0];
  return {
    completed: w.state === 'complete',
    info: `t=${Math.round(i / 60)} cam=${Math.round(w.camera.x)},${Math.round(w.camera.y)} p=${Math.round(p.x)},${Math.round(p.y)}:${p.state} wave=${al ? al.wave : '-'} blockers=[${blockers.join(' ')}]`,
  };
}
