// Menu music: SELECT (upbeat funk loop) and BRIEFING (tense military suspense).

import { bassLine, drums, padLine, prog, rest, SongBuilder } from './lib';

// ===================================================================================== SELECT
// "Squad Up" - F major, 126 bpm. Syncopated plucked-guitar hook, organ off-beat skank, funky
// octave bass, claps. Form: intro(2) | A(8) | B(8) | A(8) | C(8) -> loop to A.
{
  const INTRO = 'F C7';
  const A = 'F Dm7 Bbmaj7 C7 F Dm7 Gm7 C7';
  const B = 'Bbmaj7 Am7 Gm7 F Bbmaj7 Am7 Gm7 C7sus4:8 C7:8';
  const C = 'Dm7 Am7 Bbmaj7 F/A Gm7 Am7 Bbmaj7 C7';
  const LEAD_A = [
    'C5:2 F5:2 .:2 A5:2 .:2 G5:2 F5:4', // F
    '.:2 D5:2 F5:2 .:2 A5:2 C6:2 A5:4', // Dm7
    'G5:3 F5:3 D5:2 .:2 F5:2 A5:4', // Bbmaj7 (G = 13th leaning on F)
    'G5:2 E5:2 C5:2 Bb4:2 .:2 C5:2 E5:4', // C7
    'C5:2 F5:2 .:2 A5:2 .:2 C6:2 A5:4', // F
    '.:2 F5:2 A5:2 .:2 C6:2 D6:2 C6:4', // Dm7
    'Bb5:3 A5:3 G5:2 .:2 F5:2 D5:4', // Gm7
    'E5:2 G5:2 Bb5:2 G5:2 .:4 C5:4', // C7
  ].join(' | ');
  const LEAD_B = [
    'D5:6 F5:2 A5:8', // Bbmaj7
    'G5:6 E5:2 C5:8', // Am7
    'Bb4:6 D5:2 F5:8', // Gm7
    'E5:4 F5:4 C5:8', // F (E = maj7 leaning on F)
    'D5:6 F5:2 A5:6 Bb5:2', // Bbmaj7
    'C6:6 A5:2 G5:8', // Am7
    'F5:6 G5:2 Bb5:8', // Gm7
    'C6:8 Bb5:4 E5:4', // C7sus4 -> C7
  ].join(' | ');
  const LEAD_C = [
    'A5:2 .:2 A5:2 C6:2 .:4 A5:4', // Dm7
    'G5:2 .:2 G5:2 A5:2 .:4 E5:4', // Am7
    'F5:2 .:2 F5:2 A5:2 .:4 D5:4', // Bbmaj7
    'C5:8 .:8', // F/A
    'D5:2 F5:2 G5:2 Bb5:2 .:2 A5:2 G5:4', // Gm7
    'C6:2 .:2 C6:2 A5:2 .:2 G5:2 E5:4', // Am7
    'D6:4 C6:4 A5:4 F5:4', // Bbmaj7
    'G5:4 E5:4 C5:4 Bb4:4', // C7
  ].join(' | ');
  const FUNK = 'k . h . s+p . h k . h k . s+p . o .';
  const FUNK_CRASH = 'k+c . h . s+p . h k . h k . s+p . o .';
  const FILL = 'k . s . s+p . s s t . t . T . T T';
  const BASS = 'R:2 .:1 R:1 8:2 R:2 .:2 R:1 R:1 5:2 8:2';
  const organ = (p: string) => padLine(prog(p), { lo: 53, voices: 4, rhythm: '.:2 X:2' });
  const S = new SongBuilder(
    'select',
    { bpm: 126, title: 'SQUAD UP', echoSteps: 3, echoFeedback: 0.25 },
    {
      lead: { inst: 'pluck', vol: 0.75, pan: 0.1, echo: 0.2, role: 'lead' },
      organ: { inst: 'organ', vol: 0.42, pan: -0.25, env: { r: 0.05 }, role: 'harmony' },
      strings: { inst: 'strings', vol: 0.24, pan: 0.3, role: 'harmony' },
      bass: { inst: 'bass', vol: 0.42, role: 'bass' },
      drums: { inst: 'drums', vol: 0.44, role: 'drums' },
    },
  );
  S.section('intro', 2, { bass: bassLine(prog(INTRO), BASS), drums: `k . h . . . h k . h k . . . o . | ${FILL}`, organ: `${rest(16)} ${organ('C7')}` }, INTRO)
    .loopHere()
    .section('A', 8, { lead: LEAD_A, organ: organ(A), bass: bassLine(prog(A), BASS), drums: drums(8, FUNK, { first: FUNK_CRASH, last: FILL }) }, A)
    .section(
      'B',
      8,
      { lead: LEAD_B, organ: organ(B), strings: padLine(prog(B), { lo: 55 }), bass: bassLine(prog(B), BASS), drums: drums(8, FUNK, { first: FUNK_CRASH, last: FILL }) },
      B,
    )
    .section("A'", 8, { lead: LEAD_A, organ: organ(A), bass: bassLine(prog(A), BASS), drums: drums(8, FUNK, { first: FUNK_CRASH, last: FILL }) }, A)
    .section(
      'C',
      8,
      { lead: LEAD_C, organ: organ(C), strings: padLine(prog(C), { lo: 55 }), bass: bassLine(prog(C), BASS), drums: drums(8, FUNK, { first: FUNK_CRASH, last: FILL }) },
      C,
    )
    .define();
}

// =================================================================================== BRIEFING
// "Dossier" - D minor, 100 bpm. A bell motif over a pulsing pedal bass, a low saw drone,
// clock-tick woodblock and swelling snare rolls. The B section moves through the Neapolitan
// (Eb) to the dominant. Form: intro(2) | A(8) | B(8) | A'(8) -> loop to A.
{
  const INTRO = 'Dm Dm';
  const A = 'Dm Dm Bbmaj7/D Bbmaj7/D Gm/D Gm A7sus4 A7';
  const B = 'Gm Gm Dm/F Dm/F Eb Eb A7/E A7';
  const LEAD_A = [
    '.:4 A4:4 D5:4 F5:4', // Dm   rising triad
    'E5:6 D5:2 A4:8', // Dm         9th sighing onto the root
    '.:4 Bb4:4 D5:4 F5:4', // Bbmaj7/D
    'A5:6 G5:2 F5:8', // Bbmaj7/D
    '.:4 G4:4 Bb4:4 D5:4', // Gm/D
    'Eb5:6 D5:2 Bb4:8', // Gm     b6 tension -> fifth
    '.:4 E5:4 D5:4 G5:4', // A7sus4
    'C#5:8 E5:4 A4:4', // A7
  ].join(' | ');
  const LEAD_B = [
    'D5:8 Bb4:4 G4:4', // Gm
    'A4:4 Bb4:4 C5:4 D5:4', // Gm   rising line
    'F5:8 E5:4 D5:4', // Dm/F
    'A4:16', // Dm/F
    'G5:8 F5:4 Eb5:4', // Eb (Neapolitan)
    'Bb4:8 .:8', // Eb
    'A5:4 G5:4 E5:4 C#5:4', // A7/E
    'E5:4 D5:2 C#5:2 A4:8', // A7
  ].join(' | ');
  const DRONE_A = 'D2+A2:80 G1+D2:16 A1+E2:32';
  const DRONE_B = 'G1+D2:32 F2+C3:32 Eb2+Bb2:32 A1+E2:32';
  const TICK = 'k+x . . . x . . . k+x . . k x . . .';
  const TICK_H = 'k+x . h . x+s? . h . k+x . h k s+x . h .';
  const ROLL = 's? s? s? s? s? s? s s s s s s s! s! s! s!';
  const S = new SongBuilder(
    'briefing',
    { bpm: 100, title: 'DOSSIER', echoSteps: 6, echoFeedback: 0.35, reverb: 1.2 },
    {
      lead: { inst: 'bell', vol: 0.8, pan: 0.15, echo: 0.3, role: 'lead' },
      pad: { inst: 'strings', vol: 0.28, pan: -0.2, role: 'harmony' },
      drone: { inst: 'saw', vol: 0.2, cutoff: 700, env: { a: 0.4, r: 0.6 }, role: 'fx' },
      bass: { inst: 'bass', vol: 0.4, role: 'bass' },
      drums: { inst: 'drums', vol: 0.4, role: 'drums' },
    },
  );
  const pulse = 'R:2 R:2 R:2 R:2 R:2 R:2 R:2 8:2';
  S.section('intro', 2, { bass: bassLine(prog(INTRO), pulse, { lo: 38 }), drums: `${TICK} | ${ROLL}`, drone: 'D2+A2:32' }, INTRO)
    .loopHere()
    .section('A', 8, { lead: LEAD_A, pad: padLine(prog(A), { lo: 50 }), drone: DRONE_A, bass: bassLine(prog(A), pulse, { lo: 38 }), drums: drums(8, TICK, { last: ROLL }) }, A)
    .section('B', 8, { lead: LEAD_B, pad: padLine(prog(B), { lo: 50 }), drone: DRONE_B, bass: bassLine(prog(B), pulse, { lo: 38 }), drums: drums(8, TICK_H, { last: ROLL }) }, B)
    .section(
      "A'",
      8,
      {
        lead: LEAD_A,
        pad: padLine(prog(A), { lo: 50 }),
        drone: DRONE_A,
        bass: bassLine(prog(A), pulse, { lo: 38 }),
        drums: drums(8, TICK_H, { last: ROLL }),
      },
      A,
    )
    .define();
}
