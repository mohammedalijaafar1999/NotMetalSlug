// Player vehicles, props, pickups and hostages: behaviour contracts.
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeWorld, step, simulateMission } from './helpers';
import { input, type ActionMask } from '../src/engine/input';
import { getEntityType } from '../src/game/registry';
import { getLevel, registerLevel, type LevelDef } from '../src/game/level';
import { Bullet, EnemyBullet, Projectile } from '../src/game/projectile';
import { VEHICLE_SFX, type Vehicle } from '../src/game/vehicle';
import { ITEM_SFX, Pickup, dropPickup, PICKUP_LINGER } from '../src/game/pickup';
import { Hostage } from '../src/game/hostage';
import { Tank, TankShell } from '../src/content/vehicles/tank';
import { Mech } from '../src/content/vehicles/mech';
import { Gyro } from '../src/content/vehicles/gyro';
import { Barrel } from '../src/content/props/barrel';
import { Mine } from '../src/content/props/mine';
import { CrateProp } from '../src/content/props/crate';
import { SandbagWall } from '../src/content/props/sandbags';
import type { World } from '../src/game/world';
import { Bot } from '../src/debug/bot';
import type { Entity } from '../src/game/entity';

function hold(w: World, mask: ActionMask | null, frames: number): void {
  input.setVirtual(0, mask);
  step(w, frames);
}

/** Sandbox world with player 1 standing on the ground at x ~ 60. */
function ready(): World {
  const w = makeWorld('sandbox', { god: false });
  hold(w, null, 70);
  expect(w.players[0].state).toBe('play');
  return w;
}

function spawn<T extends Entity>(w: World, type: string, x: number, y?: number, props: Record<string, any> = {}): T {
  const e = w.spawn(type, x, y, props);
  expect(e, type).toBeTruthy();
  step(w, 1);
  return e as T;
}

afterEach(() => {
  input.setVirtual(0, null);
  input.setVirtual(1, null);
});

describe('vehicle registry', () => {
  it('tank / mech / gyro are vehicles with the designed HP and ammo', () => {
    const w = makeWorld('sandbox');
    for (const [type, hp, ammo, flying] of [
      ['tank', 100, 30, false],
      ['mech', 90, 20, false],
      ['gyro', 80, 20, true],
    ] as const) {
      expect(getEntityType(type)?.category, type).toBe('vehicle');
      const v = w.spawn(type, 200) as Vehicle;
      expect(v.isVehicle).toBe(true);
      expect(v.maxHp, type).toBe(hp);
      expect(v.secondaryAmmo, type).toBe(ammo);
      expect(v.flying, type).toBe(flying);
      expect(v.hittable, 'empty vehicles are not targets').toBe(false);
    }
  });

  it('only uses canonical sfx names from docs/DESIGN.md', () => {
    const design = readFileSync('docs/DESIGN.md', 'utf8');
    const block = design.slice(design.indexOf('SFX names'), design.indexOf('Songs:'));
    const canon = new Set(block.split(/\s+/).filter((s) => /^[a-z0-9_]+$/.test(s)));
    for (const n of [...VEHICLE_SFX, ...ITEM_SFX]) expect(canon.has(n), n).toBe(true);
  });
});

describe('BULLDOG tank', () => {
  it('enter with DOWN, drive, fire vulcan + cannon, turret follows the stick, eject with DOWN+JUMP', () => {
    const w = ready();
    const p = w.players[0];
    const tank = spawn<Tank>(w, 'tank', p.x + 4);
    hold(w, null, 20);
    hold(w, { down: true }, 3);
    expect(p.state).toBe('vehicle');
    expect(p.vehicle).toBe(tank);
    expect(tank.driver).toBe(p);
    expect(tank.hittable).toBe(true);
    expect(tank.team).toBe('player');
    // Drive right.
    const x0 = tank.x;
    hold(w, { right: true }, 60);
    expect(tank.x).toBeGreaterThan(x0 + 40);
    expect(Math.abs(p.x - tank.x)).toBeLessThan(3);
    // Vulcan (hold fire).
    const shots0 = w.stats.shotsFired;
    hold(w, { fire: true }, 30);
    expect(w.stats.shotsFired - shots0).toBeGreaterThan(5);
    expect(w.query((e) => e instanceof Bullet && e.owner === tank).length).toBeGreaterThan(0);
    // Turret swings up while UP is held, back to forward when released.
    hold(w, { up: true }, 30);
    expect(tank.aim).toBeCloseTo(-Math.PI / 2, 2);
    hold(w, null, 30);
    expect(tank.aim).toBeCloseTo(0, 2);
    hold(w, { up: true, left: true }, 40);
    expect(Math.abs(tank.aim - (-3 * Math.PI) / 4)).toBeLessThan(0.01);
    expect(tank.facing).toBe(-1);
    hold(w, null, 30);
    // Cannon (BOMB) uses shells.
    hold(w, { bomb: true }, 1);
    expect(tank.secondaryAmmo).toBe(29);
    expect(w.query((e) => e instanceof TankShell).length).toBe(1);
    hold(w, null, 40);
    // Eject.
    hold(w, { down: true }, 2);
    hold(w, { down: true, jump: true }, 1);
    expect(p.state).toBe('play');
    expect(p.vehicle).toBeNull();
    expect(tank.driver).toBeNull();
    expect(tank.hittable).toBe(false);
    expect(p.vy).toBeLessThan(0);
    // Can't instantly hop back in.
    hold(w, { down: true }, 3);
    expect(p.state).not.toBe('vehicle');
  });

  /** Flat open ground (the sandbox has a platform over x 200..280). */
  const FLAT: LevelDef = { id: 'test_flat_range', mission: 0, name: 'FLAT', theme: 'default', music: 'm1', width: 1600, height: 216, start: { x: 60 }, ground: [[[0, 180], [1600, 180]]] };

  it('level vulcan fire dips into standing riflemen at 60, 120 and 170 px (the turret sits above their heads)', () => {
    for (const d of [60, 120, 170]) {
      const w = makeWorld(FLAT, { god: true });
      hold(w, null, 70);
      const p = w.players[0];
      const tank = spawn<Tank>(w, 'tank', p.x + 4);
      hold(w, null, 20);
      hold(w, { down: true }, 3);
      expect(p.vehicle).toBe(tank);
      hold(w, null, 5);
      const r = spawn<Entity>(w, 'rifleman', tank.x + d, undefined, { behavior: 'idle', facing: -1 });
      expect(r.top, 'the rifleman stands below the barrel line').toBeGreaterThan(tank.pivot().y + 4);
      hold(w, { fire: true }, 60);
      expect((r as any).dying || r.dead, `rifleman at ${d} px`).toBe(true);
      expect(Math.abs(tank.aim), 'the held aim stays level').toBeLessThan(0.01);
    }
  });

  it('level fire stays level with nothing low ahead, and diagonal / up aims never dip', () => {
    const w = ready();
    const p = w.players[0];
    const tank = spawn<Tank>(w, 'tank', p.x + 4);
    hold(w, null, 20);
    hold(w, { down: true }, 3);
    hold(w, { fire: true }, 20);
    expect(tank.dip).toBe(0);
    spawn(w, 'rifleman', tank.x + 120, undefined, { behavior: 'idle', facing: -1 });
    hold(w, { up: true, right: true }, 30);
    expect(tank.gunAngle()).toBeCloseTo(-Math.PI / 4, 3);
    hold(w, { up: true }, 30);
    expect(tank.gunAngle()).toBeCloseTo(-Math.PI / 2, 3);
  });

  it('hops small gaps: treads bridge a pit narrower than the hull', () => {
    const w = ready();
    const tank = spawn<Tank>(w, 'tank', 1080);
    // Sandbox pit is 40px wide at x 1100..1140. Park the tank half over the edge: it must not fall.
    tank.x = 1108;
    step(w, 30);
    expect(tank.onGround).toBe(true);
    expect(tank.dead).toBe(false);
  });

  it('takes armor-scaled damage, smokes, and is wrecked: pilot thrown clear, wreck explodes', () => {
    const w = ready();
    const p = w.players[0];
    const tank = spawn<Tank>(w, 'tank', p.x + 4);
    hold(w, { down: true }, 3);
    expect(p.vehicle).toBe(tank);
    tank.invuln = 0;
    tank.damage({ amount: 1, kind: 'bullet' });
    expect(tank.hp).toBe(95);
    tank.damage({ amount: 1, kind: 'explosion' });
    expect(tank.hp).toBe(81);
    tank.damage({ amount: 99, kind: 'crush' });
    expect(tank.hp).toBeLessThan(81);
    while (!tank.destroyed) tank.damage({ amount: 5, kind: 'explosion' });
    expect(p.vehicle).toBeNull();
    expect(p.state).toBe('play');
    expect(p.invuln).toBeGreaterThan(1);
    hold(w, null, 120);
    expect(tank.dead).toBe(true);
  });
});

describe('STRIDER mech', () => {
  it('kneels empty, stands when entered, jumps high and stomps enemies on landing', () => {
    const w = ready();
    const p = w.players[0];
    const mech = spawn<Mech>(w, 'mech', p.x + 4);
    hold(w, null, 10);
    expect(mech.hipHeight()).toBeLessThan(20);
    hold(w, { down: true }, 3);
    expect(p.vehicle).toBe(mech);
    hold(w, null, 30);
    expect(mech.hipHeight()).toBeGreaterThan(25);
    // Jump: much higher than the soldier's ~50px.
    const y0 = mech.y;
    let peak = y0;
    hold(w, { jump: true }, 1);
    for (let i = 0; i < 40; i++) {
      hold(w, null, 1);
      peak = Math.min(peak, mech.y);
    }
    expect(y0 - peak).toBeGreaterThan(65);
    hold(w, null, 60);
    expect(mech.onGround).toBe(true);
    // Stomp: drop the mech onto a rifleman.
    const r = spawn<Entity>(w, 'rifleman', mech.x + 6, undefined, { behavior: 'idle' });
    mech.y -= 70;
    mech.vy = 0;
    (mech as any).onGround = false;
    hold(w, null, 60);
    expect(r.hittable).toBe(false);
    expect(p.profile.score).toBeGreaterThan(0);
  });

  it('BOMB fires a 3-missile salvo per ammo', () => {
    const w = ready();
    const p = w.players[0];
    const mech = spawn<Mech>(w, 'mech', p.x + 4);
    hold(w, { down: true }, 3);
    hold(w, null, 30);
    hold(w, { bomb: true }, 1);
    hold(w, null, 20);
    expect(mech.secondaryAmmo).toBe(19);
    expect(w.query((e) => e instanceof Projectile && e.owner === mech && e.constructor.name === 'MechMissile').length).toBe(3);
  });
});

describe('DRAGONFLY gyro', () => {
  it('stays airborne when empty and when driven without input; flies in 8 directions', () => {
    const w = ready();
    const p = w.players[0];
    const gyro = spawn<Gyro>(w, 'gyro', p.x + 40, 120);
    hold(w, null, 120);
    expect(gyro.onGround).toBe(false);
    expect(Math.abs(gyro.y - 120)).toBeLessThan(1);
    // Board it by dropping onto it.
    gyro.x = p.x;
    gyro.y = p.y - 2;
    p.y = gyro.top - 4;
    p.vy = 60;
    (p as any).onGround = false;
    hold(w, null, 4);
    expect(p.vehicle).toBe(gyro);
    hold(w, { up: true }, 40);
    const yUp = gyro.y;
    hold(w, null, 30);
    // Eases to a stop, then holds altitude with no input.
    expect(gyro.y).toBeLessThan(yUp);
    const y1 = gyro.y;
    hold(w, null, 120);
    expect(gyro.onGround).toBe(false);
    expect(Math.abs(gyro.y - y1)).toBeLessThan(0.5);
    const x1 = gyro.x;
    hold(w, { right: true, up: true }, 20);
    expect(gyro.x).toBeGreaterThan(x1 + 10);
    expect(gyro.y).toBeLessThan(y1);
    // Bombs drop.
    hold(w, { bomb: true }, 1);
    expect(gyro.secondaryAmmo).toBe(19);
  });

  it('flying missions: start in the gyro, no gravity, no bailing out over the abyss', () => {
    const base = getLevel('sandbox')!;
    const sky: LevelDef = { ...base, id: 'test_sky', mission: 0, startVehicle: 'gyro', ground: [[[0, 200], [80, 200]]], entities: [], locks: [], endX: undefined };
    const w = makeWorld(sky, { god: false });
    const p = w.players[0];
    expect(p.state).toBe('vehicle');
    const gyro = p.vehicle as Gyro;
    expect(gyro.flying).toBe(true);
    hold(w, { right: true }, 90);
    hold(w, null, 180);
    expect(p.state).toBe('vehicle');
    expect(gyro.onGround).toBe(false);
    const cam = w.camera;
    expect(gyro.y).toBeGreaterThan(cam.y);
    expect(gyro.y).toBeLessThan(cam.y + 216);
    hold(w, { down: true }, 2);
    hold(w, { down: true, jump: true }, 1);
    expect(p.state).toBe('vehicle');
  });
});

describe('pickups', () => {
  it('bomb crate refills vehicle shells, fuel can repairs', () => {
    const w = ready();
    const p = w.players[0];
    const tank = spawn<Tank>(w, 'tank', p.x + 4);
    hold(w, { down: true }, 3);
    tank.secondaryAmmo = 3;
    tank.hp = 20;
    const bombs = p.bombs;
    spawn(w, 'pickup', tank.x + 2, tank.y - 30, { item: 'bomb' });
    spawn(w, 'pickup', tank.x - 2, tank.y - 30, { item: 'fuel' });
    hold(w, null, 60);
    expect(tank.secondaryAmmo).toBe(13);
    expect(p.bombs).toBe(bombs);
    expect(tank.hp).toBe(70);
  });

  it('dropped items bounce, then linger until left behind for 25s, then blink out', () => {
    const w = ready();
    const it0 = dropPickup(w, 200, 150, 'points:1000')!;
    expect(it0).toBeInstanceOf(Pickup);
    let ups = 0;
    let lastVy = 0;
    for (let i = 0; i < 90; i++) {
      step(w, 1);
      if (lastVy > 0 && it0.vy < 0) ups++;
      lastVy = it0.vy;
    }
    expect(ups).toBeGreaterThanOrEqual(1);
    expect(it0.onGround).toBe(true);
    // Still there while on screen, long after the linger time.
    step(w, 60 * (PICKUP_LINGER + 4));
    expect(it0.dead).toBe(false);
    // Left behind by the camera: blinks out after the linger time.
    w.camera.x = 260;
    w.camera.minX = 260;
    step(w, 60 * 3);
    expect(it0.dead).toBe(true);
  });
});

describe('props', () => {
  it('barrels chain-react and the blast kills enemies, credited to the shooter', () => {
    const w = ready();
    const p = w.players[0];
    const barrels = [200, 216, 232].map((x) => spawn<Barrel>(w, 'barrel', x));
    const r = spawn<Entity>(w, 'rifleman', 250, undefined, { behavior: 'idle' });
    for (let i = 0; i < 3; i++) barrels[0].damage({ amount: 1, kind: 'bullet', owner: p });
    hold(w, null, 90);
    for (const b of barrels) expect(b.dead).toBe(true);
    expect(r.hittable).toBe(false);
    expect(p.profile.score).toBeGreaterThan(0);
  });

  it('barrel blasts hurt players too (hit-all)', () => {
    const w = ready();
    const p = w.players[0];
    const b = spawn<Barrel>(w, 'barrel', p.x + 14);
    p.invuln = 0;
    b.damage({ amount: 5, kind: 'bullet', owner: null });
    hold(w, null, 30);
    expect(p.state).toBe('dying');
  });

  it('crates are platforms, break and drop their item', () => {
    const w = ready();
    const p = w.players[0];
    const c = spawn<CrateProp>(w, 'crate_prop', p.x + 40, undefined, { drop: 'H' });
    // Stand on it.
    p.x = c.x;
    p.y = c.top - 6;
    p.vy = 0;
    (p as any).onGround = false;
    hold(w, null, 20);
    expect(p.onGround).toBe(true);
    expect(p.y).toBeCloseTo(c.top, 0);
    for (let i = 0; i < 3; i++) c.damage({ amount: 1, kind: 'bullet', owner: p });
    expect(c.dead).toBe(true);
    hold(w, null, 5);
    expect(w.query((e) => e instanceof Pickup && e.kind === 'weapon').length).toBe(1);
    hold(w, null, 30);
    expect(p.y).toBeGreaterThan(c.top + 5);
  });

  it('mines arm under enemies (and players) and explode after a beep', () => {
    const w = ready();
    const m = spawn<Mine>(w, 'mine', 300);
    hold(w, null, 10);
    expect(m.armed).toBe(false);
    const r = spawn<Entity>(w, 'rifleman', 300, undefined, { behavior: 'idle' });
    hold(w, null, 2);
    expect(m.armed).toBe(true);
    hold(w, null, 40);
    expect(m.dead).toBe(true);
    expect(r.hittable).toBe(false);
    // Player.
    const p = w.players[0];
    const m2 = spawn<Mine>(w, 'mine', p.x);
    p.invuln = 0;
    hold(w, null, 2);
    expect(m2.armed).toBe(true);
    hold(w, null, 40);
    expect(p.state).toBe('dying');
  });

  it('sandbag walls ignore bullets but fall to explosions; sandbags cover soaks enemy fire', () => {
    const w = ready();
    const wall = spawn<SandbagWall>(w, 'sandbag_wall', 250);
    expect(wall.damage({ amount: 1, kind: 'bullet' })).toBe(false);
    wall.damage({ amount: 9, kind: 'explosion' });
    wall.damage({ amount: 9, kind: 'explosion' });
    expect(wall.broken).toBe(true);
    const cover = spawn<SandbagWall>(w, 'sandbags', 300);
    const shooter = spawn<Entity>(w, 'rifleman', 340, undefined, { behavior: 'idle' });
    const b = new EnemyBullet(shooter, 330, cover.y - 6, Math.PI, 150);
    w.add(b);
    hold(w, null, 30);
    expect(b.dead).toBe(true);
    expect(w.players[0].state).toBe('play');
  });

  it('fuel tank: big delayed blast, leaves a burning wreck', () => {
    const w = ready();
    const t = spawn<Entity>(w, 'fuel_tank', 300);
    const r = spawn<Entity>(w, 'rifleman', 340, undefined, { behavior: 'idle' });
    t.damage({ amount: 99, kind: 'explosion', owner: w.players[0] });
    hold(w, null, 10);
    expect(r.hittable).toBe(true);
    hold(w, null, 40);
    expect(r.hittable).toBe(false);
    expect(t.dead).toBe(false);
    expect(t.hittable).toBe(false);
  });
});

describe('hostages', () => {
  it('caged hostages ignore touch and are freed by shooting the cage', () => {
    const w = ready();
    const p = w.players[0];
    const h = spawn<Hostage>(w, 'hostage', p.x + 60, undefined, { mode: 'caged', drop: 'bomb' });
    expect(h.mode).toBe('caged');
    p.x = h.x;
    hold(w, null, 10);
    expect(h.mode).toBe('caged');
    p.x = h.x - 70;
    hold(w, null, 2);
    // Shoot the cage with real bullets.
    for (let i = 0; i < 10 && h.caged; i++) {
      w.add(new Bullet(p, h.x - 40, h.y - 15, 0, 420, 1));
      hold(w, null, 8);
    }
    expect(h.caged).toBe(false);
    expect(['freed', 'walk', 'give', 'salute', 'run']).toContain(h.mode);
    expect(w.stats.rescues).toBe(1);
    expect(p.profile.missionRescues).toBe(1);
    hold(w, null, 120);
    expect(h.given).toBe(true);
  });

  it('tied hostages are freed by touch (even from a vehicle) and wanderers only by touch', () => {
    const w = ready();
    const p = w.players[0];
    const tied = spawn<Hostage>(w, 'hostage', p.x + 4);
    hold(w, null, 2);
    expect(tied.mode).not.toBe('tied');
    const wand = spawn<Hostage>(w, 'hostage', 300, undefined, { mode: 'wander' });
    expect(wand.hittable).toBe(false);
    expect(wand.damage({ amount: 1, kind: 'bullet', owner: p })).toBe(false);
    hold(w, null, 120);
    expect(wand.mode).toBe('wander');
    expect(Math.abs(wand.x - 300)).toBeLessThan(40);
    const tank = spawn<Tank>(w, 'tank', p.x + 4);
    hold(w, { down: true }, 3);
    expect(p.vehicle).toBe(tank);
    tank.x = wand.x;
    hold(w, null, 2);
    expect(wand.mode).not.toBe('wander');
    expect(w.stats.rescues).toBe(2);
  });
});

describe('autopilot with vehicles', () => {
  for (const type of ['tank', 'mech']) {
    it(`boards a ${type} and drives it through the sandbox (pits, slopes, block, water)`, () => {
      const base = getLevel('sandbox')!;
      const lvl: LevelDef = { ...base, id: `test_${type}_run`, entities: [...(base.entities ?? []), { type, x: 120 }] };
      registerLevel(lvl);
      const w = makeWorld(lvl, { god: true });
      const bot = new Bot(0);
      let driven = 0;
      let maxX = 0;
      for (let i = 0; i < 60 * 120 && w.state !== 'complete'; i++) {
        step(w, 1, [bot]);
        const v = w.players[0].vehicle;
        if (v?.type === type) {
          driven++;
          maxX = Math.max(maxX, v.x);
        }
      }
      expect(w.state).toBe('complete');
      expect(driven).toBeGreaterThan(60 * 5);
      expect(maxX).toBeGreaterThan(1200);
    }, 60_000);
  }
  it('mission simulation helper still completes the plain sandbox', () => {
    expect(simulateMission('sandbox', 120).completed).toBe(true);
  }, 60_000);
});
