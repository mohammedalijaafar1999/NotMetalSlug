// Enemy sounds: cartoon death yelps (formant-filtered voices with pitch bends), enemy weapons
// (duller than the player's so they read as "incoming"), telegraphs and gadgets.

import { bark, blip, body, crack, crackles, gunshot, hiss, ping, rumble, sfx, thump, voice, whoosh } from './kit';

// "AAARGH!" - falling pitch, a -> o.
sfx(
  'enemy_die',
  [
    voice(390, 230, 0.46, 1.05, 'a', 'o', { hold: 0.1, glide: 0.42, vibrato: 0.7, vibratoRate: 9.5 }),
    { wave: 'noise', freq: 16000, bandpass: 1300, q: 1.2, dur: 0.3, attack: 0.01, curve: 1.6, vol: 0.06, seed: 101 },
  ],
  { poly: 3, priority: 2, gain: 0.65 },
);

// "YEE-OWW!" - a quick upward yelp that breaks and falls, i -> e -> u.
sfx(
  'enemy_die2',
  [
    voice(300, 500, 0.13, 0.95, 'i', 'e', { glide: 0.09, vibrato: 0.3, curve: 1.6, hold: 0.06 }),
    voice(500, 210, 0.42, 1.05, 'e', 'u', { delay: 0.1, glide: 0.36, attack: 0.012, vibrato: 0.9, vibratoRate: 11 }),
  ],
  { poly: 3, priority: 2, gain: 0.5 },
);

// Dull, mid-heavy "pok": clearly different from the player's crisp pistol.
sfx(
  'enemy_rifle',
  gunshot({ crack: 0.26, crackHp: 1300, crackDur: 0.02, bark: 1050, barkVol: 0.45, barkDur: 0.08, body: [210, 80], bodyVol: 0.32, bodyDur: 0.06, tail: 0.15, tailVol: 0.13, tailCut: 2400 }).map((l, i) =>
    i === 0 ? { ...l, lowpass: 6500 } : l,
  ),
  { poly: 4, gain: 1.2 },
);

// "Huh!?" plus a two-note exclamation blip.
sfx(
  'enemy_alert',
  [
    voice(210, 330, 0.17, 0.9, 'u', 'a', { glide: 0.15, vibrato: 0, attack: 0.01 }),
    blip(1318.5, 0.05, 0.12, { delay: 0.04, duty: 0.25 }),
    blip(1760, 0.09, 0.12, { delay: 0.1, duty: 0.25 }),
  ],
  { poly: 2, priority: 2 },
);

// Grunt "hup!" and a whoosh.
sfx(
  'enemy_throw',
  [voice(165, 130, 0.11, 0.75, 'u', 'a', { vibrato: 0, attack: 0.008 }), whoosh(450, 1500, 0.2, 0.28, { delay: 0.05, attack: 0.07 })],
  { poly: 3 },
);

// Bazooka launch: lower pop than the player's launcher, longer smoky whoosh.
sfx(
  'enemy_rocket',
  [crack(0.32, { dur: 0.02, highpass: 1000 }), thump(115, 48, 0.16, 0.5), whoosh(280, 1800, 0.6, 0.45, { attack: 0.05, q: 1 }), hiss(0.45, 0.1, { delay: 0.05 }), rumble(0.4, 0.18)],
  { poly: 3, gain: 0.85 },
);

// Flamethrower jet.
sfx(
  'enemy_flame',
  [
    { wave: 'noise', freq: 16000, bandpass: 900, bandpassEnd: 700, q: 0.8, dur: 0.42, attack: 0.05, curve: 1.3, tremolo: 0.3, tremoloRate: 35, vol: 0.45, seed: 111 },
    { wave: 'brown', dur: 0.42, attack: 0.04, curve: 1.3, lowpass: 650, vol: 0.32, seed: 112 },
    crackles(60, 0.4, 0.13, { highpass: 2500, seed: 113 }),
  ],
  { poly: 3 },
);

// Mortar tube "thoonk": hollow resonant pop.
sfx(
  'mortar_fire',
  [
    thump(270, 110, 0.2, 0.6, { glide: 0.06 }),
    body(1500, 300, 0.25, 0.35),
    crack(0.2, { highpass: 1500 }),
    { wave: 'noise', freq: 16000, bandpass: 520, q: 5, dur: 0.16, attack: 0.001, curve: 2, vol: 0.3, seed: 121 },
  ],
  { poly: 2, gain: 0.75 },
);

// Incoming shell: a falling whistle that swells (telegraph).
sfx(
  'mortar_whistle',
  [
    { wave: 'sine', freq: 1900, freqEnd: 620, dur: 1.1, attack: 0.35, hold: 0.45, curve: 1.2, vibrato: 0.12, vibratoRate: 7, vol: 0.24 },
    { wave: 'noise', freq: 18000, bandpass: 1900, bandpassEnd: 620, q: 5, dur: 1.1, attack: 0.35, hold: 0.45, curve: 1.2, vol: 0.08, seed: 122 },
  ],
  { poly: 2, priority: 2 },
);

// Sniper laser sight: a rising, pulsing tone (~1 s telegraph).
sfx(
  'sniper_charge',
  [
    { wave: 'square', duty: 0.125, freq: 620, freqEnd: 1560, dur: 0.92, attack: 0.55, hold: 0.27, decay: 0.1, tremolo: 0.7, tremoloRate: 13, lowpass: 5000, vol: 0.13 },
    { wave: 'sine', freq: 1240, freqEnd: 3120, dur: 0.92, attack: 0.6, hold: 0.22, decay: 0.1, vol: 0.06 },
  ],
  { poly: 2, priority: 2 },
);

// Sharp, loud crack with a long slap-back echo.
sfx(
  'sniper_shot',
  [
    ...gunshot({ crack: 0.8, crackHp: 2600, crackDur: 0.02, bark: 1800, barkVol: 0.5, barkDur: 0.06, body: [320, 75], bodyVol: 0.42, bodyDur: 0.08, tail: 0.65, tailVol: 0.22, tailCut: 4200 }),
    bark(1500, 0.16, 0.16, { delay: 0.19, seed: 131 }),
    body(2500, 400, 0.4, 0.09, { delay: 0.2, seed: 132 }),
  ],
  { poly: 2, priority: 2, gain: 1.25 },
);

// Saber slash: fast whoosh + metallic "shing".
sfx(
  'saber_swing',
  [whoosh(1500, 4200, 0.2, 0.36, { attack: 0.05, q: 2 }), ping(2700, 0.26, 0.11, { delay: 0.05, fm: 1.4, fmEnd: 0.1 }), ping(4050, 0.16, 0.05, { delay: 0.05, fm: 1, fmEnd: 0.1 })],
  { poly: 3 },
);

// Officer's pea whistle: "fweet - FWEEEET".
sfx(
  'whistle',
  [
    { wave: 'sine', freq: 2600, dur: 0.13, attack: 0.01, hold: 0.07, curve: 2, vibrato: 0.55, vibratoRate: 29, vol: 0.24 },
    { wave: 'sine', freq: 2650, dur: 0.48, delay: 0.17, attack: 0.015, hold: 0.32, curve: 2.5, vibrato: 0.6, vibratoRate: 27, vol: 0.28 },
    { wave: 'noise', freq: 18000, bandpass: 2650, q: 3, dur: 0.48, delay: 0.17, attack: 0.02, hold: 0.3, curve: 2, tremolo: 0.5, tremoloRate: 27, vol: 0.09, seed: 141 },
  ],
  { poly: 1, priority: 2 },
);

// Robot energy bolt "pew".
sfx(
  'robot_shot',
  [
    { wave: 'square', duty: 0.4, freq: 1600, freqEnd: 340, glide: 0.12, dur: 0.18, attack: 0.001, curve: 1.6, ring: 110, lowpass: 6000, vol: 0.25 },
    { wave: 'sine', freq: 820, freqEnd: 200, glide: 0.12, dur: 0.16, curve: 1.6, vol: 0.22 },
    crack(0.12, { highpass: 3000, dur: 0.012 }),
  ],
  { poly: 3, gain: 0.85 },
);

// Robot breakdown: electric fizz, a bit-crushed power-down and a pop.
sfx(
  'robot_die',
  [
    crackles(260, 0.36, 0.32, { highpass: 1500, lowpass: 9000, seed: 151 }),
    { wave: 'saw', freq: 430, freqEnd: 42, dur: 0.78, attack: 0.005, curve: 1.1, crush: 5, lowpass: 3000, vol: 0.28 },
    thump(125, 40, 0.22, 0.5, { delay: 0.05 }),
    body(2600, 220, 0.32, 0.4, { delay: 0.05, seed: 152 }),
    blip(1800, 0.06, 0.06, { arp: [0, 12, 0, 12], arpRate: 0.015 }),
  ],
  { poly: 2, priority: 2, gain: 0.85 },
);

// Jetpack thrust burst.
sfx(
  'jetpack',
  [
    { wave: 'noise', freq: 14000, lowpass: 1100, dur: 0.32, attack: 0.04, curve: 1.3, tremolo: 0.35, tremoloRate: 30, vol: 0.38, seed: 161 },
    rumble(0.32, 0.25, { attack: 0.04 }),
  ],
  { poly: 2, gain: 0.85 },
);

// Parachute opening: fabric "fwump" and flutter.
sfx(
  'parachute',
  [
    { wave: 'noise', freq: 14000, bandpass: 260, bandpassEnd: 520, q: 0.8, dur: 0.36, attack: 0.07, curve: 1.6, vol: 0.5, seed: 171 },
    { wave: 'noise', freq: 14000, bandpass: 1200, q: 1, dur: 0.3, attack: 0.05, curve: 1.4, tremolo: 0.8, tremoloRate: 18, vol: 0.14, seed: 172 },
  ],
  { poly: 2 },
);

// Harpoon: "thwip" plus a twanging line.
sfx(
  'harpoon',
  [
    whoosh(800, 3000, 0.12, 0.3, { attack: 0.02 }),
    { wave: 'saw', freq: 196, dur: 0.33, attack: 0.002, curve: 1.5, vibrato: 0.4, vibratoRate: 14, lowpass: 2600, lowpassEnd: 500, vol: 0.32 },
    crack(0.15, { highpass: 2000, dur: 0.015 }),
  ],
  { poly: 2 },
);

// Water splash: spray, a "bloop", then droplets.
sfx(
  'splash',
  [
    { wave: 'noise', freq: 18000, highpass: 600, lowpass: 6000, lowpassEnd: 1500, dur: 0.34, attack: 0.004, curve: 1.6, vol: 0.5, seed: 181 },
    thump(300, 80, 0.12, 0.3),
    crackles(85, 0.45, 0.28, { delay: 0.05, highpass: 1800, lowpass: 5000, seed: 182 }),
  ],
  { poly: 3, gain: 0.8 },
);
