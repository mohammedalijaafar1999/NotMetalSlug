// Small shared art helpers for trooper gear (pose tweaks and decorations used by several types).

import type { HumanPose } from '../../art/humanoid';
import { SF, poseShoulder, poseHand, SOLDIER_OX, SOLDIER_OY } from '../../art/soldier';
import type { PixelArt } from '../../engine/pixelart';

/** Frames where the body is upright and unrotated (safe to draw gear relative to the pose). */
export function uprightFrame(f: number): boolean {
  return !(f >= SF.DIE && f < SF.DIE + SF.DIE_N) && f !== SF.BURNT;
}

/** Arm swing for unarmed walkers (gun 'none'): opposite to the legs. */
export function armSwing(f: number, pose: HumanPose): HumanPose {
  if (f >= SF.WALK && f < SF.WALK + SF.WALK_N) {
    const ph = ((f - SF.WALK) / SF.WALK_N) * Math.PI * 2;
    const s = Math.sin(ph);
    return { ...pose, handF: [1.5 - s * 3.5, 8.2 - Math.abs(s) * 0.8], handB: [-1.5 + s * 3.5, 8.6 - Math.abs(s) * 0.8] };
  }
  if (f < SF.WALK) return { ...pose, handF: [2.5, 7.5], handB: [-1.5, 8.5] };
  return pose;
}

/** A tiny hand grenade (Legion issue: brown body, red cap). */
export function drawGrenade(p: PixelArt, x: number, y: number, r = 1.8): void {
  p.circle(x, y, r, '#5a4a3a');
  p.px(Math.round(x - 0.6), Math.round(y - 0.8), '#8a7a5a');
  p.px(Math.round(x), Math.round(y - r - 0.4), '#d84a2a');
}

/** Points along the chest strap drawn by the humanoid rig (torso top-back to front hip). */
export function strapPoints(pose: HumanPose, ts: number[]): [number, number][] {
  const [sx, sy] = poseShoulder(pose);
  const hx = SOLDIER_OX + pose.hip[0];
  const hy = SOLDIER_OY + pose.hip[1];
  const ax = sx - 3;
  const ay = sy + 1;
  const bx = hx + 3;
  const by = hy - 1.5;
  return ts.map((t) => [ax + (bx - ax) * t, ay + (by - ay) * t]);
}

export { poseShoulder, poseHand };
