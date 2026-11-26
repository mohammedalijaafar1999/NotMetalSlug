// Baseline sound effects (the audio module may redefine any of these with richer versions).
import { audio } from '../../engine/audio';

const def = (name: string, d: Parameters<typeof audio.defineSfx>[1]) => {
  if (!audio.hasSfx(name)) audio.defineSfx(name, d);
};

def('pistol', [
  { wave: 'noise', freq: 9000, freqEnd: 1500, dur: 0.09, vol: 0.45, lowpass: 7000 },
  { wave: 'square', freq: 420, freqEnd: 120, dur: 0.07, vol: 0.25, duty: 0.3 },
]);
def('hmg', [
  { wave: 'noise', freq: 7000, freqEnd: 900, dur: 0.07, vol: 0.5, lowpass: 5000 },
  { wave: 'square', freq: 220, freqEnd: 70, dur: 0.06, vol: 0.3 },
]);
def('knife', [{ wave: 'noise', freq: 12000, freqEnd: 3000, dur: 0.12, vol: 0.3, highpass: 2000 }]);
def('throw', [{ wave: 'noise', freq: 3000, freqEnd: 9000, dur: 0.12, vol: 0.18, highpass: 1500 }]);
def('jump', [{ wave: 'square', freq: 260, freqEnd: 520, dur: 0.09, vol: 0.12, duty: 0.25 }]);
def('land', [{ wave: 'noise', freq: 1200, freqEnd: 300, dur: 0.06, vol: 0.18, lowpass: 1500 }]);
def('grenade_bounce', [{ wave: 'triangle', freq: 600, freqEnd: 300, dur: 0.05, vol: 0.2 }]);
def('explosion_small', [{ wave: 'noise', freq: 3000, freqEnd: 200, dur: 0.35, vol: 0.6, lowpass: 3000, lowpassEnd: 300 }]);
def('explosion', [
  { wave: 'noise', freq: 2500, freqEnd: 120, dur: 0.6, vol: 0.8, lowpass: 2500, lowpassEnd: 200 },
  { wave: 'sine', freq: 90, freqEnd: 35, dur: 0.4, vol: 0.6 },
]);
def('explosion_big', [
  { wave: 'noise', freq: 2000, freqEnd: 80, dur: 1.1, vol: 0.9, lowpass: 2200, lowpassEnd: 120 },
  { wave: 'sine', freq: 70, freqEnd: 25, dur: 0.8, vol: 0.8 },
]);
def('player_die', [{ wave: 'square', freq: 700, freqEnd: 90, dur: 0.5, vol: 0.25, duty: 0.4, vibrato: 1, vibratoRate: 12 }]);
def('enemy_die', [{ wave: 'saw', freq: 520, freqEnd: 160, dur: 0.3, vol: 0.18, vibrato: 0.6, vibratoRate: 18, lowpass: 2500 }]);
def('enemy_rifle', [{ wave: 'noise', freq: 6000, freqEnd: 900, dur: 0.1, vol: 0.32, lowpass: 4000 }]);
def('pickup', [{ wave: 'square', freq: 660, dur: 0.16, vol: 0.18, arp: [0, 4, 7, 12], arpRate: 0.04, duty: 0.25 }]);
def('pickup_weapon', [{ wave: 'square', freq: 520, dur: 0.24, vol: 0.2, arp: [0, 7, 12, 19], arpRate: 0.05 }]);
def('pickup_points', [{ wave: 'square', freq: 1046, dur: 0.12, vol: 0.15, arp: [0, 12], arpRate: 0.05, duty: 0.125 }]);
def('extra_life', [{ wave: 'square', freq: 523, dur: 0.5, vol: 0.2, arp: [0, 4, 7, 12, 16, 19, 24], arpRate: 0.06 }]);
def('rescue', [{ wave: 'triangle', freq: 784, dur: 0.3, vol: 0.3, arp: [0, 5, 9, 12], arpRate: 0.07 }]);
def('coin', [{ wave: 'square', freq: 988, dur: 0.25, vol: 0.18, arp: [0, 5], arpRate: 0.08, duty: 0.25 }]);
def('out_of_ammo', [{ wave: 'square', freq: 300, freqEnd: 200, dur: 0.15, vol: 0.15 }]);
def('menu_move', [{ wave: 'square', freq: 880, dur: 0.04, vol: 0.1, duty: 0.125 }]);
def('menu_select', [{ wave: 'square', freq: 660, dur: 0.12, vol: 0.14, arp: [0, 7, 12], arpRate: 0.035 }]);
def('menu_back', [{ wave: 'square', freq: 440, freqEnd: 330, dur: 0.1, vol: 0.12 }]);
def('pause', [{ wave: 'square', freq: 880, dur: 0.2, vol: 0.14, arp: [0, -5, 0, -5], arpRate: 0.05, duty: 0.25 }]);
def('tally_bonus', [{ wave: 'square', freq: 1320, dur: 0.4, vol: 0.14, repeat: 0.05, duty: 0.25 }]);
def('vehicle_enter', [{ wave: 'square', freq: 200, freqEnd: 600, dur: 0.25, vol: 0.2 }]);
def('vehicle_hit', [{ wave: 'metal', freq: 300, freqEnd: 120, dur: 0.12, vol: 0.3 }]);
def('alarm', [{ wave: 'square', freq: 880, dur: 0.8, vol: 0.18, arp: [0, -12], arpRate: 0.1 }]);
def('boss_die', [{ wave: 'noise', freq: 1500, freqEnd: 60, dur: 1.5, vol: 0.9, lowpass: 2000, lowpassEnd: 100 }]);
