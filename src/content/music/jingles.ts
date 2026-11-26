// Short pieces: MISSION_COMPLETE and GAMEOVER play once (loop: false); TALLY is a light loop.

import { arpLine, bassLine, drums, padLine, prog, SongBuilder } from './lib';

// =========================================================================== MISSION_COMPLETE
// G major fanfare, 160 bpm, 3 bars (~4.5 s): a quick arpeggio up to the high D, a IV-V cadence
// (C-D, with the leading tone F# resolving) and a held tonic chord.
{
  const S = new SongBuilder(
    'mission_complete',
    { bpm: 160, title: 'MISSION ACCOMPLISHED', loop: false, echoSteps: 3, echoFeedback: 0.2 },
    {
      lead: { inst: 'pulse25', vol: 0.52, vibrato: 18, vibratoDelay: 0.2, echo: 0.18, role: 'lead' },
      brass: { inst: 'brass', vol: 0.42, pan: -0.2, role: 'counter' },
      arp: { inst: 'pulse12', vol: 0.32, pan: 0.35, env: { d: 0.04, s: 0.4 }, role: 'harmony' },
      bass: { inst: 'bass', vol: 0.42, role: 'bass' },
      drums: { inst: 'drums', vol: 0.46, role: 'drums' },
    },
  );
  S.section(
    'fanfare',
    2,
    {
      lead: 'D5:1 G5:1 B5:1 D6:5 C6:2 B5:2 A5:2 B5:2 | E5:2 G5:2 C6:4 D6:2 C6:2 A5:2 F#5:2',
      brass: '.:3 G4+B4+D5:5 G4+B4+D5:4 G4+B4+D5:4 | C4+E4+G4:8 D4+F#4+A4:8',
      bass: 'G2:4 D3:4 G2:4 D3:4 | C3:8 D3:8',
      drums: 's s s k+c! . . . . k . s . k . s s | k+c . s . k . s . k+c . s . s s s s',
    },
    'G C:8 D:8',
  )
    .section(
      'tonic',
      1,
      {
        lead: 'G5:16',
        brass: 'G4+B4+D5:16',
        arp: arpLine(prog('G'), '0 1 2 3', { lo: 55 }),
        bass: 'G2:16',
        drums: 'k+c! . . . . . . . . . . . . . . .',
      },
      'G',
    )
    .define();
}

// =================================================================================== GAMEOVER
// A minor, 84 bpm, 1.5 bars (~4.3 s): a descending Andalusian bass (A-G-F-E) under a falling
// melody in parallel tenths (C-B-A-G#), landing on a hollow A minor.
{
  const S = new SongBuilder(
    'gameover',
    { bpm: 84, title: 'GAME OVER', loop: false, reverb: 1.4 },
    {
      lead: { inst: 'pulse', vol: 0.48, vibrato: 25, vibratoDelay: 0.25, vibratoRate: 5, cutoff: 3000, role: 'lead' },
      pad: { inst: 'strings', vol: 0.3, role: 'harmony' },
      bass: { inst: 'triangle', vol: 0.68, role: 'bass' },
      drums: { inst: 'drums', vol: 0.4, role: 'drums' },
    },
  );
  const FALL = 'Am:4 G:4 F:4 E:4';
  S.section(
    'fall',
    1,
    { lead: 'C5:4 B4:4 A4:4 G#4:4', pad: padLine(prog(FALL), { lo: 52 }), bass: 'A2:4 G2:4 F2:4 E2:4', drums: 'T . . . . . . . . . . . T . T .' },
    FALL,
  )
    .section('end', 0.5, { lead: 'A4:8', pad: 'A3+C4+E4:8', bass: 'A2:8', drums: 'k+c . . . . . . .' }, 'Am:8')
    .define();
}

// ====================================================================================== TALLY
// "Counting the Spoils" - Bb major, 112 bpm. Light and bouncy: a pulse melody over music-box
// bells, a hopping triangle bass and rim-click drums. Form: A(8) | B(8), loops.
{
  const A = 'Bb Gm Cm7 F7 Bb Gm Eb F7';
  const B = 'Ebmaj7 Dm7 Cm7 F Ebmaj7 Dm7 Cm7:8 F7:8 Bb';
  const LEAD_A = [
    'D5:2 F5:2 Bb5:4 A5:2 Bb5:2 F5:4', // Bb
    'D5:2 G5:2 Bb5:4 A5:2 G5:2 D5:4', // Gm
    'Eb5:2 G5:2 C6:4 Bb5:2 G5:2 Eb5:4', // Cm7
    'C5:2 F5:2 A5:4 G5:2 F5:2 Eb5:4', // F7
    'D5:2 F5:2 Bb5:4 C6:2 D6:2 Bb5:4', // Bb
    'Bb5:2 A5:2 G5:4 D5:4 G5:4', // Gm
    'G5:4 Bb5:4 G5:2 F5:2 Eb5:4', // Eb
    'F5:4 A5:4 C6:4 A5:4', // F7
  ].join(' | ');
  const LEAD_B = [
    'G5:6 F5:2 D5:8', // Ebmaj7
    'F5:6 C5:2 A4:8', // Dm7
    'Eb5:6 D5:2 C5:8', // Cm7
    'C5:8 F5:8', // F
    'Bb5:6 G5:2 D5:8', // Ebmaj7
    'C6:6 A5:2 F5:8', // Dm7
    'Eb5:4 G5:4 A5:4 C6:4', // Cm7 | F7
    'Bb5:8 .:8', // Bb
  ].join(' | ');
  const HOP = 'R:2 .:2 5:2 .:2 R:2 .:2 5:2 8:2';
  const RIM = 'k . h . x . h . k . h k x . h .';
  const S = new SongBuilder(
    'tally',
    { bpm: 112, title: 'COUNTING THE SPOILS', echoSteps: 3, echoFeedback: 0.22 },
    {
      lead: { inst: 'pulse25', vol: 0.48, vibrato: 10, echo: 0.15, role: 'lead' },
      bells: { inst: 'bell', vol: 0.26, pan: -0.3, role: 'harmony' },
      bass: { inst: 'triangle', vol: 0.68, role: 'bass' },
      drums: { inst: 'drums', vol: 0.44, role: 'drums' },
    },
  );
  const bells = (p: string) => arpLine(prog(p), '0:2 1:2 2:2 3:2', { lo: 62 });
  S.section('A', 8, { lead: LEAD_A, bells: bells(A), bass: bassLine(prog(A), HOP, { lo: 38 }), drums: drums(8, RIM) }, A)
    .section('B', 8, { lead: LEAD_B, bells: bells(B), bass: bassLine(prog(B), HOP, { lo: 38 }), drums: drums(8, RIM, { last: 'k . x . x . x x k . x . x x x x' }) }, B)
    .define();
}
