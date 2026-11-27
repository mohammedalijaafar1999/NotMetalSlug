// THUNDERHEAD (boss_m5): registration, arena, entrance invulnerability, phases and attacks, fairness
// (projectile speeds, telegraphs), the autopilot win in the gyro, death and difficulty scaling.
import { describe, expect, it } from 'vitest';
import { makeWorld, simulateMission, step, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import { audio } from '../src/engine/audio';
import { sprites } from '../src/engine/sprites';
import { getEntityType } from '../src/game/registry';
import { getLevel } from '../src/game/level';
import { Projectile } from '../src/game/projectile';
import type { World } from '../src/game/world';
import { SFX_NAMES } from '../src/content/sfx/canonical';
import { BASE_HP, INTRO_TIME, Thunderhead } from '../src/content/bosses/m5/thunderhead';
import { LightningStrike, M5_SFX, SkyMine, WreckHalf } from '../src/content/bosses/m5/projectiles';

function bossOf(w: World): Thunderhead | null {
  return w.boss instanceof Thunderhead ? w.boss : null;
}

/** Step (optionally with autopilots) until the boss has spawned. */
function untilBoss(w: World, bots: Bot[] = [], maxSeconds = 30): Thunderhead {
  for (let i = 0; i < maxSeconds / DT && !bossOf(w); i++) step(w, 1, bots);
  const b = bossOf(w);
  if (!b) throw new Error('boss never spawned');
  return b;
}

function releaseBots(): void {
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
}

describe('boss_m5 THUNDERHEAD', () => {
  it('is registered as a boss with a documented arena, and its test arena is a gyro sky lock', () => {
    const info = getEntityType('boss_m5');
    expect(info?.category).toBe('boss');
    expect(info?.description).toMatch(/gyro/i);
    expect(info?.description).toMatch(/camera/i);
    const L = getLevel('bosstest_m5')!;
    expect(L.startVehicle).toBe('gyro');
    const lock = L.locks!.find((l) => l.boss)!;
    expect(lock.announce).toMatch(/^WARNING/);
    expect(lock.waves.flatMap((w) => w.spawns).some((s) => s.type === 'boss_m5')).toBe(true);
    // Nothing to stand on inside the view: the only ground is far below the screen.
    for (const line of L.ground) for (const [, y] of line) expect(y).toBeGreaterThan(L.height + 80);
    expect(L.platforms ?? []).toEqual([]);
    expect(L.solids ?? []).toEqual([]);
  });

  it('uses only canonical sound names and bakes non-empty art', () => {
    for (const n of M5_SFX) {
      expect(SFX_NAMES, n).toContain(n);
      expect(audio.hasSfx(n), n).toBe(true);
    }
    const names = sprites.all().filter((s) => s.name.startsWith('bm5_'));
    expect(names.length).toBeGreaterThanOrEqual(12);
    for (const s of names) for (let f = 0; f < s.frameCount; f++) expect(s.pixelArt(f).opaqueCount(), `${s.name}#${f}`).toBeGreaterThan(0);
  });

  it('cannot be hurt during its entrance, then becomes hittable', () => {
    const w = makeWorld('bosstest_m5');
    const b = untilBoss(w);
    expect(b.maxHp).toBe(BASE_HP);
    step(w, 30);
    expect(b.introDone).toBe(false);
    expect(b.hittable).toBe(false);
    const p = w.players[0];
    expect(b.damage({ amount: 50, kind: 'explosion', owner: p, x: b.x, y: b.y })).toBe(false);
    for (const t of b.turrets) expect(t.hittable).toBe(false);
    expect(w.targets('player').includes(b)).toBe(false);
    // A bomb blast on it during the entrance does nothing either.
    w.explode(b.x, b.y, { radius: 40, damage: 30, team: 'player', owner: p });
    expect(b.hp).toBe(b.maxHp);
    step(w, Math.round(INTRO_TIME / DT));
    expect(b.introDone).toBe(true);
    expect(b.hittable).toBe(true);
    expect(b.damage({ amount: 10, kind: 'bullet', owner: p, x: b.x, y: b.y })).toBe(true);
    expect(b.hp).toBeLessThan(b.maxHp);
    for (const t of b.turrets) expect(t.hittable).toBe(true);
  });

  it('holds its station on the right of the locked camera, inside the view', () => {
    const w = makeWorld('bosstest_m5');
    const b = untilBoss(w);
    step(w, Math.round((INTRO_TIME + 1) / DT));
    const cam = w.camera;
    const a = b.deathArea();
    expect(a.x).toBeGreaterThan(cam.x + 150);
    expect(a.y).toBeGreaterThan(cam.y + 40);
    expect(a.y + a.h).toBeLessThan(cam.y + 216);
    // The autopilot's target (the entity box) is on screen and left of the ship's middle.
    expect(b.onScreen(-4)).toBe(true);
    expect(b.x).toBeLessThan(b.shipX);
  });

  it('reaches every phase and uses every attack, with dodgeable projectiles', () => {
    const w = makeWorld('bosstest_m5', { seed: 3 });
    const bots = w.players.map((p) => new Bot(p.index));
    const b = untilBoss(w, bots);
    const phases = new Set<number>();
    const states = new Set<string>();
    let mines = 0;
    let drones = 0;
    let strikes = 0;
    let maxShot = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 200 / DT && !b.dying && !b.dead; i++) {
      step(w, 1, bots);
      phases.add(b.phase);
      states.add(b.state);
      for (const e of w.entities) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        if (e instanceof SkyMine) mines++;
        if (e instanceof LightningStrike) strikes++;
        if (e.type === 'drone') drones++;
        if (e instanceof Projectile && e.team === 'enemy' && e.owner === b) maxShot = Math.max(maxShot, Math.hypot(e.vx, e.vy));
      }
    }
    releaseBots();
    expect([...phases].sort()).toEqual([0, 1, 2]);
    for (const s of ['intro', 'mines', 'drones', 'broadside', 'lightning', 'stagger']) expect(states, s).toContain(s);
    expect(b.coreOpen).toBe(true);
    expect(mines).toBeGreaterThan(3);
    expect(drones).toBeGreaterThan(1);
    expect(strikes).toBeGreaterThan(0);
    expect(maxShot).toBeGreaterThan(90);
    expect(maxShot).toBeLessThanOrEqual(220);
  }, 60_000);

  it('telegraphs lightning: tracking, then a lock, before the bolt can do damage', () => {
    const w = makeWorld('bosstest_m5');
    const b = untilBoss(w);
    step(w, Math.round((INTRO_TIME + 0.2) / DT));
    b.hp = b.maxHp * 0.25;
    let s: LightningStrike | null = null;
    for (let i = 0; i < 20 / DT && !s; i++) {
      step(w, 1);
      s = (w.entities.find((e) => e instanceof LightningStrike) as LightningStrike | undefined) ?? null;
    }
    expect(s).toBeTruthy();
    const stages = new Set<string>();
    let pre = 0;
    while (s!.stage !== 'bolt' && !s!.dead) {
      stages.add(s!.stage);
      // Nothing can be struck before the bolt.
      expect((s as unknown as { hitIds: Set<number> }).hitIds.size).toBe(0);
      step(w, 1);
      pre += DT;
    }
    expect([...stages]).toEqual(['track', 'lock']);
    expect(pre).toBeGreaterThan(0.85);
  });

  it('is defeated by the autopilot flying the gyro', () => {
    const r = simulateMission('bosstest_m5', 300);
    if (!r.completed) console.log('bosstest_m5', JSON.stringify(r));
    expect(r.completed).toBe(true);
    expect(r.seconds).toBeLessThan(150);
  }, 120_000);

  it('dies with a plunge that completes the mission and leaves falling wreckage', () => {
    const w = makeWorld('bosstest_m5');
    const b = untilBoss(w);
    step(w, Math.round((INTRO_TIME + 0.5) / DT));
    const a0 = b.deathArea();
    b.damage({ amount: 9999, kind: 'explosion', owner: w.players[0], x: b.x, y: b.y });
    expect(b.dying).toBe(true);
    expect(b.hittable).toBe(false);
    let wrecks = 0;
    for (let i = 0; i < 8 / DT && w.state !== 'complete'; i++) {
      step(w, 1);
      if (!b.dead) {
        // Explosions stay on the body: the death area follows the sinking ship.
        const a = b.deathArea();
        expect(Math.abs(a.x - a0.x)).toBeLessThan(40);
      }
      wrecks = Math.max(wrecks, w.entities.filter((e) => e instanceof WreckHalf).length);
    }
    expect(w.state).toBe('complete');
    expect(wrecks).toBe(2);
    expect(w.boss).toBeNull();
    // Its score went to the player.
    expect(w.players[0].profile.score).toBeGreaterThanOrEqual(30000);
  });

  it('scales its health with difficulty', () => {
    const easy = untilBoss(makeWorld('bosstest_m5', { difficulty: 0 }));
    const hard = untilBoss(makeWorld('bosstest_m5', { difficulty: 2 }));
    expect(easy.maxHp).toBe(Math.round(BASE_HP * 0.8));
    expect(hard.maxHp).toBe(Math.round(BASE_HP * 1.3));
  });

  it('nudges a gyro out of its hull instead of letting it fly through', () => {
    const w = makeWorld('bosstest_m5');
    const b = untilBoss(w);
    step(w, Math.round((INTRO_TIME + 0.5) / DT));
    const g = w.players[0].vehicle!;
    // Park the gyro inside the gondola.
    const r = b.rectAt(20, 33, 60, 58);
    g.x = r.x + r.w / 2;
    g.y = r.y + r.h;
    const x0 = g.x;
    const y0 = g.y;
    step(w, 30);
    const moved = Math.hypot(g.x - x0, g.y - y0);
    expect(moved).toBeGreaterThan(8);
  });
});
