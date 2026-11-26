// Sound test: browse and play every song, sound effect and announcer line.

import type { Scene } from '../engine/scene';
import { audio } from '../engine/audio';
import { drawText } from '../engine/font';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { pad } from '../engine/math';
import { app } from '../app';
import { Menu } from './menu';
import { backdrop } from './backdrop';
import { C, backButton, blink, enterMenu, footer, panel, rect, text, twoTone, syncTouch } from './ui';

const VOICE_LINES = ['Mission one. Start!', 'Mission complete!', 'Thank you!', 'Heavy machine gun!', 'Rocket launcher!', 'Continue?', 'Game over', 'Congratulations!'];

export class SoundTestScene implements Scene {
  name = 'soundtest';
  time = 0;
  menu: Menu;
  song = 0;
  sfx = 0;
  voice = 0;
  playing: string | null = null;
  private lastSfx = '';
  private sfxFlash = 0;
  private songs: string[] = [];
  private sfxs: string[] = [];

  constructor() {
    this.menu = new Menu([
      {
        label: 'MUSIC',
        value: () => this.label(this.songs, this.song),
        left: () => (this.song = (this.song - 1 + Math.max(1, this.songs.length)) % Math.max(1, this.songs.length)),
        right: () => (this.song = (this.song + 1) % Math.max(1, this.songs.length)),
        action: () => this.playSong(),
        hint: 'FIRE: PLAY THE SONG',
      },
      {
        label: 'SOUND FX',
        value: () => this.label(this.sfxs, this.sfx),
        left: () => (this.sfx = (this.sfx - 1 + Math.max(1, this.sfxs.length)) % Math.max(1, this.sfxs.length)),
        right: () => (this.sfx = (this.sfx + 1) % Math.max(1, this.sfxs.length)),
        action: () => this.playSfx(),
        hint: 'FIRE: PLAY THE EFFECT',
      },
      {
        label: 'ANNOUNCER',
        value: () => `${this.voice + 1}/${VOICE_LINES.length}`,
        left: () => (this.voice = (this.voice - 1 + VOICE_LINES.length) % VOICE_LINES.length),
        right: () => (this.voice = (this.voice + 1) % VOICE_LINES.length),
        action: () => audio.say(VOICE_LINES[this.voice]),
        hint: () => `"${VOICE_LINES[this.voice].toUpperCase()}"`,
      },
      { label: 'STOP MUSIC', action: () => this.stop(), hint: 'SILENCE!' },
      { label: 'BACK', action: () => this.close() },
    ]);
    this.menu.onBack = () => this.close();
  }

  private label(list: string[], i: number): string {
    if (!list.length) return '-';
    return `${pad(i + 1, 2)} ${list[i].toUpperCase().replace(/_/g, ' ')}`;
  }

  private playSong(): void {
    const name = this.songs[this.song];
    if (!name) return;
    audio.playMusic(name, { restart: true });
    this.playing = name;
  }

  private playSfx(): void {
    const name = this.sfxs[this.sfx];
    if (!name) return;
    audio.play(name);
    this.lastSfx = name;
    this.sfxFlash = 0.4;
  }

  private stop(): void {
    audio.stopMusic(0.2);
    this.playing = null;
  }

  private close(): void {
    app.scenes.pop();
  }

  enter(): void {
    enterMenu();
    this.songs = audio.songNames();
    this.sfxs = audio.sfxNames().slice().sort();
    const cur = audio.currentSong;
    this.playing = cur;
    if (cur) this.song = Math.max(0, this.songs.indexOf(cur));
  }

  exit(): void {
    audio.playMusic('title');
  }

  update(dt: number): void {
    syncTouch(false);
    this.time += dt;
    if (this.sfxFlash > 0) this.sfxFlash -= dt;
    backdrop().update(dt);
    if (backButton(null, this.time)) {
      this.close();
      return;
    }
    this.menu.update(dt);
  }

  render(g: CanvasRenderingContext2D): void {
    backdrop().render(g, { dim: 0.62, squad: false });
    const cx = VIEW_W / 2;
    twoTone(g, 'SOUND TEST', cx, 8, C.cream, C.gold, { scale: 2, align: 'center', split: 3 });
    // Visualizer.
    panel(g, 40, 30, VIEW_W - 80, 62, 'glass', 0.92);
    const playing = this.playing && audio.currentSong === this.playing;
    const bars = 34;
    for (let i = 0; i < bars; i++) {
      const x = 50 + i * 8.5;
      const ph = this.time * (3 + (i % 5)) + i * 1.7;
      const amp = playing ? 0.35 + 0.65 * Math.abs(Math.sin(ph) * Math.sin(ph * 0.37 + i)) : 0.06 + (this.sfxFlash > 0 ? this.sfxFlash * Math.abs(Math.sin(i * 1.3)) : 0);
      const h = Math.max(1, Math.round(amp * 34));
      for (let k = 0; k < h; k += 2) {
        const col = k > 26 ? C.red : k > 18 ? C.gold : '#70e070';
        rect(g, x, 76 - k, 6, 1, col);
      }
    }
    if (playing) {
      text(g, `♪ NOW PLAYING: ${this.playing!.toUpperCase().replace(/_/g, ' ')}`, cx, 80, { align: 'center', color: blink(this.time, 1, 0.85) ? C.white : C.blue });
    } else if (this.sfxFlash > 0 && this.lastSfx) {
      text(g, `SFX: ${this.lastSfx.toUpperCase().replace(/_/g, ' ')}`, cx, 80, { align: 'center', color: C.gold });
    } else {
      text(g, 'SELECT A TRACK AND PRESS FIRE', cx, 80, { align: 'center', color: C.grey });
    }
    // Menu.
    panel(g, 52, 98, VIEW_W - 104, 76, 'steel', 0.92);
    this.menu.render(g, cx, 107, { spacing: 13, width: VIEW_W - 150 });
    const hint = this.menu.hint();
    if (hint) drawText(g, hint, cx, 180, { align: 'center', color: C.blue, outline: C.out });
    backButton(g, this.time);
    footer(g, '▲▼ SELECT  ◀▶ CHANGE  FIRE: PLAY', VIEW_H - 12);
  }
}
