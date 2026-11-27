// Volumetric pixel-art clouds for STORMFRONT's backdrop.
//
// A cloud is a union of "blobs" (spheres / ellipsoids). Their silhouette is the union of discs; each
// pixel takes the surface normal of the blob nearest the viewer there, so every billow is shaded as
// a dome: lambert light from the top-left (cool), a self-shadow test along the light direction
// (billows shade the ones behind them, which is what makes cauliflower tops read), a warm glow on
// undersides near the bottom edge (the dusk horizon below), and a bright rim on lit top edges.
// Tones are quantized to a short ramp with ordered dithering only in a narrow band between steps,
// so the result stays crisp. Everything here is pure PixelArt (baked once at startup).

import { PixelArt, parseColor } from '../../../engine/pixelart';

export interface Blob {
  x: number;
  y: number;
  /** Horizontal radius. */
  r: number;
  /** Vertical radius (default r). */
  ry?: number;
  /** Extra height toward the viewer (front billows win where blobs overlap). */
  z?: number;
  /** Flat bottom: this blob draws nothing below this y. */
  cut?: number;
}

export interface CloudLook {
  /** Shading ramp, dark -> light. */
  ramp: readonly string[];
  /** Light floor (0..1) for unlit sides. */
  ambient?: number;
  /** Self-shadow darkening (0..1). */
  shadow?: number;
  /** Warm underside glow tones (weak -> strong) and how far up from the bottom edge it reaches. */
  glow?: readonly string[];
  glowDepth?: number;
  /** Lit top-edge rim color (default: lightest ramp tone). null = no rim. */
  rim?: string | null;
  /** Cut everything below this y (flat cloud base); the last px above it get darker. */
  baseY?: number;
  /** Tileable horizontally (blobs wrap around). */
  wrap?: boolean;
  /** Light direction (x, y, z toward viewer); default top-left. */
  light?: readonly [number, number, number];
  /** Darken toward the bottom of the image (0..1 at the bottom). */
  depthFade?: number;
  /** Extra brightness per px of height above the base (towers get lighter tops). */
  heightLight?: number;
  /**
   * Volume light: brightness falls off with the depth of cloud between a pixel and the light
   * (px, e-folding length). Gives the big masses their form; billow lambert adds the lobes.
   */
  volume?: number;
  /** Weight of the volume term vs. the billow lambert (0..1, default 0.55 when volume is set). */
  volumeMix?: number;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/** Heightfield of a set of blobs: per pixel height + unit normal of the front-most blob. */
export interface CloudField {
  w: number;
  h: number;
  hgt: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
}

const EMPTY = -1e9;

export function cloudField(w: number, h: number, blobs: Blob[], wrap = false, baseY?: number): CloudField {
  const n = w * h;
  const f: CloudField = { w, h, hgt: new Float32Array(n).fill(EMPTY), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n) };
  for (const b of blobs) {
    const rx = b.r;
    const ry = b.ry ?? b.r;
    if (rx <= 0.5 || ry <= 0.5) continue;
    const z = b.z ?? 0;
    const scale = Math.min(rx, ry);
    for (const o of wrap ? [-w, 0, w] : [0]) {
      const cx = b.x + o;
      const x0 = Math.max(0, Math.floor(cx - rx));
      const x1 = Math.min(w - 1, Math.ceil(cx + rx));
      const y0 = Math.max(0, Math.floor(b.y - ry));
      const y1 = Math.min(h - 1, Math.ceil(b.y + ry));
      for (let y = y0; y <= y1; y++) {
        if (baseY !== undefined && y > baseY) break;
        if (b.cut !== undefined && y > b.cut) break;
        const v = (y + 0.5 - b.y) / ry;
        for (let x = x0; x <= x1; x++) {
          const u = (x + 0.5 - cx) / rx;
          const d2 = u * u + v * v;
          if (d2 >= 1) continue;
          const wz = Math.sqrt(1 - d2);
          const hh = wz * scale + z;
          const i = y * w + x;
          if (hh > f.hgt[i]) {
            f.hgt[i] = hh;
            f.nx[i] = u;
            f.ny[i] = v;
            f.nz[i] = wz;
          }
        }
      }
    }
  }
  return f;
}

/** Paint a cloud field into p (only where the field is solid). */
export function paintCloud(p: PixelArt, f: CloudField, look: CloudLook): void {
  const { w, h, hgt, nx, ny, nz } = f;
  const ramp = look.ramp.map((c) => parseColor(c));
  const glow = (look.glow ?? []).map((c) => parseColor(c));
  const rim = look.rim === null ? 0 : parseColor(look.rim ?? look.ramp[look.ramp.length - 1]);
  const amb = look.ambient ?? 0.2;
  const shadow = look.shadow ?? 0.5;
  const glowDepth = look.glowDepth ?? 10;
  const [lx0, ly0, lz0] = look.light ?? [-0.5, -0.72, 0.48];
  const ll = Math.hypot(lx0, ly0, lz0);
  const lx = lx0 / ll;
  const ly = ly0 / ll;
  const lz = lz0 / ll;
  const lxy = Math.hypot(lx, ly) || 1;
  const dx = lx / lxy;
  const dy = ly / lxy;
  const slope = lz / lxy;
  const solid = (x: number, y: number) => {
    if (y < 0 || y >= h) return false;
    if (x < 0 || x >= w) {
      if (!look.wrap) return false;
      x = ((x % w) + w) % w;
    }
    return hgt[y * w + x] > EMPTY;
  };
  const H = (x: number, y: number) => {
    if (y < 0 || y >= h) return EMPTY;
    if (x < 0 || x >= w) {
      if (!look.wrap) return EMPTY;
      x = ((x % w) + w) % w;
    }
    return hgt[y * w + x];
  };
  // Distance (px) to the bottom silhouette edge below each pixel (for the underside glow).
  const below = new Int16Array(w * h);
  for (let x = 0; x < w; x++) {
    let d = 0;
    for (let y = h - 1; y >= 0; y--) {
      const i = y * w + x;
      d = hgt[i] > EMPTY ? d + 1 : 0;
      below[i] = d;
    }
  }
  const n = ramp.length;
  const vol = look.volume ?? 0;
  const volMix = look.volumeMix ?? 0.55;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const hh = hgt[i];
      if (hh <= EMPTY) continue;
      let lam = Math.max(0, nx[i] * lx + ny[i] * ly + nz[i] * lz);
      if (vol > 0) {
        // March toward the light through the cloud.
        let d = 0;
        const max = vol * 3;
        while (d < max && solid(Math.round(x + dx * (d + 1)), Math.round(y + dy * (d + 1)))) d++;
        lam = volMix * Math.exp(-d / vol) + (1 - volMix) * lam;
      }
      let v = amb + (1 - amb) * lam;
      // Self-shadow: a billow nearer the light towers over this point.
      if (shadow > 0) {
        for (const k of [2, 4, 7, 11, 16]) {
          const sh = H(Math.round(x + dx * k), Math.round(y + dy * k));
          if (sh > hh + k * slope + 1.5) {
            v *= 1 - shadow;
            break;
          }
        }
      }
      if (look.heightLight) v += look.heightLight * (1 - y / h);
      if (look.depthFade) v -= look.depthFade * (y / h);
      v = Math.max(0, Math.min(0.999, v));
      const t = v * (n - 1);
      const i0 = Math.floor(t);
      const fr = Math.max(0, Math.min(1, (t - i0 - 0.5) * 2.4 + 0.5));
      let c = ramp[Math.min(n - 1, fr > bayer(x, y) ? i0 + 1 : i0)];
      // Warm underside glow near the bottom edge.
      if (glow.length && ny[i] > 0.05) {
        const g = Math.min(1, ny[i] * 1.4) * (1 - below[i] / glowDepth);
        if (g > 0) {
          const gi = Math.min(glow.length - 1, Math.floor(g * glow.length + bayer(x, y) * 0.9 - 0.2));
          if (gi >= 0 && g > bayer(x + 1, y) * 0.5) c = glow[gi];
        }
      }
      // Lit rim on top-left edges.
      if (rim && nx[i] * lx + ny[i] * ly + nz[i] * lz > 0.45 && (!solid(x, y - 1) || (!solid(x - 1, y) && ny[i] < 0.2))) c = rim;
      p.data[i] = c;
    }
  }
}

/** Convenience: field + paint into a fresh PixelArt. */
export function cloudArt(w: number, h: number, blobs: Blob[], look: CloudLook): { art: PixelArt; field: CloudField } {
  const art = new PixelArt(w, h);
  const field = cloudField(w, h, blobs, look.wrap, look.baseY);
  paintCloud(art, field, look);
  return { art, field };
}
