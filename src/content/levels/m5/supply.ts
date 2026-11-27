// m5_supply - allied supply drop for the sky mission (STORMFRONT). Pickups normally fall with
// gravity, which in a bottomless sky means "gone"; this one drifts down under a small teal
// parachute (allied colours, unlike the Legion's red-striped canopies) with a blinking green
// beacon, and is collected by touching it with the gyro (or on foot). It settles on a deck if it
// meets one. Spawned without y it starts just above the screen (place x inside the view with a
// trigger, like a paratrooper).
// props: item (pickup spec: fuel, bomb, life, points:N...; default 'fuel'), drift (px/s, default -6),
//        fall (px/s, default 15).

import { sprites } from '../../../engine/sprites';
import { fxRng } from '../../../engine/rng';
import { rectsOverlap } from '../../../engine/math';
import { Actor } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { makePickup, type Pickup } from '../../../game/pickup';
import { registerEntity } from '../../../game/registry';
import type { Player } from '../../../game/player';

const TEAL = '#3f9a84';
const TEAL_L = '#7fd0b0';
const TEAL_D = '#2a6a5a';
const CREAM = '#efe6c8';

/** Supply parachute: 0-2 sway frames (canopy tilt), 3 = collapsed heap. Origin bottom centre. */
sprites.define({
  name: 'm5_supply_chute',
  w: 28,
  h: 15,
  frames: 4,
  draw: (p, f) => {
    if (f === 3) {
      p.ellipse(14, 12.5, 9, 2.5, TEAL_D);
      p.ellipse(12, 11.5, 6, 2, TEAL);
      p.ellipse(18, 12, 3, 1.5, CREAM);
      return;
    }
    const tilt = [-1, 0, 1][f];
    // Dome with alternating gores.
    for (let x = 0; x < 28; x++) {
      const u = (x - 13.5) / 13.5;
      const top = Math.round(3 + (1 - Math.sqrt(Math.max(0, 1 - u * u))) * 8 + tilt * u * 1.5);
      const bot = Math.round(10 + Math.abs(u) * 2 + tilt * u * 1.5);
      const gore = Math.floor((x + 1) / 5) % 2 === 0;
      for (let y = top; y <= bot; y++) {
        let c = gore ? TEAL : CREAM;
        if (y === top) c = gore ? TEAL_L : '#ffffff';
        else if (y >= bot - 1) c = gore ? TEAL_D : '#c8bea0';
        p.px(x, y, c);
      }
    }
    p.px(13, 3, '#ffffff');
  },
});

export class SkySupply extends Actor {
  readonly item: Pickup | null;
  private startAbove: boolean;
  private drift: number;
  private fall: number;
  private landedT = -1;
  private sway = 0;

  constructor(world: import('../../../game/world').World, props: Record<string, any> = {}, yGiven = false) {
    super();
    this.team = 'neutral';
    this.hittable = false;
    this.z = Z.PICKUP;
    this.w = 16;
    this.h = 14;
    this.item = makePickup(world, String(props.item ?? 'fuel'));
    this.startAbove = !yGiven;
    this.drift = typeof props.drift === 'number' ? props.drift : -6;
    this.fall = typeof props.fall === 'number' ? props.fall : 15;
    this.gravityScale = 0;
  }

  override spawned(): void {
    if (this.startAbove) this.y = this.world.camera.y - 4;
    this.sway = (this.id * 1.7) % 6;
    this.world.sfx('parachute', this.x, { vol: 0.45, pitch: 1.2 });
  }

  /** The supply crate's sprite (the pickup's own art). */
  get spriteName(): string {
    return this.item?.spriteName ?? 'item_fuel';
  }

  override update(dt: number): void {
    if (!this.item) {
      this.remove();
      return;
    }
    if (!this.onGround) {
      this.vx = this.drift + Math.sin(this.age * 1.4 + this.sway) * 10;
      this.vy = this.fall;
    } else {
      this.vx = 0;
      if (this.landedT < 0) {
        this.landedT = 0;
        this.world.particles.dust(this.x, this.y, 3);
      }
      this.landedT += dt;
    }
    this.moveAndCollide(dt);
    if (this.dead) return;
    // Touch to collect (gyro or player).
    for (const p of this.world.players) {
      if (p.state !== 'play' && p.state !== 'vehicle') continue;
      const target = p.vehicle ?? p;
      if (rectsOverlap(this.collectBox(), target.box)) {
        this.collect(p);
        return;
      }
    }
    // Long gone below the view.
    const c = this.world.camera;
    if (this.top > c.y + 236) this.remove();
  }

  /** Crate + the lower half of the canopy count, so a gyro grazing it still grabs it. */
  collectBox(): { x: number; y: number; w: number; h: number } {
    return { x: this.x - 10, y: this.y - 30, w: 20, h: 30 };
  }

  collect(p: Player): void {
    const pk = this.item!;
    pk.x = this.x;
    pk.y = this.y;
    this.world.add(pk);
    pk.collect(p);
    // A little puff of canopy cloth.
    for (let i = 0; i < 5; i++) {
      this.world.particles.add({ kind: 'debris', x: this.x + fxRng.range(-8, 8), y: this.y - 24, vx: fxRng.range(-40, 40), vy: fxRng.range(-50, -10), life: 0.7, color: fxRng.pick([TEAL, CREAM, TEAL_L]), size: 1, gravity: 160 });
    }
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const s = sprites.get(this.spriteName);
    const top = y - Math.min(13, s.h);
    if (this.landedT < 0) {
      const sw = Math.sin(this.age * 1.4 + this.sway);
      const f = sw < -0.35 ? 0 : sw > 0.35 ? 2 : 1;
      const cy = top - 9;
      // Cords.
      g.fillStyle = '#d8d0b8';
      for (const [cx0, cx1] of [
        [-12, -5],
        [12, 5],
      ]) {
        const n = 9;
        for (let i = 0; i <= n; i++) g.fillRect(Math.round(x + cx0 + ((cx1 - cx0) * i) / n), Math.round(cy - 3 + ((top - cy + 3) * i) / n), 1, 1);
      }
      sprites.get('m5_supply_chute').draw(g, x, cy, f);
    } else if (this.landedT < 0.6) {
      sprites.get('m5_supply_chute').draw(g, x + 6, y, 3);
    }
    s.draw(g, x, y, Math.floor(this.age * 3) % 2 === 0 ? 0 : Math.min(1, s.frameCount - 1));
    // Beacon.
    if (Math.floor(this.age * 3) % 3 === 0) {
      g.fillStyle = '#7aff8a';
      g.fillRect(x - 1, top - 2, 2, 2);
      g.globalAlpha = 0.35;
      g.fillRect(x - 2, top - 3, 4, 4);
      g.globalAlpha = 1;
    }
  }
}

registerEntity(
  'm5_supply',
  'pickup',
  (w, s) => new SkySupply(w, s.props ?? {}, s.y !== undefined),
  'Mission 5 sky supply drop: a pickup (props.item, default fuel) drifting down under an allied teal parachute with a green beacon; touch it with the gyro to collect. y omitted = starts above the screen. props.drift, fall',
);
