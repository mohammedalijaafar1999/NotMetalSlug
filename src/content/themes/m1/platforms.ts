// Palm Harbor platform styles (one-way platforms). Each platform is baked once into a canvas.
//   'pier' | 'pier:<post px>'     weathered boardwalk planks on stilts (village, beach outpost)
//   'bamboo' | 'bamboo:<post px>' lashed bamboo poles (jungle scaffolding, hut roofs)
//   'metal'                       Legion steel catwalk with a hazard edge (fuel depot)
//   anything else                 plain plank shelf
// The walkable surface is the top row of the art; a dark outline frames everything.

import { PixelArt, shade } from '../../../engine/pixelart';
import { OUTLINE_COLOR } from '../../../engine/sprites';
import { PH, h01 } from './layout';

const cache = new Map<string, { img: HTMLCanvasElement; x: number; y: number }>();

function parseStyle(style: string): { kind: string; post: number } {
  const [kind, n] = style.split(':');
  return { kind, post: n ? parseInt(n, 10) || 0 : kind === 'pier' ? 10 : kind === 'bamboo' ? 8 : 0 };
}

/** Paint a platform into p; (ox, oy) is the world position of p's top-left. */
function paint(p: PixelArt, ox: number, oy: number, x1: number, y1: number, x2: number, y2: number, style: string): void {
  const { kind, post } = parseStyle(style);
  const xa = Math.round(x1);
  const xb = Math.round(x2);
  const yAt = (x: number) => Math.round(y1 + (y2 - y1) * (xb === xa ? 0 : (x - xa) / (xb - xa)));
  const T = kind === 'metal' ? 5 : kind === 'bamboo' ? 4 : 5; // deck thickness
  // Supports first (behind the deck).
  if (post > 0) {
    const step = kind === 'bamboo' ? 26 : 22;
    for (let x = xa + 4; x <= xb - 4; x += step) {
      const y = yAt(x) + T - oy;
      const px = x - ox;
      if (kind === 'metal') {
        p.rect(px - 1, y, 3, post, PH.steelD);
        p.rect(px - 1, y, 1, post, PH.steel);
      } else if (kind === 'bamboo') {
        p.rect(px - 1, y, 3, post, PH.bambooD);
        p.rect(px - 1, y, 1, post, PH.bamboo);
        for (let k = 6; k < post; k += 9) p.rect(px - 1, y + k, 3, 1, shade(PH.bambooD, -0.25));
      } else {
        p.rect(px - 1, y, 3, post, PH.woodD);
        p.rect(px - 1, y, 1, post, PH.wood);
        p.rect(px + 1, y, 1, post, PH.woodDD);
        // Cross brace to the next post.
        if (x + step <= xb - 4 && post > 10) p.line(px + 1, y + 2, px + step - 1, y + Math.min(post - 2, 12), PH.woodDD);
      }
    }
  }
  for (let x = xa; x < xb; x++) {
    const y = yAt(x) - oy;
    const px = x - ox;
    const i = x - xa;
    if (kind === 'metal') {
      p.rect(px, y, 1, 1, PH.steelL);
      p.rect(px, y + 1, 1, 2, i % 4 === 0 ? PH.steelD : PH.steel);
      p.rect(px, y + 3, 1, 2, (i >> 2) % 2 === 0 ? PH.yellow : '#2a2a30');
    } else if (kind === 'bamboo') {
      const node = i % 13 === 0;
      p.rect(px, y, 1, 1, node ? PH.bambooD : PH.bambooL);
      p.rect(px, y + 1, 1, 1, node ? PH.bambooD : PH.bamboo);
      p.rect(px, y + 2, 1, 1, node ? shade(PH.bambooD, -0.2) : PH.bambooD);
      p.rect(px, y + 3, 1, 1, shade(PH.bambooD, -0.25));
      if (i % 26 === 7) {
        p.rect(px, y, 2, 4, PH.rope);
        p.px(px + 1, y + 3, shade(PH.rope, -0.3));
      }
    } else {
      // Planks: light top edge, a gap every plank, knots, darker underside.
      const plank = Math.floor(i / 9);
      const gap = i % 9 === 0;
      const base = shade(PH.plank, (h01(plank, 0, 301) - 0.5) * 0.18);
      p.rect(px, y, 1, 1, gap ? PH.woodD : shade(base, 0.28));
      p.rect(px, y + 1, 1, 2, gap ? PH.woodDD : base);
      p.rect(px, y + 3, 1, 1, gap ? PH.woodDD : shade(base, -0.18));
      p.rect(px, y + 4, 1, 1, PH.woodDD);
      if (!gap && h01(x, 3, 302) < 0.04) p.px(px, y + 2, shade(base, -0.3));
    }
  }
  // Outline around the deck.
  const ol = OUTLINE_COLOR;
  for (let x = xa - 1; x <= xb; x++) {
    const xx = Math.min(xb - 1, Math.max(xa, x));
    const y = yAt(xx) - oy;
    const px = x - ox;
    if (!p.opaque(px, y - 1)) p.px(px, y - 1, ol);
    if (!p.opaque(px, y + T)) p.px(px, y + T, ol);
    if (x === xa - 1 || x === xb) for (let k = 0; k < T; k++) p.px(px, y + k, ol);
  }
}

/** ThemeDef.platform implementation. */
export function m1Platform(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, style: string): void {
  const key = `${x1},${y1},${x2},${y2},${style}`;
  let c = cache.get(key);
  if (!c) {
    const { post } = parseStyle(style);
    const ox = Math.round(x1) - 2;
    const oy = Math.round(Math.min(y1, y2)) - 2;
    const w = Math.round(x2) - ox + 3;
    const h = Math.round(Math.max(y1, y2)) - oy + 8 + post;
    const p = new PixelArt(w, h);
    paint(p, ox, oy, x1, y1, x2, y2, style);
    c = { img: p.toCanvas(), x: ox, y: oy };
    if (cache.size > 64) cache.clear();
    cache.set(key, c);
  }
  g.drawImage(c.img, c.x, c.y);
}
