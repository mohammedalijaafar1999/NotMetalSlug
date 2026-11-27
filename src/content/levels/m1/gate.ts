// m1_gate - the Legion stockade gate at the right edge of the GRINDER's arena (cosmetic, category
// misc: not hittable, not solid). The doors shudder and shed dust as the war-dozer rumbles up behind
// them, then burst apart when its blade hits them: planks, iron bands and the brass cog plaque fly
// across the yard. The broken posts stay behind the boss. Without a boss it just stands there.
// props: none (place it at bossL + ~352, standing on the ground).

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { shade } from '../../../engine/pixelart';
import { Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { registerEntity } from '../../../game/registry';
import { FlyingPart } from '../../bosses/common/kit';
import { Pen, cog, MC } from '../../machines/common';
import { PH } from '../../themes/m1/layout';

const GW = 68;
const GH = 100;

function log(p: import('../../../engine/pixelart').PixelArt, x: number, top: number, bot: number, w: number, base: string): void {
  p.rect(x, top, w, bot - top, base);
  p.rect(x, top, 1, bot - top, shade(base, 0.25));
  p.rect(x + w - 1, top, 1, bot - top, shade(base, -0.3));
  p.tri(x, top, x + w / 2, top - 6, x + w, top, base);
  p.tri(x, top, x + w / 2, top - 6, x + w / 2 - 1, top, shade(base, 0.25));
  for (let y = top + 6; y < bot - 4; y += 13) p.px(x + 2 + ((y >> 2) % 2), y, shade(base, -0.25));
}

function doorPlanks(p: import('../../../engine/pixelart').PixelArt, x0: number, x1: number, top: number, bot: number, broken: boolean): void {
  for (let x = x0; x < x1; x += 5) {
    const t = broken ? top + 20 + ((x * 7) % 23) : top;
    const c = shade('#8a6a44', (((x * 13) % 7) - 3) * 0.025);
    p.rect(x, t, 5, bot - t, c);
    p.rect(x, t, 1, bot - t, shade(c, 0.2));
    p.rect(x + 4, t, 1, bot - t, shade(c, -0.32));
    if (broken) {
      p.px(x + 1, t - 1, c);
      p.px(x + 3, t - 2, shade(c, 0.2));
    }
  }
}

sprites.define({
  name: 'm1_gate',
  w: GW,
  h: GH,
  frames: 2,
  draw: (p, f) => {
    const bot = GH;
    if (f === 0) {
      // Doors: vertical planks, iron bands with rivets, Z braces.
      doorPlanks(p, 8, 60, 20, bot, false);
      for (const y of [34, 76]) {
        p.rect(8, y, 52, 4, MC.steelD);
        p.rect(8, y, 52, 1, MC.steelL);
        for (let x = 10; x < 60; x += 6) p.px(x, y + 2, MC.steelLL);
      }
      for (const [xa, xb] of [
        [10, 32],
        [36, 58],
      ]) {
        p.line(xa + 1, 72, xb - 1, 40, '#5a4228');
        p.line(xa + 2, 72, xb, 40, '#9a7650');
      }
      p.rect(33, 20, 2, bot - 20, '#3a2a18'); // seam between the doors
      // Ring handles.
      p.ring(29, 58, 2, MC.steelLL);
      p.ring(39, 58, 2, MC.steelLL);
    } else {
      // Broken: splintered stumps of the doors at the hinges.
      doorPlanks(p, 8, 18, 40, bot, true);
      doorPlanks(p, 52, 60, 46, bot, true);
      p.rect(8, 76, 10, 4, MC.steelD);
    }
    // Posts.
    log(p, 0, 8, bot, 9, '#7a5a3a');
    log(p, GW - 9, f === 0 ? 8 : 14, bot, 9, '#6e5034');
    // Top beam with the Legion plaque (intact) or a snapped beam (broken).
    if (f === 0) {
      p.rect(2, 13, GW - 4, 7, '#6a4e30');
      p.rect(2, 13, GW - 4, 1, '#9a7650');
      p.rect(2, 19, GW - 4, 1, '#3e2c18');
      p.rect(26, 4, 16, 16, MC.steelD);
      p.rect(27, 5, 14, 14, MC.steel);
      p.rect(27, 5, 14, 1, MC.steelL);
      cog(new Pen(p), 34, 12, 4.5, MC.brass);
      // Red pennants on the posts.
      p.poly([4, 0, 4, 10, 1, 7], MC.red);
      p.poly([GW - 5, 0, GW - 5, 10, GW - 2, 7], MC.red);
    } else {
      p.poly([2, 13, 24, 13, 30, 17, 22, 20, 2, 20], '#6a4e30');
      p.rect(2, 13, 22, 1, '#9a7650');
      p.poly([GW - 2, 16, GW - 16, 18, GW - 22, 26, GW - 12, 26, GW - 2, 22], '#6a4e30');
    }
    // Rope lashings on the posts.
    for (const x of [1, GW - 8]) {
      p.rect(x, 26, 7, 2, PH.rope);
      p.rect(x, 64, 7, 2, PH.rope);
    }
  },
});

sprites.define({
  name: 'm1_gate_debris',
  w: 20,
  h: 22,
  oy: 11,
  frames: 4,
  draw: (p, f) => {
    if (f === 0) {
      p.rect(8, 0, 5, 22, '#8a6a44');
      p.rect(8, 0, 1, 22, '#a8865a');
      p.rect(12, 0, 1, 22, '#5a4228');
      p.rect(8, 8, 5, 3, MC.steelD);
    } else if (f === 1) {
      p.rect(8, 6, 5, 12, '#7c5e3c');
      p.rect(8, 6, 1, 12, '#a8865a');
      p.px(9, 5, '#7c5e3c');
      p.px(11, 4, '#7c5e3c');
    } else if (f === 2) {
      p.rect(2, 9, 16, 3, MC.steelD);
      p.rect(2, 9, 16, 1, MC.steelL);
      p.px(5, 10, MC.steelLL);
      p.px(12, 10, MC.steelLL);
    } else {
      p.rect(3, 4, 14, 14, MC.steel);
      p.rect(3, 4, 14, 1, MC.steelL);
      cog(new Pen(p), 10, 11, 4.5, MC.brass);
    }
  },
});

/** Seconds of shuddering before the doors give way (also the minimum warning). */
const SHAKE_RANGE = 70;

export class StockadeGate extends Entity {
  broken = false;
  shake = 0;
  private dustT = 0;

  constructor() {
    super();
    this.w = GW - 4;
    this.h = GH;
    this.team = 'neutral';
    this.hittable = false;
    this.persistent = true;
    this.z = Z.BOSS + 1;
  }

  override update(dt: number): void {
    if (this.broken) {
      this.shake = Math.max(0, this.shake - dt * 3);
      return;
    }
    const boss = this.world.boss;
    if (!boss || boss.dead) return;
    // The blade end of the boss (it drives in from the right, facing left).
    const front = boss.facing < 0 ? boss.left : boss.right;
    const d = boss.facing < 0 ? front - this.right : this.left - front;
    if (d < SHAKE_RANGE) {
      this.shake = Math.min(1, this.shake + dt * 4);
      this.dustT -= dt;
      if (this.dustT <= 0) {
        this.dustT = 0.12;
        this.world.particles.dust(this.x + fxRng.range(-26, 26), this.y - this.h + fxRng.range(2, 20), 2, '#b89c70');
      }
    }
    if (d < -4) this.burst(boss.facing < 0 ? -1 : 1);
  }

  private burst(dir: number): void {
    this.broken = true;
    this.shake = 1;
    this.z = Z.BACK_PROP;
    const w = this.world;
    const y0 = this.y - this.h * 0.55;
    for (let i = 0; i < 9; i++) {
      const frame = i < 4 ? 0 : i < 7 ? 1 : i < 8 ? 2 : 3;
      w.add(
        new FlyingPart('m1_gate_debris', frame, this.x + fxRng.range(-22, 22), y0 + fxRng.range(-30, 30), dir * fxRng.range(70, 210), -fxRng.range(140, 300), {
          life: fxRng.range(1.6, 2.6),
          groundY: this.y,
          smoke: false,
          vr: fxRng.range(-12, 12),
        }),
      );
    }
    w.particles.debris(this.x, y0, 14, ['#8a6a44', '#6a4e30', '#a8865a', MC.steelD], 220);
    w.particles.smokePuffs(this.x, this.y - 20, 6, 22, '#b8a888', '#8a7a62');
    w.particles.dust(this.x, this.y, 10, '#b89c70');
    w.shake(4, 0.35);
    w.sfx('crate_break', this.x, { vol: 1 });
    w.sfx('explosion_small', this.x, { vol: 0.8 });
  }

  override render(g: CanvasRenderingContext2D): void {
    const s = this.broken ? 0 : this.shake;
    const jx = s > 0 ? Math.round(Math.sin(this.age * 60) * s * 1.5) : 0;
    sprites.get('m1_gate').draw(g, this.x + jx, this.y, this.broken ? 1 : 0);
  }
}

registerEntity(
  'm1_gate',
  'misc',
  () => new StockadeGate(),
  'Mission 1 stockade gate (cosmetic): shudders as the GRINDER drives up behind it, then bursts into flying planks when the blade hits it. Not hittable, not solid. Place at bossL + ~352 on the ground.',
);
