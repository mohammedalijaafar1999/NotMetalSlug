// The player soldier: run, jump, crouch, 4-way aim (down only in the air), shoot,
// knife when adjacent to infantry, throw bombs, drive vehicles, die in one hit, respawn.
//
// Feel details: heavy weapons sweep through the diagonals when the aim changes while firing
// (WeaponDef.sweep), auto weapons fire a burst per tap (WeaponDef.burst), presses are buffered
// briefly, footfalls kick up dust, landings squat, the knife always wins at point blank, and
// standing still for a few seconds plays an idle fidget.

import { input, type ActionState } from '../engine/input';
import { sprites } from '../engine/sprites';
import { fxRng } from '../engine/rng';
import { VIEW_W } from '../engine/renderer';
import { rotateTowards, rectsOverlap } from '../engine/math';
import { Actor, type Entity } from './entity';
import { Z, type Damage } from './constants';
import { ejectCasing, getWeapon, wsfx, type WeaponDef } from './weapons';
import { getCharacter, type CharacterDef } from './characters';
import { Grenade } from './projectile';
import { BODY, LEG, LEG_FRAMES, THROW, aimIndex, muzzleFromShoulder, upperLean } from '../art/humanoid';
import type { PlayerProfile } from './session';
import type { Vehicle } from './vehicle';

export const RUN_SPEED = 84;
export const CROUCH_SPEED = 38;
export const JUMP_SPEED = 300;
export const RESPAWN_INVULN = 2.6;
export const MAX_GRENADES_OUT = 2;
/** Highest ledge (px) the scrolling screen edge lifts a player onto instead of burying them in it. */
export const SCREEN_PUSH_CLIMB = 48;
/** Aim rotation speed (rad/s) when not sweeping a heavy weapon. */
export const AIM_RATE = 15;
/** Knife animation length (s) and damage per slash (x CharacterDef.meleeMul). */
export const KNIFE_TIME = 0.24;
export const KNIFE_DAMAGE = 5;
/** Seconds standing still before the idle fidget plays (then every FIDGET_EVERY s). */
export const FIDGET_AFTER = 4;
export const FIDGET_EVERY = 7;
const FIDGET_LEN = 1.8;
/** A fire press is remembered this long while the weapon cools down. */
const FIRE_BUFFER = 0.12;

export type PlayerState = 'play' | 'dying' | 'respawn' | 'vehicle' | 'victory' | 'out' | 'waiting';

/** Bomb types the player can throw (pickups switch type). */
export type BombKind = 'grenade' | 'firebomb';

/** Hook for alternate bomb types: registered by content (src/content/weapons/bombs.ts). */
export const bombThrowers: Record<string, (p: Player, x: number, y: number, vx: number, vy: number) => void> = {};

/** Dust color for footfalls by terrain material. */
const DUST: Record<string, string> = {
  dirt: '#c8b48a',
  sand: '#e0c890',
  grass: '#a8b878',
  snow: '#eef2ff',
  ice: '#d8ecff',
  metal: '#a8a8b4',
  stone: '#b4aca0',
  wood: '#b89870',
};

export class Player extends Actor {
  readonly isPlayer = true;
  readonly index: 0 | 1;
  readonly profile: PlayerProfile;
  char: CharacterDef;
  spriteBase: string;
  state: PlayerState = 'respawn';
  stateTime = 0;
  weapon: WeaponDef;
  ammo = Infinity;
  bombs = 10;
  bombKind: BombKind = 'grenade';
  /** Current aim angle relative to facing (0 fwd, -PI/2 up, PI/2 down). */
  aim = 0;
  crouching = false;
  fireCd = 0;
  holdTime = 0;
  shootAnim = 0;
  throwAnim = 0;
  throwCd = 0;
  knifeAnim = 0;
  runPhase = 0;
  shotCounter = 0;
  /** Shots still owed from a tapped burst (auto weapons). */
  burstLeft = 0;
  /** Seconds the player has stood still without input (drives breathing + fidget). */
  idleTime = 0;
  vehicle: Vehicle | null = null;
  /** Bot/test hook: when set, overrides real input (see debug autopilot). */
  inputOverride: ActionState | null = null;
  /** Debug god mode. */
  godMode = false;
  private deathFrame = 0;
  private deathLanded = false;
  private exitCooldown = 0;
  private fireBuf = 0;
  private landT = 0;
  private lastRunFrame = -1;
  private lastShotSfx = -1;
  private throwKind: BombKind = 'grenade';

  constructor(profile: PlayerProfile) {
    super();
    this.profile = profile;
    this.index = profile.index;
    this.char = getCharacter(profile.character);
    this.spriteBase = `char_${this.char.id}${this.index === 1 ? '_p2' : ''}`;
    this.weapon = getWeapon('pistol');
    this.team = 'player';
    this.w = 12;
    this.h = 26;
    this.z = Z.PLAYER + this.index;
    this.persistent = true;
    this.hittable = false;
    this.bombs = this.char.bombs;
  }

  get inp(): ActionState {
    return this.inputOverride ?? input.player(this.index);
  }

  /** In play and may be targeted/hurt (or driving). */
  get isActive(): boolean {
    return this.state === 'play' || this.state === 'vehicle' || this.state === 'respawn';
  }

  get isTargetable(): boolean {
    return this.state === 'play' || this.state === 'vehicle';
  }

  /** Camera follows this player. */
  get followable(): boolean {
    return this.state !== 'out' && this.state !== 'waiting';
  }

  get camX(): number {
    return this.vehicle ? this.vehicle.x : this.x;
  }

  get camY(): number {
    return this.vehicle ? this.vehicle.y : this.y;
  }

  setState(s: PlayerState): void {
    this.state = s;
    this.stateTime = 0;
  }

  /** Give a weapon (ammo stacks if same weapon). */
  giveWeapon(id: string): void {
    const w = getWeapon(id);
    const ammo = w.ammo * (w.heavy ? this.char.heavyAmmoMul : 1);
    if (this.weapon.id === w.id && isFinite(this.ammo)) this.ammo += Math.round(ammo);
    else {
      this.weapon = w;
      this.ammo = Math.round(ammo);
    }
    if (!isFinite(w.ammo)) this.ammo = Infinity;
    this.burstLeft = 0;
  }

  addBombs(n: number, kind?: BombKind): void {
    if (kind && kind !== this.bombKind) {
      this.bombKind = kind;
    }
    this.bombs = Math.min(99, this.bombs + n);
  }

  /** Put the player above the top of the screen (over safe floor near x) in the drop-in pose. */
  private dropIn(x?: number): void {
    const cam = this.world.camera;
    const other = this.world.players.find((p) => p !== this && p.state === 'play');
    this.x = x ?? (other ? other.x : cam.x + 64);
    this.x = this.safeX(Math.max(cam.x + 24, Math.min(cam.x + VIEW_W - 24, this.x)));
    this.y = cam.y - 4;
    this.vx = 0;
    this.vy = 40;
    this.onGround = false;
    this.groundSurface = null;
    this.groundSolid = null;
    this.crouching = false;
    this.h = 26;
    this.setState('respawn');
  }

  /** Place the player at the top of the screen to drop in. */
  respawn(x?: number): void {
    const cam = this.world.camera;
    this.dropIn(x);
    this.weapon = getWeapon('pistol');
    this.ammo = Infinity;
    this.bombKind = 'grenade';
    this.bombs = Math.max(this.bombs, this.char.bombs);
    this.invuln = RESPAWN_INVULN;
    this.hittable = true;
    this.hp = 1;
    this.aim = 0;
    this.crouching = false;
    this.burstLeft = 0;
    this.knifeAnim = 0;
    this.throwAnim = 0;
    this.idleTime = 0;
    this.setState('respawn');
    // Missions that are played inside a vehicle (e.g. the sky mission) hand out a fresh one.
    const sv = this.world.level?.def.startVehicle;
    if (sv) {
      const v = this.world.spawn(sv, this.x, cam.y + 60) as unknown as Vehicle | null;
      if (v && (v as any).isVehicle) {
        // Never hand it out inside a hull or a cliff.
        if (v.flying) v.slideClear(140);
        this.setState('play');
        v.enter(this);
      }
    }
  }

  /**
   * Nearest x (within the view) where a drop from the top of the screen lands on safe floor, so
   * respawns never drop into pits or deep water, nor start inside a cliff or a wall that rises
   * above the top of the screen (they would fall through it).
   */
  safeX(x: number): number {
    const T = this.world.terrain;
    const cam = this.world.camera;
    const dropY = cam.y - 4;
    for (let d = 0; d <= VIEW_W; d += 8) {
      for (const s of d === 0 ? [0] : [d, -d]) {
        const tx = x + s;
        if (tx < cam.x + 16 || tx > cam.x + VIEW_W - 16) continue;
        if (T.groundTopAt(tx) < dropY || T.solidOverlap({ x: tx - 6, y: dropY - 26, w: 12, h: 26 })) continue;
        const fy = T.floorAt(tx, dropY, cam.y + 260);
        if (fy && !T.waterAt(tx, fy.y - 2)?.deadly) return tx;
      }
    }
    return x;
  }

  override spawned(): void {
    if (this.state === 'respawn') this.respawn(this.x || undefined);
  }

  // ------------------------------------------------------------------ damage

  override damage(d: Damage): boolean {
    if (this.state !== 'play' && this.state !== 'respawn') return false;
    if (this.godMode) return true;
    return super.damage(d);
  }

  override die(d?: Damage): void {
    if (this.state === 'dying') return;
    this.hittable = false;
    this.setState('dying');
    this.deathLanded = false;
    const dir = d?.dir ?? -this.facing;
    this.facing = (dir > 0 ? -1 : 1) as 1 | -1;
    this.vx = dir * 70;
    this.jump(d?.kind === 'explosion' ? 230 : 150);
    this.knifeAnim = 0;
    this.throwAnim = 0;
    this.world.sfx('player_die', this.x);
    this.world.emit({ type: 'playerDied', player: this });
    if (this.vehicle) this.exitVehicle(false);
  }

  /** Killed by script (time over, crushed...). A vehicle is wrecked first, its pilot thrown out. */
  kill(): void {
    if (this.state === 'vehicle') {
      const v = this.vehicle;
      if (v && !v.destroyed) v.startDestruction();
      else this.exitVehicle(false);
    }
    if (this.state === 'play' || this.state === 'respawn') {
      this.hp = 0;
      this.die({ amount: 99, kind: 'crush', dir: -this.facing });
    }
  }

  override onFallOut(): void {
    if (this.state === 'dying') {
      this.finishDeath();
      return;
    }
    if (this.state === 'vehicle') return;
    if (this.godMode) {
      this.respawn();
      return;
    }
    // Fell into a pit: lose a life and come back on solid ground.
    this.world.emit({ type: 'playerDied', player: this });
    this.world.sfx('player_die', this.x);
    this.loseLife();
  }

  private finishDeath(): void {
    this.loseLife();
  }

  private loseLife(): void {
    this.profile.lives--;
    if (this.profile.lives > 0) {
      this.respawn();
      wsfx(this.world, 'respawn', this.x, { vol: 0.8 });
    } else {
      this.profile.lives = 0;
      this.profile.out = true;
      this.hittable = false;
      this.setState('out');
      this.world.emit({ type: 'playerOut', player: this });
    }
  }

  // ------------------------------------------------------------------ vehicles

  enterVehicle(v: Vehicle): void {
    this.vehicle = v;
    this.hittable = false;
    this.setState('vehicle');
    this.vx = 0;
    this.vy = 0;
    this.knifeAnim = 0;
    this.throwAnim = 0;
    this.burstLeft = 0;
    this.world.invalidateTargets();
  }

  /** Leave the vehicle (jump out). */
  exitVehicle(jump = true): void {
    const v = this.vehicle;
    if (!v) return;
    this.vehicle = null;
    v.driver = null;
    v.onDriverExit?.(this);
    this.x = v.x;
    this.y = v.top + 2;
    this.exitCooldown = 0.8;
    if (this.state === 'vehicle') {
      this.setState('play');
      this.hittable = true;
      this.invuln = Math.max(this.invuln, 1.0);
      if (jump) this.jump(260);
    }
    this.world.invalidateTargets();
  }

  get canEnterVehicle(): boolean {
    return this.state === 'play' && this.exitCooldown <= 0;
  }

  // ------------------------------------------------------------------ update

  override update(dt: number): void {
    this.stateTime += dt;
    if (this.exitCooldown > 0) this.exitCooldown -= dt;
    switch (this.state) {
      case 'play':
        this.updatePlay(dt);
        break;
      case 'respawn':
        this.updateRespawn(dt);
        break;
      case 'dying':
        this.updateDying(dt);
        break;
      case 'vehicle':
        if (this.vehicle) {
          this.x = this.vehicle.x;
          this.y = this.vehicle.y;
          if (this.vehicle.dead) this.exitVehicle(true);
        } else this.setState('play');
        break;
      case 'victory':
        this.vx = 0;
        this.moveAndCollide(dt);
        break;
      default:
        break;
    }
  }

  private updateRespawn(dt: number): void {
    this.vx = this.inp.dirX * RUN_SPEED * 0.5;
    if (this.inp.dirX !== 0) this.facing = this.inp.dirX;
    this.moveAndCollide(dt);
    this.clampToCamera();
    if (this.onGround) {
      this.setState('play');
      this.landT = 0.12;
      this.world.particles.dust(this.x, this.y, 6, this.dustColor());
      wsfx(this.world, 'land', this.x, { vol: 0.5 });
    }
  }

  private updateDying(dt: number): void {
    if (!this.deathLanded) {
      this.moveAndCollide(dt);
      if (this.onGround && this.stateTime > 0.15) {
        this.deathLanded = true;
        this.vx = 0;
        this.world.particles.dust(this.x, this.y, 6, this.dustColor());
      }
    } else {
      this.vx = 0;
      this.moveAndCollide(dt);
    }
    this.deathFrame = !this.deathLanded ? (this.stateTime < 0.08 ? BODY.HIT : this.vy < 0 ? BODY.FLUNG : BODY.FALLING) : this.stateTime < 0.9 ? BODY.LANDED : BODY.FLAT;
    if (this.stateTime >= 1.7) this.finishDeath();
  }

  private clampToCamera(): void {
    const cam = this.world.camera;
    const lo = cam.x + this.w / 2 + 2;
    const hi = cam.x + VIEW_W - this.w / 2 - 2;
    if (this.x < lo) {
      this.x = lo;
      if (this.vx < 0) this.vx = 0;
      this.shovedByScreen(1);
    }
    if (this.x > hi) {
      this.x = hi;
      if (this.vx > 0) this.vx = 0;
      this.shovedByScreen(-1);
    }
  }

  /**
   * The screen edge pushed us into a wall or a cliff (co-op partner scrolling on, arena camera):
   * hop onto it when it is low, otherwise drop back in from the top of the screen next to the
   * partner instead of being buried in the terrain (and falling through it to our death).
   */
  private shovedByScreen(dir: 1 | -1): void {
    if (!this.bodyBlocked()) return;
    if (this.climbOnto(dir, SCREEN_PUSH_CLIMB)) return;
    const mate = this.world.players.find((p) => p !== this && (p.state === 'play' || p.state === 'vehicle'));
    this.dropIn(mate ? mate.camX : undefined);
    this.invuln = Math.max(this.invuln, 1.2);
  }

  private dustColor(): string {
    const m = this.groundSurface?.material ?? this.groundSolid?.material ?? 'dirt';
    return DUST[m] ?? DUST.dirt;
  }

  private updatePlay(dt: number): void {
    const inp = this.inp;
    const dirX = inp.dirX;
    const w = this.weapon;
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.throwCd > 0) this.throwCd -= dt;
    if (this.shootAnim > 0) this.shootAnim -= dt;
    if (this.throwAnim > 0) this.throwAnim -= dt;
    if (this.knifeAnim > 0) this.knifeAnim -= dt;
    if (this.landT > 0) this.landT -= dt;
    if (this.fireBuf > 0) this.fireBuf -= dt;

    const fireHeld = inp.held('fire');
    const firePressed = inp.pressed('fire');
    if (firePressed) {
      this.fireBuf = FIRE_BUFFER;
      if (w.auto && w.burst) this.burstLeft = Math.max(this.burstLeft, w.burst);
    }

    // Crouch & aim. Heavy weapons rotate slowly while firing so the bullets fan out.
    this.crouching = inp.held('down') && this.onGround;
    let aimTarget = 0;
    if (inp.held('up')) aimTarget = -Math.PI / 2;
    else if (inp.held('down') && !this.onGround) aimTarget = Math.PI / 2;
    const sweeping = w.sweep !== undefined && (fireHeld || this.burstLeft > 0);
    this.aim = rotateTowards(this.aim, aimTarget, (sweeping ? w.sweep! : AIM_RATE) * dt);
    if (dirX !== 0) this.facing = dirX;
    this.h = this.crouching ? 17 : 26;

    // Horizontal movement.
    let speed = (this.crouching ? CROUCH_SPEED : RUN_SPEED * this.char.runMul) * (this.inWater ? 0.65 : 1);
    if (this.knifeAnim > 0 && this.onGround) speed *= 0.4;
    this.vx = dirX * speed;

    // Jump / drop-through.
    if (inp.pressed('jump') && this.onGround) {
      if (inp.held('down') && this.onPlatform) {
        this.dropThrough();
      } else {
        this.jump(JUMP_SPEED * this.char.jumpMul * (this.inWater ? 0.85 : 1));
        this.world.sfx('jump', this.x, { vol: 0.6 });
        if (!this.inWater) this.world.particles.dust(this.x, this.y, 2, this.dustColor());
      }
    }
    // Shorter hop when jump is released early.
    if (!inp.held('jump') && this.vy < -150 && !this.onGround) this.vy += 900 * dt;

    this.moveAndCollide(dt);
    this.clampToCamera();
    if (this.landed) {
      if (this.landVy > 120) this.landT = this.landVy > 300 ? 0.13 : 0.08;
      if (this.landVy > 180) {
        this.world.particles.dust(this.x, this.y, 3, this.dustColor());
        this.world.sfx('land', this.x, { vol: 0.4 });
      }
    }
    if (this.inWater && this.landed) this.world.particles.splash(this.x, this.inWater.y, 6);
    if (this.onGround && this.vx !== 0) {
      this.runPhase += dt * (this.crouching ? 8 : 13);
      this.footfalls();
    } else this.lastRunFrame = -1;

    // Shooting (knife at point blank).
    if (fireHeld) this.holdTime += dt;
    else this.holdTime = 0;
    if (this.fireCd <= 0) {
      const fresh = this.fireBuf > 0;
      const want = w.auto ? fireHeld || fresh || this.burstLeft > 0 : fresh || (fireHeld && this.holdTime > 0.22);
      if (want) {
        this.fireBuf = 0;
        this.attack();
        if (this.burstLeft > 0) this.burstLeft--;
      }
    }
    // Bombs.
    if (inp.pressed('bomb') && this.bombs > 0 && this.throwCd <= 0) this.throwBomb();

    // Idle tracking (breathing + fidget).
    const still = this.onGround && dirX === 0 && !fireHeld && !inp.held('up') && !inp.held('down') && this.knifeAnim <= 0 && this.throwAnim <= 0 && this.shootAnim <= 0 && this.burstLeft <= 0;
    this.idleTime = still ? this.idleTime + dt : 0;

    // Enter vehicles by pressing down over them or landing on their hatch.
    if (this.canEnterVehicle) {
      for (const e of this.world.query((x) => (x as any).isVehicle === true)) {
        const v = e as unknown as Vehicle;
        if (v.driver || !v.canBeEntered) continue;
        if (!rectsOverlap(this.box, v.entryBox())) continue;
        if (inp.held('down') || (!this.onGround && this.vy > 0)) {
          v.enter(this);
          break;
        }
      }
    }
  }

  /** Dust puffs (or splashes) when a foot hits the ground during the run cycle. */
  private footfalls(): void {
    if (this.crouching) return;
    const rf = Math.floor(this.runPhase) % LEG.RUN_N;
    if (rf === this.lastRunFrame) return;
    this.lastRunFrame = rf;
    if (rf !== 2 && rf !== 6) return;
    const fx = this.x + this.facing * 4;
    if (this.inWater) {
      this.world.particles.splash(fx, this.inWater.y, 2);
      return;
    }
    const col = this.dustColor();
    for (let i = 0; i < 3; i++) {
      this.world.particles.add({
        kind: 'smoke',
        x: fx + fxRng.range(-3, 2),
        y: this.y - 1.5,
        vx: -this.facing * fxRng.range(18, 42),
        vy: fxRng.range(-20, -6),
        life: fxRng.range(0.28, 0.42),
        color: col,
        size: 1.5,
        size2: 3.5,
        drag: 3,
      });
    }
  }

  /** Shoulder position in world space for current pose. */
  shoulder(): { x: number; y: number } {
    const L = LEG_FRAMES[this.legFrame()];
    const lean = upperLean(this.aim);
    return { x: this.x + this.facing * (Math.round(L.hip[0]) + lean), y: this.y + Math.round(L.hip[1]) - 10 };
  }

  /** World-space aim angle. */
  worldAim(): number {
    return this.facing > 0 ? this.aim : Math.PI - this.aim;
  }

  muzzle(): { x: number; y: number } {
    const s = this.shoulder();
    const [mx, my] = muzzleFromShoulder(this.weapon.gun, this.aim);
    return { x: s.x + mx * this.facing, y: s.y + my };
  }

  /** Meleeable enemy within knife reach (in front, overlapping the body height). */
  meleeTarget(): Entity | null {
    const reach = { x: this.facing > 0 ? this.x - 5 : this.x - 25, y: this.y - this.h, w: 30, h: this.h };
    let best: Entity | null = null;
    let bd = Infinity;
    for (const t of this.world.targets('player')) {
      if (!t.meleeable || t.dead || !t.hittable) continue;
      if (!rectsOverlap(reach, t.box)) continue;
      const d = Math.abs(t.x - this.x);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  /** Slash a melee target (quick, crunchy: tiny hitstop + slash spark). */
  private knife(target: Entity): void {
    this.knifeAnim = KNIFE_TIME;
    this.fireCd = 0.22;
    this.burstLeft = 0;
    target.damage({ amount: KNIFE_DAMAGE * this.char.meleeMul, kind: 'melee', owner: this, x: target.x, y: target.cy, dir: this.facing });
    wsfx(this.world, 'knife', this.x);
    this.world.effect('knife_slash', target.x - this.facing * 2, target.cy - 3, { fps: 26, flip: this.facing < 0, z: Z.FX });
    this.world.particles.blood(target.x, target.cy - 2, 4);
    this.world.hitstop(0.035);
  }

  private attack(): void {
    const target = this.meleeTarget();
    if (target) {
      this.knife(target);
      return;
    }
    const w = this.weapon;
    const m = this.muzzle();
    const a = this.worldAim();
    w.fire(this, m.x, m.y, a);
    this.shotCounter++;
    this.world.stats.shotsFired++;
    this.fireCd = w.cooldown * (w.id === 'pistol' ? this.char.pistolCooldownMul : 1);
    if (!w.auto && this.holdTime > 0.22) this.fireCd = Math.max(this.fireCd, 0.17);
    this.shootAnim = 0.09;
    if (w.flash !== false) {
      const fx = this.world.effect(w.muzzle ?? 'muzzle_flash', m.x, m.y, { fps: 30, z: Z.PLAYER + 2 });
      fx.rot = a;
      fx.follow = this;
      fx.followDx = m.x - this.x;
      fx.followDy = m.y - this.y;
    }
    if (w.casing) {
      const s = this.shoulder();
      ejectCasing(this.world, s.x + this.facing * 3, s.y - 1, this.facing, w.casing);
      if (w.casing === 'brass' && this.shotCounter % 4 === 0) wsfx(this.world, 'shell_casing', this.x, { vol: 0.25 });
    }
    if (w.recoil) this.world.shake(w.recoil, 0.12);
    if (!w.sfxInterval || this.world.time - this.lastShotSfx >= w.sfxInterval || this.lastShotSfx < 0) {
      this.lastShotSfx = this.world.time;
      this.world.sfx(w.sfx, this.x, { vol: 0.7 });
    }
    if (isFinite(this.ammo)) {
      this.ammo -= w.ammoPerShot ?? 1;
      if (this.ammo <= 0) this.outOfAmmo();
    }
  }

  /** Weapon ran dry: back to the pistol, toss the empty gun, click + "EMPTY" cue. */
  private outOfAmmo(): void {
    const old = this.weapon;
    this.weapon = getWeapon('pistol');
    this.ammo = Infinity;
    this.burstLeft = 0;
    wsfx(this.world, 'out_of_ammo', this.x);
    const icon = sprites.tryGet(`gun_${old.gun}`);
    if (icon) {
      const s = this.shoulder();
      this.world.particles.add({ kind: 'sprite', sprite: icon, x: s.x, y: s.y + 2, vx: -this.facing * 45, vy: -130, gravity: 600, bounce: 0.3, life: 1.1, flip: this.facing < 0, fps: 1 });
    }
    this.world.floatText('EMPTY', this.x, this.top - 4, '#d0d0d8', 0.8);
  }

  private throwBomb(): void {
    this.bombs--;
    this.throwCd = 0.35;
    this.throwAnim = 0.22;
    this.throwKind = this.bombKind;
    this.idleTime = 0;
    const s = this.shoulder();
    const up = this.inp.held('up');
    const vx = this.facing * (up ? 70 : 150) + this.vx * 0.35;
    const vy = up ? -300 : -190;
    const thrower = bombThrowers[this.bombKind];
    if (thrower) thrower(this, s.x, s.y - 2, vx, vy);
    else {
      this.world.add(
        new Grenade({ team: 'player', owner: this, x: s.x, y: s.y - 2, vx, vy, radius: 26 * this.char.grenadeRadiusMul, damage: 9 }),
      );
    }
    this.world.sfx('throw', this.x, { vol: 0.6 });
  }

  /** Mission complete pose. */
  celebrate(): void {
    // Stay aboard a vehicle that may not be left here (a gyro over a bottomless sky).
    if (this.state === 'vehicle' && this.vehicle && !this.vehicle.canEject()) return;
    if (this.state === 'vehicle') this.exitVehicle(false);
    if (this.state === 'play' || this.state === 'respawn') {
      this.setState('victory');
      this.hittable = false;
    }
  }

  // ------------------------------------------------------------------ render

  legFrame(): number {
    if (!this.onGround) return this.vy < 0 ? LEG.JUMP : LEG.FALL;
    if (this.crouching) return this.vx !== 0 ? LEG.CWALK + (Math.floor(this.runPhase) % LEG.CWALK_N) : LEG.CROUCH;
    if (this.landT > 0) return LEG.LAND;
    if (this.vx !== 0) return LEG.RUN + (Math.floor(this.runPhase) % LEG.RUN_N);
    return LEG.STAND;
  }

  /** Idle fidget frame of the `_rest_<gun>` set (or -1 when not fidgeting). */
  fidgetFrame(): number {
    if (this.idleTime < FIDGET_AFTER) return -1;
    const t = (this.idleTime - FIDGET_AFTER) % FIDGET_EVERY;
    if (t >= FIDGET_LEN) return -1;
    return t < 0.5 ? 0 : t < 0.8 ? 1 : t < 1.1 ? 0 : t < 1.4 ? 1 : 0;
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.state === 'vehicle' || this.state === 'out' || this.state === 'waiting') return;
    if (this.invuln > 0 && this.state !== 'dying' && Math.floor(this.invuln * 16) % 2 === 0) return;
    const flip = this.facing < 0;
    const flash = this.flash > 0;
    const base = this.spriteBase;
    if (this.state === 'dying') {
      sprites.get(`${base}_body`).draw(g, this.x, this.y, this.deathFrame, { flip });
      return;
    }
    if (this.state === 'respawn') {
      sprites.get(`${base}_body`).draw(g, this.x, this.y, BODY.DROP, { flip, flash });
      return;
    }
    if (this.state === 'victory') {
      sprites.get(`${base}_body`).draw(g, this.x, this.y, Math.floor(this.stateTime * 3) % 2 === 0 ? BODY.VICTORY : BODY.VICTORY2, { flip });
      return;
    }
    const lf = this.legFrame();
    const L = LEG_FRAMES[lf];
    sprites.get(`${base}_legs`).draw(g, this.x, this.y, lf, { flip, flash });
    const hx = this.x + this.facing * Math.round(L.hip[0]);
    const hy = this.y + Math.round(L.hip[1]);
    if (this.knifeAnim > 0) {
      // The hit lands on the press (with a tiny hitstop), so open on the slash frame (full
      // swoosh) and settle into the follow-through. Frame 0 (wind-up) stays in the set for others.
      const t = KNIFE_TIME - this.knifeAnim;
      const f = t < 0.11 ? 1 : 2;
      sprites.get(`${base}_knife`).draw(g, hx, hy, f, { flip, flash });
    } else if (this.throwAnim > 0) {
      const f = (this.throwKind === 'firebomb' ? THROW.FB_WIND : THROW.WIND) + (this.throwAnim > 0.12 ? 0 : 1);
      const withGun = `${base}_throw_${this.weapon.gun}`;
      sprites.get(sprites.has(withGun) ? withGun : `${base}_throw`).draw(g, hx, hy, f, { flip, flash });
    } else {
      const ff = lf === LEG.STAND ? this.fidgetFrame() : -1;
      const rest = `${base}_rest_${this.weapon.gun}`;
      if (ff >= 0 && sprites.has(rest)) {
        sprites.get(rest).draw(g, hx, hy, ff, { flip, flash });
        return;
      }
      // Breathing: the upper body bobs 1px while standing idle.
      const breathe = lf === LEG.STAND && this.idleTime > 0.4 && Math.floor(this.idleTime * 1.5) % 2 === 1 ? 1 : 0;
      const set = `${base}_up_${this.weapon.gun}`;
      const sp = sprites.has(set) ? sprites.get(set) : sprites.get(`${base}_up_pistol`);
      sp.draw(g, hx, hy + breathe, aimIndex(this.aim) + (this.shootAnim > 0 ? 5 : 0), { flip, flash });
    }
  }
}
