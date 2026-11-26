// M1 PALM HARBOR - "Coastline Charge". G major, 138 bpm.
// Bright tropical military march: steel-drum lead, brass "pah" chords on 2 and 4 over an
// oom-pah bass with chromatic walk-ups, march snare with ghost notes, son clave and bongos.
// Form: intro(2) | A(8) | A'(8) | B(8) | C(8, calypso turnaround with C#dim7 and E7) -> loop to A.

import { arpLine, bassLine, padLine, prog, rest, SongBuilder } from './lib';

const INTRO = 'G D7';
const A = 'G C D7 G Em C Am7 D7';
const A2 = 'G C D7 G Em C D7 G';
const B = 'C D Bm7 Em Am7 D7 Gmaj7 G7';
const C = 'C C#dim7 G/D E7 Am7 D7 G D7';

const HOOK = [
  'D5:2 G5:2 B5:3 A5:1 G5:2 D5:2 E5:2 D5:2', // G     arpeggio up, neighbour-note tail
  'E5:2 G5:2 C6:3 B5:1 G5:4 E5:4', // C
  'F#5:2 A5:2 D6:3 C6:1 A5:2 F#5:2 A5:2 C6:2', // D7
  'B5:4 A5:2 G5:2 D5:8', // G
].join(' | ');
const LEAD_A = [
  HOOK,
  'E5:2 G5:2 B5:3 A5:1 G5:2 E5:2 G5:4', // Em
  'C6:3 B5:1 A5:2 G5:2 E5:4 C5:4', // C
  'A5:4 G5:2 E5:2 C5:4 E5:4', // Am7
  'D5:4 F#5:4 A5:4 C6:4', // D7  rising dominant arpeggio
].join(' | ');
const LEAD_A2 = [
  HOOK,
  'E5:2 G5:2 B5:3 A5:1 G5:2 E5:2 B4:4', // Em
  'C6:3 B5:1 A5:2 G5:2 E5:4 G5:4', // C
  'F#5:2 E5:2 D5:2 C5:2 A4:4 C5:2 F#5:2', // D7
  'G5:8 .:4 D5:2 D5:2', // G
].join(' | ');
const LEAD_B = [
  'E5:6 D5:2 C5:4 E5:4', // C
  'F#5:6 E5:2 D5:4 A5:4', // D
  'F#5:6 E5:2 D5:4 B4:4', // Bm7
  'E5:8 G5:4 B5:4', // Em
  'C6:6 B5:2 A5:4 E5:4', // Am7
  'D6:6 C6:2 A5:4 F#5:4', // D7
  'G5:4 F#5:4 D5:4 B4:4', // Gmaj7
  'D5:4 F5:4 G5:4 B5:4', // G7 (F = seventh, leads to E of C)
].join(' | ');
const LEAD_C = [
  'G5:2 E5:2 C5:2 E5:2 G5:4 E5:4', // C
  'G5:2 E5:2 C#5:2 E5:2 Bb5:4 G5:4', // C#dim7 (all chord tones)
  'B5:2 G5:2 D5:2 G5:2 B5:4 D6:4', // G/D
  'D6:4 B5:2 G#5:2 E5:4 G#5:4', // E7
  'C6:4 A5:2 E5:2 G5:4 A5:4', // Am7
  'F#5:4 A5:2 C6:2 D6:4 C6:4', // D7
  'B5:8 G5:8', // G
  'A5:4 F#5:4 D5:4 C5:4', // D7 -> back to the hook on D5
].join(' | ');

// Two-bar march groove: kick 1 & 3, accented snare 2 & 4 with ghosts, 3-2 son clave (x), bongos (b).
const M1 = 'k+x . s? . s! . x s? k . s? b s!+x . s? b';
const M2 = 'k . s? . s!+x . s? s? k+x . s? b s! . b b';
const M1C = 'k+x+c . s? . s! . x s? k . s? b s!+x . s? b';
const FILL = 's . s s s . s s t t t . T T T .';
const march = (crash = true) => [crash ? M1C : M1, M2, M1, M2, M1, M2, M1, FILL].join(' | ');

const BASS = 'R:3 .:1 5:3 .:1 R:3 .:1 5:2 A:2';
const pah = (p: string) => padLine(prog(p), { lo: 55, rhythm: '.:4 X:3 .:1' });
const sparkle = (p: string) => arpLine(prog(p), '0 1 2 3', { lo: 60 });

const S = new SongBuilder(
  'm1',
  { bpm: 138, title: 'COASTLINE CHARGE', echoSteps: 3, echoFeedback: 0.22 },
  {
    lead: { inst: 'steel', vol: 0.62, pan: 0.12, echo: 0.15, role: 'lead' },
    brass: { inst: 'brass', vol: 0.48, pan: -0.25, env: { r: 0.05 }, role: 'harmony' },
    arp: { inst: 'pulse12', vol: 0.34, pan: 0.4, env: { d: 0.05, s: 0.3 }, role: 'harmony' },
    bass: { inst: 'bass', vol: 0.42, role: 'bass' },
    drums: { inst: 'drums', vol: 0.44, role: 'drums' },
  },
);

S.section(
  'intro',
  2,
  {
    lead: `${rest(24)} A4:2 B4:2 C5:2 C#5:2`, // chromatic run-up into the hook
    brass: `G3+B3+D4:3 G3+B3+D4:3 G3+B3+D4:2 .:8 | ${padLine(prog('D7'), { lo: 55, rhythm: 'X:2 .:2' })}`,
    bass: bassLine(prog(INTRO), BASS),
    drums: `k+c . . . s! . . . k . s? s? s! . s? s? | ${FILL}`,
  },
  INTRO,
)
  .loopHere()
  .section('A', 8, { lead: LEAD_A, brass: pah(A), bass: bassLine(prog(A), BASS), drums: march() }, A)
  .section("A'", 8, { lead: LEAD_A2, brass: pah(A2), arp: sparkle(A2), bass: bassLine(prog(A2), BASS), drums: march() }, A2)
  .section('B', 8, { lead: LEAD_B, brass: pah(B), arp: sparkle(B), bass: bassLine(prog(B), BASS), drums: march() }, B)
  .section('C', 8, { lead: LEAD_C, brass: pah(C), arp: sparkle(C), bass: bassLine(prog(C), BASS), drums: march() }, C)
  .define();
