// GameplayScene: runs one mission (World + HUD), handles pause, drop-in co-op, continues
// (full-screen CONTINUE? when everyone is out), time-up, music changes, mission complete and
// game over transitions. Also runs the attract-mode demo (opts.demo).

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { settings } from '../engine/storage';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { drawText } from '../engine/font';
import { app } from '../app';
import { flow } from './flow';
import { World } from '../game/world';
import { LevelRuntime, getLevel, levelForMission, type LevelDef } from '../game/level';
import { Player } from '../game/player';
import { Hud, continueState } from '../game/hud';
import type { GameSession, PlayerProfile } from '../game/session';
import type { Vehicle } from '../game/vehicle';
import { PauseScene } from './pause';
import { Bot } from '../debug/bot';
import { C, blink, panel, sharedKeysHint, syncTouch, twoTone, uiInput, uiSfx } from './ui';

export const CONTINUE_SECONDS = 10;
/** Attract demo length (seconds). */
export const DEMO_SECONDS = 45;

export interface GameplayOptions {
  /** Attract-mode demo: autopilot plays muted; any real input or the end calls onDemoEnd. */
  demo?: boolean;
  /** byInput: a human pressed something (go to the title) vs the demo ran out. */
  onDemoEnd?: (byInput: boolean) => void;
}

interface ProfileSnapshot {
  joined: boolean;
  character: string;
  score: number;
  lives: number;
  continues: number;
  kills: number;
  rescues: number;
  out: boolean;
}

export class GameplayScene implements Scene {
  name = 'gameplay';
  readonly session: GameSession;
  readonly def: LevelDef;
  readonly levelId?: string;
  world: World;
  hud = new Hud();
  phase: 'play' | 'complete' | 'gameover' = 'play';
  phaseTime = 0;
  private music = '';
  bots: (Bot | null)[] = [null, null];
  readonly demo: boolean;
  private onDemoEnd: ((byInput: boolean) => void) | null;
  private demoEnded = false;
  private demoTime = 0;
  private prevMuted = false;
  /** Profiles as they were when the mission started (restart). */
  private snapshot: ProfileSnapshot[];
  private killsAtStart: number[];
  /** True while every joined player is out and counting down (world frozen). */
  continueScreen = false;
  private wasContinueScreen = false;
  private lastDigit = [-1, -1];

  constructor(session: GameSession, levelId?: string, opts: GameplayOptions = {}) {
    this.session = session;
    this.levelId = levelId;
    this.demo = !!opts.demo;
    this.onDemoEnd = opts.onDemoEnd ?? null;
    if (this.demo) this.name = 'demo';
    this.snapshot = session.players.map((p) => ({ joined: p.joined, character: p.character, score: p.score, lives: p.lives, continues: p.continues, kills: p.kills, rescues: p.rescues, out: p.out }));
    this.killsAtStart = session.players.map((p) => p.kills);
    const def = (levelId ? getLevel(levelId) : levelForMission(session.mission)) ?? getLevel('sandbox');
    if (!def) throw new Error(`No level for mission ${session.mission}`);
    this.def = def;
    this.hud.demo = this.demo;
    this.hud.allowJoin = !this.demo;
    this.world = this.buildWorld();
    if (app.debug.autopilot || this.demo) this.enableAutopilot(true);
    if (this.demo) for (const p of this.world.players) p.godMode = true;
  }

  enableAutopilot(on: boolean): void {
    for (let i = 0; i < 2; i++) {
      if (on && this.session.players[i].joined) this.bots[i] = new Bot(i);
      else {
        this.bots[i] = null;
        input.setVirtual(i, null);
      }
    }
  }

  private buildWorld(): World {
    const def = this.def;
    const seed = app.debug.seed ?? ((Date.now() ^ (Math.random() * 1e9)) & 0xffffff);
    const w = new World(def.width, def.height, this.session, seed);
    w.level = new LevelRuntime(w, def);
    w.level.timerEnabled = settings.timer && !this.demo;
    w.level.onTimeUp = () => {
      this.hud.banner('TIME UP', { color: C.red, time: 1.5, scale: 2 });
      for (const p of w.players) if (p.state === 'play' || p.state === 'vehicle') p.kill();
    };
    w.onShake = (m, d) => app.renderer?.shake(m, d);
    w.onFlash = (c, a) => {
      if (settings.flashes) app.renderer?.flash(c, a);
    };
    const startY = def.start.y ?? w.terrain.topFloorAt(def.start.x) ?? def.height - 40;
    w.camera.snapTo(def.start.x, startY);
    for (const prof of this.session.players) {
      prof.missionRescues = 0;
      if (prof.joined && !prof.out) this.spawnPlayer(w, prof);
    }
    w.on('announce', (e) => {
      if (e.text) this.hud.banner(e.text, { color: e.color, time: e.time, sub: e.sub });
    });
    w.on('bossStart', () => {
      this.playMusic(def.bossMusic ?? 'boss');
    });
    w.on('missionComplete', () => this.onMissionComplete());
    w.on('playerOut', (e) => {
      this.hud.continueTimers[e.player.index] = CONTINUE_SECONDS;
      this.lastDigit[e.player.index] = -1;
    });
    return w;
  }

  /**
   * Add a player to the world. At the mission start they drop in at the level start (or sit in
   * the level's start vehicle). A mid-mission drop-in (`dropIn`) uses the regular respawn: next
   * to the partner, over solid ground, with the respawn invulnerability (also for the vehicle).
   */
  spawnPlayer(w: World, prof: PlayerProfile, dropIn = false): Player {
    const p = new Player(prof);
    const x = this.def.start.x + prof.index * 22;
    p.x = Math.max(x, w.camera.x + 40);
    p.y = w.camera.y - 8;
    if (app.debug.invincible || this.demo) p.godMode = true;
    w.add(p);
    w.players.push(p);
    if (dropIn) {
      p.respawn();
      return p;
    }
    if (this.def.startVehicle) {
      const v = w.spawn(this.def.startVehicle, p.x, p.y + 40) as Vehicle | null;
      if (v && (v as any).isVehicle) {
        p.state = 'play';
        p.hittable = true;
        v.enter(p);
      }
    }
    return p;
  }

  private playMusic(name: string): void {
    if (this.music === name) return;
    this.music = name;
    audio.playMusic(name);
  }

  /** Restart this mission from its beginning (scores/lives as they were at mission start). */
  restart(): void {
    this.snapshot.forEach((s, i) => Object.assign(this.session.players[i], s, { missionRescues: 0 }));
    // A player 2 who dropped in mid-mission is un-joined again: back to the solo keyboard layout.
    if (!this.session.players[1].joined) input.twoPlayerKeyboard = false;
    app.scenes.set(new GameplayScene(this.session, this.levelId));
  }

  enter(): void {
    input.flush();
    uiInput.attach();
    uiInput.flush();
    if (this.demo) {
      this.prevMuted = audio.muted;
      audio.setMuted(true);
    }
    this.playMusic(this.def.music);
    if (!app.debug.fast) {
      this.hud.banner(`MISSION ${this.def.mission || '-'}`, { time: 2.8, scale: 3, color: C.gold, sub: this.def.name });
      this.hud.banner('START!', { time: 2.6, scale: 2, color: C.white });
      if (!this.demo) audio.say(`Mission ${this.def.mission || ''}. Start!`);
    }
  }

  exit(): void {
    input.setVirtual(0, null);
    input.setVirtual(1, null);
    if (this.demo) audio.setMuted(this.prevMuted);
  }

  resume(): void {
    input.flush();
    uiInput.flush();
    // Options may have changed while paused.
    if (!this.demo) this.world.level.timerEnabled = settings.timer;
  }

  /**
   * The window lost focus or the tab was hidden: open the pause menu so nobody dies while away
   * (also freezes a running continue countdown). Not in the demo or while the mission is ending.
   */
  autoPause(): boolean {
    if (this.demo || this.phase !== 'play' || app.loop?.manual || app.debug.autopilot) return false;
    if (!app.scenes || app.scenes.current !== this || app.scenes.transitioning) return false;
    app.scenes.push(new PauseScene(this));
    return true;
  }

  private startPressed(): boolean {
    for (let i = 0; i < 2; i++) {
      const prof = this.session.players[i];
      if (prof.joined && !prof.out && input.player(i).pressed('start')) return true;
    }
    // Esc / P / Enter pause too (Esc is only bound to P1 in the solo layout), unless the press
    // came from a player who is joining or continuing.
    if (!input.menu.pressed('start')) return false;
    for (let i = 0; i < 2; i++) {
      const prof = this.session.players[i];
      if ((!prof.joined || prof.out) && (input.player(i).pressed('start') || input.player(i).pressed('fire'))) return false;
    }
    return true;
  }

  private endDemo(byInput = false): void {
    if (this.demoEnded) return;
    this.demoEnded = true;
    if (this.onDemoEnd) this.onDemoEnd(byInput);
    else flow.title();
  }

  update(dt: number): void {
    this.phaseTime += dt;
    this.hud.update(dt, this.world);
    const w = this.world;
    syncTouch(!this.demo);

    if (this.demo) {
      this.demoTime += dt;
      if (uiInput.takeActivity() && this.demoTime > 0.5) {
        this.endDemo(true);
        return;
      }
      if (this.demoTime > DEMO_SECONDS || this.phase !== 'play') {
        this.endDemo(false);
        return;
      }
    }

    const cs = continueState(this.session, this.hud.continueTimers);
    this.continueScreen = cs.allOut && cs.counting;
    if (this.continueScreen && !this.wasContinueScreen && !this.demo) audio.say('Continue?');
    this.wasContinueScreen = this.continueScreen;

    if (!this.demo && this.phase === 'play' && !this.continueScreen && this.startPressed()) {
      app.scenes.push(new PauseScene(this));
      return;
    }

    // Drop-in: player 2 presses start/fire on their controls.
    const p2 = this.session.players[1];
    if (!this.demo && !p2.joined && this.phase === 'play') {
      const i2 = input.player(1);
      if (i2.pressed('start') || i2.pressed('fire')) {
        const shared = input.lastDevice !== 'gamepad';
        if (shared) input.twoPlayerKeyboard = true;
        this.session.join(1);
        p2.missionRescues = 0;
        this.killsAtStart[1] = p2.kills;
        this.spawnPlayer(w, p2, true);
        audio.play('coin');
        // Sharing the keyboard moves player 1 off the arrows: say so.
        this.hud.banner('PLAYER 2 JOINED', { time: shared ? 3.5 : 1.5, scale: 1, color: C.blue, sub: shared ? sharedKeysHint() : undefined });
      }
    }

    for (const b of this.bots) b?.update(w);

    if (!this.continueScreen) {
      w.update(dt);
      this.session.playTime += dt;
    }

    if (w.level.musicRequest) {
      this.playMusic(w.level.musicRequest);
      w.level.musicRequest = null;
    }

    if (this.phase === 'play') this.updateContinues(dt);

    const after = continueState(this.session, this.hud.continueTimers);
    if (this.phase === 'play' && after.allOut && !after.counting) {
      this.phase = 'gameover';
      this.phaseTime = 0;
      audio.stopMusic(0.5);
    }
    if (this.phase === 'gameover' && this.phaseTime > 1.2) {
      this.phase = 'play';
      this.phaseTime = -999;
      if (this.demo) this.endDemo();
      else flow.gameOver(this.session);
      return;
    }

    if (this.phase === 'complete') {
      if (this.phaseTime > (app.debug.fast ? 1.0 : 5.0)) {
        this.phase = 'play';
        this.phaseTime = -999;
        if (this.demo) {
          this.endDemo();
          return;
        }
        flow.missionComplete(this.session, {
          mission: this.def.mission,
          kills: w.stats.kills,
          rescues: w.stats.rescues,
          time: w.stats.time,
          shotsFired: w.stats.shotsFired,
          playerRescues: this.session.players.map((p) => p.missionRescues),
          playerKills: this.session.players.map((p, i) => Math.max(0, p.kills - (this.killsAtStart[i] ?? 0))),
          levelId: this.def.id,
        });
      }
    }
  }

  /** Continue countdowns, continuing (start/fire/tap) and late re-joins. */
  private updateContinues(dt: number): void {
    const profs = this.session.players;
    const anyoneIn = profs.some((p) => p.joined && !p.out);
    for (let i = 0; i < 2; i++) {
      const prof = profs[i];
      if (!prof.joined || !prof.out) continue;
      const t = this.hud.continueTimers[i];
      const inp = input.player(i);
      const tapped = this.continueScreen && i === 0 && !!uiInput.takeTap();
      const wants = inp.pressed('start') || inp.pressed('fire') || !!this.bots[i] || tapped;
      if (t >= 0) {
        if (wants) {
          this.doContinue(i as 0 | 1);
          continue;
        }
        const nt = t - dt;
        this.hud.continueTimers[i] = nt <= 0 ? -1 : nt;
        const digit = Math.floor(Math.max(0, nt));
        if (nt > 0 && digit !== this.lastDigit[i]) {
          if (this.lastDigit[i] >= 0) uiSfx('countdown_tick', { vol: this.continueScreen ? 1 : 0.5 });
          this.lastDigit[i] = digit;
        }
      } else if (wants && anyoneIn) {
        this.doContinue(i as 0 | 1);
      }
    }
  }

  private doContinue(i: 0 | 1): void {
    this.session.continueGame(i);
    this.hud.continueTimers[i] = -1;
    this.lastDigit[i] = -1;
    const pl = this.world.players.find((p) => p.index === i);
    if (pl) pl.respawn();
    else this.spawnPlayer(this.world, this.session.players[i]);
    audio.play('coin');
    this.hud.banner(`${i + 1}P CONTINUE!`, { time: 1.2, scale: 1, color: i === 0 ? C.p1 : C.p2 });
    this.continueScreen = false;
  }

  private onMissionComplete(): void {
    if (this.phase === 'complete') return;
    this.phase = 'complete';
    this.phaseTime = 0;
    for (const p of this.world.players) p.celebrate();
    this.hud.continueTimers = [-1, -1];
    this.hud.banner('MISSION', { time: 4.5, scale: 3, color: C.gold });
    this.hud.banner('COMPLETE!', { time: 4.5, scale: 3, color: C.gold });
    this.music = '';
    audio.playMusic('mission_complete', { restart: true });
    if (!this.demo) audio.say('Mission complete!');
  }

  render(g: CanvasRenderingContext2D): void {
    const r = app.renderer;
    this.world.render(g, r?.shakeX ?? 0, r?.shakeY ?? 0);
    if (app.debug.showHitboxes) this.renderHitboxes(g);
    this.hud.render(g, this.world);
    if (this.phase === 'gameover') {
      g.fillStyle = `rgba(0,0,0,${Math.min(0.6, this.phaseTime)})`;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (this.demo) this.renderDemoOverlay(g);
  }

  private renderDemoOverlay(g: CanvasRenderingContext2D): void {
    panel(g, VIEW_W / 2 - 76, VIEW_H - 34, 152, 28, 'dark', 0.82);
    if (blink(this.demoTime, 1.2, 0.7)) twoTone(g, 'DEMO PLAY', VIEW_W / 2, VIEW_H - 30, C.white, C.gold, { scale: 2, align: 'center', split: 3 });
    drawText(g, 'PRESS START', VIEW_W / 2, VIEW_H - 14, { align: 'center', color: C.grey, outline: C.out });
  }

  private renderHitboxes(g: CanvasRenderingContext2D): void {
    const c = this.world.camera;
    g.setTransform(1, 0, 0, 1, -Math.round(c.x), -Math.round(c.y));
    g.globalAlpha = 0.5;
    for (const e of this.world.entities) {
      if (!e.hittable) continue;
      g.strokeStyle = e.team === 'player' ? '#40ff40' : e.team === 'enemy' ? '#ff4040' : '#4080ff';
      for (const hb of e.hurtboxes()) g.strokeRect(Math.round(hb.x) + 0.5, Math.round(hb.y) + 0.5, Math.round(hb.w), Math.round(hb.h));
    }
    g.strokeStyle = '#ffff00';
    for (const s of this.world.terrain.surfaces) {
      if (s.disabled) continue;
      g.beginPath();
      g.moveTo(s.x1, s.y1);
      g.lineTo(s.x2, s.y2);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}
