// Gameplay-core regressions found by the chaos fuzz (tests/fuzz.test.ts) and the core review:
// the scrolling screen edge, respawn drop points, side overlaps, ledge assist, TIME UP in vehicles.
import { afterEach, describe, expect, it } from 'vitest';
import { makeWorld, step } from './helpers';
import { input } from '../src/engine/input';
import { VIEW_W } from '../src/engine/renderer';
import type { LevelDef } from '../src/game/level';
import type { Player } from '../src/game/player';
import type { Vehicle } from '../src/game/vehicle';
import type { World } from '../src/game/world';

const level = (id: string, extra: Partial<LevelDef>): LevelDef => ({
  id,
  mission: 0,
  name: 'CORE TEST',
  theme: 'default',
  music: 'm1',
  width: 3000,
  height: 216,
  start: { x: 200 },
  ground: [[[0, 180], [3000, 180]]],
  ...extra,
});

/** Settle players on the floor (respawn drop) for a second. */
function settle(w: World): void {
  step(w, 60);
}

afterEach(() => {
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
});

describe('the scrolling screen edge never buries anyone in the terrain', () => {
  it('lifts a trailing co-op player onto a low block instead of pushing him into it', () => {
    const w = makeWorld(level('core_push_low', { solids: [{ x: 420, y: 150, w: 60, h: 30 }] }), { players: 2, god: true });
    settle(w);
    const [p1, p2] = w.players;
    p1.x = 560;
    p2.x = 400;
    let inside = 0;
    let worst = 0;
    for (let i = 0; i < 60 * 6; i++) {
      input.setVirtual(0, { right: true });
      step(w, 1);
      inside = p2.bodyBlocked() ? inside + 1 : 0;
      worst = Math.max(worst, inside);
    }
    expect(w.camera.x).toBeGreaterThan(400);
    expect(worst).toBeLessThanOrEqual(1);
    expect(p2.state).toBe('play');
    expect(p2.x).toBeGreaterThanOrEqual(w.camera.x);
  });

  it('drops a player pinned behind a tall wall back in next to the partner, keeping weapon and lives', () => {
    const w = makeWorld(level('core_push_wall', { solids: [{ x: 420, y: 60, w: 24, h: 120 }] }), { players: 2, god: false });
    settle(w);
    const [p1, p2] = w.players;
    p1.x = 520;
    p2.x = 400;
    p2.giveWeapon('hmg');
    const lives = p2.profile.lives;
    let worst = 0;
    let inside = 0;
    let dropped = false;
    for (let i = 0; i < 60 * 8; i++) {
      input.setVirtual(0, { right: true });
      step(w, 1);
      inside = p2.state !== 'dying' && p2.bodyBlocked() ? inside + 1 : 0;
      worst = Math.max(worst, inside);
      if (p2.state === 'respawn') dropped = true;
    }
    expect(worst).toBeLessThanOrEqual(1);
    expect(dropped).toBe(true);
    expect(p2.state).toBe('play');
    expect(p2.x).toBeGreaterThan(444);
    expect(p2.weapon.id).toBe('hmg');
    expect(p2.profile.lives).toBe(lives);
  });

  it('a trailing player pushed into a cliff (ground step) does not fall through the earth', () => {
    const w = makeWorld(
      level('core_push_cliff', {
        ground: [
          [
            [0, 190],
            [500, 190],
            [500, 110],
            [3000, 110],
          ],
        ],
      }),
      { players: 2, god: false },
    );
    settle(w);
    const [p1, p2] = w.players;
    // Both in view: P1 on the cliff top, P2 at its foot, about to be shoved into its face.
    w.camera.x = w.camera.minX = 300;
    p1.x = 600;
    p1.y = 110;
    p2.x = 470;
    p2.y = 190;
    const lives = p2.profile.lives;
    for (let i = 0; i < 60 * 8; i++) {
      input.setVirtual(0, { right: true });
      step(w, 1);
      expect(p2.y, `t=${w.time.toFixed(2)}`).toBeLessThan(w.terrain.killY);
    }
    expect(p2.state).toBe('play');
    expect(p2.y).toBeCloseTo(110, 0);
    expect(p2.profile.lives).toBe(lives);
  });

  it('the auto-scroll edge slides a gyro clear of an airship hull', () => {
    const w = makeWorld(
      level('core_push_gyro', {
        width: 3000,
        ground: [[[0, 200], [3000, 200]]],
        solids: [{ x: 330, y: 120, w: 140, h: 40 }],
        autoScroll: [{ x1: 0, x2: 2500, speed: 40 }],
        startVehicle: 'gyro',
        start: { x: 120 },
      }),
      { god: true },
    );
    step(w, 2);
    const g = w.players[0].vehicle as Vehicle;
    expect(g?.type).toBe('gyro');
    g.x = w.camera.x + 30;
    g.y = 150;
    let inside = 0;
    let worst = 0;
    for (let i = 0; i < 60 * 12; i++) {
      step(w, 1);
      inside = g.bodyBlocked() ? inside + 1 : 0;
      worst = Math.max(worst, inside);
      expect(g.x).toBeGreaterThanOrEqual(w.camera.x + g.w / 2 + 1);
    }
    expect(w.camera.x).toBeGreaterThan(470);
    expect(worst).toBeLessThanOrEqual(1);
  });
});

describe('respawns', () => {
  it('never drop a player into a cliff that rises above the top of the screen', () => {
    const w = makeWorld(
      level('core_respawn_cliff', {
        width: 1400,
        height: 432,
        start: { x: 150 },
        ground: [
          [
            [0, 400],
            [300, 400],
            [300, 196],
            [1400, 196],
          ],
        ],
      }),
      { god: false },
    );
    settle(w);
    const p = w.players[0];
    expect(w.camera.y).toBeGreaterThan(196 - 40);
    const lives = p.profile.lives;
    p.respawn(340);
    for (let i = 0; i < 60 * 3; i++) {
      step(w, 1);
      expect(p.y, `t=${w.time.toFixed(2)}`).toBeLessThanOrEqual(w.terrain.groundTopAt(p.x) + 1);
    }
    expect(p.state).toBe('play');
    expect(p.profile.lives).toBe(lives);
  });
});

describe('respawn drop points', () => {
  it('keep clear of the lip of a pit, so steering during the drop does not fall in', () => {
    const w = makeWorld(
      level('core_respawn_lip', {
        ground: [
          [
            [0, 180],
            [300, 180],
          ],
          [
            [360, 180],
            [3000, 180],
          ],
        ],
      }),
      { god: false },
    );
    settle(w);
    const p = w.players[0];
    const lives = p.profile.lives;
    p.respawn(296);
    expect(p.x).toBeLessThanOrEqual(300 - 24);
    // Hold toward the pit for the whole drop.
    while (p.state === 'respawn' && w.time < 10) {
      input.setVirtual(0, { right: true });
      step(w, 1);
    }
    input.setVirtual(0, null);
    expect(p.state).toBe('play');
    expect(p.onGround).toBe(true);
    expect(p.profile.lives).toBe(lives);
  });
});

describe('collision feel', () => {
  it('stepping off the edge of a box and stopping does not leave the body inside it', () => {
    const w = makeWorld(level('core_box_edge', { solids: [{ x: 300, y: 150, w: 40, h: 30 }], start: { x: 320, y: 150 } }), { god: true });
    settle(w);
    const p = w.players[0];
    p.x = 336;
    p.y = 150;
    step(w, 2);
    expect(p.onGround).toBe(true);
    for (let i = 0; i < 4; i++) {
      input.setVirtual(0, { right: true });
      step(w, 1);
    }
    input.setVirtual(0, null);
    step(w, 60);
    expect(p.y).toBe(180);
    expect(p.bodyBlocked()).toBe(false);
    expect(p.left).toBeGreaterThanOrEqual(340 - 0.01);
  });

  it('a jump that comes down just below the far ledge lands on it (ledge assist)', () => {
    const w = makeWorld(
      level('core_ledge', {
        ground: [
          [
            [0, 180],
            [300, 180],
          ],
          [
            [340, 176],
            [3000, 176],
          ],
        ],
      }),
      { god: false },
    );
    settle(w);
    const p = w.players[0];
    // Falling at the far side of the pit, feet 3 px below the ledge top, moving right.
    p.x = 333;
    p.y = 179;
    p.vy = 120;
    p.onGround = false;
    input.setVirtual(0, { right: true });
    step(w, 3);
    expect(p.onGround).toBe(true);
    expect(p.y).toBe(176);
    expect(p.x).toBeGreaterThanOrEqual(340);
  });
});

describe('low ceilings', () => {
  it('ejecting from a mech under a low ceiling never puts the pilot inside it', () => {
    const w = makeWorld(level('core_eject_ceiling', { solids: [{ x: 230, y: 96, w: 200, h: 24 }], entities: [{ type: 'mech', x: 300, y: 180, trigger: 0 }] }), { god: false });
    settle(w);
    const p = w.players[0];
    const mech = w.query((e) => e.type === 'mech')[0] as unknown as Vehicle;
    p.x = mech.x;
    input.setVirtual(0, { down: true });
    step(w, 3);
    input.setVirtual(0, null);
    step(w, 30);
    expect(p.state).toBe('vehicle');
    input.setVirtual(0, { down: true, jump: true });
    let worst = 0;
    for (let i = 0; i < 90; i++) {
      step(w, 1);
      if (i === 2) input.setVirtual(0, null);
      if (p.state === 'play' && p.bodyBlocked()) worst++;
    }
    expect(p.state).toBe('play');
    expect(worst).toBe(0);
    expect(p.y).toBe(180);
  });

  it('a crawl space keeps the player crouched: no standing up or jumping into the solid above', () => {
    const w = makeWorld(level('core_crawl', { solids: [{ x: 300, y: 130, w: 100, h: 30 }] }), { god: false });
    settle(w);
    const p = w.players[0];
    p.x = 280;
    for (let i = 0; i < 60; i++) {
      input.setVirtual(0, { down: true, right: true });
      step(w, 1);
    }
    expect(p.x).toBeGreaterThan(310);
    for (let i = 0; i < 60; i++) {
      input.setVirtual(0, i % 10 < 3 ? { jump: true } : {});
      step(w, 1);
      expect(p.bodyBlocked(), `frame ${i}`).toBe(false);
    }
    input.setVirtual(0, null);
    expect(p.y).toBe(180);
    expect(p.crouching).toBe(true);
  });
});

describe('projectiles', () => {
  it('fast bullets never skip through a thin deck plate', () => {
    // Every bullet of a burst samples the same heights, so try the plate at every phase.
    let fired = 0;
    let through = 0;
    for (let py = 96; py < 104; py++) {
      const w = makeWorld(level('core_thin_plate', { start: { x: 60 }, solids: [{ x: 120, y: py, w: 200, h: 5 }] }), { god: true });
      settle(w);
      const p = w.players[0];
      // Under the plate, on the floor.
      p.x = 220;
      p.y = 180;
      step(w, 2);
      expect(p.onGround).toBe(true);
      p.giveWeapon('hmg');
      const seen = new Set<number>();
      for (let i = 0; i < 60; i++) {
        input.setVirtual(0, { up: true, fire: i % 2 === 0 });
        step(w, 1);
        for (const b of w.query((e) => e.team === 'player' && (e as any).damageAmount !== undefined)) {
          if (!seen.has(b.id)) {
            seen.add(b.id);
            fired++;
          }
          if (b.y < py && b.x > 120 && b.x < 320) through++;
        }
      }
      input.setVirtual(0, null);
    }
    expect(fired).toBeGreaterThan(40);
    expect(through).toBe(0);
  });
});

describe('TIME UP', () => {
  it('kills a player who is driving a vehicle (the vehicle is wrecked, the pilot dies)', () => {
    const w = makeWorld(level('core_timeup_vehicle', { entities: [{ type: 'tank', x: 260, trigger: 0 }] }), { god: false });
    settle(w);
    const p = w.players[0];
    const tank = w.query((e) => e.type === 'tank')[0] as unknown as Vehicle;
    p.x = tank.x;
    input.setVirtual(0, { down: true });
    step(w, 3);
    input.setVirtual(0, null);
    expect(p.state).toBe('vehicle');
    const lives = p.profile.lives;
    let died = 0;
    w.on('playerDied', () => died++);
    p.kill();
    expect(tank.destroyed).toBe(true);
    expect(p.vehicle).toBeNull();
    expect(p.state).toBe('dying');
    step(w, 60 * 3);
    expect(died).toBe(1);
    expect(p.profile.lives).toBe(lives - 1);
  });
});

describe('MISSION COMPLETE', () => {
  it('a player going down as the boss falls loses no life (the last one would end the game)', () => {
    const w = makeWorld(level('core_trade_kill', {}), { god: false });
    settle(w);
    const p = w.players[0];
    p.profile.lives = 1;
    p.invuln = 0;
    expect(p.damage({ amount: 1, kind: 'bullet' })).toBe(true);
    expect(p.state).toBe('dying');
    w.level.bossDefeated();
    expect(w.state).toBe('complete');
    step(w, 60 * 4);
    expect(p.profile.lives).toBe(1);
    expect(p.profile.out).toBe(false);
    expect(p.state).toBe('victory');
  });

  it('falling into a pit as the mission is won costs no life either', () => {
    const w = makeWorld(level('core_trade_pit', { ground: [[[0, 180], [300, 180]], [[360, 180], [3000, 180]]] }), { god: false });
    settle(w);
    const p = w.players[0];
    p.profile.lives = 1;
    p.x = 330;
    p.y = 170;
    p.onGround = false;
    w.level.bossDefeated();
    for (let i = 0; i < 60 * 4 && p.state !== 'victory'; i++) step(w, 1);
    expect(p.profile.lives).toBe(1);
    expect(p.state).toBe('victory');
  });
});

describe('co-op respawns land beside the partner', () => {
  it('28 px behind the partner, ahead of them near the left view edge, never on top', () => {
    const w = makeWorld(level('core_coop_drop', {}), { players: 2, god: false });
    settle(w);
    const [p1, p2] = w.players as [Player, Player];
    p1.x = w.camera.x + 200;
    p2.respawn();
    expect(p2.x).toBe(p1.x - 28);
    settle(w);
    p1.x = w.camera.x + 50;
    p2.respawn();
    expect(p2.x).toBe(p1.x + 28);
    step(w, 90);
    expect(p2.state).toBe('play');
    expect(Math.abs(p2.x - p1.x)).toBeGreaterThan(14);
  });

  it('the offset spot is still checked for safe floor (no drop into a pit behind the partner)', () => {
    const w = makeWorld(level('core_coop_pit', { ground: [[[0, 180], [330, 180]], [[370, 180], [3000, 180]]] }), { players: 2, god: false });
    settle(w);
    const [p1, p2] = w.players as [Player, Player];
    p1.x = 390;
    p2.respawn();
    const T = w.terrain;
    for (const dx of [-24, 0, 24]) expect(T.floorAt(p2.x + dx, w.camera.y, w.camera.y + 260), `floor under ${p2.x + dx}`).toBeTruthy();
    expect(p2.x).not.toBe(p1.x);
  });
});

describe('players stay in view', () => {
  it('a respawn lands inside the view even when the partner stands at the far right', () => {
    const w = makeWorld(level('core_view', {}), { players: 2, god: false });
    settle(w);
    const [p1, p2] = w.players as [Player, Player];
    p1.x = w.camera.x + VIEW_W - 10;
    p2.respawn();
    step(w, 90);
    expect(p2.x).toBeLessThanOrEqual(w.camera.x + VIEW_W - p2.w / 2);
    expect(p2.state).toBe('play');
  });
});
