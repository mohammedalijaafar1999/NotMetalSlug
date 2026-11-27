// Infantry enemies: behaviour contracts (telegraphs, shields, armour, rallies, deaths).
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { makeWorld, step } from './helpers';
import { VIEW_W } from '../src/engine/renderer';
import { getEntityType } from '../src/game/registry';
import { Bullet, Grenade, Projectile } from '../src/game/projectile';
import { ExplosionEffect } from '../src/game/effects';
import { Enemy } from '../src/game/enemy';
import type { Entity } from '../src/game/entity';
import type { World } from '../src/game/world';
import { SF } from '../src/art/soldier';
import { sprites } from '../src/engine/sprites';
import { Bubble, Infantry } from '../src/content/enemies/infantry';
import { ShieldTrooper } from '../src/content/enemies/shield_trooper';
import { Sniper } from '../src/content/enemies/sniper';
import { MortarCrew, MortarMan } from '../src/content/enemies/mortar';
import { FlameJet, Harpoon, LegionRocket, MortarShell, SniperRound, EnergyBolt, MORTAR_RADIUS } from '../src/content/enemies/projectiles';
import { Paratrooper } from '../src/content/enemies/paratrooper';
import { Frogman } from '../src/content/enemies/frogman';
import { Officer } from '../src/content/enemies/officer';
import { Robot } from '../src/content/enemies/robot';
import { Saber } from '../src/content/enemies/saber';
import { Flametrooper } from '../src/content/enemies/flametrooper';
import { JetpackTrooper } from '../src/content/enemies/jetpack';
import { Grenadier } from '../src/content/enemies/grenadier';
import { Rifleman } from '../src/content/enemies/rifleman';

const TYPES = ['rifleman', 'grenadier', 'shield_trooper', 'bazooka', 'saber', 'paratrooper', 'mortar', 'sniper', 'flametrooper', 'jetpack', 'frogman', 'officer', 'robot'];

/** Sandbox world (platforms removed: flat ground) with the player landed and past respawn invulnerability. */
function arena(god = true): World {
  const w = makeWorld('sandbox', { god });
  for (const s of w.terrain.platforms()) w.terrain.remove(s);
  step(w, 200);
  const p = w.players[0];
  p.invuln = 0;
  return w;
}

function all<T extends Entity>(w: World, cls: abstract new (...a: any[]) => T): T[] {
  return w.query((e): e is T => e instanceof cls);
}

/** Step until pred() is true; returns frames taken (or -1). */
function until(w: World, pred: () => boolean, max = 900): number {
  for (let i = 0; i < max; i++) {
    if (pred()) return i;
    step(w, 1);
  }
  return pred() ? max : -1;
}

describe('registration', () => {
  it('registers every infantry type as an enemy with documented props', () => {
    for (const t of TYPES) {
      const info = getEntityType(t);
      expect(info, t).toBeTruthy();
      expect(info!.category).toBe('enemy');
      expect(info!.description.length, t).toBeGreaterThan(40);
    }
  });

  it('keeps the standard soldier frame indices stable and adds personality frames', () => {
    expect(SF.IDLE).toBe(0);
    expect(SF.WALK).toBe(2);
    expect(SF.DIE).toBe(16);
    expect(SF.FIDGET).toBe(27);
    expect(SF.SLEEP).toBeGreaterThanOrEqual(29);
    expect(SF.COUNT).toBe(SF.COWER + SF.COWER_N);
    expect(sprites.get('rifleman').frameCount).toBe(SF.COUNT);
    for (const f of [SF.SLEEP, SF.CHAT, SF.COWER]) expect(sprites.get('rifleman').pixelArt(f).opaqueCount()).toBeGreaterThan(80);
  });

  it('only uses sound effects from the canonical DESIGN.md list', () => {
    const design = readFileSync('docs/DESIGN.md', 'utf8');
    const block = design.split('SFX names')[1].split('```')[1];
    const canonical = new Set(block.split(/\s+/).filter((w) => /^[a-z0-9_]+$/.test(w)));
    const dir = 'src/content/enemies';
    const used = new Set<string>();
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/(?:sfx\(|deathSfx = |sfx: )\s*'([a-z0-9_]+)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(15);
    for (const n of used) expect(canonical.has(n), `sfx "${n}" is not canonical`).toBe(true);
  });
});

describe('awareness & personality', () => {
  it('a patrolling rifleman notices the player with a surprised hop, then engages', () => {
    const w = arena();
    const r = w.spawn('rifleman', w.camera.x + 200) as Rifleman;
    let hopped = false;
    const n = until(w, () => {
      if (r.state === 'alert' && r.vy < 0) hopped = true;
      return r.state === 'engage';
    });
    expect(n).toBeGreaterThan(0);
    expect(hopped).toBe(true);
  });

  it('sleeping and chatting soldiers stay calm (with bubbles) until a player gets close', () => {
    const w = arena();
    const p = w.players[0];
    const s = w.spawn('rifleman', w.camera.x + 250, undefined, { behavior: 'sleep' }) as Rifleman;
    const c = w.spawn('grenadier', w.camera.x + 330, undefined, { behavior: 'chat' }) as Grenadier;
    step(w, 240);
    expect(s.state).toBe('sleep');
    expect(c.state).toBe('chat');
    expect(all(w, Bubble).length).toBeGreaterThan(0);
    p.x = s.x - 50;
    expect(until(w, () => s.state !== 'sleep', 60)).toBeGreaterThanOrEqual(0);
  });

  it('soldiers sometimes panic-run from a player with a heavy weapon', () => {
    const w = arena();
    const p = w.players[0];
    p.giveWeapon('hmg');
    const rs = [0, 1, 2].map((i) => w.spawn('rifleman', p.x + 40 + i * 6, undefined, { behavior: 'charge' }) as Rifleman);
    expect(until(w, () => rs.some((r) => r.state === 'panic'), 900)).toBeGreaterThanOrEqual(0);
  });

  it('enemies never attack while off-screen', () => {
    for (const t of TYPES) {
      const w = arena();
      w.spawn(t, w.camera.x + VIEW_W + 140);
      step(w, 240);
      const shots = w.query((e) => (e instanceof Projectile || e instanceof MortarShell || e instanceof FlameJet) && e.team === 'enemy');
      expect(shots.length, t).toBe(0);
    }
  });
});

describe('shield trooper', () => {
  function setup() {
    const w = arena();
    const p = w.players[0];
    const st = w.spawn('shield_trooper', p.x + 120, undefined, { behavior: 'guard', facing: -1 }) as ShieldTrooper;
    // Past the surprised "!" so he is engaging (and turns around slowly).
    step(w, 40);
    st.attackTimer = 99;
    return { w, p, st };
  }

  it('blocks frontal bullets with sparks and a clang', () => {
    const { w, p, st } = setup();
    const b = w.add(new Bullet(p, st.x - 40, st.y - 14, 0));
    step(w, 8);
    expect(b.dead).toBe(true);
    expect(st.dying).toBe(false);
    expect(st.shieldHp).toBe(st.shieldMax - 1);
  });

  it('does not block grenades, the knife, or bullets from behind / above', () => {
    {
      const { w, p, st } = setup();
      w.explode(st.x - 12, st.y - 3, { radius: 26, damage: 9, team: 'player', owner: p });
      expect(st.dying).toBe(true);
    }
    {
      const { p, st } = setup();
      st.damage({ amount: 5, kind: 'melee', owner: p, x: st.x, y: st.y - 13, dir: 1 });
      expect(st.dying).toBe(true);
    }
    {
      const { w, p, st } = setup();
      p.x = st.x + 60; // behind him
      w.add(new Bullet(p, st.x + 30, st.y - 14, Math.PI));
      step(w, 6);
      expect(st.dying).toBe(true);
    }
    {
      const { w, p, st } = setup();
      p.x = st.x - 4;
      p.y = st.y - 70; // jumping above him, shooting down
      w.add(new Bullet(p, st.x, st.y - 40, Math.PI / 2));
      step(w, 5);
      expect(st.dying).toBe(true);
    }
    {
      const { w, p, st } = setup();
      w.add(new Bullet(p, st.x - 40, st.y - 25, 0)); // over the shield's top edge: head shot
      step(w, 8);
      expect(st.dying).toBe(true);
    }
  });

  it('the shield breaks after absorbing its hit points, then he is vulnerable', () => {
    const { w, p, st } = setup();
    for (let i = 0; i < st.shieldMax; i++) st.damage({ amount: 1, kind: 'bullet', owner: p, x: st.x - 8, y: st.y - 14, dir: 1 });
    expect(st.shieldUp).toBe(false);
    expect(st.dying).toBe(false);
    step(w, 2);
    st.damage({ amount: 1, kind: 'bullet', owner: p, x: st.x - 8, y: st.y - 14, dir: 1 });
    expect(st.dying).toBe(true);
  });
});

describe('telegraphed attacks', () => {
  it('sniper: laser sight tracks for ~1 s, locks, then fires a fast round along the locked line', () => {
    const w = arena();
    const p = w.players[0];
    const sn = w.spawn('sniper', p.x + 230) as Sniper;
    let aimStart = -1;
    let lockedAngle: number | null = null;
    let round: SniperRound | null = null;
    let angleAtFire = 0;
    until(w, () => {
      if (sn.state === 'aim' && aimStart < 0) aimStart = w.time;
      if (sn.state === 'aim' && sn.stateTime > 0.8 && lockedAngle === null) lockedAngle = sn.aimAngle;
      if (sn.state === 'aim' && lockedAngle !== null) expect(sn.aimAngle).toBeCloseTo(lockedAngle, 6);
      round = all(w, SniperRound)[0] ?? null;
      if (round) angleAtFire = sn.aimAngle;
      return !!round;
    });
    expect(aimStart).toBeGreaterThan(0);
    expect(round).toBeTruthy();
    expect(w.time - aimStart).toBeGreaterThanOrEqual(0.95);
    const r = round as unknown as SniperRound;
    expect(Math.hypot(r.vx, r.vy)).toBeCloseTo(240, 0);
    expect(Math.atan2(r.vy, r.vx)).toBeCloseTo(angleAtFire, 5);
    const end = sn.laserEnd();
    expect(Number.isFinite(end.x)).toBe(true);
  });

  it('mortar: the blinking marker appears at launch, >= 1.2 s before the shell lands on it', () => {
    const w = arena();
    const p = w.players[0];
    w.spawn('mortar', p.x + 260);
    let shell: MortarShell | undefined;
    until(w, () => !!(shell = all(w, MortarShell)[0]));
    expect(shell).toBeTruthy();
    const s = shell!;
    const launch = w.time;
    expect(s.timeLeft).toBeGreaterThanOrEqual(1.2);
    expect(Math.abs(s.tx - p.x)).toBeLessThan(48);
    const tx = s.tx;
    until(w, () => s.dead, 300);
    expect(w.time - launch).toBeGreaterThanOrEqual(1.2);
    const boom = w.query((e) => e instanceof ExplosionEffect && Math.abs(e.x - tx) < 3);
    expect(boom.length).toBeGreaterThan(0);
  });

  it('mortar: the landing marker ring is as wide as the real blast (body touching the ring = hit, clear of it = safe)', () => {
    const marker = sprites.get('mortar_marker');
    expect(marker.ox).toBe(MORTAR_RADIUS);
    expect(marker.w).toBe(MORTAR_RADIUS * 2 + 1);
    expect(marker.pixelArt(0).opaqueCount()).toBeGreaterThan(60);
    for (const [gap, hit] of [
      [-2, true],
      [3, false],
    ] as const) {
      const w = arena(false);
      const p = w.players[0];
      p.invuln = 0;
      // Shell landing so the near edge of the player's body sits `gap` px outside the ring.
      const tx = p.x - p.w / 2 - MORTAR_RADIUS - gap;
      const crew = w.spawn('mortar', p.x + 200) as MortarCrew;
      step(w, 1);
      const s = w.add(new MortarShell(crew, crew.x, crew.y - 20, tx, p.y, 1.4));
      expect(s.radius).toBe(MORTAR_RADIUS);
      until(w, () => s.dead, 200);
      expect(p.state === 'dying', `gap ${gap}`).toBe(hit);
    }
  });

  it('mortar crew: two separate crewmen; the survivor keeps firing alone; the crew stops blocking when both are down', () => {
    const w = arena();
    const p = w.players[0];
    const crew = w.spawn('mortar', p.x + 260) as MortarCrew;
    step(w, 2);
    const men = all(w, MortarMan);
    expect(men.length).toBe(2);
    expect(crew.hittable).toBe(false);
    expect(crew.blocksProgress).toBe(true);
    men[1].damage({ amount: 1, kind: 'bullet', owner: p, dir: -1 });
    expect(until(w, () => all(w, MortarShell).length > 0, 900)).toBeGreaterThanOrEqual(0);
    men[0].damage({ amount: 1, kind: 'bullet', owner: p, dir: -1 });
    step(w, 2);
    expect(crew.blocksProgress).toBe(false);
    expect(p.profile.score).toBeGreaterThanOrEqual(200);
  });

  it('grenadier winds up before lobbing a grenade', () => {
    const w = arena();
    const p = w.players[0];
    const g = w.spawn('grenadier', p.x + 150) as Grenadier;
    let windup = -1;
    let gren: Grenade | undefined;
    until(w, () => {
      if (g.state === 'windup' && windup < 0) windup = w.time;
      gren = w.query((e): e is Grenade => e instanceof Grenade && e.team === 'enemy')[0];
      return !!gren;
    });
    expect(gren).toBeTruthy();
    expect(w.time - windup).toBeGreaterThanOrEqual(0.45);
    expect(gren!.vy).toBeLessThan(0); // arcs upward first
  });

  it('bazooka: slow rocket that accelerates in a straight line and can be shot down', () => {
    const w = arena();
    const p = w.players[0];
    const bz = w.spawn('bazooka', p.x + 200);
    let rocket: LegionRocket | undefined;
    let kneel = -1;
    until(w, () => {
      if ((bz as Enemy).state === 'kneel' && kneel < 0) kneel = w.time;
      return !!(rocket = all(w, LegionRocket)[0]);
    });
    expect(rocket).toBeTruthy();
    expect(w.time - kneel).toBeGreaterThanOrEqual(0.7);
    const r = rocket!;
    const v0 = Math.hypot(r.vx, r.vy);
    expect(v0).toBeLessThan(80);
    const a0 = Math.atan2(r.vy, r.vx);
    step(w, 20);
    if (!r.dead) {
      expect(Math.hypot(r.vx, r.vy)).toBeGreaterThan(v0);
      expect(Math.hypot(r.vx, r.vy)).toBeLessThanOrEqual(161);
      expect(Math.atan2(r.vy, r.vx)).toBeCloseTo(a0, 6); // straight line, no homing
      const score = p.profile.score;
      expect(r.damage({ amount: 1, kind: 'bullet', owner: p })).toBe(true);
      expect(r.dead).toBe(true);
      expect(p.profile.score).toBeGreaterThan(score);
    }
  });

  it('saber: harmless during the wind-up, hurts only during the slash', () => {
    const w = arena(false);
    const p = w.players[0];
    const sb = w.spawn('saber', p.x + 26, undefined, { behavior: 'charge', leap: false }) as Saber;
    let sawWindup = false;
    const n = until(w, () => {
      if (sb.state === 'windup') sawWindup = true;
      if (p.state !== 'play') return true;
      return false;
    }, 600);
    expect(n).toBeGreaterThan(0);
    expect(sawWindup).toBe(true);
    expect(sb.state).toBe('slash');
  });

  it('flametrooper: 2 HP; the flame burns; the fuel tank blast hurts his comrades but not players', () => {
    const w = arena(false);
    const p = w.players[0];
    const ft = w.spawn('flametrooper', p.x + 60, undefined, { behavior: 'charge' }) as Flametrooper;
    expect(until(w, () => ft.state === 'spray' || p.state !== 'play', 600)).toBeGreaterThanOrEqual(0);
    expect(until(w, () => p.state !== 'play', 120)).toBeGreaterThanOrEqual(0); // burned
    // Tank explosion.
    const w2 = arena(false);
    const p2 = w2.players[0];
    const ft2 = w2.spawn('flametrooper', p2.x + 30, undefined, { behavior: 'sleep' }) as Flametrooper;
    const buddy = w2.spawn('rifleman', p2.x + 46, undefined, { behavior: 'sleep' }) as Rifleman;
    step(w2, 1);
    ft2.damage({ amount: 1, kind: 'bullet', owner: p2, dir: 1 });
    expect(ft2.dying).toBe(false);
    ft2.damage({ amount: 1, kind: 'bullet', owner: p2, dir: 1 });
    expect(ft2.dying).toBe(true);
    step(w2, 40);
    expect(buddy.dying || buddy.dead).toBe(true);
    expect(p2.state).toBe('play');
  });
});

describe('special movers', () => {
  it('paratrooper: descends slowly; shooting the canopy makes him fall to his doom (credited)', () => {
    const w = arena();
    const p = w.players[0];
    const pt = w.spawn('paratrooper', p.x + 160) as Paratrooper;
    step(w, 2);
    expect(pt.descending).toBe(true);
    expect(pt.y).toBeLessThan(w.camera.y + 10);
    const y0 = pt.y;
    step(w, 60);
    expect(pt.y - y0).toBeGreaterThan(20);
    expect(pt.y - y0).toBeLessThan(45);
    expect(pt.hurtboxes().length).toBe(2);
    pt.damage({ amount: 1, kind: 'bullet', owner: p, x: pt.x, y: pt.y - 52, dir: 1 });
    expect(pt.falling).toBe(true);
    expect(pt.dying).toBe(false);
    expect(until(w, () => pt.dying, 300)).toBeGreaterThanOrEqual(0);
    expect(p.profile.score).toBeGreaterThanOrEqual(100);
  });

  it('paratrooper: lands and fights like a rifleman', () => {
    const w = arena();
    const p = w.players[0];
    const pt = w.spawn('paratrooper', p.x + 160) as Paratrooper;
    expect(until(w, () => !pt.descending, 900)).toBeGreaterThan(0);
    expect(pt.onGround).toBe(true);
    expect(until(w, () => pt.state === 'aim' || pt.state === 'fire', 600)).toBeGreaterThanOrEqual(0);
  });

  it('frogman: invulnerable while submerged, hittable once he pops up to throw', () => {
    const w = arena();
    const p = w.players[0];
    w.terrain.addWater(w.camera.x + 160, 140, 180, 60, true);
    const fm = w.spawn('frogman', w.camera.x + 260) as Frogman;
    step(w, 2);
    expect(fm.water).toBeTruthy();
    expect(fm.state).toBe('submerged');
    expect(fm.hittable).toBe(false);
    expect(fm.damage({ amount: 9, kind: 'bullet', owner: p })).toBe(false);
    expect(until(w, () => fm.state === 'windup', 900)).toBeGreaterThan(0);
    expect(fm.hittable).toBe(true);
    expect(until(w, () => all(w, Harpoon).length > 0, 120)).toBeGreaterThanOrEqual(0);
    expect(until(w, () => fm.state === 'submerged', 200)).toBeGreaterThan(0);
    expect(fm.hittable).toBe(false);
  });

  it('frogman without water fights on land', () => {
    const w = arena();
    const p = w.players[0];
    const fm = w.spawn('frogman', p.x + 140) as Frogman;
    step(w, 2);
    expect(fm.water).toBeNull();
    expect(fm.hittable).toBe(true);
    expect(until(w, () => all(w, Harpoon).length > 0, 900)).toBeGreaterThanOrEqual(0);
  });

  it('jetpack: takes off, hovers above the ground inside the view, attacks from the air; 2 HP', () => {
    const w = arena();
    const p = w.players[0];
    const jp = w.spawn('jetpack', p.x + 150) as JetpackTrooper;
    expect(jp.hp).toBe(2);
    expect(until(w, () => jp.flying, 300)).toBeGreaterThanOrEqual(0);
    step(w, 120);
    expect(jp.onGround).toBe(false);
    expect(jp.y).toBeLessThan(p.y - 40);
    expect(jp.x).toBeGreaterThan(w.camera.x);
    expect(jp.x).toBeLessThan(w.camera.x + VIEW_W);
    const attacked = until(w, () => w.query((e) => e instanceof Projectile && e.team === 'enemy').length > 0, 900);
    expect(attacked).toBeGreaterThanOrEqual(0);
    jp.damage({ amount: 2, kind: 'bullet', owner: p });
    expect(jp.dying).toBe(true);
    expect(until(w, () => jp.onGround, 300)).toBeGreaterThanOrEqual(0);
  });

  it('jetpack never fires from out of view: a wind-up that drifts off-screen is dropped, grounded ones never shoot', () => {
    const shotsBy = (w: World, e: Entity) => w.query((x) => x instanceof Projectile && x.team === 'enemy' && x.owner === e).length;
    for (const attack of ['aim', 'drop'] as const) {
      const w = arena();
      const p = w.players[0];
      const jp = w.spawn('jetpack', p.x + (attack === 'drop' ? 0 : 60), p.y - 70) as JetpackTrooper;
      (jp as any).nextAttack = attack === 'aim' ? 'burst' : 'drop';
      expect(until(w, () => jp.state === attack, 600), attack).toBeGreaterThanOrEqual(0);
      // The camera "moves on" mid wind-up: he is now well outside the view.
      jp.x = w.camera.x - 121;
      for (let i = 0; i < 60 * 2; i++) {
        jp.x = Math.min(jp.x, w.camera.x - 121);
        step(w, 1);
        expect(shotsBy(w, jp), `${attack}: nothing fired from off-screen`).toBe(0);
      }
    }
    // Grounded (no y) and off-screen: stays quiet.
    const w = arena();
    const jp = w.spawn('jetpack', w.camera.x + VIEW_W + 140) as JetpackTrooper;
    for (let i = 0; i < 60 * 4; i++) {
      step(w, 1);
      if (!jp.onScreen(-6)) expect(shotsBy(w, jp)).toBe(0);
    }
  });
});

describe('officer', () => {
  it('whistle wakes nearby troops and rallies them (faster fire)', () => {
    const w = arena();
    const p = w.players[0];
    const sleeper = w.spawn('rifleman', p.x + 230, undefined, { behavior: 'sleep' }) as Rifleman;
    const off = w.spawn('officer', p.x + 200) as Officer;
    expect(off.scoreValue).toBe(500);
    step(w, 2);
    expect(off.props.drop).toBe('points');
    expect(sleeper.state).toBe('sleep');
    expect(until(w, () => off.state === 'point', 600)).toBeGreaterThan(0);
    expect(sleeper.state).not.toBe('sleep');
    expect(sleeper.buffTime).toBeGreaterThan(0);
  });

  it('rallies foot soldiers (mortar crews included) but never machines', () => {
    const w = arena();
    const p = w.players[0];
    const rifle = w.spawn('rifleman', p.x + 240, undefined, { behavior: 'guard' }) as Rifleman;
    const mortar = w.spawn('mortar', p.x + 300) as Enemy;
    const heli = w.spawn('heli', p.x + 220, w.camera.y + 78) as Enemy;
    const tank = w.spawn('light_tank', p.x + 330, undefined, { behavior: 'hold', facing: -1 }) as Enemy;
    const off = w.spawn('officer', p.x + 200) as Officer;
    step(w, 2);
    expect(until(w, () => off.state === 'point', 600)).toBeGreaterThan(0);
    expect(rifle.buffTime).toBeGreaterThan(0);
    expect(mortar.buffTime).toBeGreaterThan(0);
    expect(heli.buffTime).toBe(0);
    expect(tank.buffTime).toBe(0);
  });

  it('panics when hurt and flees off-screen for good when left alone', () => {
    const w = arena();
    const p = w.players[0];
    const off = w.spawn('officer', p.x + 200) as Officer;
    step(w, 2);
    off.damage({ amount: 1, kind: 'bullet', owner: p, dir: 1 });
    expect(off.dying).toBe(false);
    expect(off.state).toBe('flee');
    // Alone: whistles for help, then runs away and is gone (no longer blocking).
    expect(until(w, () => off.dead, 1800)).toBeGreaterThan(0);
    expect(off.dying).toBe(false);
  });
});

describe('robot', () => {
  it('has 4 HP of armour: the knife does at most 2 per stab, bullets clang but hurt', () => {
    const w = arena();
    const p = w.players[0];
    const rb = w.spawn('robot', p.x + 150, undefined, { behavior: 'idle' }) as Robot;
    step(w, 1);
    expect(rb.hp).toBe(4);
    expect(rb.meleeable).toBe(true);
    rb.damage({ amount: 5, kind: 'melee', owner: p, dir: 1 });
    expect(rb.hp).toBe(2);
    expect(rb.dying).toBe(false);
    rb.damage({ amount: 1, kind: 'bullet', owner: p, dir: 1 });
    expect(rb.hp).toBe(1);
    rb.damage({ amount: 5, kind: 'melee', owner: p, dir: 1 });
    expect(rb.dying).toBe(true);
    expect(p.profile.score).toBeGreaterThanOrEqual(300);
  });

  it('charges up before firing energy bolts', () => {
    const w = arena();
    const p = w.players[0];
    const rb = w.spawn('robot', p.x + 150) as Robot;
    let charge = -1;
    until(w, () => {
      if (rb.state === 'charge' && charge < 0) charge = w.time;
      return all(w, EnergyBolt).length > 0;
    });
    expect(charge).toBeGreaterThan(0);
    expect(w.time - charge).toBeGreaterThanOrEqual(0.55);
  });
});

describe('deaths', () => {
  it('every infantry type dies cleanly to bullets, fire and explosions', () => {
    for (const t of TYPES) {
      for (const kind of ['bullet', 'fire', 'explosion'] as const) {
        const w = arena();
        const p = w.players[0];
        const e = w.spawn(t, p.x + 120, undefined, { landed: true, water: false }) as Enemy;
        step(w, 3);
        const victims = e instanceof MortarCrew ? all(w, MortarMan) : [e];
        for (const v of victims) {
          v.damage({ amount: 99, kind, owner: p, dir: 1, x: v.x - 4, y: v.y - 10 });
          // A frontal bullet only shatters the riot shield; the next one kills.
          if (v instanceof ShieldTrooper && kind === 'bullet') {
            expect(v.dying).toBe(false);
            v.damage({ amount: 1, kind, owner: p, dir: 1, x: v.x - 4, y: v.y - 10 });
          }
        }
        step(w, 300);
        for (const v of victims) expect(v.dead, `${t} ${kind}`).toBe(true);
        expect(w.query((q) => q instanceof Infantry && !q.dead).length, `${t} ${kind}`).toBe(0);
      }
    }
  });
});
