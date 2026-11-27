// Jetpack trooper: takes off (or flies in), hovers ~65 px above the ground and strafes around above
// the players, staying inside the view. Attacks alternate between a telegraphed 3-round burst
// aimed downward (gun blinks first) and dropping a grenade when he is right above you (grenade
// blinks in his hand first). 2 HP. Shot down, he spins out trailing smoke and crashes.
// Spawned without y he stands on the ground and takes off when he notices you.
// props: facing, drop, height: hover height above ground px (default 66)

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { VIEW_H, VIEW_W } from '../../engine/renderer';
import { drawHuman, type HumanPose } from '../../art/humanoid';
import { defineSoldier, RUSTCOAT, SF, SOLDIER_H, SOLDIER_OX, SOLDIER_OY, SOLDIER_W, styleVariant, poseShoulder } from '../../art/soldier';
import type { PixelArt } from '../../engine/pixelart';
import { Grenade } from '../../game/projectile';
import type { Damage } from '../../game/constants';
import { registerEntity } from '../../game/registry';
import { Infantry } from './infantry';
import { drawGrenade, uprightFrame } from './gear';

export const JET_STYLE = styleVariant(RUSTCOAT, {
  shirt: '#7a5232',
  pants: '#5a4a34',
  boots: '#2a1e14',
  belt: '#2a1e14',
  vest: undefined,
  gloves: '#3a2a1a',
  headgear: 'goggles',
  headgearColor: '#6e4a2a',
  scarf: '#c8302a',
  strap: '#3a2a1a',
  gunColor: '#33302c',
});

function drawPack(p: PixelArt, pose: HumanPose): void {
  const [sx, sy] = poseShoulder(pose);
  // Brass tank pack with twin thrusters.
  p.capsule(sx - 7, sy + 0.5, sx - 7, sy + 9, 3, '#b8862e');
  p.rect(sx - 9.5, sy + 1, 1, 7, '#e8c060');
  p.rect(sx - 10, sy + 4, 6, 1, '#7a5418');
  p.px(sx - 8, sy + 2, '#fff0b0');
  for (const dx of [-9, -5.5]) {
    p.rect(sx + dx - 1, sy + 10, 2.5, 2.5, '#4a4a52');
    p.rect(sx + dx - 1, sy + 10, 2.5, 1, '#7a7a86');
  }
}

function drawScarfTail(p: PixelArt, pose: HumanPose, k: number): void {
  const [sx, sy] = poseShoulder(pose);
  let x = sx - 2;
  let y = sy - 0.5;
  for (let i = 0; i < 7; i++) {
    const nx = x - 1.3;
    const ny = y + 0.4 + Math.sin(i * 1.2 + k * 2.1) * 0.9;
    p.capsule(x, y, nx, ny, i < 5 ? 0.9 : 0.6, i % 3 === 2 ? '#e8504a' : '#c8302a');
    x = nx;
    y = ny;
  }
}

defineSoldier('jetpack', JET_STYLE, 'smg', {
  underlay: (p, f, pose) => {
    if (uprightFrame(f)) drawPack(p, pose);
  },
  decorate: (p, f, pose) => {
    if (uprightFrame(f) && f < SF.SLEEP) drawScarfTail(p, pose, f);
  },
});

/** Flying poses: 0-1 hover, 2 aim down, 3 fire down, 4 grenade drop, 5 hit/spinning out. */
const FLY: HumanPose[] = [
  { hip: [0, -13], footB: [-2, -1], footF: [2.5, -0.5], gun: 'smg', aim: 0.55, lean: 0.5 },
  { hip: [0, -13.5], footB: [-2.5, -0.5], footF: [2, -1], gun: 'smg', aim: 0.6, lean: 0.5 },
  { hip: [0, -13], footB: [-2.5, -1], footF: [3, -2], gun: 'smg', aim: 0.95, lean: 0 },
  { hip: [0, -13], footB: [-2.5, -1], footF: [3, -2], gun: 'smg', aim: 0.95, lean: 0, recoil: 1.5, expr: 'shout' },
  { hip: [0, -13], footB: [-2, -1], footF: [2.5, -1], gun: 'none', handF: [3, 10], handB: [-3, 6], lean: 0.5, expr: 'happy' },
  { hip: [0, -13], footB: [-4, -4], footF: [4, -2], gun: 'none', handF: [6, -7], handB: [-6, -5], expr: 'hurt' },
];

sprites.define({
  name: 'jetpack_fly',
  w: SOLDIER_W,
  h: SOLDIER_H,
  ox: SOLDIER_OX,
  oy: SOLDIER_OY,
  frames: FLY.length,
  draw: (p, f) => {
    const pose = FLY[f];
    drawPack(p, pose);
    drawHuman(p, SOLDIER_OX, SOLDIER_OY, pose, JET_STYLE);
    drawScarfTail(p, pose, f);
    if (f === 4) drawGrenade(p, SOLDIER_OX + 3 + 0.5, SOLDIER_OY - 23 + 10 + 1.5, 2);
  },
});

/** Thruster exhaust (origin: nozzle, pointing down). */
sprites.define({
  name: 'jet_flame',
  w: 5,
  h: 11,
  ox: 2,
  oy: 0,
  frames: 3,
  outline: null,
  draw: (p, f) => {
    const L = [8, 10, 6][f];
    p.poly([0, 0, 5, 0, 2.5, L], '#ff7a20');
    p.poly([1, 0, 4, 0, 2.5, L * 0.65], '#ffd040');
    p.rect(1.5, 0, 2, 2, '#fff6c0');
  },
});

export class JetpackTrooper extends Infantry {
  hoverH: number;
  flying = false;
  private side: 1 | -1 = 1;
  private sideTimer = 0;
  private nextAttack: 'burst' | 'drop' = 'burst';
  private shots = 0;
  private roarCd = 0;
  private crashed = false;

  constructor(props: Record<string, any> = {}, yGiven = false) {
    super('jetpack', { behavior: 'guard', ...props });
    this.hp = this.maxHp = 2;
    this.scoreValue = 200;
    this.firstAttack = 1.0;
    this.panicProne = 0;
    this.hoverH = props.height ?? 66;
    this.flying = yGiven;
  }

  override spawned(): void {
    super.spawned();
    this.side = this.world.rng.sign();
    if (this.flying) {
      this.gravityScale = 0;
      this.setState('hover');
    }
  }

  /** Desired hover y (feet): hoverH above the target, but never scraping the floor below. */
  private hoverY(): number {
    const T = this.world.terrain;
    const cam = this.world.camera;
    const fl = T.floorAt(this.x, this.y - 4, this.y + 260);
    const ground = fl ? fl.y : Math.min(T.groundTopAt(this.x), cam.y + VIEW_H);
    const t = this.target();
    let y = (t ? Math.min(t.y, ground + 40) : ground) - this.hoverH;
    y = Math.min(y, ground - 34);
    y = Math.max(cam.y + 42, Math.min(cam.y + VIEW_H - 64, y));
    return y;
  }

  private takeOff(): void {
    this.flying = true;
    this.gravityScale = 0;
    this.jump(80);
    this.world.particles.dust(this.x, this.y, 6);
    this.sfx('jetpack', { vol: 0.6 });
    this.setState('hover');
  }

  override think(dt: number): void {
    if (!this.flying) {
      // Grounded: standard awareness, take off once engaged.
      if (this.calmThink(dt)) {
        this.moveAndCollide(dt);
        return;
      }
      this.takeOff();
    }
    this.fly(dt);
  }

  combat(_dt: number): void {}

  private fly(dt: number): void {
    const t = this.target();
    const cam = this.world.camera;
    if (this.roarCd > 0) this.roarCd -= dt;
    // Horizontal: hold a spot beside/above the target, swapping sides now and then.
    this.sideTimer -= dt;
    if (this.sideTimer <= 0) {
      this.sideTimer = this.world.rng.range(2.2, 3.6);
      this.side = (-this.side) as 1 | -1;
    }
    let wantX = t ? t.x + this.side * 46 : this.x;
    if (this.state === 'drop' || this.nextAttack === 'drop') wantX = t ? t.x : this.x;
    wantX = Math.max(cam.x + 22, Math.min(cam.x + VIEW_W - 22, wantX));
    const busy = this.state === 'aim' || this.state === 'burst';
    const ax = busy ? 0 : Math.max(-58, Math.min(58, (wantX - this.x) * 1.6));
    this.vx += (ax - this.vx) * Math.min(1, dt * 3);
    // Vertical: ease to hover height with a bob.
    const wantY = this.hoverY() + Math.sin(this.age * 2.6 + this.id) * 3;
    this.vy = Math.max(-70, Math.min(70, (wantY - this.y) * 2.5));
    if (t && !busy) this.faceTarget(t);
    if (this.roarCd <= 0 && Math.abs(this.vx) > 40 && this.onScreen(0)) {
      this.roarCd = 1.6;
      this.sfx('jetpack', { vol: 0.35, gap: 0.8 });
    }
    switch (this.state) {
      case 'hover':
        this.attackTimer -= dt;
        if (t && this.attackTimer <= 0 && this.canAttack()) {
          const dx = Math.abs(t.x - this.x);
          if (this.nextAttack === 'drop' && dx < 24 && t.y > this.y + 20) this.setState('drop');
          else if (this.nextAttack === 'burst' && dx > 18 && t.y > this.y + 8) this.setState('aim');
          else if (this.attackTimer < -2.5) this.nextAttack = this.nextAttack === 'drop' ? 'burst' : 'drop';
        }
        break;
      case 'aim':
        if (this.stateTime > 0.45) {
          // Drifted out of view during the wind-up (camera moved on): no shot from off-screen.
          if (!this.canAttack()) {
            this.attackTimer = 0.4;
            this.setState('hover');
            break;
          }
          this.shots = 3;
          this.setState('burst');
          this.fireShot();
        }
        break;
      case 'burst':
        if (this.stateTime > 0.15) {
          if (--this.shots > 0 && this.canAttack()) {
            this.fireShot();
            this.stateTime = 0;
          } else {
            this.attackTimer = this.fireDelay(1.6);
            this.nextAttack = 'drop';
            this.setState('hover');
          }
        }
        break;
      case 'drop':
        if (this.stateTime > 0.4 && !this.canAttack()) {
          this.attackTimer = 0.4;
          this.setState('hover');
        } else if (this.stateTime > 0.4) {
          this.world.add(new Grenade({ team: 'enemy', owner: this, x: this.x + this.facing * 3, y: this.y - 8, vx: this.vx * 0.4, vy: 30, radius: 20, damage: 1, maxBounces: 0 }));
          this.sfx('enemy_throw', { vol: 0.5 });
          this.attackTimer = this.fireDelay(1.6);
          this.nextAttack = 'burst';
          this.setState('hover');
        }
        break;
      default:
        this.setState('hover');
    }
    this.moveAndCollide(dt);
  }

  private fireShot(): void {
    const t = this.target();
    const mx = this.x + this.facing * 10;
    const my = this.y - 12;
    let rel = 0.9;
    if (t) rel = Math.max(0.35, Math.min(1.35, Math.atan2(t.cy - my, Math.abs(t.cx - mx))));
    const angle = this.facing > 0 ? rel : Math.PI - rel;
    this.shoot(mx, my, { angle, speed: 140, spread: 0.06 });
    this.world.effect('muzzle_flash', mx, my, { fps: 30 }).rot = angle;
    this.world.sfx('enemy_rifle', this.x, { vol: 0.45, pitch: 1.2 });
  }

  // ---------------------------------------------------------------- death

  override onDeath(d?: Damage): void {
    super.onDeath(d);
    this.gravityScale = 1;
    if (this.flying && this.deathKind !== 'explosion') {
      // Spin out.
      this.vy = -90;
      this.vx = this.facing * 50;
    }
    if (this.flying && this.deathKind === 'explosion') this.crash(d?.owner ?? null);
    this.deathDuration = 2.2;
  }

  private crash(by: Damage['owner']): void {
    if (this.crashed) return;
    this.crashed = true;
    this.world.explode(this.x - this.facing * 6, this.y - 12, { radius: 18, damage: 3, team: 'player', owner: by, size: 'medium', shake: 2 });
  }

  override updateDeath(dt: number): void {
    const air = !this.onGround;
    super.updateDeath(dt);
    if (air && !this.crashed && fxRng.chance(dt * 40)) {
      this.world.particles.add({ kind: 'smoke', x: this.x - this.facing * 6, y: this.y - 12, vx: fxRng.range(-8, 8), vy: -10, life: 0.7, color: '#4a4a52', color2: '#2a2a30', size: 1.5, size2: 4 });
    }
    if (this.onGround && !this.crashed && this.flying) this.crash(null);
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.deathBlinkHidden || this.gone) return;
    const flip = this.facing < 0;
    if (this.dying) {
      if (!this.onGround && this.flying && this.deathKind !== 'explosion') {
        const a = Math.round((this.deathTime * 12) / (Math.PI / 4)) * (Math.PI / 4) * this.facing;
        sprites.get('jetpack_fly').draw(g, this.x - 12 * Math.sin(a), this.y - 12 + 12 * Math.cos(a), 5, { flip, rot: a });
        return;
      }
      super.render(g);
      return;
    }
    if (!this.flying) {
      super.render(g);
      return;
    }
    // Exhaust under the thrusters.
    const ff = Math.floor(this.age * 20) % 3;
    for (const dx of [-8, -4.5]) sprites.get('jet_flame').draw(g, this.x + this.facing * dx, this.y - 10, (ff + (dx < -6 ? 1 : 0)) % 3, { flip });
    let f = Math.floor(this.age * 3) % 2;
    if (this.state === 'aim') f = 2;
    else if (this.state === 'burst') f = this.stateTime < 0.06 ? 3 : 2;
    else if (this.state === 'drop') f = 4;
    sprites.get('jetpack_fly').draw(g, this.x, this.y, f, { flip, flash: this.flash > 0 });
    if ((this.state === 'aim' || this.state === 'drop') && Math.floor(this.stateTime * 14) % 2 === 0) {
      // Telegraph blink: gun muzzle or the grenade.
      const bx = this.state === 'aim' ? this.x + this.facing * 11 : this.x + this.facing * 4;
      const by = this.state === 'aim' ? this.y - 13 : this.y - 9;
      g.fillStyle = '#fff6a0';
      g.fillRect(Math.round(bx) - 1, Math.round(by), 3, 1);
      g.fillRect(Math.round(bx), Math.round(by) - 1, 1, 3);
    }
  }
}

registerEntity(
  'jetpack',
  'enemy',
  (_w, s) => new JetpackTrooper(s.props, s.y !== undefined),
  'Jetpack trooper, 2 HP: hovers ~65 px up and strafes inside the view; telegraphed 3-round downward bursts and grenade drops from above. Crashes in flames when shot down. No y = starts on the ground and takes off. props.height, facing, drop',
);
