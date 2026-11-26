// Boss music.
//   BOSS       "Clash of Iron" - E minor, 170 bpm: relentless 16th-note bass ostinato, brass stabs,
//              an aggressive repeated-note hook over harmonic-minor changes (B7 dominant).
//   BOSS_FINAL "Juggernaut" - C minor, 148 bpm: choir, organ, overdriven guitar and a brass lead;
//              the C section quotes the title hook transformed into C minor as the hero's leitmotif.

import { arpLine, bassLine, drums, padLine, powerLine, prog, rest, SongBuilder } from './lib';

// ======================================================================================= BOSS
{
  const INTRO = 'Em B7';
  const A = 'Em Em C B7 Em Em Am B7';
  const B = 'C D Bm Em C D B7 B7';
  const C = 'Am Em C B7 Am Em F#m7b5 B7';
  const LEAD_A = [
    'E5:2 E5:2 G5:2 E5:2 B5:4 A5:2 G5:2', // Em   hammering repeated notes
    'F#5:2 G5:2 A5:2 G5:2 F#5:2 E5:2 D#5:4', // Em   leading tone pulls to E
    'E5:2 E5:2 G5:2 E5:2 C6:4 B5:2 A5:2', // C
    'B5:4 A5:2 F#5:2 D#5:4 B4:4', // B7
    'E5:2 E5:2 G5:2 E5:2 B5:4 D6:2 B5:2', // Em
    'B5:2 A5:2 G5:2 F#5:2 G5:2 A5:2 B5:4', // Em
    'C6:4 B5:2 A5:2 E5:4 A5:4', // Am
    'B5:4 F#5:4 D#5:4 F#5:4', // B7
  ].join(' | ');
  const LEAD_B = [
    'G5:6 E5:2 C5:8', // C
    'A5:6 F#5:2 D5:8', // D
    'B5:6 F#5:2 D5:8', // Bm
    'E5:6 G5:2 B5:8', // Em
    'C6:6 B5:2 G5:8', // C
    'D6:6 A5:2 F#5:8', // D
    'F#5:4 A5:4 B5:4 D#6:4', // B7
    'B5:8 .:8', // B7
  ].join(' | ');
  const LEAD_C = [
    'A5:4 C6:4 B5:2 A5:2 E5:4', // Am
    'G5:4 B5:4 A5:2 G5:2 E5:4', // Em
    'E5:4 G5:4 C6:4 G5:4', // C
    'F#5:4 A5:4 D#5:4 B4:4', // B7
    'E5:2 A5:2 C6:4 E5:2 A5:2 C6:4', // Am
    'E5:2 G5:2 B5:4 E5:2 G5:2 B5:4', // Em
    'A5:4 C6:4 A5:4 F#5:4', // F#m7b5
    'D#5:4 F#5:4 A5:4 B5:4', // B7
  ].join(' | ');
  const OSTINATO = 'R R 8 R R R 8 R R R 8 R 5 R 8 R';
  const STAB = 'X:2 .:2 X:2 .:2 .:2 X:2 .:2 X:2';
  const GALLOP = 'k+h . k+h . s+h . k+h . k+h . k+h . s+h . k+h k';
  const BEAT = 'k . h . s . h k k . h . s . h h';
  const FILL = 's s s s t t t t T T T T s! s! s! s!';
  const S = new SongBuilder(
    'boss',
    { bpm: 170, title: 'CLASH OF IRON', echoSteps: 3, echoFeedback: 0.2 },
    {
      lead: { inst: 'pulse25', vol: 0.5, vibrato: 10, echo: 0.15, role: 'lead' },
      brass: { inst: 'brass', vol: 0.45, pan: -0.25, env: { r: 0.05 }, role: 'harmony' },
      arp: { inst: 'pulse12', vol: 0.36, pan: 0.4, env: { d: 0.04, s: 0.3 }, role: 'harmony' },
      bass: { inst: 'bass', vol: 0.42, role: 'bass' },
      drums: { inst: 'drums', vol: 0.46, role: 'drums' },
    },
  );
  const stab = (p: string) => padLine(prog(p), { lo: 52, rhythm: STAB });
  const ost = (p: string) => bassLine(prog(p), OSTINATO, { lo: 33 });
  S.section('intro', 2, { bass: ost(INTRO), brass: `${rest(16)} ${stab('B7')}`, drums: `T . T . T . T . T T T T T T T T | ${FILL}` }, INTRO)
    .loopHere()
    .section('A', 8, { lead: LEAD_A, brass: stab(A), bass: ost(A), drums: drums(8, GALLOP, { first: `k+h+c${GALLOP.slice(3)}`, last: FILL }) }, A)
    .section(
      'B',
      8,
      { lead: LEAD_B, brass: stab(B), arp: arpLine(prog(B), '0 1 2 3', { lo: 60 }), bass: ost(B), drums: drums(8, BEAT, { first: `k+c${BEAT.slice(1)}`, last: FILL }) },
      B,
    )
    .section("A'", 8, { lead: LEAD_A, brass: stab(A), arp: arpLine(prog(A), '0 1 2 3', { lo: 60 }), bass: ost(A), drums: drums(8, GALLOP, { first: `k+h+c${GALLOP.slice(3)}`, last: FILL }) }, A)
    .section(
      'C',
      8,
      { lead: LEAD_C, brass: stab(C), arp: arpLine(prog(C), '0 1 2 3', { lo: 60 }), bass: ost(C), drums: drums(8, BEAT, { first: `k+c${BEAT.slice(1)}`, last: FILL }) },
      C,
    )
    .define();
}

// ================================================================================= BOSS_FINAL
{
  const INTRO = 'Cm Ab Fm G';
  const A = 'Cm Ab Fm G Cm Ab Db G7';
  const B = 'Ab Bb Gm Cm Ab Bb G G';
  const A2 = 'Cm Ab Fm G Cm Ab Fm:8 G:8 Cm';
  const C = 'Cm Gm/Bb Ab G Ab Bb Cm G7';
  const EPIC = [
    'G5:6 Eb5:2 C5:8', // Cm
    'Ab5:6 Eb5:2 C5:8', // Ab
    'F5:4 Ab5:4 C6:6 Bb5:2', // Fm
    'B5:6 Ab5:2 G5:8', // G    (B natural = leading tone, Ab = b9 passing)
    'C6:6 G5:2 Eb5:8', // Cm
    'C6:6 Ab5:2 Eb5:8', // Ab
  ].join(' | ');
  const LEAD_A = `${EPIC} | F5:4 Ab5:4 Db6:8 | B5:4 G5:4 F5:4 D5:4`; // Db (Neapolitan) | G7
  const LEAD_A2 = `${EPIC} | F5:4 Ab5:4 G5:4 B5:4 | C6:16`; // Fm G | Cm
  const LEAD_B = [
    'Eb5:4 Ab5:4 C6:8', // Ab
    'D5:4 F5:4 Bb5:8', // Bb
    'Bb5:6 G5:2 D5:8', // Gm
    'Eb5:6 D5:2 C5:8', // Cm
    'Ab5:6 G5:2 Eb5:8', // Ab
    'F5:6 G5:2 Bb5:8', // Bb
    'B5:8 D6:8', // G
    'G5:16', // G
  ].join(' | ');
  // The title hook (D major) recast in C minor: same rhythm and contour, minor third.
  const LEITMOTIF = [
    'C5:3 G4:1 C5:2 D5:2 Eb5:8', // Cm
    'D5:3 Bb4:1 D5:2 Eb5:2 D5:8', // Gm/Bb
    'C5:3 Ab4:1 C5:2 D5:2 Eb5:4 Ab5:4', // Ab
    'A5:4 G5:2 F5:2 G5:8', // G    (9th appoggiatura, as in the title)
    'Eb5:4 Ab5:4 C6:8', // Ab
    'D5:4 F5:4 Bb5:8', // Bb
    'C6:12 Bb5:2 G5:2', // Cm
    'B4:4 D5:4 F5:4 G5:4', // G7
  ].join(' | ');
  const RIFF = 'P:2 P:1 P:1 P:2 P:2 P:2 P:1 P:1 P:2 P:2';
  const HEAVY = 'k . h . s . h k k . h . s . T T';
  const FILL = 's s s s t t t t T T T T s! s! s! s!';
  const S = new SongBuilder(
    'boss_final',
    { bpm: 148, title: 'JUGGERNAUT', echoSteps: 3, echoFeedback: 0.25, reverb: 1.2 },
    {
      lead: { inst: 'brass', vol: 0.5, vibrato: 14, vibratoDelay: 0.15, reverb: 0.3, role: 'lead' },
      choir: { inst: 'choir', vol: 0.32, pan: 0.2, role: 'harmony' },
      organ: { inst: 'organ', vol: 0.26, pan: -0.3, role: 'harmony' },
      guitar: { inst: 'guitar', vol: 0.3, pan: -0.15, drive: 6, role: 'harmony' },
      bass: { inst: 'bass', vol: 0.42, role: 'bass' },
      drums: { inst: 'drums', vol: 0.46, role: 'drums' },
    },
  );
  const choir = (p: string) => padLine(prog(p), { lo: 55 });
  const organ = (p: string) => padLine(prog(p), { lo: 48, voices: 4 });
  const riff = (p: string) => powerLine(prog(p), RIFF, { lo: 43 });
  const BASS = 'R:2 R:2 8:2 R:2 R:2 R:2 8:2 R:2';
  S.section(
    'intro',
    4,
    {
      choir: choir(INTRO),
      organ: organ(INTRO),
      bass: bassLine(prog(INTRO), 'R:16', { lo: 36 }),
      drums: `T . . . . . . . T . . . . . . . | T . . . . . . . T . . . T . . . | T . . . T . . . T . T . T . T . | ${FILL}`,
    },
    INTRO,
  )
    .loopHere()
    .section('A', 8, { lead: LEAD_A, choir: choir(A), guitar: riff(A), bass: bassLine(prog(A), BASS, { lo: 36 }), drums: drums(8, HEAVY, { first: `k+c${HEAVY.slice(1)}`, last: FILL }) }, A)
    .section('B', 8, { lead: LEAD_B, choir: choir(B), guitar: riff(B), bass: bassLine(prog(B), BASS, { lo: 36 }), drums: drums(8, HEAVY, { first: `k+c${HEAVY.slice(1)}`, last: FILL }) }, B)
    .section("A'", 8, { lead: LEAD_A2, choir: choir(A2), guitar: riff(A2), bass: bassLine(prog(A2), BASS, { lo: 36 }), drums: drums(8, HEAVY, { first: `k+c${HEAVY.slice(1)}`, last: FILL }) }, A2)
    .section(
      'C',
      8,
      { lead: LEITMOTIF, choir: choir(C), organ: organ(C), bass: bassLine(prog(C), 'R:6 R:6 R:4', { lo: 36 }), drums: drums(8, 'k+c . . . h . k+s . . . h . k+s . h h', { last: FILL }) },
      C,
    )
    .define();
}
