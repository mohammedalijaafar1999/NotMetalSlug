// LEVIATHAN's mech claw arm: two-bone IK (elbow up), telescoping deployment and crisp runtime
// rendering of the hydraulic booms (scanline-filled quads, no anti-aliased strokes).

import { sprites } from '../../../engine/sprites';
import { clamp, type Rect } from '../../../engine/math';
import { BC } from '../common/kit';
import { LV, CLAW_H } from './art';

/** Segment lengths of the fully deployed arm. */
export const ARM_L1 = 84;
export const ARM_L2 = 80;
export const ARM_REACH = ARM_L1 + ARM_L2 - 1;

/** Fill a convex polygon with 1px scanlines (crisp at any angle). */
export function fillConvex(g: CanvasRenderingContext2D, pts: number[], color: string): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < pts.length; i += 2) {
    minY = Math.min(minY, pts[i]);
    maxY = Math.max(maxY, pts[i]);
  }
  g.fillStyle = color;
  const n = pts.length / 2;
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const yc = y + 0.5;
    let xa = Infinity;
    let xb = -Infinity;
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2];
      const y0 = pts[i * 2 + 1];
      const x1 = pts[((i + 1) % n) * 2];
      const y1 = pts[((i + 1) % n) * 2 + 1];
      if ((yc < y0 && yc < y1) || (yc > y0 && yc > y1) || y0 === y1) continue;
      const x = x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0);
      xa = Math.min(xa, x);
      xb = Math.max(xb, x);
    }
    if (xa <= xb) {
      const a = Math.round(xa);
      const b = Math.round(xb);
      if (b > a) g.fillRect(a, y, b - a, 1);
    }
  }
}

/** Quad around the segment a->b with half width h, offset sideways by `off` along the normal. */
function segQuad(ax: number, ay: number, bx: number, by: number, h: number, off = 0, t0 = 0, t1 = 1): number[] {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const sx = ax + dx * t0 + nx * off;
  const sy = ay + dy * t0 + ny * off;
  const ex = ax + dx * t1 + nx * off;
  const ey = ay + dy * t1 + ny * off;
  return [sx + nx * h, sy + ny * h, ex + nx * h, ey + ny * h, ex - nx * h, ey - ny * h, sx - nx * h, sy - ny * h];
}

/** A shaded hydraulic boom between two joints. Light comes from the top-left. */
function boom(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, c: { base: string; lit: string; dark: string; band: string }, stripes: boolean): void {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  // Lit side = the normal pointing up/left.
  const litSign = nx + ny < 0 ? 1 : -1;
  nx *= litSign;
  ny *= litSign;
  const h = w / 2;
  fillConvex(g, segQuad(ax, ay, bx, by, h + 1), BC.black);
  fillConvex(g, segQuad(ax, ay, bx, by, h), c.base);
  fillConvex(g, segQuad(ax, ay, bx, by, 1, litSign * (h - 1.5)), c.lit);
  fillConvex(g, segQuad(ax, ay, bx, by, 1, -litSign * (h - 1.5)), c.dark);
  // Plate bands every ~14 px.
  const nb = Math.floor(len / 14);
  for (let i = 1; i <= nb; i++) {
    const t = i / (nb + 1);
    fillConvex(g, segQuad(ax, ay, bx, by, h, 0, t - 0.6 / len, t + 0.6 / len), c.band);
  }
  if (stripes) {
    // Hazard stripes near the far joint.
    for (let i = 0; i < 4; i++) {
      const t = 1 - (10 + i * 3) / len;
      fillConvex(g, segQuad(ax, ay, bx, by, h - 1, 0, t, t + 1.4 / len), i % 2 ? BC.black : BC.hazard);
    }
  }
}

/** Hydraulic piston (cylinder + chrome rod) running alongside a boom. */
function piston(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, off: number, ext: number): void {
  const q = segQuad(ax, ay, bx, by, 2, off, 0.12, 0.5);
  fillConvex(g, segQuad(ax, ay, bx, by, 3, off, 0.12, 0.5), BC.black);
  fillConvex(g, q, LV.s3);
  fillConvex(g, segQuad(ax, ay, bx, by, 0.6, off - 1, 0.14, 0.48), LV.s1);
  fillConvex(g, segQuad(ax, ay, bx, by, 1.6, off, 0.5, 0.5 + 0.38 * ext), BC.black);
  fillConvex(g, segQuad(ax, ay, bx, by, 0.9, off, 0.5, 0.5 + 0.38 * ext), LV.chrome);
}

export class ClawArm {
  /** Shoulder pivot (world). */
  px = 0;
  py = 0;
  /** Wrist target (world). */
  wx = 0;
  wy = 0;
  /** Solved elbow. */
  ex = 0;
  ey = 0;
  /** Effective wrist after reach clamping. */
  rx = 0;
  ry = 0;
  /** 0 = stowed .. 1 = fully extended (telescoping). */
  out = 0;
  /** Claw sprite frame (0 open, 1 half, 2 closed, 3 spread). */
  frame = 0;
  /** Which side the elbow prefers when the solution is ambiguous (toward the sub = -forward). */
  back: 1 | -1 = 1;
  facing: 1 | -1 = -1;

  get l1(): number {
    return ARM_L1 * this.out;
  }
  get l2(): number {
    return ARM_L2 * this.out;
  }

  /** Solve the elbow for the current pivot/wrist (elbow up). */
  solve(): void {
    const a = Math.max(0.5, this.l1);
    const b = Math.max(0.5, this.l2);
    let dx = this.wx - this.px;
    let dy = this.wy - this.py;
    let d = Math.hypot(dx, dy);
    const maxD = a + b - 0.5;
    const minD = Math.abs(a - b) + 0.5;
    if (d < 1e-3) {
      dx = 0;
      dy = -1;
      d = 1e-3;
    }
    const k = clamp(d, minD, maxD) / d;
    this.rx = this.px + dx * k;
    this.ry = this.py + dy * k;
    const dd = clamp(d, minD, maxD);
    const base = Math.atan2(dy, dx);
    const cosA = clamp((a * a + dd * dd - b * b) / (2 * a * dd), -1, 1);
    const A = Math.acos(cosA);
    const e1x = this.px + Math.cos(base + A) * a;
    const e1y = this.py + Math.sin(base + A) * a;
    const e2x = this.px + Math.cos(base - A) * a;
    const e2y = this.py + Math.sin(base - A) * a;
    let pick1: boolean;
    if (Math.abs(e1y - e2y) > 2) pick1 = e1y < e2y;
    else pick1 = (e1x - e2x) * this.back > 0;
    this.ex = pick1 ? e1x : e2x;
    this.ey = pick1 ? e1y : e2y;
  }

  /** Max horizontal reach at a given wrist height. */
  reachAt(y: number): number {
    const dy = y - this.py;
    return Math.sqrt(Math.max(0, (ARM_REACH - 2) ** 2 - dy * dy));
  }

  /** World rect of the claw (fingers) for hits/contact. */
  clawRect(lowerOnly = false): Rect {
    const top = lowerOnly ? this.ry + CLAW_H - 20 : this.ry + 2;
    const half = this.frame === 2 ? 11 : this.frame === 3 ? 19 : 15;
    return { x: this.rx - half, y: top, w: half * 2, h: this.ry + CLAW_H - top };
  }

  render(g: CanvasRenderingContext2D, flash: boolean, ext = 1): void {
    if (this.out <= 0.02) return;
    const upper = { base: BC.olive, lit: BC.oliveL, dark: BC.oliveDD, band: BC.oliveD };
    const fore = { base: LV.s2, lit: LV.s1, dark: LV.s4, band: LV.s3 };
    const px = Math.round(this.px);
    const py = Math.round(this.py);
    const ex = Math.round(this.ex);
    const ey = Math.round(this.ey);
    const rx = Math.round(this.rx);
    const ry = Math.round(this.ry);
    // Pistons behind the booms.
    piston(g, px, py, ex, ey, -7, ext);
    piston(g, ex, ey, rx, ry, -6, ext);
    boom(g, px, py, ex, ey, 11, upper, true);
    boom(g, ex, ey, rx, ry, 9, fore, true);
    const joint = sprites.get('bm4_joint');
    joint.draw(g, px, py, 0, { flash });
    joint.draw(g, ex, ey, 0, { flash });
    sprites.get('bm4_claw').draw(g, rx, ry, this.frame, { flip: this.facing < 0, flash });
    joint.draw(g, rx, ry, 1, { flash });
  }
}
