// M4 RUSTWATER DOCKS - "Low Tide Noir". C minor, 104 bpm, swung eighths (8 steps per bar).
// Dusk-noir jazz: a muted-trumpet pulse lead with late vibrato, Charleston-rhythm organ comping
// on seventh chords, a walking bass with chromatic approach notes, brushed snare and ride, vibes
// in the bridge. AABA form over a minor ii-V turnaround; the bridge visits the relative major.
// Form: intro(2) | A(8) | A'(8) | B(8) | A(8) -> loop to A.

import { arpLine, bassLine, padLine, prog, SongBuilder, type ChordSpan } from './lib';

const P = (s: string) => prog(s, 8); // one bar = 8 steps here
const INTRO = P('Cm7 G7');
const A = P('Cm7 Fm7 Dm7b5 G7 Cm7 Abmaj7 Dm7b5:4 G7:4 Cm7:4 G7:4');
const A2 = P('Cm7 Fm7 Dm7b5 G7 Cm7 Abmaj7 Dm7b5:4 G7:4 Cm7');
const B = P('Ebmaj7 Abmaj7 Fm7 Bb7 Ebmaj7 Abmaj7 Dm7b5 G7');

const HEAD = [
  '.:1 G4:1 C5:1 Eb5:2 D5:1 C5:2', // Cm7     syncopated pickup figure
  '.:1 Ab4:1 C5:1 Eb5:2 F5:1 Eb5:2', // Fm7
  '.:1 F5:1 Ab5:1 C6:2 Ab5:1 F5:2', // Dm7b5
  'Eb5:2 D5:1 B4:1 .:1 G4:1 B4:2', // G7      b13 resolving to the fifth
  'C5:1 Eb5:1 G5:1 Bb5:3 G5:2', // Cm7
  'G5:3 Eb5:1 C5:2 Ab4:2', // Abmaj7  (G = major seventh)
  'F5:2 Ab5:2 G5:1 F5:1 D5:2', // Dm7b5 | G7
].join(' | ');
const LEAD_A = `${HEAD} | C5:4 .:2 B4:1 D5:1`; // Cm7 | G7 turnaround
const LEAD_A2 = `${HEAD} | C5:4 .:2 D5:1 Eb5:1`; // Cm7, run-up into the bridge
const LEAD_B = [
  'G5:3 F5:1 D5:2 Bb4:2', // Ebmaj7
  'C6:3 Bb5:1 G5:2 Eb5:2', // Abmaj7
  'Ab5:3 G5:1 F5:2 C5:2', // Fm7
  'D5:2 F5:2 Ab5:2 Bb5:2', // Bb7
  'G5:3 Bb5:1 D6:4', // Ebmaj7
  'C6:3 Bb5:1 Ab5:2 Eb5:2', // Abmaj7
  'F5:2 Ab5:2 C6:2 Ab5:2', // Dm7b5
  'G5:2 F5:1 D5:1 B4:4', // G7
].join(' | ');

// Walking bass: root, third, fifth, chromatic approach (two-beat chords: root, approach).
const walk = (p: ChordSpan[]) => bassLine(p, (c) => (c.len >= 8 ? 'R:2 3:2 5:2 A:2' : 'R:2 A:2'), { lo: 36 });
const comp = (p: ChordSpan[]) => padLine(p, { lo: 55, voices: 4, rhythm: 'X:1 .:2 X:1 .:4' });
const RIDE = 'k+r . r+s r? r . r+s r?';
const RIDE_IN = 'r . r r? r . r r?';
const FILL = 's? s s? s s? s s s!';
const ride = (bars: number) => [`k+r+c . r+s r? r . r+s r?`, ...Array(bars - 2).fill(RIDE), FILL].join(' | ');

const S = new SongBuilder(
  'm4',
  { bpm: 104, stepsPerBeat: 2, title: 'LOW TIDE NOIR', swing: 0.3, echoSteps: 3, echoFeedback: 0.3, reverb: 1.3 },
  {
    lead: { inst: 'pulse', vol: 0.5, cutoff: 2300, vibrato: 22, vibratoDelay: 0.22, vibratoRate: 5, echo: 0.22, reverb: 0.35, role: 'lead' },
    organ: { inst: 'organ', vol: 0.42, pan: -0.25, env: { r: 0.08 }, role: 'harmony' },
    vibes: { inst: 'bell', vol: 0.24, pan: 0.35, role: 'harmony' },
    bass: { inst: 'bass', vol: 0.44, env: { d: 0.25, s: 0.5, r: 0.08 }, role: 'bass' },
    drums: { inst: 'drums', vol: 0.46, role: 'drums' },
  },
);

S.section('intro', 2, { organ: comp(INTRO), bass: walk(INTRO), drums: `${RIDE_IN} | ${FILL}` }, INTRO)
  .loopHere()
  .section('A', 8, { lead: LEAD_A, organ: comp(A), bass: walk(A), drums: ride(8) }, A)
  .section("A'", 8, { lead: LEAD_A2, organ: comp(A2), bass: walk(A2), drums: ride(8) }, A2)
  .section('B', 8, { lead: LEAD_B, organ: comp(B), vibes: arpLine(B, '0:2 1:2 2:2 3:2', { lo: 60 }), bass: walk(B), drums: ride(8) }, B)
  .section('A', 8, { lead: LEAD_A, organ: comp(A), bass: walk(A), drums: ride(8) }, A)
  .define();

