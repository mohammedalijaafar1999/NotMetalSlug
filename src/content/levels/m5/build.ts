// Level-building helpers for STORMFRONT: place Legion airships and sky barges as matching
// solids + decor (from the shared ship specs, so collision always sits inside the drawn hull),
// and collect spawns. Everything returns plain LevelDef data.

import type { DecorDef, PlatformDef, SolidDef } from '../../../game/level';
import type { SpawnSpec } from '../../../game/registry';
import { SHIPS, shipColliders, shipKeelY, type ShipId } from '../../themes/m5/ships';
import { BARGE_H, shipDecorDef } from '../../themes/m5/decor';

export interface ShipRef {
  id: ShipId;
  /** Ship centre x (world). */
  cx: number;
  /** Deck surface y (world). */
  deckY: number;
  facing: 1 | -1;
  /** Deck span (world). */
  deck0: number;
  deck1: number;
  /** Bottom turret mount y (world): under the gondola or the belly. */
  keelY: number;
  /** Gondola span (world), if any. */
  gondola?: [number, number];
  /** World x of a local (facing right) x. */
  wx(lx: number): number;
}

export class LevelBuilder {
  solids: SolidDef[] = [];
  platforms: PlatformDef[] = [];
  decor: DecorDef[] = [];
  entities: SpawnSpec[] = [];
  ships: ShipRef[] = [];

  /** A Legion airship centred at cx with its dorsal deck surface at deckY. */
  ship(id: ShipId, cx: number, deckY: number, facing: 1 | -1 = -1): ShipRef {
    const s = SHIPS[id];
    for (const r of shipColliders(s)) {
      const x = facing === 1 ? cx + r.x : cx - (r.x + r.w);
      this.solids.push({ x: Math.round(x), y: Math.round(deckY + r.y), w: Math.round(r.w), h: Math.round(r.h), style: 'hull' });
    }
    this.decor.push(shipDecorDef(id, cx, deckY, facing));
    const wx = (lx: number) => cx + lx * facing;
    const d = [wx(s.deck[0]), wx(s.deck[1])].sort((a, b) => a - b);
    const ref: ShipRef = {
      id,
      cx,
      deckY,
      facing,
      deck0: d[0],
      deck1: d[1],
      keelY: deckY + shipKeelY(s),
      gondola: s.gondola ? ([wx(s.gondola.x0), wx(s.gondola.x1)].sort((a, b) => a - b) as [number, number]) : undefined,
      wx,
    };
    this.ships.push(ref);
    return ref;
  }

  /**
   * A sky barge: a flat riveted hull (theme solid texture + deck edge) from x0 to x1 with its deck
   * at deckY, a raked bow and a rounded stern (bow toward `facing`) and lift rotors on masts.
   */
  barge(x0: number, x1: number, deckY: number, facing: 1 | -1 = 1, rotors: number[] = []): void {
    this.solids.push({ x: x0, y: deckY, w: x1 - x0, h: BARGE_H, style: 'barge' });
    if (facing === 1) {
      this.decor.push({ kind: 'm5_cap', x: x1, y: deckY, props: { end: 'bow' } });
      this.decor.push({ kind: 'm5_cap', x: x0 - 22, y: deckY, props: { end: 'stern' } });
    } else {
      this.decor.push({ kind: 'm5_cap', x: x0, y: deckY, props: { end: 'bow', facing: -1 } });
      this.decor.push({ kind: 'm5_cap', x: x1 + 22, y: deckY, props: { end: 'stern', facing: -1 } });
    }
    for (const rx of rotors) this.decor.push({ kind: 'm5_rotor', x: rx, y: deckY, layer: 'back', props: { w: 40 } });
  }

  add(type: string, x: number, y?: number, props?: Record<string, any>, trigger?: number): void {
    const s: SpawnSpec = { type, x };
    if (y !== undefined) s.y = y;
    if (props) s.props = props;
    if (trigger !== undefined) s.trigger = trigger;
    this.entities.push(s);
  }

  deco(kind: string, x: number, y: number, props?: Record<string, any>, layer: 'back' | 'front' = 'back'): void {
    this.decor.push({ kind, x, y, layer, props });
  }

  platform(x: number, y: number, w: number, style = 'catwalk', y2?: number): void {
    this.platforms.push(y2 === undefined ? { x, y, w, style } : { x, y, w, y2, style });
  }

  /** A raised catwalk over a deck at deckY, standing on gantry legs near both ends. */
  gantry(x: number, deckY: number, height: number, w: number): void {
    this.platform(x, deckY - height, w, 'catwalk');
    const h = height - 4;
    this.decor.push({ kind: 'm5_strut', x: x + 5, y: deckY, layer: 'back', props: { h, facing: 1 } });
    this.decor.push({ kind: 'm5_strut', x: x + w - 6, y: deckY, layer: 'back', props: { h, facing: -1 } });
  }
}
