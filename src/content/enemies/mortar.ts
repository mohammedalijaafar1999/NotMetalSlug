// Mortar crew: a gunner and a loader kneeling at a mortar. They stay put. The loader hands over a
// shell, the gunner drops it down the tube - THOOMP - and a blinking target marker appears where it
// will land (~1.35 s later, under where you were standing). Each crewman is a separate 1-HP soldier
// (100 pts each); with one left, the survivor works the tube alone (slower). Point-blank they cower.
// The 'mortar' entity itself is the tube + coordinator: it blocks arena progress until both are down.
// props: facing, drop (carried by the gunner), range: max target distance px (default 360),
//        interval: base seconds between shells (default 3.2)

import { sprites } from '../../engine/sprites';
import { VIEW_W } from '../../engine/renderer';
import { defineSoldier, RUSTCOAT, SF, styleVariant, poseHand } from '../../art/soldier';
import type { HumanPose } from '../../art/humanoid';
import type { PixelArt } from '../../engine/pixelart';
import { Enemy } from '../../game/enemy';
import { registerEntity } from '../../game/registry';
import { Infantry } from './infantry';
import { uprightFrame } from './gear';
import { MortarShell } from './projectiles';

const CREW = styleVariant(RUSTCOAT, { vest: undefined, strap: '#4a3a24', sleeves: 'short', shirt: '#8e8050' });
export const GUNNER_STYLE = styleVariant(CREW, { headgear: 'helmet', headgearColor: '#6a6038', headgearAccent: '#8a9a4a', mustache: '#3a2a1a' });
export const LOADER_STYLE = styleVariant(CREW, { headgear: 'cap', headgearColor: '#8a3a22', headgearAccent: '#e0c060', hair: '#8a5a2a', skin: '#f0bc94' });

/** Crew action frames (mapped onto SF indices of the crew sprite sets). */
export const CREW_F = {
  KNEEL: SF.IDLE,
  HOLD: SF.AIM,
  DROP: SF.FIRE,
  EARS: SF.CROUCH_AIM,
  REACH: SF.CROUCH_FIRE,
  SPOT: SF.FIDGET,
} as const;

const KNEEL_LEGS = { hip: [0, -8] as [number, number], footF: [5, 0] as [number, number], footB: [-4.5, 0] as [number, number], lean: 1 };

function crewPose(f: number, pose: HumanPose): HumanPose {
  const K = (handF: [number, number], handB: [number, number], extra: Partial<HumanPose> = {}): HumanPose => ({ ...pose, ...KNEEL_LEGS, gun: 'none', handF, handB, ...extra });
  switch (f) {
    case SF.IDLE:
    case SF.IDLE + 1:
      return K([5, 5], [3, 6], { hip: [0, -8 + (f % 2) * 0.4] });
    case SF.AIM:
      return K([7, -1], [6, 0], { expr: 'normal' });
    case SF.FIRE:
      return K([11, -3], [9, -2], { lean: 2.5, expr: 'normal' });
    case SF.CROUCH_AIM:
      return K([2, -6], [-1, -6], { lean: 0, headDy: 1, expr: 'hurt' });
    case SF.CROUCH_FIRE:
      return K([-7, 6], [-6, 7], { lean: -1.5, headDx: -1 });
    case SF.FIDGET:
    case SF.FIDGET + 1:
      return K([4.5, -7], [3.5, -6.5], { headDy: f === SF.FIDGET ? 0 : 0.5 });
  }
  return pose;
}

function drawShell(p: PixelArt, x: number, y: number, upright = true): void {
  if (upright) {
    p.ellipse(x, y - 1, 1.8, 3, '#3c3a44');
    p.px(x - 1, y - 3, '#7a7884');
    p.rect(x - 1.5, y + 1.5, 3, 1, '#c8a040');
  } else {
    p.ellipse(x, y, 3, 1.8, '#3c3a44');
    p.px(x + 1, y - 1, '#7a7884');
    p.rect(x - 2.5, y - 1.5, 1, 3, '#c8a040');
  }
}

function crewDecorate(loader: boolean) {
  return (p: PixelArt, f: number, pose: HumanPose): void => {
    if (!uprightFrame(f)) return;
    const [hx, hy] = poseHand(pose, 'F');
    if (f === SF.AIM) drawShell(p, hx - 0.5, hy - 1, false);
    if (loader && (f === SF.IDLE || f === SF.IDLE + 1)) drawShell(p, hx - 1, hy - 2);
    if (f === SF.FIDGET || f === SF.FIDGET + 1) {
      // Binoculars.
      p.rect(hx - 1, hy - 1.5, 3, 3, '#2a2a30');
      p.px(hx + 1, hy - 1, '#8ad8ff');
    }
  };
}

defineSoldier('mortar_gunner', GUNNER_STYLE, 'none', { throwItem: 'none', pose: crewPose, decorate: crewDecorate(false) });
defineSoldier('mortar_loader', LOADER_STYLE, 'none', { throwItem: 'none', pose: crewPose, decorate: crewDecorate(true) });

/** Mortar on its bipod (origin: base plate on the ground, tube pointing up-forward). Frames: idle, recoil. */
sprites.define({
  name: 'mortar_tube',
  w: 20,
  h: 22,
  ox: 8,
  oy: 21,
  frames: 2,
  draw: (p, f) => {
    const r = f ? 1.5 : 0;
    // Base plate.
    p.poly([1, 21, 3, 18.5, 12, 18.5, 14, 21], '#4a4852');
    p.rect(3, 18.5, 9, 1, '#7a7884');
    // Bipod legs.
    p.line(12, 12 + r, 17, 21, '#3a3842', 2);
    p.line(12, 12 + r, 15, 21, '#2a2830', 1);
    p.rect(11, 12 + r, 3, 1.5, '#8a8894');
    // Tube (angled ~65 degrees, mouth up-forward).
    const bx = 7;
    const by = 19;
    const tx = 13 - r * 0.4;
    const ty = 2 + r;
    p.capsule(bx, by, tx, ty, 2.2, '#4c5a34');
    p.capsule(bx - 0.8, by - 1, tx - 0.8, ty, 0.7, '#7a8a52');
    p.capsule(tx - 0.3, ty + 0.5, tx + 0.5, ty - 1, 2.6, '#36421f');
    p.circle(tx + 0.4, ty - 1, 1.2, '#14100c');
    p.rect(9, 10 + r, 4, 1.5, '#c8a040');
  },
});

sprites.define({
  name: 'ammo_crate',
  w: 14,
  h: 10,
  draw: (p) => {
    p.rect(0, 3, 14, 7, '#7a5a30');
    p.rect(0, 3, 14, 1, '#a07a44');
    p.rect(0, 9, 14, 1, '#4a341a');
    p.rect(6, 4, 2, 5, '#5a3e20');
    for (const x of [2, 5, 9, 12]) {
      p.ellipse(x, 2.5, 1.4, 2.4, '#3c3a44');
      p.px(x - 0.5, 1, '#7a7884');
    }
    p.rect(1, 6, 4, 2, '#c8b890');
  },
});

/** One kneeling crewman (separate hittable soldier). */
export class MortarMan extends Infantry {
  crew: MortarCrew;
  /** Action frame requested by the crew (CREW_F.*). */
  action: number = CREW_F.KNEEL;
  /** Walk to this x (taking over the tube). */
  goalX: number | null = null;

  constructor(crew: MortarCrew, sprite: string, props: Record<string, any> = {}) {
    super(sprite, { behavior: 'guard', ...props });
    this.crew = crew;
    this.scoreValue = 100;
    this.panicProne = 0;
    this.h = 24;
  }

  override startState(): string {
    return 'man';
  }

  combat(_dt: number): void {
    this.vx = 0;
    if (this.state === 'engage') this.setState('man');
    if (this.goalX !== null) {
      const d = this.goalX - this.x;
      if (Math.abs(d) < 1.5) {
        this.x = this.goalX;
        this.goalX = null;
        this.facing = this.crew.facing;
        this.h = 24;
      } else {
        this.facing = d > 0 ? 1 : -1;
        this.vx = Math.sign(d) * 36;
        this.h = 26;
      }
      return;
    }
    this.facing = this.crew.facing;
    // Point-blank: duck and cover.
    const t = this.target();
    this.cowering = !!t && Math.abs(t.x - this.x) < 34 && Math.abs(t.y - this.y) < 30;
  }

  override aliveFrame(): number {
    if (this.goalX !== null) return this.walkFrame();
    if (this.state === 'alert') return SF.ALERT;
    if (this.cowering) return SF.COWER + (Math.floor(this.age * 9) % 2);
    if (this.action === CREW_F.KNEEL || this.action === CREW_F.SPOT) return this.action + (Math.floor(this.age * 1.5) % 2);
    return this.action;
  }

  override onDeath(d?: import('../../game/constants').Damage): void {
    super.onDeath(d);
    this.h = 26;
    this.crew.crewmanDown(this);
  }
}

export class MortarCrew extends Enemy {
  gunner: MortarMan | null = null;
  loader: MortarMan | null = null;
  range: number;
  interval: number;
  attackTimer = 0;
  private recoil = 0;
  private wrecked = false;

  constructor(props: Record<string, any> = {}) {
    super();
    this.hittable = false;
    this.w = 48;
    this.h = 24;
    this.scoreValue = 0;
    this.range = props.range ?? 360;
    this.interval = props.interval ?? 3.2;
  }

  /** Gunner kneels at x; the tube sits in front, the loader and his crate behind. */
  get tubeX(): number {
    return this.x + this.facing * 9;
  }

  override spawned(): void {
    super.spawned();
    const mk = (sprite: string, dx: number, props: Record<string, any>) => {
      const m = new MortarMan(this, sprite, props);
      m.x = this.x + this.facing * dx;
      m.y = this.y;
      m.facing = this.facing;
      m.props = { ...props, facing: this.facing };
      m.waveId = this.waveId;
      return this.world.add(m);
    };
    this.gunner = mk('mortar_gunner', 0, { drop: this.props.drop });
    this.loader = mk('mortar_loader', -15, {});
    this.props.drop = undefined;
    this.setState('ready');
    this.stateTime = 0;
    this.attackTimer = this.fireDelay(1.4);
  }

  crewmanDown(m: MortarMan): void {
    if (m === this.gunner) {
      this.gunner = null;
      if (this.loader && !this.loader.dying) {
        // The loader takes over the tube.
        this.gunner = this.loader;
        this.loader = null;
        this.gunner.goalX = this.x;
        this.gunner.say(1, { life: 0.6 });
      }
    } else if (m === this.loader) this.loader = null;
    if (this.state !== 'ready') this.setState('ready');
    this.attackTimer = Math.max(this.attackTimer, 0.8);
  }

  private isUp(m: MortarMan | null): m is MortarMan {
    return !!m && !m.dead && !m.dying;
  }

  think(dt: number): void {
    if (this.recoil > 0) this.recoil -= dt;
    const g = this.isUp(this.gunner) ? this.gunner : null;
    const l = this.isUp(this.loader) ? this.loader : null;
    if (!g && !l) {
      if (!this.wrecked) {
        this.wrecked = true;
        this.blocksProgress = false;
      }
      if (!this.onScreen(80)) this.remove();
      return;
    }
    if (g && g.goalX !== null) return; // taking over the tube
    const t = this.target();
    const inRange = !!t && Math.abs(t.x - this.tubeX) > 50 && Math.abs(t.x - this.tubeX) < this.range;
    const cowering = (g?.cowering ?? false) || (l?.cowering ?? false);
    const set = (gf: number, lf: number) => {
      if (g) g.action = gf;
      if (l) l.action = lf;
    };
    const solo = !l;
    switch (this.state) {
      case 'ready':
        set(inRange ? CREW_F.SPOT : CREW_F.KNEEL, CREW_F.KNEEL);
        if (solo && g) g.action = CREW_F.KNEEL;
        if (inRange && !cowering && this.canAttack(-4)) {
          this.attackTimer -= dt;
          if (this.attackTimer <= 0) this.setState(solo ? 'fetch' : 'pass');
        }
        break;
      case 'fetch':
        set(CREW_F.REACH, CREW_F.KNEEL);
        if (this.stateTime > 0.55) this.setState('hold');
        break;
      case 'pass':
        // Loader offers the shell; the gunner takes it.
        set(this.stateTime < 0.2 ? CREW_F.KNEEL : CREW_F.HOLD, this.stateTime < 0.2 ? CREW_F.HOLD : CREW_F.REACH);
        if (this.stateTime > 0.38) this.setState('hold');
        break;
      case 'hold':
        set(CREW_F.HOLD, CREW_F.REACH);
        if (this.stateTime > 0.25) this.setState('drop');
        break;
      case 'drop':
        set(CREW_F.DROP, CREW_F.KNEEL);
        if (this.stateTime > 0.22) {
          if (this.canAttack(-4)) this.fire();
          this.setState('cover');
        }
        break;
      case 'cover':
        set(CREW_F.EARS, CREW_F.REACH);
        if (this.stateTime > 0.5) {
          this.attackTimer = this.fireDelay(this.interval * (solo ? 1.5 : 1));
          this.setState('ready');
        }
        break;
      default:
        this.setState('ready');
    }
  }

  private fire(): void {
    const t = this.target();
    if (!t) return;
    const T = this.world.terrain;
    const cam = this.world.camera;
    const lead = Math.max(-36, Math.min(36, t.vx * 0.35));
    let tx = t.x + lead + this.world.rng.range(-6, 6);
    tx = Math.max(cam.x + 10, Math.min(cam.x + VIEW_W - 10, tx));
    const fl = T.floorAt(tx, t.y - 8, t.y + 160) ?? T.floorAt(tx, cam.y - 40, cam.y + 400);
    const ty = fl ? fl.y : t.y;
    const mx = this.tubeX + this.facing * 5;
    const my = this.y - 20;
    const impact = 1.35 / Math.max(0.6, this.world.difficulty.enemyShotSpeed);
    this.world.add(new MortarShell(this, mx, my, tx, ty, impact));
    this.recoil = 0.14;
    this.world.particles.smokePuffs(mx, my - 2, 4, 3, '#c8c0b0', '#8a8478');
    this.world.particles.sparks(mx, my, 4, '#ffd060', 90);
    this.world.effect('explosion_tiny', mx, my - 2, { fps: 30 });
    this.world.sfx('mortar_fire', this.x, { vol: 0.8 });
    this.world.shake(1, 0.1);
  }

  override render(g: CanvasRenderingContext2D): void {
    const flip = this.facing < 0;
    sprites.get('ammo_crate').draw(g, this.x - this.facing * 27, this.y, 0, { flip });
    sprites.get('mortar_tube').draw(g, this.tubeX, this.y, this.recoil > 0 ? 1 : 0, { flip });
  }
}

registerEntity(
  'mortar',
  'enemy',
  (_w, s) => new MortarCrew(s.props),
  '2-man mortar crew that stays put: blinking target marker shows where each shell lands ~1.35 s ahead. Each crewman is a 1-HP soldier; the survivor fires alone (slower). props.facing, drop (gunner), range (default 360), interval (default 3.2 s)',
);
