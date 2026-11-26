// GameSession: state that persists across missions in one playthrough (scores, lives, characters).

import { settings, type Difficulty } from '../engine/storage';

export interface PlayerProfile {
  index: 0 | 1;
  character: string;
  joined: boolean;
  score: number;
  lives: number;
  continues: number;
  kills: number;
  rescues: number;
  /** Per-mission rescued hostage count (reset each mission). */
  missionRescues: number;
  /** True while waiting at the continue prompt. */
  out: boolean;
}

export class GameSession {
  players: PlayerProfile[];
  mission: number;
  startMission: number;
  difficulty: Difficulty;
  /** Lives granted per credit. */
  livesPerCredit: number;
  /** Set when the run was started from Mission Select (still eligible for high scores). */
  fromSelect: boolean;
  /** Total time played (s). */
  playTime = 0;

  constructor(opts: { characters: [string, string?]; mission?: number; difficulty?: Difficulty; twoPlayer?: boolean }) {
    this.mission = opts.mission ?? 1;
    this.startMission = this.mission;
    this.fromSelect = this.mission > 1;
    this.difficulty = opts.difficulty ?? settings.difficulty;
    this.livesPerCredit = settings.lives;
    this.players = [0, 1].map((i) => ({
      index: i as 0 | 1,
      character: (i === 0 ? opts.characters[0] : opts.characters[1]) ?? (i === 0 ? 'dex' : 'juno'),
      joined: i === 0 || !!opts.twoPlayer,
      score: 0,
      lives: this.livesPerCredit,
      continues: 0,
      kills: 0,
      rescues: 0,
      missionRescues: 0,
      out: false,
    }));
  }

  get twoPlayer(): boolean {
    return this.players[1].joined;
  }

  /** Drop-in join for player 2 mid-game. */
  join(i: 0 | 1, character?: string): PlayerProfile {
    const p = this.players[i];
    if (!p.joined) {
      p.joined = true;
      p.lives = this.livesPerCredit;
      p.out = false;
      if (character) p.character = character;
    }
    return p;
  }

  continueGame(i: 0 | 1): void {
    const p = this.players[i];
    p.continues++;
    p.lives = this.livesPerCredit;
    p.out = false;
  }

  totalScore(): number {
    return this.players.reduce((s, p) => s + (p.joined ? p.score : 0), 0);
  }
}
