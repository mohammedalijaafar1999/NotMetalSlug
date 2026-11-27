// Bitmap pixel font (5x7 uppercase) baked into per-color atlases.
//   drawText(g, 'SCORE 1200', 10, 8, { color: '#ffd040', align: 'left', shadow: '#000' })
// Lowercase input is rendered as uppercase. Special glyphs: ∞ ♥ → ← ↑ ↓ × ★

const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  ';': ['..', '.#', '..', '..', '..', '.#', '#.'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['....', '....', '####', '....', '####', '....', '....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'],
  ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '|': ['#', '#', '#', '#', '#', '#', '#'],
  '*': ['..#..', '..#..', '#####', '.###.', '.#.#.', '#...#', '.....'],
  '★': ['..#..', '..#..', '#####', '.###.', '.#.#.', '#...#', '.....'],
  '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  '∞': ['.......', '.......', '.##.##.', '#..#..#', '#..#..#', '.##.##.', '.......'],
  '♥': ['.#.#.', '#####', '#####', '#####', '.###.', '..#..', '.....'],
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'],
  '←': ['.....', '..#..', '.#...', '#####', '.#...', '..#..', '.....'],
  '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '.....'],
  '↓': ['.....', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  // UI glyphs (menus, scroll hints, sound test, footer).
  '©': ['.#####.', '#.....#', '#..##.#', '#.#...#', '#..##.#', '#.....#', '.#####.'],
  '▶': ['#....', '##...', '###..', '####.', '###..', '##...', '#....'],
  '◀': ['....#', '...##', '..###', '.####', '..###', '...##', '....#'],
  '▲': ['.....', '.....', '..#..', '.###.', '#####', '.....', '.....'],
  '▼': ['.....', '.....', '#####', '.###.', '..#..', '.....', '.....'],
  '◆': ['.....', '..#..', '.###.', '#####', '.###.', '..#..', '.....'],
  '♪': ['..##.', '..#.#', '..#..', '..#..', '###..', '###..', '.....'],
  '■': ['.....', '#####', '#####', '#####', '#####', '#####', '.....'],
  '●': ['.....', '.###.', '#####', '#####', '#####', '.###.', '.....'],
  '✓': ['.....', '....#', '...##', '#.##.', '###..', '.#...', '.....'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  '~': ['.....', '.....', '.#...', '#.#.#', '...#.', '.....', '.....'],
  '^': ['..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
  '…': ['.....', '.....', '.....', '.....', '.....', '.....', '#.#.#'],
};

export const FONT_H = 7;

interface GlyphInfo {
  x: number;
  w: number;
}

const glyphInfo = new Map<string, GlyphInfo>();
let atlasW = 0;
for (const [ch, rows] of Object.entries(G)) {
  const w = rows[0].length;
  glyphInfo.set(ch, { x: atlasW, w });
  atlasW += w + 1;
}

function normalizeChar(ch: string): string {
  if (G[ch]) return ch;
  const up = ch.toUpperCase();
  if (G[up]) return up;
  return '?';
}

const atlases = new Map<string, HTMLCanvasElement>();

function atlasFor(color: string): HTMLCanvasElement {
  let a = atlases.get(color);
  if (a) return a;
  a = document.createElement('canvas');
  a.width = atlasW;
  a.height = FONT_H;
  const ctx = a.getContext('2d')!;
  ctx.fillStyle = color;
  for (const [ch, rows] of Object.entries(G)) {
    const info = glyphInfo.get(ch)!;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) if (row[x] === '#') ctx.fillRect(info.x + x, y, 1, 1);
    }
  }
  atlases.set(color, a);
  return a;
}

export interface TextOpts {
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Drop shadow color (1px down-right). Default '#000000'. null disables. */
  shadow?: string | null;
  /** Full 1px outline color (overrides shadow when set). */
  outline?: string | null;
  /** Integer scale. */
  scale?: number;
  alpha?: number;
  /** Extra pixels between glyphs (default 1). */
  spacing?: number;
}

/** Width in pixels of a string at given scale. */
export function textWidth(text: string, scale = 1, spacing = 1): number {
  let w = 0;
  for (const ch of text) {
    const info = glyphInfo.get(normalizeChar(ch))!;
    w += info.w + spacing;
  }
  if (w > 0) w -= spacing;
  return w * scale;
}

function drawRaw(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale: number, spacing: number): void {
  const atlas = atlasFor(color);
  let cx = x;
  for (const ch of text) {
    const info = glyphInfo.get(normalizeChar(ch))!;
    if (ch !== ' ') g.drawImage(atlas, info.x, 0, info.w, FONT_H, cx, y, info.w * scale, FONT_H * scale);
    cx += (info.w + spacing) * scale;
  }
}

const OUTLINE_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

/** Glyph-by-glyph drawing: outline (8 offset copies) or drop shadow, then the text itself. */
function drawGlyphs(g: CanvasRenderingContext2D, text: string, sx: number, sy: number, color: string, shadow: string | null, outline: string | null, scale: number, spacing: number): void {
  if (outline) {
    for (const [dx, dy] of OUTLINE_OFFSETS) drawRaw(g, text, sx + dx * scale, sy + dy * scale, outline, scale, spacing);
  } else if (shadow) drawRaw(g, text, sx + scale, sy + scale, shadow, scale, spacing);
  drawRaw(g, text, sx, sy, color, scale, spacing);
}

// Whole-string cache. Most HUD and menu text is outlined, i.e. 9 blits per glyph: a 2-player HUD
// alone issued ~440 drawImage calls a frame, the biggest fixed rendering cost of every mission.
// A baked string is a single blit. Strings are baked on their second request, so values that
// change every frame (rolling tally scores) keep using the glyph path instead of churning canvases.
const TEXT_CACHE_MAX = 320;
interface BakedText {
  c: HTMLCanvasElement;
  /** Where the text's top-left sits inside the baked canvas (outline padding). */
  pad: number;
}
const textCache = new Map<string, BakedText>();
const textSeen = new Set<string>();

function bakeText(text: string, color: string, shadow: string | null, outline: string | null, scale: number, spacing: number, w: number): BakedText | null {
  if (typeof document === 'undefined') return null;
  const pad = outline ? scale : 0;
  const tail = outline ? pad : shadow ? scale : 0;
  const c = document.createElement('canvas');
  c.width = Math.max(1, w + pad + tail);
  c.height = FONT_H * scale + pad + tail;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false; // scaled glyphs stay crisp
  drawGlyphs(ctx, text, pad, pad, color, shadow, outline, scale, spacing);
  return { c, pad };
}

/** Cached strings currently held (tests / debug). */
export function textCacheSize(): number {
  return textCache.size;
}

/** Draw text with the pixel font. (x, y) is the top-left (or top-center/right per align). Returns width. */
export function drawText(g: CanvasRenderingContext2D, text: string, x: number, y: number, opts: TextOpts = {}): number {
  const scale = Math.max(1, Math.round(opts.scale ?? 1));
  const spacing = opts.spacing ?? 1;
  const color = opts.color ?? '#ffffff';
  const w = textWidth(text, scale, spacing);
  if (w <= 0) return w;
  let sx = Math.round(x);
  if (opts.align === 'center') sx = Math.round(x - w / 2);
  else if (opts.align === 'right') sx = Math.round(x - w);
  const sy = Math.round(y);
  const outline = opts.outline || null;
  const shadow = outline ? null : opts.shadow === undefined ? '#000000' : opts.shadow || null;
  const prevAlpha = g.globalAlpha;
  if (opts.alpha !== undefined) g.globalAlpha = prevAlpha * opts.alpha;
  const key = `${scale}|${spacing}|${color}|${outline ?? ''}|${shadow ?? ''}|${text}`;
  let baked = textCache.get(key);
  if (baked) {
    // Keep recently used strings at the young end of the map (LRU).
    textCache.delete(key);
    textCache.set(key, baked);
  } else if (textSeen.has(key)) {
    textSeen.delete(key);
    baked = bakeText(text, color, shadow, outline, scale, spacing, w) ?? undefined;
    if (baked) {
      textCache.set(key, baked);
      if (textCache.size > TEXT_CACHE_MAX) textCache.delete(textCache.keys().next().value!);
    }
  } else {
    if (textSeen.size > 2048) textSeen.clear();
    textSeen.add(key);
  }
  if (baked) g.drawImage(baked.c, sx - baked.pad, sy - baked.pad);
  else drawGlyphs(g, text, sx, sy, color, shadow, outline, scale, spacing);
  g.globalAlpha = prevAlpha;
  return w;
}

/** Word-wrap text to a max pixel width. */
export function wrapText(text: string, maxW: number, scale = 1): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (textWidth(test, scale) > maxW && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

export const FONT_GLYPHS = Object.keys(G);

/** Raw 5x7 bitmap rows for a character ('#' = ink), e.g. to bake text into PixelArt sprites. */
export function glyphRows(ch: string): readonly string[] {
  return G[normalizeChar(ch)];
}
