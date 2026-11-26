// Finale music.
//   ENDING  "Ruckus Reprise" - the title theme lifted a whole step to E major, 144 bpm, with a
//           soaring supersaw lead, a new lyrical bridge and the bVI-bVII-I (C-D-E) cadence.
//   CREDITS "Home Port" - Eb major, 116 bpm: warm and celebratory; a flute-like lead over a
//           descending bass line (Eb-D-C-Bb-Ab-G-F), plucked broken chords and clapping.

import { arpLine, bassLine, drums, padLine, prog, rest, SongBuilder, transpose } from './lib';
import { LEAD_A, LEAD_A2, LEAD_C } from './title';

// ===================================================================================== ENDING
{
  const UP = 2; // D major -> E major
  const INTRO = 'C D E B';
  const A = 'E B/D# C#m A E/G# A Bsus4:8 B:8 B';
  const A2 = 'E B/D# C#m A F#m7 B7 E E';
  const B = 'Amaj7 B G#m7 C#m7 F#m7 B7 Emaj7 B7';
  const C = 'C D E B';
  const LEAD_B = [
    'C#6:6 B5:2 G#5:4 E5:4', // Amaj7
    'B5:6 A5:2 F#5:8', // B
    'B5:6 G#5:2 D#5:8', // G#m7
    'E5:6 F#5:2 G#5:8', // C#m7
    'A5:6 G#5:2 F#5:4 C#6:4', // F#m7
    'B5:6 A5:2 F#5:4 D#5:4', // B7
    'G#5:6 F#5:2 E5:4 B5:4', // Emaj7
    'A5:4 F#5:4 D#5:4 B4:4', // B7 -> deceptive move to C
  ].join(' | ');
  const DRIVE = 'R:2 R:2 8:2 R:2 R:2 R:2 8:2 5:2';
  const ROCK = 'k+h . h . s+h . h . k+h . k+h . s+h . h .';
  const FILL = 's . s . s s . s t . t . T . T T';
  const TRES = 'k+c . . . h . k+s . . . h . k+s . h h';
  const ROLL = 's? s? s? s? s s s s s s s s s! s! s! s!';
  const S = new SongBuilder(
    'ending',
    { bpm: 144, title: 'RUCKUS REPRISE', echoSteps: 3, echoFeedback: 0.28, reverb: 1.2 },
    {
      lead: { inst: 'supersaw', vol: 0.46, glide: 0.03, vibrato: 16, vibratoDelay: 0.18, echo: 0.2, role: 'lead' },
      brass: { inst: 'brass', vol: 0.42, pan: -0.25, role: 'counter' },
      bells: { inst: 'bell', vol: 0.24, pan: 0.35, role: 'harmony' },
      pad: { inst: 'strings', vol: 0.22, pan: 0.2, role: 'harmony' },
      bass: { inst: 'bass', vol: 0.42, role: 'bass' },
      drums: { inst: 'drums', vol: 0.44, role: 'drums' },
    },
  );
  const bells = (p: string) => arpLine(prog(p), '0:2 1:2 2:2 3:2', { lo: 64 });
  const tres = (p: string) => `${bassLine(prog(p.split(' ').slice(0, 3).join(' ')), 'R:6 R:6 R:4', { lo: 35 })} ${bassLine(prog(p.split(' ')[3]), 'R:4 R:4 5:4 8:4', { lo: 35 })}`;
  S.section(
    'intro',
    4,
    {
      lead: `${rest(48)} .:12 B4:2 D#5:2`,
      brass: `${padLine(prog('C D E'), { lo: 57, rhythm: 'X:6 X:6 X:4' })} ${padLine(prog('B'), { lo: 57, rhythm: 'X:4' })}`,
      pad: padLine(prog(INTRO), { lo: 52 }),
      bass: tres(INTRO),
      drums: `${drums(3, TRES)} | ${ROLL}`,
    },
    INTRO,
  )
    .loopHere()
    .section(
      'A',
      8,
      {
        lead: transpose(LEAD_A, UP),
        brass: padLine(prog(A), { lo: 57 }),
        bells: bells(A),
        bass: bassLine(prog(A), DRIVE, { lo: 35 }),
        drums: drums(8, ROCK, { first: `k+c${ROCK.slice(3)}`, last: FILL }),
      },
      A,
    )
    .section(
      "A'",
      8,
      {
        lead: transpose(LEAD_A2, UP),
        brass: padLine(prog(A2), { lo: 57, rhythm: '.:2 X:2' }),
        bells: bells(A2),
        pad: padLine(prog(A2), { lo: 52 }),
        bass: bassLine(prog(A2), DRIVE, { lo: 35 }),
        drums: drums(8, ROCK, { first: `k+c${ROCK.slice(3)}`, last: FILL }),
      },
      A2,
    )
    .section(
      'B',
      8,
      {
        lead: LEAD_B,
        brass: padLine(prog(B), { lo: 57, rhythm: 'X:6 X:6 X:4' }),
        bells: bells(B),
        pad: padLine(prog(B), { lo: 52 }),
        bass: bassLine(prog(B), DRIVE, { lo: 35 }),
        drums: drums(8, 'k+h . h . s+h . h k k+h . h . s+h . h .', { first: 'k+c . h . s+h . h k k+h . h . s+h . h .', last: ROLL }),
      },
      B,
    )
    .section(
      'C',
      4,
      { lead: transpose(LEAD_C, UP), brass: transpose(LEAD_C, UP - 12), bells: bells(C), pad: padLine(prog(C), { lo: 52 }), bass: tres(C), drums: `${drums(3, TRES)} | ${ROLL}` },
      C,
    )
    .define();
}

// ==================================================================================== CREDITS
{
  const A = 'Eb Bb/D Cm Gm/Bb Ab Eb/G Fm7 Bb7';
  const B = 'Ab Bb Gm Cm Fm7 Bb7 Eb Eb7';
  const C = 'Ab Bb Gm7 C7 Fm7 Ab/Bb Eb Bb7';
  const VERSE = [
    'G5:6 F5:2 Eb5:4 Bb4:4', // Eb
    'F5:6 Eb5:2 D5:4 Bb4:4', // Bb/D
    'Eb5:6 D5:2 C5:4 G5:4', // Cm
    'F5:4 D5:4 Bb4:8', // Gm/Bb
    'C5:6 Eb5:2 Ab5:4 G5:4', // Ab   (G = major seventh colour)
    'G5:6 Bb5:2 G5:4 Eb5:4', // Eb/G
    'Ab5:6 G5:2 F5:4 C5:4', // Fm7
  ].join(' | ');
  const LEAD_A = `${VERSE} | D5:4 F5:4 Ab5:4 Bb5:4`; // Bb7 rising
  const LEAD_A2 = `${VERSE} | D5:4 Bb4:4 .:8`; // Bb7, a breath before the loop
  const LEAD_B = [
    'C6:8 Ab5:4 Eb5:4', // Ab
    'D6:8 Bb5:4 F5:4', // Bb
    'Bb5:8 G5:4 D5:4', // Gm
    'Eb5:8 G5:4 C6:4', // Cm
    'Ab5:6 G5:2 F5:4 Eb5:4', // Fm7
    'D5:6 F5:2 Bb5:8', // Bb7
    'G5:6 F5:2 Eb5:8', // Eb
    'Bb4:4 Db5:4 Eb5:4 G5:4', // Eb7 (Db = seventh) -> Ab
  ].join(' | ');
  const LEAD_C = [
    'Eb5:4 Ab5:4 C6:6 Bb5:2', // Ab
    'Bb5:4 F5:4 D5:8', // Bb
    'D5:4 F5:4 G5:8', // Gm7
    'E5:4 G5:4 Bb5:4 C6:4', // C7 (secondary dominant, E natural)
    'C6:6 Ab5:2 F5:8', // Fm7
    'Eb5:4 F5:4 Ab5:4 Bb5:4', // Ab/Bb
    'G5:12 F5:2 Eb5:2', // Eb
    'D5:4 F5:4 Ab5:4 F5:4', // Bb7
  ].join(' | ');
  const CLAP = 'k . h . p . h . k . h k p . h .';
  const CLAP_CRASH = 'k+c . h . p . h . k . h k p . h .';
  const FILL = 'k . h . p . h . t . t . T . p p';
  const S = new SongBuilder(
    'credits',
    { bpm: 116, title: 'HOME PORT', echoSteps: 3, echoFeedback: 0.3, reverb: 1.3 },
    {
      lead: { inst: 'sine', vol: 0.48, vibrato: 20, vibratoDelay: 0.15, glide: 0.02, echo: 0.25, reverb: 0.35, role: 'lead' },
      guitar: { inst: 'pluck', vol: 0.32, pan: -0.3, role: 'harmony' },
      bells: { inst: 'bell', vol: 0.3, pan: 0.35, role: 'harmony' },
      pad: { inst: 'strings', vol: 0.24, pan: 0.15, role: 'harmony' },
      bass: { inst: 'triangle', vol: 0.68, role: 'bass' },
      drums: { inst: 'drums', vol: 0.44, role: 'drums' },
    },
  );
  const pick = (p: string) => arpLine(prog(p), '0:2 1:2 2:2 3:2 2:2 1:2 2:2 3:2', { lo: 55 });
  const BASS = 'R:4 8:4 5:4 8:4';
  S.section('A', 8, { lead: LEAD_A, guitar: pick(A), pad: padLine(prog(A), { lo: 52 }), bass: bassLine(prog(A), BASS, { lo: 29 }), drums: drums(8, CLAP, { first: CLAP_CRASH, last: FILL }) }, A)
    .section(
      'B',
      8,
      {
        lead: LEAD_B,
        guitar: pick(B),
        bells: arpLine(prog(B), '2:4 1:4 0:4 1:4', { lo: 67 }),
        pad: padLine(prog(B), { lo: 52 }),
        bass: bassLine(prog(B), BASS, { lo: 29 }),
        drums: drums(8, CLAP, { first: CLAP_CRASH, last: FILL }),
      },
      B,
    )
    .section(
      'C',
      8,
      {
        lead: LEAD_C,
        guitar: pick(C),
        bells: arpLine(prog(C), '2:4 1:4 0:4 1:4', { lo: 67 }),
        pad: padLine(prog(C), { lo: 52 }),
        bass: bassLine(prog(C), BASS, { lo: 29 }),
        drums: drums(8, CLAP, { first: CLAP_CRASH, last: FILL }),
      },
      C,
    )
    .section("A'", 8, { lead: LEAD_A2, guitar: pick(A), pad: padLine(prog(A), { lo: 52 }), bass: bassLine(prog(A), BASS, { lo: 29 }), drums: drums(8, CLAP, { first: CLAP_CRASH, last: FILL }) }, A)
    .define();
}
