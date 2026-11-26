// Humanoid rig: draws a chunky pixel-art soldier from a pose (joint positions solved with IK)
// and a style (colors, headgear, gear). Players and every infantry enemy use this so the cast
// shares one consistent look. Characters are always drawn FACING RIGHT; flip at draw time.
//
// Local pose coordinates: origin = feet (ground contact, between the feet), +x forward,
// -y up (canvas convention). A standing hip is at about (0, -13), shoulders ~10px above the hip.

import { PixelArt, shade } from '../engine/pixelart';
import { sprites } from '../engine/sprites';

export type Headgear = 'none' | 'helmet' | 'bandana' | 'beret' | 'cap' | 'beanie' | 'hood' | 'officer' | 'goggles' | 'gasmask' | 'turban';
export type HairStyle = 'short' | 'long' | 'ponytail' | 'bald' | 'mohawk' | 'spiky' | 'bob';
export type GunKind = 'none' | 'pistol' | 'rifle' | 'heavy' | 'rocket' | 'shotgun' | 'flamer' | 'knife' | 'grenade' | 'sniper' | 'smg';

export interface HumanoidStyle {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  pants: string;
  boots: string;
  belt?: string;
  vest?: string;
  strap?: string;
  gloves?: string;
  headgear: Headgear;
  headgearColor?: string;
  /** Second headgear color (bandana tails, helmet band, badge). */
  headgearAccent?: string;
  beard?: string;
  mustache?: string;
  sunglasses?: boolean;
  backpack?: string;
  scarf?: string;
  /** Width multiplier (1 normal, 1.2 big). */
  build?: number;
  /** Height offset in px (taller/shorter torso). */
  tall?: number;
  sleeves?: 'long' | 'short';
  gunColor?: string;
  eye?: string;
}

export interface HumanPose {
  hip: [number, number];
  footB: [number, number];
  footF: [number, number];
  /** Shoulder x offset relative to hip. */
  lean?: number;
  /** Torso length hip->shoulder (default 10). */
  torso?: number;
  headDx?: number;
  headDy?: number;
  gun?: GunKind;
  /** Aim angle (0 forward, -PI/2 up, +PI/2 down). */
  aim?: number;
  /** Gun pulled back by px (firing frame). */
  recoil?: number;
  /** Explicit hand positions relative to the shoulder (override gun-derived ones). */
  handF?: [number, number];
  handB?: [number, number];
  /** Whole-body rotation (radians) around rotPivot (default hip). */
  rot?: number;
  rotPivot?: [number, number];
  expr?: 'normal' | 'shout' | 'hurt' | 'dead' | 'happy';
  part?: 'full' | 'lower' | 'upper';
  /** Hide the gun (e.g. knife/throw anims draw their own). */
  noGun?: boolean;
}

const OUT = '#140c1c';
export const THIGH = 7;
export const SHIN = 7;
const UPPER_ARM = 5;
const FOREARM = 5;

/** Two-bone IK. Returns [jointX, jointY, endX, endY]. bend: +1/-1 picks the elbow/knee side. */
export function ik2(ax: number, ay: number, tx: number, ty: number, l1: number, l2: number, bend: number): [number, number, number, number] {
  let dx = tx - ax;
  let dy = ty - ay;
  let d = Math.hypot(dx, dy);
  const maxD = (l1 + l2) * 0.999;
  if (d > maxD) {
    dx *= maxD / d;
    dy *= maxD / d;
    d = maxD;
  }
  if (d < 0.001) d = 0.001;
  const th = Math.atan2(dy, dx);
  const c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const al = Math.acos(Math.max(-1, Math.min(1, c)));
  const ja = th - al * bend;
  return [ax + Math.cos(ja) * l1, ay + Math.sin(ja) * l1, ax + dx, ay + dy];
}

/** Gun geometry along its axis: [back, front] extents and thickness. */
const GUN_SPECS: Record<string, { back: number; front: number; thick: number; grip: number; support: number }> = {
  pistol: { back: 0, front: 7, thick: 1.6, grip: 1, support: 1 },
  smg: { back: -2, front: 10, thick: 1.8, grip: 1, support: 6 },
  rifle: { back: -4, front: 13, thick: 1.6, grip: 1, support: 8 },
  sniper: { back: -5, front: 16, thick: 1.5, grip: 1, support: 9 },
  heavy: { back: -4, front: 14, thick: 2.2, grip: 1, support: 8 },
  shotgun: { back: -4, front: 13, thick: 2.0, grip: 1, support: 7 },
  rocket: { back: -9, front: 11, thick: 2.6, grip: 0, support: 6 },
  flamer: { back: -3, front: 12, thick: 2.2, grip: 1, support: 7 },
};

/** Where the bullet comes out, relative to the shoulder, for a gun/aim. */
export function muzzleFromShoulder(gun: GunKind, aim: number): [number, number] {
  const spec = GUN_SPECS[gun] ?? GUN_SPECS.pistol;
  const d = gun === 'pistol' ? 3 : 1.5;
  const len = spec.front + (gun === 'pistol' ? 3 : 1);
  const px = -Math.sin(aim);
  const py = Math.cos(aim);
  // Gun axis passes slightly below the shoulder (perpendicular offset).
  return [Math.cos(aim) * (len + d) + px * 1.5, Math.sin(aim) * (len + d) + py * 1.5];
}

/** Shoulder position relative to the feet for a pose. */
export function shoulderOf(pose: HumanPose): [number, number] {
  return [pose.hip[0] + (pose.lean ?? 0), pose.hip[1] - (pose.torso ?? 10)];
}

export function drawHuman(p: PixelArt, ox: number, oy: number, pose: HumanPose, st: HumanoidStyle): void {
  const part = pose.part ?? 'full';
  const b = st.build ?? 1;
  const rot = pose.rot ?? 0;
  const [pvx, pvy] = pose.rotPivot ?? pose.hip;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const T = (x: number, y: number): [number, number] => {
    const dx = x - pvx;
    const dy = y - pvy;
    return [ox + pvx + dx * cs - dy * sn, oy + pvy + dx * sn + dy * cs];
  };
  const poly = (pts: [number, number][], c: string) => {
    const flat: number[] = [];
    for (const [x, y] of pts) {
      const [X, Y] = T(x, y);
      flat.push(X, Y);
    }
    p.poly(flat, c);
  };
  const cap = (a: [number, number], c2: [number, number], r: number, col: string) => {
    const [x0, y0] = T(a[0], a[1]);
    const [x1, y1] = T(c2[0], c2[1]);
    p.capsule(x0, y0, x1, y1, r, col);
  };
  const circ = (c: [number, number], r: number, col: string) => {
    const [x, y] = T(c[0], c[1]);
    p.circle(x, y, r, col);
  };
  const dot = (c: [number, number], col: string) => {
    const [x, y] = T(c[0], c[1]);
    p.px(Math.floor(x), Math.floor(y), col);
  };

  const pantsD = shade(st.pants, -0.28);
  const bootsD = shade(st.boots, -0.3);
  const shirtD = shade(st.shirt, -0.25);
  const skinD = shade(st.skin, -0.2);
  const hip = pose.hip;

  // ------------------------------------------------------------- legs
  const drawLeg = (foot: [number, number], back: boolean) => {
    const hx = hip[0] + (back ? -1 : 1) * b;
    const hy = hip[1] + 1;
    const [kx, ky] = ik2(hx, hy, foot[0], foot[1] - 2.5, THIGH, SHIN, 1);
    const pc = back ? pantsD : st.pants;
    cap([hx, hy], [kx, ky], 2.1 * b, pc);
    cap([kx, ky], [foot[0] - 0.3, foot[1] - 3], 1.7 * b, pc);
    // Boot: a little wedge pointing forward.
    const bc = back ? bootsD : st.boots;
    const fx = foot[0];
    const fy = foot[1];
    poly(
      [
        [fx - 2.2 * b, fy - 4],
        [fx + 1.5 * b, fy - 4],
        [fx + 3.6 * b, fy - 1.6],
        [fx + 3.6 * b, fy],
        [fx - 2.4 * b, fy],
      ],
      bc,
    );
    dot([fx + 2.5 * b, fy - 2.5], shade(bc, 0.25));
  };

  const drawLower = () => {
    drawLeg(pose.footB, true);
    // Pelvis.
    poly(
      [
        [hip[0] - 4.2 * b, hip[1] - 1],
        [hip[0] + 4 * b, hip[1] - 1],
        [hip[0] + 3.6 * b, hip[1] + 3],
        [hip[0] - 3.8 * b, hip[1] + 3],
      ],
      st.pants,
    );
    drawLeg(pose.footF, false);
  };

  // ------------------------------------------------------------- upper body
  const [sx, sy] = shoulderOf(pose);
  const torsoTop: [number, number] = [sx, sy - (st.tall ?? 0)];
  const aim = pose.aim ?? 0;
  const gun = pose.noGun ? 'none' : (pose.gun ?? 'none');
  const dX = Math.cos(aim);
  const dY = Math.sin(aim);
  const pX = -dY; // perpendicular (below the barrel)
  const pY = dX;
  const spec = GUN_SPECS[gun];
  const recoil = pose.recoil ?? 0;
  const gunBase: [number, number] = [sx + pX * 1.5 - dX * recoil, sy + pY * 1.5 - dY * recoil];
  const along = (t: number, side = 0): [number, number] => [gunBase[0] + dX * t + pX * side, gunBase[1] + dY * t + pY * side];

  let handF: [number, number];
  let handB: [number, number];
  if (pose.handF) handF = [sx + pose.handF[0], sy + pose.handF[1]];
  else if (gun === 'pistol') handF = along(2.5);
  else if (spec) handF = along(spec.grip + 1, 0.5);
  else handF = [sx + 1.5, sy + 9];
  if (pose.handB) handB = [sx + pose.handB[0], sy + pose.handB[1]];
  else if (gun === 'pistol') handB = along(1.5, 0.8);
  else if (spec) handB = along(spec.support, 0.5);
  else handB = [sx - 1.5, sy + 9];

  const arm = (shoulder: [number, number], hand: [number, number], back: boolean) => {
    const [ex1, ey1] = ik2(shoulder[0], shoulder[1], hand[0], hand[1], UPPER_ARM, FOREARM, 1);
    const [ex2, ey2] = ik2(shoulder[0], shoulder[1], hand[0], hand[1], UPPER_ARM, FOREARM, -1);
    // Prefer the elbow that points down/back.
    const elbow: [number, number] = ey1 + (back ? 0 : 0) > ey2 ? [ex1, ey1] : [ex2, ey2];
    const sleeve = back ? shirtD : st.shirt;
    const fore = st.sleeves === 'short' ? (back ? skinD : st.skin) : sleeve;
    cap(shoulder, elbow, 1.8 * b, sleeve);
    cap(elbow, hand, 1.5 * b, fore);
    circ(hand, 1.4 * b, st.gloves ? (back ? shade(st.gloves, -0.2) : st.gloves) : back ? skinD : st.skin);
  };

  const drawGun = () => {
    if (!spec) return;
    const gc = st.gunColor ?? '#3c3c48';
    const gd = shade(gc, -0.35);
    const gl = shade(gc, 0.35);
    if (gun === 'rocket') {
      cap(along(spec.back), along(spec.front), spec.thick, '#4a5a3a');
      cap(along(spec.front - 2), along(spec.front), spec.thick + 0.6, '#2e3826');
      cap(along(spec.back), along(spec.back + 2), spec.thick + 0.4, '#2e3826');
      cap(along(2, 2), along(4, 3.5), 1, gd);
      return;
    }
    if (gun === 'flamer') {
      cap(along(spec.back), along(spec.front - 3), spec.thick, gc);
      cap(along(spec.front - 4), along(spec.front), 1.1, gl);
      cap(along(0, 2.5), along(5, 2.5), 1.6, '#b83a22');
      return;
    }
    cap(along(spec.back), along(spec.front), spec.thick * 0.7, gc);
    cap(along(spec.back + 1), along(spec.front - 1), spec.thick * 0.35, gl);
    if (gun !== 'pistol') {
      // Stock, magazine and grip.
      cap(along(spec.back, 0.6), along(spec.back + 3, 0.6), spec.thick, gd);
      cap(along(4, 1.5), along(4.5, 3.5), 1, gd);
      if (gun === 'heavy') cap(along(spec.front - 4, -1), along(spec.front, -1), 1, gl);
      if (gun === 'shotgun') cap(along(5, 1.6), along(9, 1.6), 1.2, '#6a4a2a');
      if (gun === 'sniper') cap(along(2, -2), along(7, -2), 1, gd);
    } else {
      cap(along(1, 1.2), along(1.5, 3), 1, gd);
    }
  };

  const drawHead = () => {
    const hx = sx + 0.5 + (pose.headDx ?? 0);
    const hy = torsoTop[1] - 5.5 + (pose.headDy ?? 0);
    const H: [number, number] = [hx, hy];
    const at = (dx: number, dy: number): [number, number] => [hx + dx, hy + dy];
    // Neck.
    cap(at(-0.5, 3), at(-0.5, 5.5), 1.6, skinD);
    // Hair base (behind the face).
    const hs = st.hairStyle;
    if (hs === 'long') poly([at(-5, -2), at(0, -2), at(-0.5, 7), at(-5.5, 7)], st.hair);
    if (hs === 'ponytail') cap(at(-4.5, -1), at(-7, 4), 1.6, st.hair);
    if (hs === 'bob') poly([at(-5, -2), at(1, -2), at(0.5, 4), at(-5.2, 4)], st.hair);
    // Face.
    circ(H, 4.8, st.skin);
    circ(at(2.5, 1.2), 2.3, st.skin); // jaw/nose forward
    dot(at(4.6, 0.2), skinD); // nose tip shade
    if (hs !== 'bald') {
      circ(at(-1.2, -1.6), 4.1, st.hair);
      circ(at(1.4, -3), 2.6, st.hair);
      if (hs === 'mohawk') poly([at(-3, -5), at(2, -6.5), at(3, -5)], st.hair);
      if (hs === 'spiky') {
        poly([at(-4, -4), at(-6.5, -5.5), at(-3, -6)], st.hair);
        poly([at(-1, -5), at(-1.5, -8), at(1.5, -6)], st.hair);
        poly([at(2, -5), at(4.5, -6.5), at(3.5, -4)], st.hair);
      }
      // Sideburn.
      dot(at(0, 0.5), st.hair);
    }
    // Ear.
    dot(at(-0.6, 0.6), skinD);
    // Eyes.
    const eye = st.eye ?? '#1a1420';
    const expr = pose.expr ?? 'normal';
    if (st.sunglasses) {
      cap(at(1.6, -0.5), at(4.4, -0.5), 1.0, '#1a1a24');
      dot(at(3, -1), '#7a8aa8');
    } else if (expr === 'dead') {
      dot(at(2.5, -1.2), eye);
      dot(at(3.5, -0.2), eye);
      dot(at(3.5, -1.2), eye);
      dot(at(2.5, -0.2), eye);
    } else if (expr === 'happy') {
      dot(at(2.5, -0.8), eye);
      dot(at(3.5, -0.8), eye);
    } else {
      dot(at(3, -1.3), eye);
      dot(at(3, -0.3), eye);
      dot(at(2, -2.2), shade(st.hair, -0.1)); // brow
      dot(at(3, -2.3), shade(st.hair, -0.1));
    }
    if (st.beard) poly([at(0.5, 1), at(4.8, 1.5), at(4, 4.5), at(1, 4.5)], st.beard);
    if (st.mustache) cap(at(2.5, 2), at(4.6, 2), 0.7, st.mustache);
    if (expr === 'shout' || expr === 'hurt') {
      dot(at(3.8, 2.6), '#5a1a1a');
      dot(at(4.3, 2.6), '#5a1a1a');
      dot(at(3.8, 3.4), '#5a1a1a');
    } else if (!st.beard && !st.mustache) {
      dot(at(3.8, 2.6), skinD);
    }
    // Headgear.
    const hc = st.headgearColor ?? '#556b2f';
    const hd = shade(hc, -0.3);
    const ha = st.headgearAccent ?? shade(hc, 0.3);
    switch (st.headgear) {
      case 'helmet':
        poly([at(-5.8, -0.5), at(-5.5, -4), at(-3, -6.6), at(1, -7), at(4.4, -5), at(5.9, -1.4), at(6.4, -0.5)], hc);
        poly([at(-5.8, -0.5), at(6.4, -0.5), at(6.4, 0.6), at(-5.8, 0.6)], hd);
        dot(at(-1, -5.5), ha);
        dot(at(0, -5.8), ha);
        cap(at(-1.5, 0.8), at(1.5, 4.2), 0.5, hd);
        break;
      case 'bandana':
        cap(at(-4.8, -2.6), at(4.8, -2.6), 1.2, hc);
        cap(at(-5, -2.2), at(-8, -0.8), 0.9, hc);
        cap(at(-5, -2.2), at(-7.5, 1.2), 0.9, ha);
        break;
      case 'beret':
        poly([at(-5, -3), at(-3, -6.5), at(2, -7), at(5.5, -5), at(5, -3.5)], hc);
        dot(at(3.5, -5.5), ha);
        cap(at(-5, -3), at(5, -3.5), 0.6, hd);
        break;
      case 'cap':
        poly([at(-5, -2.5), at(-4, -6), at(1, -7), at(4, -5.5), at(4.5, -2.5)], hc);
        poly([at(3, -3.5), at(8, -2.4), at(8, -1.6), at(3, -1.8)], hd);
        dot(at(0, -5.8), ha);
        break;
      case 'beanie':
        poly([at(-5.2, -1.8), at(-4.5, -6), at(0, -7.5), at(4.5, -6), at(5.2, -1.8)], hc);
        cap(at(-5.2, -1.8), at(5.2, -1.8), 1, hd);
        circ(at(0, -7.8), 1.3, ha);
        break;
      case 'hood':
        poly([at(-6, 5), at(-6.4, -2), at(-3, -6.8), at(2, -7), at(5.6, -3.6), at(5.6, -1.6), at(1.2, -1.6), at(1, 2.5), at(5.5, 2.5), at(5, 5)], hc);
        dot(at(3, -0.6), eye);
        break;
      case 'officer':
        poly([at(-5.5, -2.5), at(-6, -5.5), at(-2, -8), at(4, -7.5), at(6, -5.5), at(5.5, -2.5)], hc);
        poly([at(2.5, -3), at(8, -2.2), at(7.5, -1.5), at(2.5, -1.6)], '#1a1a20');
        cap(at(-5.5, -3), at(5.5, -3), 0.8, ha);
        dot(at(1.5, -5.5), '#f0d040');
        break;
      case 'goggles':
        poly([at(-5.6, -0.5), at(-5, -4.5), at(-2, -6.6), at(2, -6.8), at(5, -4.8), at(6, -1)], hc);
        cap(at(1.2, -1.5), at(5.2, -1.5), 1.3, '#2a2a30');
        dot(at(3, -2), '#8ad8ff');
        dot(at(4.5, -2), '#8ad8ff');
        break;
      case 'gasmask':
        poly([at(-5.8, -0.5), at(-5.5, -4), at(-3, -6.6), at(1, -7), at(4.4, -5), at(5.9, -1.4), at(6.4, -0.5)], hc);
        poly([at(1, -2), at(5.5, -2.2), at(6, 3), at(2, 4.5)], '#3a3a40');
        circ(at(3.6, -0.6), 1.2, '#c0302a');
        circ(at(5.8, 2.6), 1.6, '#55555e');
        break;
      case 'turban':
        poly([at(-5.4, -1.6), at(-5.6, -5), at(-2, -8), at(3, -7.6), at(5.6, -4.6), at(5.2, -1.6)], hc);
        cap(at(-5, -3.5), at(5, -5), 0.6, ha);
        break;
      default:
        break;
    }
  };

  const drawTorso = () => {
    const tt = torsoTop;
    // Backpack behind.
    if (st.backpack) {
      poly([at2(tt, -7.5 * b, 1), at2(tt, -3.5 * b, 0.5), at2(tt, -3.5 * b, 9), at2(tt, -8 * b, 9)], st.backpack);
      dot(at2(tt, -6.5 * b, 3), shade(st.backpack, 0.3));
    }
    poly(
      [
        [hip[0] - 4.3 * b, hip[1] + 0.5],
        [hip[0] + 4 * b, hip[1] + 0.5],
        [tt[0] + 4.6 * b, tt[1] + 1.5],
        [tt[0] + 3.8 * b, tt[1] - 0.6],
        [tt[0] - 4.8 * b, tt[1] - 0.6],
        [tt[0] - 5 * b, tt[1] + 2],
      ],
      st.shirt,
    );
    // Back shading strip.
    poly(
      [
        [hip[0] - 4.3 * b, hip[1] + 0.5],
        [hip[0] - 2.2 * b, hip[1] + 0.5],
        [tt[0] - 2.8 * b, tt[1] + 0.5],
        [tt[0] - 5 * b, tt[1] + 2],
      ],
      shirtD,
    );
    if (st.vest) {
      poly(
        [
          [hip[0] - 3.6 * b, hip[1] - 1.5],
          [hip[0] + 3.4 * b, hip[1] - 1.5],
          [tt[0] + 3.6 * b, tt[1] + 2.5],
          [tt[0] + 1.5 * b, tt[1] + 0.5],
          [tt[0] - 3.8 * b, tt[1] + 1],
          [tt[0] - 4.2 * b, tt[1] + 3],
        ],
        st.vest,
      );
      dot([tt[0] + 1.5 * b, tt[1] + 5], shade(st.vest, -0.3));
      dot([tt[0] + 1.5 * b, tt[1] + 7], shade(st.vest, -0.3));
    }
    if (st.strap) cap([tt[0] - 3 * b, tt[1] + 1], [hip[0] + 3 * b, hip[1] - 1.5], 0.8, st.strap);
    if (st.scarf) cap([tt[0] - 3, tt[1] + 0.5], [tt[0] + 3.5, tt[1] + 0.5], 1.3, st.scarf);
    const belt = st.belt ?? '#3a2a1a';
    poly(
      [
        [hip[0] - 4.3 * b, hip[1] - 1.6],
        [hip[0] + 4.1 * b, hip[1] - 1.6],
        [hip[0] + 4.1 * b, hip[1] + 0.6],
        [hip[0] - 4.3 * b, hip[1] + 0.6],
      ],
      belt,
    );
    dot([hip[0] + 2 * b, hip[1] - 0.6], '#d8b040');
  };

  function at2(base: [number, number], dx: number, dy: number): [number, number] {
    return [base[0] + dx, base[1] + dy];
  }

  if (part === 'lower' || part === 'full') drawLower();
  if (part === 'upper' || part === 'full') {
    const shB: [number, number] = [sx - 1.5 * b, sy + 1];
    const shF: [number, number] = [sx + 1 * b, sy + 1.2];
    const twoHandedBehind = gun !== 'none' && gun !== 'pistol' && !pose.handB;
    // Back arm (behind torso).
    if (!twoHandedBehind) arm(shB, handB, true);
    drawTorso();
    drawHead();
    if (twoHandedBehind) arm(shB, handB, true);
    drawGun();
    arm(shF, handF, false);
  }
  void OUT;
}

// ------------------------------------------------------------------ standard animation sets

export interface LegFrame {
  hip: [number, number];
  footB: [number, number];
  footF: [number, number];
  lean: number;
}

/** Standard lower-body frames used by players and soldiers. */
export const LEG_FRAMES: LegFrame[] = (() => {
  const f: LegFrame[] = [];
  // 0 stand
  f.push({ hip: [0, -13], footB: [-2.5, 0], footF: [2.5, 0], lean: 0 });
  // 1..8 run cycle
  for (let i = 0; i < 8; i++) {
    const ph = (i / 8) * Math.PI * 2;
    const fx = Math.sin(ph) * 5.5;
    const fl = Math.max(0, Math.cos(ph)) * 4.5;
    const bx = Math.sin(ph + Math.PI) * 5.5;
    const bl = Math.max(0, Math.cos(ph + Math.PI)) * 4.5;
    const bob = Math.abs(Math.cos(ph)) * 1.2;
    f.push({ hip: [0.5, -12.6 - bob * 0.8], footB: [bx, -bl], footF: [fx, -fl], lean: 1 });
  }
  // 9 jump (rising)
  f.push({ hip: [0, -14], footB: [-3.5, -4.5], footF: [3, -6.5], lean: 0 });
  // 10 fall
  f.push({ hip: [0, -13.5], footB: [-2.5, -2], footF: [3.5, -1.2], lean: 0 });
  // 11 crouch
  f.push({ hip: [0, -8], footB: [-4.5, 0], footF: [4.5, 0], lean: 1.5 });
  // 12..15 crouch walk
  for (let i = 0; i < 4; i++) {
    const ph = (i / 4) * Math.PI * 2;
    f.push({ hip: [0, -8 - Math.abs(Math.sin(ph)) * 0.6], footB: [-4 + Math.sin(ph) * 2, -Math.max(0, Math.sin(ph)) * 1.5], footF: [4 - Math.sin(ph) * 2, -Math.max(0, -Math.sin(ph)) * 1.5], lean: 1.5 });
  }
  // 16 land / squat
  f.push({ hip: [0, -10.5], footB: [-3.5, 0], footF: [3.5, 0], lean: 1 });
  return f;
})();

export const LEG = { STAND: 0, RUN: 1, RUN_N: 8, JUMP: 9, FALL: 10, CROUCH: 11, CWALK: 12, CWALK_N: 4, LAND: 16 } as const;

/** Five aim directions used by upper-body sprite sets. */
export const AIMS = [0, -Math.PI / 4, -Math.PI / 2, Math.PI / 4, Math.PI / 2];

/** Index into AIMS nearest to an angle. */
export function aimIndex(angle: number): number {
  let best = 0;
  let bd = Infinity;
  AIMS.forEach((a, i) => {
    const d = Math.abs(Math.atan2(Math.sin(angle - a), Math.cos(angle - a)));
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

// Canvas layouts for the standard sprite sets.
export const LEGS_W = 32;
export const LEGS_H = 26;
export const LEGS_OX = 15;
export const LEGS_OY = 24;
export const UPPER_W = 52;
export const UPPER_H = 50;
export const UPPER_OX = 22; // hip x in the upper canvas
export const UPPER_OY = 33; // hip y in the upper canvas
export const BODY_W = 52;
export const BODY_H = 50;
export const BODY_OX = 26;
export const BODY_OY = 46;

/**
 * Define the standard player-style sprite set for a style:
 *   `${name}_legs`         LEG_FRAMES (origin: feet)
 *   `${name}_up_${gun}`    10 frames: AIMS[i] (frame i) and AIMS[i] firing (frame 5+i)  (origin: hip)
 *   `${name}_throw`        2 frames (wind-up, release) (origin: hip)
 *   `${name}_knife`        3 frames (origin: hip)
 *   `${name}_body`         full body extras (origin: feet):
 *        0-4 death (hit, airborne, falling, landed, flat), 5-6 victory, 7 dropping in (arms up), 8 idle look
 */
export function defineHumanoidSet(name: string, style: HumanoidStyle, guns: GunKind[] = ['pistol', 'heavy']): void {
  sprites.define({
    name: `${name}_legs`,
    w: LEGS_W,
    h: LEGS_H,
    ox: LEGS_OX,
    oy: LEGS_OY,
    frames: LEG_FRAMES.length,
    draw: (p, f) => {
      const L = LEG_FRAMES[f];
      drawHuman(p, LEGS_OX, LEGS_OY, { hip: L.hip, footB: L.footB, footF: L.footF, part: 'lower' }, style);
    },
  });
  for (const gun of guns) {
    sprites.define({
      name: `${name}_up_${gun}`,
      w: UPPER_W,
      h: UPPER_H,
      ox: UPPER_OX,
      oy: UPPER_OY,
      frames: 10,
      draw: (p, f) => {
        const aim = AIMS[f % 5];
        const firing = f >= 5;
        // Hip at (UPPER_OX, UPPER_OY): feet origin is 13px below.
        drawHuman(
          p,
          UPPER_OX,
          UPPER_OY + 13,
          { hip: [0, -13], footB: [-2, 0], footF: [2, 0], part: 'upper', gun, aim, recoil: firing ? 1.5 : 0, lean: aim > 0.5 ? -0.5 : 0, headDx: aim < -1 ? -0.5 : 0, expr: firing ? 'shout' : 'normal' },
          style,
        );
      },
    });
  }
  sprites.define({
    name: `${name}_throw`,
    w: UPPER_W,
    h: UPPER_H,
    ox: UPPER_OX,
    oy: UPPER_OY,
    frames: 2,
    draw: (p, f) => {
      const hf: [number, number] = f === 0 ? [-6, -5] : [7, -3];
      drawHuman(p, UPPER_OX, UPPER_OY + 13, { hip: [0, -13], footB: [-2, 0], footF: [2, 0], part: 'upper', gun: 'none', handF: hf, handB: [3, 6], lean: f === 0 ? -1 : 1.5 }, style);
      // Grenade in hand.
      const gx = UPPER_OX + (f === 0 ? -6 : 7) + 1;
      const gy = UPPER_OY + 13 - 13 - 10 + (f === 0 ? -5 : -3) + 1;
      p.circle(gx, gy, 1.8, '#4a5a2a');
      p.px(gx, gy - 2, '#a0a0a0');
    },
  });
  sprites.define({
    name: `${name}_knife`,
    w: UPPER_W,
    h: UPPER_H,
    ox: UPPER_OX,
    oy: UPPER_OY,
    frames: 3,
    draw: (p, f) => {
      const hand: [number, number][] = [
        [-3, -4],
        [8, 2],
        [6, 7],
      ];
      const hf = hand[f];
      drawHuman(p, UPPER_OX, UPPER_OY + 13, { hip: [0, -13], footB: [-2, 0], footF: [2, 0], part: 'upper', gun: 'none', handF: hf, handB: [-2, 7], lean: f === 0 ? -1 : 2, expr: 'shout' }, style);
      // Blade.
      const hx = UPPER_OX + hf[0] + 1;
      const hy = UPPER_OY - 10 + hf[1];
      const ang = [-2.3, 0.1, 1.0][f];
      const bx = hx + Math.cos(ang) * 7;
      const by = hy + Math.sin(ang) * 7;
      p.capsule(hx, hy, bx, by, 0.8, '#dfe6ee');
      p.px(Math.floor(bx), Math.floor(by), '#ffffff');
      if (f === 1) {
        for (let i = 0; i < 6; i++) p.px(hx + 6 + i, hy - 6 + i * 2, '#ffffff');
      }
    },
  });
  sprites.define({
    name: `${name}_body`,
    w: BODY_W,
    h: BODY_H,
    ox: BODY_OX,
    oy: BODY_OY,
    frames: 9,
    draw: (p, f) => {
      const base = { footB: [-2.5, 0] as [number, number], footF: [2.5, 0] as [number, number] };
      switch (f) {
        case 0: // hit
          drawHuman(p, BODY_OX, BODY_OY, { hip: [-1, -13], footB: [-1, 0], footF: [3, -1], lean: -3, gun: 'none', handF: [4, -6], handB: [-5, -5], expr: 'hurt' }, style);
          break;
        case 1: // airborne, flung back
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -13], footB: [-3, -3], footF: [4, -4], gun: 'none', handF: [5, -7], handB: [-6, -6], expr: 'hurt', rot: -0.6 }, style);
          break;
        case 2: // falling
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -11], footB: [-3, -3], footF: [4, -5], gun: 'none', handF: [6, -3], handB: [-6, -2], expr: 'hurt', rot: -1.2, rotPivot: [0, -6] }, style);
          break;
        case 3: // landed
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -13], ...base, gun: 'none', handF: [7, 1], handB: [-6, 2], expr: 'dead', rot: -1.45, rotPivot: [0, -4] }, style);
          break;
        case 4: // flat
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -13], footB: [-1, 0], footF: [2, -1], gun: 'none', handF: [3, 8], handB: [-3, 8], expr: 'dead', rot: -1.57, rotPivot: [0, -3.5] }, style);
          break;
        case 5: // victory salute
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -13], ...base, gun: 'none', handF: [3, -9], handB: [-1, 9], expr: 'happy' }, style);
          break;
        case 6: // fist pump
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -14], footB: [-2.5, -1], footF: [2.5, 0], gun: 'none', handF: [2, -12], handB: [-3, 8], expr: 'shout' }, style);
          break;
        case 7: // dropping in
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -14], footB: [-3, -3], footF: [3, -2], gun: 'none', handF: [4, -10], handB: [-4, -10], expr: 'shout' }, style);
          break;
        default: // idle look back
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -13], ...base, gun: 'pistol', aim: 0.9, headDx: -1, expr: 'normal' }, style);
          break;
      }
    },
  });
}
