// TITLE - "Iron Ruckus" (main theme). D major, 152 bpm.
// Heroic hook built from one motif (long-short-short rising to the third) stated four times in
// sequence, a bridge in the relative minor, and the bVI-bVII-I "victory" cadence (Bb-C-D).
// Form: intro(4) | A(8) | A'(8) | B(8) | C(4) -> loop to A. The ending theme reprises this in E.

import { arpLine, bassLine, drums, padLine, prog, rest, SongBuilder, transpose } from './lib';

// ---- harmony
const INTRO = 'Bb C D A';
const A = 'D A/C# Bm G D/F# G Asus4:8 A:8 A';
const A2 = 'D A/C# Bm G Em7 A7 D D';
const B = 'Bm G D A Bm G Em A7';
const C = 'Bb C D A';

// ---- melody (one bar per line; chord in the comment)
export const TITLE_HOOK = [
  'D5:3 A4:1 D5:2 E5:2 F#5:8', // D      root, low fifth, root, passing 2nd, long third
  'E5:3 C#5:1 E5:2 F#5:2 E5:8', // A/C#  same rhythm a step up, resolves on the fifth of A
  'D5:3 B4:1 D5:2 E5:2 F#5:4 B5:4', // Bm  climbs to the root
  'A5:4 G5:2 F#5:2 G5:8', // G       9th appoggiatura resolving to the root
].join(' | ');
export const LEAD_A = [
  TITLE_HOOK,
  'F#5:3 D5:1 F#5:2 G5:2 A5:8', // D/F#  motif from the third, up to the fifth
  'B5:4 A5:2 G5:2 D5:4 G5:4', // G
  'E5:4 D5:4 C#5:4 E5:4', // Asus4 -> A: the sus4 (D) resolves to C#
  'A4:8 .:4 A4:2 C#5:2', // A        half cadence + pickup
].join(' | ');
export const LEAD_A2 = [
  TITLE_HOOK,
  'G5:3 E5:1 G5:2 A5:2 B5:8', // Em7
  'A5:4 G5:2 E5:2 C#5:4 E5:4', // A7 (G = the seventh)
  'F#5:2 E5:2 D5:12', // D      authentic cadence
  '.:8 D5:2 E5:2 F#5:2 A5:2', // D  run-up into the bridge
].join(' | ');
export const LEAD_B = [
  'B5:6 A5:2 F#5:4 D5:4', // Bm
  'G5:6 F#5:2 G5:4 B5:4', // G
  'A5:6 G5:2 F#5:4 D5:4', // D
  'E5:6 F#5:2 E5:4 C#5:4', // A
  'B5:6 C#6:2 D6:4 B5:4', // Bm  peak of the bridge
  'B5:6 A5:2 G5:4 B5:4', // G
  'G5:6 F#5:2 E5:4 G5:4', // Em
  'A5:4 G5:4 E5:4 C#5:4', // A7  descending dominant arpeggio -> deceptive move to Bb
].join(' | ');
export const LEAD_C = [
  'D5:4 F5:4 Bb5:8', // Bb
  'E5:4 G5:4 C6:8', // C
  'A5:4 D6:12', // D   climax
  'C#6:4 A5:4 E5:4 A4:2 C#5:2', // A  pickup back into the hook
].join(' | ');

const BASS_DRIVE = 'R:2 R:2 8:2 R:2 R:2 R:2 8:2 5:2';
const BASS_TRESILLO = 'R:6 R:6 R:4';
const ROCK = 'k+h . h . s+h . h . k+h . k+h . s+h . h .';
const ROCK_CRASH = 'k+c . h . s+h . h . k+h . k+h . s+h . h .';
const FILL = 's . s . s s . s t . t . T . T T';
const TRES = 'k+c . . . h . k+s . . . h . k+s . h h';
const ROLL = 's? s? s? s? s s s s s s s s s! s! s! s!';
const DRIVE = 'k+h . h . s+h . h k k+h . h . s+h . h .';

const S = new SongBuilder(
  'title',
  { bpm: 152, title: 'IRON RUCKUS', echoSteps: 3, echoFeedback: 0.28 },
  {
    lead: { inst: 'pulse25', vol: 0.5, vibrato: 16, vibratoDelay: 0.14, echo: 0.2, role: 'lead' },
    brass: { inst: 'brass', vol: 0.45, pan: -0.25, role: 'counter' },
    arp: { inst: 'pulse12', vol: 0.42, pan: 0.35, echo: 0.12, env: { d: 0.06, s: 0.35 }, role: 'harmony' },
    bass: { inst: 'bass', vol: 0.42, role: 'bass' },
    drums: { inst: 'drums', vol: 0.44, role: 'drums' },
  },
);

const arp = (p: string) => arpLine(prog(p), '0 1 2 3 4 3 2 1', { lo: 57 });

S.section(
  'intro',
  4,
  {
    lead: `${rest(48)} .:12 A4:2 C#5:2`,
    brass: `${padLine(prog('Bb C D'), { lo: 55, rhythm: 'X:6 X:6 X:4' })} ${padLine(prog('A'), { lo: 55, rhythm: 'X:4' })}`,
    arp: `${rest(32)} ${arp('D A')}`,
    bass: `${bassLine(prog('Bb C D'), BASS_TRESILLO, { lo: 33 })} ${bassLine(prog('A'), 'R:4 R:4 5:4 8:4', { lo: 33 })}`,
    drums: `${drums(3, TRES)} | ${ROLL}`,
  },
  INTRO,
)
  .loopHere()
  .section(
    'A',
    8,
    {
      lead: LEAD_A,
      brass: padLine(prog(A), { lo: 55, rhythm: 'X:16' }),
      arp: arp(A),
      bass: bassLine(prog(A), BASS_DRIVE, { lo: 33 }),
      drums: drums(8, ROCK, { first: ROCK_CRASH, last: FILL }),
    },
    A,
  )
  .section(
    "A'",
    8,
    {
      lead: LEAD_A2,
      brass: padLine(prog(A2), { lo: 55, rhythm: '.:2 X:2' }),
      arp: arp(A2),
      bass: bassLine(prog(A2), BASS_DRIVE, { lo: 33 }),
      drums: drums(8, ROCK, { first: ROCK_CRASH, last: FILL }),
    },
    A2,
  )
  .section(
    'B',
    8,
    {
      lead: LEAD_B,
      brass: padLine(prog(B), { lo: 55, rhythm: 'X:6 X:6 X:4' }),
      arp: arp(B),
      bass: bassLine(prog(B), BASS_DRIVE, { lo: 33 }),
      drums: drums(8, DRIVE, { first: 'k+c . h . s+h . h k k+h . h . s+h . h .', last: ROLL }),
    },
    B,
  )
  .section(
    'C',
    4,
    {
      lead: LEAD_C,
      brass: transpose(LEAD_C, -12),
      arp: arp(C),
      bass: `${bassLine(prog('Bb C D'), BASS_TRESILLO, { lo: 33 })} ${bassLine(prog('A'), 'R:4 R:4 5:4 8:4', { lo: 33 })}`,
      drums: `${drums(3, TRES)} | ${ROLL}`,
    },
    C,
  )
  .define();
