// Audio contract: every canonical SFX and song exists and is well-formed; music is in sync,
// long enough, in sensible ranges and harmonically consistent; the engine is a no-op in Node.
import { describe, expect, it } from 'vitest';
import '../src/content/index';
import { audio, parseChannel, renderSfxSamples, songDuration, songLengthSteps, songLoopDuration, type Song } from '../src/engine/audio';
import { JINGLES, SFX_CATEGORIES, SFX_NAMES, SONG_NAMES } from '../src/content/sfx/canonical';
import { arpLine, bassLine, chord, padLine, powerLine, prog, SONG_CHORDS, SongBuilder, transpose } from '../src/content/music/lib';

const SR = 22050;
const render = (name: string) => renderSfxSamples(audio.getSfx(name)!, SR);
const peak = (s: Float32Array) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
/** Loudest 50 ms RMS window x playback gain: a simple loudness proxy. */
function loudness(name: string): number {
  const s = render(name);
  const win = Math.floor(0.05 * SR);
  let best = 0;
  for (let i = 0; i + win <= s.length; i += win >> 1) {
    let e = 0;
    for (let j = 0; j < win; j++) e += s[i + j] * s[i + j];
    best = Math.max(best, Math.sqrt(e / win));
  }
  if (s.length < win) best = Math.sqrt(s.reduce((a, v) => a + v * v, 0) / s.length);
  return best * audio.sfxOptions(name).gain;
}

describe('sfx contract', () => {
  it('covers the canonical list from docs/DESIGN.md (87 sounds)', () => {
    expect(SFX_NAMES.length).toBe(87);
    expect(new Set(SFX_NAMES).size).toBe(SFX_NAMES.length);
    const missing = SFX_NAMES.filter((n) => !audio.hasSfx(n));
    expect(missing).toEqual([]);
  });

  for (const name of SFX_NAMES) {
    it(`${name} renders finite, audible, clip-free samples`, () => {
      const s = render(name);
      const dur = s.length / SR;
      expect(s.every((v) => Number.isFinite(v))).toBe(true);
      expect(peak(s)).toBeGreaterThan(0.05);
      expect(peak(s)).toBeLessThanOrEqual(1);
      expect(dur).toBeGreaterThan(0.005);
      expect(dur).toBeLessThan(2.2);
      const o = audio.sfxOptions(name);
      expect(o.poly).toBeGreaterThanOrEqual(1);
      expect(o.gain).toBeGreaterThan(0);
      expect(o.gain).toBeLessThanOrEqual(2);
    });
  }

  it('keeps most sounds short and only big events long', () => {
    const long = SFX_NAMES.filter((n) => render(n).length / SR > 0.95);
    for (const n of long) expect(['explosion_big', 'boss_die', 'boss_roar', 'boss_laser', 'warning', 'jet_flyby', 'mortar_whistle', 'start_game'], n).toContain(n);
    const short = SFX_NAMES.filter((n) => render(n).length / SR < 0.6);
    expect(short.length / SFX_NAMES.length).toBeGreaterThan(0.6);
  });

  it('explosions scale clearly from small to big', () => {
    const d = ['explosion_small', 'explosion', 'explosion_big'].map((n) => render(n).length / SR);
    expect(d[0]).toBeLessThan(d[1]);
    expect(d[1]).toBeLessThan(d[2]);
    expect(d[2]).toBeLessThanOrEqual(1.6);
    expect(loudness('explosion_small')).toBeLessThan(loudness('explosion'));
    expect(loudness('explosion')).toBeLessThan(loudness('explosion_big'));
  });

  it('balances loudness: UI quiet, explosions loud, rapid-fire guns moderate', () => {
    const ui = SFX_CATEGORIES.ui.map(loudness);
    const booms = ['explosion', 'explosion_big', 'boss_die'].map(loudness);
    expect(Math.max(...ui)).toBeLessThan(Math.min(...booms) * 0.5);
    for (const gun of ['hmg', 'vehicle_vulcan', 'heli_gun', 'pistol']) expect(loudness(gun), gun).toBeLessThan(loudness('explosion_small'));
    expect(loudness('hmg')).toBeLessThanOrEqual(loudness('pistol') * 1.15);
    for (const quiet of ['typewriter', 'menu_move', 'tally_tick', 'shell_casing', 'jump']) expect(loudness(quiet), quiet).toBeLessThan(0.12);
  });

  it('two different enemy death yelps', () => {
    const a = render('enemy_die');
    const b = render('enemy_die2');
    expect(a.length).not.toBe(b.length);
  });

  it('authoritative definitions win over later placeholders', () => {
    const before = audio.getSfx('pistol');
    audio.defineSfx('pistol', [{ wave: 'square', freq: 100, dur: 0.05 }]);
    expect(audio.getSfx('pistol')).toBe(before);
  });
});

describe('music contract', () => {
  it('defines every canonical song', () => {
    expect(SONG_NAMES.filter((n) => !audio.hasSong(n))).toEqual([]);
  });

  const RANGE: Record<string, [number, number]> = {
    lead: [55, 88], // G3 .. E6
    counter: [43, 84], // G2 .. C6
    harmony: [43, 84],
    bass: [28, 60], // E1 .. C4
  };

  for (const name of SONG_NAMES) {
    describe(name, () => {
      const song = audio.getSong(name) as Song;
      it('parses into >= 3 channels whose lengths divide the song length', () => {
        expect(song).toBeTruthy();
        expect(song.channels.length).toBeGreaterThanOrEqual(3);
        const total = songLengthSteps(song);
        for (const c of song.channels) {
          const len = parseChannel(c).length;
          expect(total % len, `${name} ${c.role} ${c.inst} length ${len} vs ${total}`).toBe(0);
        }
        expect(song.channels.some((c) => c.inst === 'drums' || c.inst === 'noise')).toBe(true);
        expect(song.channels.some((c) => c.role === 'lead')).toBe(true);
        expect(song.channels.some((c) => c.role === 'bass')).toBe(true);
      });

      if (JINGLES.includes(name)) {
        it('is a non-looping jingle of about 4 seconds', () => {
          expect(song.loop).toBe(false);
          const d = songDuration(song);
          expect(d).toBeGreaterThan(3);
          expect(d).toBeLessThan(6);
        });
      } else {
        it('loops for at least 30 s before repeating', () => {
          expect(song.loop).not.toBe(false);
          expect(songLoopDuration(song)).toBeGreaterThanOrEqual(30);
          const ls = song.loopStart ?? 0;
          const total = songLengthSteps(song);
          expect(ls).toBeLessThan(total);
          for (const c of song.channels) {
            const len = parseChannel(c).length;
            if (len < total) expect((total - ls) % len).toBe(0);
          }
        });
      }

      it('keeps every role in a sensible register', () => {
        for (const c of song.channels) {
          const r = RANGE[c.role ?? ''];
          if (!r) continue;
          for (const e of parseChannel(c).events)
            for (const m of e.chord ?? [e.midi]) {
              expect(m, `${name} ${c.role} note ${m}`).toBeGreaterThanOrEqual(r[0]);
              expect(m, `${name} ${c.role} note ${m}`).toBeLessThanOrEqual(r[1]);
            }
        }
      });

      it('writes the melody over its chord progression (strong beats are mostly chord tones)', () => {
        const chords = SONG_CHORDS[name];
        expect(chords?.length, 'chord timeline').toBeGreaterThan(0);
        const spb = song.steps ?? 4;
        const lead = song.channels.filter((c) => c.role === 'lead');
        let strong = 0;
        let ok = 0;
        for (const c of lead)
          for (const e of parseChannel(c).events) {
            if (e.step % (2 * spb) !== 0) continue; // beats 1 and 3
            const ch = chords.find((x) => e.step >= x.step && e.step < x.step + x.len);
            if (!ch) continue;
            strong++;
            if (ch.pcs.includes(((e.midi % 12) + 12) % 12)) ok++;
          }
        expect(strong).toBeGreaterThan(0);
        expect(ok / strong).toBeGreaterThanOrEqual(0.75);
      });
    });
  }

  it('uses varied instrumentation across songs', () => {
    const leads = new Set(SONG_NAMES.map((n) => audio.getSong(n)!.channels.find((c) => c.role === 'lead')!.inst));
    expect(leads.size).toBeGreaterThanOrEqual(7);
    const all = new Set(SONG_NAMES.flatMap((n) => audio.getSong(n)!.channels.map((c) => c.inst)));
    expect(all.size).toBeGreaterThanOrEqual(14);
  });

  it('the ending reprises the title theme a whole step higher', () => {
    const lead = (n: string) => parseChannel(audio.getSong(n)!.channels.find((c) => c.role === 'lead')!).events;
    const t = lead('title').filter((e) => e.step >= 64 && e.step < 64 + 16 * 4);
    const e = lead('ending').filter((x) => x.step >= 64 && x.step < 64 + 16 * 4);
    expect(e.map((x) => x.midi)).toEqual(t.map((x) => x.midi + 2));
  });
});

describe('sequencer token extensions', () => {
  it('parses chords, accents and per-part drum accents', () => {
    const ch = parseChannel({ inst: 'pulse', notes: 'C4+E4+G4:4 D4! E4? -' });
    expect(ch.length).toBe(7);
    expect(ch.events[0].chord).toEqual([60, 64, 67]);
    expect(ch.events[0].len).toBe(4);
    expect(ch.events[1].vel).toBeGreaterThan(1);
    expect(ch.events[2].vel).toBeLessThan(1);
    expect(ch.events[2].len).toBe(2);
    const dr = parseChannel({ inst: 'drums', notes: 'k+s!+x? p r m b' });
    expect(dr.events[0].drums).toEqual(['k', 's', 'x']);
    expect(dr.events[0].drumVel).toEqual([1, 1.35, 0.45]);
    expect(dr.events.length).toBe(5);
    expect(() => parseChannel({ inst: 'drums', notes: 'k+q' })).toThrow();
    expect(() => parseChannel({ inst: 'pulse', notes: 'C4+H4' })).toThrow();
  });

  it('computes durations and loop lengths', () => {
    const s: Song = { bpm: 120, loopStart: 16, channels: [{ inst: 'pulse', notes: 'C4:16 D4:16' }, { inst: 'drums', notes: 'k . . .' }] };
    expect(songLengthSteps(s)).toBe(32);
    expect(songDuration(s)).toBeCloseTo(4);
    expect(songLoopDuration(s)).toBeCloseTo(2);
  });
});

describe('composition helpers', () => {
  it('parses chord symbols', () => {
    expect(chord('F#m7b5').tones).toEqual([0, 3, 6, 10]);
    expect(chord('A/C#')).toMatchObject({ root: 9, bass: 1 });
    expect(chord('Bbmaj7').root).toBe(10);
    expect(() => chord('H7')).toThrow();
    expect(prog('C Am:8 F:8').map((c) => c.len)).toEqual([16, 8, 8]);
  });

  it('generates bass lines, arpeggios, pads and riffs that fit the chords', () => {
    const p = prog('C G/B Am F');
    const bass = parseChannel({ inst: 'bass', notes: bassLine(p, 'R:4 5:4 8:4 A:4', { lo: 36 }) });
    expect(bass.length).toBe(64);
    expect(bass.events.slice(0, 4).map((e) => e.midi)).toEqual([36, 43, 48, 46]); // C2 G2 C3, then Bb2 approaching B2
    expect(bass.events[4].midi).toBe(47); // slash bass B2
    const arp = parseChannel({ inst: 'pulse', notes: arpLine(p, '0 1 2 3', { lo: 60 }) });
    expect(arp.length).toBe(64);
    for (const e of arp.events.slice(0, 16)) expect([0, 4, 7]).toContain(e.midi % 12);
    const pad = parseChannel({ inst: 'strings', notes: padLine(p, { lo: 55 }) });
    for (let i = 1; i < pad.events.length; i++) {
      const a = pad.events[i - 1].chord!;
      const b = pad.events[i].chord!;
      const move = a.reduce((s, m, k) => s + Math.abs(m - b[k]), 0);
      expect(move).toBeLessThanOrEqual(9); // voice-led, no big jumps
    }
    const riff = parseChannel({ inst: 'guitar', notes: powerLine(prog('E5'), 'P:8 Q:8', { lo: 40 }) });
    expect(riff.events[0].chord).toEqual([40, 47, 52]);
    expect(riff.events[1].chord).toEqual([41, 48, 53]);
    expect(transpose('C4:2 (D4+F#4 E4)*2 Bb3!', 2)).toBe('D4:2 (E4+G#4 F#4)*2 C4!');
  });

  it('SongBuilder rejects sections whose channels are out of sync', () => {
    const b = new SongBuilder('test_song', { bpm: 120, title: 'T' }, { lead: { inst: 'pulse' }, drums: { inst: 'drums' } });
    expect(() => b.section('A', 1, { lead: 'C4:8' })).toThrow(/8 steps, expected 16/);
    expect(() => b.section('A', 1, { lead: 'C4:16' }, 'C:8')).toThrow(/chords/);
    const song = b.section('A', 1, { lead: 'C4:16', drums: 'k . . . s . . . k . . . s . . .' }, 'C').build();
    expect(song.channels.map((c) => parseChannel(c).length)).toEqual([16, 16]);
  });
});

describe('engine without WebAudio (Node)', () => {
  it('is a silent no-op', async () => {
    expect(audio.available).toBe(false);
    expect(() => {
      audio.unlock();
      audio.play('pistol', { vol: 0.5, pan: 0.3, pitchVar: 0.1 });
      audio.play('definitely_not_a_sound');
      audio.playMusic('title');
      audio.playMusic('m1', { fadeIn: 0.5, fadeOut: 1 });
      audio.duck(true);
      audio.duck(false);
      audio.setVolumes({ music: 0.5 });
      audio.setMuted(false);
      audio.say('Heavy machine gun!');
      audio.prerender();
      audio.stopMusic(0.2);
    }).not.toThrow();
    expect(audio.isMusicPlaying()).toBe(false);
    expect(await audio.renderSong('title', 1)).toBeNull();
  });
});

describe('music ducking', () => {
  it('nests: the tab becoming visible again does not un-duck an open pause menu', () => {
    expect(audio.isDucked).toBe(false);
    audio.duck(true); // pause menu opens
    audio.duck(true); // tab hidden
    audio.duck(false); // tab visible again
    expect(audio.isDucked).toBe(true);
    audio.duck(false); // pause menu closes
    expect(audio.isDucked).toBe(false);
    audio.duck(false); // a stray release never goes below zero
    audio.duck(true);
    expect(audio.isDucked).toBe(true);
    audio.duck(false);
    expect(audio.isDucked).toBe(false);
  });
});
