// Player weapon sounds. Each gun has its own signature: pistol = crisp "pak", HMG = short
// chunky thud that does not fatigue at high fire rates, shotgun = wide boom + pump rack, etc.

import { blip, click, crack, crackles, gunshot, hiss, ping, rumble, sfx, thump, whoosh } from './kit';

sfx(
  'pistol',
  gunshot({ crack: 0.5, crackHp: 2200, crackDur: 0.02, bark: 1500, barkVol: 0.5, barkDur: 0.07, body: [270, 95], bodyVol: 0.42, bodyDur: 0.06, tail: 0.17, tailVol: 0.17, tailCut: 3600 }),
  { poly: 4, gain: 1.1 },
);

sfx(
  'hmg',
  gunshot({ crack: 0.34, crackHp: 1600, crackDur: 0.016, bark: 950, barkVol: 0.5, barkDur: 0.055, body: [170, 60], bodyVol: 0.58, bodyDur: 0.07, tail: 0.09, tailVol: 0.11, tailCut: 2600, grit: 0.12 }),
  { poly: 3, gain: 0.8, minGap: 0.02 },
);

sfx(
  'shotgun',
  [
    ...gunshot({ crack: 0.7, crackHp: 1000, crackDur: 0.03, bark: 700, barkVol: 0.7, barkDur: 0.14, body: [125, 40], bodyVol: 0.85, bodyDur: 0.2, tail: 0.42, tailVol: 0.3, tailCut: 2300 }),
    rumble(0.38, 0.35),
    // Pump rack: "chk-chak".
    click(0.38, { delay: 0.3, bandpass: 2600 }),
    ping(1700, 0.05, 0.12, { delay: 0.302 }),
    click(0.45, { delay: 0.38, bandpass: 3400 }),
    ping(2300, 0.05, 0.12, { delay: 0.382 }),
  ],
  { poly: 3 },
);

sfx(
  'rocket_fire',
  [
    crack(0.42, { dur: 0.02, highpass: 1200 }),
    thump(150, 55, 0.12, 0.5),
    whoosh(380, 2600, 0.52, 0.55, { attack: 0.04, q: 1.1 }),
    hiss(0.42, 0.13, { delay: 0.03, attack: 0.05 }),
    rumble(0.45, 0.2, { lowpass: 600 }),
  ],
  { poly: 3 },
);

sfx(
  'homing_fire',
  [
    crack(0.3, { dur: 0.015, highpass: 2000 }),
    thump(190, 80, 0.07, 0.32),
    whoosh(700, 3400, 0.3, 0.38, { attack: 0.03, q: 1.6 }),
    crack(0.28, { dur: 0.015, highpass: 2000, delay: 0.085, seed: 21 }),
    thump(210, 90, 0.07, 0.28, { delay: 0.085 }),
    whoosh(800, 3800, 0.3, 0.34, { attack: 0.03, q: 1.6, delay: 0.085, seed: 22 }),
    hiss(0.35, 0.08, { delay: 0.05 }),
  ],
  { poly: 3, gain: 1.3 },
);

sfx(
  'flame',
  [
    whoosh(520, 1700, 0.32, 0.5, { attack: 0.03, q: 0.75, curve: 1.3 }),
    { wave: 'brown', dur: 0.32, attack: 0.02, curve: 1.3, lowpass: 750, tremolo: 0.3, tremoloRate: 31, vol: 0.38, seed: 31 },
    crackles(70, 0.3, 0.16, { highpass: 2500, seed: 32 }),
  ],
  { poly: 3, minGap: 0.03 },
);

sfx(
  'laser',
  [
    { wave: 'square', duty: 0.3, freq: 2300, freqEnd: 720, glide: 0.13, dur: 0.17, attack: 0.002, curve: 1.6, ring: 95, lowpass: 7000, vol: 0.22 },
    { wave: 'saw', freq: 1150, freqEnd: 360, glide: 0.14, dur: 0.16, attack: 0.002, curve: 1.5, tremolo: 0.5, tremoloRate: 62, lowpass: 5000, vol: 0.16 },
    { wave: 'sine', freq: 4600, freqEnd: 1500, dur: 0.1, attack: 0.001, curve: 2, vol: 0.07 },
  ],
  { poly: 2, gain: 0.85, minGap: 0.04 },
);

sfx(
  'bouncer_fire',
  [
    { wave: 'sine', freq: 170, freqEnd: 560, glide: 0.08, dur: 0.18, attack: 0.002, curve: 1.6, vol: 0.5 },
    { wave: 'square', duty: 0.4, freq: 85, freqEnd: 280, glide: 0.08, dur: 0.1, lowpass: 1400, curve: 2, vol: 0.16 },
    crack(0.24, { dur: 0.015, highpass: 1800 }),
  ],
  { poly: 3, gain: 0.65 },
);

sfx(
  'bouncer_bounce',
  [
    { wave: 'sine', freq: 230, freqEnd: 340, dur: 0.28, attack: 0.002, curve: 1.5, vibrato: 1.6, vibratoRate: 17, vol: 0.38 },
    { wave: 'triangle', freq: 460, freqEnd: 680, dur: 0.16, attack: 0.002, curve: 2, vibrato: 1.6, vibratoRate: 17, vol: 0.1 },
    thump(150, 70, 0.06, 0.3),
  ],
  { poly: 3, gain: 0.52 },
);

sfx(
  'knife',
  [
    whoosh(6200, 2400, 0.12, 0.42, { attack: 0.025, q: 1.5, curve: 1.8 }),
    thump(190, 95, 0.06, 0.22, { delay: 0.03 }),
    ping(3300, 0.17, 0.09, { delay: 0.02, fm: 1.2, fmEnd: 0.2 }),
    ping(4950, 0.1, 0.05, { delay: 0.021, fm: 0.8, fmEnd: 0.1 }),
  ],
  { poly: 3, gain: 1.3 },
);

sfx('throw', [whoosh(480, 1900, 0.19, 0.34, { attack: 0.07, q: 1 })], { poly: 3, gain: 0.9 });

sfx(
  'firebomb_burst',
  [
    thump(110, 40, 0.25, 0.7, { glide: 0.15 }),
    crack(0.45, { highpass: 900, dur: 0.03 }),
    whoosh(260, 1500, 0.75, 0.6, { attack: 0.08, q: 0.7, curve: 1.3 }),
    { wave: 'brown', dur: 0.9, attack: 0.04, curve: 1.2, lowpass: 900, tremolo: 0.3, tremoloRate: 24, vol: 0.5, seed: 41 },
    crackles(85, 0.85, 0.28, { highpass: 1800, seed: 42 }),
  ],
  { poly: 3, priority: 2 },
);

sfx(
  'out_of_ammo',
  [
    click(1.0, { bandpass: 3000, dur: 0.018 }),
    blip(1250, 0.025, 0.12, { curve: 3 }),
    click(0.9, { delay: 0.075, bandpass: 2400, dur: 0.018, seed: 51 }),
    blip(1000, 0.025, 0.1, { curve: 3, delay: 0.075 }),
  ],
  { poly: 1, priority: 2 },
);

sfx(
  'grenade_bounce',
  [{ wave: 'triangle', freq: 830, freqEnd: 690, dur: 0.08, attack: 0.0008, curve: 2.4, vol: 0.38 }, ping(1950, 0.07, 0.12), click(0.22, { bandpass: 2600 })],
  { poly: 3, gain: 0.9 },
);

sfx(
  'shell_casing',
  [ping(5200, 0.06, 0.11, { fm: 1.4, fmRatio: 2.76, fmEnd: 0.2 }), ping(4700, 0.05, 0.065, { delay: 0.075, fm: 1.2, fmRatio: 2.76, fmEnd: 0.2 }), ping(4400, 0.04, 0.035, { delay: 0.13, fm: 1, fmRatio: 2.76 })],
  { poly: 3, priority: 0, gain: 0.8 },
);
