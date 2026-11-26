// World: the simulation of one mission. Owns terrain, camera, entities, particles and the
// level runtime (spawns, camera locks, checkpoints). Rendering of the world (not HUD) is here too.

import { Rng } from '../engine/rng';
import { audio, type PlayOpts } from '../engine/audio';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { distToRect, rectsOverlap, type Rect } from '../engine/math';
import { Camera } from './camera';
import { Terrain } from './terrain';
import { Entity } from './entity';
import { Particles, ExplosionEffect, FloatingText, SpriteEffect, type ExplosionSize } from './effects';
import { DIFFICULTY, type Damage, type DamageKind, type DifficultyParams, type Team } from './constants';
import { getEntityType, type SpawnSpec } from './registry';
import type { LevelRuntime } from './level';
import type { Player } from './player';
import type { GameSession } from './session';

export type WorldEvent =
  | { type: 'enemyKilled'; entity: Entity; by: Player | null }
  | { type: 'hostageRescued'; entity: Entity; by: Player | null }
  | { type: 'playerDied'; player: Player }
  | { type: 'playerOut'; player: Player }
  | { type: 'bossStart'; boss: Entity; name: string }
  | { type: 'bossDefeated'; boss: Entity }
  | { type: 'missionComplete' }
  | { type: 'checkpoint'; x: number }
  | { type: 'lock'; x: number }
  | { type: 'unlock' }
  | { type: 'pickup'; kind: string; player: Player | null }
  | { type: 'announce'; text: string; color?: string; time?: number; sub?: string };

export interface ExplodeOpts {
  radius: number;
  damage: number;
  /** Team of the attacker: damages the opposing team's targets. */
  team: Team;
  owner?: Entity | null;
  kind?: DamageKind;
  /** Visual size (default from radius). */
  size?: ExplosionSize | 'none';
  shake?: number;
  sfx?: string | null;
  /** Do not damage this entity (e.g. the exploding barrel itself). */
  exclude?: Entity | null;
  /** Also damage players (enemy explosions) AND enemies (e.g. barrels). */
  hitAll?: boolean;
  debris?: string[];
}

export class World {
  readonly terrain: Terrain;
  readonly camera = new Camera();
  readonly particles = new Particles();
  readonly rng: Rng;
  level!: LevelRuntime;
  session: GameSession;
  entities: Entity[] = [];
  private pending: Entity[] = [];
  players: Player[] = [];
  time = 0;
  frame = 0;
  difficulty: DifficultyParams;
  /** Current boss (HUD shows its health bar). */
  boss: Entity | null = null;
  bossName = '';
  /** Freeze-frame timer for heavy impacts. */
  private hitstopTime = 0;
  private listeners = new Map<string, ((e: any) => void)[]>();
  private enemyTargets: Entity[] = [];
  private playerTargets: Entity[] = [];
  private targetsDirty = true;
  /** Mission state, driven by the level runtime / gameplay scene. */
  state: 'play' | 'complete' | 'failed' = 'play';
  /** Shake/flash hooks wired by the gameplay scene. */
  onShake: ((mag: number, dur: number) => void) | null = null;
  onFlash: ((color: string, alpha: number) => void) | null = null;
  /** Set true in headless tests to skip audio. */
  silent = false;
  /** Statistics for the tally screen. */
  stats = { kills: 0, rescues: 0, shotsFired: 0, time: 0 };

  constructor(width: number, height: number, session: GameSession, seed = 1) {
    this.terrain = new Terrain(width, height);
    this.session = session;
    this.rng = new Rng(seed);
    this.difficulty = DIFFICULTY[session.difficulty] ?? DIFFICULTY[1];
  }

  // ------------------------------------------------------------ entities

  add<T extends Entity>(e: T): T {
    e.world = this;
    this.pending.push(e);
    this.targetsDirty = true;
    return e;
  }

  /** Spawn a registered entity type. Returns null (and warns) for unknown types. */
  spawn(type: string, x: number, y?: number, props: Record<string, any> = {}): Entity | null {
    const info = getEntityType(type);
    if (!info) {
      console.warn(`[world] unknown entity type "${type}"`);
      return null;
    }
    const spec: SpawnSpec = { type, x, y, props };
    const e = info.create(this, spec);
    e.type = type;
    e.props = { ...e.props, ...props };
    e.x = x;
    if (y === undefined) {
      const fy = this.terrain.topFloorAt(x);
      e.y = fy ?? this.camera.y + VIEW_H - 16;
    } else {
      e.y = y;
    }
    if (props.facing === 1 || props.facing === -1) e.facing = props.facing;
    this.add(e);
    return e;
  }

  /** Entities of a given class/predicate (includes pending). */
  query<T extends Entity>(pred: (e: Entity) => e is T): T[];
  query(pred: (e: Entity) => boolean): Entity[];
  query(pred: (e: Entity) => boolean): Entity[] {
    const out: Entity[] = [];
    for (const e of this.entities) if (!e.dead && pred(e)) out.push(e);
    for (const e of this.pending) if (!e.dead && pred(e)) out.push(e);
    return out;
  }

  /** Entities that an attack from `team` can hit. */
  targets(team: Team): Entity[] {
    if (this.targetsDirty) this.rebuildTargets();
    if (team === 'player') return this.enemyTargets;
    if (team === 'enemy') return this.playerTargets;
    return [];
  }

  private rebuildTargets(): void {
    this.enemyTargets = [];
    this.playerTargets = [];
    const consider = (e: Entity) => {
      if (e.dead || !e.hittable) return;
      if (e.team === 'enemy' || e.team === 'neutral') this.enemyTargets.push(e);
      else if (e.team === 'player') this.playerTargets.push(e);
    };
    this.entities.forEach(consider);
    this.pending.forEach(consider);
    this.targetsDirty = false;
  }

  /** Mark target caches stale (call after changing hittable/team at runtime). */
  invalidateTargets(): void {
    this.targetsDirty = true;
  }

  /** Players currently in play (alive, not waiting to continue). Includes players in vehicles. */
  activePlayers(): Player[] {
    return this.players.filter((p) => p.isActive);
  }

  /** The entity enemies should aim at for player p (vehicle if driving). */
  targetOf(p: Player): Entity {
    return p.vehicle ?? p;
  }

  /** Nearest targetable player-side entity (player or their vehicle) to (x, y). */
  nearestPlayer(x: number, y: number, maxDist = Infinity): Entity | null {
    let best: Entity | null = null;
    let bd = maxDist;
    for (const p of this.players) {
      if (!p.isTargetable) continue;
      const t = this.targetOf(p);
      const d = Math.hypot(t.cx - x, t.cy - y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  /** Find the player behind an entity (projectile owner, vehicle driver...). */
  ownerPlayer(e: Entity | null | undefined): Player | null {
    let cur: any = e;
    for (let i = 0; i < 6 && cur; i++) {
      if (cur.isPlayer) return cur as Player;
      if (cur.driver && cur.driver.isPlayer) return cur.driver as Player;
      cur = cur.owner;
    }
    return null;
  }

  // ------------------------------------------------------------ combat helpers

  /** Called by Entity.damage when an entity's hp reaches 0. */
  onKilled(e: Entity, d: Damage): void {
    const p = this.ownerPlayer(d.owner);
    if (e.team === 'enemy') {
      this.stats.kills++;
      if (p) p.profile.kills++;
      if (e.scoreValue > 0) this.addScore(d.owner, e.scoreValue);
      this.emit({ type: 'enemyKilled', entity: e, by: p });
    }
  }

  /** Award points to the player behind `by` (if any). Optionally show a popup. */
  addScore(by: Entity | null | undefined, points: number, popup?: { x: number; y: number }): void {
    const p = this.ownerPlayer(by);
    if (!p) return;
    const pts = Math.round((points * this.difficulty.score) / 10) * 10;
    p.profile.score += pts;
    if (popup) this.floatText(String(pts), popup.x, popup.y, '#ffe060');
  }

  /** Area damage + explosion visuals. */
  explode(x: number, y: number, o: ExplodeOpts): void {
    const kind = o.kind ?? 'explosion';
    const hitSet = new Set<Entity>();
    const lists: Entity[][] = o.hitAll ? [this.targets('player'), this.targets('enemy')] : [this.targets(o.team)];
    for (const list of lists) {
      for (const t of list.slice()) {
        if (t === o.exclude || hitSet.has(t) || t.dead) continue;
        let close = false;
        for (const hb of t.hurtboxes()) {
          if (distToRect(x, y, hb) <= o.radius) {
            close = true;
            break;
          }
        }
        if (!close) continue;
        hitSet.add(t);
        t.damage({ amount: o.damage, kind, owner: o.owner ?? null, x, y, dir: Math.sign(t.cx - x) || 1 });
      }
    }
    const size: ExplosionSize | 'none' =
      o.size ?? (o.radius < 10 ? 'tiny' : o.radius < 18 ? 'small' : o.radius < 30 ? 'medium' : o.radius < 46 ? 'large' : 'huge');
    if (size !== 'none') {
      this.add(new ExplosionEffect(x, y, size));
      const big = size === 'large' || size === 'huge';
      this.particles.debris(x, y, big ? 14 : 6, o.debris ?? ['#5a4a3a', '#3a302a', '#7a6a55'], big ? 220 : 150);
      this.particles.smokePuffs(x, y - 4, big ? 8 : 3, o.radius * 0.6);
      this.particles.sparks(x, y, big ? 10 : 5, '#ffd060', big ? 200 : 140);
    }
    const shake = o.shake ?? (o.radius >= 30 ? 4 : o.radius >= 18 ? 2 : 0);
    if (shake > 0) this.shake(shake, 0.25 + shake * 0.04);
    const sfx = o.sfx === undefined ? (o.radius >= 30 ? 'explosion_big' : o.radius >= 14 ? 'explosion' : 'explosion_small') : o.sfx;
    if (sfx) this.sfx(sfx, x);
  }

  // ------------------------------------------------------------ fx helpers

  sfx(name: string, x?: number, opts: PlayOpts = {}): void {
    if (this.silent) return;
    let vol = opts.vol ?? 1;
    let pan = opts.pan ?? 0;
    if (x !== undefined) {
      const cx = this.camera.x + VIEW_W / 2;
      const dx = x - cx;
      pan = Math.max(-0.7, Math.min(0.7, dx / VIEW_W));
      const off = Math.abs(dx) - VIEW_W / 2;
      if (off > 0) vol *= Math.max(0, 1 - off / 260);
      if (vol <= 0.02) return;
    }
    audio.play(name, { ...opts, vol, pan, pitchVar: opts.pitchVar ?? 0.04 });
  }

  shake(mag: number, dur = 0.25): void {
    this.onShake?.(mag, dur);
  }

  flash(color = '#ffffff', alpha = 0.5): void {
    this.onFlash?.(color, alpha);
  }

  hitstop(seconds: number): void {
    this.hitstopTime = Math.max(this.hitstopTime, seconds);
  }

  floatText(text: string, x: number, y: number, color = '#ffffff', life = 1): void {
    this.add(new FloatingText(text, x, y, color, life));
  }

  effect(spriteName: string, x: number, y: number, opts: ConstructorParameters<typeof SpriteEffect>[3] = {}): SpriteEffect {
    return this.add(new SpriteEffect(spriteName, x, y, opts));
  }

  announce(text: string, opts: { color?: string; time?: number; sub?: string } = {}): void {
    this.emit({ type: 'announce', text, ...opts });
  }

  // ------------------------------------------------------------ events

  on<T extends WorldEvent['type']>(type: T, fn: (e: Extract<WorldEvent, { type: T }>) => void): void {
    const l = this.listeners.get(type) ?? [];
    l.push(fn as any);
    this.listeners.set(type, l);
  }

  emit(e: WorldEvent): void {
    const l = this.listeners.get(e.type);
    if (l) for (const fn of l) fn(e);
  }

  // ------------------------------------------------------------ queries

  isVisible(x: number, y: number, margin = 0): boolean {
    const c = this.camera;
    return x > c.x - margin && x < c.x + VIEW_W + margin && y > c.y - margin && y < c.y + VIEW_H + margin;
  }

  /** Overlap test against an entity's hurtboxes. */
  static overlapsEntity(r: Rect, e: Entity): boolean {
    for (const hb of e.hurtboxes()) if (rectsOverlap(r, hb)) return true;
    return false;
  }

  // ------------------------------------------------------------ loop

  private flushPending(): void {
    if (this.pending.length) {
      const add = this.pending;
      this.pending = [];
      for (const e of add) {
        this.entities.push(e);
        e.spawned();
      }
      this.targetsDirty = true;
    }
  }

  update(dt: number): void {
    if (this.hitstopTime > 0) {
      this.hitstopTime -= dt;
      return;
    }
    this.time += dt;
    this.frame++;
    if (this.state === 'play') this.stats.time += dt;
    this.terrain.clearDeltas();
    this.flushPending();
    this.level?.update(dt);
    this.targetsDirty = true;
    const list = this.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      e.age += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.invuln > 0) e.invuln -= dt;
      e.update(dt);
    }
    // Despawn far-behind / far-below entities.
    const c = this.camera;
    for (const e of list) {
      if (e.dead || e.persistent) continue;
      if (e.right < c.x - 220 || e.top > c.y + VIEW_H + 260 || e.bottom < c.y - 600) e.remove();
    }
    // Camera follows active players.
    const targets = this.players.filter((p) => p.followable).map((p) => ({ x: p.camX, y: p.camY }));
    c.update(dt, targets);
    this.particles.update(dt, this.terrain);
    // Cleanup.
    let anyDead = false;
    for (const e of list) if (e.dead) anyDead = true;
    if (anyDead) {
      this.entities = list.filter((e) => !e.dead);
      this.targetsDirty = true;
    }
    this.flushPending();
  }

  render(g: CanvasRenderingContext2D, shakeX = 0, shakeY = 0): void {
    const cx = Math.round(this.camera.x) - shakeX;
    const cy = Math.round(this.camera.y) - shakeY;
    // Background (screen space).
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.level?.renderBackground(g, cx, cy);
    // World space.
    g.setTransform(1, 0, 0, 1, -cx, -cy);
    this.level?.renderTerrain(g, cx, cy);
    const sorted = this.entities.slice().sort((a, b) => a.z - b.z || a.id - b.id);
    this.particles.render(g, false);
    for (const e of sorted) {
      if (e.dead) continue;
      e.render(g);
    }
    this.particles.render(g, true);
    this.level?.renderFront(g, cx, cy);
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.level?.renderOverlay(g, cx, cy);
  }
}
