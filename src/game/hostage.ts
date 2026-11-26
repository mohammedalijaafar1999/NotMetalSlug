// Hostages (captured mechanics). Shoot or touch a tied hostage to free them: they hop up,
// hand over an item, salute, and run off. Rescues are tallied at mission end.
// props: drop (pickup spec, default 'random'), mode: 'tied' | 'wander' (already loose, touch to rescue)

import { sprites } from '../engine/sprites';
import { audio } from '../engine/audio';
import { rectsOverlap } from '../engine/math';
import { drawHuman, LEG_FRAMES, type HumanoidStyle } from '../art/humanoid';
import { Actor } from './entity';
import { Z, type Damage } from './constants';
import { dropPickup } from './pickup';
import { registerEntity } from './registry';
import type { Player } from './player';

export const HOSTAGE_STYLE: HumanoidStyle = {
  skin: '#f0c098',
  hair: '#6a4a2a',
  hairStyle: 'bald',
  beard: '#7a5232',
  shirt: '#e8782a',
  pants: '#d8682a',
  boots: '#4a3424',
  belt: '#5a3a1a',
  headgear: 'none',
  sleeves: 'short',
};

export const HF = { TIED: 0, HOP: 2, WALK: 3, GIVE: 7, SALUTE: 8, RUN: 9, COUNT: 13 } as const;

sprites.fallback({
  name: 'hostage',
  w: 44,
  h: 46,
  ox: 22,
  oy: 43,
  frames: HF.COUNT,
  draw: (p, f) => {
    const OX = 22;
    const OY = 43;
    const st = HOSTAGE_STYLE;
    if (f < HF.HOP) {
      const sway = f === 0 ? 0 : 1;
      drawHuman(p, OX, OY, { hip: [0, -5], footB: [5, 0], footF: [7, 0], lean: -1 + sway, gun: 'none', handF: [-5, 8], handB: [-6, 7], expr: f ? 'shout' : 'normal', torso: 9 }, st);
      // Rope coils.
      for (let i = 0; i < 3; i++) p.rect(OX - 5 + sway, OY - 13 + i * 2.5, 10, 1, '#c8a050');
      p.px(OX - 6 + sway, OY - 9, '#a07830');
      // Post behind.
    } else if (f === HF.HOP) {
      drawHuman(p, OX, OY, { hip: [0, -14], footB: [-3, -3], footF: [3, -2], gun: 'none', handF: [3, -10], handB: [-3, -10], expr: 'happy' }, st);
    } else if (f < HF.GIVE) {
      const L = LEG_FRAMES[1 + (f - HF.WALK) * 2];
      drawHuman(p, OX, OY, { hip: L.hip, footB: L.footB, footF: L.footF, lean: 0.5, gun: 'none', handF: [2, 8], handB: [-2, 8], expr: 'happy' }, st);
    } else if (f === HF.GIVE) {
      drawHuman(p, OX, OY, { hip: [0, -13], footB: [-2.5, 0], footF: [2.5, 0], gun: 'none', handF: [8, 2], handB: [-1, 8], expr: 'happy' }, st);
    } else if (f === HF.SALUTE) {
      drawHuman(p, OX, OY, { hip: [0, -13], footB: [-2, 0], footF: [2, 0], gun: 'none', handF: [4, -8], handB: [-1, 9], expr: 'normal' }, st);
    } else {
      const L = LEG_FRAMES[1 + (f - HF.RUN) * 2];
      drawHuman(p, OX, OY, { hip: L.hip, footB: L.footB, footF: L.footF, lean: 2, gun: 'none', handF: [5, 4], handB: [-4, 5], expr: 'shout' }, st);
    }
  },
});

sprites.fallback({
  name: 'hostage_post',
  w: 6,
  h: 22,
  draw: (p) => {
    p.rect(1, 0, 4, 22, '#6a4a2a');
    p.rect(1, 0, 1, 22, '#8a6a3a');
    p.rect(0, 0, 6, 2, '#4a3018');
  },
});

export class Hostage extends Actor {
  mode: 'tied' | 'freed' | 'walk' | 'give' | 'salute' | 'run' = 'tied';
  modeTime = 0;
  rescuer: Player | null = null;
  given = false;
  wander: boolean;

  constructor(props: Record<string, any> = {}) {
    super();
    this.team = 'neutral';
    this.hittable = true;
    this.w = 12;
    this.h = 18;
    this.z = Z.HOSTAGE;
    this.wander = props.mode === 'wander';
    if (this.wander) {
      this.mode = 'walk';
      this.hittable = false;
      this.h = 26;
    }
  }

  override damage(d: Damage): boolean {
    if (this.mode !== 'tied') return false;
    const p = this.world.ownerPlayer(d.owner);
    this.free(p);
    return true;
  }

  free(by: Player | null): void {
    if (this.mode !== 'tied' && !this.wander) return;
    this.wander = false;
    this.mode = 'freed';
    this.modeTime = 0;
    this.hittable = false;
    this.h = 26;
    this.world.invalidateTargets();
    this.rescuer = by ?? this.world.players.find((p) => p.isActive) ?? null;
    this.jump(170);
    this.world.stats.rescues++;
    if (this.rescuer) {
      this.rescuer.profile.rescues++;
      this.rescuer.profile.missionRescues++;
    }
    this.world.addScore(this.rescuer, 100);
    this.world.sfx('rescue', this.x);
    audio.say('thank you!', { pitch: 1.3, rate: 1.1 });
    this.world.emit({ type: 'hostageRescued', entity: this, by: this.rescuer });
  }

  override update(dt: number): void {
    this.modeTime += dt;
    switch (this.mode) {
      case 'tied':
        this.vx = 0;
        for (const p of this.world.players) {
          if (p.state === 'play' && rectsOverlap(this.box, p.box)) {
            this.free(p);
            break;
          }
        }
        break;
      case 'freed':
        this.vx = 0;
        if (this.onGround && this.modeTime > 0.3) {
          this.mode = 'walk';
          this.modeTime = 0;
        }
        break;
      case 'walk': {
        if (this.wander) {
          // Wandering hostage paces until touched.
          this.vx = Math.sin(this.age * 0.8) > 0 ? 18 : -18;
          this.facing = this.vx > 0 ? 1 : -1;
          for (const p of this.world.players) {
            if (p.state === 'play' && rectsOverlap(this.box, p.box)) {
              this.free(p);
              break;
            }
          }
          break;
        }
        const r = this.rescuer;
        if (r) this.facing = r.x < this.x ? -1 : 1;
        this.vx = this.facing * 30;
        if (this.modeTime > 0.6 || (r && Math.abs(r.x - this.x) < 16)) {
          this.mode = 'give';
          this.modeTime = 0;
          this.vx = 0;
        }
        break;
      }
      case 'give':
        this.vx = 0;
        if (!this.given && this.modeTime > 0.2) {
          this.given = true;
          dropPickup(this.world, this.x + this.facing * 10, this.y - 14, String(this.props.drop ?? 'random'), this.facing * 30);
        }
        if (this.modeTime > 0.5) {
          this.mode = 'salute';
          this.modeTime = 0;
        }
        break;
      case 'salute':
        this.vx = 0;
        if (this.modeTime > 0.6) {
          this.mode = 'run';
          this.modeTime = 0;
          this.facing = -1;
        }
        break;
      case 'run':
        this.vx = -110;
        this.facing = -1;
        if (!this.onScreen(24)) this.remove();
        break;
    }
    this.moveAndCollide(dt);
  }

  override render(g: CanvasRenderingContext2D): void {
    const s = sprites.get('hostage');
    let f: number = HF.TIED;
    switch (this.mode) {
      case 'tied':
        f = HF.TIED + (Math.floor(this.age * 3) % 2);
        sprites.get('hostage_post').draw(g, this.x - 5, this.y, 0);
        break;
      case 'freed':
        f = HF.HOP;
        break;
      case 'walk':
        f = HF.WALK + (Math.floor(this.age * 8) % 4);
        break;
      case 'give':
        f = HF.GIVE;
        break;
      case 'salute':
        f = HF.SALUTE;
        break;
      case 'run':
        f = HF.RUN + (Math.floor(this.age * 14) % 4);
        break;
    }
    s.draw(g, this.x, this.y, f, { flip: this.facing < 0 });
  }
}

registerEntity('hostage', 'hostage', (_w, s) => new Hostage(s.props ?? {}), 'Tied hostage. props.drop = pickup spec; props.mode = "wander" for a loose one');
