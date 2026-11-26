// M2 DUSTWIND CANYON - "Rattlesnake Ridge". E Phrygian (dominant), 116 bpm.
// Galloping western: a twangy plucked lead built on the half-step E-F (phrygian b2), strummed
// gallop chords, castanet clicks and toms. The B section is a lonely whistle over the Andalusian
// cadence Am-G-F-E. Form: intro(2) | A(8) | B(8) | A(8) | C(8) -> loop to A.

import { bassLine, padLine, prog, rest, SongBuilder } from './lib';

const INTRO = 'E E';
const A = 'E F E F G F E E';
const B = 'Am G F E Am G F E';
const C = 'Dm Am Dm E F G F E';

const LEAD_A = [
  'E5:3 F5:1 G#5:2 F5:2 E5:8', // E    the b2 (F) as a neighbour
  'F5:3 G5:1 A5:2 G5:2 F5:8', // F     same figure a half step up
  'B5:3 A5:1 G#5:2 F5:2 E5:4 B4:4', // E
  'C6:3 B5:1 A5:2 G5:2 F5:4 C5:4', // F
  'B5:3 C6:1 D6:4 B5:4 G5:4', // G
  'C6:3 A5:1 F5:4 A5:4 C6:4', // F
  'B5:4 A5:2 G#5:2 F5:4 E5:4', // E    F on beat 3 = phrygian b9, resolves to E
  'E5:16', // E                        long twang with vibrato
].join(' | ');
const WHISTLE_B = [
  'A5:8 E5:4 C5:4', // Am
  'B5:8 G5:4 D5:4', // G
  'C6:8 A5:4 F5:4', // F
  'B5:8 G#5:4 E5:4', // E
  'A5:4 B5:2 C6:2 A5:8', // Am
  'G5:4 A5:2 B5:2 D6:8', // G
  'C6:4 B5:2 A5:2 F5:8', // F
  'G#5:4 F5:4 E5:8', // E
].join(' | ');
const LEAD_C = [
  'D5:4 F5:4 A5:6 G5:2', // Dm
  'E5:8 C5:4 A4:4', // Am
  'F5:4 A5:4 D6:6 C6:2', // Dm
  'B5:8 G#5:4 E5:4', // E
  'A5:4 C6:4 A5:4 F5:4', // F
  'B5:4 D6:4 B5:4 G5:4', // G
  'A5:4 G5:2 F5:2 E5:4 F5:4', // F
  'G#5:6 F5:2 E5:8', // E
].join(' | ');

const GALLOP = 'k . x x T . x x k . x x s . x x';
const GALLOP_O = 'k . x x s . x x k . x x s . o .';
const FILL = 'T . T T t . t t T . t . s s s s';
const sec = (main: string) => [`k+c${main.slice(1)}`, main, main, main, main, main, main, FILL].join(' | ');
const BASS = 'R:2 R:1 R:1 R:2 R:1 R:1 5:2 5:1 5:1 R:2 8:1 8:1';
const strum = (p: string) => padLine(prog(p), { lo: 52, voices: 3, rhythm: 'X:2 X:1 X:1' });

const S = new SongBuilder(
  'm2',
  { bpm: 116, title: 'RATTLESNAKE RIDGE', echoSteps: 4, echoFeedback: 0.38, reverb: 1.2 },
  {
    lead: { inst: 'pluck', vol: 0.75, pan: -0.1, vibrato: 22, vibratoDelay: 0.15, echo: 0.28, role: 'lead' },
    whistle: { inst: 'sine', vol: 0.62, pan: 0.15, vibrato: 30, vibratoDelay: 0.12, glide: 0.04, echo: 0.35, reverb: 0.4, role: 'lead' },
    guitar: { inst: 'pluck', vol: 0.3, pan: -0.35, role: 'harmony' },
    strings: { inst: 'strings', vol: 0.2, pan: 0.35, role: 'harmony' },
    bass: { inst: 'bass', vol: 0.42, role: 'bass' },
    drums: { inst: 'drums', vol: 0.42, role: 'drums' },
  },
);

S.section('intro', 2, { guitar: `${rest(16)} ${strum('E')}`, bass: bassLine(prog(INTRO), BASS), drums: `k . x x . . x x k . x x . . x x | ${FILL}` }, INTRO)
  .loopHere()
  .section('A', 8, { lead: LEAD_A, guitar: strum(A), bass: bassLine(prog(A), BASS), drums: sec(GALLOP) }, A)
  .section('B', 8, { whistle: WHISTLE_B, guitar: strum(B), strings: padLine(prog(B), { lo: 52 }), bass: bassLine(prog(B), BASS), drums: sec(GALLOP_O) }, B)
  .section("A'", 8, { lead: LEAD_A, guitar: strum(A), bass: bassLine(prog(A), BASS), drums: sec(GALLOP) }, A)
  .section('C', 8, { lead: LEAD_C, guitar: strum(C), strings: padLine(prog(C), { lo: 52 }), bass: bassLine(prog(C), BASS), drums: sec(GALLOP_O) }, C)
  .define();
