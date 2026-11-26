// Render registered sprites to a PNG contact sheet without a browser (run with bun).
//   bun scripts/spritesheet.ts [filter-regex] [out.png] [scale]
// Imports all content modules, then lays out every sprite whose name matches the filter:
// one row per sprite, all frames left to right. Prints a legend (row -> sprite name).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Minimal DOM shims so content modules that touch `document`/`window` at import time don't crash.
const g = globalThis as any;
g.window ??= g;
g.document ??= { createElement: () => ({ getContext: () => null }) };
g.localStorage ??= { getItem: () => null, setItem: () => {} };

const filter = new RegExp(process.argv[2] ?? '.');
const out = process.argv[3] ?? 'artifacts/spritesheet.png';
const scale = parseInt(process.argv[4] ?? '3', 10);

// Import every module under src/ that registers content (skip ones that rely on Vite globs or the DOM entry).
const { globSync, readFileSync } = await import('node:fs');
const root = new URL('../', import.meta.url).pathname;
const files = (globSync as any)(['src/game/**/*.ts', 'src/art/**/*.ts', 'src/content/**/*.ts'], { cwd: root }) as string[];
for (const f of files.sort()) {
  const src = readFileSync(root + f, 'utf8');
  if (src.includes('import.meta.glob')) continue;
  try {
    await import(root + f);
  } catch (e) {
    console.error('failed to import', f, e);
  }
}
const { sprites } = await import('../src/engine/sprites');

const list = sprites.all().filter((s) => filter.test(s.name)).sort((a, b) => a.name.localeCompare(b.name));
if (!list.length) {
  console.error('no sprites match', filter);
  process.exit(1);
}
const pad = 2;
let W = 0;
let H = 0;
const rows = list.map((s) => {
  const frames = Array.from({ length: s.frameCount }, (_, i) => s.pixelArt(i));
  const rw = frames.reduce((a, f) => a + f.w + pad, pad);
  const rh = Math.max(...frames.map((f) => f.h)) + pad;
  W = Math.max(W, rw);
  H += rh;
  return { s, frames, rh };
});
H += pad;
const img = new Uint32Array(W * H);
// Checker background so transparency is visible.
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) img[y * W + x] = ((x >> 2) + (y >> 2)) % 2 ? 0xff6a5a5a : 0xff7a6a6a;
let yy = pad;
rows.forEach((r, ri) => {
  let xx = pad;
  for (const f of r.frames) {
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const v = f.data[y * f.w + x];
        if (v >>> 24) img[(yy + y) * W + xx + x] = v;
      }
    // frame boundary marker
    for (let y = 0; y < f.h; y++) {
      const i = (yy + y) * W + xx + f.w;
      if (xx + f.w < W) img[i] = 0xff00a0ff;
    }
    xx += f.w + pad;
  }
  console.log(`row ${ri}: ${r.s.name} (${r.s.frameCount} frames, ${r.s.w}x${r.s.h})`);
  yy += r.rh;
});

// Scale up.
const SW = W * scale;
const SH = H * scale;
const raw = Buffer.alloc((SW * 4 + 1) * SH);
for (let y = 0; y < SH; y++) {
  raw[y * (SW * 4 + 1)] = 0;
  for (let x = 0; x < SW; x++) {
    const v = img[Math.floor(y / scale) * W + Math.floor(x / scale)];
    const o = y * (SW * 4 + 1) + 1 + x * 4;
    raw[o] = v & 255;
    raw[o + 1] = (v >>> 8) & 255;
    raw[o + 2] = (v >>> 16) & 255;
    raw[o + 3] = 255;
  }
}
function crc32(buf: Buffer): number {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SW, 0);
ihdr.writeUInt32BE(SH, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`wrote ${out} (${SW}x${SH})`);
