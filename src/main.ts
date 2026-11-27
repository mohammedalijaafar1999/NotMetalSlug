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
import { preload } from './scenes/preload';

/** Scenes that show the FPS counter in the bottom-right corner (elsewhere: top-right). */
const FPS_LOW_SCENES = new Set(['gameplay', 'demo', 'pause', 'briefing']);

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
  // Window blurred / tab hidden: held keys were released; gameplay opens its pause menu.
  input.onFocusLost = () => {
    const s = app.scenes.current as { autoPause?: () => boolean } | undefined;
    s?.autoPause?.();
  };
  installDebugApi();
  // Background sprite baking status (perf checks: remaining, bakedMs, forcedFrames).
  (window as unknown as { __preload: typeof preload }).__preload = preload;
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
        // Bottom-right is free in gameplay; menu screens keep footers / hint panels there.
        r.g.setTransform(1, 0, 0, 1, 0, 0);
        const low = FPS_LOW_SCENES.has(app.scenes.current?.name ?? '');
        drawText(r.g, `${app.loop.fps} FPS`, VIEW_W - 3, low ? 205 : 2, { align: 'right', color: '#80ff80', outline: '#140c1c' });
      }
      r.present();
      // Sprites the title did not need bake in the background, a few ms per frame (more on a
      // static screen that asks for it, e.g. the briefing card).
      preload.step((app.scenes.current as { preloadBudget?: number } | undefined)?.preloadBudget);
    },
  );
  app.scenes.set(new BootScene(), { fade: false });
  app.loop.start();
  // (No ducking here: the audio engine suspends itself while the tab is hidden, and un-ducking
  // on return would fight the pause menu's own duck.)
}

main();
