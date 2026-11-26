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

/** Draw text with the pixel font. (x, y) is the top-left (or top-center/right per align). Returns width. */
export function drawText(g: CanvasRenderingContext2D, text: string, x: number, y: number, opts: TextOpts = {}): number {
  const scale = Math.max(1, Math.round(opts.scale ?? 1));
  const spacing = opts.spacing ?? 1;
  const color = opts.color ?? '#ffffff';
  const w = textWidth(text, scale, spacing);
  let sx = Math.round(x);
  if (opts.align === 'center') sx = Math.round(x - w / 2);
  else if (opts.align === 'right') sx = Math.round(x - w);
  const sy = Math.round(y);
  const prevAlpha = g.globalAlpha;
  if (opts.alpha !== undefined) g.globalAlpha = prevAlpha * opts.alpha;
  if (opts.outline) {
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      drawRaw(g, text, sx + dx * scale, sy + dy * scale, opts.outline, scale, spacing);
    }
  } else {
    const shadow = opts.shadow === undefined ? '#000000' : opts.shadow;
    if (shadow) drawRaw(g, text, sx + scale, sy + scale, shadow, scale, spacing);
  }
  drawRaw(g, text, sx, sy, color, scale, spacing);
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
