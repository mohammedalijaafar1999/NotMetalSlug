// GameplayScene: runs one mission (World + HUD), handles pause, drop-in co-op, continues,
// time-up, music changes, mission complete and game over transitions.

import type { Scene } from '../engine/scene';
import { input } from '../engine/input';
import { audio } from '../engine/audio';
import { settings } from '../engine/storage';
import { VIEW_H, VIEW_W } from '../engine/renderer';
import { app } from '../app';
import { flow } from './flow';
import { World } from '../game/world';
import { LevelRuntime, getLevel, levelForMission, type LevelDef } from '../game/level';
import { Player } from '../game/player';
import { Hud } from '../game/hud';
import type { GameSession, PlayerProfile } from '../game/session';
import type { Vehicle } from '../game/vehicle';
import { PauseScene } from './pause';
import { Bot } from '../debug/bot';

export const CONTINUE_SECONDS = 10;

export class GameplayScene implements Scene {
  name = 'gameplay';
  readonly session: GameSession;
  readonly def: LevelDef;
  world: World;
  hud = new Hud();
  phase: 'play' | 'complete' | 'gameover' = 'play';
  phaseTime = 0;
  private music = '';
  bots: (Bot | null)[] = [null, null];

  constructor(session: GameSession, levelId?: string) {
    this.session = session;
    const def = (levelId ? getLevel(levelId) : levelForMission(session.mission)) ?? getLevel('sandbox');
    if (!def) throw new Error(`No level for mission ${session.mission}`);
    this.def = def;
    this.world = this.buildWorld();
    if (app.debug.autopilot) this.enableAutopilot(true);
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
    w.level.timerEnabled = settings.timer;
    w.level.onTimeUp = () => {
      this.hud.banner('TIME UP', { color: '#ff4040', time: 1.5 });
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
    });
    return w;
  }

  spawnPlayer(w: World, prof: PlayerProfile): Player {
    const p = new Player(prof);
    const x = this.def.start.x + prof.index * 22;
    p.x = Math.max(x, w.camera.x + 40);
    p.y = w.camera.y - 8;
    if (app.debug.invincible) p.godMode = true;
    w.add(p);
    w.players.push(p);
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

  enter(): void {
    input.flush();
    this.playMusic(this.def.music);
    if (!app.debug.fast) {
      this.hud.banner(`MISSION ${this.def.mission || '-'}`, { time: 2.6, scale: 3, color: '#ffd040', sub: this.def.name });
      this.hud.banner('START!', { time: 2.6, scale: 2, color: '#ffffff' });
      audio.say(`Mission ${this.def.mission || ''}. Start!`);
    }
  }

  exit(): void {
    input.setVirtual(0, null);
    input.setVirtual(1, null);
  }

  resume(): void {
    input.flush();
  }

  private startPressed(): boolean {
    for (let i = 0; i < 2; i++) {
      const prof = this.session.players[i];
      if (prof.joined && !prof.out && input.player(i).pressed('start')) return true;
    }
    return false;
  }

  update(dt: number): void {
    this.phaseTime += dt;
    this.hud.update(dt);
    const w = this.world;

    if (this.phase === 'play' && this.startPressed()) {
      app.scenes.push(new PauseScene(this));
      return;
    }

    // Drop-in: player 2 presses start/fire on their controls.
    const p2 = this.session.players[1];
    if (!p2.joined && this.phase === 'play') {
      const i2 = input.player(1);
      if (i2.pressed('start') || i2.pressed('fire')) {
        if (input.lastDevice !== 'gamepad') input.twoPlayerKeyboard = true;
        this.session.join(1);
        p2.missionRescues = 0;
        this.spawnPlayer(w, p2);
        audio.play('coin');
        this.hud.banner('PLAYER 2 JOINED', { time: 1.5, scale: 1, color: '#9ad0ff' });
      }
    }

    for (const b of this.bots) b?.update(w);

    w.update(dt);
    this.session.playTime += dt;

    if (w.level.musicRequest) {
      this.playMusic(w.level.musicRequest);
      w.level.musicRequest = null;
    }

    // Continues.
    let anyCounting = false;
    for (let i = 0; i < 2; i++) {
      const prof = this.session.players[i];
      const t = this.hud.continueTimers[i];
      if (t < 0 || !prof.out) continue;
      const inp = input.player(i);
      if (inp.pressed('start') || inp.pressed('fire') || this.bots[i]) {
        this.session.continueGame(i as 0 | 1);
        this.hud.continueTimers[i] = -1;
        const pl = w.players.find((p) => p.index === i);
        if (pl) pl.respawn();
        audio.play('coin');
        continue;
      }
      this.hud.continueTimers[i] = t - dt * 0.9;
      if (this.hud.continueTimers[i] <= 0) this.hud.continueTimers[i] = -1;
      else anyCounting = true;
    }
    const joined = this.session.players.filter((p) => p.joined);
    if (this.phase === 'play' && joined.length && joined.every((p) => p.out) && !anyCounting) {
      this.phase = 'gameover';
      this.phaseTime = 0;
      audio.stopMusic(0.5);
    }
    if (this.phase === 'gameover' && this.phaseTime > 1.2) {
      this.phase = 'play';
      flow.gameOver(this.session);
    }

    if (this.phase === 'complete') {
      if (this.phaseTime > (app.debug.fast ? 1.0 : 5.0)) {
        this.phase = 'play';
        this.phaseTime = -999;
        flow.missionComplete(this.session, {
          mission: this.def.mission,
          kills: w.stats.kills,
          rescues: w.stats.rescues,
          time: w.stats.time,
          shotsFired: w.stats.shotsFired,
          playerRescues: this.session.players.map((p) => p.missionRescues),
        });
      }
    }
  }

  private onMissionComplete(): void {
    if (this.phase === 'complete') return;
    this.phase = 'complete';
    this.phaseTime = 0;
    for (const p of this.world.players) p.celebrate();
    this.hud.continueTimers = [-1, -1];
    this.hud.banner('MISSION', { time: 4.5, scale: 3, color: '#ffd040' });
    this.hud.banner('COMPLETE!', { time: 4.5, scale: 3, color: '#ffd040' });
    this.music = '';
    audio.playMusic('mission_complete', { restart: true });
    audio.say('Mission complete!');
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
