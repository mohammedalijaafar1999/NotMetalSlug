// Standard full-body frame set for humanoid enemies (built on the humanoid rig).
//   defineSoldier('rifleman', RUSTCOAT_STYLE, 'rifle')  ->  sprite 'rifleman' with SF.* frames
// Origin: feet (bottom-center). Facing right; flip at draw time.

import { drawHuman, LEG_FRAMES, type GunKind, type HumanoidStyle } from './humanoid';
import { sprites } from '../engine/sprites';
import { shade } from '../engine/pixelart';

export const SF = {
  IDLE: 0,
  IDLE_N: 2,
  WALK: 2,
  WALK_N: 8,
  AIM: 10,
  FIRE: 11,
  CROUCH_AIM: 12,
  CROUCH_FIRE: 13,
  THROW: 14,
  THROW_N: 2,
  DIE: 16,
  DIE_N: 5,
  PANIC: 21,
  PANIC_N: 2,
  ALERT: 23,
  BURNT: 24,
  AIM_UP: 25,
  FIRE_UP: 26,
  FIDGET: 27,
  FIDGET_N: 2,
  COUNT: 29,
} as const;

export const SOLDIER_W = 52;
export const SOLDIER_H = 50;
export const SOLDIER_OX = 26;
export const SOLDIER_OY = 46;

/** The Rustcoat Legion's standard infantry look. */
export const RUSTCOAT: HumanoidStyle = {
  skin: '#e8b088',
  hair: '#3a2a1a',
  hairStyle: 'short',
  shirt: '#8a7a4a',
  pants: '#6a5a34',
  boots: '#3a2c1e',
  belt: '#2a2016',
  vest: '#a0502a',
  headgear: 'helmet',
  headgearColor: '#7a6a3a',
  headgearAccent: '#a05a2a',
  sleeves: 'long',
  gunColor: '#3a3430',
};

export interface SoldierOpts {
  /** Item held when throwing (default grenade). */
  throwItem?: 'grenade' | 'none';
  /** Called after each frame is drawn (add shields, packs, etc). */
  decorate?: (p: import('../engine/pixelart').PixelArt, frame: number) => void;
}

export function defineSoldier(name: string, style: HumanoidStyle, gun: GunKind, opts: SoldierOpts = {}): void {
  const OX = SOLDIER_OX;
  const OY = SOLDIER_OY;
  sprites.define({
    name,
    w: SOLDIER_W,
    h: SOLDIER_H,
    ox: OX,
    oy: OY,
    frames: SF.COUNT,
    draw: (p, f) => {
      const stand = LEG_FRAMES[0];
      const base = { hip: stand.hip, footB: stand.footB, footF: stand.footF };
      const crouch = LEG_FRAMES[11];
      const aimFwd = gun === 'rocket' ? 0 : 0.05;
      if (f < SF.WALK) {
        // Idle: gun lowered, slight breathing.
        drawHuman(p, OX, OY, { ...base, hip: [0, -13 + (f % 2) * 0.5], gun, aim: gun === 'rocket' ? 0 : 0.5, lean: 0 }, style);
      } else if (f < SF.AIM) {
        const L = LEG_FRAMES[1 + (f - SF.WALK)];
        drawHuman(p, OX, OY, { hip: L.hip, footB: L.footB, footF: L.footF, lean: L.lean, gun, aim: gun === 'rocket' ? 0 : 0.35 }, style);
      } else if (f === SF.AIM || f === SF.FIRE) {
        drawHuman(p, OX, OY, { ...base, gun, aim: aimFwd, recoil: f === SF.FIRE ? 1.5 : 0, expr: f === SF.FIRE ? 'shout' : 'normal' }, style);
      } else if (f === SF.CROUCH_AIM || f === SF.CROUCH_FIRE) {
        drawHuman(p, OX, OY, { hip: crouch.hip, footB: crouch.footB, footF: crouch.footF, lean: 1, gun, aim: aimFwd, recoil: f === SF.CROUCH_FIRE ? 1.5 : 0 }, style);
      } else if (f === SF.THROW || f === SF.THROW + 1) {
        const wind = f === SF.THROW;
        const hf: [number, number] = wind ? [-6, -5] : [7, -4];
        drawHuman(p, OX, OY, { ...base, gun: 'none', handF: hf, handB: [2, 7], lean: wind ? -1 : 1.5, expr: wind ? 'normal' : 'shout' }, style);
        if (opts.throwItem !== 'none') {
          const gx = OX + hf[0] + 0.5;
          const gy = OY - 23 + hf[1];
          p.circle(gx, gy, 1.8, '#5a4a3a');
          p.px(Math.round(gx), Math.round(gy - 2), '#d84a2a');
        }
      } else if (f >= SF.DIE && f < SF.DIE + SF.DIE_N) {
        const k = f - SF.DIE;
        const poses = [
          { hip: [-1, -13], footB: [-1, 0], footF: [3, -1], lean: -3, handF: [4, -6], handB: [-5, -5], expr: 'hurt' },
          { hip: [0, -13], footB: [-3, -3], footF: [4, -4], handF: [5, -7], handB: [-6, -6], expr: 'hurt', rot: -0.6 },
          { hip: [0, -11], footB: [-3, -3], footF: [4, -5], handF: [6, -3], handB: [-6, -2], expr: 'hurt', rot: -1.2, rotPivot: [0, -6] },
          { hip: [0, -13], footB: [-2.5, 0], footF: [2.5, 0], handF: [7, 1], handB: [-6, 2], expr: 'dead', rot: -1.45, rotPivot: [0, -4] },
          { hip: [0, -13], footB: [-1, 0], footF: [2, -1], handF: [3, 8], handB: [-3, 8], expr: 'dead', rot: -1.57, rotPivot: [0, -3.5] },
        ] as any[];
        drawHuman(p, OX, OY, { ...poses[k], gun: 'none' }, style);
      } else if (f === SF.PANIC || f === SF.PANIC + 1) {
        const L = LEG_FRAMES[1 + (f - SF.PANIC) * 4];
        drawHuman(p, OX, OY, { hip: L.hip, footB: L.footB, footF: L.footF, lean: 1, gun: 'none', handF: [3, -9 + (f - SF.PANIC)], handB: [-3, -9], expr: 'shout' }, { ...style });
      } else if (f === SF.ALERT) {
        drawHuman(p, OX, OY, { hip: [0, -14], footB: [-2.5, -1], footF: [2.5, -1], gun, aim: 0.9, expr: 'shout', headDy: -1 }, style);
        p.rect(OX + 6, OY - 44, 2, 5, '#ffe040');
        p.rect(OX + 6, OY - 38, 2, 2, '#ffe040');
      } else if (f === SF.BURNT) {
        drawHuman(p, OX, OY, { hip: [-1, -13], footB: [-1, 0], footF: [3, -1], lean: -2, gun: 'none', handF: [4, -8], handB: [-5, -7], expr: 'hurt' }, style);
        p.mapPixels((v, x, y) => {
          const n = (x * 7 + y * 13) % 5;
          return n === 0 ? 0xff3a3a46 : n === 1 ? 0xff1c1c24 : 0xff262630;
        });
      } else if (f === SF.AIM_UP || f === SF.FIRE_UP) {
        drawHuman(p, OX, OY, { ...base, gun, aim: -Math.PI / 4, recoil: f === SF.FIRE_UP ? 1.5 : 0 }, style);
      } else if (f >= SF.FIDGET && f < SF.FIDGET + SF.FIDGET_N) {
        const k = f - SF.FIDGET;
        drawHuman(p, OX, OY, { ...base, gun: 'none', handF: k ? [3, -9] : [4, -8], handB: [-2, 8], headDx: k ? 0 : 0.5, expr: k ? 'happy' : 'normal' }, style);
      }
      opts.decorate?.(p, f);
    },
  });
}

/** Lighter/darker variant of a style (elite troops, officers). */
export function styleVariant(base: HumanoidStyle, over: Partial<HumanoidStyle>): HumanoidStyle {
  return { ...base, ...over };
}

export { shade };
