// Player weapons, bombs, knife and rig geometry: every weapon fires and hurts a target in front,
// heavy-weapon feel rules hold (HMG fan/burst, laser sweep coverage, shotgun pierce), ammo
// reverts to the pistol, and gun sprites/muzzles line up for every character.
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DT, makeWorld, step } from './helpers';
import { Enemy } from '../src/game/enemy';
import type { Player } from '../src/game/player';
import { bombThrowers, FIDGET_AFTER } from '../src/game/player';
import { allWeapons, getWeapon, WEAPON_SFX } from '../src/game/weapons';
import type { Damage, DamageKind } from '../src/game/constants';
import type { World } from '../src/game/world';
import { input, type ActionMask } from '../src/engine/input';
import { sprites } from '../src/engine/sprites';
import { characters } from '../src/game/characters';
import { AIMS, PLAYER_GUNS, UPPER_OX, UPPER_OY, muzzleFromShoulder, upperLean } from '../src/art/humanoid';
import { Bullet } from '../src/game/projectile';
import { SHOTGUN_RANGE } from '../src/content/weapons/shotgun';

/** Stationary target that records every hit. */
class Dummy extends Enemy {
  hits: Damage[] = [];
  float: boolean;
  constructor(hp = 1000, float = false) {
    super();
    this.hp = this.maxHp = hp;
    this.w = 14;
    this.h = 26;
    this.scaleHp = false;
    this.deathSfx = null;
    this.float = float;
  }
  think(dt: number): void {
    this.vx = 0;
    if (!this.float) this.moveAndCollide(dt);
  }
  override onDamaged(d: Damage): void {
    this.hits.push(d);
  }
  kinds(): Set<DamageKind> {
    return new Set(this.hits.map((h) => h.kind));
  }
}

function setup(weapon = 'pistol'): { w: World; p: Player } {
  const w = makeWorld('sandbox', { god: true });
  step(w, 150); // drop in and land
  const p = w.players[0];
  expect(p.state).toBe('play');
  if (weapon !== 'pistol') p.giveWeapon(weapon);
  return { w, p };
}

function dummy(w: World, x: number, y: number, hp = 1000, float = false): Dummy {
  const d = new Dummy(hp, float);
  d.x = x;
  d.y = y;
  w.add(d);
  return d;
}

function hold(w: World, mask: ActionMask | null, frames: number): void {
  input.setVirtual(0, mask);
  step(w, frames);
}

afterEach(() => {
  input.setVirtual(0, null);
  input.setVirtual(1, null);
});

const EXPECTED: Record<string, { letter: string; ammo: number; kind: DamageKind }> = {
  pistol: { letter: 'P', ammo: Infinity, kind: 'bullet' },
  hmg: { letter: 'H', ammo: 200, kind: 'bullet' },
  rocket: { letter: 'R', ammo: 30, kind: 'explosion' },
  shotgun: { letter: 'S', ammo: 30, kind: 'bullet' },
  flame: { letter: 'F', ammo: 30, kind: 'fire' },
  laser: { letter: 'L', ammo: 200, kind: 'laser' },
  homing: { letter: 'C', ammo: 40, kind: 'explosion' },
  bouncer: { letter: 'B', ammo: 30, kind: 'explosion' },
};

describe('weapon registry', () => {
  it('registers every weapon of the design table with its letter and ammo', () => {
    for (const [id, e] of Object.entries(EXPECTED)) {
      const def = getWeapon(id);
      expect(def.id, id).toBe(id);
      expect(def.letter, id).toBe(e.letter);
      expect(def.ammo, id).toBe(e.ammo);
      expect(PLAYER_GUNS, `${id} gun kind`).toContain(def.gun);
    }
    const guns = new Set(allWeapons().map((w) => w.gun));
    expect(guns.size).toBe(allWeapons().length); // every weapon looks distinct in hand
  });

  it('only uses canonical sfx names', () => {
    const design = readFileSync('docs/DESIGN.md', 'utf8');
    const block = design.slice(design.indexOf('SFX names'), design.indexOf('Songs:'));
    const canon = new Set(block.match(/[a-z0-9_]+/g));
    for (const n of WEAPON_SFX) expect(canon.has(n), n).toBe(true);
    for (const w of allWeapons()) expect(canon.has(w.sfx), `${w.id}: ${w.sfx}`).toBe(true);
  });

  it('has upper-body, rest, throw and knife sets for every character and palette', () => {
    for (const c of characters()) {
      for (const base of [`char_${c.id}`, `char_${c.id}_p2`]) {
        for (const g of PLAYER_GUNS) {
          expect(sprites.has(`${base}_up_${g}`), `${base}_up_${g}`).toBe(true);
          expect(sprites.has(`${base}_rest_${g}`), `${base}_rest_${g}`).toBe(true);
          expect(sprites.get(`${base}_up_${g}`).frameCount).toBe(10);
        }
        expect(sprites.get(`${base}_throw`).frameCount).toBe(4);
        expect(sprites.get(`${base}_knife`).frameCount).toBe(3);
        expect(sprites.get(`${base}_body`).frameCount).toBe(9);
      }
    }
    for (const g of PLAYER_GUNS) expect(sprites.has(`gun_${g}`), `gun_${g}`).toBe(true);
  });
});

describe('gun geometry', () => {
  it('keeps infantry gun muzzles where they always were (backward compatible)', () => {
    // Old formula: muzzle at (front + 2.5) along the aim, 1.5px below the barrel axis.
    const old = (front: number, a: number) => [Math.cos(a) * (front + 2.5) - Math.sin(a) * 1.5, Math.sin(a) * (front + 2.5) + Math.cos(a) * 1.5];
    for (const [g, front] of [
      ['rifle', 13],
      ['smg', 10],
      ['sniper', 16],
    ] as const) {
      for (const a of AIMS) {
        const [x, y] = muzzleFromShoulder(g, a);
        const [ox, oy] = old(front, a);
        expect(x, `${g} ${a}`).toBeCloseTo(ox, 5);
        expect(y, `${g} ${a}`).toBeCloseTo(oy, 5);
      }
    }
  });

  it('puts the muzzle at the drawn barrel tip for every player gun and aim', () => {
    const s = sprites.get('char_dex_up_pistol');
    for (const g of PLAYER_GUNS) {
      const sp = sprites.get(`char_dex_up_${g}`);
      for (let i = 0; i < 5; i++) {
        const art = sp.pixelArt(i);
        const aim = AIMS[i];
        const [mx, my] = muzzleFromShoulder(g, aim);
        // Shoulder inside the padded upper canvas.
        const sx = UPPER_OX + upperLean(aim) + 1;
        const sy = UPPER_OY - 10 + 1;
        const px = Math.round(sx + mx);
        const py = Math.round(sy + my);
        let near = Infinity;
        for (let y = 0; y < art.h; y++)
          for (let x = 0; x < art.w; x++) if (art.opaque(x, y)) near = Math.min(near, Math.hypot(x - px, y - py));
        expect(near, `${g} aim ${i}: muzzle ${px},${py}`).toBeLessThanOrEqual(2.5);
      }
    }
    void s;
  });
});

describe('every weapon fires and damages a target in front', () => {
  for (const id of Object.keys(EXPECTED)) {
    it(id, () => {
      const { w, p } = setup(id);
      const d = dummy(w, p.x + 70, p.y);
      const ammo0 = p.ammo;
      // Tap-tap-hold: works for semi-auto, auto, burst and beam weapons alike.
      for (let i = 0; i < 6; i++) {
        hold(w, { fire: true }, 4);
        hold(w, null, 8);
      }
      hold(w, { fire: true }, 60);
      hold(w, null, 90);
      expect(d.hits.length, `${id} hits`).toBeGreaterThan(0);
      expect(d.hp, `${id} hp`).toBeLessThan(1000);
      expect(d.kinds().has(EXPECTED[id].kind), `${id} kind ${[...d.kinds()]}`).toBe(true);
      if (isFinite(ammo0)) expect(p.ammo, `${id} ammo used`).toBeLessThan(ammo0);
      expect(w.stats.shotsFired).toBeGreaterThan(0);
    });
  }
});

describe('heavy weapon feel', () => {
  it('HMG bullets fan through the diagonals when aiming up while firing', () => {
    const { w } = setup('hmg');
    const angles = new Set<number>();
    const seen = new Set<number>();
    input.setVirtual(0, { fire: true });
    for (let i = 0; i < 20; i++) step(w, 1);
    input.setVirtual(0, { fire: true, up: true });
    for (let i = 0; i < 40; i++) {
      step(w, 1);
      for (const e of w.entities) {
        if (!(e instanceof Bullet) || seen.has(e.id)) continue;
        seen.add(e.id);
        angles.add(Math.round((Math.atan2(e.vy, e.vx) * 180) / Math.PI));
      }
    }
    const diagonal = [...angles].filter((a) => a < -10 && a > -80);
    expect(diagonal.length, `angles ${[...angles].sort((a, b) => a - b)}`).toBeGreaterThanOrEqual(3);
  });

  it('a single HMG tap fires a burst', () => {
    const { w, p } = setup('hmg');
    const n0 = p.shotCounter;
    hold(w, { fire: true }, 1);
    hold(w, null, 40);
    expect(p.shotCounter - n0).toBeGreaterThanOrEqual(4);
  });

  it('the laser sweep hits every target on the arc and pierces', () => {
    const { w, p } = setup('laser');
    const m = p.muzzle();
    const ds = [0, -0.45, -0.9, -1.3].map((a) => dummy(w, m.x + Math.cos(a) * 150, m.y + Math.sin(a) * 150 + 13, 1000, true));
    const behind = dummy(w, ds[0].x + 30, ds[0].y, 1000, true);
    hold(w, { fire: true }, 6);
    hold(w, { fire: true, up: true }, 40);
    hold(w, null, 10);
    for (const d of ds) expect(d.hits.length, `dummy at ${d.x.toFixed(0)},${d.y.toFixed(0)}`).toBeGreaterThan(0);
    expect(behind.hits.length, 'pierced').toBeGreaterThan(0);
    expect(p.ammo).toBeLessThan(200);
  });

  it('the shotgun cone pierces everything in range and nothing beyond', () => {
    const { w, p } = setup('shotgun');
    const near = [30, 55, 80].map((dx) => dummy(w, p.x + dx, p.y));
    const far = dummy(w, p.x + SHOTGUN_RANGE + 50, p.y);
    hold(w, { fire: true }, 1);
    hold(w, null, 20);
    for (const d of near) expect(d.hits.length).toBe(1);
    expect(far.hits.length).toBe(0);
  });

  it('runs out of ammo back to the pistol', () => {
    const { w, p } = setup('rocket');
    p.ammo = 1;
    hold(w, { fire: true }, 1);
    hold(w, null, 10);
    expect(p.weapon.id).toBe('pistol');
    expect(p.ammo).toBe(Infinity);
  });

  it('heavy lifter gets +50% heavy ammo', () => {
    const { p } = setup();
    p.char = characters().find((c) => c.id === 'brick')!;
    p.giveWeapon('rocket');
    expect(p.ammo).toBe(45);
    p.giveWeapon('rocket');
    expect(p.ammo).toBe(90);
  });
});

describe('bombs', () => {
  it('content registers grenade and fire bomb throwers', () => {
    expect(typeof bombThrowers.grenade).toBe('function');
    expect(typeof bombThrowers.firebomb).toBe('function');
  });

  it('grenades blow up near a target', () => {
    const { w, p } = setup();
    const d = dummy(w, p.x + 90, p.y);
    const b0 = p.bombs;
    hold(w, { bomb: true }, 1);
    hold(w, null, 120);
    expect(p.bombs).toBe(b0 - 1);
    expect(d.kinds().has('explosion')).toBe(true);
  });

  it('fire bombs burn targets along the ground for several ticks', () => {
    const { w, p } = setup();
    p.addBombs(5, 'firebomb');
    expect(p.bombKind).toBe('firebomb');
    const d = dummy(w, p.x + 110, p.y);
    hold(w, { bomb: true }, 1);
    hold(w, null, 150);
    const fire = d.hits.filter((h) => h.kind === 'fire');
    expect(fire.length).toBeGreaterThanOrEqual(3);
    expect(d.hp).toBeLessThan(1000 - 5);
  });
});

describe('knife and player feel', () => {
  it('knifes an adjacent rifleman instead of shooting', () => {
    const { w, p } = setup('hmg');
    const r = w.spawn('rifleman', p.x + 16, undefined, { behavior: 'idle' }) as Enemy;
    step(w, 2);
    const shots = p.shotCounter;
    hold(w, { fire: true }, 2);
    expect(r.dying).toBe(true);
    expect(r.deathKind).toBe('melee');
    expect(p.knifeAnim).toBeGreaterThan(0);
    expect(p.shotCounter).toBe(shots);
  });

  it('plays the idle fidget after standing still', () => {
    const { w, p } = setup();
    hold(w, { left: true }, 2); // any input resets the idle clock
    expect(p.idleTime).toBe(0);
    hold(w, null, Math.ceil((FIDGET_AFTER + 0.3) / DT));
    expect(p.fidgetFrame()).toBeGreaterThanOrEqual(0);
    hold(w, { right: true }, 2);
    expect(p.fidgetFrame()).toBe(-1);
  });

  it('kicks up dust while running and squats on landing', () => {
    const { w, p } = setup();
    const before = w.particles.list.length;
    hold(w, { right: true }, 40);
    expect(w.particles.list.length).toBeGreaterThan(before);
    hold(w, { jump: true }, 12);
    hold(w, null, 60);
    expect(p.onGround).toBe(true);
  });

  it('jumps onto a platform and drops back through it', () => {
    const { w, p } = setup();
    // Sandbox platform: x 200..280 at y 140.
    p.x = 240;
    p.y = 139;
    p.vy = 0;
    hold(w, null, 10);
    expect(p.onPlatform).toBe(true);
    expect(p.y).toBeCloseTo(140, 0);
    hold(w, { down: true }, 2);
    expect(p.crouching).toBe(true);
    hold(w, { down: true, jump: true }, 2);
    hold(w, null, 40);
    expect(p.y).toBeGreaterThan(170);
    expect(p.onGround).toBe(true);
  });

  it('keeps two-handed guns in hand while throwing', () => {
    for (const g of PLAYER_GUNS) {
      const two = g !== 'pistol';
      expect(sprites.has(`char_juno_throw_${g}`), g).toBe(two);
    }
    const { w, p } = setup('rocket');
    hold(w, { bomb: true }, 1);
    expect(p.throwAnim).toBeGreaterThan(0);
    expect(p.weapon.id).toBe('rocket');
    step(w, 30);
  });
});
