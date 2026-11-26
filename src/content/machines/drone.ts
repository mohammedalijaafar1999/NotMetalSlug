// drone — small Legion attack drone (2 HP). Spawn several: they swarm around you in the air,
// keeping apart from each other.
//  kind 'kamikaze' (default): picks a moment, stops, its eye flashes red and it beeps, then dives
//                             in a straight line at where you were and blows up on contact.
//  kind 'zap'               : hovers in the swarm and fires slow electric bolts after its prongs
//                             crackle for a moment.
// props: kind, alt (screen-y of the swarm band, default 76), facing, drop.
// Spawn off-screen to fly in from that side; y omitted = swarm altitude band.

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { VIEW_W } from '../../engine/renderer';
import type { PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import { MC, FlyingMachine, Pen, ZapBolt, cog, msfx, blurLine } from './common';

type Kind = 'kamikaze' | 'zap';

const DW = 18;
const DH = 16;

function drawDrone(p: PixelArt, kind: Kind, f: number): void {
  const d = new Pen(p);
  const alert = f >= 2;
  const k = f % 2;
  // Rotor arms + rotors (blade alternates long/short).
  d.rect(2, 3, 14, 1, MC.steelD);
  d.rect(8, 3, 2, 3, MC.steelD);
  for (const rx of [3, 15]) {
    d.rect(rx - 1, 2, 2, 2, MC.steel);
    if (k === 0) d.rect(rx - 3, 1, 6, 1, MC.steelD);
    else d.rect(rx - 1, 1, 2, 1, MC.steelD);
  }
  // Body: armored sphere, lit top-left.
  d.circle(9, 9.5, 5.5, MC.steelD);
  d.circle(8.6, 9, 4.8, MC.steel);
  d.circle(7.6, 8, 2.6, MC.steelL);
  d.px(6, 6, MC.steelLL);
  // Brass equator band with a tiny cog.
  d.rect(4, 10, 10, 1, MC.brassD);
  d.rect(4, 10, 10, 1, MC.brass);
  cog(d, 6, 12, 1.2);
  // Big camera eye at the front.
  d.circle(12.5, 9, 2.6, MC.black);
  d.circle(12.5, 9, 1.8, alert ? (k ? '#ff2a10' : '#ffd040') : MC.redD);
  d.circle(12.5, 9, 0.9, alert ? '#ffffff' : MC.red);
  d.px(12, 8, '#ffb0a0');
  if (kind === 'kamikaze') {
    // Warhead belly with hazard stripes.
    d.poly([5, 13, 13, 13, 11, 16, 7, 16], MC.rust);
    d.rect(7, 14, 1, 2, MC.black);
    d.rect(10, 14, 1, 2, MC.black);
    d.px(9, 16, MC.rustL);
  } else {
    // Zapper prongs (spark when charging).
    d.line(11, 13, 14, 15, MC.steelL);
    d.line(8, 14, 9, 16, MC.steelL);
    if (alert) {
      d.px(15, 15, '#d8e8ff');
      d.px(9, 15, '#d8e8ff');
      d.px(14, 14, '#8ab0ff');
    }
  }
}

for (const kind of ['kamikaze', 'zap'] as Kind[]) {
  sprites.define({
    name: `mach_drone_${kind}`,
    w: DW,
    h: DH,
    ox: 9,
    oy: 9,
    frames: 4,
    draw: (p, f) => drawDrone(p, kind, f),
  });
}

export class Drone extends FlyingMachine {
  kind: Kind;
  orbit: number;
  side: 1 | -1 = 1;
  attackT = 0;
  diveVx = 0;
  diveVy = 0;
  buzzT = 0;

  constructor(props: Record<string, any> = {}, autoAlt = true) {
    super(autoAlt, 76, props);
    this.kind = props.kind === 'zap' ? 'zap' : 'kamikaze';
    this.anchor = 'center';
    this.w = 12;
    this.h = 11;
    this.hp = this.maxHp = 2;
    this.scoreValue = 300;
    this.boom = 'small';
    this.blast = { radius: 14, damage: 2 };
    this.debris = [MC.steel, MC.steelD, MC.steelL, MC.brass, MC.red];
    this.smokeAt = [[0, 0]];
    this.wreckTime = 0;
    this.orbit = 0;
  }

  override spawned(): void {
    super.spawned();
    const c = this.world.camera;
    this.orbit = (this.id * 2.39996) % (Math.PI * 2);
    const onScreenX = this.x > c.x - 8 && this.x < c.x + VIEW_W + 8;
    if (this.autoAlt) this.y = onScreenX ? c.y - 10 : this.cruiseY;
    this.side = this.world.rng.chance(0.5) ? 1 : -1;
    this.attackT = this.world.rng.range(1.6, 3.2) * this.world.difficulty.enemyFireDelay;
    this.setState('swarm');
  }

  think(dt: number): void {
    const t = this.target();
    const c = this.world.camera;
    this.buzzT -= dt;
    if (this.buzzT <= 0 && this.onScreen(10)) {
      this.buzzT = 0.6 + fxRng.range(0, 0.4);
      msfx(this, 'drone_buzz', { vol: 0.22, pitch: fxRng.range(0.9, 1.2) });
    }
    switch (this.state) {
      case 'swarm': {
        this.orbit += dt * 2.3;
        const ax = t ? t.x + this.side * 36 : c.x + VIEW_W * 0.6;
        const ay = this.cruiseY + Math.sin(this.age * 1.3 + this.id) * 6;
        let gx = ax + Math.cos(this.orbit) * 26;
        const gy = ay + Math.sin(this.orbit) * 14;
        gx = Math.max(c.x + 14, Math.min(c.x + VIEW_W - 14, gx));
        let tvx = (gx - this.x) * 2.2;
        let tvy = (gy - this.y) * 2.2;
        // Keep apart from other drones.
        for (const o of this.world.query((e) => e !== this && e instanceof Drone && !e.dying)) {
          const dx = this.x - o.x;
          const dy = this.y - o.y;
          const dd = Math.hypot(dx, dy);
          if (dd < 16 && dd > 0.01) {
            tvx += (dx / dd) * 90;
            tvy += (dy / dd) * 90;
          }
        }
        const max = 110;
        const sp = Math.hypot(tvx, tvy);
        if (sp > max) {
          tvx *= max / sp;
          tvy *= max / sp;
        }
        this.vx += (tvx - this.vx) * Math.min(1, dt * 5);
        this.vy += (tvy - this.vy) * Math.min(1, dt * 5);
        if (t) this.facing = t.x < this.x ? -1 : 1;
        this.attackT -= dt;
        if (this.attackT <= 0 && t && this.canAttack(-4)) {
          this.setState(this.kind === 'kamikaze' ? 'lock' : 'charge');
          if (this.kind === 'kamikaze') msfx(this, 'mine_beep', { vol: 0.6 });
        }
        break;
      }
      case 'lock': {
        // Telegraph: stop, shake, eye flashes; aim at where the target is now.
        this.vx *= Math.pow(0.02, dt);
        this.vy *= Math.pow(0.02, dt);
        if (t) {
          this.facing = t.x < this.x ? -1 : 1;
          const dx = t.cx - this.x;
          const dy = t.cy - this.y;
          const dd = Math.max(1, Math.hypot(dx, dy));
          this.diveVx = dx / dd;
          this.diveVy = dy / dd;
        }
        if (this.stateTime > 0.6) {
          this.setState('dive');
          msfx(this, 'drone_buzz', { vol: 0.5, pitch: 1.4 });
        }
        break;
      }
      case 'dive': {
        const sp = Math.min(this.shotSpeed(185), 70 + this.stateTime * 420);
        this.vx = this.diveVx * sp;
        this.vy = this.diveVy * sp;
        if (fxRng.chance(dt * 30)) this.world.particles.add({ kind: 'smoke', x: this.x, y: this.y, vx: 0, vy: -5, life: 0.3, color: '#8a8690', color2: '#5a5660', size: 1, size2: 2.5 });
        if (this.touchingTarget(this.box)) {
          this.selfDestruct();
          return;
        }
        const T = this.world.terrain;
        if (T.isSolidPoint(this.x, this.y + 4) || this.stateTime > 2.6 || !this.onScreen(30)) {
          this.selfDestruct();
          return;
        }
        break;
      }
      case 'charge':
        this.vx *= Math.pow(0.05, dt);
        this.vy *= Math.pow(0.05, dt);
        if (t) this.facing = t.x < this.x ? -1 : 1;
        if (fxRng.chance(dt * 20)) this.world.particles.sparks(this.x + this.facing * 4, this.y + 6, 1, '#b8d0ff', 60);
        if (this.stateTime > 0.5) {
          if (t && this.canAttack()) {
            const a = Math.atan2(t.cy - (this.y + 5), t.cx - this.x);
            this.world.add(new ZapBolt(this, this.x + this.facing * 4, this.y + 5, a, this.shotSpeed(125)));
            msfx(this, 'robot_shot', { vol: 0.5 });
          }
          this.attackT = this.fireDelay(2.2);
          this.setState('swarm');
        }
        break;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /** Kamikaze impact: explode as an attack (hurts players), then vanish (no score). */
  private selfDestruct(): void {
    this.world.explode(this.x, this.y, { radius: 16, damage: 3, team: 'enemy', owner: this, size: 'small', shake: 2, sfx: 'explosion_small', debris: this.debris });
    this.dying = true;
    this.hittable = false;
    this.blocksProgress = false;
    this.world.invalidateTargets();
    this.remove();
  }

  override explodeNow(): void {
    super.explodeNow();
    this.deathDuration = this.deathTime + 0.05;
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.wrecked || this.dead) return;
    const alert = this.state === 'lock' || this.state === 'dive' || this.state === 'charge';
    const spin = Math.floor(this.age * 30) % 2;
    const f = (alert && Math.floor(this.stateTime * 16) % 2 === 0 ? 2 : 0) + spin;
    const shake = this.state === 'lock' ? (Math.floor(this.stateTime * 40) % 2 ? 1 : -1) : 0;
    const flip = this.facing < 0;
    // Rotor blur.
    for (const rx of [-6, 6]) blurLine(g, this.x + rx - 3, this.y - 8, this.x + rx + 3, this.y - 8, '#e4e8f0', 0.5);
    sprites.get(`mach_drone_${this.kind}`).draw(g, this.x + shake, this.y, f, { flip, flash: this.flash > 0 });
  }
}

registerEntity(
  'drone',
  'enemy',
  (_w, s) => new Drone(s.props, s.y === undefined),
  "Small flying drone (2 HP), swarms (spawn several). props.kind 'kamikaze' (default: telegraphed lock-on then straight dive, explodes on contact) | 'zap' (slow electric bolts after a crackle); props.alt (swarm screen-y, default 76); props.drop",
);
