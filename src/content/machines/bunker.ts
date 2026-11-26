// bunker — fortified Legion pillbox (40 HP, blocks arena progress until destroyed).
//  - MG slit: the slit glows, then a 4-round burst at you (only toward the side it faces).
//  - Troop door: periodically the steel door swings open and a soldier runs out
//    (keeps at most props.maxTroops alive, default 3) until the bunker is destroyed.
//  - Visible damage: cracks spread and chunks fall off as it weakens; destroyed it collapses
//    into a burning heap of rubble.
// props: facing (1|-1: side the slit faces; default toward the player), maxTroops (default 3),
//        spawnEvery (seconds, default 3.5), troop (entity type, default 'rifleman'), drop

import { sprites } from '../../engine/sprites';
import { fxRng } from '../../engine/rng';
import { parseColor, type PixelArt } from '../../engine/pixelart';
import { registerEntity } from '../../game/registry';
import type { Entity } from '../../game/entity';
import { MC, Machine, Pen, plate, rivetRow, cog, charr, sandbag, hash01, msfx, troopType } from './common';
import { RUSTCOAT } from '../../art/soldier';

const W = 66;
const H = 46;
const DOOR_N = 3;
const DMG_N = 3;
const RUBBLE = DOOR_N * DMG_N;
/** MG slit muzzle + door center (canvas coords). */
const SLIT_X = 58;
const SLIT_Y = 22;
const DOOR_X = 28;
/** Drawn behind other machines and infantry. */
const Z_BUNKER = 26;

function crack(d: Pen, pts: number[], c: string): void {
  for (let i = 0; i + 3 < pts.length; i += 2) d.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c);
}

function drawBunker(p: PixelArt, door: number, dmg: number): void {
  const d = new Pen(p);
  // Flag on the roof (rust banner with the Legion cog).
  d.rect(11, 0, 1, 10, MC.steelD);
  d.poly([12, 0, 22, 1, 21, 4, 22, 7, 12, 6], MC.rust);
  d.poly([12, 0, 22, 1, 21.5, 2, 12, 1.5], MC.rustL);
  cog(d, 16.5, 3.5, 1.6);
  // Concrete body.
  d.poly([3, 46, 6, 16, 13, 10, 48, 10, 57, 17, 63, 46], MC.conc);
  // Speckled concrete texture (only on the body).
  const base = parseColor(MC.conc);
  for (let y = 11; y < 46; y++) {
    for (let x = 4; x < 63; x++) {
      if (p.getRaw(x + p.ox, y + p.oy) !== base) continue;
      const n = hash01(x, y, 17);
      if (n < 0.07) d.px(x, y, MC.concD);
      else if (n > 0.95) d.px(x, y, MC.concL);
    }
  }
  // Lit left face + shaded front slope.
  d.poly([6, 16, 13, 10, 15, 11, 9, 17, 6, 44], MC.concL);
  d.poly([48, 10, 57, 17, 63, 46, 60, 46, 54, 18, 47, 12], MC.concD);
  d.line(57, 17, 63, 45, MC.concDD);
  // Roof slab with overhang + rivets.
  plate(d, 9, 7, 42, 4, MC.concD, { hi: 0.35 });
  d.rect(10, 7, 40, 1, MC.concL);
  rivetRow(d, 13, 47, 9, 6, MC.concD);
  // Rust streaks under the slab.
  for (const sx of [17, 34, 44]) {
    d.rect(sx, 11, 1, 4 + (sx % 3), MC.rustD);
    d.px(sx, 11, MC.rust);
  }
  // Stencil number plate.
  plate(d, 38, 24, 8, 5, MC.steel, { hi: 0.3 });
  d.rect(40, 26, 4, 1, MC.brass);
  // MG slit + barrel.
  d.poly([47, 19, 57, 20, 58, 24, 47, 24], MC.black);
  d.rect(47, 19, 10, 1, MC.concDD);
  d.rect(47, 25, 11, 1, MC.concL);
  d.cap(52, 22, 61, 22, 1, MC.steelD);
  d.cap(53, 21.5, 60, 21.5, 0.35, MC.steelL);
  // Steel door.
  const dx0 = DOOR_X - 6;
  const dx1 = DOOR_X + 6;
  d.rect(dx0 - 2, 24, dx1 - dx0 + 4, 22, MC.concDD);
  if (door === 0) {
    plate(d, dx0, 26, dx1 - dx0, 20, MC.steel, { rivets: 4 });
    d.rect(dx1 - 3, 35, 2, 2, MC.brass);
    d.rect(dx0 + 2, 30, dx1 - dx0 - 4, 1, MC.steelD);
  } else {
    d.rect(dx0, 26, dx1 - dx0, 20, '#16121a');
    if (door === 2) {
      // A soldier stepping out of the dark.
      d.circle(DOOR_X + 1, 31, 3, RUSTCOAT.headgearColor!);
      d.px(DOOR_X, 29, MC.oliveLL);
      d.rect(DOOR_X + 2, 32, 2, 2, RUSTCOAT.skin);
      d.rect(DOOR_X - 2, 34, 6, 8, RUSTCOAT.shirt);
      d.rect(DOOR_X - 1, 35, 4, 4, RUSTCOAT.vest!);
    }
    // Door leaf swung open toward the viewer (foreshortened).
    const lw = door === 1 ? 7 : 3;
    plate(d, dx1, 26, lw, 20, MC.steelL, { hi: 0.2 });
    d.rect(dx1 + lw - 1, 35, 1, 2, MC.brass);
  }
  d.rect(dx0 - 2, 24, dx1 - dx0 + 4, 2, MC.steelD);
  // Sandbags around the base.
  sandbag(d, 0, 41, 9, 5);
  sandbag(d, 7, 41, 9, 5, MC.sandD);
  sandbag(d, 2, 37, 9, 4.6);
  sandbag(d, 52, 41, 8, 5, MC.sandD);
  sandbag(d, 58, 41, 8, 5);
  sandbag(d, 55, 37, 9, 4.6);
  sandbag(d, 40, 42, 9, 4.5);
  // Damage: cracks, then exposed rebar + a bitten corner.
  if (dmg >= 1) {
    crack(d, [14, 18, 17, 24, 16, 29, 19, 34], MC.concDD);
    crack(d, [44, 12, 42, 17, 45, 21], MC.concDD);
    crack(d, [35, 31, 38, 36, 36, 40], MC.concDD);
    d.px(15, 22, MC.concL);
  }
  if (dmg >= 2) {
    crack(d, [8, 26, 12, 30, 10, 36, 13, 41], MC.concDD);
    crack(d, [50, 28, 53, 33, 51, 38], MC.concDD);
    // Missing chunk at the top-front corner with rebar sticking out.
    d.poly([44, 10, 50, 10, 55, 15, 52, 17, 47, 15, 45, 13], '#00000000');
    d.line(47, 14, 49, 9, MC.rust);
    d.line(50, 15, 53, 11, MC.rust);
    d.poly([20, 10, 26, 10, 24, 13], '#00000000');
    d.rect(21, 12, 4, 1, MC.concDD);
    // Scorch marks.
    d.ellipse(36, 18, 4, 2.5, '#4a4440');
    d.ellipse(12, 33, 3, 2, '#4a4440');
  }
}

function drawRubble(p: PixelArt): void {
  const d = new Pen(p);
  const chunks: [number, number, number, number][] = [
    [4, 34, 14, 12],
    [16, 30, 12, 16],
    [27, 33, 14, 13],
    [40, 29, 13, 17],
    [51, 35, 12, 11],
    [12, 39, 10, 7],
    [33, 40, 12, 6],
  ];
  for (const [x, y, w, h] of chunks) {
    d.poly([x, y + h, x + 2, y + 2, x + w * 0.5, y, x + w - 1, y + 3, x + w, y + h], MC.conc);
    d.poly([x + 2, y + 2, x + w * 0.5, y, x + w * 0.5, y + 2, x + 3, y + 4], MC.concL);
    d.rect(x + w - 3, y + 4, 2, h - 4, MC.concD);
  }
  d.line(22, 31, 18, 24, MC.rust);
  d.line(44, 30, 49, 22, MC.rust);
  d.line(45, 30, 41, 25, MC.rust);
  sandbag(d, 0, 41, 9, 5, MC.sandD);
  sandbag(d, 57, 41, 9, 5, MC.sandD);
  // Broken flag pole.
  d.line(30, 33, 24, 22, MC.steelD);
  d.poly([24, 22, 18, 24, 19, 27, 25, 25], MC.rustD);
  charr(p, 31, 0.03);
}

sprites.define({
  name: 'mach_bunker',
  w: W,
  h: H,
  frames: RUBBLE + 1,
  draw: (p, f) => {
    if (f === RUBBLE) drawRubble(p);
    else drawBunker(p, f % DOOR_N, Math.floor(f / DOOR_N));
  },
});

export class Bunker extends Machine {
  maxTroops: number;
  spawnEvery: number;
  troop: string;
  troopsOut: Entity[] = [];
  spawnT = 1.4;
  doorT = 0;
  door = 0;
  fireT = 0;
  burst = 0;
  burstT = 0;
  active = false;
  lastDmgStage = 0;

  constructor(props: Record<string, any> = {}) {
    super();
    this.w = 56;
    this.h = 38;
    this.hp = this.maxHp = 40;
    this.scoreValue = 2000;
    this.maxTroops = typeof props.maxTroops === 'number' ? props.maxTroops : 3;
    this.spawnEvery = typeof props.spawnEvery === 'number' ? props.spawnEvery : 3.5;
    this.troop = troopType(props.troop);
    this.boom = 'huge';
    this.blast = { radius: 40, damage: 6 };
    this.debris = [MC.conc, MC.concD, MC.concL, MC.concDD, MC.sand, MC.rust];
    this.smokeAt = [
      [12, -36],
      [-14, -30],
      [20, -20],
    ];
    this.wreckTime = 3.6;
    this.z = Z_BUNKER;
  }

  override spawned(): void {
    super.spawned();
    this.fireT = this.fireDelay(1.2);
    this.setState('idle');
  }

  aliveTroops(): number {
    this.troopsOut = this.troopsOut.filter((e) => !e.dead && e.hittable);
    return this.troopsOut.length;
  }

  slit(): { x: number; y: number } {
    return { x: this.x + (SLIT_X - W / 2 + 3) * this.facing, y: this.y - H + SLIT_Y };
  }

  think(dt: number): void {
    const t = this.target();
    this.vx = 0;
    this.moveAndCollide(dt);
    if (!this.active) {
      if (this.canAttack(-10) && t) {
        this.active = true;
        msfx(this, 'alarm', { vol: 0.45 });
      } else return;
    }
    // Troop door.
    if (this.doorT > 0) {
      this.doorT -= dt;
      if (this.door === 1 && this.doorT <= 0.55) {
        this.door = 2;
        this.spawnTroop();
      }
      if (this.doorT <= 0) this.door = 0;
    } else {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.canAttack(-10)) {
        this.spawnT = this.spawnEvery * this.world.difficulty.enemyFireDelay;
        if (this.aliveTroops() < this.maxTroops) {
          this.door = 1;
          this.doorT = 0.95;
          msfx(this, 'metal_hit', { vol: 0.4, pitch: 0.6 });
        }
      }
    }
    // MG slit.
    const inFront = t ? Math.sign(t.x - this.x) === this.facing && Math.abs(t.x - this.x) > 20 : false;
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burst--;
        this.burstT = 0.12;
        this.fire();
        if (this.burst === 0) this.fireT = this.fireDelay(2.1);
      }
    } else {
      this.fireT -= dt;
      if (this.fireT <= 0 && inFront && this.canAttack()) {
        this.burst = 4;
        this.burstT = 0.45;
      }
    }
  }

  private spawnTroop(): void {
    const t = this.target();
    const dir: 1 | -1 = t ? (t.x < this.x ? -1 : 1) : this.facing;
    const x = this.x + (DOOR_X - W / 2) * this.facing;
    const e = this.world.spawn(this.troop, x, this.y, { behavior: 'charge', facing: dir });
    if (e) {
      e.vx = dir * 40;
      this.troopsOut.push(e);
    }
    this.world.particles.dust(x, this.y, 3);
  }

  private fire(): void {
    if (!this.canAttack()) return;
    const s = this.slit();
    const t = this.target();
    let ang = this.facing > 0 ? 0 : Math.PI;
    if (t) {
      const raw = Math.atan2(t.cy - s.y, Math.abs(t.cx - s.x) + 1);
      const a = Math.max(-0.35, Math.min(0.35, raw));
      ang = this.facing > 0 ? a : Math.PI - a;
    }
    this.shoot(s.x, s.y, { angle: ang, speed: 150, spread: 0.03 });
    const fx = this.world.effect('muzzle_flash', s.x, s.y, { fps: 30 });
    fx.rot = ang;
    msfx(this, 'turret_fire', { vol: 0.55 });
  }

  override onDamaged(d: import('../../game/constants').Damage): void {
    super.onDamaged(d);
    // Chunks of concrete break off as damage stages are crossed.
    const stage = this.hpFrac < 0.33 ? 2 : this.hpFrac < 0.66 ? 1 : 0;
    if (stage > this.lastDmgStage) {
      this.lastDmgStage = stage;
      this.world.particles.debris(this.x + this.facing * 14, this.y - 30, 10, [MC.conc, MC.concD, MC.concL], 170);
      this.world.particles.smokePuffs(this.x + this.facing * 14, this.y - 30, 3, 6, '#b8b0a0', '#7a746a');
      msfx(this, 'crate_break', { vol: 0.6 });
      this.world.shake(2, 0.2);
    }
  }

  override onExplode(): void {
    this.world.particles.debris(this.x, this.y - 20, 24, [MC.conc, MC.concD, MC.concL, MC.concDD], 300);
    this.world.particles.smokePuffs(this.x, this.y - 16, 10, 20, '#a8a090', '#5a564e');
  }

  override render(g: CanvasRenderingContext2D): void {
    if (this.hidden) return;
    const flip = this.facing < 0;
    const spr = sprites.get('mach_bunker');
    const x = this.x + this.joltX;
    if (this.wrecked) {
      spr.draw(g, x, this.y, RUBBLE, { flip });
      return;
    }
    const dmg = this.hpFrac < 0.33 ? 2 : this.hpFrac < 0.66 ? 1 : 0;
    spr.draw(g, x, this.y, dmg * DOOR_N + this.door, { flip, flash: this.flash > 0 });
    if (this.burst > 0 && this.burstT > 0.13 && Math.floor(this.burstT * 16) % 2 === 0) {
      const s = this.slit();
      sprites.get('mach_glow').draw(g, s.x - this.facing * 2, s.y, 1);
    }
  }
}

registerEntity(
  'bunker',
  'enemy',
  (_w, s) => new Bunker(s.props),
  "Concrete pillbox (40 HP, blocksProgress): MG slit bursts toward props.facing (telegraphed glow) and a door that releases props.troop (default 'rifleman') every props.spawnEvery s (3.5) while fewer than props.maxTroops (3) are alive; collapses to rubble. props.drop",
);
