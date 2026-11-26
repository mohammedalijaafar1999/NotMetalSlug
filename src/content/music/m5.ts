// M5 STORMFRONT - "Above the Thunder". A major, 172 bpm.
// Soaring and fast: a gliding supersaw lead with long notes, racing pulse arpeggios, octave-
// pumping bass. The A section lifts with the Lydian II chord (B major, D# = raised fourth); the
// C section climbs through borrowed bVI-bVII (F-G) back to the tonic.
// Form: intro(4) | A(8) | B(8) | A'(8) | C(8) -> loop to A.

import { arpLine, bassLine, drums, padLine, prog, rest, SongBuilder } from './lib';

const INTRO = 'F#m D A E';
const A = 'A B D A F#m B D E';
const B = 'F#m D A E F#m D Bm7 E';
const A2 = 'A B D A F#m B E A';
const C = 'D E C#m F#m Bm E F G';

const SOAR = [
  'E5:6 A5:2 C#6:8', // A
  'F#5:6 B5:2 D#6:8', // B   Lydian lift (D#)
  'D6:6 C#6:2 A5:8', // D
  'C#6:4 B5:4 A5:8', // A
  'F#5:6 A5:2 C#6:8', // F#m
  'D#6:6 C#6:2 B5:8', // B
].join(' | ');
const LEAD_A = `${SOAR} | A5:6 B5:2 D6:8 | B5:4 C#6:4 B5:4 G#5:4`; // D | E
const LEAD_A2 = `${SOAR} | B5:6 G#5:2 E5:8 | A5:16`; // E | A
const LEAD_B = [
  'F#5:2 A5:2 C#6:2 A5:2 F#5:2 A5:2 C#6:4', // F#m  racing broken chords
  'F#5:2 A5:2 D6:2 A5:2 F#5:2 A5:2 D6:4', // D
  'E5:2 A5:2 C#6:2 A5:2 E5:2 A5:2 C#6:4', // A
  'E5:2 G#5:2 B5:2 G#5:2 E5:2 G#5:2 B5:4', // E
  'C#6:6 B5:2 A5:4 F#5:4', // F#m
  'D6:6 C#6:2 A5:4 F#5:4', // D
  'D6:4 B5:4 A5:4 F#5:4', // Bm7
  'G#5:4 B5:4 E6:8', // E   peak
].join(' | ');
const LEAD_C = [
  'F#5:4 A5:4 D6:8', // D
  'G#5:4 B5:4 E6:8', // E
  'G#5:6 E5:2 C#6:8', // C#m
  'C#6:6 B5:2 A5:8', // F#m
  'B5:6 A5:2 F#5:4 D5:4', // Bm
  'E5:4 G#5:4 B5:4 D6:4', // E (D = seventh)
  'C6:6 A5:2 F5:8', // F   (bVI)
  'D6:6 B5:2 G5:8', // G   (bVII) -> A
].join(' | ');

const RUN = 'k . h . s . h k k . h . s . h h';
const RUN_CRASH = 'k+c . h . s . h k k . h . s . h h';
const DOUBLE = 'k+h . k+h . s+h . k+h k k+h . k+h . s+h . k+h k';
const FILL = 's s s s t t t t T T T T s! s! s! s!';
const BASS = 'R:2 8:2 R:2 8:2 R:2 8:2 R:2 8:2';
const race = (p: string) => arpLine(prog(p), '0 1 2 3', { lo: 57 });

const S = new SongBuilder(
  'm5',
  { bpm: 172, title: 'ABOVE THE THUNDER', echoSteps: 3, echoFeedback: 0.3 },
  {
    lead: { inst: 'supersaw', vol: 0.46, glide: 0.035, vibrato: 18, vibratoDelay: 0.2, echo: 0.22, reverb: 0.35, role: 'lead' },
    arp: { inst: 'pulse25', vol: 0.34, pan: -0.35, env: { d: 0.05, s: 0.4 }, echo: 0.12, role: 'harmony' },
    pad: { inst: 'strings', vol: 0.22, pan: 0.35, role: 'harmony' },
    bass: { inst: 'bass', vol: 0.42, role: 'bass' },
    drums: { inst: 'drums', vol: 0.44, role: 'drums' },
  },
);

S.section(
  'intro',
  4,
  {
    lead: `${rest(32)} E5:16 B5:16`,
    arp: race(INTRO),
    pad: padLine(prog(INTRO), { lo: 52 }),
    bass: `${rest(32)} ${bassLine(prog('A E'), BASS, { lo: 33 })}`,
    drums: `${rest(16)} . . h . . . h . . . h . . . h h | ${RUN} | ${FILL}`,
  },
  INTRO,
)
  .loopHere()
  .section('A', 8, { lead: LEAD_A, arp: race(A), pad: padLine(prog(A), { lo: 52 }), bass: bassLine(prog(A), BASS, { lo: 33 }), drums: drums(8, RUN, { first: RUN_CRASH, last: FILL }) }, A)
  .section('B', 8, { lead: LEAD_B, arp: race(B), pad: padLine(prog(B), { lo: 52 }), bass: bassLine(prog(B), BASS, { lo: 33 }), drums: drums(8, DOUBLE, { first: `k+c${DOUBLE.slice(1)}`, last: FILL }) }, B)
  .section("A'", 8, { lead: LEAD_A2, arp: race(A2), pad: padLine(prog(A2), { lo: 52 }), bass: bassLine(prog(A2), BASS, { lo: 33 }), drums: drums(8, RUN, { first: RUN_CRASH, last: FILL }) }, A2)
  .section('C', 8, { lead: LEAD_C, arp: race(C), pad: padLine(prog(C), { lo: 52 }), bass: bassLine(prog(C), BASS, { lo: 33 }), drums: drums(8, DOUBLE, { first: `k+c${DOUBLE.slice(1)}`, last: FILL }) }, C)
  .define();
