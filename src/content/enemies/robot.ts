// Robot "Clockwork Grunt": a riveted brass automaton with a boiler belly, one glowing eye, a turning
// wind-up key and a copper coil cannon. Stomps forward slowly; charges its cannon (eye + emitter glow,
// crackling sparks) and fires a pair of slow energy bolts. 4 HP of armour: bullets clang off with
// sparks (but still hurt), the knife only does 2 per stab (no instant kill), explosions work fine.
// On death it shudders, pops its head off on a spring and bursts into gears.
// props: behavior: patrol (default) | guard | idle | sleep (= powered down, eye dark) | charge,
//        facing, drop

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import type { PixelArt } from '../../engine/pixelart';
import { Entity } from '../../game/entity';
import { ExplosionEffect } from '../../game/effects';
import { Z, type Damage } from '../../game/constants';
import { registerEntity } from '../../game/registry';
import { BUBBLE, Infantry } from './infantry';
import { EnergyBolt } from './projectiles';

const RW = 40;
const RH = 40;
const OX = 18;
const OY = 37;

const BRASS = '#b8862e';
const BRASS_HI = '#e8c060';
const BRASS_LO = '#7a5418';
const IRON = '#5a5a66';
const IRON_HI = '#8a8a98';
const IRON_LO = '#36363e';
const COPPER = '#c0642e';
const COPPER_LO = '#7a3a1a';

interface RobotPose {
  /** Foot positions (x, lift). */
  fb: [number, number];
  ff: [number, number];
  /** Body vertical offset. */
  bob?: number;
  /** Cannon angle (0 forward, + down). */
  arm?: number;
  /** Emitter glow 0..2. */
  glow?: number;
  /** Key rotation phase 0..3. */
  key?: number;
  /** Eye: 1 on, 0 off, 2 flash. */
  eye?: number;
  /** Lean back (stagger) px for head/body. */
  lean?: number;
  /** Recoil px. */
  recoil?: number;
  noHead?: boolean;
  slump?: number;
}

/** Iron foot (flat shoe) with a piston leg up to the hip. */
function leg(p: PixelArt, hx: number, hy: number, fx: number, lift: number, back: boolean): void {
  const fy = OY - lift;
  const c = back ? IRON_LO : IRON;
  const knx = (hx + fx) / 2 + 1.5;
  const kny = (hy + fy) / 2 - 0.5;
  p.capsule(hx, hy, knx, kny, 1.9, back ? BRASS_LO : BRASS);
  p.capsule(knx, kny, fx, fy - 2.5, 1.5, back ? IRON_LO : IRON_HI);
  p.circle(knx, kny, 1.6, back ? IRON_LO : IRON);
  p.poly([fx - 3, fy - 3, fx + 2, fy - 3.4, fx + 4.5, fy - 1.2, fx + 4.5, fy, fx - 3.2, fy], c);
  if (!back) p.rect(fx - 2.5, fy - 3, 5, 1, IRON_HI);
}

function drawRobot(p: PixelArt, o: RobotPose): void {
  const bob = o.bob ?? 0;
  const lean = o.lean ?? 0;
  const slump = o.slump ?? 0;
  const bx = OX + lean * 0.5;
  const by = OY - 19 + bob + slump;
  // Back leg, back arm (claw), key and stack behind the body.
  leg(p, bx - 3, by + 8, OX + o.fb[0], o.fb[1], true);
  p.capsule(bx - 6, by - 3, bx - 8, by + 4, 1.4, IRON_LO);
  p.poly([bx - 10, by + 4, bx - 6.5, by + 3.5, bx - 7, by + 7.5, bx - 8.5, by + 6, bx - 10.5, by + 7], IRON_LO);
  // Wind-up key (bow turns: wide / narrow / edge-on / narrow).
  const k = (o.key ?? 0) % 4;
  const kw = [3.2, 2, 0.7, 2][k];
  p.rect(bx - 12, by - 1.5, 4, 2, IRON);
  p.ellipse(bx - 13.5, by - 4, kw, 2.6, IRON_HI);
  p.ellipse(bx - 13.5, by + 2.5, kw, 2.6, IRON_HI);
  if (kw > 1) {
    p.ellipse(bx - 13.5, by - 4, Math.max(0.5, kw - 1.4), 1.2, IRON_LO);
    p.ellipse(bx - 13.5, by + 2.5, Math.max(0.5, kw - 1.4), 1.2, IRON_LO);
  }
  // Smokestack.
  p.rect(bx - 6.5, by - 13 + slump * 0.3, 3, 6, IRON_LO);
  p.rect(bx - 7, by - 14 + slump * 0.3, 4, 1.5, IRON);
  // Boiler body.
  p.ellipse(bx, by, 8.5, 9, BRASS_LO);
  p.ellipse(bx - 0.6, by - 0.6, 7.8, 8.2, BRASS);
  p.ellipse(bx - 2.8, by - 3, 3.2, 4, BRASS_HI);
  p.rect(bx - 4, by - 6, 2, 1, '#fff0b8');
  // Riveted iron bands.
  for (const yy of [-5.5, 5]) {
    const hw = Math.sqrt(Math.max(0, 1 - (yy / 9) ** 2)) * 8.5;
    p.rect(bx - hw, by + yy, hw * 2, 1.6, IRON);
    p.rect(bx - hw, by + yy, hw * 2, 0.6, IRON_HI);
    for (let x = -hw + 1.5; x < hw - 1; x += 3) p.px(bx + x, by + yy + 0.8, IRON_LO);
  }
  // Furnace grille (glows).
  p.rect(bx + 2.5, by - 3, 4.5, 5.5, '#2a1a10');
  p.rect(bx + 3, by - 2.5, 3.5, 4.5, o.eye === 0 ? '#5a2a14' : '#ff8a20');
  p.rect(bx + 3, by - 0.5, 3.5, 0.8, '#2a1a10');
  p.rect(bx + 3, by + 1.3, 3.5, 0.8, '#2a1a10');
  p.rect(bx + 3.5, by - 2.5, 1, 1, o.eye === 0 ? '#7a3a1a' : '#ffe080');
  // Head.
  if (!o.noHead) {
    const hx = bx + 1 + lean * 0.4;
    const hy = by - 11.5 + slump * 0.4;
    p.rect(hx - 1.5, hy + 2.5, 3, 2, IRON_LO);
    p.circle(hx, hy, 4.2, IRON);
    p.rect(hx - 4.2, hy, 8.4, 2.4, IRON);
    p.circle(hx - 1.2, hy - 1.4, 1.8, IRON_HI);
    p.rect(hx - 4.2, hy + 1.6, 8.4, 0.8, IRON_LO);
    // Eye.
    const eyeC = o.eye === 0 ? '#3a1a1a' : o.eye === 2 ? '#ffffff' : '#ff3a2a';
    p.circle(hx + 2.4, hy + 0.3, 1.7, '#1a1014');
    p.circle(hx + 2.4, hy + 0.3, 1.2, eyeC);
    if (o.eye !== 0) p.px(hx + 2, hy - 0.5, '#ffd0c0');
    // Little steam whistle on top.
    p.rect(hx - 0.5, hy - 6, 1.5, 2, BRASS);
    p.rect(hx - 1, hy - 6.5, 2.5, 1, BRASS_HI);
  }
  // Front leg.
  leg(p, bx + 3, by + 8, OX + o.ff[0], o.ff[1], false);
  // Cannon arm.
  const a = o.arm ?? 0;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const sx = bx + 4 - (o.recoil ?? 0);
  const sy = by - 3;
  p.circle(sx, sy, 2.6, IRON);
  p.circle(sx - 0.7, sy - 0.8, 1.1, IRON_HI);
  const L = 11;
  p.capsule(sx + ca * 1, sy + sa * 1, sx + ca * L, sy + sa * L, 2.4, COPPER_LO);
  p.capsule(sx + ca * 1 - sa * -0.6, sy + sa * 1 - 0.6, sx + ca * L, sy + sa * L - 0.6, 1.6, COPPER);
  for (let i = 3; i < L; i += 2) {
    p.capsule(sx + ca * i - sa * 2.2, sy + sa * i + ca * -2.2, sx + ca * i + sa * 2.2, sy + sa * i + ca * 2.2, 0.45, '#5a2a10');
  }
  const ex = sx + ca * (L + 1.5);
  const ey = sy + sa * (L + 1.5);
  const glow = o.glow ?? 0;
  p.circle(ex, ey, 2.2, IRON_LO);
  p.circle(ex + ca * 0.5, ey + sa * 0.5, 1.5 + glow * 0.3, glow >= 2 ? '#ffffff' : glow >= 1 ? '#9af8ff' : '#2a8ab0');
}

/** Frame table. */
const ROBOT_FRAMES: RobotPose[] = (() => {
  const f: RobotPose[] = [];
  // 0-1 idle.
  f.push({ fb: [-4, 0], ff: [4, 0], arm: 0.45, key: 0 });
  f.push({ fb: [-4, 0], ff: [4, 0], arm: 0.45, key: 2, bob: 0.5 });
  // 2-7 walk (stompy 6-frame gait).
  for (let i = 0; i < 6; i++) {
    const ph = (i / 6) * Math.PI * 2;
    const s = Math.sin(ph);
    f.push({ fb: [-1 - s * 4.5, Math.max(0, -Math.cos(ph)) * 2.5], ff: [1 + s * 4.5, Math.max(0, Math.cos(ph)) * 2.5], arm: 0.35, key: i % 4, bob: Math.abs(Math.cos(ph)) * -1 });
  }
  // 8 aim, 9 charge, 10 fire.
  f.push({ fb: [-4, 0], ff: [4.5, 0], arm: 0, glow: 1, key: 1 });
  f.push({ fb: [-4, 0], ff: [4.5, 0], arm: 0, glow: 2, key: 3, eye: 2 });
  f.push({ fb: [-4.5, 0], ff: [4, 0], arm: -0.05, glow: 2, key: 0, recoil: 1.5 });
  // 11 stagger.
  f.push({ fb: [-4, 0], ff: [3, 0], arm: 0.6, key: 2, lean: -3, eye: 2 });
  // 12 shudder, 13 sag, 14 heap (headless).
  f.push({ fb: [-4, 0], ff: [4, 0], arm: 0.9, key: 1, lean: -1.5, eye: 2 });
  f.push({ fb: [-5, 0], ff: [5, 0], arm: 1.3, key: 3, lean: 2, slump: 4, eye: 0 });
  f.push({ fb: [-6, 0], ff: [6, 0], arm: 1.5, key: 0, slump: 9, noHead: true, eye: 0 });
  // 15 powered down (sleep).
  f.push({ fb: [-4, 0], ff: [4, 0], arm: 1.2, key: 0, slump: 1.5, eye: 0 });
  return f;
})();

export const RF = { IDLE: 0, WALK: 2, WALK_N: 6, AIM: 8, CHARGE: 9, FIRE: 10, HIT: 11, SHUDDER: 12, SAG: 13, HEAP: 14, OFF: 15, BURNT: 16, COUNT: 17 } as const;

sprites.define({
  name: 'robot',
  w: RW,
  h: RH,
  ox: OX,
  oy: OY,
  frames: RF.COUNT,
  draw: (p, f) => {
    if (f === RF.BURNT) {
      drawRobot(p, ROBOT_FRAMES[RF.SAG]);
      p.mapPixels((_v, x, y) => ((x * 5 + y * 3) % 4 === 0 ? 0xff3a3a46 : (x + y) % 3 === 0 ? 0xff1c1c24 : 0xff2a2a34));
      return;
    }
    drawRobot(p, ROBOT_FRAMES[f]);
  },
});

/** Debris: 0 head, 1 gear, 2 key, 3 plate, 4 spring. */
sprites.define({
  name: 'robot_part',
  w: 11,
  h: 11,
  ox: 5,
  oy: 5,
  frames: 5,
  draw: (p, f) => {
    const c = 5.5;
    switch (f) {
      case 0:
        p.circle(c, c, 4.2, IRON);
        p.rect(c - 4.2, c, 8.4, 2.4, IRON);
        p.circle(c - 1.2, c - 1.4, 1.8, IRON_HI);
        p.circle(c + 2.4, c + 0.3, 1.2, '#3a1a1a');
        break;
      case 1:
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          p.rect(c + Math.cos(a) * 3.8 - 1, c + Math.sin(a) * 3.8 - 1, 2, 2, BRASS);
        }
        p.circle(c, c, 3.4, BRASS);
        p.circle(c - 0.6, c - 0.6, 1.6, BRASS_HI);
        p.circle(c, c, 1, BRASS_LO);
        break;
      case 2:
        p.rect(c - 1, c - 4, 2, 8, IRON);
        p.ellipse(c - 2.5, c - 3, 2.5, 2, IRON_HI);
        p.ellipse(c + 2.5, c - 3, 2.5, 2, IRON_HI);
        break;
      case 3:
        p.poly([1, 3, 9, 1, 10, 7, 2, 9], BRASS_LO);
        p.poly([2, 3.5, 8.5, 2, 9, 6, 3, 7.5], BRASS);
        p.px(3, 4, '#fff0b8');
        break;
      default:
        for (let i = 0; i < 4; i++) p.line(2, 2 + i * 2, 9, 3 + i * 2, IRON_HI);
        break;
    }
  },
});

/** A tumbling robot part. */
class RobotPart extends Entity {
  frame: number;
  rot = 0;
  vr: number;
  bounces = 0;
  constructor(x: number, y: number, frame: number, vx: number, vy: number) {
    super();
    this.anchor = 'center';
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.frame = frame;
    this.vr = fxRng.range(-14, 14);
    this.z = Z.FX;
  }
  override update(dt: number): void {
    this.vy += 620 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vr * dt;
    const gy = this.world.terrain.groundTopAt(this.x);
    if (this.y > gy - 3 && this.vy > 0) {
      this.y = gy - 3;
      this.vy = -this.vy * 0.4;
      this.vx *= 0.6;
      this.vr *= 0.5;
      if (++this.bounces === 1 && this.frame === 0) this.world.particles.dust(this.x, gy, 2);
    }
    if (this.age > 1.8) this.remove();
  }
  override render(g: CanvasRenderingContext2D): void {
    if (this.age > 1.4 && Math.floor(this.age * 20) % 2 === 0) return;
    sprites.get('robot_part').draw(g, this.x, this.y, this.frame, { rot: Math.round(this.rot / (Math.PI / 4)) * (Math.PI / 4) });
  }
}

export class Robot extends Infantry {
  private shots = 0;
  private hitT = 0;
  private popped = false;
  private steamT = 0;

  constructor(props: Record<string, any> = {}) {
    super('robot', props);
    this.w = 16;
    this.h = 30;
    this.hp = this.maxHp = 4;
    this.scoreValue = 300;
    this.firstAttack = 1.0;
    this.panicProne = 0;
    this.patrolSpeed = 14;
    this.alertDelay = 0.5;
    this.deathSfx = 'robot_die';
    this.deathDuration = 2.0;
  }

  /** Robots don't hop: the eye flashes and a "!" pops up. */
  override notice(big = false): void {
    this.setState('alert');
    this.faceTarget();
    this.vx = 0;
    this.say(BUBBLE.ALERT, { life: 0.6, dy: -4 });
    this.sfx('mine_beep', { vol: 0.5, pitch: big ? 0.7 : 0.9, gap: 0.3 });
    if (big) this.world.particles.smokePuffs(this.x - this.facing * 6, this.y - 34, 3, 3, '#e8e8f0', '#a8a8b8');
  }

  override damage(d: Damage): boolean {
    if (this.dead || !this.hittable) return false;
    // Armour: knife stabs only do so much; bullets clang.
    const amount = d.kind === 'melee' ? Math.min(d.amount, 2) : d.amount;
    if (d.kind === 'bullet' || d.kind === 'melee') {
      this.world.particles.sparks(d.x ?? this.x, d.y ?? this.y - 16, 4, '#fff0b0', 110);
      this.sfx('metal_hit', { vol: 0.4, gap: 0.06, pitch: fxRng.range(0.9, 1.2) });
    }
    this.hitT = 0.1;
    return super.damage({ ...d, amount });
  }

  combat(dt: number): void {
    const t = this.target();
    switch (this.state) {
      case 'engage': {
        if (!t) {
          this.setState('patrol');
          break;
        }
        this.faceTarget(t);
        const dx = Math.abs(t.x - this.x);
        let move = 0;
        if (dx > 160) move = this.facing;
        else if (dx < 70) move = -this.facing;
        if (move !== 0 && !this.floorAhead(move)) move = 0;
        this.vx = move * (this.behavior === 'charge' ? 26 : 18);
        this.attackTimer -= dt;
        if (this.attackTimer <= 0 && this.canAttack()) {
          this.vx = 0;
          this.setState('charge');
        }
        break;
      }
      case 'charge':
        this.vx = 0;
        this.faceTarget(t);
        if (fxRng.chance(dt * 30)) {
          const e = this.emitter();
          this.world.particles.add({ kind: 'spark', x: e.x + fxRng.range(-3, 3), y: e.y + fxRng.range(-3, 3), vx: fxRng.range(-40, 40), vy: fxRng.range(-40, 40), life: 0.12, color: '#9af8ff' });
        }
        if (this.stateTime > 0.6) {
          this.shots = 2;
          this.fire();
          this.setState('fire');
        }
        break;
      case 'fire':
        this.vx = 0;
        if (this.stateTime > 0.3) {
          if (--this.shots > 0 && this.canAttack()) {
            this.fire();
            this.stateTime = 0;
          } else {
            this.attackTimer = this.fireDelay(2.4);
            this.setState('engage');
          }
        }
        break;
      default:
        this.setState('engage');
    }
  }

  /** Cannon emitter (world). */
  private emitter(): { x: number; y: number } {
    return { x: this.x + this.facing * 17, y: this.y - 22 };
  }

  private fire(): void {
    const t = this.target();
    const e = this.emitter();
    let angle = this.facing > 0 ? 0 : Math.PI;
    if (t) {
      const dy = t.cy - e.y;
      const dx = Math.abs(t.cx - e.x);
      const a = Math.max(-0.55, Math.min(0.55, Math.atan2(dy, dx)));
      angle = this.facing > 0 ? a : Math.PI - a;
    }
    this.world.add(new EnergyBolt(this, e.x, e.y, angle, this.shotSpeed(130)));
    this.world.particles.sparks(e.x, e.y, 5, '#9af8ff', 100);
    this.sfx('robot_shot', { vol: 0.65 });
  }

  override think(dt: number): void {
    if (this.hitT > 0) this.hitT -= dt;
    super.think(dt);
    // Steam puffs from the stack; leaking sparks when badly damaged.
    this.steamT -= dt;
    if (this.steamT <= 0 && this.state !== 'sleep') {
      this.steamT = this.vx !== 0 ? 0.35 : 0.8;
      this.world.particles.add({ kind: 'smoke', x: this.x - this.facing * 6, y: this.y - 34, vx: -this.facing * 6, vy: -22, life: 0.6, color: '#e8e8f0', color2: '#a8a8b8', size: 1, size2: 3, drag: 1 });
    }
    if (this.hp <= 1 && fxRng.chance(dt * 6)) this.world.particles.sparks(this.x + fxRng.range(-6, 6), this.y - fxRng.range(10, 26), 2, '#ffd060', 70);
  }

  // ---------------------------------------------------------------- death

  override onDeath(d?: Damage): void {
    this.vx *= 0.4;
    if (this.deathKind === 'explosion') {
      this.deathTime = 0.5;
      this.pop(d);
    }
  }

  private pop(_d?: Damage): void {
    if (this.popped) return;
    this.popped = true;
    const x = this.x;
    const y = this.y - 16;
    this.world.add(new ExplosionEffect(x, y, 'small'));
    this.world.add(new RobotPart(x + this.facing * 1, y - 12, 0, -this.facing * fxRng.range(20, 50), -fxRng.range(260, 320)));
    for (let i = 0; i < 5; i++) this.world.add(new RobotPart(x + fxRng.range(-6, 6), y + fxRng.range(-6, 6), fxRng.pick([1, 1, 2, 3, 4]), fxRng.range(-110, 110), -fxRng.range(120, 260)));
    this.world.particles.debris(x, y, 8, [BRASS, IRON, COPPER], 160);
    this.world.particles.smokePuffs(x, y, 4, 6, '#e8e8f0', '#8a8a98');
    this.world.sfx('explosion_small', this.x, { vol: 0.7 });
    this.world.shake(1.5, 0.15);
  }

  override updateDeath(dt: number): void {
    if (this.onGround) this.vx *= Math.pow(0.02, dt);
    this.moveAndCollide(dt);
    if (!this.popped && this.deathTime < 0.5 && fxRng.chance(dt * 30)) this.world.particles.sparks(this.x + fxRng.range(-7, 7), this.y - fxRng.range(8, 28), 2, '#9af8ff', 90);
    if (this.deathTime >= 0.5 && !this.popped) this.pop();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.deathBlinkHidden) return;
    let f: number;
    if (this.dying) {
      if (this.deathKind === 'fire') f = RF.BURNT;
      else if (!this.popped) f = Math.floor(this.deathTime * 20) % 2 ? RF.SHUDDER : RF.HIT;
      else f = this.deathTime < 0.65 ? RF.SAG : RF.HEAP;
    } else if (this.hitT > 0) f = RF.HIT;
    else {
      switch (this.state) {
        case 'sleep':
          f = RF.OFF;
          break;
        case 'charge':
          f = this.stateTime > 0.3 && Math.floor(this.stateTime * 16) % 2 === 0 ? RF.CHARGE : RF.AIM;
          break;
        case 'fire':
          f = this.stateTime < 0.08 ? RF.FIRE : RF.AIM;
          break;
        case 'alert':
          f = Math.floor(this.stateTime * 10) % 2 ? RF.CHARGE : RF.IDLE;
          break;
        default:
          f = this.vx !== 0 ? RF.WALK + (Math.floor(this.walkPhase) % RF.WALK_N) : RF.IDLE + (Math.floor(this.age * 2) % 2);
      }
    }
    sprites.get('robot').draw(g, this.x, this.y, f, { flip: this.facing < 0, flash: this.flash > 0 && !this.dying });
  }
}

registerEntity(
  'robot',
  'enemy',
  (_w, s) => new Robot(s.props),
  'Clockwork Grunt robot, 4 HP armour (bullets clang but hurt, knife max 2 per stab, explosions normal): stomps in, 0.6 s glowing charge, fires 2 slow energy bolts; pops apart on death. props.behavior (sleep = powered down), facing, drop',
);
