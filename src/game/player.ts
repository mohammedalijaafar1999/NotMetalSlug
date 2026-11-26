// The player soldier: run, jump, crouch, 4-way aim (down only in the air), shoot,
// knife when adjacent to infantry, throw bombs, drive vehicles, die in one hit, respawn.

import { input, type ActionState } from '../engine/input';
import { sprites } from '../engine/sprites';
import { VIEW_W } from '../engine/renderer';
import { rotateTowards, rectsOverlap } from '../engine/math';
import { Actor, type Entity } from './entity';
import { Z, type Damage } from './constants';
import { getWeapon, type WeaponDef } from './weapons';
import { getCharacter, type CharacterDef } from './characters';
import { Grenade } from './projectile';
import { LEG, LEG_FRAMES, aimIndex, muzzleFromShoulder } from '../art/humanoid';
import type { PlayerProfile } from './session';
import type { Vehicle } from './vehicle';

export const RUN_SPEED = 84;
export const CROUCH_SPEED = 38;
export const JUMP_SPEED = 300;
export const RESPAWN_INVULN = 2.6;
export const MAX_GRENADES_OUT = 2;

export type PlayerState = 'play' | 'dying' | 'respawn' | 'vehicle' | 'victory' | 'out' | 'waiting';

/** Bomb types the player can throw (pickups switch type). */
export type BombKind = 'grenade' | 'firebomb';

/** Hook for alternate bomb types: registered by content (firebomb etc). */
export const bombThrowers: Record<string, (p: Player, x: number, y: number, vx: number, vy: number) => void> = {};

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
  vehicle: Vehicle | null = null;
  /** Bot/test hook: when set, overrides real input (see debug autopilot). */
  inputOverride: ActionState | null = null;
  /** Debug god mode. */
  godMode = false;
  private deathFrame = 0;
  private deathLanded = false;
  private exitCooldown = 0;

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
    if (this.weapon.id === w.id && isFinite(this.ammo)) this.ammo += ammo;
    else {
      this.weapon = w;
      this.ammo = Math.round(ammo);
    }
    if (!isFinite(w.ammo)) this.ammo = Infinity;
  }

  addBombs(n: number, kind?: BombKind): void {
    if (kind && kind !== this.bombKind) {
      this.bombKind = kind;
    }
    this.bombs = Math.min(99, this.bombs + n);
  }

  /** Place the player at the top of the screen to drop in. */
  respawn(x?: number): void {
    const cam = this.world.camera;
    const other = this.world.players.find((p) => p !== this && p.state === 'play');
    this.x = x ?? (other ? other.x : cam.x + 64);
    this.x = this.safeX(Math.max(cam.x + 24, Math.min(cam.x + VIEW_W - 24, this.x)));
    this.y = cam.y - 4;
    this.vx = 0;
    this.vy = 40;
    this.onGround = false;
    this.weapon = getWeapon('pistol');
    this.ammo = Infinity;
    this.bombKind = 'grenade';
    this.bombs = Math.max(this.bombs, this.char.bombs);
    this.invuln = RESPAWN_INVULN;
    this.hittable = true;
    this.hp = 1;
    this.aim = 0;
    this.crouching = false;
    this.setState('respawn');
    // Missions that are played inside a vehicle (e.g. the sky mission) hand out a fresh one.
    const sv = this.world.level?.def.startVehicle;
    if (sv) {
      const v = this.world.spawn(sv, this.x, cam.y + 60) as unknown as Vehicle | null;
      if (v && (v as any).isVehicle) {
        this.setState('play');
        v.enter(this);
      }
    }
  }

  /** Nearest x (within the view) that has floor under it, so respawns never drop into pits. */
  safeX(x: number): number {
    const T = this.world.terrain;
    const cam = this.world.camera;
    for (let d = 0; d <= VIEW_W; d += 8) {
      for (const s of d === 0 ? [0] : [d, -d]) {
        const tx = x + s;
        if (tx < cam.x + 16 || tx > cam.x + VIEW_W - 16) continue;
        const fy = T.floorAt(tx, cam.y - 40, cam.y + 260);
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
    this.world.sfx('player_die', this.x);
    this.world.emit({ type: 'playerDied', player: this });
    if (this.vehicle) this.exitVehicle(false);
  }

  /** Killed by script (time over, crushed...). */
  kill(): void {
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
    this.moveAndCollide(dt);
    this.clampToCamera();
    if (this.onGround) {
      this.setState('play');
      this.world.particles.dust(this.x, this.y, 5);
    }
  }

  private updateDying(dt: number): void {
    if (!this.deathLanded) {
      this.moveAndCollide(dt);
      if (this.onGround && this.stateTime > 0.15) {
        this.deathLanded = true;
        this.vx = 0;
        this.world.particles.dust(this.x, this.y, 6);
      }
    } else {
      this.vx = 0;
      this.moveAndCollide(dt);
    }
    this.deathFrame = !this.deathLanded ? (this.vy < 0 ? 1 : 2) : this.stateTime < 0.9 ? 3 : 4;
    if (this.stateTime >= 1.7) this.finishDeath();
  }

  private clampToCamera(): void {
    const cam = this.world.camera;
    const lo = cam.x + this.w / 2 + 2;
    const hi = cam.x + VIEW_W - this.w / 2 - 2;
    if (this.x < lo) {
      this.x = lo;
      if (this.vx < 0) this.vx = 0;
    }
    if (this.x > hi) {
      this.x = hi;
      if (this.vx > 0) this.vx = 0;
    }
  }

  private updatePlay(dt: number): void {
    const inp = this.inp;
    const dirX = inp.dirX;
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.throwCd > 0) this.throwCd -= dt;
    if (this.shootAnim > 0) this.shootAnim -= dt;
    if (this.throwAnim > 0) this.throwAnim -= dt;
    if (this.knifeAnim > 0) this.knifeAnim -= dt;

    // Crouch & aim.
    this.crouching = inp.held('down') && this.onGround;
    let aimTarget = 0;
    if (inp.held('up')) aimTarget = -Math.PI / 2;
    else if (inp.held('down') && !this.onGround) aimTarget = Math.PI / 2;
    this.aim = rotateTowards(this.aim, aimTarget, 15 * dt);
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
      }
    }
    // Shorter hop when jump is released early.
    if (!inp.held('jump') && this.vy < -150 && !this.onGround) this.vy += 900 * dt;

    this.moveAndCollide(dt);
    this.clampToCamera();
    if (this.landed && this.landVy > 180) {
      this.world.particles.dust(this.x, this.y, 3);
      this.world.sfx('land', this.x, { vol: 0.4 });
    }
    if (this.inWater && this.landed) this.world.particles.splash(this.x, this.inWater.y, 6);
    if (this.onGround && this.vx !== 0) this.runPhase += dt * (this.crouching ? 8 : 13);

    // Shooting.
    const fireHeld = inp.held('fire');
    if (fireHeld) this.holdTime += dt;
    else this.holdTime = 0;
    if (this.fireCd <= 0) {
      const w = this.weapon;
      const want = w.auto ? fireHeld : inp.pressed('fire') || (fireHeld && this.holdTime > 0.22);
      if (want) this.attack(inp.pressed('fire'));
    }
    // Bombs.
    if (inp.pressed('bomb') && this.bombs > 0 && this.throwCd <= 0) this.throwBomb();

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

  /** Shoulder position in world space for current pose. */
  shoulder(): { x: number; y: number } {
    const legFrame = this.legFrame();
    const L = LEG_FRAMES[legFrame];
    const lean = this.aim > 0.5 ? -0.5 : 0;
    return { x: this.x + this.facing * (L.hip[0] + lean), y: this.y + L.hip[1] - 10 };
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

  meleeTarget(): Entity | null {
    const reach = { x: this.facing > 0 ? this.x - 4 : this.x - 24, y: this.y - this.h, w: 28, h: this.h };
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

  private attack(fresh: boolean): void {
    const target = fresh || !this.weapon.auto ? this.meleeTarget() : null;
    if (target) {
      this.knifeAnim = 0.26;
      this.fireCd = 0.24;
      target.damage({ amount: 5 * this.char.meleeMul, kind: 'melee', owner: this, x: target.x, y: target.cy, dir: this.facing });
      this.world.sfx('knife', this.x);
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
      const fx = this.world.effect('muzzle_flash', m.x, m.y, { fps: 30, z: Z.PLAYER + 2 });
      fx.rot = a;
      fx.follow = this;
      fx.followDx = m.x - this.x;
      fx.followDy = m.y - this.y;
    }
    this.world.sfx(w.sfx, this.x, { vol: 0.7 });
    if (isFinite(this.ammo)) {
      this.ammo -= w.ammoPerShot ?? 1;
      if (this.ammo <= 0) {
        this.weapon = getWeapon('pistol');
        this.ammo = Infinity;
        this.world.sfx('out_of_ammo', this.x);
      }
    }
  }

  private throwBomb(): void {
    this.bombs--;
    this.throwCd = 0.35;
    this.throwAnim = 0.22;
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
    if (this.vx !== 0) return LEG.RUN + (Math.floor(this.runPhase) % LEG.RUN_N);
    return LEG.STAND;
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
      sprites.get(`${base}_body`).draw(g, this.x, this.y, 7, { flip, flash });
      return;
    }
    if (this.state === 'victory') {
      sprites.get(`${base}_body`).draw(g, this.x, this.y, Math.floor(this.stateTime * 3) % 2 === 0 ? 5 : 6, { flip });
      return;
    }
    const lf = this.legFrame();
    const L = LEG_FRAMES[lf];
    sprites.get(`${base}_legs`).draw(g, this.x, this.y, lf, { flip, flash });
    const hx = this.x + this.facing * Math.round(L.hip[0]);
    const hy = this.y + Math.round(L.hip[1]);
    if (this.knifeAnim > 0) {
      const f = Math.min(2, Math.floor((1 - this.knifeAnim / 0.26) * 3));
      sprites.get(`${base}_knife`).draw(g, hx, hy, f, { flip, flash });
    } else if (this.throwAnim > 0) {
      sprites.get(`${base}_throw`).draw(g, hx, hy, this.throwAnim > 0.12 ? 0 : 1, { flip, flash });
    } else {
      const set = `${base}_up_${this.weapon.gun}`;
      const sp = sprites.has(set) ? sprites.get(set) : sprites.get(`${base}_up_pistol`);
      sp.draw(g, hx, hy, aimIndex(this.aim) + (this.shootAnim > 0 ? 5 : 0), { flip, flash });
    }
  }
}
