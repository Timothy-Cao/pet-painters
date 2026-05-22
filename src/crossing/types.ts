/**
 * types.ts — Core types for Critter Crossing.
 *
 * Completely independent from Pet Painters types.
 */

export type PlayerId = 'A' | 'B';
export type Terrain = 'land' | 'water';

export interface Vec2 {
  x: number; // column 0..11
  y: number; // row 0..11
}

/** Terrain classification for movement rules. */
export type UnitTerrain = 'land' | 'water' | 'amphibious' | 'flying';

export interface UnitDef {
  id: string;
  displayName: string;
  emoji: string;
  /** 1 for small units, 2 for 2×2 large units. */
  size: number;
  /** What terrain this unit can occupy. */
  terrain: UnitTerrain;
  /** Brief description of the unit's ability. */
  abilityDesc: string;
}

export interface CUnit {
  unitId: number;
  defId: string;
  owner: PlayerId;
  pos: Vec2;
  /** True if the unit has been scored (crossed the goal line). */
  scored: boolean;
}

export interface CBoard {
  size: number; // 12
  /** Row-major terrain map (size*size). */
  terrain: Terrain[];
}

export type GamePhase = 'placing' | 'playing' | 'ended';

export interface CGameState {
  board: CBoard;
  units: CUnit[];
  nextUnitId: number;
  phase: GamePhase;
  /** Whose turn it is. */
  currentPlayer: PlayerId;
  /** Score: how many units each player has crossed. */
  scored: { A: number; B: number };
  /** Total units each player started with. */
  totalUnits: { A: number; B: number };
  winner: PlayerId | null;
  /** The currently selected unit (for UI). */
  selectedUnitId: number | null;
  /** Turn counter. */
  turn: number;
}
