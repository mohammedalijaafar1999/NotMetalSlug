// Entry point: wires engine services, installs default scene flow, boots.

import './content';
import { Renderer } from './engine/renderer';
import { GameLoop } from './engine/loop';
import { SceneManager } from './engine/scene';
import { input } from './engine/input';
import { audio } from './engine/audio';
import { settings, progress, saveProgress } from './engine/storage';
import { drawText } from './engine/font';
import { VIEW_W } from './engine/renderer';
import { app } from './app';
import { flow } from './scenes/flow';
import { BootScene, TitleScene, TallyScene, GameOverScene, SimpleOptionsScene } from './scenes/core-scenes';
import { GameplayScene } from './scenes/gameplay';
import { GameSession } from './game/session';
import { installDebugApi, applyUrlParams } from './debug/api';
import { applySettings } from './settings-apply';
import { startupHooks } from './hooks';

function installDefaultFlow(): void {
  let first = true;
  flow.title = () => {
    if (first) {
      first = false;
      if (applyUrlParams()) return;
    }
    app.scenes.set(new TitleScene());
  };
  flow.newGame = ({ twoPlayer, mission }) => {
    const s = new GameSession({ characters: ['dex', 'juno'], twoPlayer, mission });
    progress.plays++;
    saveProgress();
    flow.mission(s);
  };
  flow.mission = (s) => app.scenes.set(new GameplayScene(s));
  flow.missionComplete = (s, stats) => app.scenes.set(new TallyScene(s, stats));
  flow.gameOver = (s) => app.scenes.set(new GameOverScene(s));
  flow.ending = (s) => app.scenes.set(new GameOverScene(s, true));
  flow.options = () => app.scenes.push(new SimpleOptionsScene());
}

function main(): void {
  const container = document.getElementById('game')!;
  app.renderer = new Renderer(container);
  app.scenes = new SceneManager();
  app.scenes.onChange = () => input.flush();
  input.start();
  input.onFirstGesture = () => audio.unlock();
  installDebugApi();
  installDefaultFlow();
  // Content modules may override flow hooks / install UI; give them a chance.
  for (const fn of startupHooks) fn();
  applySettings();
  app.loop = new GameLoop(
    (dt) => {
      input.poll(dt);
      app.scenes.update(dt);
      app.renderer.update(dt);
    },
    () => {
      const r = app.renderer;
      r.beginFrame();
      app.scenes.render(r.g);
      if (settings.showFps) {
        r.g.setTransform(1, 0, 0, 1, 0, 0);
        drawText(r.g, `${app.loop.fps} FPS`, VIEW_W - 3, 205, { align: 'right', color: '#80ff80' });
      }
      r.present();
    },
  );
  app.scenes.set(new BootScene(), { fade: false });
  app.loop.start();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.duck(true);
    else audio.duck(false);
  });
}

main();
