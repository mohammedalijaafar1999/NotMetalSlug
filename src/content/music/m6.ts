// M6 IRON CITADEL - "Foundry of Gristle". D minor, 132 bpm.
// Industrial and heavy: palm-muted overdriven power-chord riffs with a menacing half-step (b2)
// stab, an anvil clang on the downbeat, a square lead over harmonic-minor changes, a Neapolitan
// (Eb) detour, and a breakdown with a descending lament bass.
// Form: intro(4) | A(8) | B(8) | A'(8) | C(8) -> loop to A.

import { bassLine, drums, padLine, powerLine, prog, rest, SongBuilder } from './lib';

const INTRO = 'Dm Dm Bb A';
const A = 'Dm Dm Bb A Dm Dm Gm A';
const B = 'Gm Gm Dm Dm Eb Eb A A';
const A2 = 'Dm Dm Bb A Dm Dm Bb:8 C:8 Dm';
const C = 'Dm C Bb A Dm C Bb A7';

const THEME = [
  'D5:4 F5:4 E5:2 D5:2 A4:4', // Dm
  'Bb4:4 A4:4 F5:4 E5:4', // Dm   b6 leaning on the fifth
  'F5:4 D5:4 Bb4:4 D5:4', // Bb
  'E5:4 C#5:4 A4:4 E5:4', // A    (harmonic minor C#)
  'D5:4 F5:4 A5:4 G5:2 F5:2', // Dm
  'E5:4 F5:4 D5:8', // Dm
].join(' | ');
const LEAD_A = `${THEME} | G5:4 Bb5:4 A5:2 G5:2 D5:4 | C#5:4 E5:4 A5:8`; // Gm | A
const LEAD_A2 = `${THEME} | F5:4 D5:4 E5:4 G5:4 | D5:16`; // Bb C | Dm
const LEAD_B = [
  'G4:2 Bb4:2 D5:2 Bb4:2 G4:2 Bb4:2 D5:4', // Gm   low, mechanical
  'G4:2 Bb4:2 Eb5:2 D5:2 Bb4:2 G4:2 D5:4', // Gm
  'F4:2 A4:2 D5:2 A4:2 F4:2 A4:2 D5:4', // Dm
  'F4:2 A4:2 E5:2 D5:2 A4:2 F4:2 A4:4', // Dm
  'Eb5:2 G5:2 Bb5:2 G5:2 Eb5:2 G5:2 Bb5:4', // Eb  (Neapolitan)
  'Bb5:4 G5:4 Eb5:4 Bb4:4', // Eb
  'A4:2 C#5:2 E5:2 G5:2 A5:4 G5:2 E5:2', // A
  'C#5:8 E5:4 A4:4', // A
].join(' | ');
const LEAD_C = [
  'A5:8 F5:8', // Dm   lament over a descending bass
  'G5:8 E5:8', // C
  'F5:8 D5:8', // Bb
  'E5:8 C#5:8', // A
  'D5:4 F5:4 A5:4 D6:4', // Dm
  'C6:4 G5:4 E5:4 C5:4', // C
  'Bb4:4 D5:4 F5:4 Bb5:4', // Bb
  'A5:4 G5:4 E5:4 C#5:4', // A7
].join(' | ');

const RIFF = 'P:2 P:1 P:1 .:2 P:2 P:1 P:1 .:2 P:2 Q:2';
const BASS_RIFF = 'R:2 R:1 R:1 .:2 R:2 R:1 R:1 .:2 R:2 m:2';
const GRIND = 'k+m . . k s . k . k . . k s+m . h .';
const GRIND_CRASH = 'k+m+c . . k s . k . k . . k s+m . h .';
const FILL = 's s s s s s s s t t t t T T T T';
const riff = (p: string) => powerLine(prog(p), RIFF, { lo: 43 });
const dark = (p: string) => padLine(prog(p), { lo: 50 });

const S = new SongBuilder(
  'm6',
  { bpm: 132, title: 'FOUNDRY OF GRISTLE', echoSteps: 2, echoFeedback: 0.25 },
  {
    lead: { inst: 'pulse', vol: 0.48, vibrato: 15, cutoff: 3600, echo: 0.18, role: 'lead' },
    guitar: { inst: 'guitar', vol: 0.36, pan: -0.2, drive: 7, role: 'harmony' },
    pad: { inst: 'strings', vol: 0.24, cutoff: 1500, pan: 0.3, role: 'harmony' },
    bass: { inst: 'bass', vol: 0.42, role: 'bass' },
    drums: { inst: 'drums', vol: 0.46, role: 'drums' },
  },
);

S.section(
  'intro',
  4,
  {
    guitar: riff(INTRO),
    bass: `${rest(32)} ${bassLine(prog('Bb A'), BASS_RIFF, { lo: 33 })}`,
    drums: `m . . . . . . . m . . . . . . . | m . . . . . . . m . . . m . m . | ${GRIND_CRASH} | ${FILL}`,
  },
  INTRO,
)
  .loopHere()
  .section('A', 8, { lead: LEAD_A, guitar: riff(A), bass: bassLine(prog(A), BASS_RIFF, { lo: 33 }), drums: drums(8, GRIND, { first: GRIND_CRASH, last: FILL }) }, A)
  .section('B', 8, { lead: LEAD_B, guitar: riff(B), pad: dark(B), bass: bassLine(prog(B), BASS_RIFF, { lo: 33 }), drums: drums(8, GRIND, { first: GRIND_CRASH, last: FILL }) }, B)
  .section("A'", 8, { lead: LEAD_A2, guitar: riff(A2), bass: bassLine(prog(A2), BASS_RIFF, { lo: 33 }), drums: drums(8, GRIND, { first: GRIND_CRASH, last: FILL }) }, A2)
  .section(
    'C',
    8,
    {
      lead: LEAD_C,
      guitar: powerLine(prog(C), 'P:16', { lo: 43 }),
      pad: dark(C),
      bass: bassLine(prog(C), 'R:4 R:4 R:4 R:4', { lo: 33 }),
      drums: drums(8, 'k+m . . . s . . . k . . . s . . .', { first: 'k+m+c . . . s . . . k . . . s . . .', last: FILL }),
    },
    C,
  )
  .define();
