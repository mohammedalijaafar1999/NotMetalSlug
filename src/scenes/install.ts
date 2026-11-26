// Installs the full front-end scene flow (run from a startup hook, after main.ts's defaults):
//   title -> (new game) character select -> briefing -> gameplay -> tally -> next briefing ...
//   -> ending -> name entry -> high scores -> title;  game over -> name entry -> high scores.

import { app } from '../app';
import { input } from '../engine/input';
import { applyUrlParams } from '../debug/api';
import { flow } from './flow';
import { TitleScene } from './title';
import { CharSelectScene } from './charselect';
import { BriefingScene } from './briefing';
import { GameplayScene } from './gameplay';
import { TallyScene } from './tally';
import { GameOverScene } from './gameover';
import { EndingScene } from './ending';
import { OptionsScene } from './options';

let installed = false;

export function installUiFlow(): void {
  installed = true;
  let first = true;
  flow.title = () => {
    if (first) {
      first = false;
      // Debug URL params (?mission=N, ?level=id ...) still jump straight into a mission.
      if (applyUrlParams()) return;
    }
    input.twoPlayerKeyboard = false;
    app.scenes.set(new TitleScene());
  };
  flow.newGame = ({ twoPlayer, mission }) => app.scenes.set(new CharSelectScene({ twoPlayer, mission }));
  flow.mission = (s) => {
    // Fast mode (tests / smoke runs) skips the briefing card.
    if (app.debug.fast) app.scenes.set(new GameplayScene(s));
    else app.scenes.set(new BriefingScene(s));
  };
  flow.missionComplete = (s, stats) => app.scenes.set(new TallyScene(s, stats));
  flow.gameOver = (s) => app.scenes.set(new GameOverScene(s));
  flow.ending = (s) => app.scenes.set(new EndingScene(s), { speed: 1.5 });
  flow.options = () => app.scenes.push(new OptionsScene());
}

export function uiFlowInstalled(): boolean {
  return installed;
}
