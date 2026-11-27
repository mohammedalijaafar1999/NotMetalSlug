// IRON CITADEL parallax layers (pure PixelArt, horizontally tileable):
//   far   - the citadel keep, towers and smokestacks against the ember sky (lit slits, red beacons)
//   smoke - drifting smog banks (drawn translucent, slowly scrolling)
//   mid   - foundry halls: sawtooth roofs, glowing chimneys, gas holders, gantry cranes
//   near  - lattice girders, a big steam main with flanges, hanging chains and hooks, piston housings
// All of it stays dark and desaturated: only windows/chimney mouths carry warm light.

import { PixelArt, shade } from '../../../engine/pixelart';
import { Rng } from '../../../engine/rng';
import { M6 } from './palette';

const wrap = (x: number, w: number) => ((x % w) + w) % w;

/** Rect that wraps around the layer period. */
function wrect(p: PixelArt, x: number, y: number, w: number, h: number, c: string): void {
  for (let i = 0; i < w; i++) p.rect(wrap(Math.round(x) + i, p.w), y, 1, h, c);
}

function wpx(p: PixelArt, x: number, y: number, c: string): void {
  p.px(wrap(Math.round(x), p.w), y, c);
}

/** Crenellated tower with slit windows. */
function tower(p: PixelArt, r: Rng, x: number, w: number, top: number, base: number): void {
  wrect(p, x, top, w, base - top, M6.far);
  wrect(p, x, top, 1, base - top, M6.farHi);
  // merlons
  for (let mx = 0; mx < w; mx += 6) {
    wrect(p, x + mx, top - 4, Math.min(3, w - mx), 4, M6.far);
    wrect(p, x + mx, top - 4, Math.min(3, w - mx), 1, M6.farHi);
  }
  // corbel band under the battlement
  wrect(p, x - 1, top + 3, w + 2, 2, M6.farLo);
  wrect(p, x - 1, top + 2, w + 2, 1, M6.farHi);
  // slit windows
  for (let wy = top + 10; wy < base - 12; wy += r.int(9, 14)) {
    for (let wx = x + 3; wx < x + w - 3; wx += r.int(5, 8)) {
      if (!r.chance(0.32)) continue;
      const lit = r.chance(0.45);
      wrect(p, wx, wy, 1, 3, lit ? M6.farWinHi : M6.farWin);
      if (lit) wpx(p, wx, wy, shade(M6.farWinHi, 0.25));
    }
  }
}

/** Tall factory smokestack with bands and a glowing mouth. */
function stack(p: PixelArt, r: Rng, x: number, w: number, top: number, base: number): void {
  for (let y = top; y < base; y++) {
    const taper = Math.round(((y - top) / (base - top)) * 2);
    wrect(p, x - taper, y, w + taper * 2, 1, M6.far);
    wpx(p, x - taper, y, M6.farHi);
  }
  wrect(p, x - 1, top, w + 2, 2, M6.farHi);
  for (let by = top + 10; by < base - 20; by += r.int(18, 26)) wrect(p, x, by, w, 1, M6.farLo);
  wrect(p, x + 1, top - 1, w - 2, 1, M6.farWinHi);
  wpx(p, x + Math.floor(w / 2), top - 2, M6.moltenL);
  // aviation beacon
  wpx(p, x + Math.floor(w / 2), top + 4, M6.red);
}

export function farLayer(): PixelArt {
  const W = 768;
  const H = 172;
  const p = new PixelArt(W, H);
  const r = new Rng(606);
  const base = H;
  // rampart band
  wrect(p, 0, 132, W, H - 132, M6.far);
  wrect(p, 0, 132, W, 1, M6.farHi);
  for (let x = 0; x < W; x += 8) {
    wrect(p, x, 128, 4, 4, M6.far);
    wrect(p, x, 128, 4, 1, M6.farHi);
  }
  // the great keep (once per period)
  const kx = 300;
  const kw = 132;
  wrect(p, kx, 46, kw, base - 46, M6.far);
  wrect(p, kx, 46, 1, base - 46, M6.farHi);
  wrect(p, kx + 14, 26, kw - 28, 22, M6.far);
  wrect(p, kx + 14, 26, 1, 22, M6.farHi);
  wrect(p, kx + 40, 8, kw - 80, 20, M6.far);
  wrect(p, kx + 40, 8, 1, 20, M6.farHi);
  for (let mx = 0; mx < kw; mx += 7) {
    wrect(p, kx + mx, 42, 4, 4, M6.far);
    wrect(p, kx + mx, 42, 4, 1, M6.farHi);
  }
  // giant cog window on the keep (dim forge light behind)
  const cx = kx + kw / 2;
  const cy = 74;
  for (let a = 0; a < 10; a++) {
    const ang = (a / 10) * Math.PI * 2;
    p.circle(cx + Math.cos(ang) * 9, cy + Math.sin(ang) * 9, 2.2, M6.farWin);
  }
  p.circle(cx, cy, 9, M6.farWin);
  p.circle(cx, cy, 7, shade(M6.farWin, -0.25));
  p.ring(cx, cy, 6, M6.farWin, 1);
  p.circle(cx, cy, 3, M6.far);
  // spires flanking the keep
  for (const sx of [kx + 8, kx + kw - 14]) {
    wrect(p, sx, 20, 6, 30, M6.far);
    p.poly([sx - 1, 21, sx + 7, 21, sx + 3, 4], M6.far);
    wpx(p, sx + 3, 6, M6.red);
  }
  // towers
  let x = 0;
  while (x < W) {
    const w = r.int(18, 36);
    if (x + w > kx - 6 && x < kx + kw + 6) {
      x = kx + kw + r.int(6, 14);
      continue;
    }
    if (r.chance(0.3)) {
      stack(p, r, x + 4, r.int(5, 8), r.int(4, 26), base);
      x += r.int(14, 22);
      continue;
    }
    tower(p, r, x, w, r.int(58, 102), base);
    x += w + r.int(10, 30);
  }
  // a couple more stacks rising behind the rampart
  stack(p, r, 120, 7, 12, base);
  stack(p, r, 560, 8, 3, base);
  stack(p, r, 604, 6, 20, base);
  // warm haze at the foot of the citadel (dithered)
  for (let y = H - 22; y < H; y++) {
    for (let xx = 0; xx < W; xx++) {
      if (!p.opaque(xx, y)) continue;
      const t = (y - (H - 22)) / 22;
      if ((xx + y) % 2 === 0 && t > 0.3) p.px(xx, y, shade(M6.far, 0.05 + t * 0.06));
    }
  }
  return p;
}

/** Drifting smog banks (transparent background). */
export function smokeLayer(): PixelArt {
  const W = 640;
  const H = 110;
  const p = new PixelArt(W, H);
  const r = new Rng(77);
  for (let i = 0; i < 9; i++) {
    const cx = r.int(0, W - 1);
    const cy = r.int(24, H - 30);
    const n = r.int(5, 9);
    const span = r.range(40, 90);
    for (let j = 0; j < n; j++) {
      const ox = cx + (j / (n - 1) - 0.5) * span;
      const oy = cy + r.range(-6, 6);
      const rad = r.range(7, 15);
      for (const k of [-W, 0, W]) {
        p.ellipse(ox + k, oy + 2, rad * 1.5, rad * 0.75, M6.smokeD);
        p.ellipse(ox + k, oy, rad * 1.35, rad * 0.62, M6.smoke);
        p.ellipse(ox + k - 3, oy - 3, rad * 0.8, rad * 0.35, M6.smokeL);
      }
    }
  }
  // dither the edges so the banks feather out
  const src = p.data.slice();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!(src[i] >>> 24)) continue;
      const edge =
        !(src[y * W + wrap(x - 2, W)] >>> 24) || !(src[y * W + wrap(x + 2, W)] >>> 24) || (y > 1 && !(src[(y - 2) * W + x] >>> 24)) || (y < H - 2 && !(src[(y + 2) * W + x] >>> 24));
      if (edge && (x + y) % 2 === 0) p.data[i] = 0;
    }
  }
  return p;
}

function sawtoothHall(p: PixelArt, r: Rng, x: number, w: number, top: number, base: number): void {
  wrect(p, x, top, w, base - top, M6.mid);
  wrect(p, x, top, 1, base - top, M6.midHi);
  // sawtooth roof: vertical glazed face on the left of each tooth
  const tw = 12;
  for (let t = 0; t + tw <= w; t += tw) {
    for (let k = 0; k < tw; k++) {
      const hgt = Math.round(8 * (1 - k / tw));
      wrect(p, x + t + k, top - hgt, 1, hgt, M6.mid);
    }
    wrect(p, x + t, top - 8, 1, 8, M6.midHi);
    for (let gy = top - 7; gy < top - 1; gy += 2) if (r.chance(0.6)) wpx(p, x + t + 1, gy, r.chance(0.25) ? M6.midWinHi : M6.midWin);
  }
  // window grid
  for (let wy = top + 5; wy < base - 8; wy += 6) {
    for (let wx = x + 3; wx < x + w - 3; wx += 5) {
      const v = r.next();
      if (v < 0.09) {
        wrect(p, wx, wy, 2, 3, M6.midWinHi);
        wpx(p, wx, wy, M6.midWinHot);
      } else if (v < 0.3) wrect(p, wx, wy, 2, 3, M6.midWin);
    }
  }
}

function flatHall(p: PixelArt, r: Rng, x: number, w: number, top: number, base: number): void {
  wrect(p, x, top, w, base - top, M6.mid);
  wrect(p, x, top, w, 1, M6.midHi);
  wrect(p, x, top, 1, base - top, M6.midHi);
  wrect(p, x - 1, top + 2, w + 2, 1, M6.midLo);
  // big foundry windows (tall, arched-ish), glowing from inside
  for (let wx = x + 5; wx < x + w - 8; wx += 11) {
    if (!r.chance(0.6)) continue;
    const hot = r.chance(0.35);
    const wy = top + 8;
    const wh = Math.min(16, base - wy - 10);
    wrect(p, wx, wy + 1, 5, wh, hot ? M6.midWinHi : M6.midWin);
    wrect(p, wx + 1, wy, 3, 1, hot ? M6.midWinHi : M6.midWin);
    wrect(p, wx + 2, wy + 1, 1, wh, M6.mid);
    wrect(p, wx, wy + Math.floor(wh / 2), 5, 1, M6.mid);
    if (hot) wrect(p, wx, wy + wh - 3, 5, 2, M6.midWinHot);
  }
}

function chimney(p: PixelArt, x: number, w: number, top: number, base: number): void {
  wrect(p, x, top, w, base - top, M6.mid);
  wrect(p, x, top, 1, base - top, M6.midHi);
  wrect(p, x - 1, top, w + 2, 2, M6.midHi);
  wrect(p, x, top - 1, w, 1, M6.midWinHot);
  wrect(p, x + 1, top - 2, w - 2, 1, M6.midWinHi);
}

function gasHolder(p: PixelArt, x: number, w: number, top: number, base: number): void {
  // cylinder tank inside a lattice frame
  wrect(p, x + 3, top + 6, w - 6, base - top - 6, M6.midLo);
  p.ellipse(wrap(x + w / 2, p.w), top + 6, (w - 6) / 2, 4, M6.midLo);
  for (let i = 0; i <= 4; i++) {
    const cx = x + Math.round((i * (w - 2)) / 4);
    wrect(p, cx, top, 2, base - top, M6.mid);
    wpx(p, cx, top, M6.midHi);
  }
  for (let y = top + 8; y < base; y += 14) wrect(p, x, y, w, 1, M6.mid);
  for (let y = top + 8; y + 14 <= base; y += 14) {
    for (let k = 0; k < 14; k++) {
      for (let i = 0; i < 4; i++) {
        const x0 = x + Math.round((i * (w - 2)) / 4);
        const x1 = x + Math.round(((i + 1) * (w - 2)) / 4);
        wpx(p, x0 + ((x1 - x0) * k) / 14, y + k, M6.mid);
      }
    }
  }
}

function gantry(p: PixelArt, x: number, top: number, base: number): void {
  // A-frame legs + boom with a hanging hook block
  for (let y = top; y < base; y++) {
    const t = (y - top) / (base - top);
    wpx(p, x + 10 - t * 10, y, M6.mid);
    wpx(p, x + 11 - t * 10, y, M6.mid);
    wpx(p, x + 14 + t * 10, y, M6.mid);
    wpx(p, x + 15 + t * 10, y, M6.mid);
  }
  wrect(p, x - 22, top, 70, 3, M6.mid);
  wrect(p, x - 22, top, 70, 1, M6.midHi);
  for (let k = 0; k < 20; k++) wpx(p, x + 12 + k, top - 2 - Math.round(k * 0.25), M6.mid);
  wrect(p, x - 14, top + 3, 1, 22, M6.midLo);
  wrect(p, x - 17, top + 25, 7, 4, M6.mid);
}

export function midLayer(): PixelArt {
  const W = 512;
  const H = 150;
  const p = new PixelArt(W, H);
  const r = new Rng(4242);
  const base = H;
  let x = 0;
  let k = 0;
  while (x < W - 30) {
    const kind = k++ % 5;
    if (kind === 0 || kind === 3) {
      const w = r.int(70, 110);
      const top = r.int(58, 82);
      sawtoothHall(p, r, x, w, top, base);
      if (r.chance(0.7)) chimney(p, x + r.int(10, w - 16), r.int(5, 7), top - r.int(30, 50), top);
      x += w + r.int(2, 10);
    } else if (kind === 1) {
      const w = r.int(54, 70);
      const top = r.int(44, 60);
      flatHall(p, r, x, w, top, base);
      chimney(p, x + 8, 7, top - r.int(36, 54), top);
      chimney(p, x + w - 16, 6, top - r.int(22, 40), top);
      x += w + r.int(4, 12);
    } else if (kind === 2) {
      const w = r.int(44, 54);
      gasHolder(p, x, w, r.int(70, 86), base);
      x += w + r.int(6, 14);
    } else {
      gantry(p, x + 26, r.int(52, 64), base);
      x += 58;
    }
  }
  // low connecting sheds along the bottom
  for (let i = 0; i < W; i += 1) if (!p.opaque(i, base - 18)) wrect(p, i, base - 18, 1, 18, M6.midLo);
  wrect(p, 0, base - 19, W, 1, M6.midHi);
  return p;
}

function truss(p: PixelArt, x: number, top: number, base: number, w = 10): void {
  wrect(p, x, top, 2, base - top, M6.near);
  wrect(p, x + w, top, 2, base - top, M6.near);
  wrect(p, x, top, 1, base - top, M6.nearHi);
  for (let y = top; y + w <= base; y += w) {
    for (let k = 0; k <= w; k++) {
      wpx(p, x + 1 + k, y + k, M6.near);
      wpx(p, x + 1 + w - k, y + k, M6.near);
    }
    wrect(p, x, y, w + 2, 1, M6.near);
  }
}

function chainHook(p: PixelArt, x: number, top: number, len: number): void {
  for (let y = top; y < top + len; y++) wpx(p, x + ((y >> 1) & 1 ? 1 : 0), y, M6.near);
  const y = top + len;
  wrect(p, x - 2, y, 5, 3, M6.near);
  wpx(p, x - 1, y, M6.nearHi);
  // hook
  wrect(p, x, y + 3, 1, 4, M6.near);
  wrect(p, x - 2, y + 7, 3, 1, M6.near);
  wrect(p, x - 3, y + 5, 1, 2, M6.near);
}

/**
 * Near layer (448 x 200): mostly VERTICAL dark structures (lattice towers, riser pipes with elbows,
 * piston housings, crane hooks) so nothing here reads as a walkable ledge; only short, dark spans.
 */
export function nearLayer(): PixelArt {
  const W = 448;
  const H = 200;
  const p = new PixelArt(W, H);
  const r = new Rng(9001);
  const base = H;
  // machinery silhouettes along the bottom: tanks with domed tops, piston housings
  let x = 0;
  while (x < W) {
    const w = r.int(26, 52);
    const top = r.int(140, 164);
    if (r.chance(0.5)) {
      wrect(p, x, top + 6, w, base - top - 6, M6.near);
      p.ellipse(wrap(x + w / 2, W), top + 6, w / 2, 6, M6.near);
      wrect(p, x + 3, top + 2, w - 8, 1, M6.nearHi);
      for (let by = top + 14; by < base; by += 12) wrect(p, x, by, w, 1, M6.nearLo);
    } else {
      wrect(p, x, top, w, base - top, M6.near);
      wrect(p, x, top, w, 1, M6.nearHi);
      wrect(p, x, top, 1, base - top, M6.nearHi);
      // piston rod rising out of the housing
      const px0 = x + Math.floor(w / 2) - 2;
      const rod = r.int(18, 34);
      wrect(p, px0, top - rod, 4, rod, M6.near);
      wpx(p, px0, top - rod, M6.nearHi);
      wrect(p, px0 - 4, top - rod - 4, 12, 4, M6.near);
      wrect(p, px0 - 4, top - rod - 4, 12, 1, M6.nearHi);
    }
    x += w + r.int(10, 34);
  }
  // tall lattice towers that run off the top of the screen
  for (const [tx, tw] of [
    [36, 10],
    [212, 12],
    [338, 10],
  ] as const) {
    truss(p, tx, 0, base, tw);
  }
  // riser pipes with flanges and an elbow into the machinery
  for (const [rx, len] of [
    [118, 120],
    [128, 96],
    [284, 140],
  ] as const) {
    wrect(p, rx, 0, 5, len, M6.near);
    wrect(p, rx, 0, 1, len, M6.nearHi);
    for (let fy = 14; fy < len; fy += 34) {
      wrect(p, rx - 1, fy, 7, 2, M6.near);
      wrect(p, rx - 1, fy, 7, 1, M6.nearHi);
    }
    wrect(p, rx, len, 12, 5, M6.near);
    wrect(p, rx + 7, len, 5, 40, M6.near);
    wrect(p, rx, len, 12, 1, M6.nearHi);
  }
  // short dark pipe spans between towers with hanging chains + hooks
  for (const [sx, sw, sy] of [
    [46, 70, 52],
    [224, 60, 36],
  ] as const) {
    wrect(p, sx, sy, sw, 5, M6.near);
    wrect(p, sx, sy + 5, sw, 1, M6.nearRim);
    chainHook(p, sx + Math.floor(sw * 0.35), sy + 6, r.int(22, 44));
    chainHook(p, sx + Math.floor(sw * 0.8), sy + 6, r.int(10, 26));
  }
  // crane hooks hanging from above the screen
  chainHook(p, 392, 0, 74);
  chainHook(p, 172, 0, 30);
  return p;
}
