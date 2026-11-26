// Attract mode loop: title (idle) -> muted autopilot demo -> high scores -> title.

import { app } from '../app';
import { characters } from '../game/characters';
import { levelForMission } from '../game/level';
import { GameSession } from '../game/session';
import { GameplayScene } from './gameplay';
import { HighScoresScene } from './highscores';
import { flow } from './flow';

/** Build the demo scene (mission 1 if it exists, else the sandbox). */
export function createDemoScene(onEnd: (byInput: boolean) => void): GameplayScene {
  const cs = characters();
  const pick = cs[Math.floor(Math.random() * cs.length)] ?? cs[0];
  const s = new GameSession({ characters: [pick?.id ?? 'dex', 'juno'], twoPlayer: false, mission: 1 });
  const levelId = levelForMission(1) ? undefined : 'sandbox';
  return new GameplayScene(s, levelId, { demo: true, onDemoEnd: onEnd });
}

export function startAttractDemo(): void {
  const scene = createDemoScene((byInput) => {
    if (byInput) flow.title();
    else app.scenes.set(new HighScoresScene({ attract: true, onDone: () => flow.title() }), { speed: 3 });
  });
  app.scenes.set(scene, { speed: 2.5 });
}
