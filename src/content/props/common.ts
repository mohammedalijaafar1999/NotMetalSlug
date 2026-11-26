// Shared base for destructible scenery (barrels, crates, fuel tanks, sandbags, mines).
// Props are team 'neutral' and hittable, so player attacks (and hit-all blasts from other props)
// damage them; enemy attacks pass through. The last thing that hit a prop is remembered so a chain
// reaction still credits the player who started it.

import { Actor, type Entity } from '../../game/entity';
import { Z, type Damage, type DamageKind } from '../../game/constants';
import { fxRng } from '../../engine/rng';

export abstract class Prop extends Actor {
  /** Who (ultimately) hit it last - explosions it causes are credited to them. */
  lastHitter: Entity | null = null;
  /** Damage kinds this prop ignores (the hit does not connect). */
  immune: DamageKind[] = [];
  /** Destroyed (wreck/rubble may linger). */
  broken = false;

  constructor() {
    super();
    this.team = 'neutral';
    this.hittable = true;
    this.z = Z.PROP;
  }

  override damage(d: Damage): boolean {
    if (this.dead || !this.hittable || this.broken) return false;
    if (this.immune.includes(d.kind)) return false;
    if (d.owner) this.lastHitter = d.owner;
    this.hp -= d.amount;
    this.flash = 0.07;
    this.onHit(d);
    if (this.hp <= 0) {
      this.hp = 0;
      this.hittable = false;
      this.broken = true;
      this.world.invalidateTargets();
      this.destroyProp(d);
    }
    return true;
  }

  /** Hook: took a hit (still standing or not). */
  onHit(_d: Damage): void {}

  /** Hook: hp reached 0. Remove yourself (or switch to a wreck state). */
  abstract destroyProp(d: Damage): void;

  /** Little wobble offset while flashing (px). */
  protected get jiggle(): number {
    return this.flash > 0 ? (fxRng.chance(0.5) ? 1 : -1) : 0;
  }
}
