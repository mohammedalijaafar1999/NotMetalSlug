// Audio: procedural sound effects (rendered offline into AudioBuffers), a chiptune
// music sequencer (scheduled with WebAudio oscillators) and an announcer voice
// (Web Speech API). Everything is a silent no-op when WebAudio is unavailable (tests).
//
//   audio.defineSfx('pistol', [{ wave: 'noise', freq: 6000, freqEnd: 800, dur: 0.08, vol: 0.4 }, ...]);
//   audio.play('pistol', { vol: 0.8, pitch: 1.05, pan: -0.2 });
//   audio.defineSong('m1', { bpm: 140, channels: [{ inst: 'pulse', notes: 'C4 E4 G4 C5' }, ...] });
//   audio.playMusic('m1');
//   audio.say('Heavy machine gun!');

export type Wave = 'square' | 'saw' | 'triangle' | 'sine' | 'noise' | 'metal';

export interface SfxLayer {
  wave?: Wave;
  /** Start frequency in Hz (for noise: sample-and-hold rate). */
  freq?: number;
  /** End frequency (glides over the whole layer, exponential). */
  freqEnd?: number;
  /** Seconds. Default 0.2 */
  dur?: number;
  attack?: number;
  /** Seconds held at full volume after attack. */
  hold?: number;
  /** Seconds of fade-out after hold (default: rest of dur). */
  decay?: number;
  /** 0..1, default 0.5 */
  vol?: number;
  /** Square duty cycle 0..1 (default 0.5). */
  duty?: number;
  /** Vibrato depth in semitones and rate in Hz. */
  vibrato?: number;
  vibratoRate?: number;
  /** One-pole low-pass cutoff Hz (and optional end cutoff). */
  lowpass?: number;
  lowpassEnd?: number;
  /** One-pole high-pass cutoff Hz. */
  highpass?: number;
  /** Start offset of this layer in seconds. */
  delay?: number;
  /** Arpeggio: semitone offsets cycled every arpRate seconds. */
  arp?: number[];
  arpRate?: number;
  /** Bit-crush quantization levels (e.g. 6). */
  crush?: number;
  /** Amplitude tremolo depth 0..1 and rate Hz. */
  tremolo?: number;
  tremoloRate?: number;
  /** Retrigger the envelope every `repeat` seconds (machine-gun / rattles). */
  repeat?: number;
}

export type SfxDef = SfxLayer | SfxLayer[];

export interface PlayOpts {
  vol?: number;
  /** Playback rate multiplier (1 = normal). */
  pitch?: number;
  /** Random pitch variation (e.g. 0.08 = +-8%). */
  pitchVar?: number;
  /** -1 (left) .. 1 (right). */
  pan?: number;
}

export type Instrument = 'pulse' | 'pulse25' | 'pulse12' | 'triangle' | 'saw' | 'sine' | 'drums' | 'noise';

export interface SongChannel {
  inst: Instrument;
  /**
   * Whitespace separated tokens, one per step (16th note by default):
   *   C4, F#3, Bb5   note (optionally with ':N' length in steps, e.g. C4:4)
   *   -              extend previous note by one step
   *   .              rest
   *   |              ignored (bar line for readability)
   *   (a b c)*4      repeat group
   * Drum channel tokens: k kick, s snare, h hat, o open hat, c crash, t hi tom, T low tom, combine with '+': k+h
   */
  notes: string;
  vol?: number;
  /** Octave transpose. */
  oct?: number;
  /** Envelope (seconds; s = sustain level 0..1). */
  env?: { a?: number; d?: number; s?: number; r?: number };
  /** Detune in cents. */
  detune?: number;
  /** Vibrato depth in cents. */
  vibrato?: number;
}

export interface Song {
  bpm: number;
  /** Steps per beat (default 4 = 16th notes). */
  steps?: number;
  /** Loop the song (default true). */
  loop?: boolean;
  channels: SongChannel[];
}

interface ParsedEvent {
  step: number;
  len: number;
  midi: number; // -1 for drum event
  drums?: string[];
}

interface ParsedChannel {
  ch: SongChannel;
  events: ParsedEvent[];
  length: number;
}

interface ChannelCursor {
  idx: number;
  loop: number;
  done: boolean;
}

/** Expand '(a b)*3' groups (innermost first). */
export function expandRepeats(src: string): string {
  let s = src;
  const re = /\(([^()]*)\)\s*\*\s*(\d+)/;
  for (let guard = 0; guard < 1000; guard++) {
    const m = re.exec(s);
    if (!m) break;
    const rep = Array(parseInt(m[2], 10)).fill(m[1]).join(' ');
    s = s.slice(0, m.index) + ' ' + rep + ' ' + s.slice(m.index + m[0].length);
  }
  return s;
}

const NOTE_BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(tok: string): number | null {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  let n = NOTE_BASE[m[1].toUpperCase()];
  if (m[2] === '#') n++;
  if (m[2] === 'b') n--;
  return (parseInt(m[3], 10) + 1) * 12 + n;
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Parse a channel's token string into events. Throws on malformed tokens. */
export function parseChannel(ch: SongChannel): ParsedChannel {
  const tokens = expandRepeats(ch.notes)
    .split(/\s+/)
    .filter((t) => t && t !== '|');
  const events: ParsedEvent[] = [];
  let step = 0;
  let last: ParsedEvent | null = null;
  for (const tok of tokens) {
    let base = tok;
    let len = 1;
    const colon = tok.indexOf(':');
    if (colon > 0) {
      base = tok.slice(0, colon);
      len = Math.max(1, parseInt(tok.slice(colon + 1), 10) || 1);
    }
    if (base === '-') {
      if (last) last.len += len;
      step += len;
      continue;
    }
    if (base === '.') {
      last = null;
      step += len;
      continue;
    }
    if (ch.inst === 'drums' || ch.inst === 'noise') {
      const parts = base.split('+');
      for (const p of parts) if (!/^[kshoctT]$/.test(p)) throw new Error(`Bad drum token "${tok}"`);
      last = { step, len, midi: -1, drums: parts };
      events.push(last);
    } else {
      const midi = noteToMidi(base);
      if (midi === null) throw new Error(`Bad note token "${tok}"`);
      last = { step, len, midi: midi + (ch.oct ?? 0) * 12 };
      events.push(last);
    }
    step += len;
  }
  return { ch, events, length: Math.max(1, step) };
}

const MAX_VOICES = 28;

class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxDefs = new Map<string, SfxDef>();
  private buffers = new Map<string, AudioBuffer>();
  private songs = new Map<string, Song>();
  private lastPlayed = new Map<string, { t: number; n: number }>();
  private activeVoices = 0;
  private noiseBuf: AudioBuffer | null = null;
  private pulseWaves = new Map<number, PeriodicWave>();
  private schedTimer: ReturnType<typeof setInterval> | null = null;
  private current: {
    name: string;
    song: Song;
    parsed: ParsedChannel[];
    cursors: ChannelCursor[];
    start: number;
    stepDur: number;
    bus: GainNode;
  } | null = null;
  /** Name of the song currently playing (or requested before unlock). */
  currentSong: string | null = null;
  private pendingSong: string | null = null;
  volumes = { master: 0.8, music: 0.6, sfx: 0.8, voice: 0.9 };
  voiceEnabled = true;
  private ducked = false;
  muted = false;

  get available(): boolean {
    return typeof window !== 'undefined' && (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined');
  }

  /** Create/resume the AudioContext. Must be called from a user gesture. */
  unlock(): void {
    if (!this.available) return;
    if (!this.ctx) {
      try {
        const Ctor: typeof AudioContext = (window as any).AudioContext ?? (window as any).webkitAudioContext;
        this.ctx = new Ctor({ latencyHint: 'interactive' });
      } catch {
        this.ctx = null;
        return;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(comp);
      comp.connect(ctx.destination);
      this.applyVolumes();
      // Shared noise buffer for drums.
      const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = nb.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < d.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (seed / 0x7fffffff) * 2 - 1;
      }
      this.noiseBuf = nb;
      this.schedTimer = setInterval(() => this.schedule(), 25);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.pendingSong) {
      const s = this.pendingSong;
      this.pendingSong = null;
      this.playMusic(s);
    }
  }

  setVolumes(v: Partial<{ master: number; music: number; sfx: number; voice: number }>): void {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volumes.master, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * (this.ducked ? 0.35 : 1), t, 0.05);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolumes();
  }

  /** Lower the music (pause menus). */
  duck(on: boolean): void {
    this.ducked = on;
    this.applyVolumes();
  }

  // ---------------------------------------------------------------- SFX

  defineSfx(name: string, def: SfxDef): void {
    this.sfxDefs.set(name, def);
    this.buffers.delete(name);
  }

  hasSfx(name: string): boolean {
    return this.sfxDefs.has(name);
  }

  sfxNames(): string[] {
    return [...this.sfxDefs.keys()];
  }

  private warned = new Set<string>();

  play(name: string, opts: PlayOpts = {}): void {
    const def = this.sfxDefs.get(name);
    if (!def) {
      if (!this.warned.has(name)) {
        this.warned.add(name);
        console.warn(`[audio] unknown sfx "${name}"`);
      }
      return;
    }
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.muted) return;
    if (this.activeVoices >= MAX_VOICES) return;
    // Throttle identical sounds stacking in the same instant.
    const now = ctx.currentTime;
    const lp = this.lastPlayed.get(name);
    if (lp && now - lp.t < 0.035) {
      if (lp.n >= 2) return;
      lp.n++;
    } else {
      this.lastPlayed.set(name, { t: now, n: 1 });
    }
    let buf = this.buffers.get(name);
    if (!buf) {
      buf = renderSfx(ctx, def);
      this.buffers.set(name, buf);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    let rate = opts.pitch ?? 1;
    if (opts.pitchVar) rate *= 1 + (Math.random() * 2 - 1) * opts.pitchVar;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = Math.max(0, Math.min(2, opts.vol ?? 1));
    src.connect(g);
    let out: AudioNode = g;
    if (opts.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p);
      out = p;
    }
    out.connect(this.sfxBus);
    this.activeVoices++;
    src.onended = () => {
      this.activeVoices--;
      try {
        out.disconnect();
      } catch {
        /* ignore */
      }
    };
    src.start();
  }

  /** Pre-render all SFX buffers (avoid first-play hitches). */
  prerender(): void {
    if (!this.ctx) return;
    for (const [name, def] of this.sfxDefs) if (!this.buffers.has(name)) this.buffers.set(name, renderSfx(this.ctx, def));
  }

  // ---------------------------------------------------------------- Music

  defineSong(name: string, song: Song): void {
    // Validate eagerly so bad songs are caught by tests.
    song.channels.forEach((c) => parseChannel(c));
    this.songs.set(name, song);
  }

  hasSong(name: string): boolean {
    return this.songs.has(name);
  }

  songNames(): string[] {
    return [...this.songs.keys()];
  }

  getSong(name: string): Song | undefined {
    return this.songs.get(name);
  }

  playMusic(name: string, opts: { restart?: boolean; fadeIn?: number } = {}): void {
    if (this.currentSong === name && !opts.restart && (this.current || this.pendingSong === name)) return;
    const song = this.songs.get(name);
    this.currentSong = name;
    if (!song) {
      if (!this.warned.has('song:' + name)) {
        this.warned.add('song:' + name);
        console.warn(`[audio] unknown song "${name}"`);
      }
      this.stopMusic(0.2);
      this.currentSong = name;
      return;
    }
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) {
      this.pendingSong = name;
      return;
    }
    this.stopMusic(0.15, true);
    const bus = ctx.createGain();
    bus.connect(this.musicBus);
    const fadeIn = opts.fadeIn ?? 0;
    if (fadeIn > 0) {
      bus.gain.setValueAtTime(0.0001, ctx.currentTime);
      bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + fadeIn);
    }
    const parsed = song.channels.map((c) => parseChannel(c));
    this.current = {
      name,
      song,
      parsed,
      cursors: parsed.map(() => ({ idx: 0, loop: 0, done: false })),
      start: ctx.currentTime + 0.08,
      stepDur: 60 / song.bpm / (song.steps ?? 4),
      bus,
    };
    this.schedule();
  }

  stopMusic(fade = 0.3, keepName = false): void {
    if (!keepName) this.currentSong = null;
    this.pendingSong = null;
    const cur = this.current;
    this.current = null;
    if (!cur || !this.ctx) return;
    const t = this.ctx.currentTime;
    cur.bus.gain.cancelScheduledValues(t);
    cur.bus.gain.setValueAtTime(cur.bus.gain.value, t);
    cur.bus.gain.linearRampToValueAtTime(0, t + Math.max(0.01, fade));
    setTimeout(() => {
      try {
        cur.bus.disconnect();
      } catch {
        /* ignore */
      }
    }, (fade + 0.5) * 1000);
  }

  private schedule(): void {
    const cur = this.current;
    const ctx = this.ctx;
    if (!cur || !ctx) return;
    const horizon = ctx.currentTime + 0.18;
    const loop = cur.song.loop !== false;
    let allDone = true;
    cur.parsed.forEach((pc, ci) => {
      const c = cur.cursors[ci];
      if (c.done) return;
      allDone = false;
      for (let guard = 0; guard < 256; guard++) {
        if (pc.events.length === 0) {
          c.done = true;
          break;
        }
        const ev = pc.events[c.idx];
        const t = cur.start + (c.loop * pc.length + ev.step) * cur.stepDur;
        if (t > horizon) break;
        if (t >= ctx.currentTime - 0.05) this.playEvent(pc.ch, ev, t, ev.len * cur.stepDur, cur.bus);
        c.idx++;
        if (c.idx >= pc.events.length) {
          c.idx = 0;
          c.loop++;
          if (!loop) {
            c.done = true;
            break;
          }
        }
      }
    });
    if (allDone && !loop) {
      // Song finished.
    }
  }

  private pulseWave(duty: number): PeriodicWave {
    const key = Math.round(duty * 1000);
    let w = this.pulseWaves.get(key);
    if (!w) {
      const n = 64;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let i = 1; i < n; i++) {
        real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
      }
      w = this.ctx!.createPeriodicWave(real, imag);
      this.pulseWaves.set(key, w);
    }
    return w;
  }

  private playEvent(ch: SongChannel, ev: ParsedEvent, t: number, len: number, bus: GainNode): void {
    const ctx = this.ctx!;
    const vol = (ch.vol ?? 0.5) * 0.32;
    if (ev.drums) {
      for (const d of ev.drums) this.playDrum(d, t, vol, bus);
      return;
    }
    const osc = ctx.createOscillator();
    switch (ch.inst) {
      case 'pulse':
        osc.type = 'square';
        break;
      case 'pulse25':
        osc.setPeriodicWave(this.pulseWave(0.25));
        break;
      case 'pulse12':
        osc.setPeriodicWave(this.pulseWave(0.125));
        break;
      case 'triangle':
        osc.type = 'triangle';
        break;
      case 'saw':
        osc.type = 'sawtooth';
        break;
      default:
        osc.type = 'sine';
    }
    osc.frequency.value = midiToFreq(ev.midi);
    if (ch.detune) osc.detune.value = ch.detune;
    if (ch.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = ch.vibrato;
      lfo.connect(lg);
      lg.connect(osc.detune);
      lfo.start(t + 0.08);
      lfo.stop(t + len + 0.5);
    }
    const env = ch.env ?? {};
    const a = env.a ?? 0.005;
    const d = env.d ?? 0.08;
    const s = env.s ?? (ch.inst === 'triangle' ? 1 : 0.6);
    const r = env.r ?? 0.04;
    const g = ctx.createGain();
    const peak = ch.inst === 'triangle' || ch.inst === 'sine' ? vol * 1.6 : ch.inst === 'saw' ? vol * 0.7 : vol;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * s, t + a, Math.max(0.001, d / 3));
    const end = t + Math.max(len, a + 0.01);
    g.gain.setTargetAtTime(0, end, Math.max(0.001, r / 3));
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(end + r * 3 + 0.02);
    osc.onended = () => {
      try {
        g.disconnect();
      } catch {
        /* ignore */
      }
    };
  }

  private playDrum(kind: string, t: number, vol: number, bus: GainNode): void {
    const ctx = this.ctx!;
    const noise = (dur: number, hp: number, lp: number, v: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f1 = ctx.createBiquadFilter();
      f1.type = 'highpass';
      f1.frequency.value = hp;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = lp;
      const g = ctx.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      src.connect(f1);
      f1.connect(f2);
      f2.connect(g);
      g.connect(bus);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.02);
      src.onended = () => {
        try {
          g.disconnect();
        } catch {
          /* ignore */
        }
      };
    };
    const tone = (f0: number, f1: number, dur: number, v: number, type: OscillatorType = 'sine') => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + dur + 0.02);
      o.onended = () => {
        try {
          g.disconnect();
        } catch {
          /* ignore */
        }
      };
    };
    switch (kind) {
      case 'k':
        tone(160, 42, 0.16, vol * 2.4);
        break;
      case 's':
        noise(0.14, 900, 9000, vol * 1.5);
        tone(220, 140, 0.07, vol * 0.9, 'triangle');
        break;
      case 'h':
        noise(0.035, 7000, 16000, vol * 0.7);
        break;
      case 'o':
        noise(0.22, 6000, 15000, vol * 0.6);
        break;
      case 'c':
        noise(0.9, 3500, 14000, vol * 0.9);
        break;
      case 't':
        tone(260, 130, 0.16, vol * 1.6);
        break;
      case 'T':
        tone(150, 75, 0.2, vol * 1.8);
        break;
    }
  }

  // ---------------------------------------------------------------- Voice

  private voice: SpeechSynthesisVoice | null = null;
  private voicesLoaded = false;

  private pickVoice(): void {
    if (typeof speechSynthesis === 'undefined') return;
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return;
    this.voicesLoaded = true;
    const en = vs.filter((v) => /^en/i.test(v.lang));
    const prefer = ['Google UK English Male', 'Daniel', 'Alex', 'Fred', 'David', 'Microsoft David', 'Male', 'Arthur', 'Rishi'];
    for (const p of prefer) {
      const v = en.find((x) => x.name.includes(p));
      if (v) {
        this.voice = v;
        return;
      }
    }
    this.voice = en[0] ?? vs[0];
  }

  /** Announcer voice line (e.g. weapon pickups, "Mission complete!"). */
  say(text: string, opts: { pitch?: number; rate?: number } = {}): void {
    if (!this.voiceEnabled || this.muted || typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      if (!this.voicesLoaded) this.pickVoice();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.pitch = opts.pitch ?? 0.55;
      u.rate = opts.rate ?? 1.0;
      u.volume = Math.max(0, Math.min(1, this.volumes.voice * this.volumes.master));
      speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }
}

// ------------------------------------------------------------------ SFX renderer

/** Render an SfxDef into raw samples (exported for tests). */
export function renderSfxSamples(def: SfxDef, sampleRate: number): Float32Array {
  const layers = Array.isArray(def) ? def : [def];
  let total = 0;
  for (const l of layers) total = Math.max(total, (l.delay ?? 0) + (l.dur ?? 0.2));
  const n = Math.max(1, Math.ceil(total * sampleRate) + 8);
  const out = new Float32Array(n);
  for (const l of layers) renderLayer(l, out, sampleRate);
  // Soft clip.
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * 1.2);
  // Tiny fade at the end to avoid clicks.
  const fade = Math.min(n, Math.floor(sampleRate * 0.004));
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

function renderLayer(l: SfxLayer, out: Float32Array, sr: number): void {
  const wave = l.wave ?? 'square';
  const dur = l.dur ?? 0.2;
  const attack = Math.max(0.0005, l.attack ?? 0.002);
  const hold = l.hold ?? 0;
  const decay = l.decay ?? Math.max(0.001, dur - attack - hold);
  const vol = l.vol ?? 0.5;
  const f0 = l.freq ?? 440;
  const f1 = l.freqEnd ?? f0;
  const duty = l.duty ?? 0.5;
  const start = Math.floor((l.delay ?? 0) * sr);
  const len = Math.floor(dur * sr);
  let phase = 0;
  let noiseVal = 0;
  let noisePhase = 1;
  let seed = 0x1234567 ^ Math.floor(f0 * 7);
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };
  const metal = new Float32Array(32);
  for (let i = 0; i < 32; i++) metal[i] = rnd() > 0 ? 1 : -1;
  let lp = 0;
  let hpPrev = 0;
  let hpOut = 0;
  const repeat = l.repeat ?? 0;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= out.length) break;
    const t = i / sr;
    const k = dur > 0 ? t / dur : 0;
    // Frequency (exponential glide).
    let f = f0 * Math.pow(f1 / f0, k);
    if (l.arp && l.arp.length) {
      const step = Math.floor(t / (l.arpRate ?? 0.05)) % l.arp.length;
      f *= Math.pow(2, l.arp[step] / 12);
    }
    if (l.vibrato) f *= Math.pow(2, (l.vibrato * Math.sin(2 * Math.PI * (l.vibratoRate ?? 6) * t)) / 12);
    // Envelope.
    const et = repeat > 0 ? t % repeat : t;
    let env: number;
    if (et < attack) env = et / attack;
    else if (et < attack + hold) env = 1;
    else {
      const d = (et - attack - hold) / (repeat > 0 ? Math.min(decay, repeat - attack - hold) || decay : decay);
      env = d >= 1 ? 0 : (1 - d) * (1 - d);
    }
    if (l.tremolo) env *= 1 - l.tremolo * (0.5 + 0.5 * Math.sin(2 * Math.PI * (l.tremoloRate ?? 12) * t));
    // Oscillator.
    phase += f / sr;
    let s: number;
    switch (wave) {
      case 'square':
        s = phase % 1 < duty ? 1 : -1;
        break;
      case 'saw':
        s = 2 * (phase % 1) - 1;
        break;
      case 'triangle': {
        const p = phase % 1;
        s = p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
        break;
      }
      case 'sine':
        s = Math.sin(2 * Math.PI * phase);
        break;
      case 'metal':
        s = metal[Math.floor(phase * 32) & 31];
        break;
      case 'noise':
      default:
        noisePhase += f / sr;
        if (noisePhase >= 1) {
          noisePhase -= Math.floor(noisePhase);
          noiseVal = rnd();
        }
        s = noiseVal;
        break;
    }
    if (l.crush) s = Math.round(s * l.crush) / l.crush;
    // Filters.
    if (l.lowpass) {
      const cut = l.lowpassEnd !== undefined ? l.lowpass * Math.pow(l.lowpassEnd / l.lowpass, k) : l.lowpass;
      const a = 1 - Math.exp((-2 * Math.PI * Math.min(cut, sr * 0.45)) / sr);
      lp += a * (s - lp);
      s = lp;
    }
    if (l.highpass) {
      const rc = 1 / (2 * Math.PI * l.highpass);
      const a = rc / (rc + 1 / sr);
      hpOut = a * (hpOut + s - hpPrev);
      hpPrev = s;
      s = hpOut;
    }
    out[idx] += s * env * vol;
  }
}

function renderSfx(ctx: AudioContext, def: SfxDef): AudioBuffer {
  const samples = renderSfxSamples(def, ctx.sampleRate);
  const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buf.getChannelData(0).set(samples);
  return buf;
}

export const audio = new AudioEngine();
