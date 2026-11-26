// Audio: procedural sound effects (rendered offline into AudioBuffers), a chiptune
// music sequencer (scheduled with WebAudio nodes, with a stereo echo + reverb send) and an
// announcer voice (Web Speech API). Everything is a silent no-op when WebAudio is
// unavailable (Node tests).
//
//   audio.defineSfx('pistol', [{ wave: 'noise', freq: 6000, freqEnd: 800, dur: 0.08, vol: 0.4 }, ...], { poly: 4 });
//   audio.play('pistol', { vol: 0.8, pitch: 1.05, pan: -0.2 });
//   audio.defineSong('m1', { bpm: 140, channels: [{ inst: 'pulse', notes: 'C4 E4 G4 C5' }, ...] });
//   audio.playMusic('m1');            // crossfades from the current song
//   audio.say('Heavy machine gun!');  // music ducks while the announcer speaks
//
// Song token format (one token per step, 16th notes by default):
//   C4  F#3  Bb5          note; 'C4:4' = 4 steps long
//   C4+E4+G4              chord (played together, or as a fast chip arpeggio with channel `arp`)
//   C4!  C4?              accent / ghost note
//   -  (or -:N)           extend the previous note
//   .  (or .:N)           rest
//   |                     bar line (ignored)
//   (a b c)*4             repeat group
//   drums: k kick, s snare, h hat, o open hat, c crash, t hi tom, T low tom, p clap, r ride,
//          x woodblock, m metal clang, b bongo; combine with '+': 'k+h'; accents per part: 's!+x?'
//
// Song options (all optional): per-channel pan / reverb / echo sends, glide, chip arpeggio,
// cutoff, drive, vibrato rate & delay, role; per-song loopStart (intro plays once), swing,
// echo timing, reverb amount and gain. Non-looping songs (jingles) end cleanly, ring out and
// call `audio.onSongEnd`. SFX may set a per-sound polyphony cap / priority / gain via
// defineSfx's third argument.

export type Wave = 'square' | 'saw' | 'triangle' | 'sine' | 'noise' | 'metal' | 'brown' | 'crackle';

export interface SfxLayer {
  wave?: Wave;
  /** Start frequency in Hz (noise: sample-and-hold rate; crackle: pops per second). */
  freq?: number;
  /** End frequency (exponential glide over the layer, or over `glide` seconds). */
  freqEnd?: number;
  /** Seconds the frequency glide takes (default: the whole layer). */
  glide?: number;
  /** Seconds. Default 0.2 */
  dur?: number;
  attack?: number;
  /** Seconds held at full volume after attack. */
  hold?: number;
  /** Seconds of fade-out after hold (default: rest of dur). */
  decay?: number;
  /** Decay curve exponent (default 2; 1 = linear, higher = snappier). */
  curve?: number;
  /** 0..1, default 0.5 */
  vol?: number;
  /** Square duty cycle 0..1 (default 0.5). */
  duty?: number;
  /** Vibrato depth in semitones and rate in Hz. */
  vibrato?: number;
  vibratoRate?: number;
  /** Random pitch jitter (semitones) re-picked `jitterRate` times per second (growls, engines). */
  jitter?: number;
  jitterRate?: number;
  /** Low-pass cutoff Hz (and optional end cutoff). One-pole, or resonant 2-pole when `q` is set. */
  lowpass?: number;
  lowpassEnd?: number;
  /** One-pole high-pass cutoff Hz. */
  highpass?: number;
  /** Band-pass centre Hz (optional glide to bandpassEnd); width from `q` (default 2). */
  bandpass?: number;
  bandpassEnd?: number;
  /** Filter resonance for lowpass/bandpass. */
  q?: number;
  /** Formant filter: vowel 'a' | 'e' | 'i' | 'o' | 'u', optionally gliding to `vowelEnd`. */
  vowel?: string;
  vowelEnd?: string;
  /** Start offset of this layer in seconds. */
  delay?: number;
  /** Arpeggio: semitone offsets cycled every arpRate seconds. */
  arp?: number[];
  arpRate?: number;
  /** Bit-crush quantization levels (e.g. 6). */
  crush?: number;
  /** Saturation (tanh drive, e.g. 2..8). */
  drive?: number;
  /** Ring modulation frequency in Hz. */
  ring?: number;
  /** FM: modulator frequency ratio and modulation index (index glides to fmEnd). */
  fmRatio?: number;
  fm?: number;
  fmEnd?: number;
  /** Amplitude tremolo depth 0..1 and rate Hz. */
  tremolo?: number;
  tremoloRate?: number;
  /** Retrigger the envelope every `repeat` seconds (machine-gun / rattles). */
  repeat?: number;
  /** Seed for the noise generators (decorrelates otherwise identical layers). */
  seed?: number;
}

export type SfxDef = SfxLayer | SfxLayer[];

/** Per-sound playback policy (third argument of defineSfx). */
export interface SfxOptions {
  /** Max simultaneous voices of this sound; the oldest is cut when exceeded (default 4). */
  poly?: number;
  /** Voice-stealing priority when the global voice limit is reached (default 1, higher wins). */
  priority?: number;
  /** Playback gain multiplier (default 1). */
  gain?: number;
  /** Re-triggers closer than this (s) stack at most twice (default 0.035). */
  minGap?: number;
  /** Authoritative definition: later defineSfx calls for this name without `final` are ignored. */
  final?: boolean;
}

export interface PlayOpts {
  vol?: number;
  /** Playback rate multiplier (1 = normal). */
  pitch?: number;
  /** Random pitch variation (e.g. 0.08 = +-8%). */
  pitchVar?: number;
  /** -1 (left) .. 1 (right). */
  pan?: number;
}

export type Instrument =
  | 'pulse'
  | 'pulse25'
  | 'pulse12'
  | 'triangle'
  | 'saw'
  | 'sine'
  | 'drums'
  | 'noise'
  // Richer voices (all still synthesized with plain WebAudio nodes):
  | 'supersaw' // 3 detuned saws
  | 'strings' // detuned saw ensemble, slow attack, low-passed
  | 'brass' // saw through an enveloped low-pass
  | 'pluck' // twangy plucked pulse (filter decay)
  | 'bass' // punchy square+sine synth bass
  | 'bell' // inharmonic FM bell
  | 'steel' // steel-drum FM
  | 'organ' // drawbar organ
  | 'guitar' // overdriven power guitar
  | 'choir'; // formant "aah" pad

export interface SongChannel {
  inst: Instrument;
  /**
   * Whitespace separated tokens, one per step (16th note by default):
   *   C4, F#3, Bb5   note (optionally with ':N' length in steps, e.g. C4:4)
   *   C4+E4+G4       chord
   *   C4! / C4?      accent / ghost
   *   -              extend previous note by one step
   *   .              rest
   *   |              ignored (bar line for readability)
   *   (a b c)*4      repeat group
   * Drum channel tokens: k kick, s snare, h hat, o open hat, c crash, t hi tom, T low tom,
   * p clap, r ride, x woodblock, m metal clang, b bongo; combine with '+': k+h
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
  /** Vibrato rate Hz (default 5.5) and onset delay in seconds (default 0.08). */
  vibratoRate?: number;
  vibratoDelay?: number;
  /** Stereo position -1..1. */
  pan?: number;
  /** Reverb send 0..1 (default depends on the instrument). */
  reverb?: number;
  /** Echo (ping-pong delay) send 0..1 (default 0). */
  echo?: number;
  /** Portamento time (s) between legato notes. */
  glide?: number;
  /** Chords become a fast chip arpeggio switching notes every `arp` seconds (e.g. 0.035). */
  arp?: number;
  /** Channel low-pass cutoff Hz. */
  cutoff?: number;
  /** Overdrive amount (guitar default 6). */
  drive?: number;
  /** Musical role (documentation, range checks, mixing). */
  role?: 'lead' | 'counter' | 'harmony' | 'bass' | 'drums' | 'fx';
}

export interface Song {
  bpm: number;
  /** Steps per beat (default 4 = 16th notes). */
  steps?: number;
  /** Loop the song (default true). */
  loop?: boolean;
  channels: SongChannel[];
  /** Display title (sound test / credits). */
  title?: string;
  /** Step where the loop restarts (intro plays once). Applies to full-length channels. */
  loopStart?: number;
  /** Swing: delay of odd steps as a fraction of a step (0..0.5). */
  swing?: number;
  /** Reverb / echo return scale for this song (default 1). */
  reverb?: number;
  echo?: number;
  /** Echo delay in steps (default 3 = dotted eighth) and feedback (default 0.32). */
  echoSteps?: number;
  echoFeedback?: number;
  /** Song gain multiplier (default 1). */
  gain?: number;
}

interface ParsedEvent {
  step: number;
  len: number;
  midi: number; // -1 for drum event
  drums?: string[];
  /** All notes of a chord token (midi is the first one). */
  chord?: number[];
  /** Per-part velocity of a drum event. */
  drumVel?: number[];
  /** Velocity multiplier (accent 1.35, ghost 0.45). */
  vel: number;
}

interface ParsedChannel {
  ch: SongChannel;
  events: ParsedEvent[];
  length: number;
}

/** Expand '(a b)*3' groups (innermost first). */
export function expandRepeats(src: string): string {
  let s = src;
  const re = /\(([^()]*)\)\s*\*\s*(\d+)/;
  for (let guard = 0; guard < 10000; guard++) {
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

const DRUM_RE = /^[kshoctTprxmb]$/;

/** Parse a channel's token string into events. Throws on malformed tokens. */
export function parseChannel(ch: SongChannel): ParsedChannel {
  const tokens = expandRepeats(ch.notes)
    .split(/\s+/)
    .filter((t) => t && t !== '|');
  const events: ParsedEvent[] = [];
  let step = 0;
  let last: ParsedEvent | null = null;
  const drums = ch.inst === 'drums' || ch.inst === 'noise';
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
    if (drums) {
      // Each '+'-joined part may carry its own accent: 's!+x', 'k+s?'.
      const parts: string[] = [];
      const vels: number[] = [];
      for (const raw of base.split('+')) {
        const accent = raw.length > 1 ? raw[raw.length - 1] : '';
        const p = accent === '!' || accent === '?' ? raw.slice(0, -1) : raw;
        if (!DRUM_RE.test(p)) throw new Error(`Bad drum token "${tok}"`);
        parts.push(p);
        vels.push(accent === '!' ? 1.35 : accent === '?' ? 0.45 : 1);
      }
      last = { step, len, midi: -1, drums: parts, drumVel: vels, vel: 1 };
      events.push(last);
    } else {
      let vel = 1;
      if (base.length > 1 && base.endsWith('!')) {
        vel = 1.35;
        base = base.slice(0, -1);
      } else if (base.length > 1 && base.endsWith('?')) {
        vel = 0.45;
        base = base.slice(0, -1);
      }
      const parts = base.split('+');
      const midis: number[] = [];
      for (const p of parts) {
        const midi = noteToMidi(p);
        if (midi === null) throw new Error(`Bad note token "${tok}"`);
        midis.push(midi + (ch.oct ?? 0) * 12);
      }
      last = { step, len, midi: midis[0], vel, chord: midis.length > 1 ? midis : undefined };
      events.push(last);
    }
    step += len;
  }
  return { ch, events, length: Math.max(1, step) };
}

/** Length of a song in steps (its longest channel). */
export function songLengthSteps(song: Song): number {
  let n = 1;
  for (const c of song.channels) n = Math.max(n, parseChannel(c).length);
  return n;
}

/** Seconds per step. */
export function songStepSeconds(song: Song): number {
  return 60 / song.bpm / (song.steps ?? 4);
}

/** Full duration in seconds (one pass, intro included). */
export function songDuration(song: Song): number {
  return songLengthSteps(song) * songStepSeconds(song);
}

/** Duration of the looping part in seconds (whole song if no loopStart). */
export function songLoopDuration(song: Song): number {
  return (songLengthSteps(song) - (song.loopStart ?? 0)) * songStepSeconds(song);
}

// ===================================================================== engine

const MAX_VOICES = 32;
const LOOKAHEAD = 0.2;
const DEFAULT_SFX_OPTS: Required<SfxOptions> = { poly: 4, priority: 1, gain: 1, minGap: 0.035, final: false };

interface Voice {
  name: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
  out: AudioNode;
  start: number;
  priority: number;
  gone: boolean;
}

class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxDefs = new Map<string, SfxDef>();
  private sfxOpts = new Map<string, SfxOptions>();
  private buffers = new Map<string, AudioBuffer>();
  private songs = new Map<string, Song>();
  private lastPlayed = new Map<string, { t: number; n: number }>();
  private voices: Voice[] = [];
  private voicesByName = new Map<string, Voice[]>();
  private synth: Synth | null = null;
  private fx: MusicFx | null = null;
  private schedTimer: ReturnType<typeof setInterval> | null = null;
  private current: SongInstance | null = null;
  private fading: SongInstance[] = [];
  /** Name of the song currently playing (or requested before unlock). */
  currentSong: string | null = null;
  private pendingSong: string | null = null;
  private pendingOpts: { restart?: boolean; fadeIn?: number; fadeOut?: number } = {};
  volumes = { master: 0.8, music: 0.6, sfx: 0.8, voice: 0.9 };
  voiceEnabled = true;
  private ducked = false;
  private voiceDucked = false;
  muted = false;
  /** Called when a non-looping song reaches its end. */
  onSongEnd: ((name: string) => void) | null = null;

  get available(): boolean {
    return typeof window !== 'undefined' && (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined');
  }

  /** Create/resume the AudioContext. Must be called from a user gesture (cheap to call again). */
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
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -2;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.08;
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(comp);
      comp.connect(limiter);
      limiter.connect(ctx.destination);
      this.synth = new Synth(ctx);
      this.fx = this.synth.createFx(this.musicBus);
      this.applyVolumes(true);
      this.schedTimer = setInterval(() => this.tick(), 25);
      this.prerenderLater();
      if (typeof document !== 'undefined') {
        // Pause the whole audio graph while the tab is hidden (timers are throttled there).
        document.addEventListener('visibilitychange', () => {
          if (!this.ctx) return;
          if (document.hidden) this.ctx.suspend().catch(() => {});
          else this.ctx.resume().catch(() => {});
        });
      }
      if (typeof speechSynthesis !== 'undefined') {
        try {
          speechSynthesis.addEventListener?.('voiceschanged', () => this.pickVoice());
        } catch {
          /* ignore */
        }
      }
    }
    if (this.ctx.state !== 'running' && !(typeof document !== 'undefined' && document.hidden)) this.ctx.resume().catch(() => {});
    if (this.pendingSong) {
      const s = this.pendingSong;
      const o = this.pendingOpts;
      this.pendingSong = null;
      this.currentSong = null;
      this.playMusic(s, o);
    }
  }

  setVolumes(v: Partial<{ master: number; music: number; sfx: number; voice: number }>): void {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  private applyVolumes(immediate = false): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    const t = this.ctx.currentTime;
    const set = (p: AudioParam, v: number, tc: number) => {
      if (immediate) p.value = v;
      else p.setTargetAtTime(v, t, tc);
    };
    set(this.master.gain, this.muted ? 0 : this.volumes.master, 0.02);
    set(this.sfxBus.gain, this.volumes.sfx, 0.02);
    const duck = (this.ducked ? 0.35 : 1) * (this.voiceDucked ? 0.45 : 1);
    // Duck quickly, recover slowly.
    set(this.musicBus.gain, this.volumes.music * duck, this.voiceDucked || this.ducked ? 0.06 : 0.3);
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

  private setVoiceDuck(on: boolean): void {
    if (this.voiceDucked === on) return;
    this.voiceDucked = on;
    this.applyVolumes();
  }

  // ---------------------------------------------------------------- SFX

  defineSfx(name: string, def: SfxDef, opts?: SfxOptions): void {
    if (this.sfxOpts.get(name)?.final && !opts?.final) return;
    this.sfxDefs.set(name, def);
    if (opts) this.sfxOpts.set(name, opts);
    else this.sfxOpts.delete(name);
    this.buffers.delete(name);
  }

  hasSfx(name: string): boolean {
    return this.sfxDefs.has(name);
  }

  sfxNames(): string[] {
    return [...this.sfxDefs.keys()];
  }

  /** The definition of a sound (tests / tools). */
  getSfx(name: string): SfxDef | undefined {
    return this.sfxDefs.get(name);
  }

  /** The playback options of a sound (defaults filled in). */
  sfxOptions(name: string): Required<SfxOptions> {
    return { ...DEFAULT_SFX_OPTS, ...(this.sfxOpts.get(name) ?? {}) };
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
    if (!ctx || !this.sfxBus || this.muted || ctx.state !== 'running') return;
    const o = this.sfxOptions(name);
    // Throttle identical sounds stacking in the same instant.
    const now = ctx.currentTime;
    const lp = this.lastPlayed.get(name);
    if (lp && now - lp.t < o.minGap) {
      if (lp.n >= 2) return;
      lp.n++;
    } else {
      this.lastPlayed.set(name, { t: now, n: 1 });
    }
    // Per-sound polyphony: cut the oldest instance.
    const same = this.voicesByName.get(name);
    if (same) while (same.length >= Math.max(1, o.poly)) this.stealVoice(same[0], now);
    // Global voice limit: steal the oldest lowest-priority voice (or drop this one).
    if (this.voices.length >= MAX_VOICES) {
      let victim: Voice | null = null;
      for (const v of this.voices) if (!victim || v.priority < victim.priority || (v.priority === victim.priority && v.start < victim.start)) victim = v;
      if (!victim || victim.priority > o.priority) return;
      this.stealVoice(victim, now);
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
    src.playbackRate.value = Math.max(0.05, rate);
    const g = ctx.createGain();
    g.gain.value = Math.max(0, Math.min(2, (opts.vol ?? 1) * o.gain));
    src.connect(g);
    let out: AudioNode = g;
    if (opts.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p);
      out = p;
    }
    out.connect(this.sfxBus);
    const voice: Voice = { name, src, gain: g, out, start: now, priority: o.priority, gone: false };
    this.voices.push(voice);
    if (same) same.push(voice);
    else this.voicesByName.set(name, [voice]);
    src.onended = () => {
      this.forgetVoice(voice);
      try {
        out.disconnect();
        if (out !== g) g.disconnect();
      } catch {
        /* ignore */
      }
    };
    src.start();
  }

  private forgetVoice(v: Voice): void {
    if (v.gone) return;
    v.gone = true;
    const i = this.voices.indexOf(v);
    if (i >= 0) this.voices.splice(i, 1);
    const list = this.voicesByName.get(v.name);
    if (list) {
      const j = list.indexOf(v);
      if (j >= 0) list.splice(j, 1);
    }
  }

  private stealVoice(v: Voice, now: number): void {
    this.forgetVoice(v);
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0, now + 0.02);
      v.src.stop(now + 0.03);
    } catch {
      /* ignore */
    }
  }

  /** Pre-render all SFX buffers (avoid first-play hitches). */
  prerender(): void {
    if (!this.ctx) return;
    for (const [name, def] of this.sfxDefs) if (!this.buffers.has(name)) this.buffers.set(name, renderSfx(this.ctx, def));
  }

  /**
   * Render the SFX buffers in the background, in ~6 ms slices (one layer at a time, so even the
   * longest sounds never block a frame). Short sounds - the common ones - go first.
   */
  private prerenderLater(): void {
    const dur = (d: SfxDef) => (Array.isArray(d) ? d : [d]).reduce((m, l) => Math.max(m, (l.delay ?? 0) + (l.dur ?? 0.2)), 0);
    const names = [...this.sfxDefs.keys()].sort((a, b) => dur(this.sfxDefs.get(a)!) - dur(this.sfxDefs.get(b)!));
    let i = 0;
    let job: { name: string; def: SfxDef; it: Generator<void, Float32Array, void> } | null = null;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const step = () => {
      const ctx = this.ctx;
      if (!ctx) return;
      const t0 = now();
      while (now() - t0 < 6) {
        if (!job) {
          while (i < names.length && this.buffers.has(names[i])) i++;
          if (i >= names.length) return;
          const name = names[i++];
          const def = this.sfxDefs.get(name)!;
          job = { name, def, it: sfxRenderJob(def, ctx.sampleRate) };
        }
        const r = job.it.next();
        if (r.done) {
          // Skip if the sound was redefined (or rendered on demand) meanwhile.
          if (this.sfxDefs.get(job.name) === job.def && !this.buffers.has(job.name)) {
            const buf = ctx.createBuffer(1, r.value.length, ctx.sampleRate);
            buf.getChannelData(0).set(r.value);
            this.buffers.set(job.name, buf);
          }
          job = null;
        }
      }
      setTimeout(step, 16);
    };
    setTimeout(step, 30);
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

  /** True while a song is audibly playing (not finished / stopped). */
  isMusicPlaying(): boolean {
    return !!this.current && this.current.finishedAt === null;
  }

  /**
   * Play a song. Switching songs crossfades: the old one fades over `fadeOut` seconds
   * (default 0.7, or 0.25 when the new song is a non-looping jingle) while the new one
   * starts (optionally fading in over `fadeIn`).
   */
  playMusic(name: string, opts: { restart?: boolean; fadeIn?: number; fadeOut?: number } = {}): void {
    if (this.currentSong === name && !opts.restart && (this.current || this.pendingSong === name)) return;
    const song = this.songs.get(name);
    if (!song) {
      if (!this.warned.has('song:' + name)) {
        this.warned.add('song:' + name);
        console.warn(`[audio] unknown song "${name}"`);
      }
      this.stopMusic(0.2);
      this.currentSong = name;
      return;
    }
    this.currentSong = name;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.synth || !this.fx) {
      this.pendingSong = name;
      this.pendingOpts = opts;
      return;
    }
    const jingle = song.loop === false;
    const hadMusic = !!this.current;
    this.stopMusic(opts.fadeOut ?? (jingle ? 0.25 : 0.7), true);
    const fadeIn = opts.fadeIn ?? (hadMusic && !jingle ? 0.12 : 0);
    this.current = new SongInstance(this.synth, this.fx, name, song, this.musicBus, ctx.currentTime + 0.06, fadeIn);
    this.current.schedule(ctx.currentTime + LOOKAHEAD, ctx.currentTime);
  }

  stopMusic(fade = 0.3, keepName = false): void {
    if (!keepName) this.currentSong = null;
    this.pendingSong = null;
    const cur = this.current;
    this.current = null;
    if (!cur || !this.ctx) return;
    cur.fadeOut(this.ctx.currentTime, Math.max(0.01, fade));
    this.fading.push(cur);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const horizon = now + LOOKAHEAD;
    const cur = this.current;
    if (cur) {
      cur.schedule(horizon, now);
      if (cur.finishedAt !== null && now >= cur.finishedAt && !cur.endNotified) {
        cur.endNotified = true;
        // Let the reverb tail ring, then release the nodes.
        cur.disposeAt = cur.finishedAt + 3;
        this.fading.push(cur);
        this.current = null;
        if (this.currentSong === cur.name) this.currentSong = null;
        try {
          this.onSongEnd?.(cur.name);
        } catch {
          /* ignore */
        }
      }
    }
    if (this.fading.length) {
      for (const f of this.fading) f.schedule(horizon, now);
      this.fading = this.fading.filter((f) => {
        if (f.disposeAt !== null && now > f.disposeAt) {
          f.dispose();
          return false;
        }
        return true;
      });
    }
  }

  /**
   * Render a song (or a song definition) offline into an AudioBuffer (browser only; null in
   * Node). Used by tools to check levels and mixes without listening.
   */
  async renderSong(song: Song | string, seconds: number, sampleRate = 44100): Promise<AudioBuffer | null> {
    const def = typeof song === 'string' ? this.songs.get(song) : song;
    if (!def || typeof OfflineAudioContext === 'undefined') return null;
    const octx = new OfflineAudioContext(2, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate);
    const synth = new Synth(octx);
    const bus = octx.createGain();
    bus.connect(octx.destination);
    const fx = synth.createFx(bus);
    const inst = new SongInstance(synth, fx, typeof song === 'string' ? song : 'offline', def, bus, 0.02, 0);
    inst.schedule(seconds, 0, 1e7);
    return octx.startRendering();
  }

  // ---------------------------------------------------------------- Voice

  private voice: SpeechSynthesisVoice | null = null;
  private voicesLoaded = false;
  private sayId = 0;
  private sayTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** Announcer voice line (e.g. weapon pickups, "Mission complete!"). Ducks the music. */
  say(text: string, opts: { pitch?: number; rate?: number } = {}): void {
    if (!this.voiceEnabled || this.muted || typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      if (!this.voicesLoaded) this.pickVoice();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.pitch = opts.pitch ?? 0.55;
      u.rate = opts.rate ?? 1.0;
      const vol = Math.max(0, Math.min(1, this.volumes.voice * this.volumes.master));
      u.volume = vol;
      const id = ++this.sayId;
      const release = () => {
        if (this.sayId === id) this.setVoiceDuck(false);
      };
      u.onend = release;
      u.onerror = release;
      if (vol > 0.05) {
        this.setVoiceDuck(true);
        if (this.sayTimer) clearTimeout(this.sayTimer);
        // Safety net: some browsers never fire onend.
        this.sayTimer = setTimeout(release, 900 + (text.length * 95) / Math.max(0.5, u.rate));
      }
      speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }
}

// ===================================================================== music synthesis

/** Per-instrument defaults: envelope, loudness, reverb send. */
const INST: Record<string, { a: number; d: number; s: number; r: number; gain: number; rev: number }> = {
  pulse: { a: 0.005, d: 0.08, s: 0.6, r: 0.04, gain: 0.87, rev: 0.18 },
  pulse25: { a: 0.005, d: 0.08, s: 0.6, r: 0.04, gain: 1.41, rev: 0.18 },
  pulse12: { a: 0.005, d: 0.08, s: 0.6, r: 0.04, gain: 1.97, rev: 0.18 },
  triangle: { a: 0.005, d: 0.08, s: 1, r: 0.04, gain: 0.88, rev: 0.05 },
  sine: { a: 0.005, d: 0.08, s: 0.6, r: 0.04, gain: 1.1, rev: 0.15 },
  saw: { a: 0.005, d: 0.08, s: 0.6, r: 0.04, gain: 1.46, rev: 0.18 },
  supersaw: { a: 0.01, d: 0.2, s: 0.75, r: 0.12, gain: 0.77, rev: 0.25 },
  strings: { a: 0.14, d: 0.3, s: 0.85, r: 0.28, gain: 0.85, rev: 0.35 },
  brass: { a: 0.025, d: 0.18, s: 0.7, r: 0.08, gain: 0.92, rev: 0.22 },
  pluck: { a: 0.002, d: 0.3, s: 0.12, r: 0.08, gain: 1.78, rev: 0.2 },
  bass: { a: 0.003, d: 0.14, s: 0.7, r: 0.05, gain: 0.77, rev: 0.0 },
  bell: { a: 0.002, d: 0.9, s: 0, r: 0.4, gain: 0.96, rev: 0.35 },
  steel: { a: 0.002, d: 0.45, s: 0, r: 0.2, gain: 1.36, rev: 0.25 },
  organ: { a: 0.006, d: 0.05, s: 1, r: 0.06, gain: 0.88, rev: 0.25 },
  guitar: { a: 0.004, d: 0.4, s: 0.75, r: 0.06, gain: 0.25, rev: 0.15 },
  choir: { a: 0.16, d: 0.3, s: 0.9, r: 0.35, gain: 2.4, rev: 0.45 },
  drums: { a: 0, d: 0, s: 0, r: 0, gain: 1.4, rev: 0.08 },
  noise: { a: 0, d: 0, s: 0, r: 0, gain: 1.4, rev: 0.08 },
};

const FORMANTS: Record<string, [number, number][]> = {
  // [frequency Hz, relative amplitude]
  a: [
    [730, 1],
    [1090, 0.5],
    [2440, 0.25],
  ],
  e: [
    [530, 1],
    [1840, 0.4],
    [2480, 0.25],
  ],
  i: [
    [270, 1],
    [2290, 0.3],
    [3010, 0.2],
  ],
  o: [
    [570, 1],
    [840, 0.6],
    [2410, 0.2],
  ],
  u: [
    [300, 1],
    [870, 0.4],
    [2240, 0.15],
  ],
};

interface MusicFx {
  reverbIn: GainNode;
  echoIn: GainNode;
  setEcho(time: number, feedback: number, at: number): void;
}

interface Strip {
  input: GainNode;
  nodes: AudioNode[];
}

class Synth {
  readonly noise: AudioBuffer;
  private pulse = new Map<number, PeriodicWave>();
  private organWave: PeriodicWave | null = null;

  /** Clamp a filter frequency below Nyquist for this context. */
  hz(f: number): number {
    return Math.min(f, this.ctx.sampleRate * 0.45);
  }

  constructor(readonly ctx: BaseAudioContext) {
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = nb.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    this.noise = nb;
  }

  pulseWave(duty: number): PeriodicWave {
    const key = Math.round(duty * 1000);
    let w = this.pulse.get(key);
    if (!w) {
      const n = 64;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let i = 1; i < n; i++) real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
      w = this.ctx.createPeriodicWave(real, imag);
      this.pulse.set(key, w);
    }
    return w;
  }

  organ(): PeriodicWave {
    if (!this.organWave) {
      // Drawbar-style harmonics: 8' 4' 2 2/3' 2' (+ a little 1 3/5' and 1').
      const amps = [0, 1, 0.62, 0.42, 0.34, 0.06, 0.16, 0, 0.12];
      const real = new Float32Array(amps.length);
      const imag = new Float32Array(amps);
      this.organWave = this.ctx.createPeriodicWave(real, imag);
    }
    return this.organWave;
  }

  /** Stereo ping-pong echo + generated-impulse reverb, both returning into `dest`. */
  createFx(dest: AudioNode): MusicFx {
    const ctx = this.ctx;
    // Reverb.
    const reverbIn = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx, 1.9, 0.014);
    const revHp = ctx.createBiquadFilter();
    revHp.type = 'highpass';
    revHp.frequency.value = 220;
    const revOut = ctx.createGain();
    revOut.gain.value = 0.42;
    reverbIn.connect(revHp);
    revHp.connect(conv);
    conv.connect(revOut);
    revOut.connect(dest);
    // Ping-pong echo.
    const echoIn = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const dl = ctx.createDelay(2);
    const dr = ctx.createDelay(2);
    const fbl = ctx.createGain();
    const fbr = ctx.createGain();
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.5;
    const pl = ctx.createStereoPanner();
    const pr = ctx.createStereoPanner();
    pl.pan.value = -0.65;
    pr.pan.value = 0.65;
    echoIn.connect(lp);
    lp.connect(dl);
    dl.connect(pl);
    pl.connect(echoOut);
    dl.connect(fbl);
    fbl.connect(dr);
    dr.connect(pr);
    pr.connect(echoOut);
    dr.connect(fbr);
    fbr.connect(dl);
    echoOut.connect(dest);
    dl.delayTime.value = 0.3;
    dr.delayTime.value = 0.3;
    fbl.gain.value = 0.32;
    fbr.gain.value = 0.32;
    return {
      reverbIn,
      echoIn,
      setEcho(time: number, feedback: number, at: number) {
        const t = Math.max(0.02, Math.min(1.9, time));
        const fb = Math.max(0, Math.min(0.7, feedback));
        dl.delayTime.setValueAtTime(t, at);
        dr.delayTime.setValueAtTime(t, at);
        fbl.gain.setValueAtTime(fb, at);
        fbr.gain.setValueAtTime(fb, at);
      },
    };
  }

  /** Channel strip: input -> [drive] -> [formants] -> [low-pass] -> pan -> dry + sends. */
  createStrip(ch: SongChannel, dry: AudioNode, rev: AudioNode, echo: AudioNode): Strip {
    const ctx = this.ctx;
    const nodes: AudioNode[] = [];
    const input = ctx.createGain();
    nodes.push(input);
    let last: AudioNode = input;
    const chain = (n: AudioNode) => {
      last.connect(n);
      last = n;
      nodes.push(n);
    };
    if (ch.inst === 'guitar' || ch.drive) {
      const sh = ctx.createWaveShaper();
      const k = ch.drive ?? 6;
      const curve = new Float32Array(1024);
      const norm = Math.tanh(k);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(k * x) / norm;
      }
      sh.curve = curve;
      sh.oversample = '2x';
      chain(sh);
      const post = ctx.createGain();
      post.gain.value = 0.55;
      chain(post);
    }
    if (ch.inst === 'choir') {
      const sum = ctx.createGain();
      sum.gain.value = 1.4;
      for (const [f, a] of FORMANTS.a) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = this.hz(f);
        bp.Q.value = f / (60 + 0.06 * f);
        const g = ctx.createGain();
        g.gain.value = a;
        last.connect(bp);
        bp.connect(g);
        g.connect(sum);
        nodes.push(bp, g);
      }
      last = sum;
      nodes.push(sum);
    }
    const defCut: Partial<Record<Instrument, number>> = { strings: 2600, supersaw: 5200, guitar: 3400, organ: 6000 };
    const cut = ch.cutoff ?? defCut[ch.inst];
    if (cut) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = this.hz(cut);
      f.Q.value = 0.6;
      chain(f);
    }
    if (ch.inst === 'guitar') {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 90;
      chain(hp);
    }
    let out: AudioNode = last;
    if (ch.pan && (ctx as any).createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, ch.pan));
      chain(p);
      out = p;
    }
    out.connect(dry);
    const revAmt = ch.reverb ?? INST[ch.inst]?.rev ?? 0.15;
    if (revAmt > 0) {
      const g = ctx.createGain();
      g.gain.value = revAmt;
      out.connect(g);
      g.connect(rev);
      nodes.push(g);
    }
    if (ch.echo && ch.echo > 0) {
      const g = ctx.createGain();
      g.gain.value = ch.echo;
      out.connect(g);
      g.connect(echo);
      nodes.push(g);
    }
    return { input, nodes };
  }

  private osc(type: OscillatorType | 'pulse25' | 'pulse12', freq: number, t: number, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    if (type === 'pulse25') o.setPeriodicWave(this.pulseWave(0.25));
    else if (type === 'pulse12') o.setPeriodicWave(this.pulseWave(0.125));
    else o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    return o;
  }

  /** Schedule one melodic note (or chord) on a channel strip. */
  note(ch: SongChannel, ev: ParsedEvent, t: number, len: number, dest: AudioNode, prevMidi: number | null, ringOut = false): void {
    const ctx = this.ctx;
    const inst = ch.inst;
    const spec = INST[inst] ?? INST.pulse;
    const env = ch.env ?? {};
    const a = env.a ?? spec.a;
    const d = env.d ?? spec.d;
    const s = env.s ?? spec.s;
    // The last notes of a jingle ring out instead of stopping dead.
    const r = ringOut ? Math.max(env.r ?? spec.r, 0.9) : env.r ?? spec.r;
    const peak = (ch.vol ?? 0.5) * 0.32 * spec.gain * ev.vel;
    const end = t + Math.max(len, a + 0.01);
    const stopAt = end + r * 3 + 0.03;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * s, t + a, Math.max(0.001, d / 3));
    g.gain.setTargetAtTime(0, end, Math.max(0.001, r / 3));
    g.connect(dest);
    const sources: OscillatorNode[] = [];
    /** Frequency ratio of each source relative to the note (FM modulators are not 1). */
    const ratios: number[] = [];
    const notes = ev.chord && !ch.arp ? ev.chord : [ev.midi];
    const perVoice = notes.length > 1 ? 1 / Math.sqrt(notes.length) : 1;
    let target: AudioNode = g;
    // Per-note filters (brass / pluck / bass).
    if (inst === 'brass' || inst === 'pluck' || inst === 'bass') {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      const base = midiToFreq(ev.midi);
      if (inst === 'brass') {
        f.Q.value = 1.2;
        f.frequency.setValueAtTime(this.hz(base * 1.4), t);
        f.frequency.linearRampToValueAtTime(this.hz(base * 7 + 900), t + a + 0.03);
        f.frequency.setTargetAtTime(this.hz(base * 3.5 + 500), t + a + 0.03, 0.12);
      } else if (inst === 'pluck') {
        f.Q.value = 2.2;
        f.frequency.setValueAtTime(this.hz(base * 10 + 2500), t);
        f.frequency.setTargetAtTime(Math.max(300, base * 1.6), t + 0.005, 0.07);
      } else {
        f.Q.value = 1.6;
        f.frequency.setValueAtTime(this.hz(base * 14 + 1500), t);
        f.frequency.setTargetAtTime(Math.max(250, base * 4), t + 0.004, 0.05);
      }
      f.connect(g);
      target = f;
    }
    const vg = perVoice !== 1 ? ctx.createGain() : null;
    if (vg) {
      vg.gain.value = perVoice;
      vg.connect(target);
      target = vg;
    }
    for (const m of notes) {
      const f = midiToFreq(m);
      const add = (o: OscillatorNode, gain = 1, ratio = 1) => {
        ratios.push(ratio);
        if (gain !== 1) {
          const og = ctx.createGain();
          og.gain.value = gain;
          o.connect(og);
          og.connect(target);
        } else o.connect(target);
        sources.push(o);
      };
      switch (inst) {
        case 'pulse':
          add(this.osc('square', f, t, ch.detune));
          break;
        case 'pulse25':
        case 'pulse12':
          add(this.osc(inst, f, t, ch.detune));
          break;
        case 'triangle':
          add(this.osc('triangle', f, t, ch.detune));
          break;
        case 'saw':
          add(this.osc('sawtooth', f, t, ch.detune));
          break;
        case 'sine':
          add(this.osc('sine', f, t, ch.detune));
          break;
        case 'supersaw':
          add(this.osc('sawtooth', f, t, (ch.detune ?? 0) - 13), 0.8);
          add(this.osc('sawtooth', f, t, ch.detune ?? 0));
          add(this.osc('sawtooth', f, t, (ch.detune ?? 0) + 13), 0.8);
          break;
        case 'strings':
          add(this.osc('sawtooth', f, t, (ch.detune ?? 0) - 8));
          add(this.osc('sawtooth', f, t, (ch.detune ?? 0) + 8));
          break;
        case 'brass':
          add(this.osc('sawtooth', f, t, ch.detune));
          add(this.osc('square', f, t, (ch.detune ?? 0) + 5), 0.35);
          break;
        case 'pluck':
          add(this.osc('pulse25', f, t, ch.detune));
          break;
        case 'bass':
          add(this.osc('square', f, t, ch.detune), 0.8);
          add(this.osc('sine', f, t, ch.detune), 1.1);
          break;
        case 'organ': {
          const o = this.ctx.createOscillator();
          o.setPeriodicWave(this.organ());
          o.frequency.setValueAtTime(f, t);
          if (ch.detune) o.detune.value = ch.detune;
          add(o);
          break;
        }
        case 'guitar':
          add(this.osc('sawtooth', f, t, (ch.detune ?? 0) - 6));
          add(this.osc('sawtooth', f, t, (ch.detune ?? 0) + 6));
          break;
        case 'choir':
          add(this.osc('sawtooth', f, t, (ch.detune ?? 0) - 7));
          add(this.osc('sawtooth', f, t, (ch.detune ?? 0) + 7), 0.8);
          break;
        case 'bell':
        case 'steel': {
          const car = this.osc('sine', f, t, ch.detune);
          const mod = this.osc('sine', f * (inst === 'bell' ? 3.5 : 2), t, ch.detune);
          const mg = ctx.createGain();
          const idx = inst === 'bell' ? 2.4 : 1.3;
          mg.gain.setValueAtTime(f * idx, t);
          mg.gain.setTargetAtTime(f * idx * 0.12, t + 0.002, inst === 'bell' ? 0.25 : 0.09);
          mod.connect(mg);
          mg.connect(car.frequency);
          sources.push(mod);
          ratios.push(inst === 'bell' ? 3.5 : 2);
          if (inst === 'steel') {
            // Slight pitch "tonk" on the attack.
            car.detune.setValueAtTime((ch.detune ?? 0) + 25, t);
            car.detune.setTargetAtTime(ch.detune ?? 0, t, 0.02);
          }
          add(car);
          break;
        }
        default:
          add(this.osc('square', f, t, ch.detune));
      }
    }
    // Fast chip arpeggio over the chord tones.
    if (ev.chord && ch.arp && ch.arp > 0) {
      const freqs = ev.chord.map(midiToFreq);
      const stepT = Math.max(0.012, ch.arp);
      sources.forEach((o, i) => {
        let k = 0;
        for (let tt = t; tt < end; tt += stepT, k++) o.frequency.setValueAtTime(freqs[k % freqs.length] * ratios[i], tt);
      });
    } else if (ch.glide && prevMidi !== null && prevMidi !== ev.midi && notes.length === 1) {
      const from = midiToFreq(prevMidi);
      const to = midiToFreq(ev.midi);
      sources.forEach((o, i) => {
        o.frequency.cancelScheduledValues(t);
        o.frequency.setValueAtTime(from * ratios[i], t);
        o.frequency.exponentialRampToValueAtTime(to * ratios[i], t + ch.glide!);
      });
    }
    if (ch.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = ch.vibratoRate ?? 5.5;
      const vd = ch.vibratoDelay ?? 0.08;
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + vd);
      lg.gain.linearRampToValueAtTime(ch.vibrato, t + vd + 0.12);
      lfo.connect(lg);
      for (const o of sources) lg.connect(o.detune);
      lfo.start(t);
      lfo.stop(stopAt);
    }
    for (const o of sources) {
      o.start(t);
      o.stop(stopAt);
    }
    const last = sources[sources.length - 1];
    if (last)
      last.onended = () => {
        try {
          g.disconnect();
          if (target !== g) target.disconnect();
        } catch {
          /* ignore */
        }
      };
  }

  /** Schedule one drum hit. */
  drum(kind: string, t: number, vol: number, dest: AudioNode): void {
    const ctx = this.ctx;
    const cleanup: AudioNode[] = [];
    const disconnectAll = () => {
      for (const n of cleanup) {
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
    };
    const noise = (dur: number, hp: number, lp: number, v: number, at = t, bp = 0, q = 1) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      let node: AudioNode = src;
      const f1 = ctx.createBiquadFilter();
      f1.type = 'highpass';
      f1.frequency.value = this.hz(hp);
      node.connect(f1);
      node = f1;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = this.hz(lp);
      node.connect(f2);
      node = f2;
      if (bp) {
        const f3 = ctx.createBiquadFilter();
        f3.type = 'bandpass';
        f3.frequency.value = this.hz(bp);
        f3.Q.value = q;
        node.connect(f3);
        node = f3;
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(v, at + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
      node.connect(g);
      g.connect(dest);
      src.start(at, Math.random() * 0.5);
      src.stop(at + dur + 0.02);
      src.onended = () => {
        try {
          g.disconnect();
        } catch {
          /* ignore */
        }
      };
    };
    const tone = (f0: number, f1: number, sweep: number, dur: number, v: number, type: OscillatorType = 'sine', at = t) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f1, at + sweep);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(v, at + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
      o.connect(g);
      g.connect(dest);
      o.start(at);
      o.stop(at + dur + 0.02);
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
        tone(165, 48, 0.09, 0.32, vol * 2.5);
        tone(1100, 180, 0.012, 0.02, vol * 0.5, 'triangle');
        break;
      case 's':
        tone(205, 150, 0.05, 0.1, vol * 1.15, 'triangle');
        noise(0.17, 900, 9500, vol * 1.75);
        break;
      case 'h':
        noise(0.045, 7500, 16000, vol * 1.25);
        break;
      case 'o':
        noise(0.26, 6500, 15000, vol * 0.8);
        break;
      case 'c':
        noise(1.15, 3600, 14000, vol * 0.8);
        noise(0.5, 5000, 12000, vol * 0.35, t, 7000, 2);
        break;
      case 't':
        tone(250, 145, 0.1, 0.2, vol * 1.7);
        noise(0.03, 1500, 6000, vol * 0.3);
        break;
      case 'T':
        tone(150, 82, 0.12, 0.26, vol * 1.9);
        noise(0.03, 1000, 5000, vol * 0.3);
        break;
      case 'p':
        noise(0.012, 800, 7000, vol * 2.2, t, 1300, 1.1);
        noise(0.012, 800, 7000, vol * 2.0, t + 0.011, 1300, 1.1);
        noise(0.15, 800, 7000, vol * 2.3, t + 0.022, 1250, 1.0);
        break;
      case 'r': {
        // 808-style metallic ride: detuned squares through a high-pass.
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = this.hz(6000);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol * 0.8, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.42);
        hp.connect(g);
        g.connect(dest);
        let last: OscillatorNode | null = null;
        for (const f of [333, 541, 798]) {
          const o = ctx.createOscillator();
          o.type = 'square';
          o.frequency.value = f;
          o.connect(hp);
          o.start(t);
          o.stop(t + 0.45);
          last = o;
        }
        noise(0.05, 8000, 16000, vol * 0.4);
        cleanup.push(hp, g);
        if (last) last.onended = disconnectAll;
        break;
      }
      case 'x':
        tone(1750, 1650, 0.02, 0.06, vol * 0.9);
        tone(870, 850, 0.02, 0.04, vol * 0.5, 'triangle');
        break;
      case 'm': {
        // Industrial anvil clang: two inharmonic squares through a band-pass.
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2300;
        bp.Q.value = 2.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol * 1.4, t + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.34);
        bp.connect(g);
        g.connect(dest);
        let last: OscillatorNode | null = null;
        for (const f of [587, 847, 1263]) {
          const o = ctx.createOscillator();
          o.type = 'square';
          o.frequency.value = f;
          o.connect(bp);
          o.start(t);
          o.stop(t + 0.36);
          last = o;
        }
        noise(0.03, 2000, 12000, vol * 0.6);
        cleanup.push(bp, g);
        if (last) last.onended = disconnectAll;
        break;
      }
      case 'b':
        tone(440, 370, 0.04, 0.15, vol * 1.3);
        noise(0.018, 2500, 9000, vol * 0.35);
        break;
    }
  }
}

/** Stereo reverb impulse: decaying noise, darker over time, with pre-delay. */
function makeImpulse(ctx: BaseAudioContext, seconds: number, preDelay: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(seconds * sr);
  const buf = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let seed = c ? 0x2545f491 : 0x9e3779b9;
    let lp = 0;
    const pre = Math.floor(preDelay * sr);
    for (let i = pre; i < n; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const white = ((seed >>> 0) / 4294967296) * 2 - 1;
      const k = (i - pre) / (n - pre);
      // High frequencies die faster: low-pass cutoff falls from ~9 kHz to ~1.5 kHz.
      const cut = 9000 * Math.pow(1500 / 9000, k);
      const a = 1 - Math.exp((-2 * Math.PI * cut) / sr);
      lp += a * (white - lp);
      d[i] = lp * Math.exp(-6.2 * k) * (1 - Math.exp(-(i - pre) / (0.004 * sr)));
    }
  }
  return buf;
}

interface Cursor {
  idx: number;
  /** Absolute step offset of the current pass. */
  base: number;
  done: boolean;
  prevEnd: number;
  prevMidi: number | null;
}

/** One playing (or fading) song. */
class SongInstance {
  readonly parsed: ParsedChannel[];
  readonly cursors: Cursor[];
  readonly stepDur: number;
  readonly length: number;
  readonly loop: boolean;
  readonly loopStart: number;
  private strips: Strip[];
  private dry: GainNode;
  private rev: GainNode;
  private echo: GainNode;
  private levels: [number, number, number];
  /** Time the last note ends (non-looping songs), else null. */
  finishedAt: number | null = null;
  endNotified = false;
  /** Stop scheduling after this time (fade-out end). */
  stopAt: number | null = null;
  disposeAt: number | null = null;

  constructor(
    private synth: Synth,
    fx: MusicFx,
    readonly name: string,
    readonly song: Song,
    out: AudioNode,
    readonly start: number,
    fadeIn: number,
  ) {
    const ctx = synth.ctx;
    this.parsed = song.channels.map((c) => parseChannel(c));
    this.length = Math.max(1, ...this.parsed.map((p) => p.length));
    this.loop = song.loop !== false;
    this.loopStart = Math.max(0, Math.min(this.length - 1, song.loopStart ?? 0));
    this.stepDur = 60 / song.bpm / (song.steps ?? 4);
    this.cursors = this.parsed.map(() => ({ idx: 0, base: 0, done: false, prevEnd: -1, prevMidi: null }));
    const gain = song.gain ?? 1;
    this.levels = [gain, gain * (song.reverb ?? 1), gain * (song.echo ?? 1)];
    this.dry = ctx.createGain();
    this.rev = ctx.createGain();
    this.echo = ctx.createGain();
    const nodes = [this.dry, this.rev, this.echo];
    nodes.forEach((g, i) => {
      if (fadeIn > 0) {
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(this.levels[i], start + fadeIn);
      } else g.gain.value = this.levels[i];
    });
    this.dry.connect(out);
    this.rev.connect(fx.reverbIn);
    this.echo.connect(fx.echoIn);
    fx.setEcho(this.stepDur * (song.echoSteps ?? 3), song.echoFeedback ?? 0.32, Math.max(0, start - 0.01));
    this.strips = song.channels.map((c) => synth.createStrip(c, this.dry, this.rev, this.echo));
  }

  fadeOut(now: number, dur: number): void {
    for (const g of [this.dry, this.rev, this.echo]) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + dur);
    }
    this.stopAt = now + dur;
    this.disposeAt = now + dur + 2.5;
  }

  schedule(horizon: number, now: number, maxEvents = 1024): void {
    if (this.stopAt !== null) horizon = Math.min(horizon, this.stopAt);
    const swing = this.song.swing ?? 0;
    this.parsed.forEach((pc, ci) => {
      const c = this.cursors[ci];
      if (c.done) return;
      if (pc.events.length === 0) {
        c.done = true;
        return;
      }
      for (let guard = 0; guard < maxEvents; guard++) {
        const ev = pc.events[c.idx];
        const abs = c.base + ev.step;
        let t = this.start + abs * this.stepDur;
        if (swing && ev.step % 2 === 1) t += swing * this.stepDur;
        if (t > horizon) break;
        const legato = c.prevEnd === abs ? c.prevMidi : null;
        const final = !this.loop && abs + ev.len >= this.length;
        if (t >= now - 0.05) this.play(pc.ch, ev, t, ev.len * this.stepDur, ci, legato, final);
        c.prevEnd = abs + ev.len;
        c.prevMidi = ev.midi >= 0 ? ev.midi : null;
        c.idx++;
        if (c.idx >= pc.events.length) {
          if (!this.loop) {
            c.done = true;
            break;
          }
          const ls = this.loopStart > 0 && pc.length === this.length ? this.loopStart : 0;
          c.base += pc.length - ls;
          let ni = 0;
          if (ls > 0) {
            ni = pc.events.findIndex((e) => e.step >= ls);
            if (ni < 0) {
              c.done = true;
              break;
            }
          }
          c.idx = ni;
        }
      }
    });
    if (!this.loop && this.finishedAt === null && this.cursors.every((c) => c.done)) {
      this.finishedAt = this.start + this.length * this.stepDur;
    }
  }

  private play(ch: SongChannel, ev: ParsedEvent, t: number, len: number, ci: number, prevMidi: number | null, final: boolean): void {
    const strip = this.strips[ci];
    if (ev.drums) {
      const vol = (ch.vol ?? 0.5) * 0.32 * ev.vel * (INST[ch.inst]?.gain ?? 1);
      ev.drums.forEach((d, i) => this.synth.drum(d, t, vol * (ev.drumVel?.[i] ?? 1), strip.input));
      return;
    }
    this.synth.note(ch, ev, t, len, strip.input, prevMidi, final);
  }

  dispose(): void {
    for (const s of this.strips)
      for (const n of s.nodes) {
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
    for (const g of [this.dry, this.rev, this.echo]) {
      try {
        g.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
}

// ===================================================================== SFX renderer

/** Render an SfxDef into raw samples (exported for tests and tools). */
export function renderSfxSamples(def: SfxDef, sampleRate: number): Float32Array {
  const job = sfxRenderJob(def, sampleRate);
  let r = job.next();
  while (!r.done) r = job.next();
  return r.value;
}

/** Incremental renderer: yields after each layer so long sounds can be rendered in slices. */
function* sfxRenderJob(def: SfxDef, sampleRate: number): Generator<void, Float32Array, void> {
  const layers = Array.isArray(def) ? def : [def];
  let total = 0;
  for (const l of layers) total = Math.max(total, (l.delay ?? 0) + (l.dur ?? 0.2));
  const n = Math.max(1, Math.ceil(total * sampleRate) + 8);
  const out = new Float32Array(n);
  for (let i = 0; i < layers.length; i++) {
    renderLayer(layers[i], out, sampleRate, i);
    yield;
  }
  // Soft clip.
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * 1.2);
  // Tiny fade at the end to avoid clicks.
  const fade = Math.min(n, Math.floor(sampleRate * 0.004));
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

/** Topology-preserving state-variable filter (stable for gliding cutoffs). */
class Svf {
  private ic1 = 0;
  private ic2 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private k = 1;
  low = 0;
  band = 0;

  /** Set cutoff/centre (Hz) and resonance. */
  set(fc: number, q: number, sr: number): void {
    const g = Math.tan((Math.PI * Math.min(fc, sr * 0.45)) / sr);
    this.k = 1 / Math.max(0.05, q);
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }

  tick(x: number): void {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.low = v2;
    this.band = v1 * this.k; // normalized: unity gain at the centre frequency
  }
}

/** Samples between control-rate updates (pitch, filter coefficients, formants). */
const CONTROL = 16;

function renderLayer(l: SfxLayer, out: Float32Array, sr: number, layerIndex: number): void {
  const wave = l.wave ?? 'square';
  const dur = l.dur ?? 0.2;
  const attack = Math.max(0.0005, l.attack ?? 0.002);
  const hold = l.hold ?? 0;
  const decay = l.decay ?? Math.max(0.001, dur - attack - hold);
  const curve = l.curve ?? 2;
  const vol = l.vol ?? 0.5;
  const f0 = l.freq ?? 440;
  const f1 = l.freqEnd ?? f0;
  const glide = l.glide ?? dur;
  const duty = l.duty ?? 0.5;
  const start = Math.floor((l.delay ?? 0) * sr);
  const len = Math.min(Math.floor(dur * sr), out.length - start);
  if (len <= 0) return;
  let phase = 0;
  let modPhase = 0;
  let noiseVal = 0;
  let noisePhase = 1;
  let seed = (l.seed !== undefined ? Math.imul(l.seed + 1, 0x9e3779b1) ^ (layerIndex * 0x85ebca6b) : 0x1234567 ^ Math.floor(f0 * 7)) | 0;
  if (seed === 0) seed = 0x1234567;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };
  const metal = new Float32Array(32);
  for (let i = 0; i < 32; i++) metal[i] = rnd() > 0 ? 1 : -1;
  let lp = 0;
  let lpA = 0;
  let hpPrev = 0;
  let hpOut = 0;
  const hpA = l.highpass ? 1 / (1 + 2 * Math.PI * l.highpass * (1 / sr)) : 0; // rc / (rc + 1/sr)
  let brown = 0;
  let crackle = 0;
  const crackleDecay = Math.exp(-1 / (0.00035 * sr));
  let jit = 0;
  let nextJit = 0;
  const repeat = l.repeat ?? 0;
  const lpSvf = l.lowpass && l.q ? new Svf() : null;
  const bpSvf = l.bandpass ? new Svf() : null;
  const v0 = l.vowel ? FORMANTS[l.vowel] : undefined;
  const v1 = l.vowelEnd ? FORMANTS[l.vowelEnd] ?? v0 : v0;
  const formant = v0 ? [new Svf(), new Svf(), new Svf()] : null;
  const famp = [0, 0, 0];
  const driveNorm = l.drive ? Math.tanh(l.drive) : 1;
  const fmRatio = l.fmRatio ?? 2;
  const fm0 = l.fm ?? 0;
  const fm1 = l.fmEnd ?? fm0;
  const twoPi = 2 * Math.PI;
  let f = f0;
  let fmIdx = fm0;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    const t = i / sr;
    if (i % CONTROL === 0) {
      // ---- control rate: pitch, FM index, filter coefficients
      const k = dur > 0 ? t / dur : 0;
      const kg = glide > 0 ? Math.min(1, t / glide) : 1;
      f = f0 === f1 ? f0 : f0 * Math.pow(f1 / f0, kg);
      if (l.arp && l.arp.length) f *= Math.pow(2, l.arp[Math.floor(t / (l.arpRate ?? 0.05)) % l.arp.length] / 12);
      if (l.vibrato) f *= Math.pow(2, (l.vibrato * Math.sin(twoPi * (l.vibratoRate ?? 6) * t)) / 12);
      if (l.jitter) {
        if (t >= nextJit) {
          jit = rnd();
          nextJit = t + 1 / (l.jitterRate ?? 30);
        }
        f *= Math.pow(2, (l.jitter * jit) / 12);
      }
      fmIdx = fm0 + (fm1 - fm0) * k;
      if (l.lowpass) {
        const cut = l.lowpassEnd !== undefined ? l.lowpass * Math.pow(l.lowpassEnd / l.lowpass, k) : l.lowpass;
        if (lpSvf) lpSvf.set(cut, l.q!, sr);
        else lpA = 1 - Math.exp((-twoPi * Math.min(cut, sr * 0.45)) / sr);
      }
      if (bpSvf) bpSvf.set(l.bandpassEnd !== undefined ? l.bandpass! * Math.pow(l.bandpassEnd / l.bandpass!, k) : l.bandpass!, l.q ?? 2, sr);
      if (formant && v0 && v1)
        for (let j = 0; j < 3; j++) {
          const fc = v0[j][0] + (v1[j][0] - v0[j][0]) * k;
          famp[j] = v0[j][1] + (v1[j][1] - v0[j][1]) * k;
          formant[j].set(fc, fc / (50 + 0.06 * fc), sr);
        }
    }
    // ---- envelope (audio rate: transients need it)
    const et = repeat > 0 ? t % repeat : t;
    let env: number;
    if (et < attack) env = et / attack;
    else if (et < attack + hold) env = 1;
    else {
      const d = (et - attack - hold) / (repeat > 0 ? Math.min(decay, repeat - attack - hold) || decay : decay);
      if (d >= 1) env = 0;
      else {
        const u = 1 - d;
        env = curve === 2 ? u * u : curve === 1 ? u : curve === 3 ? u * u * u : Math.pow(u, curve);
      }
    }
    if (env === 0 && wave !== 'brown' && !lpSvf && !bpSvf && !formant && !l.lowpass && !l.highpass) {
      phase += f / sr;
      continue;
    }
    if (l.tremolo) env *= 1 - l.tremolo * (0.5 + 0.5 * Math.sin(twoPi * (l.tremoloRate ?? 12) * t));
    // ---- oscillator (with optional FM)
    phase += f / sr;
    let ph = phase;
    if (fmIdx) {
      modPhase += (f * fmRatio) / sr;
      ph += (fmIdx * Math.sin(twoPi * modPhase)) / twoPi;
    }
    let s: number;
    switch (wave) {
      case 'square': {
        const p = ph - Math.floor(ph);
        s = p < duty ? 1 : -1;
        break;
      }
      case 'saw': {
        const p = ph - Math.floor(ph);
        s = 2 * p - 1;
        break;
      }
      case 'triangle': {
        const p = ph - Math.floor(ph);
        s = p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
        break;
      }
      case 'sine':
        s = Math.sin(twoPi * ph);
        break;
      case 'metal': {
        const p = ph - Math.floor(ph);
        s = metal[Math.floor(p * 32) & 31];
        break;
      }
      case 'brown':
        brown = (brown + 0.02 * rnd()) / 1.02;
        s = brown * 3.5;
        break;
      case 'crackle': {
        const u = (rnd() + 1) * 0.5;
        if (u < f / sr) crackle = (0.35 + 0.65 * ((rnd() + 1) * 0.5)) * (rnd() > 0 ? 1 : -1);
        else crackle *= crackleDecay;
        s = crackle;
        break;
      }
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
    if (l.ring) s *= Math.sin(twoPi * l.ring * t);
    if (l.drive) s = Math.tanh(s * l.drive) / driveNorm;
    // ---- filters
    if (l.lowpass) {
      if (lpSvf) {
        lpSvf.tick(s);
        s = lpSvf.low;
      } else {
        lp += lpA * (s - lp);
        s = lp;
      }
    }
    if (l.highpass) {
      hpOut = hpA * (hpOut + s - hpPrev);
      hpPrev = s;
      s = hpOut;
    }
    if (bpSvf) {
      bpSvf.tick(s);
      s = bpSvf.band;
    }
    if (formant) {
      let acc = 0;
      for (let j = 0; j < 3; j++) {
        formant[j].tick(s);
        acc += formant[j].band * famp[j];
      }
      s = acc * 1.6;
    }
    out[idx] += s * env * vol;
  }
}

function renderSfx(ctx: BaseAudioContext, def: SfxDef): AudioBuffer {
  const samples = renderSfxSamples(def, ctx.sampleRate);
  const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buf.getChannelData(0).set(samples);
  return buf;
}

export const audio = new AudioEngine();
