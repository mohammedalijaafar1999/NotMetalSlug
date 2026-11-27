// Mission 5 STORMFRONT: level structure (fully airborne, auto-scrolling, boss arena per THUNDERHEAD's
// notes), theme, and the mission mechanics: flight safety around hulls, the take-off glide, spare
// gyros for pilots stranded on a deck, hostages rescued in the sky, supply drops, the fuel zeppelin
// set piece, and the invincible autopilot completing the mission.
import { describe, expect, it } from 'vitest';
import { makeWorld, simulateMission, step, DT } from './helpers';
import { Bot } from '../src/debug/bot';
import { input } from '../src/engine/input';
import { VIEW_W } from '../src/engine/renderer';
import { wrapText } from '../src/engine/font';
import { getLevel, type LevelDef } from '../src/game/level';
import { getTheme } from '../src/game/theme';
import { getEntityType, type SpawnSpec } from '../src/game/registry';
import { Hostage } from '../src/game/hostage';
import { dropPickup } from '../src/game/pickup';
import type { Vehicle } from '../src/game/vehicle';
import type { World } from '../src/game/world';
import { M5_BUILD, BOSS_X } from '../src/content/levels/m5';
import { Airspace, SPARE_AMMO } from '../src/content/levels/m5/airspace';
import { SkySupply } from '../src/content/levels/m5/supply';
import { FuelZeppelin } from '../src/content/levels/m5/zeppelin';

const L = getLevel('m5')!;

function allSpawns(def: LevelDef): SpawnSpec[] {
  return [...(def.entities ?? []), ...(def.locks ?? []).flatMap((l) => l.waves.flatMap((w) => w.spawns))];
}

/** World on level m5 with the camera warped to x (helpers spawned, nothing else pending before x). */
function worldAt(x: number, opts: { god?: boolean } = {}): World {
  const w = makeWorld('m5', { god: opts.god ?? true });
  step(w, Math.round(1.8 / DT)); // past the take-off glide
  w.level.warp(x);
  for (const p of w.players) {
    const v = p.vehicle;
    if (v) {
      v.x = x + 100;
      v.y = w.camera.y + 100;
    }
  }
  step(w, 2);
  return w;
}

function gyroOf(w: World): Vehicle {
  const v = w.players[0].vehicle;
  if (!v) throw new Error('player not in a vehicle');
  return v;
}

describe('mission 5 STORMFRONT level', () => {
  it('is registered with its theme, songs, boss, gyro start and a fitting briefing', () => {
    expect(L).toBeTruthy();
    expect(L.mission).toBe(5);
    expect(L.name).toBe('STORMFRONT');
    expect(L.theme).toBe('m5');
    expect(L.music).toBe('m5');
    expect(L.bossMusic).toBe('boss');
    expect(L.bossName).toBe('THUNDERHEAD');
    expect(L.startVehicle).toBe('gyro');
    expect(L.width).toBeGreaterThanOrEqual(4500);
    expect(L.width).toBeLessThanOrEqual(8000);
    expect(L.timeLimit).toBeGreaterThanOrEqual(60);
    expect(L.timeLimit).toBeLessThanOrEqual(99);
    expect(L.briefing).toBe(L.briefing!.toUpperCase());
    expect(wrapText(L.briefing!, 178).length).toBeLessThanOrEqual(11);
  });

  it('auto-scrolls the whole way at a steady pace and checkpoints at least every 1200 px', () => {
    const auto = L.autoScroll!;
    expect(auto[0].x1).toBe(0);
    for (let i = 1; i < auto.length; i++) expect(auto[i].x1).toBe(auto[i - 1].x2);
    expect(auto[auto.length - 1].x2).toBeLessThanOrEqual(BOSS_X);
    for (const a of auto) {
      expect(a.speed).toBeGreaterThanOrEqual(35);
      expect(a.speed).toBeLessThanOrEqual(55);
    }
    const cps = [0, ...L.checkpoints!, BOSS_X];
    for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1]).toBeLessThanOrEqual(1200);
  });

  it('has 4 arenas of 2-4 waves plus the boss lock, 6-12 hostages on decks, supplies and weapon cases', () => {
    const locks = L.locks!;
    const arenas = locks.filter((l) => !l.boss);
    expect(arenas.length).toBeGreaterThanOrEqual(3);
    expect(arenas.length).toBeLessThanOrEqual(5);
    for (const a of arenas) {
      expect(a.waves.length).toBeGreaterThanOrEqual(2);
      expect(a.waves.length).toBeLessThanOrEqual(4);
    }
    const specs = allSpawns(L);
    const hostages = specs.filter((s) => s.type === 'hostage');
    expect(hostages.length).toBeGreaterThanOrEqual(6);
    expect(hostages.length).toBeLessThanOrEqual(12);
    expect(new Set(hostages.map((h) => h.props?.mode)).size).toBeGreaterThanOrEqual(2);
    // Every hostage stands on an airship deck (a hull solid right under its feet).
    const w = makeWorld('m5');
    for (const h of hostages) {
      const f = w.terrain.floorAt(h.x, (h.y ?? 0) - 4, (h.y ?? 0) + 2);
      expect(f, `deck under hostage at ${h.x}`).not.toBeNull();
    }
    const supplies = specs.filter((s) => s.type === 'm5_supply').map((s) => s.props?.item);
    expect(supplies).toContain('fuel');
    expect(supplies).toContain('bomb');
    const weapons = specs.filter((s) => s.type === 'crate_prop' && /^[HRSFLCB]$/.test(String(s.props?.drop)));
    expect(weapons.length).toBeGreaterThanOrEqual(2);
    // Signature enemies and the sky cast all appear.
    for (const t of ['fighter', 'drone', 'heli', 'airship_turret', 'jetpack', 'paratrooper', 'm5_fuel_zeppelin']) expect(specs.some((s) => s.type === t), t).toBe(true);
    for (const s of specs) expect(getEntityType(s.type), s.type).toBeTruthy();
  });

  it('keeps top-mounted airship turrets and deck crews on their hulls', () => {
    const w = makeWorld('m5');
    for (const s of allSpawns(L)) {
      if (s.y === undefined) continue;
      if (!['rifleman', 'grenadier', 'bazooka', 'sniper', 'officer', 'crate_prop', 'barrel'].includes(s.type) && !(s.type === 'airship_turret' && s.props?.mount !== 'bottom')) continue;
      const f = w.terrain.floorAt(s.x, s.y - 4, s.y + 2);
      expect(f, `${s.type} at ${s.x},${s.y}`).not.toBeNull();
    }
  });

  it('always leaves a wide flyable corridor for the gyro (no forced squeezes on the auto-scroll)', () => {
    const w = makeWorld('m5');
    const T = w.terrain;
    for (let cx = 0; cx <= L.width - VIEW_W; cx += 16) {
      const camY = w.camera.boundsAt(cx).minY;
      // Gyro feet band inside the view (Vehicle.clampToView) and a 40 px wide probe anywhere in it.
      let best = 0;
      for (let x = cx + 30; x <= cx + VIEW_W - 30; x += 24) {
        let run = 0;
        for (let y = camY + 36; y <= camY + 210; y += 2) {
          const blocked = T.solidOverlap({ x: x - 20, y: y - 22, w: 40, h: 22 }, null);
          run = blocked ? 0 : run + 2;
          best = Math.max(best, run);
        }
      }
      expect(best, `corridor at camera x ${cx}`).toBeGreaterThanOrEqual(40);
    }
  });

  it('builds the boss arena to THUNDERHEAD\'s notes: open sky, fixed camera, kill floor far below', () => {
    const lock = L.locks!.find((l) => l.boss)!;
    expect(lock.x).toBe(L.width - VIEW_W);
    expect(lock.announce).toMatch(/^WARNING/);
    const spawns = lock.waves.flatMap((wv) => wv.spawns);
    expect(spawns.map((s) => s.type)).toEqual(['boss_m5']);
    const x0 = lock.x - 8;
    const x1 = lock.x + VIEW_W + 8;
    for (const s of L.solids ?? []) expect(s.x + s.w < x0 || s.x > x1, `solid at ${s.x}`).toBe(true);
    for (const p of L.platforms ?? []) expect(p.x + p.w < x0 || p.x > x1, `platform at ${p.x}`).toBe(true);
    for (const d of L.decor ?? []) if (d.layer === 'front') expect(d.x < x0 || d.x > x1, `front decor at ${d.x}`).toBe(true);
    for (const line of L.ground) for (const [, y] of line) {
      expect(y).toBeGreaterThanOrEqual(L.height + 120);
      expect(y).toBeLessThanOrEqual(L.height + 200);
    }
    const w = makeWorld('m5');
    const b = w.camera.boundsAt(lock.x);
    expect(b.minY).toBe(b.maxY);
    // A calm screen before the lock: no enemies triggered in the last 380 px of approach.
    const late = (L.entities ?? []).filter((s) => {
      const cat = getEntityType(s.type)?.category;
      return (cat === 'enemy' || cat === 'boss') && (s.trigger ?? s.x - 8) > lock.x - 380 + VIEW_W;
    });
    expect(late).toEqual([]);
  });

  it('uses the m5 theme: storm sky, parallax, hull solids, platforms and its own decor kinds', () => {
    const T = getTheme('m5');
    expect(T.layers!.length).toBeGreaterThanOrEqual(3);
    expect(T.renderOverlay).toBeTypeOf('function');
    expect(T.renderBackground).toBeTypeOf('function');
    expect(T.platform).toBeTypeOf('function');
    const kinds = Object.keys(T.decor ?? {});
    expect(kinds.length).toBeGreaterThanOrEqual(6);
    for (const d of L.decor ?? []) expect(kinds, d.kind).toContain(d.kind);
    expect(new Set((L.decor ?? []).map((d) => d.kind)).size).toBeGreaterThanOrEqual(6);
    // Ships placed by the builder have hull colliders inside the level.
    expect(M5_BUILD.ships.length).toBeGreaterThanOrEqual(8);
    for (const s of L.solids ?? []) {
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y + s.h).toBeLessThanOrEqual(L.height);
    }
  });
});

describe('mission 5 mechanics', () => {
  it('glides the starting gyro down from under the HUD into open sky', () => {
    const w = makeWorld('m5');
    const v = gyroOf(w);
    expect(v.y - w.camera.y).toBeLessThan(60);
    step(w, Math.round(1.7 / DT));
    expect(w.players[0].vehicle).toBe(v);
    expect(v.y - w.camera.y).toBeGreaterThan(90);
  });

  it('eases a gyro squeezed into a hull back out (no flying through airships)', () => {
    const ship = M5_BUILD.ships.find((s) => s.id === 'frigate')!;
    const w = worldAt(ship.cx - 250);
    const v = gyroOf(w);
    const solid = (L.solids ?? []).find((s) => s.x < ship.cx && s.x + s.w > ship.cx && s.y >= ship.deckY - 1)!;
    v.x = ship.cx;
    v.y = solid.y + 14;
    v.vx = v.vy = 0;
    expect(w.terrain.solidOverlap({ x: v.x - v.w / 2, y: v.y - v.h, w: v.w, h: v.h - 0.5 }, v)).not.toBeNull();
    step(w, 60);
    expect(w.terrain.solidOverlap({ x: v.x - v.w / 2, y: v.y - v.h, w: v.w, h: v.h - 0.5 }, v)).toBeNull();
    expect(w.query((e) => e instanceof Airspace).length).toBe(1);
  });

  it('flies a spare gyro down to a pilot shot down over a deck, without costing a life', () => {
    const ship = M5_BUILD.ships.find((s) => s.id === 'cruiser')!;
    const w = worldAt(ship.cx - 200, { god: false });
    const p = w.players[0];
    const lives = p.profile.lives;
    const v = gyroOf(w);
    v.x = ship.cx;
    v.y = ship.deckY - 30;
    v.startDestruction();
    let landed = false;
    for (let i = 0; i < 6 / DT && p.state !== 'vehicle'; i++) {
      step(w, 1);
      if (p.state === 'play' && p.onGround) landed = true;
    }
    expect(landed).toBe(true);
    expect(p.state).toBe('vehicle');
    expect(p.vehicle).not.toBe(v);
    expect(p.vehicle!.secondaryAmmo).toBe(SPARE_AMMO);
    expect(p.profile.lives).toBe(lives);
  });

  it('a pilot falling into the cloud sea loses a life and drops back in with a fresh gyro', () => {
    const w = worldAt(6340, { god: false });
    const p = w.players[0];
    const lives = p.profile.lives;
    const v = gyroOf(w);
    // Open sky under the gyro: nothing to land on.
    expect(w.terrain.floorAt(v.x, v.y, L.height + 70)).toBeNull();
    v.startDestruction();
    for (let i = 0; i < 8 / DT && !(p.state === 'vehicle' && p.vehicle !== v); i++) step(w, 1);
    expect(p.profile.lives).toBe(lives - 1);
    expect(p.state).toBe('vehicle');
    expect(p.vehicle).not.toBe(v);
  });

  it('rescues caged hostages on a deck from the gyro: thanks, item, then a parachute exit', () => {
    const ship = M5_BUILD.ships.filter((s) => s.id === 'frigate').pop()!;
    // Leave room on screen to the left of the deck: he runs off its end and pops a parachute.
    const w = worldAt(ship.deck0 - 250);
    const h = w.spawn('hostage', ship.deck0 + 30, ship.deckY, { mode: 'caged', drop: 'fuel' }) as Hostage;
    step(w, 2);
    expect(h.mode).toBe('caged');
    expect(h.onGround).toBe(true);
    const v = gyroOf(w);
    v.x = h.x - 70;
    v.y = h.y - 6;
    const rescues = w.stats.rescues;
    for (let i = 0; i < 20 && h.mode === 'caged'; i++) h.damage({ amount: 1, kind: 'bullet', owner: w.players[0] });
    expect(h.mode).not.toBe('caged');
    expect(w.stats.rescues).toBe(rescues + 1);
    const modes = new Set<string>();
    for (let i = 0; i < 12 / DT && !h.dead; i++) {
      step(w, 1);
      modes.add(h.mode);
    }
    expect(modes.has('give')).toBe(true);
    expect(modes.has('chute')).toBe(true);
    expect(h.dead).toBe(true);
  });

  it('supply drops drift down under a parachute and repair the gyro that touches them', () => {
    const w = worldAt(2000);
    const v = gyroOf(w);
    v.hp = 20;
    const s = w.spawn('m5_supply', v.x + 60, undefined, { item: 'fuel' }) as SkySupply;
    expect(s).toBeInstanceOf(SkySupply);
    step(w, 1);
    const y0 = s.y;
    expect(y0).toBeLessThan(w.camera.y + 10);
    step(w, 180);
    expect(s.y).toBeGreaterThan(y0 + 20);
    expect(s.y - y0).toBeLessThan(80);
    v.x = s.x;
    v.y = s.y + 4;
    step(w, 2);
    expect(s.dead).toBe(true);
    expect(v.hp).toBeGreaterThan(20);
  });

  it('pilots stay aboard their gyros for the mission-complete celebration (no fall, no life lost)', () => {
    const w = worldAt(6400, { god: false });
    const p = w.players[0];
    const v = gyroOf(w);
    const lives = p.profile.lives;
    let died = 0;
    w.on('playerDied', () => died++);
    p.celebrate();
    step(w, Math.round(4 / DT));
    expect(p.vehicle).toBe(v);
    expect(p.profile.lives).toBe(lives);
    expect(died).toBe(0);
  });

  it('a pickup tossed off a deck into the open sky pops a parachute and can still be caught', () => {
    const w = worldAt(6340);
    const v = gyroOf(w);
    v.hp = 30;
    const x = w.camera.x + 250;
    expect(w.terrain.floorAt(x, w.camera.y, w.terrain.killY)).toBeNull();
    const pk = dropPickup(w, x, w.camera.y + 80, 'fuel', -45)!;
    let chute: SkySupply | null = null;
    for (let i = 0; i < 90 && !chute; i++) {
      step(w, 1);
      chute = (w.query((e) => e instanceof SkySupply)[0] as SkySupply) ?? null;
    }
    expect(chute).not.toBeNull();
    expect(pk.dead).toBe(true);
    expect(chute!.item?.kind).toBe('fuel');
    // It drifts down slowly: the gyro flies over and grabs it.
    const y0 = chute!.y;
    step(w, 60);
    expect(chute!.y - y0).toBeLessThan(25);
    v.x = chute!.x;
    v.y = chute!.y + 4;
    step(w, 2);
    expect(chute!.dead).toBe(true);
    expect(v.hp).toBeGreaterThan(30);
  });

  it('the fuel zeppelin blocks its wave until it blows up, and its fireball clears the escorts', () => {
    const w = worldAt(2000);
    const cam = w.camera;
    const z = w.spawn('m5_fuel_zeppelin', cam.x + 260, cam.y + 100, {}) as FuelZeppelin;
    expect(z).toBeInstanceOf(FuelZeppelin);
    expect(z.blocksProgress).toBe(true);
    step(w, 5);
    const escort = w.spawn('jetpack', z.x - 40, z.y - 30, {});
    step(w, 5);
    for (let i = 0; i < 400 && !z.dying; i++) z.damage({ amount: 5, kind: 'bullet', owner: w.players[0] });
    expect(z.dying).toBe(true);
    for (let i = 0; i < 4 / DT && !z.dead; i++) step(w, 1);
    expect(z.dead).toBe(true);
    expect(escort!.dead || (escort as any).dying).toBe(true);
  });
});

describe('mission 5 autopilot', () => {
  it('the invincible autopilot completes STORMFRONT', () => {
    const r = simulateMission('m5', 900);
    if (!r.completed) console.log(JSON.stringify(r));
    expect(r.completed).toBe(true);
    expect(r.rescues).toBeGreaterThanOrEqual(3);
  }, 300_000);

  it('two autopilots complete it in co-op, both flying gyros', () => {
    const w = makeWorld('m5', { players: 2, god: true });
    expect(w.players.length).toBe(2);
    for (const p of w.players) expect(p.vehicle?.type).toBe('gyro');
    const bots = w.players.map((p) => new Bot(p.index));
    for (let i = 0; i < 900 / DT && w.state !== 'complete'; i++) step(w, 1, bots);
    for (let k = 0; k < 2; k++) input.setVirtual(k, null);
    expect(w.state).toBe('complete');
  }, 300_000);
});
