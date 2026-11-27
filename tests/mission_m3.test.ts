// Mission 3 FROSTBITE PASS: level layout contract, the autopilot run, the cable car (boarding,
// railings over the gorge, the mid-gorge jam tied to its camera lock, docking) and the plank bridge
// that holds people but drops the STRIDER walker into the icy creek.
import { describe, expect, it } from 'vitest';
import { makeWorld, step, simulateMission, DT } from './helpers';
import { input } from '../src/engine/input';
import { getLevel, type LevelDef } from '../src/game/level';
import { getEntityType } from '../src/game/registry';
import { themeIds } from '../src/game/theme';
import { VIEW_H, VIEW_W } from '../src/engine/renderer';
import { CableCar } from '../src/content/levels/m3/cablecar';
import { WeakBridge } from '../src/content/levels/m3/bridge';
import { M3 } from '../src/content/levels/m3';
import type { World } from '../src/game/world';
import type { Player } from '../src/game/player';
import type { Vehicle } from '../src/game/vehicle';

function release(): void {
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
}

/** Kill every enemy on screen (keeps mechanic tests about the mechanic). */
function clearEnemies(w: World, by: Player): void {
  for (const e of w.entities) if (e.team === 'enemy' && e.hittable && !e.dead && e.onScreen(8)) e.damage({ amount: 999, kind: 'explosion', owner: by });
}

describe('mission 3 FROSTBITE PASS', () => {
  const L = getLevel('m3')!;

  it('is registered with the mission contract', () => {
    expect(L).toBeTruthy();
    expect(L.mission).toBe(3);
    expect(L.theme).toBe('m3');
    expect(themeIds()).toContain('m3');
    expect(L.music).toBe('m3');
    expect(L.bossMusic).toBe('boss');
    expect(L.bossName).toBe('FROST BASTION');
    expect(L.width).toBeGreaterThanOrEqual(4500);
    expect(L.width).toBeLessThanOrEqual(8000);
    expect(L.timeLimit).toBeGreaterThanOrEqual(60);
    expect(L.timeLimit).toBeLessThanOrEqual(99);
    const specs = [...(L.entities ?? []), ...(L.locks ?? []).flatMap((l) => l.waves.flatMap((wv) => wv.spawns))];
    for (const s of specs) expect(getEntityType(s.type), s.type).toBeTruthy();
    const hostages = specs.filter((s) => s.type === 'hostage');
    expect(hostages.length).toBeGreaterThanOrEqual(8);
    expect(hostages.length).toBeLessThanOrEqual(11);
    const modes = new Set(hostages.map((h) => h.props?.mode ?? 'tied'));
    expect(modes).toEqual(new Set(['tied', 'caged', 'wander']));
    const crates = (L.entities ?? []).filter((s) => s.type === 'pickup' && /^[HRSFLCB]$/.test(s.props?.item ?? ''));
    expect(crates.length).toBeGreaterThanOrEqual(2);
    const locks = L.locks ?? [];
    const arenas = locks.filter((l) => !l.boss);
    expect(arenas.length).toBeGreaterThanOrEqual(3);
    expect(arenas.length).toBeLessThanOrEqual(6);
    for (const a of arenas) {
      expect(a.waves.length).toBeGreaterThanOrEqual(2);
      expect(a.waves.length).toBeLessThanOrEqual(4);
    }
    // Signature enemy + required roster.
    for (const t of ['snowmobile', 'paratrooper', 'shield_trooper', 'sniper', 'mortar', 'jetpack', 'grenadier', 'light_tank', 'heli', 'robot', 'drone', 'mech']) {
      expect(specs.some((s) => s.type === t), t).toBe(true);
    }
    // Checkpoints at least every ~1200 px.
    const cps = [0, ...(L.checkpoints ?? [])];
    for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1]).toBeLessThanOrEqual(1200);
    expect(M3.BOSS_X - cps[cps.length - 1]).toBeLessThanOrEqual(1200);
    // Briefing: uppercase, at most 11 lines of ~36 characters.
    const words = (L.briefing ?? '').split(/\s+/).filter(Boolean);
    let lines = 1;
    let len = 0;
    for (const wd of words) {
      if (len && len + 1 + wd.length > 36) {
        lines++;
        len = wd.length;
      } else len += (len ? 1 : 0) + wd.length;
    }
    expect(L.briefing).toBe(L.briefing!.toUpperCase());
    expect(lines).toBeLessThanOrEqual(11);
    // Terrain variety: slopes, one-way platforms of several styles, solids, water, a vertical section.
    expect(L.solids?.length ?? 0).toBeGreaterThan(0);
    expect(L.water?.length ?? 0).toBeGreaterThan(0);
    const styles = new Set((L.platforms ?? []).map((p) => p.style ?? 'wood'));
    for (const st of ['wood', 'metal', 'rock', 'ice']) expect(styles.has(st), st).toBe(true);
    const w = makeWorld('m3');
    const climb = w.camera.boundsAt(M3.CLIFF - 170);
    expect(climb.maxY - climb.minY).toBeGreaterThanOrEqual(300);
  });

  it('keeps arena waves fair: walkers enter on screen or from the right, officers stand in view', () => {
    const walkers = new Set(['rifleman', 'grenadier', 'shield_trooper', 'flametrooper', 'bazooka', 'saber', 'robot', 'officer', 'mortar', 'sniper']);
    for (const lock of L.locks ?? []) {
      for (const wave of lock.waves) {
        for (const s of wave.spawns) {
          if (!walkers.has(s.type)) continue;
          // Infantry hold 56-170 px from you: spawned beyond the LEFT edge they would idle off-screen.
          expect(s.x, `${s.type} in lock ${lock.x}`).toBeGreaterThanOrEqual(lock.x + 8);
          // Officers (and stationary crews) never walk in: they must start inside the locked view.
          if (s.type === 'officer' || s.type === 'mortar' || s.type === 'sniper') expect(s.x, `${s.type} in lock ${lock.x}`).toBeLessThanOrEqual(lock.x + VIEW_W - 8);
        }
      }
    }
  });

  it('builds the boss arena to FROST BASTION spec', () => {
    const boss = (L.locks ?? []).find((l) => l.boss)!;
    expect(boss.x).toBe(M3.BOSS_X);
    expect(boss.announce).toBe('WARNING! FROST BASTION');
    expect(boss.music).toBe('boss');
    expect(boss.waves).toHaveLength(1);
    expect(boss.waves[0].spawns).toEqual([{ type: 'boss_m3', x: M3.BOSS_X + 316 }]);
    expect(L.width).toBeGreaterThanOrEqual(M3.BOSS_X + VIEW_W);
    const w = makeWorld('m3');
    // One perfectly flat floor at 184 from lockX - 40 to the end; nothing above it.
    for (let x = M3.BOSS_X - 40; x <= L.width - 1; x += 4) {
      expect(w.terrain.groundTopAt(x + 0.5), `ground at ${x}`).toBe(184);
      expect(w.terrain.topFloorAt(x + 0.5), `floor at ${x}`).toBe(184);
    }
    expect(w.terrain.water.some((wt) => wt.x + wt.w > M3.BOSS_X - 40)).toBe(false);
    // Camera pinned with its top at 0: the ground sits 184 px below the camera top.
    const b = w.camera.boundsAt(M3.BOSS_X);
    expect(b.minY).toBe(0);
    expect(b.maxY).toBe(0);
    expect(184 - b.minY).toBe(184);
    // No pickups / hostages inside the wall, no front decor over it.
    const inWall = (L.entities ?? []).filter((s) => s.x > M3.BOSS_X + 180);
    expect(inWall).toEqual([]);
    expect((L.decor ?? []).filter((d) => d.layer === 'front' && d.x > M3.BOSS_X + 150)).toEqual([]);
    // The climb camera opens vertically; everything else stays readable below the HUD.
    expect(w.camera.boundsAt(M3.CLIFF - 160).minY).toBe(0);
    expect(VIEW_H).toBe(216);
  });

  it('is completed by the autopilot', () => {
    const r = simulateMission('m3', 900);
    if (!r.completed) console.log('m3', JSON.stringify(r));
    expect(r.completed).toBe(true);
    expect(r.rescues).toBeGreaterThanOrEqual(6);
  }, 300_000);

  it('cable car: waits for riders, keeps them aboard over the gorge, jams until its lock is fought, then docks', () => {
    const w = makeWorld('m3', { god: true });
    const p = w.players[0];
    step(w, 60);
    // Warp before the bridge / cable car triggers so both still spawn.
    w.level.warp(2600);
    p.x = 2700;
    p.y = 400;
    p.vy = 0;
    let cab: CableCar | null = null;
    let waitedAtDock = 0;
    let rode = false;
    let halted = false;
    let lockedWhileHalted = true;
    let minRelY = 0;
    let frame = 0;
    let t = 0;
    for (; t < 200; t += DT) {
      frame++;
      cab = cab ?? ((w.entities.find((e) => e instanceof CableCar) as CableCar | undefined) ?? null);
      // Stand on the deck next to the cabin for a while first: it must wait.
      const onDeck = cab && p.x > M3.DOCK_A - 80 && waitedAtDock < 3;
      if (onDeck) {
        p.x = Math.min(p.x, M3.DOCK_A - 50);
        waitedAtDock += DT;
        input.setVirtual(0, {});
        expect(cab!.mode).toBe('dock');
      } else {
        // Push toward the gorge and hop all the time: the railings must hold.
        input.setVirtual(0, { right: true, jump: frame % 50 < 4 });
      }
      step(w, 1);
      clearEnemies(w, p);
      if (cab && (cab.mode === 'ride' || cab.mode === 'halt')) {
        rode = true;
        expect(p.x, 'rider stays over the roof').toBeGreaterThanOrEqual(cab.x - 36);
        expect(p.x, 'rider stays over the roof').toBeLessThanOrEqual(cab.x + 36);
        expect(p.y, 'rider never sinks below the roof').toBeLessThanOrEqual(cab.y + 1);
        minRelY = Math.min(minRelY, p.y - cab.y);
      }
      if (cab?.mode === 'halt') {
        halted = true;
        expect(cab.x).toBe(M3.PYLON);
        if (cab.modeTime > 0.2 && !w.level.locked) lockedWhileHalted = false;
      }
      if (cab?.mode === 'arrived' && p.x > M3.DOCK_B + 50 && p.onGround) break;
    }
    release();
    expect(waitedAtDock).toBeGreaterThanOrEqual(3);
    expect(rode).toBe(true);
    expect(halted).toBe(true);
    expect(lockedWhileHalted).toBe(true);
    expect(minRelY, 'riders actually jumped').toBeLessThan(-20);
    expect(cab!.mode).toBe('arrived');
    expect(cab!.x).toBe(M3.DOCK_B);
    expect(p.x).toBeGreaterThan(M3.DOCK_B + 50);
    expect(p.y).toBe(M3.D);
    expect(w.level.lockStates().find((l) => l.x === M3.JAM_LOCK)?.state).toBe('done');
    expect(t).toBeLessThan(200);
  });

  it('cable car: a rider who dies is dropped back onto the roof, not into the gorge', () => {
    const w = makeWorld('m3', { god: false });
    const p = w.players[0];
    step(w, 60);
    w.level.warp(2600);
    p.x = 3440;
    p.y = 400;
    p.profile.lives = 5;
    let cab: CableCar | null = null;
    let killed = false;
    let landedAgain = false;
    for (let t = 0; t < 60; t += DT) {
      input.setVirtual(0, { right: true });
      step(w, 1);
      clearEnemies(w, p);
      cab = cab ?? ((w.entities.find((e) => e instanceof CableCar) as CableCar | undefined) ?? null);
      if (cab?.mode === 'ride' && cab.x > M3.DOCK_A + 150 && !killed) {
        p.kill();
        killed = true;
      }
      if (killed && p.state === 'play' && p.onGround && p.groundSolid === cab?.solid) {
        landedAgain = true;
        break;
      }
    }
    release();
    expect(killed).toBe(true);
    expect(landedAgain).toBe(true);
    expect(p.profile.lives).toBe(4);
  });

  it('bridge holds people but collapses under the STRIDER, which the creek wrecks (pilot thrown clear)', () => {
    const def: LevelDef = {
      id: 'm3_bridge_test',
      mission: 0,
      name: 'BRIDGE TEST',
      theme: 'm3',
      music: 'm3',
      width: 900,
      height: 216,
      start: { x: 60 },
      ground: [
        [
          [0, 150],
          [300, 150],
          [300, 206],
          [386, 206],
          [460, 150],
          [900, 150],
        ],
      ],
      water: [{ x: 300, y: 192, w: 104, h: 22 }],
      entities: [{ type: 'm3_weak_bridge', x: 300, y: 150, trigger: 0, props: { w: 160, floor: 206 } }],
    };
    const w = makeWorld(def, { god: false });
    const p = w.players[0];
    step(w, 60);
    const bridge = w.entities.find((e) => e instanceof WeakBridge) as WeakBridge;
    expect(bridge).toBeTruthy();
    // On foot: walk right across.
    p.x = 250;
    let t = 0;
    while (p.x < 480 && t < 8) {
      input.setVirtual(0, { right: true });
      step(w, 1);
      t += DT;
      if (p.x > 310 && p.x < 450) expect(p.y, 'walks on the deck').toBe(150);
    }
    release();
    expect(bridge.broken).toBe(false);
    expect(p.x).toBeGreaterThanOrEqual(480);
    // In the walker: back to the left bank, then onto the deck.
    const mech = w.spawn('mech', 240) as unknown as Vehicle;
    step(w, 30);
    p.x = 240;
    p.y = mech.y;
    mech.enter(p);
    expect(p.vehicle).toBe(mech);
    t = 0;
    let wrecked = false;
    while (t < 8) {
      input.setVirtual(0, { right: true });
      step(w, 1);
      t += DT;
      if ((mech as any).destroyed) wrecked = true;
      if (wrecked && !p.vehicle && t > 4) break;
    }
    release();
    expect(bridge.broken).toBe(true);
    expect(wrecked).toBe(true);
    expect(p.vehicle).toBeNull();
    expect(p.state === 'play' || p.state === 'respawn').toBe(true);
    expect(p.profile.lives).toBe(3);
    step(w, 120);
    expect(mech.dead).toBe(true);
    expect(p.state).toBe('play');
    expect(p.profile.lives).toBe(3);
    // The broken deck is gone from the terrain: the ravine is open.
    expect(w.terrain.floorAt(340, 140, 160)).toBeNull();
  });
});
