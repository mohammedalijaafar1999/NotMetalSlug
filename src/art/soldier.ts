// Standard full-body frame set for humanoid enemies (built on the humanoid rig).
//   defineSoldier('rifleman', RUSTCOAT_STYLE, 'rifle')  ->  sprite 'rifleman' with SF.* frames
// Origin: feet (bottom-center). Facing right; flip at draw time.
//
// Options let a trooper type customise the set without new frame indices:
//   pose(frame, pose)            tweak a frame's pose (arm swing, holding a shield/saber...)
//   underlay(p, frame, pose)     paint things BEHIND the body (fuel tanks, rocket packs)
//   decorate(p, frame, pose)     paint things IN FRONT of the body (shields, bandoliers)
// soldierPose(frame, gun) returns the pose a frame uses (handy for positioning gear).

import { drawHuman, LEG_FRAMES, shoulderOf, type GunKind, type HumanoidStyle, type HumanPose } from './humanoid';
import { sprites } from '../engine/sprites';
import { shade, type PixelArt } from '../engine/pixelart';

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
  // Personality frames (appended; earlier indices are stable).
  /** Sitting asleep against the rifle (2 frames: breathing). */
  SLEEP: 29,
  SLEEP_N: 2,
  /** Chatting: gesturing / laughing. */
  CHAT: 31,
  CHAT_N: 2,
  /** Cowering: crouched, hands over the helmet (2 frames: shaking). */
  COWER: 33,
  COWER_N: 2,
  COUNT: 35,
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
  /** Called after each frame is drawn (add shields, packs, etc). `pose` is the frame's pose. */
  decorate?: (p: PixelArt, frame: number, pose: HumanPose) => void;
  /** Called before each frame's body is drawn (gear behind the soldier). */
  underlay?: (p: PixelArt, frame: number, pose: HumanPose) => void;
  /** Adjust a frame's pose before it is drawn. */
  pose?: (frame: number, pose: HumanPose) => HumanPose;
}

const DEATH_POSES: HumanPose[] = [
  { hip: [-1, -13], footB: [-1, 0], footF: [3, -1], lean: -3, handF: [4, -6], handB: [-5, -5], expr: 'hurt' },
  { hip: [0, -13], footB: [-3, -3], footF: [4, -4], handF: [5, -7], handB: [-6, -6], expr: 'hurt', rot: -0.6 },
  { hip: [0, -11], footB: [-3, -3], footF: [4, -5], handF: [6, -3], handB: [-6, -2], expr: 'hurt', rot: -1.2, rotPivot: [0, -6] },
  // The two lying frames are shifted forward so the head stays inside the canvas.
  { hip: [5, -13], footB: [2.5, 0], footF: [7.5, 0], handF: [7, 1], handB: [-6, 2], expr: 'dead', rot: -1.45, rotPivot: [5, -4] },
  { hip: [6, -13], footB: [5, 0], footF: [8, -1], handF: [3, 8], handB: [-3, 8], expr: 'dead', rot: -1.57, rotPivot: [6, -3.5] },
];

/** The pose used by frame `f` of a soldier set holding `gun`. */
export function soldierPose(f: number, gun: GunKind): HumanPose {
  const stand = LEG_FRAMES[0];
  const base = { hip: stand.hip, footB: stand.footB, footF: stand.footF };
  const crouch = LEG_FRAMES[11];
  const aimFwd = gun === 'rocket' ? 0 : 0.05;
  if (f < SF.WALK) {
    // Idle: gun lowered, slight breathing.
    return { ...base, hip: [0, -13 + (f % 2) * 0.5], gun, aim: gun === 'rocket' ? 0 : 0.5, lean: 0 };
  }
  if (f < SF.AIM) {
    const L = LEG_FRAMES[1 + (f - SF.WALK)];
    return { hip: L.hip, footB: L.footB, footF: L.footF, lean: L.lean, gun, aim: gun === 'rocket' ? 0 : 0.35 };
  }
  if (f === SF.AIM || f === SF.FIRE) {
    return { ...base, gun, aim: aimFwd, recoil: f === SF.FIRE ? 1.5 : 0, expr: f === SF.FIRE ? 'shout' : 'normal' };
  }
  if (f === SF.CROUCH_AIM || f === SF.CROUCH_FIRE) {
    return { hip: crouch.hip, footB: crouch.footB, footF: crouch.footF, lean: 1, gun, aim: aimFwd, recoil: f === SF.CROUCH_FIRE ? 1.5 : 0 };
  }
  if (f === SF.THROW || f === SF.THROW + 1) {
    const wind = f === SF.THROW;
    return { ...base, gun: 'none', handF: wind ? [-6, -5] : [7, -4], handB: [2, 7], lean: wind ? -1 : 1.5, expr: wind ? 'normal' : 'shout' };
  }
  if (f >= SF.DIE && f < SF.DIE + SF.DIE_N) return { ...DEATH_POSES[f - SF.DIE], gun: 'none' };
  if (f === SF.PANIC || f === SF.PANIC + 1) {
    const L = LEG_FRAMES[1 + (f - SF.PANIC) * 4];
    return { hip: L.hip, footB: L.footB, footF: L.footF, lean: 1, gun: 'none', handF: [3, -9 + (f - SF.PANIC)], handB: [-3, -9], expr: 'shout' };
  }
  if (f === SF.ALERT) return { hip: [0, -14], footB: [-2.5, -1], footF: [2.5, -1], gun, aim: 0.9, expr: 'shout', headDy: -1 };
  if (f === SF.BURNT) return { hip: [-1, -13], footB: [-1, 0], footF: [3, -1], lean: -2, gun: 'none', handF: [4, -8], handB: [-5, -7], expr: 'hurt' };
  if (f === SF.AIM_UP || f === SF.FIRE_UP) return { ...base, gun, aim: -Math.PI / 4, recoil: f === SF.FIRE_UP ? 1.5 : 0 };
  if (f >= SF.FIDGET && f < SF.FIDGET + SF.FIDGET_N) {
    const k = f - SF.FIDGET;
    return { ...base, gun: 'none', handF: k ? [3, -9] : [4, -8], handB: [-2, 8], headDx: k ? 0 : 0.5, expr: k ? 'happy' : 'normal' };
  }
  if (f >= SF.SLEEP && f < SF.SLEEP + SF.SLEEP_N) {
    // Sitting on the ground, legs stretched out, hands in the lap, head nodding.
    const k = f - SF.SLEEP;
    return {
      hip: [-3, -4],
      footB: [5, 0],
      footF: [8, 0],
      lean: -0.5 + k * 0.4,
      torso: 9,
      headDx: 1.2 + k * 0.5,
      headDy: 1.2 + k * 0.8,
      gun: 'none',
      handF: [5, 7],
      handB: [4, 8],
      expr: 'happy',
    };
  }
  if (f >= SF.CHAT && f < SF.CHAT + SF.CHAT_N) {
    // Chatting: a big hand gesture (telling a story), then a belly laugh.
    const k = f - SF.CHAT;
    return k === 0
      ? { ...base, gun: 'none', handF: [6, -6], handB: [-1, 8], headDx: 0.5, expr: 'shout' }
      : { ...base, hip: [0, -12.5], gun: 'none', handF: [3, 7], handB: [2, 8], lean: -1.5, headDx: -1, headDy: -0.5, expr: 'happy' };
  }
  if (f >= SF.COWER && f < SF.COWER + SF.COWER_N) {
    const k = f - SF.COWER;
    return { hip: [k * 0.5, -8], footB: [-4.5, 0], footF: [4, 0], lean: 2, gun: 'none', handF: [3, -6], handB: [1, -7], headDx: 0.5 + k * 0.5, headDy: 1, expr: 'hurt' };
  }
  return { ...base, gun };
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
      let pose = soldierPose(f, gun);
      if (opts.pose) pose = opts.pose(f, pose);
      opts.underlay?.(p, f, pose);
      if (f >= SF.SLEEP && f < SF.SLEEP + SF.SLEEP_N && gun !== 'none' && gun !== 'pistol') {
        // The long gun leans against the sleeper's shoulder.
        const gc = style.gunColor ?? '#3c3c48';
        p.capsule(OX - 9, OY - 1, OX - 2, OY - 24, 1.1, gc);
        p.capsule(OX - 9.5, OY - 1, OX - 7.5, OY - 6, 1.6, shade(gc, -0.3));
        p.px(OX - 2, OY - 25, shade(gc, 0.4));
      }
      drawHuman(p, OX, OY, pose, style);
      if ((f === SF.THROW || f === SF.THROW + 1) && opts.throwItem !== 'none' && pose.handF) {
        const gx = OX + pose.handF[0] + 0.5;
        const gy = OY - 23 + pose.handF[1];
        p.circle(gx, gy, 1.8, '#5a4a3a');
        p.px(Math.round(gx), Math.round(gy - 2), '#d84a2a');
      } else if (f === SF.ALERT) {
        p.rect(OX + 6, OY - 44, 2, 5, '#ffe040');
        p.rect(OX + 6, OY - 38, 2, 2, '#ffe040');
      } else if (f === SF.BURNT) {
        p.mapPixels((v, x, y) => {
          const n = (x * 7 + y * 13) % 5;
          return n === 0 ? 0xff3a3a46 : n === 1 ? 0xff1c1c24 : 0xff262630;
        });
      } else if (f >= SF.COWER && f < SF.COWER + SF.COWER_N) {
        // Sweat drops flying off.
        const k = f - SF.COWER;
        p.px(OX - 6 - k, OY - 27 + k, '#bfe6ff');
        p.px(OX + 8 + k, OY - 28 + k, '#bfe6ff');
      }
      opts.decorate?.(p, f, pose);
    },
  });
}

/** Lighter/darker variant of a style (elite troops, officers). */
export function styleVariant(base: HumanoidStyle, over: Partial<HumanoidStyle>): HumanoidStyle {
  return { ...base, ...over };
}

/** Shoulder position (sprite pixels, frame origin at the feet) of a soldier pose. */
export function poseShoulder(pose: HumanPose, ox = SOLDIER_OX, oy = SOLDIER_OY): [number, number] {
  const [sx, sy] = shoulderOf(pose);
  return [ox + sx, oy + sy];
}

// Grip/support distances along the gun axis (mirrors the rig's gun specs).
const GRIP: Partial<Record<GunKind, [number, number]>> = {
  smg: [1, 6],
  rifle: [1, 8],
  sniper: [1, 9],
  heavy: [1, 8],
  shotgun: [1, 7],
  rocket: [0, 6],
  flamer: [1, 7],
};

/**
 * Where a pose's front ('F') or back ('B') hand ends up (sprite pixels, frame origin at the feet).
 * Matches drawHuman for unrotated poses: explicit hands are shoulder-relative, otherwise hands
 * follow the gun axis (or hang at the sides when unarmed).
 */
export function poseHand(pose: HumanPose, which: 'F' | 'B' = 'F', ox = SOLDIER_OX, oy = SOLDIER_OY): [number, number] {
  const [sx, sy] = poseShoulder(pose, ox, oy);
  const h = which === 'F' ? pose.handF : pose.handB;
  if (h) return [sx + h[0], sy + h[1]];
  const gun = pose.noGun ? 'none' : (pose.gun ?? 'none');
  const aim = pose.aim ?? 0;
  const dX = Math.cos(aim);
  const dY = Math.sin(aim);
  const pX = -dY;
  const pY = dX;
  const rec = pose.recoil ?? 0;
  const bx = sx + pX * 1.5 - dX * rec;
  const by = sy + pY * 1.5 - dY * rec;
  const along = (t: number, side: number): [number, number] => [bx + dX * t + pX * side, by + dY * t + pY * side];
  if (gun === 'pistol') return which === 'F' ? along(2.5, 0) : along(1.5, 0.8);
  const g = GRIP[gun];
  if (g) return which === 'F' ? along(g[0] + 1, 0.5) : along(g[1], 0.5);
  return which === 'F' ? [sx + 1.5, sy + 9] : [sx - 1.5, sy + 9];
}

export { shade };
