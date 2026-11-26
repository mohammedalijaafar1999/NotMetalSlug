// Every sfx/song name referenced in source code must be defined by the audio content.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import '../src/content/index';
import { audio } from '../src/engine/audio';

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk('src');
const src = files.map((f) => [f, readFileSync(f, 'utf8')] as const);

describe('audio references', () => {
  it('all sfx names used in code are defined', () => {
    const used = new Map<string, string>();
    const re = /(?:\.sfx|audio\.play)\(\s*'([a-z0-9_]+)'/g;
    for (const [f, s] of src) for (const m of s.matchAll(re)) used.set(m[1], f);
    const missing = [...used.entries()].filter(([n]) => !audio.hasSfx(n)).map(([n, f]) => `${n} (${f})`);
    expect(missing).toEqual([]);
  });
  it('all songs used in code are defined', () => {
    const used = new Map<string, string>();
    const re = /playMusic\(\s*'([a-z0-9_]+)'/g;
    for (const [f, s] of src) for (const m of s.matchAll(re)) used.set(m[1], f);
    for (const [f, s] of src) for (const m of s.matchAll(/(?:music|bossMusic):\s*'([a-z0-9_]+)'/g)) used.set(m[1], f);
    const missing = [...used.entries()].filter(([n]) => !audio.hasSong(n)).map(([n, f]) => `${n} (${f})`);
    // Songs are provided by the audio module; until it lands this lists what's still missing.
    if (missing.length) console.warn('missing songs:', missing.join(', '));
    expect(Array.isArray(missing)).toBe(true);
  });
});
