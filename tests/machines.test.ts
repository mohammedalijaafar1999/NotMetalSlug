// Machine enemies: behaviour contracts (troop trucks, bunkers, flyers, crush, telegraphs,
// fairness of projectile speeds, destruction/wrecks) checked headless in a dedicated arena
// (flat ground, a gentle hill and a deep water pool).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeWorld, step } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import { getEntityType } from '../src/game/registry';
import { Projectile, EnemyBullet, Shell } from '../src/game/projectile';
import { VIEW_H, VIEW_W } from '../src/engine/renderer';
import { sprites } from '../src/engine/sprites';
import type { LevelDef } from '../src/game/level';
import type { World } from '../src/game/world';
import type { Entity } from '../src/game/entity';
import { MACHINE_SFX, Machine, Missile, FlakShell } from '../src/content/machines/common';
import { Truck } from '../src/content/machines/truck';
import { Bunker } from '../src/content/machines/bunker';
import { Heli } from '../src/content/machines/heli';
import { Gunboat } from '../src/content/machines/gunboat';
import { LightTank } from '../src/content/machines/light_tank';
import { Drone } from '../src/content/machines/drone';
import { Fighter } from '../src/content/machines/fighter';
import { Jeep } from '../src/content/machines/jeep';
import { AirshipTurret } from '../src/content/machines/airship_turret';
import { Snowmobile } from '../src/content/machines/snowmobile';

const TYPES = ['light_tank', 'heli', 'turret', 'jeep', 'drone', 'fighter', 'snowmobile', 'gunboat', 'bunker', 'truck', 'airship_turret'];
const FLYERS = ['heli', 'drone', 'fighter'];

/** Test arena: flat ground with a gentle hill at 380..560 and a deep water pool at 1400..1800. */
const ARENA: LevelDef = {
  id: 'machines_test',
  mission: 0,
  name: 'MACHINE TEST',
  theme: 'default',
  music: 'm1',
  width: 3200,
  height: 216,
  start: { x: 60 },
  ground: [
    [
      [0, 180],
      [380, 180],
      [440, 160],
      [500, 160],
      [560, 180],
      [1400, 180],
      [1400, 214],
      [1800, 214],
      [1800, 180],
      [3200, 180],
    ],
  ],
  water: [{ x: 1400, y: 176, w: 400, h: 40, deadly: true }],
};

/** Arena world with the player landed. */
function arena(opts: { god?: boolean; difficulty?: 0 | 1 | 2 } = {}): World {
  const w = makeWorld(ARENA, { god: opts.god ?? true, difficulty: opts.difficulty });
  step(w, 40);
  return w;
}

function count(w: World, type: string): Entity[] {
  return w.query((e) => e.type === type && !e.dead);
}

function kill(e: Entity, w: World): void {
  e.damage({ amount: 9999, kind: 'explosion', owner: w.players[0] });
}

describe('machine registry', () => {
  it('registers every machine type as an enemy with documented props', () => {
    for (const t of TYPES) {
      const info = getEntityType(t);
      expect(info, t).toBeTruthy();
      expect(info!.category, t).toBe('enemy');
      expect(info!.description.length, t).toBeGreaterThan(40);
    }
  });

  it('uses only canonical SFX names from docs/DESIGN.md', () => {
    const doc = readFileSync('docs/DESIGN.md', 'utf8');
    const block = doc.slice(doc.indexOf('SFX names'), doc.indexOf('Songs:'));
    const canonical = new Set(block.match(/[a-z][a-z0-9_]+/g));
    for (const n of MACHINE_SFX) expect(canonical.has(n), n).toBe(true);
  });

  it('bakes non-empty art for every machine sprite frame', () => {
    const list = sprites.all().filter((s) => s.name.startsWith('mach_'));
    expect(list.length).toBeGreaterThan(20);
    for (const s of list) for (let f = 0; f < s.frameCount; f++) expect(s.pixelArt(f).opaqueCount(), `${s.name}#${f}`).toBeGreaterThan(0);
  });
});

describe('machines with default props', () => {
  for (const t of TYPES) {
    it(`${t}: spawns with scaled hp, blocks progress, is destroyed into a wreck that goes away`, () => {
      const w = arena();
      const e = w.spawn(t, w.camera.x + 250) as Machine;
      step(w, 2);
      expect(e).toBeInstanceOf(Machine);
      expect(e.hp).toBeGreaterThan(1);
      expect(e.blocksProgress).toBe(true);
      expect(e.scoreValue).toBeGreaterThanOrEqual(300);
      expect(e.scoreValue).toBeLessThanOrEqual(2000);
      step(w, 180);
      if (!e.dead) {
        kill(e, w);
        expect(e.dying).toBe(true);
        expect(e.blocksProgress).toBe(false);
        step(w, 60 * 8);
      }
      expect(e.dead).toBe(true);
    });
  }

  it('scale hp with difficulty', () => {
    const easy = arena({ difficulty: 0 });
    const hard = arena({ difficulty: 2 });
    const a = easy.spawn('light_tank', easy.camera.x + 250)!;
    const b = hard.spawn('light_tank', hard.camera.x + 250)!;
    step(easy, 1);
    step(hard, 1);
    expect(a.maxHp).toBeLessThan(30);
    expect(b.maxHp).toBeGreaterThan(30);
  });

  it('award their score to the player who destroys them', () => {
    const w = arena();
    const e = w.spawn('turret', w.camera.x + 250)!;
    step(w, 2);
    const before = w.players[0].profile.score;
    kill(e, w);
    expect(w.players[0].profile.score - before).toBeGreaterThanOrEqual(500);
  });
});

describe('truck', () => {
  it('drives in from off-screen, stops on screen and unloads props.troops riflemen, then backs out', () => {
    const w = arena();
    const before = count(w, 'rifleman').length;
    const tr = w.spawn('truck', w.camera.x + VIEW_W + 60, undefined, { troops: 4 }) as Truck;
    let stoppedOnScreen = false;
    for (let i = 0; i < 60 * 10; i++) {
      step(w, 1);
      if (tr.state === 'unload' && tr.onScreen(0)) stoppedOnScreen = true;
    }
    expect(stoppedOnScreen).toBe(true);
    const troops = count(w, 'rifleman').length - before;
    expect(troops).toBe(4);
    expect(tr.troops).toBe(0);
  });

  it('defaults to 3 troops and keeps an arena wave blocked until they are dead after leaving', () => {
    const w = arena();
    const tr = w.spawn('truck', w.camera.x + VIEW_W + 60) as Truck;
    step(w, 60 * 14);
    expect(tr.unloaded.length).toBe(3);
    const alive = tr.unloaded.filter((e) => !e.dead && e.hittable);
    if (alive.length && !tr.dead) {
      expect(tr.blocksProgress).toBe(true);
      for (const r of alive) kill(r, w);
      step(w, 5);
      expect(tr.dead).toBe(true);
    }
  });

  it('throws its passengers clear when destroyed before unloading', () => {
    const w = arena();
    const tr = w.spawn('truck', w.camera.x + VIEW_W + 60, undefined, { troops: 3 }) as Truck;
    step(w, 20);
    kill(tr, w);
    expect(tr.troops).toBe(0);
    expect(w.query((e) => e.constructor.name === 'Ragdoll').length).toBeGreaterThanOrEqual(4);
  });
});

describe('bunker', () => {
  it('spawns troops (max 3 alive) until destroyed, then stops', () => {
    const w = arena();
    const b = w.spawn('bunker', w.camera.x + 300) as Bunker;
    let maxAlive = 0;
    for (let i = 0; i < 60 * 20; i++) {
      step(w, 1);
      maxAlive = Math.max(maxAlive, b.aliveTroops());
    }
    expect(maxAlive).toBe(3);
    // Kill the troops: it sends more.
    for (const r of b.troopsOut) kill(r, w);
    step(w, 60 * 6);
    expect(b.aliveTroops()).toBeGreaterThan(0);
    expect(b.blocksProgress).toBe(true);
    // Destroy it: no more spawns.
    kill(b, w);
    const n = count(w, 'rifleman').length;
    step(w, 60 * 6);
    expect(count(w, 'rifleman').length).toBeLessThanOrEqual(n);
    expect(b.dead).toBe(true);
  });

  it('only fires its MG toward the side it faces', () => {
    const w = arena();
    // Player is on the left; a bunker facing right must not shoot at them.
    w.spawn('bunker', w.camera.x + 200, undefined, { facing: 1, maxTroops: 0 });
    step(w, 60 * 6);
    expect(w.query((e) => e instanceof EnemyBullet).length).toBe(0);
  });
});

describe('flying machines', () => {
  for (const t of FLYERS) {
    it(`${t} holds altitude (does not fall) and stays hittable from the ground`, () => {
      const w = arena();
      // (zapper drones: kamikaze drones dive on purpose)
      const e = w.spawn(t, w.camera.x + 260, undefined, t === 'drone' ? { kind: 'zap' } : {})!;
      const ground = w.terrain.groundTopAt(w.camera.x + 200);
      let lowest = -Infinity;
      for (let i = 0; i < 60 * 6; i++) {
        step(w, 1);
        if (e.dead || (e as Machine).dying) break;
        if (i > 120) lowest = Math.max(lowest, e.bottom);
      }
      expect(lowest).toBeLessThan(ground - 30);
      // Flyers cruise below the HUD.
      if (!e.dead && e.onScreen(0)) expect(e.top).toBeGreaterThan(w.camera.y + 30);
    });
  }

  it('heli settles in its altitude band and its hurtboxes are reachable by upward fire', () => {
    const w = arena();
    const h = w.spawn('heli', w.camera.x + 300) as Heli;
    step(w, 60 * 4);
    expect(Math.abs(h.y - h.cruiseY)).toBeLessThan(16);
    const hb = h.hurtboxes();
    expect(hb.length).toBe(2);
    for (const r of hb) expect(r.y + r.h).toBeLessThan(w.camera.y + VIEW_H - 60);
  });

  it('heli crashes to the ground when destroyed, then leaves a burning wreck that is removed', () => {
    const w = arena();
    const h = w.spawn('heli', w.camera.x + 200) as Heli;
    step(w, 60 * 3);
    const y0 = h.y;
    kill(h, w);
    expect(h.crashing).toBe(true);
    let wreckedAt = -1;
    for (let i = 0; i < 60 * 6 && !h.dead; i++) {
      step(w, 1);
      if (h.wrecked && wreckedAt < 0) wreckedAt = h.y;
    }
    expect(wreckedAt).toBeGreaterThan(y0 + 40);
    step(w, 60 * 5);
    expect(h.dead).toBe(true);
  });

  it('kamikaze drone telegraphs (lock) before diving and blows up on the player', () => {
    const w = arena({ god: false });
    let died = false;
    w.on('playerDied', () => (died = true));
    const d = w.spawn('drone', w.camera.x + 200) as Drone;
    let locked = false;
    for (let i = 0; i < 60 * 8 && !died; i++) {
      step(w, 1);
      if (d.state === 'lock') locked = true;
      if (d.state === 'dive') expect(locked).toBe(true);
    }
    expect(locked).toBe(true);
    expect(died).toBe(true);
  });

  it('fighter warns at the screen edge, makes passes, loops back and eventually leaves', () => {
    const w = arena();
    const f = w.spawn('fighter', w.camera.x + 200, undefined, { passes: 2 }) as Fighter;
    step(w, 2);
    expect(f.state).toBe('warn');
    expect(w.query((e) => e.constructor.name === 'EdgeWarning').length).toBe(1);
    const states = new Set<string>();
    for (let i = 0; i < 60 * 12 && !f.dead; i++) {
      step(w, 1);
      states.add(f.state);
    }
    expect(states.has('pass')).toBe(true);
    expect(states.has('loop')).toBe(true);
    expect(f.dead).toBe(true);
  });
});

describe('gunboat', () => {
  it('floats on water (with its keel below the surface) and patrols inside the water body', () => {
    const w = arena();
    w.level.warp(1300);
    w.players[0].x = 1340;
    step(w, 30);
    const water = w.terrain.water[0];
    const b = w.spawn('gunboat', water.x + water.w / 2) as Gunboat;
    for (let i = 0; i < 60 * 6; i++) {
      step(w, 1);
      expect(b.y).toBeGreaterThan(water.y);
      expect(b.y).toBeLessThan(water.y + 14);
      expect(b.x - b.w / 2).toBeGreaterThanOrEqual(water.x);
      expect(b.x + b.w / 2).toBeLessThanOrEqual(water.x + water.w);
    }
    expect(b.floating).toBe(true);
    // Sinks when destroyed, then goes away.
    kill(b, w);
    const y0 = b.y;
    step(w, 60);
    expect(b.y).toBeGreaterThan(y0 + 4);
    step(w, 60 * 5);
    expect(b.dead).toBe(true);
  });

  it('sits on the ground when there is no water', () => {
    const w = arena();
    const b = w.spawn('gunboat', w.camera.x + 300) as Gunboat;
    step(w, 60);
    expect(b.floating).toBe(false);
    expect(b.onGround).toBe(true);
  });
});

describe('fair attacks', () => {
  it('telegraph every heavy shot: tank turret aims + glows before each shell', () => {
    const w = arena();
    const t = w.spawn('light_tank', w.camera.x + 260) as LightTank;
    const seen: string[] = [];
    let shells = 0;
    let lastState = '';
    for (let i = 0; i < 60 * 10; i++) {
      step(w, 1);
      if (t.state !== lastState) seen.push((lastState = t.state));
      const n = w.query((e) => e instanceof Shell && e.owner === t).length;
      if (n > shells) {
        // A shell appeared: the previous states must include aim -> charge.
        expect(seen.slice(-3)).toEqual(expect.arrayContaining(['aim', 'charge']));
      }
      shells = n;
    }
    expect(seen).toContain('charge');
  });

  it('keep enemy bullets and missiles dodgeable (<= 200 px/s at normal difficulty)', () => {
    let maxBullet = 0;
    let maxMissile = 0;
    for (const t of TYPES) {
      const w = arena();
      w.spawn(t, w.camera.x + 240);
      const seen = new Set<number>();
      for (let i = 0; i < 60 * 8; i++) {
        step(w, 1);
        for (const p of w.query((e): e is Projectile => e instanceof Projectile && e.team === 'enemy')) {
          if (p instanceof Missile) maxMissile = Math.max(maxMissile, p.maxSpeed);
          else if (!seen.has(p.id) && !(p instanceof Shell) && p.gravity === 0) maxBullet = Math.max(maxBullet, Math.hypot(p.vx, p.vy));
          seen.add(p.id);
        }
      }
    }
    expect(maxBullet).toBeGreaterThan(100);
    expect(maxBullet).toBeLessThanOrEqual(200);
    expect(maxMissile).toBeLessThanOrEqual(200);
  });

  it('do not attack from off-screen', () => {
    const w = arena();
    w.spawn('turret', w.camera.x + VIEW_W + 140, undefined, { kind: 'mg', dir: -1 });
    w.spawn('bunker', w.camera.x + VIEW_W + 160, undefined, { facing: -1 });
    step(w, 60 * 6);
    expect(w.query((e) => e instanceof Projectile && e.team === 'enemy').length).toBe(0);
  });

  it('tank treads crush a player in its path (damage kind crush)', () => {
    const w = arena({ god: false });
    const kinds: string[] = [];
    const p = w.players[0];
    const orig = p.die.bind(p);
    p.die = (d) => {
      if (d) kinds.push(d.kind);
      orig(d);
    };
    const t = w.spawn('light_tank', p.x + 70, undefined, { facing: -1 }) as LightTank;
    // Make it drive at the player regardless of range keeping.
    for (let i = 0; i < 60 * 4 && kinds.length === 0; i++) {
      t.vx = -26;
      t.cannonT = 99;
      t.mgT = 99;
      step(w, 1);
    }
    expect(kinds).toContain('crush');
  });

  it('machine wrecks never hurt players or their vehicles; tread contact on a vehicle is one crush unit', () => {
    for (const type of ['light_tank', 'jeep', 'truck', 'snowmobile', 'turret', 'bunker', 'heli', 'drone', 'fighter']) {
      const w = arena({ god: false });
      const p = w.players[0];
      const tank = w.spawn('tank', p.x + 4) as Entity;
      step(w, 20);
      input.setVirtual(0, { down: true });
      step(w, 3);
      input.setVirtual(0, null);
      expect(p.vehicle, type).toBe(tank);
      // Point-blank (hulls overlapping), then destroyed by the player.
      const m = w.spawn(type, tank.x + 30, FLYERS.includes(type) ? tank.y - 30 : undefined, { facing: -1 }) as Machine;
      step(w, 2);
      tank.invuln = 0;
      const hp0 = tank.hp;
      kill(m, w);
      for (let i = 0; i < 60 * 3; i++) {
        tank.invuln = 0;
        step(w, 1);
      }
      expect(tank.hp, `${type} wreck`).toBe(hp0);
    }
    // On foot next to a wreck: the blast only hurts enemies.
    const w = arena({ god: false });
    const p = w.players[0];
    p.invuln = 0;
    const t = w.spawn('light_tank', p.x + 24, undefined, { facing: -1 }) as LightTank;
    step(w, 1);
    kill(t, w);
    step(w, 60 * 3);
    expect(p.state, 'a player beside an exploding tank survives').toBe('play');
    // A light tank grinding into a driven BULLDOG: one crush unit (22 HP) per contact, not a capped 45.
    const w2 = arena({ god: false });
    const p2 = w2.players[0];
    const bulldog = w2.spawn('tank', p2.x + 4) as Entity;
    step(w2, 20);
    input.setVirtual(0, { down: true });
    step(w2, 3);
    input.setVirtual(0, null);
    const lt = w2.spawn('light_tank', bulldog.x + 36, undefined, { facing: -1 }) as LightTank;
    step(w2, 1);
    bulldog.invuln = 0;
    const hpb = bulldog.hp;
    lt.vx = -26;
    step(w2, 2);
    expect(hpb - bulldog.hp).toBe(22);
  });

  it('show damage smoke below half health', () => {
    const w = arena();
    const t = w.spawn('light_tank', w.camera.x + 260) as LightTank;
    step(w, 2);
    t.damage({ amount: Math.ceil(t.maxHp * 0.6), kind: 'bullet', owner: w.players[0] });
    const n0 = w.particles.list.length;
    step(w, 30);
    const smoke = w.particles.list.filter((p) => p.kind === 'smoke' && p.front).length;
    expect(smoke).toBeGreaterThan(3);
    void n0;
  });
});

describe('turret kinds', () => {
  const expectations: [string, (e: Entity) => boolean][] = [
    ['mg', (e) => e instanceof EnemyBullet],
    ['cannon', (e) => e instanceof Shell],
    ['flak', (e) => e instanceof FlakShell],
  ];
  for (const [kind, isShot] of expectations) {
    it(`${kind} fires its own projectile type after a wind-up`, () => {
      const w = arena();
      const tu = w.spawn('turret', w.camera.x + 240, undefined, { kind }) as Machine;
      let windup = false;
      let fired = false;
      for (let i = 0; i < 60 * 6 && !fired; i++) {
        step(w, 1);
        if (tu.state === 'windup') windup = true;
        if (w.query((e) => e.owner === tu && isShot(e)).length) fired = true;
      }
      expect(windup).toBe(true);
      expect(fired).toBe(true);
    });
  }

  it('a turret with a fixed dir never turns to face a player behind it', () => {
    const w = arena();
    const tu = w.spawn('turret', w.camera.x + 200, undefined, { dir: 1 }) as Machine;
    step(w, 60 * 4);
    expect(tu.facing).toBe(1);
    expect(w.query((e) => e.owner === tu && e instanceof Projectile).length).toBe(0);
  });
});

describe('jeep', () => {
  it('drives in, brakes on screen, fires bursts and reverses away when not in an arena', () => {
    const w = arena();
    const j = w.spawn('jeep', w.camera.x + VIEW_W + 50) as Jeep;
    const states = new Set<string>();
    let shots = 0;
    for (let i = 0; i < 60 * 16 && !j.dead; i++) {
      step(w, 1);
      states.add(j.state);
      if (j.state === 'fight') expect(j.onScreen(10)).toBe(true);
      shots = Math.max(shots, w.query((e) => e.owner === j && e instanceof EnemyBullet).length);
    }
    expect(states.has('fight')).toBe(true);
    expect(shots).toBeGreaterThan(0);
    expect(states.has('leave')).toBe(true);
    expect(j.dead).toBe(true);
  });

  it('stays to fight while the camera is locked in an arena (and keeps the wave going)', () => {
    const def: LevelDef = { ...ARENA, id: 'machines_lock', locks: [{ x: 0, waves: [{ spawns: [{ type: 'jeep', x: 470 }] }] }] };
    const w = makeWorld(def, { god: true });
    step(w, 60 * 2);
    const j = w.query((e) => e.type === 'jeep')[0] as Jeep;
    expect(j).toBeTruthy();
    step(w, 60 * 14);
    expect(j.dead).toBe(false);
    expect(j.state).toBe('fight');
    expect(w.level.locked).toBe(true);
    kill(j, w);
    step(w, 60 * 2);
    expect(w.level.locked).toBe(false);
  });
});

describe('ground vehicles on slopes', () => {
  it('a truck climbs a gentle hill and parks on screen past it', () => {
    const w = arena();
    w.level.warp(200);
    w.players[0].x = 260;
    step(w, 30);
    const tr = w.spawn('truck', w.camera.x + VIEW_W + 40) as Truck;
    step(w, 2);
    expect(tr.state).toBe('drive');
    for (let i = 0; i < 60 * 8 && tr.state === 'drive'; i++) step(w, 1);
    expect(tr.state).not.toBe('drive');
    expect(tr.onScreen(0)).toBe(true);
    expect(tr.x).toBeLessThan(w.camera.x + VIEW_W - 30);
  });

  it('a tank drives over the hill instead of stopping at its foot', () => {
    const w = arena();
    const t = w.spawn('light_tank', 600, undefined, { facing: -1 }) as LightTank;
    step(w, 60 * 7);
    expect(t.x).toBeLessThan(440);
  });
});

describe('airship turret', () => {
  it('hangs under a hull at its world position (no gravity) and shoots downward', () => {
    const w = arena();
    const a = w.spawn('airship_turret', w.camera.x + 200, w.camera.y + 60, { mount: 'bottom' }) as AirshipTurret;
    step(w, 60 * 5);
    expect(a.hanging).toBe(true);
    expect(Math.abs(a.y - (w.camera.y + 70))).toBeLessThan(1);
    expect(Math.sin(a.aim)).toBeGreaterThan(0);
    expect(w.query((e) => e.owner === a && e instanceof EnemyBullet).length).toBeGreaterThan(0);
  });
});

describe('snowmobile', () => {
  it('charges, overshoots, skids round and charges again', () => {
    const w = arena();
    const s = w.spawn('snowmobile', w.camera.x + 300) as Snowmobile;
    const facings = new Set<number>();
    let skid = false;
    for (let i = 0; i < 60 * 10; i++) {
      step(w, 1);
      facings.add(s.facing);
      if (s.state === 'skid') skid = true;
    }
    expect(skid).toBe(true);
    expect(facings.size).toBe(2);
  });
});

describe('autopilot vs machines (keeps missions that use them completable)', () => {
  for (const t of TYPES) {
    it(`the bot destroys a ${t} in an arena`, () => {
      const def: LevelDef = { ...ARENA, id: `machines_bot_${t}`, locks: [{ x: 0, waves: [{ spawns: [{ type: t, x: 330 }] }] }] };
      const w = makeWorld(def, { god: true });
      const bots = w.players.map((p) => new Bot(p.index));
      let done = false;
      for (let i = 0; i < 60 * 40 && !done; i++) {
        step(w, 1, bots);
        done = i > 120 && !w.level.locked;
      }
      for (let k = 0; k < 2; k++) input.setVirtual(k, null);
      expect(done).toBe(true);
    });
  }
});
