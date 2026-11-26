// Autopilot bot used by automated playtests (?autoplay=1) and the debug API.
// Not smart, just persistent: pushes right, shoots constantly, jumps over walls/gaps,
// aims at enemies above, uses bombs on bosses, hops into vehicles and continues when out.

import { input, type ActionMask } from '../engine/input';
import { VIEW_W } from '../engine/renderer';
import type { World } from '../game/world';
import type { Entity, Actor } from '../game/entity';

export class Bot {
  private t = 0;
  private jumpHold = 0;
  private stuck = 0;
  private lastX = 0;
  private bombTimer = 0;
  private turnTimer = 0;
  private frame = 0;
  private zoneDir = 0;

  constructor(public index: number) {}

  update(world: World): void {
    const dt = 1 / 60;
    this.t += dt;
    this.frame++;
    const p = world.players.find((pl) => pl.index === this.index);
    const mask: ActionMask = {};
    if (!p) {
      input.setVirtual(this.index, null);
      return;
    }
    if (p.state === 'out') {
      mask.start = this.frame % 20 < 10;
      input.setVirtual(this.index, mask);
      return;
    }
    const ctrl: Actor = (p.vehicle ?? p) as Actor;
    const cam = world.camera;
    const lvl = world.level;
    let dir = 1;
    // Nearest visible enemy.
    let nearest: Entity | null = null;
    let nd = Infinity;
    for (const e of world.targets('player')) {
      if (e.team !== 'enemy' || !e.onScreen(-4)) continue;
      const d = Math.hypot(e.cx - ctrl.cx, e.cy - ctrl.cy);
      if (d < nd) {
        nd = d;
        nearest = e;
      }
    }
    if (lvl.locked || lvl.bossActive) {
      const center = cam.x + VIEW_W * (lvl.bossActive ? 0.25 : 0.4);
      // Once walking back into the zone, go to its centre: stopping on the edge let the facing taps
      // below push the bot out again, so it spent most of a fight walking back and facing away.
      const tol = this.zoneDir !== 0 ? 4 : 16;
      dir = ctrl.x < center - tol ? 1 : ctrl.x > center + tol ? -1 : 0;
      this.zoneDir = dir;
    } else this.zoneDir = 0;
    const flying = !!(p.vehicle as any)?.flying;
    // Bosses overhead: get under them and shoot up (on foot / ground vehicles).
    const boss = world.boss;
    let aimUp = false;
    if (boss && !boss.dead && lvl.bossActive && !flying) {
      const hb = boss.hurtboxes();
      const tgt = hb.length ? hb.reduce((a, b) => (b.y + b.h > a.y + a.h ? b : a)) : boss.box;
      const tx = tgt.x + tgt.w / 2;
      const ty = tgt.y + tgt.h / 2;
      if (ty < ctrl.cy - 34) {
        dir = ctrl.x < tx - 18 ? 1 : ctrl.x > tx + 18 ? -1 : 0;
        aimUp = Math.abs(tx - ctrl.x) < 80;
      }
    }
    // Turn to face enemies behind us occasionally.
    if (nearest && nearest.cx < ctrl.cx - 10) {
      this.turnTimer += dt;
      if (this.turnTimer > 0.4) dir = -1;
      if (this.turnTimer > 1.0) this.turnTimer = 0;
    } else this.turnTimer = 0;
    if (dir > 0) mask.right = true;
    if (dir < 0) mask.left = true;
    if (dir === 0 && nearest) {
      // Tap toward the nearest enemy only when facing away (tapping while facing it just creeps forward).
      const right = nearest.cx > ctrl.cx;
      if (right ? ctrl.facing < 0 : ctrl.facing > 0) {
        if (right) mask.right = this.frame % 30 < 2;
        else mask.left = this.frame % 30 < 2;
      }
    }
    // Aim up at enemies overhead.
    if (!flying && (aimUp || (nearest && nearest.cy < ctrl.cy - 40 && Math.abs(nearest.cx - ctrl.cx) < 70))) mask.up = true;
    // Crouch-shoot low targets (mines, ground turrets, crawling things) that pass under the standing
    // muzzle line (~22 px above the feet); only on foot, so DOWN never means "eject" or "drop".
    if (!p.vehicle && !mask.up && p.onGround && nearest && Math.abs(nearest.cx - p.x) < 220) {
      const hb = nearest.hurtboxes();
      const boxes = hb.length ? hb : [nearest.box];
      const top = Math.min(...boxes.map((b) => b.y));
      const bottom = Math.max(...boxes.map((b) => b.y + b.h));
      if (top > p.y - 21 && bottom > p.y - 16) mask.down = true;
    }
    // Flying vehicles: keep left-ish on screen and line up vertically with the nearest enemy.
    if (flying) {
      const want = cam.x + VIEW_W * 0.28;
      mask.right = ctrl.x < want - 12;
      mask.left = ctrl.x > want + 12;
      const ty = nearest ? nearest.cy : cam.y + 100;
      const dy = ty - ctrl.cy;
      mask.up = dy < -8 && ctrl.top > cam.y + 20;
      mask.down = dy > 8 && ctrl.bottom < cam.y + 200;
    }
    // Fire (tap pattern works for semi-auto and auto weapons).
    mask.fire = this.frame % 6 < 3;
    // Stuck / wall / gap handling.
    const moving = dir !== 0;
    if (moving && Math.abs(ctrl.x - this.lastX) < 0.3) this.stuck += dt;
    else this.stuck = 0;
    this.lastX = ctrl.x;
    const gapAhead = ctrl.onGround && moving && !ctrl.floorAhead(dir, 14, 60);
    if (!flying && this.jumpHold <= 0 && (ctrl.hitWall !== 0 || this.stuck > 0.25 || gapAhead || (ctrl.onGround && this.frame % 97 === 0))) {
      this.jumpHold = 0.35;
    }
    if (this.jumpHold > 0) {
      this.jumpHold -= dt;
      mask.jump = this.jumpHold > 0.05;
    }
    // Bombs on bosses / crowds.
    this.bombTimer -= dt;
    if (this.bombTimer <= 0 && (lvl.bossActive || (nearest && nd < 90))) {
      mask.bomb = true;
      this.bombTimer = lvl.bossActive ? 1.2 : 2.5;
    }
    // Get into empty vehicles nearby.
    if (!p.vehicle && !lvl.bossActive) {
      for (const e of world.query((x) => (x as any).isVehicle === true && !(x as any).driver)) {
        if (Math.abs(e.x - p.x) < 14) mask.down = true;
        else if (Math.abs(e.x - p.x) < 80 && !lvl.locked) {
          mask.right = e.x > p.x;
          mask.left = e.x < p.x;
        }
      }
    }
    input.setVirtual(this.index, mask);
  }
}
