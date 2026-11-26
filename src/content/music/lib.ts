// Composition toolkit for the chiptune sequencer.
//
// Songs are written as sections over explicit chord progressions. Melodies are hand-written
// token strings; accompaniment (bass lines, arpeggios, pads, power chords) is generated from
// the chord symbols so it is always harmonically correct and voice-led. SongBuilder checks
// that every channel of every section has exactly the section's length, so all channels stay
// in sync, and records the chord timeline (used by tests to check melodies against harmony).

import { audio, noteToMidi, parseChannel, type Song, type SongChannel } from '../../engine/audio';

// ------------------------------------------------------------------ pitches

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PC: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

/** MIDI number -> note token ('C#4'). */
export function nn(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  return SHARPS[pc] + (Math.floor(midi / 12) - 1);
}

/** Note token -> MIDI number (throws on bad input). */
export function mi(tok: string): number {
  const m = noteToMidi(tok);
  if (m === null) throw new Error(`bad note "${tok}"`);
  return m;
}

/** Smallest MIDI >= lo with the given pitch class. */
export function atOrAbove(pc: number, lo: number): number {
  return lo + ((((pc - lo) % 12) + 12) % 12);
}

// ------------------------------------------------------------------ chords

const QUALITY: [string, number[]][] = [
  ['m7b5', [0, 3, 6, 10]],
  ['mmaj7', [0, 3, 7, 11]],
  ['maj7', [0, 4, 7, 11]],
  ['madd9', [0, 2, 3, 7]],
  ['7sus4', [0, 5, 7, 10]],
  ['dim7', [0, 3, 6, 9]],
  ['add9', [0, 2, 4, 7]],
  ['sus4', [0, 5, 7]],
  ['sus2', [0, 2, 7]],
  ['7b9', [0, 1, 4, 7, 10]],
  ['dim', [0, 3, 6]],
  ['aug', [0, 4, 8]],
  ['m7', [0, 3, 7, 10]],
  ['m9', [0, 2, 3, 7, 10]],
  ['m6', [0, 3, 7, 9]],
  ['m', [0, 3, 7]],
  ['9', [0, 2, 4, 7, 10]],
  ['7', [0, 4, 7, 10]],
  ['6', [0, 4, 7, 9]],
  ['5', [0, 7]],
  ['', [0, 4, 7]],
];

export interface Chord {
  sym: string;
  /** Pitch class of the root. */
  root: number;
  /** Pitch class of the bass note (slash chords), else the root. */
  bass: number;
  /** Chord tones as semitones above the root (0..11). */
  tones: number[];
}

export interface ChordSpan extends Chord {
  /** Length in steps. */
  len: number;
}

export function chord(sym: string): Chord {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym);
  if (!m) throw new Error(`bad chord "${sym}"`);
  const root = PC[m[1]];
  const q = QUALITY.find(([k]) => k === m[2]);
  if (root === undefined || !q) throw new Error(`bad chord "${sym}"`);
  const bass = m[3] !== undefined ? PC[m[3]] : root;
  if (bass === undefined) throw new Error(`bad chord bass "${sym}"`);
  return { sym, root, bass, tones: q[1].slice() };
}

/** Parse a progression: 'C Am F:8 G:8' (default 16 steps per chord; '|' ignored). */
export function prog(src: string, defLen = 16): ChordSpan[] {
  return src
    .split(/\s+/)
    .filter((t) => t && t !== '|')
    .map((t) => {
      const [sym, len] = t.split(':');
      return { ...chord(sym), len: len ? parseInt(len, 10) : defLen };
    });
}

/** Absolute pitch classes of a chord. */
export function chordPcs(c: Chord): number[] {
  return c.tones.map((t) => (c.root + t) % 12);
}

const spanLen = (p: ChordSpan[]) => p.reduce((a, c) => a + c.len, 0);

// ------------------------------------------------------------------ patterns

interface PatTok {
  sym: string;
  len: number;
}

function patTokens(pattern: string): PatTok[] {
  return pattern
    .split(/\s+/)
    .filter((t) => t && t !== '|')
    .map((t) => {
      const [sym, len] = t.split(':');
      return { sym, len: len ? parseInt(len, 10) : 1 };
    });
}

/** Cycle a pattern over `len` steps (truncating the last token). */
function fill(pattern: string, len: number): PatTok[] {
  const toks = patTokens(pattern);
  if (!toks.length) throw new Error('empty pattern');
  const out: PatTok[] = [];
  let n = 0;
  for (let i = 0; n < len; i++) {
    const t = toks[i % toks.length];
    const l = Math.min(t.len, len - n);
    out.push({ sym: t.sym, len: l });
    n += l;
  }
  return out;
}

function emit(note: string | null, len: number, tie: boolean): string {
  if (tie) return `-:${len}`;
  if (note === null) return `.:${len}`;
  return `${note}:${len}`;
}

/** Close-position voicing of a chord, voice-led towards `center` (average pitch). */
function voicing(c: Chord, lo: number, voices: number, center: number): number[] {
  const pcs = chordPcs(c);
  let best: number[] = [];
  let bestCost = Infinity;
  for (let inv = 0; inv < pcs.length; inv++) {
    for (let base = lo; base < lo + 12; base++) {
      if (base % 12 !== pcs[inv]) continue;
      const v: number[] = [base];
      let k = inv;
      while (v.length < voices) {
        k++;
        const pc = pcs[k % pcs.length];
        v.push(atOrAbove(pc, v[v.length - 1] + 1));
      }
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      const cost = Math.abs(mean - center) + (v[v.length - 1] - v[0]) * 0.05;
      if (cost < bestCost) {
        bestCost = cost;
        best = v;
      }
    }
  }
  return best;
}

/**
 * Bass line from a progression. Pattern tokens (with optional ':len'):
 *   R bass note (slash bass or root)   8 octave above R   r octave below R
 *   3 / 5 / 7 chord third / fifth / seventh above R      9 / 4 / 6 scale 2nd / 4th / 6th of the root
 *   m minor second above R (phrygian riffs)   A chromatic approach (half step below the next chord's bass)
 *   U whole step below the next chord's bass   . rest   - tie
 * The pattern restarts on every chord. Pass an array to use a different pattern per chord.
 */
export function bassLine(p: ChordSpan[], pattern: string | string[] | ((c: ChordSpan, i: number) => string), o: { lo?: number } = {}): string {
  const lo = o.lo ?? 36;
  const out: string[] = [];
  p.forEach((c, i) => {
    const pat = typeof pattern === 'function' ? pattern(c, i) : Array.isArray(pattern) ? pattern[i % pattern.length] : pattern;
    const r = atOrAbove(c.bass, lo);
    const next = p[(i + 1) % p.length];
    const nextBass = atOrAbove(next.bass, lo);
    const pcs = chordPcs(c);
    const third = pcs.find((x) => [3, 4].includes((x - c.root + 12) % 12)) ?? pcs.find((x) => [2, 5].includes((x - c.root + 12) % 12)) ?? c.root;
    const fifth = pcs.find((x) => [6, 7, 8].includes((x - c.root + 12) % 12)) ?? (c.root + 7) % 12;
    const seventh = pcs.find((x) => [9, 10, 11].includes((x - c.root + 12) % 12));
    for (const t of fill(pat, c.len)) {
      let m: number | null = null;
      let tie = false;
      switch (t.sym) {
        case 'R':
        case 'b':
          m = r;
          break;
        case '8':
          m = r + 12;
          break;
        case 'r':
          m = r - 12;
          break;
        case '3':
          m = atOrAbove(third, r);
          break;
        case '5':
          m = atOrAbove(fifth, r);
          break;
        case '7':
          m = seventh !== undefined ? atOrAbove(seventh, r) : r + 12;
          break;
        case '9':
          m = atOrAbove((c.root + 2) % 12, r);
          break;
        case '4':
          m = atOrAbove((c.root + 5) % 12, r);
          break;
        case '6':
          m = atOrAbove((c.root + 9) % 12, r);
          break;
        case 'm':
          m = r + 1;
          break;
        case 'A':
          m = nextBass - 1;
          break;
        case 'U':
          m = nextBass - 2;
          break;
        case '.':
          m = null;
          break;
        case '-':
          tie = true;
          break;
        default:
          throw new Error(`bad bass token "${t.sym}"`);
      }
      out.push(emit(m === null ? null : nn(m), t.len, tie));
    }
  });
  return out.join(' ');
}

/**
 * Arpeggio over voice-led chord voicings. Pattern digits index the voicing (0 = lowest; indices
 * past the top wrap an octave up); '.' rest, '-' tie. The pattern restarts on every chord.
 */
export function arpLine(p: ChordSpan[], pattern: string, o: { lo: number; voices?: number }): string {
  const out: string[] = [];
  let center = o.lo + 7;
  for (const c of p) {
    const n = o.voices ?? Math.min(4, c.tones.length);
    const v = voicing(c, o.lo, n, center);
    center = v.reduce((a, b) => a + b, 0) / v.length;
    for (const t of fill(pattern, c.len)) {
      if (t.sym === '.') out.push(`.:${t.len}`);
      else if (t.sym === '-') out.push(`-:${t.len}`);
      else {
        const d = parseInt(t.sym, 10);
        if (Number.isNaN(d)) throw new Error(`bad arp token "${t.sym}"`);
        out.push(`${nn(v[d % v.length] + 12 * Math.floor(d / v.length))}:${t.len}`);
      }
    }
  }
  return out.join(' ');
}

/** Block chords, voice-led. Rhythm tokens: X chord, . rest, - tie (restarts on every chord). */
export function padLine(p: ChordSpan[], o: { lo: number; voices?: number; rhythm?: string }): string {
  const out: string[] = [];
  let center = o.lo + 7;
  for (const c of p) {
    const n = o.voices ?? Math.min(4, c.tones.length);
    const v = voicing(c, o.lo, n, center);
    center = v.reduce((a, b) => a + b, 0) / v.length;
    const chordTok = v.map(nn).join('+');
    for (const t of fill(o.rhythm ?? `X:${c.len}`, c.len)) {
      if (t.sym === 'X') out.push(`${chordTok}:${t.len}`);
      else if (t.sym === '.') out.push(`.:${t.len}`);
      else if (t.sym === '-') out.push(`-:${t.len}`);
      else throw new Error(`bad pad token "${t.sym}"`);
    }
  }
  return out.join(' ');
}

/**
 * Power-chord riffs (for the overdriven guitar). Tokens: P root power chord (root+5th+octave),
 * Q power chord a half step above the root, F power chord on the fifth, O octave, R single root,
 * . rest, - tie.
 */
export function powerLine(p: ChordSpan[], pattern: string, o: { lo: number }): string {
  const out: string[] = [];
  for (const c of p) {
    const r = atOrAbove(c.root, o.lo);
    const pw = (x: number) => [x, x + 7, x + 12].map(nn).join('+');
    for (const t of fill(pattern, c.len)) {
      let s: string;
      switch (t.sym) {
        case 'P':
          s = pw(r);
          break;
        case 'Q':
          s = pw(r + 1);
          break;
        case 'F':
          s = pw(r + 7);
          break;
        case 'O':
          s = `${nn(r)}+${nn(r + 12)}`;
          break;
        case 'R':
          s = nn(r);
          break;
        case '.':
          out.push(`.:${t.len}`);
          continue;
        case '-':
          out.push(`-:${t.len}`);
          continue;
        default:
          throw new Error(`bad power token "${t.sym}"`);
      }
      out.push(`${s}:${t.len}`);
    }
  }
  return out.join(' ');
}

/** Transpose every note token in a string by `semis` semitones. */
export function transpose(notes: string, semis: number): string {
  return notes.replace(/(^|[\s(+])([A-G][#b]?-?\d)(?=[:\s)+!?]|$)/g, (_m, pre: string, tok: string) => pre + nn(mi(tok) + semis));
}

/** Repeat a token string n times. */
export const rep = (s: string, n: number): string => `(${s})*${n}`;

/** A rest of n steps. */
export const rest = (n: number): string => `.:${n}`;

/**
 * Drum part for a section: `bars` bars of the one-bar `main` pattern, optionally replacing the
 * first bar (e.g. with a crash) and the last bar (e.g. a fill).
 */
export function drums(bars: number, main: string, o: { first?: string; last?: string } = {}): string {
  const out: string[] = [];
  for (let i = 0; i < bars; i++) out.push(i === 0 && o.first ? o.first : i === bars - 1 && bars > 1 && o.last ? o.last : main);
  return out.join(' | ');
}

// ------------------------------------------------------------------ song builder

export type ChannelDef = Omit<SongChannel, 'notes'>;

export interface SongOpts {
  bpm: number;
  title: string;
  /** Steps per beat (default 4). */
  stepsPerBeat?: number;
  /** Beats per bar (default 4). */
  beatsPerBar?: number;
  loop?: boolean;
  swing?: number;
  reverb?: number;
  echo?: number;
  echoSteps?: number;
  echoFeedback?: number;
  gain?: number;
}

export interface ChordEvent {
  step: number;
  len: number;
  sym: string;
  pcs: number[];
  root: number;
}

/** Chord timelines of every song built with SongBuilder (for analysis tests). */
export const SONG_CHORDS: Record<string, ChordEvent[]> = {};

export class SongBuilder {
  readonly barSteps: number;
  private parts: Record<string, string[]> = {};
  private steps = 0;
  private loopStart: number | null = null;
  private chords: ChordEvent[] = [];
  private sections: { label: string; start: number; bars: number }[] = [];

  constructor(
    readonly name: string,
    readonly opts: SongOpts,
    readonly channels: Record<string, ChannelDef>,
  ) {
    this.barSteps = (opts.stepsPerBeat ?? 4) * (opts.beatsPerBar ?? 4);
    for (const k of Object.keys(channels)) this.parts[k] = [];
  }

  /** Steps in n bars. */
  bars(n: number): number {
    return n * this.barSteps;
  }

  /**
   * Add a section of `bars` bars. Every channel part must be exactly that long (missing channels
   * rest). `chords` (a progression string or spans) documents the harmony and must also fit.
   */
  section(label: string, bars: number, parts: Record<string, string>, chords?: string | ChordSpan[]): this {
    const len = bars * this.barSteps;
    for (const k of Object.keys(parts)) if (!(k in this.channels)) throw new Error(`${this.name}/${label}: unknown channel "${k}"`);
    // Validate everything first, then commit (a failed call leaves the builder untouched).
    const add: [string, string][] = [];
    for (const [k, ch] of Object.entries(this.channels)) {
      const src = parts[k];
      if (src === undefined) {
        add.push([k, rest(len)]);
        continue;
      }
      const got = parseChannel({ ...ch, notes: src }).length;
      if (got !== len) throw new Error(`${this.name}/${label}/${k}: ${got} steps, expected ${len}`);
      add.push([k, src]);
    }
    const p = chords === undefined ? undefined : typeof chords === 'string' ? prog(chords) : chords;
    if (p && spanLen(p) !== len) throw new Error(`${this.name}/${label}: chords cover ${spanLen(p)} steps, expected ${len}`);
    for (const [k, src] of add) this.parts[k].push(src);
    if (p) {
      let s = this.steps;
      for (const c of p) {
        const pcs = chordPcs(c);
        if (!pcs.includes(c.bass)) pcs.push(c.bass);
        this.chords.push({ step: s, len: c.len, sym: c.sym, pcs, root: c.root });
        s += c.len;
      }
    }
    this.sections.push({ label, start: this.steps, bars });
    this.steps += len;
    return this;
  }

  /** The loop restarts here (everything before plays once as an intro). */
  loopHere(): this {
    this.loopStart = this.steps;
    return this;
  }

  build(): Song {
    const o = this.opts;
    const song: Song = {
      title: o.title,
      bpm: o.bpm,
      steps: o.stepsPerBeat ?? 4,
      loop: o.loop ?? true,
      channels: Object.entries(this.channels).map(([k, ch]) => ({ ...ch, notes: this.parts[k].join(' | ') })),
    };
    if (this.loopStart) song.loopStart = this.loopStart;
    if (o.swing) song.swing = o.swing;
    if (o.reverb !== undefined) song.reverb = o.reverb;
    if (o.echo !== undefined) song.echo = o.echo;
    if (o.echoSteps !== undefined) song.echoSteps = o.echoSteps;
    if (o.echoFeedback !== undefined) song.echoFeedback = o.echoFeedback;
    if (o.gain !== undefined) song.gain = o.gain;
    return song;
  }

  /** Build, register with the audio engine and record the chord timeline. */
  define(): Song {
    const song = this.build();
    audio.defineSong(this.name, song);
    SONG_CHORDS[this.name] = this.chords;
    return song;
  }
}
