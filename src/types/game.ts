import type { Rng } from '../sim/rng';

export type PlayerId = 'A' | 'B';
export type Direction = 'N' | 'S' | 'E' | 'W';

export type TileColor = PlayerId | 'neutral';

export interface Board {
  size: number;            // BOARD_SIZE
  tiles: TileColor[];      // length size*size, row-major (y*size + x)
}

export interface Vec2 {
  x: number;
  y: number;
}

export type MatchPhase = 'planning' | 'execution' | 'ended';

export interface MoveIntent {
  petId: number;
  from: Vec2;
  to: Vec2;
}

export interface MatchState {
  board: Board;
  pets: import('./pet').Pet[];
  nextPetId: number;
  energy: { A: number; B: number };
  phase: MatchPhase;
  /** Monotonically increasing tick counter, across execution phases. */
  tick: number;
  execPhaseStartTick: number;
  /** For hot-seat planning; mostly informational under sandbox. */
  activePlanningPlayer: PlayerId;
  ready: { A: boolean; B: boolean };
  winner: PlayerId | null;
  /** Active move intents pushed by pet behaviors this tick; cleared by `resolveMovements`. */
  moveIntents: MoveIntent[];
  /** Sandbox mode: infinite energy, no regen, deploy anywhere on own territory. */
  sandbox: boolean;
  /** Optional seeded RNG for deterministic online sim; null in local/sandbox mode. */
  rng: Rng | null;
  /** Snapshot captured when execution starts; cleared when execution ends. */
  execStartSnapshot: RoundSnapshot | null;
  /** Result of the most recently completed execution phase; cleared when the next round starts. */
  lastRoundSummary: RoundSummary | null;
  /** Monotonic counter — round 1, round 2, …  Incremented on transition into execution. */
  round: number;
  /** Boost charges available to each side during the current execution. */
  boostCharges: { A: number; B: number };
}

export interface RoundSnapshot {
  aTiles: number;
  bTiles: number;
  aPets: number;
  bPets: number;
}

export interface RoundSummary {
  round: number;
  aTilesDelta: number;
  bTilesDelta: number;
  aTilesEnd: number;
  bTilesEnd: number;
  aLost: number;
  bLost: number;
}
