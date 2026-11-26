// M3 FROSTBITE PASS - "Whiteout Ascent". B minor, 152 bpm.
// Cold and driving: a thin pulse lead over shimmering bell arpeggios, a pumping eighth-note bass
// and frozen string pads. The epic minor loop i-VI-III-VII (Bm-G-D-A) turns to the major
// dominant (F#, with the leading tone A#) at phrase ends.
// Form: intro(4) | A(8) | B(8) | A'(8) | C(8) -> loop to A.

import { arpLine, bassLine, drums, padLine, prog, rest, SongBuilder } from './lib';

const INTRO = 'Bm G D A';
const A = 'Bm G D A Bm G Em F#';
const B = 'Em G D A Em G F# F#';
const A2 = 'Bm G D A Bm G F# Bm';
const C = 'G A Bm Bm G A F#sus4:8 F#:8 F#';

const HOOK = [
  'F#5:4 B5:4 A5:2 F#5:2 D5:4', // Bm
  'G5:4 B5:4 A5:2 G5:2 D5:4', // G    same contour over the new root
  'A5:4 D6:4 C#6:2 A5:2 F#5:4', // D
  'E5:4 A5:4 G5:2 E5:2 C#5:4', // A
  'B5:6 A5:2 F#5:4 B5:4', // Bm
  'D6:6 B5:2 G5:4 B5:4', // G
].join(' | ');
const LEAD_A = [HOOK, 'B5:6 A5:2 G5:4 E5:4', 'F#5:4 A#5:4 C#6:4 A#5:4'].join(' | '); // ... Em | F# (leading tone A#)
const LEAD_A2 = [HOOK, 'C#6:4 A#5:4 F#5:4 E5:4', 'D5:4 F#5:4 B5:8'].join(' | '); // ... F#(7) | Bm
const LEAD_B = [
  'G5:8 F#5:4 E5:4', // Em
  'D5:8 G5:4 B5:4', // G
  'A5:8 F#5:4 D5:4', // D
  'C#6:8 B5:4 A5:4', // A
  'B5:6 A5:2 G5:4 E5:4', // Em
  'D6:6 B5:2 G5:4 D5:4', // G
  'C#6:8 A#5:4 F#5:4', // F#
  'F#5:4 G#5:2 A#5:2 C#6:8', // F#  (melodic-minor run up)
].join(' | ');
const LEAD_C = [
  'B5:4 D6:4 B5:4 G5:4', // G
  'C#6:4 A5:4 E5:4 A5:4', // A
  'B5:12 A5:2 B5:2', // Bm
  'D6:8 C#6:4 B5:4', // Bm
  'B5:8 G5:4 D5:4', // G
  'C#6:8 E5:4 A5:4', // A
  'B5:8 A#5:8', // F#sus4 -> F#: the suspended B resolves to A#
  'F#5:8 .:8', // F#
].join(' | ');

const BEAT = 'k . h . s . h k k . h . s . h h';
const BEAT_CRASH = 'k+c . h . s . h k k . h . s . h h';
const BEAT16 = 'k h h h s h h k k h h h s h h h';
const FILL = 's s s s t t t t T T T T s! s! s! s!';
const BASS = 'R:2 R:2 R:2 8:2 R:2 R:2 R:2 8:2';
const ice = (p: string) => arpLine(prog(p), '0 2 1 3 2 4 3 2', { lo: 55 });
const pad = (p: string) => padLine(prog(p), { lo: 50 });

const S = new SongBuilder(
  'm3',
  { bpm: 152, title: 'WHITEOUT ASCENT', echoSteps: 3, echoFeedback: 0.32, reverb: 1.2 },
  {
    lead: { inst: 'pulse12', vol: 0.58, pan: 0.1, vibrato: 12, echo: 0.28, role: 'lead' },
    bells: { inst: 'bell', vol: 0.26, pan: -0.35, env: { d: 0.5 }, role: 'harmony' },
    pad: { inst: 'strings', vol: 0.24, pan: 0.3, role: 'harmony' },
    bass: { inst: 'bass', vol: 0.42, role: 'bass' },
    drums: { inst: 'drums', vol: 0.44, role: 'drums' },
  },
);

S.section(
  'intro',
  4,
  {
    bells: ice(INTRO),
    pad: pad(INTRO),
    bass: `${rest(32)} ${bassLine(prog('D A'), BASS, { lo: 38 })}`,
    drums: `${rest(32)} ${'. . h . . . h . . . h . . . h h'} | ${FILL}`,
  },
  INTRO,
)
  .loopHere()
  .section('A', 8, { lead: LEAD_A, bells: ice(A), pad: pad(A), bass: bassLine(prog(A), BASS, { lo: 38 }), drums: drums(8, BEAT, { first: BEAT_CRASH, last: FILL }) }, A)
  .section('B', 8, { lead: LEAD_B, bells: ice(B), pad: pad(B), bass: bassLine(prog(B), BASS, { lo: 38 }), drums: drums(8, BEAT16, { first: `k+c${BEAT16.slice(1)}`, last: FILL }) }, B)
  .section("A'", 8, { lead: LEAD_A2, bells: ice(A2), pad: pad(A2), bass: bassLine(prog(A2), BASS, { lo: 38 }), drums: drums(8, BEAT, { first: BEAT_CRASH, last: FILL }) }, A2)
  .section('C', 8, { lead: LEAD_C, bells: ice(C), pad: pad(C), bass: bassLine(prog(C), BASS, { lo: 38 }), drums: drums(8, BEAT16, { first: `k+c${BEAT16.slice(1)}`, last: FILL }) }, C)
  .define();
