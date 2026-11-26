// Humanoid rig: draws a chunky pixel-art soldier from a pose (joint positions solved with IK)
// and a style (colors, headgear, gear). Players and every infantry enemy use this so the cast
// shares one consistent look. Characters are always drawn FACING RIGHT; flip at draw time.
//
// Local pose coordinates: origin = feet (ground contact, between the feet), +x forward,
// -y up (canvas convention). A standing hip is at about (0, -13), shoulders ~10px above the hip.
//
// Guns: every GunKind has a geometry spec (GUN_SPECS) shared by the drawing code and
// muzzleFromShoulder(), so projectiles always leave the drawn barrel.

import { PixelArt, shade } from '../engine/pixelart';
import { sprites } from '../engine/sprites';

export type Headgear = 'none' | 'helmet' | 'bandana' | 'beret' | 'cap' | 'beanie' | 'hood' | 'officer' | 'goggles' | 'gasmask' | 'turban';
export type HairStyle = 'short' | 'long' | 'ponytail' | 'bald' | 'mohawk' | 'spiky' | 'bob';
export type GunKind =
  | 'none'
  | 'pistol'
  | 'rifle'
  | 'heavy'
  | 'rocket'
  | 'shotgun'
  | 'flamer'
  | 'knife'
  | 'grenade'
  | 'sniper'
  | 'smg'
  | 'laser'
  | 'homing'
  | 'bouncer';

/** Gun kinds every playable character has an upper-body set for (`char_<id>_up_<gun>`). */
export const PLAYER_GUNS: GunKind[] = ['pistol', 'heavy', 'rocket', 'shotgun', 'flamer', 'laser', 'homing', 'bouncer'];

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
  /** Knee pads color (optional detail). */
  kneepads?: string;
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
/** Leg bone lengths (thigh / shin). */
export const THIGH = 5.6;
export const SHIN = 5.6;
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

// ------------------------------------------------------------------ gun geometry

type V2 = [number, number];

/** Geometry of a gun along its axis (t) and perpendicular to it (side, + = below the barrel). */
export interface GunSpec {
  /** Rear / front extent along the axis from the gun base. */
  back: number;
  front: number;
  /** Rough barrel thickness (generic drawing). */
  thick: number;
  /** Near (trigger) hand [t, side]. */
  grip: V2;
  /** Far (support) hand [t, side]; null = one-handed. */
  support: V2 | null;
  /** Gun axis offset from the shoulder, perpendicular to the aim (+ = below). */
  perp: number;
  /** Extra forward x shift when aiming straight up / straight down (keeps the face visible). */
  up: number;
  down: number;
  /** Muzzle position along the axis. */
  muzzle: number;
  /** Draw the gun behind the head when aiming straight up. */
  behindUp?: boolean;
}

const GUN_SPECS: Record<string, GunSpec> = {
  pistol: { back: 7, front: 12.4, thick: 1.6, grip: [8.2, 1.1], support: null, perp: 1, up: 3, down: 2, muzzle: 13 },
  smg: { back: -2, front: 10, thick: 1.8, grip: [2, 0.5], support: [6, 0.5], perp: 1.5, up: 0, down: 0, muzzle: 12.5 },
  rifle: { back: -4, front: 13, thick: 1.6, grip: [2, 0.5], support: [8, 0.5], perp: 1.5, up: 0, down: 0, muzzle: 15.5 },
  sniper: { back: -5, front: 16, thick: 1.5, grip: [2, 0.5], support: [9, 0.5], perp: 1.5, up: 0, down: 0, muzzle: 18.5 },
  heavy: { back: -3.4, front: 15, thick: 2.4, grip: [1.2, 2.2], support: [9.6, 1.5], perp: 1.3, up: 4, down: 3, muzzle: 16, behindUp: true },
  shotgun: { back: -4, front: 15, thick: 1.8, grip: [1, 1.7], support: [9, 1.9], perp: 1.3, up: 4, down: 3, muzzle: 15.8, behindUp: true },
  rocket: { back: -8.3, front: 12.6, thick: 2.4, grip: [1.6, 3.6], support: [6.2, 3.4], perp: -0.6, up: 5, down: 3.5, muzzle: 12.5, behindUp: true },
  flamer: { back: -4, front: 13.2, thick: 2.2, grip: [0.8, 1.7], support: [7.6, 1.4], perp: 1.3, up: 4, down: 3, muzzle: 14, behindUp: true },
  laser: { back: -3, front: 13.8, thick: 2.2, grip: [0.6, 2.4], support: [7, 1.9], perp: 1.3, up: 4, down: 3, muzzle: 14.5, behindUp: true },
  homing: { back: -4, front: 10.6, thick: 2.8, grip: [1.4, 3.6], support: [6.2, 3.4], perp: -0.7, up: 5, down: 3.5, muzzle: 11.5, behindUp: true },
  bouncer: { back: -3.4, front: 12.5, thick: 2.2, grip: [0.6, 2.2], support: [8.2, 2.3], perp: 1.3, up: 4, down: 3, muzzle: 13.2, behindUp: true },
};

/** Geometry spec of a gun kind (null for 'none' / 'knife' / 'grenade'). */
export function gunSpec(gun: GunKind | string): GunSpec | null {
  return GUN_SPECS[gun] ?? null;
}

/** Shoulder lean used by the standard upper-body sets for an aim (matches Player.shoulder()). */
export function upperLean(aim: number): number {
  return aim > 0.5 ? -0.5 : 0;
}

/**
 * Gun placement for an aim, relative to the shoulder: base point of the gun axis plus the
 * axis (d) and perpendicular (p, pointing "below the barrel") unit vectors.
 */
export function gunFrame(gun: GunKind | string, aim: number, recoil = 0): { bx: number; by: number; dX: number; dY: number; pX: number; pY: number } {
  const spec = GUN_SPECS[gun] ?? GUN_SPECS.pistol;
  const dX = Math.cos(aim);
  const dY = Math.sin(aim);
  const pX = -dY;
  const pY = dX;
  const sn = Math.sin(aim);
  const shift = sn < 0 ? -sn * spec.up : sn * spec.down;
  return { bx: pX * spec.perp - dX * recoil + shift, by: pY * spec.perp - dY * recoil, dX, dY, pX, pY };
}

/** Where the bullet comes out, relative to the shoulder, for a gun/aim. */
export function muzzleFromShoulder(gun: GunKind, aim: number): [number, number] {
  const spec = GUN_SPECS[gun] ?? GUN_SPECS.pistol;
  const f = gunFrame(gun, aim);
  return [f.bx + f.dX * spec.muzzle, f.by + f.dY * spec.muzzle];
}

/** Shoulder position relative to the feet for a pose. */
export function shoulderOf(pose: HumanPose): [number, number] {
  return [pose.hip[0] + (pose.lean ?? 0), pose.hip[1] - (pose.torso ?? 10)];
}

/** Primitive set used by the gun painter (so the same art works inside the rotated rig and standalone). */
interface Painter {
  cap(a: V2, b: V2, r: number, c: string): void;
  poly(pts: V2[], c: string): void;
  circ(a: V2, r: number, c: string): void;
  dot(a: V2, c: string): void;
}

/**
 * Paint a gun. `along(t, side)` maps gun-axis coordinates to canvas coordinates.
 * `loaded` shows the round in the chamber (rocket warhead, missile tips) - hidden on firing frames.
 */
function paintGun(P: Painter, gun: GunKind, along: (t: number, side?: number) => V2, gunColor: string, loaded: boolean): void {
  const gc = gunColor;
  const gd = shade(gc, -0.38);
  const gl = shade(gc, 0.38);
  const WOOD = '#7a4a26';
  const WOODL = '#a8683a';
  const WOODD = '#55321a';
  const DARK = '#2a2a32';
  switch (gun) {
    case 'pistol': {
      P.poly([along(7.3, 0.4), along(9.1, 0.4), along(8.7, 3.3), along(7.1, 3.1)], gd); // grip
      P.cap(along(7.4, -0.2), along(12, -0.2), 1.05, gc); // slide
      P.cap(along(7.9, -0.95), along(11.4, -0.95), 0.4, gl);
      P.dot(along(12.2, -0.2), gd);
      return;
    }
    case 'smg': {
      P.cap(along(-2, 0.6), along(0.5, 0.6), 1.3, gd);
      P.cap(along(0, 0), along(10, 0), 1.2, gc);
      P.cap(along(0.5, -0.8), along(9, -0.8), 0.35, gl);
      P.cap(along(3.6, 1.4), along(4.2, 4), 0.8, gd);
      P.dot(along(10.2, 0), gd);
      return;
    }
    case 'rifle':
    case 'sniper': {
      const L = gun === 'sniper' ? 16 : 13;
      P.poly([along(-4.6, -0.7), along(0.4, -0.5), along(0.4, 1.3), along(-4.6, 2.5)], WOOD); // stock
      P.cap(along(-4, -0.1), along(-0.5, -0.1), 0.4, WOODL);
      P.cap(along(0, 0), along(6, 0), 1.0, gc); // receiver
      P.cap(along(5.5, 0.35), along(L - 4, 0.35), 0.85, WOOD); // handguard
      P.cap(along(L - 4.5, -0.25), along(L, -0.25), 0.5, gd); // barrel
      P.cap(along(3.2, 1.3), along(3.8, 3.6), 0.8, gd); // magazine
      P.cap(along(0.5, -0.8), along(5.5, -0.8), 0.35, gl);
      if (gun === 'sniper') {
        P.cap(along(1.5, -2.1), along(6.5, -2.1), 0.95, DARK);
        P.dot(along(6.9, -2.1), '#8ad8ff');
      }
      return;
    }
    case 'heavy': {
      P.poly([along(-3.6, -1.1), along(0.2, -1.2), along(0.2, 1.7), along(-3.6, 2.3)], gd); // butt
      P.poly([along(-0.4, 3.4), along(0.9, 3.4), along(0.9, 1), along(-0.4, 1)], gd); // pistol grip
      P.poly([along(1.8, 1.4), along(6.2, 1.4), along(6.2, 4.6), along(1.8, 4.6)], '#4e5a32'); // ammo box
      P.cap(along(2.4, 2.4), along(5.6, 2.4), 0.4, '#7e8e4e');
      P.poly([along(-0.5, -1.7), along(7.6, -1.7), along(7.6, 1.6), along(-0.5, 1.6)], gc); // receiver
      P.cap(along(0, -1.25), along(7.1, -1.25), 0.42, gl);
      P.cap(along(1.6, -2.7), along(5, -2.7), 0.45, gd); // carry handle
      P.dot(along(1.6, -2.1), gd);
      P.dot(along(5, -2.1), gd);
      const sh = shade(gc, 0.16);
      P.cap(along(7.6, 0), along(12.6, 0), 1.3, sh); // barrel shroud
      for (const t of [8.8, 10.3, 11.8]) P.dot(along(t, 0), gd);
      P.cap(along(12.4, 0), along(14.8, 0), 0.6, gd); // barrel
      P.cap(along(14.6, -1), along(14.6, 1), 0.55, gd); // muzzle brake
      P.dot(along(6.6, 2.1), '#e8b848'); // brass belt
      P.dot(along(7.2, 2.8), '#c89028');
      return;
    }
    case 'shotgun': {
      P.poly([along(-4.2, -0.8), along(0.6, -0.6), along(0.6, 1.3), along(-4.2, 2.5)], WOOD); // stock
      P.cap(along(-3.6, -0.2), along(0, -0.2), 0.4, WOODL);
      P.cap(along(0, 0), along(5.2, 0), 1.15, gc); // receiver
      P.cap(along(5, 0.95), along(13.6, 0.95), 0.6, gd); // magazine tube
      P.cap(along(4.6, -0.45), along(15, -0.45), 0.7, shade(gc, 0.12)); // barrel
      P.cap(along(5, -1.1), along(14.4, -1.1), 0.3, gl);
      P.cap(along(7.3, 1.15), along(10.9, 1.15), 1.2, '#8a5630'); // pump
      P.dot(along(8, 0.5), WOODL);
      P.dot(along(9.6, 0.5), WOODL);
      P.cap(along(9.2, 2), along(9.2, 2), 0.4, WOODD);
      P.dot(along(15.2, -0.45), gd);
      return;
    }
    case 'rocket': {
      const OL = '#5f7040';
      const OLD = '#3b4727';
      const OLL = '#8fa25e';
      P.cap(along(-8.4, 0), along(-6.8, 0), 2.6, '#2c3520'); // exhaust bell
      P.dot(along(-8.6, 0), '#141a10');
      P.cap(along(-7, 0), along(9.6, 0), 2.15, OL); // tube
      P.cap(along(-6.6, -1.25), along(9.2, -1.25), 0.5, OLL);
      P.cap(along(-6.6, 1.4), along(9.2, 1.4), 0.5, OLD);
      P.cap(along(-1.2, -2), along(-1.2, 2), 0.55, OLD); // bands
      P.cap(along(6.4, -2), along(6.4, 2), 0.55, OLD);
      P.cap(along(9.4, 0), along(10.7, 0), 2.45, '#2c3520'); // muzzle ring
      if (loaded) {
        P.cap(along(10.6, 0), along(12.3, 0), 1.35, '#b83c28'); // warhead
        P.dot(along(11.2, -0.8), '#ee7a4a');
        P.dot(along(12.7, 0), '#7a2416');
      } else P.dot(along(10.9, 0), '#141a10');
      P.poly([along(1.4, -2.1), along(3.6, -2.1), along(3.6, -3.7), along(1.4, -3.7)], DARK); // sight
      P.dot(along(3.4, -3), '#8ae0ff');
      P.cap(along(1.6, 2.2), along(1.3, 4.2), 0.8, DARK); // grips
      P.cap(along(6.2, 2.2), along(6.2, 3.8), 0.7, DARK);
      return;
    }
    case 'flamer': {
      P.cap(along(-3.2, 2.9), along(3.2, 2.9), 1.95, '#c0382a'); // fuel tank
      P.cap(along(-2.7, 1.9), along(2.7, 1.9), 0.45, '#ee6e4c');
      P.dot(along(-3.9, 2.9), '#7a2018');
      P.dot(along(3.9, 2.9), '#7a2018');
      P.cap(along(3.6, 3.3), along(6.8, 1.1), 0.5, DARK); // hose
      P.cap(along(-3.6, -0.2), along(7.2, -0.2), 1.25, '#6c6c78'); // body
      P.cap(along(-3, -1.05), along(6.6, -1.05), 0.42, '#a0a0ae');
      P.cap(along(7, -0.2), along(11.6, -0.2), 0.75, '#4a4a56'); // nozzle
      P.cap(along(11.5, -0.2), along(12.9, -0.2), 1.4, '#34343e'); // bell
      P.dot(along(13.2, -0.2), '#1a1a22');
      P.dot(along(12.7, 1.7), '#ffd040'); // pilot light
      P.dot(along(13.4, 2), '#5ab4ff');
      return;
    }
    case 'laser': {
      P.cap(along(0.6, 1.9), along(0.2, 3.8), 0.8, DARK); // grip
      P.cap(along(-3, 0), along(8.6, 0), 1.95, '#d6dae4'); // body
      P.cap(along(-2.5, 1.25), along(8.1, 1.25), 0.6, '#9298aa');
      P.cap(along(-1.6, -1.2), along(7.6, -1.2), 0.45, '#8af2ff'); // glowing core
      for (const t of [0.4, 3, 5.6]) P.cap(along(t, -1.9), along(t, 1.9), 0.55, '#28bfee'); // coils
      P.cap(along(8.6, 0), along(11, 0), 1.1, '#586070'); // emitter neck
      P.circ(along(11.9, 0), 1.95, '#3a4050'); // emitter head
      P.circ(along(12.3, 0), 1.25, '#4ae2ff');
      P.dot(along(12.4, -0.5), '#ffffff');
      return;
    }
    case 'homing': {
      const S = '#b39a5e';
      const SD = '#957c4a';
      P.cap(along(1.4, 2.6), along(1.1, 4.7), 0.8, DARK); // grip
      P.cap(along(-3, -1.3), along(9.6, -1.3), 1.45, S); // twin tubes
      P.cap(along(-3, 1.3), along(9.6, 1.3), 1.45, SD);
      P.cap(along(-2.6, 0.05), along(9.2, 0.05), 0.35, '#6e5a34');
      P.cap(along(-2.6, -2.25), along(9.2, -2.25), 0.4, '#dcc48e');
      P.cap(along(6, -2.7), along(6, 2.7), 0.55, '#e8c040'); // hazard band
      P.dot(along(6, 0), DARK);
      P.cap(along(9.6, -2.7), along(9.6, 2.7), 0.5, '#4e4026'); // rims
      if (loaded) {
        P.cap(along(10, -1.3), along(10.6, -1.3), 0.75, '#d8462a'); // missile noses
        P.cap(along(10, 1.3), along(10.6, 1.3), 0.75, '#d8462a');
        P.dot(along(10.2, -1.8), '#f8845a');
      }
      P.cap(along(1.4, -3.7), along(4.6, -3.7), 0.85, DARK); // targeting scope
      P.dot(along(5, -3.7), '#ff3a3a');
      return;
    }
    case 'bouncer': {
      P.poly([along(-3.6, -0.8), along(0.2, -0.8), along(0.2, 1.5), along(-3.6, 2.5)], gd); // stock
      P.cap(along(-0.2, 0), along(5, 0), 1.1, gc);
      P.circ(along(2.6, 1.1), 2.75, '#36363f'); // revolving drum
      P.circ(along(2.6, 1.1), 1.7, '#585866');
      P.dot(along(2.6, -0.6), '#f29a30');
      P.dot(along(4.2, 1.1), '#f29a30');
      P.dot(along(2.6, 2.7), '#f29a30');
      P.cap(along(5, 0), along(11.4, 0), 1.75, '#4a6a84'); // fat barrel
      P.cap(along(5.5, -0.95), along(11, -0.95), 0.45, '#82a2bc');
      P.cap(along(11.2, 0), along(12.4, 0), 2.05, '#e8862a'); // muzzle ring
      P.dot(along(12.5, 0), '#2a1a10');
      P.dot(along(6.2, -1.9), gd);
      return;
    }
    default:
      return;
  }
}

/**
 * Draw a gun on its own (pickup icons, dropped weapons). (x, y) = gun base, angle = aim angle.
 */
export function drawGunAt(p: PixelArt, gun: GunKind, x: number, y: number, angle = 0, gunColor = '#3c3c48'): void {
  const dX = Math.cos(angle);
  const dY = Math.sin(angle);
  const along = (t: number, side = 0): V2 => [x + dX * t - dY * side, y + dY * t + dX * side];
  paintGun(
    {
      cap: (a, b, r, c) => p.capsule(a[0], a[1], b[0], b[1], r, c),
      poly: (pts, c) => p.poly(pts.flat(), c),
      circ: (a, r, c) => p.circle(a[0], a[1], r, c),
      dot: (a, c) => p.px(Math.floor(a[0]), Math.floor(a[1]), c),
    },
    gun,
    along,
    gunColor,
    true,
  );
}

// ------------------------------------------------------------------ the rig

export function drawHuman(p: PixelArt, ox: number, oy: number, pose: HumanPose, st: HumanoidStyle): void {
  const part = pose.part ?? 'full';
  const b = st.build ?? 1;
  const rot = pose.rot ?? 0;
  const [pvx, pvy] = pose.rotPivot ?? pose.hip;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const T = (x: number, y: number): V2 => {
    const dx = x - pvx;
    const dy = y - pvy;
    return [ox + pvx + dx * cs - dy * sn, oy + pvy + dx * sn + dy * cs];
  };
  const poly = (pts: V2[], c: string) => {
    const flat: number[] = [];
    for (const [x, y] of pts) {
      const [X, Y] = T(x, y);
      flat.push(X, Y);
    }
    p.poly(flat, c);
  };
  const cap = (a: V2, c2: V2, r: number, col: string) => {
    const [x0, y0] = T(a[0], a[1]);
    const [x1, y1] = T(c2[0], c2[1]);
    p.capsule(x0, y0, x1, y1, r, col);
  };
  const circ = (c: V2, r: number, col: string) => {
    const [x, y] = T(c[0], c[1]);
    p.circle(x, y, r, col);
  };
  const dot = (c: V2, col: string) => {
    const [x, y] = T(c[0], c[1]);
    p.px(Math.floor(x), Math.floor(y), col);
  };

  const pantsD = shade(st.pants, -0.28);
  const pantsL = shade(st.pants, 0.18);
  const bootsD = shade(st.boots, -0.3);
  const shirtD = shade(st.shirt, -0.25);
  const skinD = shade(st.skin, -0.2);
  const hip = pose.hip;

  // ------------------------------------------------------------- legs
  const drawLeg = (foot: V2, back: boolean) => {
    const hx = hip[0] + (back ? -1.3 : 1.3) * b;
    const hy = hip[1] + 1;
    const ax = foot[0] - 0.3;
    const ay = foot[1] - 2.9;
    const [kx, ky] = ik2(hx, hy, ax, ay, THIGH, SHIN, 1);
    const pc = back ? pantsD : st.pants;
    cap([hx, hy], [kx, ky], 1.95 * b, pc);
    cap([kx, ky], [ax, ay], 1.55 * b, pc);
    if (!back) dot([kx - 0.6, ky - 0.9], pantsL); // knee highlight
    if (st.kneepads) circ([kx + 0.3, ky], 1.1, back ? shade(st.kneepads, -0.25) : st.kneepads);
    // Boot: a chunky wedge pointing forward, darker sole.
    const bc = back ? bootsD : st.boots;
    const fx = foot[0];
    const fy = foot[1];
    poly(
      [
        [fx - 2 * b, fy - 3.7],
        [fx + 1.2 * b, fy - 3.7],
        [fx + 3.3 * b, fy - 1.7],
        [fx + 3.3 * b, fy],
        [fx - 2.2 * b, fy],
      ],
      bc,
    );
    cap([fx - 2.1 * b, fy - 0.5], [fx + 3.1 * b, fy - 0.5], 0.5, shade(bc, -0.4));
    dot([fx + 1.6 * b, fy - 2.6], shade(bc, 0.3));
  };

  const drawLower = () => {
    drawLeg(pose.footB, true);
    // Pelvis.
    poly(
      [
        [hip[0] - 4.1 * b, hip[1] - 1],
        [hip[0] + 3.9 * b, hip[1] - 1],
        [hip[0] + 3.5 * b, hip[1] + 2.8],
        [hip[0] - 3.7 * b, hip[1] + 2.8],
      ],
      st.pants,
    );
    drawLeg(pose.footF, false);
  };

  // ------------------------------------------------------------- upper body
  const [sx, sy] = shoulderOf(pose);
  const torsoTop: V2 = [sx, sy - (st.tall ?? 0)];
  const aim = pose.aim ?? 0;
  const gun: GunKind = pose.noGun ? 'none' : (pose.gun ?? 'none');
  const spec = GUN_SPECS[gun];
  const recoil = pose.recoil ?? 0;
  const gf = gunFrame(gun, aim, recoil);
  const gunBase: V2 = [sx + gf.bx, sy + gf.by];
  const along = (t: number, side = 0): V2 => [gunBase[0] + gf.dX * t + gf.pX * side, gunBase[1] + gf.dY * t + gf.pY * side];
  const oneHanded = !!spec && !spec.support;

  let handF: V2;
  let handB: V2;
  if (pose.handF) handF = [sx + pose.handF[0], sy + pose.handF[1]];
  else if (spec) handF = along(spec.grip[0], spec.grip[1]);
  else handF = [sx + 1.5, sy + 9];
  if (pose.handB) handB = [sx + pose.handB[0], sy + pose.handB[1]];
  else if (spec && spec.support) handB = along(spec.support[0], spec.support[1]);
  else if (oneHanded) handB = [sx - 0.5, sy + 8.6];
  else handB = [sx - 1.5, sy + 9];

  const arm = (shoulder: V2, hand: V2, back: boolean) => {
    const [ex1, ey1] = ik2(shoulder[0], shoulder[1], hand[0], hand[1], UPPER_ARM, FOREARM, 1);
    const [ex2, ey2] = ik2(shoulder[0], shoulder[1], hand[0], hand[1], UPPER_ARM, FOREARM, -1);
    // Prefer the elbow that points down/back.
    const elbow: V2 = ey1 > ey2 ? [ex1, ey1] : [ex2, ey2];
    const sleeve = back ? shirtD : st.shirt;
    const fore = st.sleeves === 'short' ? (back ? skinD : st.skin) : sleeve;
    cap(shoulder, elbow, 1.8 * b, sleeve);
    cap(elbow, hand, 1.5 * b, fore);
    circ(hand, 1.4 * b, st.gloves ? (back ? shade(st.gloves, -0.2) : st.gloves) : back ? skinD : st.skin);
  };

  const drawGun = () => {
    if (!spec) return;
    paintGun({ cap, poly, circ, dot }, gun, along, st.gunColor ?? '#3c3c48', recoil <= 0);
  };

  const drawHead = () => {
    const hx = sx + 0.5 + (pose.headDx ?? 0);
    const hy = torsoTop[1] - 5.5 + (pose.headDy ?? 0);
    const H: V2 = [hx, hy];
    const at = (dx: number, dy: number): V2 => [hx + dx, hy + dy];
    // Neck.
    cap(at(-0.5, 3), at(-0.5, 5.5), 1.6, skinD);
    // Hair base (behind the face).
    const hs = st.hairStyle;
    if (hs === 'long') poly([at(-5, -2), at(0, -2), at(-0.5, 7), at(-5.5, 7)], st.hair);
    if (hs === 'ponytail') {
      cap(at(-4.5, -1), at(-7, 4), 1.6, st.hair);
      dot(at(-7.2, 5), shade(st.hair, 0.15));
    }
    if (hs === 'bob') poly([at(-5, -2), at(1, -2), at(0.5, 4), at(-5.2, 4)], st.hair);
    // Face.
    circ(H, 4.8, st.skin);
    circ(at(2.5, 1.2), 2.3, st.skin); // jaw/nose forward
    dot(at(4.6, 0.2), skinD); // nose tip shade
    dot(at(-2.6, -2.6), shade(st.skin, 0.12)); // forehead light (top-left)
    if (hs !== 'bald') {
      circ(at(-1.2, -1.6), 4.1, st.hair);
      circ(at(1.4, -3), 2.6, st.hair);
      dot(at(-2.4, -4.4), shade(st.hair, 0.22)); // hair shine
      if (hs === 'mohawk') poly([at(-3, -5), at(2, -6.5), at(3, -5)], st.hair);
      if (hs === 'spiky') {
        poly([at(-4, -4), at(-6.5, -5.5), at(-3, -6)], st.hair);
        poly([at(-1, -5), at(-1.5, -8), at(1.5, -6)], st.hair);
        poly([at(2, -5), at(4.5, -6.5), at(3.5, -4)], st.hair);
      }
      // Sideburn.
      dot(at(0, 0.5), st.hair);
    } else {
      dot(at(-1.8, -3.6), shade(st.skin, 0.25)); // scalp shine
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
    } else if (expr === 'hurt') {
      dot(at(3, -1.3), eye);
      dot(at(2, -2), shade(st.hair, -0.1));
      dot(at(3.3, -2.4), shade(st.hair, -0.1));
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
    } else if (expr === 'happy') {
      dot(at(3.4, 2.4), '#5a1a1a');
      dot(at(4.3, 2.2), '#5a1a1a');
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
        dot(at(-3.6, -4.2), shade(hc, 0.3));
        cap(at(-1.5, 0.8), at(1.5, 4.2), 0.5, hd);
        break;
      case 'bandana':
        cap(at(-4.8, -2.6), at(4.8, -2.6), 1.2, hc);
        dot(at(-2.5, -3.4), shade(hc, 0.3));
        cap(at(-5, -2.2), at(-8, -0.8), 0.9, hc);
        cap(at(-5, -2.2), at(-7.5, 1.2), 0.9, ha);
        break;
      case 'beret':
        poly([at(-5, -3), at(-3, -6.5), at(2, -7), at(5.5, -5), at(5, -3.5)], hc);
        dot(at(3.5, -5.5), ha);
        dot(at(-1.5, -6), shade(hc, 0.3));
        cap(at(-5, -3), at(5, -3.5), 0.6, hd);
        break;
      case 'cap':
        poly([at(-5, -2.5), at(-4, -6), at(1, -7), at(4, -5.5), at(4.5, -2.5)], hc);
        poly([at(3, -3.5), at(8, -2.4), at(8, -1.6), at(3, -1.8)], hd);
        dot(at(0, -5.8), ha);
        dot(at(-2.6, -5.2), shade(hc, 0.4));
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
        dot(at(-3, -4.6), shade(hc, 0.35));
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
    // Shoulder highlight.
    dot([tt[0] + 1.5 * b, tt[1] + 0.2], shade(st.shirt, 0.22));
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
      dot([tt[0] - 2 * b, tt[1] + 3], shade(st.vest, 0.2));
    }
    if (st.strap) cap([tt[0] - 3 * b, tt[1] + 1], [hip[0] + 3 * b, hip[1] - 1.5], 0.8, st.strap);
    if (st.scarf) {
      cap([tt[0] - 3, tt[1] + 0.5], [tt[0] + 3.5, tt[1] + 0.5], 1.3, st.scarf);
      cap([tt[0] - 3.5, tt[1] + 0.5], [tt[0] - 6, tt[1] + 2.5], 0.8, shade(st.scarf, -0.2)); // tail
    }
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

  function at2(base: V2, dx: number, dy: number): V2 {
    return [base[0] + dx, base[1] + dy];
  }

  if (part === 'lower' || part === 'full') drawLower();
  if (part === 'upper' || part === 'full') {
    const shB: V2 = [sx - 1.5 * b, sy + 1];
    const shF: V2 = [sx + 1 * b, sy + 1.2];
    const twoHandedBehind = !!spec && !oneHanded && !pose.handB;
    const gunBehindHead = !!spec && !!spec.behindUp && aim < -1.2;
    // Back arm (behind torso).
    if (!twoHandedBehind) arm(shB, handB, true);
    drawTorso();
    if (gunBehindHead) {
      arm(shB, handB, true);
      drawGun();
    }
    drawHead();
    if (!gunBehindHead) {
      if (twoHandedBehind) arm(shB, handB, true);
      drawGun();
    }
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
  f.push({ hip: [0, -13], footB: [-3.6, 0], footF: [3.4, 0], lean: 0 });
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
  f.push({ hip: [0, -10.5], footB: [-3.8, 0], footF: [3.6, 0], lean: 1 });
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

/** Frames of the `${name}_body` set. */
export const BODY = { HIT: 0, FLUNG: 1, FALLING: 2, LANDED: 3, FLAT: 4, VICTORY: 5, VICTORY2: 6, DROP: 7, LOOK: 8 } as const;
/** Frames of the `${name}_throw` set: grenade wind-up/release, fire bomb wind-up/release. */
export const THROW = { WIND: 0, RELEASE: 1, FB_WIND: 2, FB_RELEASE: 3 } as const;

/** Throwable held in the hand (grenade or fire bomb bottle). */
function drawThrowable(p: PixelArt, x: number, y: number, kind: 'grenade' | 'firebomb'): void {
  if (kind === 'grenade') {
    p.circle(x, y, 1.9, '#4a5e2a');
    p.px(Math.floor(x - 0.8), Math.floor(y - 0.8), '#7e9a4a');
    p.rect(Math.floor(x) - 0.5, Math.floor(y) - 3, 2, 1.4, '#a8a8b0');
  } else {
    p.capsule(x, y + 0.6, x, y - 1.2, 1.5, '#b83a24');
    p.px(Math.floor(x - 0.7), Math.floor(y - 0.6), '#ee7a4a');
    p.rect(Math.floor(x) - 0.5, Math.floor(y) - 3.6, 2, 1.6, '#d8c8a0');
    p.px(Math.floor(x), Math.floor(y - 5), '#ffd040');
    p.px(Math.floor(x + 1), Math.floor(y - 5.6), '#ff8a20');
  }
}

/**
 * Define the standard player-style sprite set for a style:
 *   `${name}_legs`         LEG_FRAMES (origin: feet)
 *   `${name}_up_${gun}`    10 frames: AIMS[i] (frame i) and AIMS[i] firing (frame 5+i)  (origin: hip)
 *   `${name}_rest_${gun}`  2 frames: weapon lowered (idle fidget), 2nd = stretch/blink (origin: hip)
 *   `${name}_throw`        4 frames (THROW.*): grenade wind-up, release, fire bomb wind-up, release (origin: hip)
 *   `${name}_throw_${gun}` same 4 frames, far hand still holding a two-handed gun (lowered)
 *   `${name}_knife`        3 frames: wind-up, slash (with swoosh), follow-through (origin: hip)
 *   `${name}_body`         full body extras (origin: feet, BODY.*):
 *        0-4 death (hit, airborne, falling, landed, flat), 5-6 victory, 7 dropping in (arms up), 8 idle look
 */
export function defineHumanoidSet(name: string, style: HumanoidStyle, guns: GunKind[] = ['pistol', 'heavy']): void {
  const UP_FEET = UPPER_OY + 13; // feet y for a standing hip at (UPPER_OX, UPPER_OY)
  const standUpper = { hip: [0, -13] as V2, footB: [-2, 0] as V2, footF: [2, 0] as V2, part: 'upper' as const };
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
        drawHuman(
          p,
          UPPER_OX,
          UP_FEET,
          { ...standUpper, gun, aim, recoil: firing ? 1.5 : 0, lean: upperLean(aim), headDx: aim < -1 ? -0.5 : 0, expr: firing ? 'shout' : 'normal' },
          style,
        );
      },
    });
    sprites.define({
      name: `${name}_rest_${gun}`,
      w: UPPER_W,
      h: UPPER_H,
      ox: UPPER_OX,
      oy: UPPER_OY,
      frames: 2,
      draw: (p, f) => {
        // Weapon lowered and relaxed; frame 1 rolls the shoulders up with eyes closed.
        const restAim = gun === 'rocket' || gun === 'homing' ? -0.62 : gun === 'pistol' ? 1.05 : 0.72;
        drawHuman(
          p,
          UPPER_OX,
          UP_FEET + (f === 1 ? -1 : 0),
          { ...standUpper, gun, aim: restAim, lean: f === 1 ? -0.5 : 0.3, headDx: f === 1 ? -0.5 : 0, headDy: f === 1 ? 0.5 : 0, expr: f === 1 ? 'happy' : 'normal' },
          style,
        );
      },
    });
  }
  // Throw frames (THROW.*). With a two-handed gun the far hand keeps holding it, lowered,
  // while the near arm throws (`${name}_throw_${gun}`); the plain set shows empty hands.
  const drawThrow = (p: PixelArt, f: number, gun: GunKind) => {
    const wind = f % 2 === 0;
    const hf: V2 = wind ? [-7.5, -3.5] : [8, -2.5];
    const lean = wind ? -1.2 : 1.8;
    const held = gun !== 'none';
    drawHuman(
      p,
      UPPER_OX,
      UP_FEET,
      { ...standUpper, gun: held ? gun : 'none', aim: held ? 0.55 : 0, handF: hf, handB: held ? undefined : wind ? [4, 5] : [-3, 6], lean, expr: wind ? 'normal' : 'shout' },
      style,
    );
    const sx = UPPER_OX + lean;
    const sy = UPPER_OY - 10;
    if (wind) drawThrowable(p, sx + hf[0] - 0.5, sy + hf[1] - 2, f >= 2 ? 'firebomb' : 'grenade');
    else {
      // Release: speed lines trailing the hand.
      for (let i = 0; i < 3; i++) p.px(Math.round(sx + hf[0] - 4 - i * 2), Math.round(sy + hf[1] - 3 - i), '#f0f0e8');
    }
  };
  sprites.define({ name: `${name}_throw`, w: UPPER_W, h: UPPER_H, ox: UPPER_OX, oy: UPPER_OY, frames: 4, draw: (p, f) => drawThrow(p, f, 'none') });
  for (const gun of guns) {
    if (!GUN_SPECS[gun]?.support) continue; // one-handed guns are tucked away for the throw
    sprites.define({ name: `${name}_throw_${gun}`, w: UPPER_W, h: UPPER_H, ox: UPPER_OX, oy: UPPER_OY, frames: 4, draw: (p, f) => drawThrow(p, f, gun) });
  }
  sprites.define({
    name: `${name}_knife`,
    w: UPPER_W,
    h: UPPER_H,
    ox: UPPER_OX,
    oy: UPPER_OY,
    frames: 3,
    draw: (p, f) => {
      const hands: V2[] = [
        [-1.5, -7],
        [9, 0.5],
        [6, 6],
      ];
      const leans = [-1, 2.5, 1.5];
      const hf = hands[f];
      const lean = leans[f];
      // Swoosh arc behind the arm on the slash frames.
      const sx = UPPER_OX + lean;
      const sy = UPPER_OY - 10;
      if (f === 1 || f === 2) {
        const cx = sx + 1;
        const cy = sy + 1;
        const R = 11.5;
        const a0 = -2.0;
        const a1 = f === 1 ? 0.35 : 0.9;
        const n = 26;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const a = a0 + (a1 - a0) * t;
          const w = f === 1 ? 0.4 + t * 1.6 : 0.3 + t * 0.9;
          const x = cx + Math.cos(a) * R;
          const y = cy + Math.sin(a) * R;
          if (f === 2 && i % 2 === 1) continue;
          p.circle(x, y, w + 0.6, '#7ad0ff');
          p.circle(x, y, w, '#ffffff');
        }
      }
      drawHuman(p, UPPER_OX, UP_FEET, { ...standUpper, gun: 'none', handF: hf, handB: f === 0 ? [2, 6] : [-3, 6], lean, expr: 'shout' }, style);
      // Blade.
      const hx = sx + 1 + hf[0];
      const hy = sy + 1.2 + hf[1];
      const ang = [-2.2, 0.35, 1.05][f];
      const bx = hx + Math.cos(ang) * 6.5;
      const by = hy + Math.sin(ang) * 6.5;
      p.capsule(hx - Math.cos(ang) * 1.5, hy - Math.sin(ang) * 1.5, hx, hy, 0.8, '#3a2a20'); // handle
      p.capsule(hx + Math.cos(ang) * 1.2, hy + Math.sin(ang) * 1.2, bx, by, 0.75, '#d6dee8');
      p.px(Math.floor(bx), Math.floor(by), '#ffffff');
      // Re-draw the fist over the handle.
      p.circle(hx, hy, 1.4, style.gloves ?? style.skin);
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
      const base = { footB: [-3, 0] as V2, footF: [3, 0] as V2 };
      switch (f) {
        case 0: // hit: knocked back, arms flung out
          drawHuman(p, BODY_OX, BODY_OY, { hip: [-1, -13], footB: [-2, 0], footF: [3.5, -1.5], lean: -3, headDx: -1, gun: 'none', handF: [8, -3], handB: [-7, -4], expr: 'hurt' }, style);
          break;
        case 1: // airborne, flung back
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -14], footB: [-3, -4], footF: [4.5, -5], gun: 'none', handF: [6, -8], handB: [-7, -6], expr: 'hurt', rot: -0.65 }, style);
          break;
        case 2: // falling
          drawHuman(p, BODY_OX + 5, BODY_OY, { hip: [0, -13], footB: [-3, -3], footF: [4, -5], gun: 'none', handF: [6, -4], handB: [-6, -3], expr: 'hurt', rot: -1.2, rotPivot: [0, -7] }, style);
          break;
        case 3: // landed (bounce)
          drawHuman(p, BODY_OX + 12, BODY_OY, { hip: [0, -14], footB: [-1.5, -1], footF: [3, -2.5], gun: 'none', handF: [6, 2], handB: [-5, 4], expr: 'dead', rot: -1.4, rotPivot: [0, -4] }, style);
          break;
        case 4: // flat on the back
          drawHuman(p, BODY_OX + 12, BODY_OY, { hip: [0, -14.4], footB: [-1, 0], footF: [1.5, -0.6], gun: 'none', handF: [3.5, 8], handB: [-2.5, 8.5], expr: 'dead', rot: -1.57, rotPivot: [0, -3.6] }, style);
          break;
        case 5: // victory salute
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -13], ...base, gun: 'none', handF: [3.6, -8.4], handB: [-1, 8.5], lean: 0.3, expr: 'happy' }, style);
          break;
        case 6: // fist pump with a hop
          drawHuman(p, BODY_OX, BODY_OY - 1, { hip: [0, -14], footB: [-2.5, -0.5], footF: [3, 0], gun: 'none', handF: [2, -12], handB: [-3, 7], expr: 'shout' }, style);
          break;
        case 7: // dropping in
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -14], footB: [-3, -3], footF: [3, -2], gun: 'none', handF: [4, -10], handB: [-4, -10], expr: 'shout' }, style);
          break;
        default: // idle look back
          drawHuman(p, BODY_OX, BODY_OY, { hip: [0, -13], ...base, gun: 'pistol', aim: 1.05, headDx: -1, expr: 'normal' }, style);
          break;
      }
    },
  });
}
