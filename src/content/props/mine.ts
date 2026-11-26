// Proximity landmine: a half-buried pressure mine with a blinking red lamp. Anything heavy that steps
// on it - a player, a vehicle or an enemy soldier - arms it: it beeps and blinks frantically for a
// moment (time to jump clear!), pops up and explodes, hurting everyone around. Shoot it from a safe
// distance to set it off early (the kills count for you).
// props: delay (arming time, default 0.45 s)

import { sprites } from '../../engine/sprites';
import { rectsOverlap } from '../../engine/math';
import { registerEntity } from '../../game/registry';
import { isfx } from '../../game/pickup';
import { Actor, type Entity } from '../../game/entity';
import { Z, type Damage } from '../../game/constants';
import { Prop } from './common';
import { ramp, shaded } from '../vehicles/art';

/** 0 = lamp off, 1 = lamp on, 2 = popped up (armed, about to blow). */
sprites.define({
  name: 'mine',
  w: 14,
  h: 7,
  frames: 3,
  draw: (p, f) => {
    const up = f === 2 ? 2 : 0;
    // Dome + pressure plate.
    shaded(p, (m) => m.ellipse(7, 4.5 - up, 5.5, 3, '#fff'), ramp('#5a6438', 0.3, -0.3));
    shaded(p, (m) => m.rect(4.5, 1 - up, 5, 1.6, '#fff'), ramp('#8a8a6a', 0.3, -0.3));
    p.rect(6, 3 - up, 2, 1.6, f === 0 ? '#5a1a14' : '#ff3a2a');
    if (f > 0) p.px(6, 3 - up, '#ffc0a0');
    // Dirt mound half-burying it.
    p.poly([0, 7, 2, 4.6, 5, 5.6, 9, 5.6, 12, 4.6, 14, 7], '#8a6a44');
    p.hline(2, 11, 5, '#a8865a');
    p.px(4, 6, '#6a4e30');
    p.px(10, 6, '#6a4e30');
  },
});

export class Mine extends Prop {
  /** Seconds until it blows once armed (-1 = not armed). */
  fuse = -1;
  private delay: number;
  private blinkT = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.w = 12;
    this.h = 5;
    this.hp = this.maxHp = 1;
    this.z = Z.PICKUP - 1;
    this.delay = typeof props.delay === 'number' ? props.delay : 0.45;
  }

  get armed(): boolean {
    return this.fuse >= 0;
  }

  /** Something heavy standing on the plate? */
  private stepper(): Entity | null {
    const trig = { x: this.x - 7, y: this.y - 10, w: 14, h: 12 };
    for (const p of this.world.players) {
      if (p.state === 'play' && p.onGround && rectsOverlap(trig, p.box) && Math.abs(p.bottom - this.y) < 7) return p;
      const v = p.vehicle;
      if (p.state === 'vehicle' && v && v.onGround && !v.flying && rectsOverlap(trig, v.box) && Math.abs(v.bottom - this.y) < 7) return v;
    }
    for (const e of this.world.targets('player')) {
      if (e.team !== 'enemy' || e.dead || !(e instanceof Actor) || !e.onGround) continue;
      if (rectsOverlap(trig, e.box) && Math.abs(e.bottom - this.y) < 7) return e;
    }
    return null;
  }

  arm(): void {
    if (this.armed) return;
    this.fuse = this.delay;
    isfx(this.world, 'mine_beep', this.x);
  }

  destroyProp(_d: Damage): void {
    // Shot: blow right away.
    this.explode();
  }

  override update(dt: number): void {
    this.moveAndCollide(dt);
    if (this.dead) return;
    this.blinkT += dt;
    if (!this.armed) {
      if (this.stepper()) this.arm();
      return;
    }
    const before = this.fuse;
    this.fuse -= dt;
    // Second beep halfway through the countdown.
    if (before > this.delay / 2 && this.fuse <= this.delay / 2) isfx(this.world, 'mine_beep', this.x, { pitch: 1.3 });
    if (this.fuse <= 0) this.explode();
  }

  explode(): void {
    if (this.dead) return;
    this.hittable = false;
    const w = this.world;
    w.explode(this.x, this.y - 4, {
      radius: 26,
      damage: 10,
      team: 'player',
      owner: this.lastHitter,
      hitAll: true,
      exclude: this,
      size: 'medium',
      shake: 3,
      debris: ['#8a6a44', '#6a4e30', '#5a6438', '#a8865a'],
    });
    w.particles.dust(this.x, this.y, 6, '#a8865a');
    this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    let f = 0;
    if (this.armed) f = Math.floor(this.fuse * 16) % 2 ? 2 : 1;
    else {
      // Slow blink; faster when a player wanders close.
      let near = false;
      for (const p of this.world.players) if (p.isActive && Math.abs(p.x - this.x) < 60) near = true;
      const period = near ? 0.5 : 1.2;
      f = this.blinkT % period < 0.12 ? 1 : 0;
    }
    sprites.get('mine').draw(g, this.x, this.y, f, { flash: this.flash > 0 });
  }
}

registerEntity('mine', 'hazard', (_w, s) => new Mine(s.props ?? {}), 'Half-buried proximity mine: arms when a player, vehicle or enemy steps on it, beeps, then explodes (hits everyone). Shootable.');
