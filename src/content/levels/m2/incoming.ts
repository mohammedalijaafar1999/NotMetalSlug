// Mission 2 fairness helper: m2_incoming telegraphs something entering from a screen edge (a truck
// or jeep coming up behind you in a locked arena), then spawns it.
//
//   { type: 'm2_incoming', x, props: { type: 'truck', props: { ... }, delay: 1.3, y? } }
//
// While waiting, a blinking "!" sign with an arrow sits on the screen edge of the entry side, dust
// kicks up there and an engine rumble pans in from that side. After props.delay seconds the entity
// is spawned at x (props.y, or on the floor) and the helper keeps the lock wave blocked until that
// entity is dead or no longer blocks progress - exactly as if it had been spawned by the wave.

import { Entity } from '../../../game/entity';
import { Z } from '../../../game/constants';
import { VIEW_W } from '../../../engine/renderer';
import { registerEntity } from '../../../game/registry';

const INK = '#140c1c';

export class Incoming extends Entity {
  private childType: string | null;
  private childProps: Record<string, any>;
  private childY: number | undefined;
  private delay: number;
  private t = 0;
  private rumble = 0;
  child: Entity | null = null;

  constructor(props: Record<string, any>) {
    super();
    this.childType = typeof props.type === 'string' ? props.type : null;
    this.childProps = props.props ?? {};
    this.childY = typeof props.y === 'number' ? props.y : undefined;
    this.delay = props.delay ?? 1.3;
    this.blocksProgress = true;
    this.persistent = true;
    this.hittable = false;
    this.team = 'neutral';
    this.z = Z.FRONT;
    this.w = 1;
    this.h = 1;
  }

  /** -1 = enters from the left edge, 1 = from the right. */
  get side(): -1 | 1 {
    const c = this.world.camera;
    return this.x < c.x + VIEW_W / 2 ? -1 : 1;
  }

  /** World x of the warning sign (just inside the entry edge). */
  private edgeX(): number {
    const c = this.world.camera;
    return this.side < 0 ? c.x + 10 : c.x + VIEW_W - 10;
  }

  override spawned(): void {
    if (!this.childType) return;
    this.world.sfx('enemy_alert', this.edgeX(), { vol: 0.8 });
  }

  override update(dt: number): void {
    if (!this.childType) {
      this.remove();
      return;
    }
    if (!this.child) {
      this.t += dt;
      this.rumble -= dt;
      const ex = this.edgeX();
      const floor = this.world.terrain.topFloorAt(ex) ?? this.y;
      if (this.rumble <= 0) {
        this.rumble = 0.4;
        this.world.sfx('engine', ex, { vol: 0.5, pitch: 0.8 });
        this.world.particles.dust(ex - this.side * 4, floor, 3);
      }
      if (this.t >= this.delay) {
        this.child = this.world.spawn(this.childType, this.x, this.childY, this.childProps);
        if (!this.child) this.remove();
      }
      return;
    }
    if (this.child.dead || !this.child.blocksProgress) this.remove();
  }

  override render(g: CanvasRenderingContext2D): void {
    // Shown until the entity has actually rolled into view.
    if (!this.childType || (this.child && (this.child.dead || this.child.onScreen(-12)))) return;
    if (Math.floor(this.age * 6) % 2) return;
    const s = this.side;
    const ex = Math.round(this.edgeX());
    const floor = this.world.terrain.topFloorAt(ex) ?? this.y;
    const y = Math.round(floor - 40);
    // Sign: 11x13 yellow plate with a "!".
    const bx = s < 0 ? ex + 2 : ex - 13;
    g.fillStyle = INK;
    g.fillRect(bx - 1, y - 1, 13, 15);
    g.fillStyle = '#ffd040';
    g.fillRect(bx, y, 11, 13);
    g.fillStyle = '#fff4b0';
    g.fillRect(bx, y, 11, 1);
    g.fillStyle = '#c87818';
    g.fillRect(bx, y + 12, 11, 1);
    g.fillStyle = INK;
    g.fillRect(bx + 4, y + 2, 3, 6);
    g.fillRect(bx + 4, y + 9, 3, 2);
    // Arrow pointing at the edge the threat comes from.
    const ax = s < 0 ? ex - 7 : ex + 7;
    const ay = y + 6;
    for (let i = 0; i < 6; i++) {
      const xx = ax - s * i;
      g.fillStyle = INK;
      g.fillRect(xx, ay - i - 1, 1, i * 2 + 3);
      if (i > 0) {
        g.fillStyle = '#ff5a3a';
        g.fillRect(xx, ay - i + 1, 1, Math.max(1, i * 2 - 1));
      }
    }
  }
}

registerEntity(
  'm2_incoming',
  'misc',
  (_w, s) => new Incoming(s.props ?? {}),
  'Mission 2 lock-wave helper: telegraphs an entity entering from a screen edge (blinking "!" + arrow on that edge, dust, engine rumble), spawns props.type with props.props at x after props.delay (1.3 s) and blocks the wave until it is gone.',
);
