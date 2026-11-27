// Palm Harbor decor renderers (world space). Each kind draws one of the m1_* sprites from
// ./decor_art.ts at the decor's anchor (bottom-centre on the ground unless noted), with gentle
// animation driven by time (palm sway, torch flames, banners, bobbing boats, smoke wisps).
// Decor props: v = variant/frame, n = repeat count (palisade, fence), bob = float on water.

import { PixelArt } from '../../../engine/pixelart';
import { sprites } from '../../../engine/sprites';
import type { DecorDef } from '../../../game/level';
import type { DecorRenderer } from '../../../game/theme';
import { h01 } from './layout';
import './decor_art';

const phase = (d: DecorDef) => h01(Math.round(d.x), Math.round(d.y), 77) * 10;

function still(name: string, defV = 0): DecorRenderer {
  return (g, d) => sprites.get(name).draw(g, d.x, d.y, d.props?.v ?? defV);
}

function animated(name: string, fps: number, frames: number[]): DecorRenderer {
  return (g, d, t) => {
    const f = frames[Math.floor(t * fps + phase(d)) % frames.length];
    sprites.get(name).draw(g, d.x, d.y, f);
  };
}

function repeated(name: string, step: number): DecorRenderer {
  return (g, d) => {
    const n = d.props?.n ?? 1;
    const s = sprites.get(name);
    for (let i = 0; i < n; i++) s.draw(g, d.x + i * step, d.y, 0);
  };
}

// Soft smoke puffs (baked lazily on first use: canvases need the DOM).
let puffs: HTMLCanvasElement[] | null = null;
function puff(r: number): HTMLCanvasElement {
  if (!puffs) {
    puffs = [];
    for (let k = 0; k < 6; k++) {
      const rr = 1.5 + k;
      const n = Math.ceil(rr * 2 + 3);
      const p = new PixelArt(n, n);
      p.circle(n / 2 + 0.5, n / 2 + 0.6, rr, '#5c5a60');
      p.circle(n / 2, n / 2, rr - 0.5, '#76747a');
      p.circle(n / 2 - rr * 0.3, n / 2 - rr * 0.3, rr * 0.45, '#8e8c92');
      puffs.push(p.toCanvas());
    }
  }
  return puffs[Math.max(0, Math.min(puffs.length - 1, Math.round(r)))];
}

/** Rising smoke wisps from (x, y). */
function smoke(g: CanvasRenderingContext2D, x: number, y: number, t: number, n: number, rise: number, alpha: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const u = (t * 0.35 + i / n + seed) % 1;
    const img = puff(u * 5);
    g.globalAlpha = alpha * (u < 0.1 ? u / 0.1 : 1 - u);
    g.drawImage(img, Math.round(x + u * 10 + Math.sin(u * 7 + i) * 2 - img.width / 2), Math.round(y - u * rise - img.height / 2));
  }
  g.globalAlpha = 1;
}

export const M1_DECOR: Record<string, DecorRenderer> = {
  palm: (g, d, t) => {
    const f = [0, 1, 2, 1][Math.floor(t * 1.3 + phase(d)) % 4];
    sprites.get(`m1_palm_${(d.props?.v ?? 0) % 3}`).draw(g, d.x, d.y, f);
  },
  banana: still('m1_banana'),
  fern: still('m1_fern'),
  hut: still('m1_hut'),
  rack: still('m1_rack'),
  torch: animated('m1_torch', 9, [0, 1, 2, 3]),
  campfire: (g, d, t) => {
    sprites.get('m1_campfire').draw(g, d.x, d.y, Math.floor(t * 10 + phase(d)) % 4);
    smoke(g, d.x, d.y - 18, t, 4, 30, 0.45, 0.3);
  },
  net: still('m1_net'),
  boat: (g, d, t) => {
    const bob = d.props?.bob ? Math.round(Math.sin(t * 1.6 + phase(d)) * 1) : 0;
    sprites.get('m1_boat').draw(g, d.x, d.y + bob, 0);
  },
  beachprop: still('m1_beachprop'),
  rock: still('m1_rock'),
  crates: still('m1_crates'),
  drums: still('m1_drums'),
  sign: still('m1_sign'),
  landing: (g, d, t) => {
    sprites.get('m1_landing').draw(g, d.x, d.y, 0);
    // The wrecked engine still smokes.
    smoke(g, d.x - 60, d.y - 26, t, 5, 46, 0.55, 0);
  },
  palisade: repeated('m1_palisade', 48),
  tower: still('m1_tower'),
  banner: animated('m1_banner', 6, [0, 1, 2, 3]),
  silo: still('m1_silo'),
  jtree: still('m1_jtree'),
  vines: still('m1_vines'),
  fence: repeated('m1_fence', 48),
  sandwall: still('m1_sandwall'),
};
