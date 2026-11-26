// Paratrooper: drifts down under a striped canopy, then fights like a rifleman (with an SMG).
// Shooting the canopy tears it: he plummets flailing and goes splat if the drop is high enough
// (credited to the shooter). Shooting him directly works too.
// Spawned without a y he starts just above the top of the screen.
// props: facing, drop, behavior (after landing, default 'charge'), landed: true = start on the ground,
//        drift: horizontal drift px/s while descending (default: toward the nearest player, 8)

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { drawHuman, type HumanPose } from '../../art/humanoid';
import { defineSoldier, RUSTCOAT, SF, SOLDIER_H, SOLDIER_OX, SOLDIER_OY, SOLDIER_W, styleVariant } from '../../art/soldier';
import { Entity } from '../../game/entity';
import { Z, type Damage } from '../../game/constants';
import { registerEntity } from '../../game/registry';
import type { Rect } from '../../engine/math';
import { Rifleman } from './rifleman';

export const PARA_STYLE = styleVariant(RUSTCOAT, {
  shirt: '#7c7a58',
  pants: '#68664a',
  vest: undefined,
  strap: '#3a2e1e',
  headgear: 'beret',
  headgearColor: '#7e1e2c',
  headgearAccent: '#e8c040',
  scarf: '#e0d0a8',
  backpack: '#5a5838',
  gunColor: '#33302c',
});

defineSoldier('paratrooper', PARA_STYLE, 'smg');

const HANG_POSES: HumanPose[] = [
  { hip: [0, -13], footB: [-1.5, 0.5], footF: [1.5, 1], handF: [3, -9], handB: [-3, -9], gun: 'none' },
  { hip: [0.5, -13], footB: [-1, 0], footF: [2.2, 0.6], handF: [3.2, -9.5], handB: [-2.6, -8.6], gun: 'none', headDx: 0.3 },
  { hip: [0, -13], footB: [-4, -3], footF: [4.5, -1], handF: [6, -6], handB: [-6, -4], gun: 'none', expr: 'shout' },
  { hip: [0, -13], footB: [-3, -1], footF: [3.5, -4], handF: [5, -2], handB: [-5.5, -8], gun: 'none', expr: 'hurt' },
];

/** Hanging under the canopy (0-1 sway) and flailing after the canopy is shot (2-3). */
sprites.define({
  name: 'paratrooper_hang',
  w: SOLDIER_W,
  h: SOLDIER_H,
  ox: SOLDIER_OX,
  oy: SOLDIER_OY,
  frames: HANG_POSES.length,
  draw: (p, f) => drawHuman(p, SOLDIER_OX, SOLDIER_OY, HANG_POSES[f], PARA_STYLE),
});

const CW = 38;
const CH = 40;

/**
 * Canopy (origin: the harness point the lines meet at, just above the shoulders).
 * Frames: 0-1 open (breathing), 2 collapsing, 3 heap on the ground, 4 torn and spilling air.
 */
sprites.define({
  name: 'parachute',
  w: CW,
  h: CH,
  ox: CW / 2,
  oy: CH - 1,
  frames: 5,
  outline: null,
  draw: (p, f) => {
    const cx = CW / 2;
    const bx = cx;
    const by = CH - 1;
    const rust = '#b84a2a';
    const cream = '#ecdcbc';
    const shadeOf = (c: string, k: number) => (k < 0.35 ? c : k < 0.7 ? (c === rust ? '#9a3a22' : '#cfc0a0') : c === rust ? '#7a2c1a' : '#b0a284');
    if (f <= 1 || f === 4) {
      const rx = f === 1 ? 18 : 17;
      const ry = f === 1 ? 11 : 12.5;
      const cy = 15;
      for (let y = 0; y < CH; y++)
        for (let x = 0; x < CW; x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          if (dy > 0.05 || dx * dx + dy * dy > 1) continue;
          // Torn frame: a ragged hole on the right.
          if (f === 4 && Math.hypot(x + 0.5 - cx - 7, y + 0.5 - cy + 5) < 4 + ((x * 3 + y) % 3)) continue;
          // Scalloped hem: each gore's bottom edge bows upward.
          const gore = Math.floor(((x + 0.5 - (cx - rx)) / (2 * rx)) * 6);
          const gx = ((x + 0.5 - (cx - rx)) / (2 * rx)) * 6 - gore;
          if (y + 0.5 > cy - Math.sin(gx * Math.PI) * 2.2 + 0.5) continue;
          const light = (x + 0.5 - (cx - rx)) / (2 * rx) * 0.8 + (y / (cy + 1)) * 0.25;
          p.px(x, y, shadeOf(gore % 2 ? cream : rust, light));
        }
      // Top vent + highlight.
      p.rect(cx - 1, 2.5, 2, 1, '#5a2a1a');
      p.rect(cx - 9, 5, 4, 1, '#ffe8c8');
      p.outline('#140c1c');
      // Suspension lines (no outline).
      const hem = cy + 0.5;
      for (const k of [-1, -0.6, -0.2, 0.2, 0.6, 1]) {
        const lx = cx + k * (rx - 1.5);
        p.line(lx, hem, bx + k * 2.5, by - 1, f === 4 && k > 0.5 ? '#8a8070' : '#4a4038');
      }
    } else if (f === 2) {
      // Collapsing: slumped, tilted dome.
      p.poly([4, 22, 10, 12, 20, 9, 30, 13, 34, 24, 26, 21, 18, 24, 11, 21], rust);
      p.poly([10, 12, 15, 10, 18, 23, 11, 21], cream);
      p.poly([24, 11, 29, 13, 27, 21, 22, 22], cream);
      p.outline('#140c1c');
      for (const x of [6, 14, 22, 31]) p.line(x, 22, bx, by - 1, '#4a4038');
    } else {
      // Crumpled heap.
      p.poly([4, CH - 1, 8, CH - 7, 16, CH - 9, 24, CH - 8, 33, CH - 4, 35, CH - 1], rust);
      p.poly([12, CH - 1, 15, CH - 8, 21, CH - 8, 22, CH - 1], cream);
      p.poly([27, CH - 1, 28, CH - 6, 32, CH - 4, 33, CH - 1], cream);
      p.outline('#140c1c');
    }
  },
});

/** A spent or torn canopy drifting away / settling. */
class Canopy extends Entity {
  frame: number;
  constructor(x: number, y: number, frame: number, vx: number, vy: number) {
    super();
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.frame = frame;
    this.z = Z.ENEMY - 1;
  }
  override update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.frame === 4) {
      this.vy = Math.min(70, this.vy + 60 * dt);
      this.vx *= 0.99;
    } else {
      this.vx *= 0.9;
      const fy = this.world.terrain.floorAt(this.x, this.y - 8, this.y + 4);
      if (fy) {
        this.y = fy.y;
        this.vy = 0;
        if (this.frame === 2 && this.age > 0.35) this.frame = 3;
      } else this.vy = Math.min(60, this.vy + 80 * dt);
    }
    if (this.age > 2.2) this.remove();
  }
  override render(g: CanvasRenderingContext2D): void {
    if (this.age > 1.7 && Math.floor(this.age * 20) % 2 === 0) return;
    sprites.get('parachute').draw(g, this.x, this.y, this.frame, { rot: this.frame === 4 ? Math.round(Math.sin(this.age * 5) * 2) * 0.12 : 0 });
  }
}

export class Paratrooper extends Rifleman {
  descending: boolean;
  /** Canopy shot away: free fall. */
  falling = false;
  private fallFrom = 0;
  private shooter: Entity | null = null;
  private drift: number | undefined;
  private startAbove: boolean;
  private announced = false;
  private landTime = 0;

  constructor(props: Record<string, any> = {}, yGiven = false) {
    super({ behavior: 'charge', ...props }, 'paratrooper');
    this.scoreValue = 100;
    this.descending = !props.landed;
    this.startAbove = !yGiven && !props.landed;
    this.drift = props.drift;
  }

  override spawned(): void {
    super.spawned();
    if (this.startAbove) this.y = this.world.camera.y - 6;
    else if (this.descending && this.world.terrain.floorAt(this.x, this.y - 2, this.y + 3)) this.descending = false;
    if (this.descending) {
      this.gravityScale = 0;
      this.setState('descend');
    }
  }

  /** Canopy hurtbox (above the body). */
  canopyBox(): Rect {
    return { x: this.x - 17, y: this.y - 26 - 36, w: 34, h: 14 };
  }

  override hurtboxes(): Rect[] {
    if (this.descending && !this.falling) return [this.box, this.canopyBox()];
    return super.hurtboxes();
  }

  override damage(d: Damage): boolean {
    if (this.dead || !this.hittable) return false;
    if (this.descending && !this.falling && d.kind !== 'explosion' && d.y !== undefined && d.y < this.top - 3) {
      this.tearCanopy(d);
      return true;
    }
    return super.damage(d);
  }

  private tearCanopy(d: Damage): void {
    this.falling = true;
    this.fallFrom = this.y;
    this.shooter = d.owner ?? null;
    this.gravityScale = 1;
    this.vy = Math.max(this.vy, 20);
    this.world.add(new Canopy(this.x, this.y - 22, 4, this.vx * 0.5 + fxRng.range(-10, 10), -20));
    this.world.particles.add({ kind: 'px', x: this.x, y: this.y - 50, vx: 0, vy: -20, life: 0.4, color: '#ecdcbc' });
    for (let i = 0; i < 5; i++) this.world.particles.add({ kind: 'debris', x: this.x + fxRng.range(-10, 10), y: this.y - 52, vx: fxRng.range(-40, 40), vy: fxRng.range(-60, -10), life: 0.8, color: fxRng.pick(['#b84a2a', '#ecdcbc']), size: 1, gravity: 120 });
    this.world.sfx('parachute', this.x, { vol: 0.6, pitch: 1.5 });
    this.sfx('enemy_alert', { vol: 0.5, pitch: 1.5, gap: 0.2 });
  }

  override think(dt: number): void {
    if (!this.descending) {
      if (this.landTime > 0) {
        // Landing squat.
        this.landTime -= dt;
        this.vx = 0;
        this.moveAndCollide(dt);
        return;
      }
      super.think(dt);
      return;
    }
    if (!this.announced && this.onScreen(30)) {
      this.announced = true;
      this.world.sfx('parachute', this.x, { vol: 0.5 });
    }
    if (this.falling) {
      this.vx *= 0.98;
      this.moveAndCollide(dt);
      if (this.onGround) {
        this.descending = false;
        this.falling = false;
        const drop = this.y - this.fallFrom;
        this.world.particles.dust(this.x, this.y, 7);
        if (drop > 34) {
          // Splat (credited to whoever shot the canopy).
          this.world.shake(1.5, 0.15);
          this.damage({ amount: 99, kind: 'crush', owner: this.shooter, dir: this.facing });
        } else {
          this.landTime = 0.35;
          this.setState('alert');
        }
      }
      return;
    }
    // Gentle descent with sway, drifting toward the action.
    const t = this.target();
    if (t) this.faceTarget(t);
    const drift = this.drift ?? (t ? Math.sign(t.x - this.x) * 8 : 0);
    this.vx = drift + Math.sin(this.age * 1.3 + this.id) * 12;
    this.vy = 30;
    this.moveAndCollide(dt);
    if (this.onGround) {
      this.descending = false;
      this.gravityScale = 1;
      this.landTime = 0.3;
      this.world.particles.dust(this.x, this.y, 4);
      this.world.add(new Canopy(this.x - this.facing * 6, this.y, 2, -this.facing * 25, 0));
      this.setState('alert');
    }
  }

  override onDeath(d?: Damage): void {
    super.onDeath(d);
    if (this.descending && !this.falling) {
      // Shot while hanging: the canopy drifts off on its own.
      this.world.add(new Canopy(this.x, this.y - 22, 4, fxRng.range(-10, 10), -15));
    }
    this.descending = false;
  }

  override deathFrame(): number {
    if (this.deathKind === 'crush') return SF.DIE + 4;
    return super.deathFrame();
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.dying || !this.descending) {
      if (this.landTime > 0 && !this.dying) {
        sprites.get('paratrooper').draw(g, this.x, this.y, SF.CROUCH_AIM, { flip: this.facing < 0, flash: this.flash > 0 });
        return;
      }
      super.render(g);
      return;
    }
    const flip = this.facing < 0;
    if (this.falling) {
      sprites.get('paratrooper_hang').draw(g, this.x, this.y, 2 + (Math.floor(this.age * 10) % 2), { flip, flash: this.flash > 0 });
      return;
    }
    const sway = Math.sin(this.age * 1.3 + this.id);
    sprites.get('parachute').draw(g, this.x, this.y - 23, Math.floor(this.age * 2.5) % 2, { rot: Math.round(sway * 2) * 0.05 });
    sprites.get('paratrooper_hang').draw(g, this.x, this.y, Math.floor(this.age * 1.6) % 2, { flip, flash: this.flash > 0 });
  }
}

registerEntity(
  'paratrooper',
  'enemy',
  (_w, s) => new Paratrooper(s.props, s.y !== undefined),
  'Descends under a shootable parachute (tear it and he falls - splat), then fights like a rifleman with an SMG. No y = starts above the screen. props.landed, drift, behavior (after landing, default charge), facing, drop',
);
