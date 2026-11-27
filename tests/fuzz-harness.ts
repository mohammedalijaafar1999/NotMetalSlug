// Chaos fuzz harness (used by tests/fuzz.test.ts): drives mortal and invincible players with
// random-but-sticky action masks interleaved with the autopilot and checks world invariants
// every frame (no exceptions, finite positions, bounded entity count, nobody stuck inside solid
// terrain or lost outside the level, arenas always clear, no dead entities lingering...).
import { DT, makeWorld } from './helpers';
import { input, type ActionMask } from '../src/engine/input';
import { fxRng, Rng } from '../src/engine/rng';
import { VIEW_H, VIEW_W } from '../src/engine/renderer';
import { Bot } from '../src/debug/bot';
import { Player } from '../src/game/player';
import { Entity, type Actor } from '../src/game/entity';
import type { World } from '../src/game/world';
import type { Vehicle } from '../src/game/vehicle';
import { getEntityType, type SpawnSpec } from '../src/game/registry';

/** Max frames an actor may overlap solid terrain before it counts as stuck. */
const STUCK_FRAMES = 12;
const MAX_ENTITIES = 600;
/** Seconds a non-boss arena may stay locked (chaos slows the autopilot down a lot). */
const LOCK_MAX = 170;
const BOSS_LOCK_MAX = 420;

export interface FuzzCase {
  level: string;
  seed: number;
  seconds: number;
  /** Players present from the start. */
  players: 1 | 2;
  /** Invincible flags per player. */
  god: [boolean, boolean];
  /** Join player 2 (drop-in) after this many seconds. */
  joinP2At?: number;
  /** Mission timer on, with TIME UP kills (as the gameplay scene does). */
  timer?: boolean;
  difficulty?: 0 | 1 | 2;
  /** Warp the camera to this x right after the start. */
  warpX?: number;
  /** Probability per frame-group to be in chaos (vs autopilot) mode. */
  chaos?: number;
  /** Debug hook called after every simulated frame. */
  trace?: (w: World, frame: number) => void;
}

export interface FuzzReport {
  name: string;
  violations: string[];
  completed: boolean;
  maxCamX: number;
  maxEntities: number;
  deaths: number;
  continues: number;
  vehiclesEntered: number;
  locksDone: number;
  locks: number;
  simSeconds: number;
}

/** Random-but-sticky input, alternating with the autopilot. */
class ChaosDriver {
  private mode: 'bot' | 'chaos' = 'bot';
  private modeT = 0;
  private mask: ActionMask = {};
  private maskT = 0;
  private readonly bot: Bot;

  constructor(
    readonly index: number,
    private readonly rng: Rng,
    private readonly chaos: number,
  ) {
    this.bot = new Bot(index);
    this.modeT = rng.range(0.5, 3);
  }

  update(w: World): void {
    this.modeT -= DT;
    if (this.modeT <= 0) {
      this.mode = this.rng.chance(this.chaos) ? 'chaos' : 'bot';
      this.modeT = this.mode === 'bot' ? this.rng.range(3, 12) : this.rng.range(0.8, 5);
    }
    if (this.mode === 'bot') {
      this.bot.update(w);
      return;
    }
    this.maskT -= DT;
    if (this.maskT <= 0) {
      this.mask = this.randomMask();
      this.maskT = this.rng.range(0.04, 0.9);
    }
    input.setVirtual(this.index, { ...this.mask });
  }

  private randomMask(): ActionMask {
    const r = this.rng;
    const h = r.next();
    const m: ActionMask = {
      right: h < 0.5,
      left: h >= 0.5 && h < 0.75,
      up: r.chance(0.22),
      down: r.chance(0.28),
      fire: r.chance(0.6),
      jump: r.chance(0.32),
      bomb: r.chance(0.07),
    };
    // Now and then mash a combo that matters: eject / drop-through, crouch-walk, jump-shoot down.
    const combo = r.next();
    if (combo < 0.06) Object.assign(m, { down: true, jump: true });
    else if (combo < 0.1) Object.assign(m, { down: true, right: true, jump: false, up: false });
    else if (combo < 0.14) Object.assign(m, { down: true, fire: true, jump: true });
    return m;
  }
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : String(n);
}

function describeEntity(e: Entity): string {
  const st = (e as any).state !== undefined ? ` state=${(e as any).state}` : '';
  return `${e.type}#${e.id}@(${fmt(e.x)},${fmt(e.y)})${st}`;
}

/** Why an actor's body overlaps solid terrain right now (null = it does not). */
function insideTerrain(w: World, a: Actor, groundTol = 3, ignoreHazards = false): string | null {
  const T = w.terrain;
  if (a.w < 6 || a.h < 6) return null;
  const r = { x: a.x - a.w / 2 + 2, y: a.y - a.h + 3, w: a.w - 4, h: a.h - 5 };
  const s = T.solidOverlap(r, a);
  // An invulnerable body is not crushed: a press head resting on it until it lifts is expected.
  const crusher = s && ignoreHazards && s.dynamic && s.owner && getEntityType(s.owner.type)?.category === 'hazard';
  if (s && !crusher) return `solid#${s.id}(${s.x},${s.y} ${s.w}x${s.h}${s.owner ? ' owner=' + s.owner.type : ''}${s.dynamic ? ' dynamic' : ''})`;
  const gy = T.groundTopAt(a.x);
  if (a.y > gy + groundTol) return `ground (feet ${fmt(a.y)} below ground top ${fmt(gy)})`;
  return null;
}

/** Spawn a drop-in player the way the gameplay scene does. */
function joinPlayer(w: World, i: 0 | 1, god: boolean): Player {
  const def = w.level.def;
  const prof = w.session.join(i);
  prof.missionRescues = 0;
  const p = new Player(prof);
  p.x = Math.max(def.start.x + i * 22, w.camera.x + 40);
  p.y = w.camera.y - 8;
  p.godMode = god;
  w.add(p);
  w.players.push(p);
  if (def.startVehicle) {
    const v = w.spawn(def.startVehicle, p.x, p.y + 40) as Vehicle | null;
    if (v && (v as any).isVehicle) {
      p.state = 'play';
      p.hittable = true;
      v.enter(p);
    }
  }
  return p;
}

/** Warp like the debug API, but put players safely above the floor at their new x. */
function warpTo(w: World, x: number): void {
  // The debug warp drops every spawn whose trigger is already in view, set pieces included (cable
  // car, pontoons, lift...): without them the section is impassable. Keep those still ahead.
  const before: SpawnSpec[] = [...((w.level as any).pendingSpawns as SpawnSpec[])];
  w.level.warp(x);
  const after = new Set((w.level as any).pendingSpawns as SpawnSpec[]);
  for (const s of before) {
    const cat = getEntityType(s.type)?.category;
    if (!after.has(s) && (cat === 'misc' || cat === 'hazard') && s.x >= x - 40) w.spawn(s.type, s.x, s.y, s.props ?? {});
  }
  const cam = w.camera;
  const px = x + 60;
  const fy = w.terrain.topFloorAt(px) ?? w.level.def.height - 40;
  const b = cam.boundsAt(cam.x);
  cam.y = Math.max(b.minY, Math.min(b.maxY, fy - VIEW_H * 0.64));
  for (const p of w.players) {
    const t = (p.vehicle ?? p) as Actor;
    t.x = px + p.index * 20;
    t.y = Math.min(fy - 4, cam.y + 40);
    t.vy = 0;
    t.onGround = false;
  }
}

export function runFuzz(c: FuzzCase): FuzzReport {
  const name = `${c.level} ${c.players}P${c.joinP2At !== undefined ? '+join' : ''} god=${c.god.map((g) => (g ? 1 : 0)).join('')} seed=${c.seed}${c.timer ? ' timer' : ''}${c.difficulty !== undefined ? ' diff=' + c.difficulty : ''}${c.warpX !== undefined ? ' warp=' + c.warpX : ''}`;
  // Reproducible in isolation: reset every bit of global state a previous case could leave.
  fxRng.seed(c.seed * 7919 + 13);
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
  input.flush();
  Entity.nextId = 1; // ids seed some AI phase offsets (patrol turns, hover wobble)
  const rng = new Rng(c.seed * 104729 + 7);
  const w = makeWorld(c.level, { seed: c.seed, players: c.players, god: false, difficulty: c.difficulty ?? 1 });
  for (const p of w.players) p.godMode = c.god[p.index];
  const violations: string[] = [];
  const seen = new Set<string>();
  const report = (key: string, msg: string) => {
    if (seen.has(key) || violations.length >= 40) return;
    seen.add(key);
    violations.push(`[${name} t=${fmt(w.time)} cam=(${fmt(w.camera.x)},${fmt(w.camera.y)})] ${msg}`);
  };
  let deaths = 0;
  let continues = 0;
  let vehiclesEntered = 0;
  w.on('playerDied', () => deaths++);
  w.on('missionComplete', () => {
    for (const p of w.players) p.celebrate();
  });
  if (c.timer) {
    w.level.timerEnabled = true;
    w.level.onTimeUp = () => {
      for (const p of w.players) if (p.state === 'play' || p.state === 'vehicle') p.kill();
    };
  }
  if (c.warpX !== undefined) warpTo(w, c.warpX);

  const drivers: ChaosDriver[] = [0, 1].map((i) => new ChaosDriver(i, new Rng(rng.int(1, 1e9)), c.chaos ?? 0.45));
  const outT = [0, 0];
  const stuckFrames = new Map<number, number>();
  const dyingSince = new Map<number, number>();
  const zombieSince = new Map<number, number>();
  const prevDead = new Set<number>();
  const seenShots = new Set<number>();
  const prevVehicle = new Map<number, Vehicle | null>();
  let lockKey: unknown = null;
  let lockSince = 0;
  let progressT = 0;
  let bestX = w.camera.x;
  let bestY = w.camera.y;
  let maxEntities = 0;
  let completeT = -1;
  const steps = Math.round(c.seconds / DT);
  const levelW = w.level.def.width;

  for (let i = 0; i < steps; i++) {
    // Drop-in player 2.
    if (c.joinP2At !== undefined && !w.session.players[1].joined && w.time >= c.joinP2At) joinPlayer(w, 1, c.god[1]);
    // Continues (the scene's countdown: someone always puts a coin in).
    for (const p of w.players) {
      if (p.state !== 'out') continue;
      outT[p.index] += DT;
      if (outT[p.index] > 1.5) {
        outT[p.index] = 0;
        w.session.continueGame(p.index);
        p.respawn();
        continues++;
      }
    }
    for (const d of drivers) if (w.session.players[d.index].joined) d.update(w);
    input.poll(DT);
    const allOut = w.players.length > 0 && w.players.every((p) => p.state === 'out');
    // Frozen frames (continue prompt, hit-stop) do not run the cleanup pass.
    const frozen = allOut || (w as any).hitstopTime > 0;
    try {
      // The scene freezes the world while everybody is at the continue prompt.
      if (!allOut) w.update(DT);
    } catch (err: any) {
      report('exception', `EXCEPTION ${err?.stack ?? err}`);
      break;
    }

    c.trace?.(w, i);

    // ---- invariants
    const cam = w.camera;
    const T = w.terrain;
    if (!Number.isFinite(cam.x) || !Number.isFinite(cam.y)) report('camnan', `camera not finite (${cam.x}, ${cam.y})`);
    if (cam.x < -0.5 || cam.x > Math.max(0, levelW - VIEW_W) + 0.5) report('camx', `camera x ${fmt(cam.x)} outside the level`);
    maxEntities = Math.max(maxEntities, w.entities.length);
    if (w.entities.length > MAX_ENTITIES) {
      const counts = new Map<string, number>();
      for (const e of w.entities) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      report('count', `entity count ${w.entities.length} > ${MAX_ENTITIES}: ${top.map(([t, n]) => `${t}=${n}`).join(' ')}`);
    }
    const nowDead = new Set<number>();
    // Enemy fire must come from inside the view (no shots from off-screen).
    for (const e of w.entities) {
      if (e.team !== 'enemy' || (e as any).damageAmount === undefined || seenShots.has(e.id)) continue;
      seenShots.add(e.id);
      const o = (e as any).owner as Entity | null;
      if (o && (o as any).isBoss) continue;
      const off = Math.max(cam.x - e.x, e.x - (cam.x + VIEW_W), cam.y - 40 - e.y);
      if (off > 12) report('offshot:' + (o?.type ?? e.type), `enemy shot ${describeEntity(e)} fired ${fmt(off)} px outside the view by ${o ? describeEntity(o) : 'no owner'}`);
    }
    for (const e of w.entities) {
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.vx) || !Number.isFinite(e.vy)) {
        report('nan:' + e.type, `non-finite position/velocity ${describeEntity(e)} v=(${e.vx},${e.vy})`);
      }
      if (e.dead) {
        nowDead.add(e.id);
        if (prevDead.has(e.id) && !frozen) report('deadlinger:' + e.type, `dead entity still in world.entities: ${describeEntity(e)}`);
      }
      const dying = (e as any).dying === true || (e as any).destroyed === true;
      if (dying && !e.dead) {
        const since = dyingSince.get(e.id) ?? w.time;
        dyingSince.set(e.id, since);
        const limit = e.team === 'enemy' && (e as any).isBoss ? 25 : 12;
        if (w.time - since > limit) report('dyinglinger:' + e.type, `${describeEntity(e)} has been dying/destroyed for ${fmt(w.time - since)} s`);
      }
      if (e.team === 'enemy' && e.hittable && e.hp <= 0 && !e.dead) {
        const since = zombieSince.get(e.id) ?? w.time;
        zombieSince.set(e.id, since);
        if (w.time - since > 1) report('zombie:' + e.type, `${describeEntity(e)} is hittable with hp ${e.hp} for ${fmt(w.time - since)} s`);
      } else zombieSince.delete(e.id);
      // Vehicles: never stuck in solids, driver links consistent.
      if ((e as any).isVehicle && !e.dead) {
        const v = e as unknown as Vehicle;
        if (!v.destroyed) {
          // The m1 river bog deliberately sinks a caught vehicle 7 px into the mud.
          const why = insideTerrain(w, v, v.inWater ? 9 : 3);
          const n = why ? (stuckFrames.get(v.id) ?? 0) + 1 : 0;
          stuckFrames.set(v.id, n);
          if (n > STUCK_FRAMES) report('vstuck:' + v.type, `vehicle ${describeEntity(v)} inside terrain for ${n} frames: ${why} driver=${v.driver?.index ?? '-'}`);
        }
        if (v.driver && v.driver.vehicle !== v) report('vlink:' + v.type, `vehicle ${describeEntity(v)} driver P${v.driver.index + 1} is not in it (state ${v.driver.state})`);
        if (v.y - v.h > T.killY + 4) report('vfall:' + v.type, `vehicle ${describeEntity(v)} fell below the kill line without being removed`);
      }
    }
    for (const id of prevDead) if (!nowDead.has(id)) prevDead.delete(id);
    for (const id of nowDead) prevDead.add(id);

    for (const p of w.players) {
      const tag = `P${p.index + 1}`;
      if (p.vehicle && prevVehicle.get(p.index) !== p.vehicle) vehiclesEntered++;
      prevVehicle.set(p.index, p.vehicle);
      if (p.profile.lives < 0) report('lives' + p.index, `${tag} has ${p.profile.lives} lives`);
      if (!Number.isFinite(p.profile.score) || p.profile.score < 0) report('score' + p.index, `${tag} score ${p.profile.score}`);
      if (p.bombs < 0 || p.bombs > 99) report('bombs' + p.index, `${tag} bombs ${p.bombs}`);
      if (p.weapon.id !== 'pistol' && !(p.ammo > 0 && Number.isFinite(p.ammo))) report('ammo' + p.index, `${tag} holds ${p.weapon.id} with ammo ${p.ammo}`);
      if (p.state === 'vehicle') {
        if (!p.vehicle || p.vehicle.driver !== p || p.vehicle.dead) report('plink' + p.index, `${tag} in vehicle state but vehicle=${p.vehicle ? describeEntity(p.vehicle) : 'null'} driver=${p.vehicle?.driver?.index ?? '-'}`);
      } else if (p.vehicle) report('pveh' + p.index, `${tag} state ${p.state} still references vehicle ${describeEntity(p.vehicle)}`);
      if (p.state === 'play' && !p.hittable) report('phit' + p.index, `${tag} is in play but not hittable (god=${p.godMode})`);
      // Inside terrain (on foot, alive).
      if (p.state === 'play' || p.state === 'respawn' || p.state === 'victory') {
        const why = insideTerrain(w, p, 3, p.godMode || p.invuln > 0);
        const n = why ? (stuckFrames.get(p.id) ?? 0) + 1 : 0;
        stuckFrames.set(p.id, n);
        if (n > STUCK_FRAMES) report('pstuck' + p.index + ':' + why!.replace(/[\d.]+/g, '#'), `${tag} inside terrain for ${n} frames at (${fmt(p.x)},${fmt(p.y)}) state=${p.state}: ${why}`);
      } else stuckFrames.set(p.id, 0);
      // Bounds.
      const active = p.state === 'play' || p.state === 'respawn' || p.state === 'vehicle';
      if (active) {
        const t = (p.vehicle ?? p) as Actor;
        if (t.x < -1 || t.x > levelW + 1) report('pbounds' + p.index, `${tag} x ${fmt(t.x)} outside the level (0..${levelW})`);
        if (t.x < cam.x - 4 || t.x > cam.x + VIEW_W + 4) report('pview' + p.index, `${tag} (${p.state}) at x ${fmt(t.x)} outside the view ${fmt(cam.x)}..${fmt(cam.x + VIEW_W)}`);
        if (t.y - t.h > T.killY + 2) report('pkill' + p.index, `${tag} (${p.state}) below the kill line (y ${fmt(t.y)}, killY ${T.killY}) without dying`);
        if (t.bottom < cam.y - 120 && p.state !== 'respawn') report('pabove' + p.index, `${tag} (${p.state}) far above the view (y ${fmt(t.y)})`);
      }
    }

    // Arenas always clear (eventually).
    const lock = w.level.activeLock;
    if (lock !== lockKey) {
      lockKey = lock;
      lockSince = w.time;
    } else if (lock) {
      const limit = lock.def.boss ? BOSS_LOCK_MAX : LOCK_MAX;
      if (w.time - lockSince > limit) {
        const blockers = lock.tracked.filter((e) => !e.dead && e.blocksProgress).map(describeEntity);
        report('lock' + lock.def.x, `lock at x=${lock.def.x} (wave ${lock.wave + 1}/${lock.def.waves.length}) still active after ${fmt(w.time - lockSince)} s; blockers: ${blockers.join(', ') || 'none tracked'}`);
      }
    }
    // Progress (forward or upward) while not locked.
    if (cam.x > bestX + 1 || cam.y < bestY - 1) {
      bestX = Math.max(bestX, cam.x);
      bestY = Math.min(bestY, cam.y);
      progressT = w.time;
    } else if (lock) progressT = w.time;
    if (!lock && w.state === 'play' && w.time - progressT > 90) report('stall' + Math.round(bestX / 100), `no camera progress for ${fmt(w.time - progressT)} s near x=${fmt(bestX)} (players: ${w.players.map((p) => `${p.state}@${fmt(p.x)},${fmt(p.y)}`).join(' ')})`);

    if (w.state === 'complete') {
      if (completeT < 0) completeT = w.time;
      if (w.time - completeT > 3) break;
    }
  }
  for (let k = 0; k < 2; k++) input.setVirtual(k, null);
  const ls = w.level.lockStates();
  return {
    name,
    violations,
    completed: w.state === 'complete',
    maxCamX: Math.round(bestX),
    maxEntities,
    deaths,
    continues,
    vehiclesEntered,
    locksDone: ls.filter((l) => l.state === 'done').length,
    locks: ls.length,
    simSeconds: Math.round(w.time),
  };
}

