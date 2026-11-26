// Scene flow hooks. main.ts installs default implementations; UI modules may replace them
// (e.g. to insert a character-select or briefing screen) by assigning new functions.

import type { GameSession } from '../game/session';

export interface MissionStats {
  mission: number;
  kills: number;
  rescues: number;
  time: number;
  shotsFired: number;
  /** Per-player rescued counts for this mission. */
  playerRescues: number[];
}

export const flow = {
  /** Go to the title screen. */
  title: (): void => {},
  /** Start a new game from the menu (1 or 2 players, optional start mission). */
  newGame: (_opts: { twoPlayer: boolean; mission?: number }): void => {},
  /** Start (or restart) the session's current mission. */
  mission: (_session: GameSession): void => {},
  /** Mission cleared: show tally then continue. */
  missionComplete: (_session: GameSession, _stats: MissionStats): void => {},
  /** All players out of continues. */
  gameOver: (_session: GameSession): void => {},
  /** Final mission cleared. */
  ending: (_session: GameSession): void => {},
  /** Open the options screen as an overlay (from title or pause). */
  options: (): void => {},
};
