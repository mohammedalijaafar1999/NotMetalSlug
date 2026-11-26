// Flametrooper: bulky gas-masked trooper with twin fuel tanks. Lumbers in close, lights the
// pilot flame (hiss + flicker = telegraph), then sprays a short flame jet (~60 px) for about a
// second; a ~3 s cycle. 2 HP. On death the fuel tanks sputter and BLOW UP, flinging him away and
// damaging other Legion troops nearby (points to whoever killed him) - never the players.
// props: behavior: patrol|guard|idle|sleep|chat|charge (default patrol), facing, drop,
//        reach: flame length px (default 62)

import { fxRng } from '../../engine/rng';
import { defineSoldier, RUSTCOAT, SF, styleVariant, poseShoulder, poseHand } from '../../art/soldier';
import type { Damage } from '../../game/constants';
import { registerEntity } from '../../game/registry';
import { Infantry } from './infantry';
import { uprightFrame } from './gear';
import { FlameJet } from './projectiles';

export const FLAME_STYLE = styleVariant(RUSTCOAT, {
  shirt: '#8e8676',
  pants: '#6c675c',
  boots: '#2e2a26',
  belt: '#3a2e22',
  vest: '#5e5a4e',
  gloves: '#5a3e26',
  headgear: 'gasmask',
  headgearColor: '#55503f',
  build: 1.18,
  gunColor: '#4a4a52',
});

defineSoldier('flametrooper', FLAME_STYLE, 'flamer', {
  underlay: (p, f, pose) => {
    if (!uprightFrame(f)) return;
    const [sx, sy] = poseShoulder(pose);
    // Twin fuel tanks on the back.
    for (const [dx, c, hi] of [
      [-10.5, '#9a2e1c', '#c8563a'],
      [-7.5, '#b83a22', '#ea7050'],
    ] as const) {
      p.capsule(sx + dx, sy + 0.5, sx + dx, sy + 10.5, 2.4, c);
      p.rect(sx + dx - 1.5, sy + 1, 1, 8, hi);
      p.rect(sx + dx - 2, sy + 5, 4.5, 1.2, '#e8c030');
      p.rect(sx + dx - 2, sy + 6.2, 4.5, 0.8, '#2a2420');
      p.rect(sx + dx - 1, sy - 2.3, 2, 1.5, '#3a3a40');
    }
  },
  decorate: (p, f, pose) => {
    if (!uprightFrame(f) || f >= SF.SLEEP) return;
    // Fuel hose from the tanks to the gun.
    const [sx, sy] = poseShoulder(pose);
    const [hx, hy] = poseHand(pose, 'F');
    const ax = sx - 8;
    const ay = sy + 11;
    const mx = (ax + hx) / 2;
    const my = Math.max(ay, hy) + 3;
    p.line(ax, ay, mx, my, '#22201e');
    p.line(mx, my, hx - 1, hy + 1, '#22201e');
  },
});

export class Flametrooper extends Infantry {
  reach: number;
  jet: FlameJet | null = null;
  private tankBlown = false;
  private killer: Damage['owner'] = null;

  constructor(props: Record<string, any> = {}) {
    super('flametrooper', props);
    this.hp = this.maxHp = 2;
    this.scoreValue = 200;
    this.firstAttack = 0.8;
    this.panicProne = 0.3;
    this.patrolSpeed = 18;
    this.reach = props.reach ?? 62;
    this.deathSfx = 'enemy_die2';
  }

  /** Nozzle position (world). */
  nozzle(): { x: number; y: number } {
    return { x: this.x + this.facing * 16, y: this.y - 21 };
  }

  combat(dt: number): void {
    const t = this.target();
    switch (this.state) {
      case 'engage': {
        if (!t) {
          this.setState('patrol');
          break;
        }
        this.faceTarget(t);
        if (this.checkPanic(dt)) break;
        const dx = Math.abs(t.x - this.x);
        let move = 0;
        if (dx > this.reach - 4) move = this.facing;
        else if (dx < 26) move = -this.facing;
        if (move !== 0 && !this.floorAhead(move)) move = 0;
        this.vx = move * 24;
        this.attackTimer -= dt;
        if (this.attackTimer <= 0 && this.canAttack() && dx < this.reach + 14 && Math.abs(t.cy - this.nozzle().y) < 26) {
          this.vx = 0;
          this.setState('ignite');
          this.sfx('fire_burst', { vol: 0.25, pitch: 1.6 });
        }
        break;
      }
      case 'ignite': {
        // Pilot flame flickers, a hiss of fuel: get out of the way!
        this.vx = 0;
        const n = this.nozzle();
        if (fxRng.chance(dt * 20)) this.world.particles.add({ kind: 'smoke', x: n.x, y: n.y, vx: this.facing * 12, vy: -16, life: 0.4, color: '#8a8478', color2: '#5a5650', size: 1, size2: 3 });
        if (this.stateTime > 0.45) {
          this.jet = this.world.add(new FlameJet(this, this.reach, 0.95));
          this.jet.setOrigin(n.x, n.y, this.facing);
          this.sfx('enemy_flame', { vol: 0.75 });
          this.setState('spray');
        }
        break;
      }
      case 'spray': {
        this.vx = 0;
        const n = this.nozzle();
        if (this.jet && !this.jet.dead) this.jet.setOrigin(n.x, n.y, this.facing);
        if (!this.jet || this.jet.dead || this.jet.stopping) {
          this.jet = null;
          this.setState('cool');
        }
        break;
      }
      case 'cool':
        this.vx = 0;
        if (this.stateTime > 0.4) {
          this.attackTimer = this.fireDelay(1.1);
          this.setState('engage');
        }
        break;
      default:
        this.setState('engage');
    }
  }

  override onDeath(d?: Damage): void {
    this.killer = d?.owner ?? null;
    if (this.jet) {
      this.jet.stop();
      this.jet = null;
    }
    const kind = this.deathKind;
    super.onDeath(d);
    if (kind === 'explosion') {
      // Already blasted: the tanks go up right away.
      this.deathTime = 0.3;
    }
    this.vx *= 0.5;
  }

  override updateDeath(dt: number): void {
    super.updateDeath(dt);
    if (this.tankBlown) return;
    // Leaking tanks sputter...
    const bx = this.x - this.facing * 8;
    const by = this.y - 16;
    if (fxRng.chance(dt * 30)) this.world.particles.sparks(bx, by, 2, '#ffb040', 90);
    if (fxRng.chance(dt * 20)) this.world.particles.add({ kind: 'smoke', x: bx, y: by, vx: fxRng.range(-10, 10), vy: -30, life: 0.5, color: '#ff8a30', color2: '#4a4048', size: 1, size2: 4 });
    if (this.deathTime > 0.38) {
      // ...and blow.
      this.tankBlown = true;
      this.world.explode(bx, by, { radius: 32, damage: 9, team: 'player', owner: this.killer, size: 'large', shake: 4, sfx: 'explosion_big', debris: ['#b83a22', '#e8c030', '#3a3a40', '#5e5a4e'] });
      this.world.particles.smokePuffs(bx, by - 6, 5, 10, '#3a3036', '#1e1a20');
      this.deathKind = 'explosion';
      this.vx = -this.facing * 120;
      this.vy = -300;
      this.onGround = false;
      this.deathDuration = Math.max(this.deathDuration, this.deathTime + 1.5);
    }
  }

  override deathFrame(): number {
    if (!this.tankBlown && this.deathTime < 0.38) return this.deathTime < 0.12 ? SF.DIE : SF.PANIC + (Math.floor(this.deathTime * 16) % 2);
    return super.deathFrame();
  }

  override aliveFrame(): number {
    switch (this.state) {
      case 'ignite':
        return SF.AIM;
      case 'spray':
        return Math.floor(this.stateTime * 18) % 2 ? SF.FIRE : SF.AIM;
      case 'cool':
        return SF.AIM;
    }
    return super.aliveFrame();
  }

  override render(g: CanvasRenderingContext2D): void {
    super.render(g);
    if (this.dying || this.state !== 'ignite') return;
    // Pilot light at the nozzle.
    const n = this.nozzle();
    const big = Math.floor(this.stateTime * 14) % 2 === 0;
    g.fillStyle = '#ffd040';
    g.fillRect(Math.round(n.x), Math.round(n.y) - 1, big ? 2 : 1, big ? 2 : 1);
    g.fillStyle = '#40a0ff';
    g.fillRect(Math.round(n.x - this.facing), Math.round(n.y), 1, 1);
  }
}

registerEntity(
  'flametrooper',
  'enemy',
  (_w, s) => new Flametrooper(s.props),
  'Gas-masked flamethrower trooper, 2 HP: 0.45 s pilot-light telegraph, ~1 s flame jet (~60 px), ~3 s cycle. Fuel tanks explode on death (hurts nearby enemies, not players). props.behavior, reach, facing, drop',
);
