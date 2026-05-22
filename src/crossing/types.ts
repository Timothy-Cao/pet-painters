/**
 * types.ts — Core types for Critter Crossing v2.
 *
 * Redesigned for fast, interactive games:
 * - 8×8 board, no water
 * - 5 units per side with chess-inspired movement
 * - Capture = send enemy to home row (respawn)
 * - Win = get 3 of your 5 units to opponent's back row
 */

export type PlayerId = 'A' | 'B';

export interface Vec2 {
  x: number; // column 0..7
  y: number; // row 0..7
}

export type UnitTerrain = 'land';

export interface UnitDef {
  id: string;
  displayName: string;
  emoji: string;
  size: 1;
  terrain: UnitTerrain;
  /** Brief description of the unit's movement. */
  moveDesc: string;
  /** One-line ability note. */
  abilityDesc: string;
}

export interface CUnit {
  unitId: number;
  defId: string;
  owner: PlayerId;
  pos: Vec2;
  /** True if the unit is on the opponent's back row (scored but stays on board). */
  scored: boolean;

  // ── Animation state ──
  animFrom?: Vec2;
  animStart?: number;
}

export interface VFX {
  type: 'score-flash' | 'capture' | 'push';
  pos: Vec2;
  size: number;
  owner: PlayerId;
  startTime: number;
  duration: number;
}

export type GamePhase = 'playing' | 'ended';

export interface CGameState {
  units: CUnit[];
  nextUnitId: number;
  phase: GamePhase;
  currentPlayer: PlayerId;
  /** How many units each player has scored (reached far wall). */
  scored: { A: number; B: number };
  /** Units needed to win. */
  scoreToWin: number;
  winner: PlayerId | null;
  selectedUnitId: number | null;
  turn: number;

  // ── Visual state ──
  vfx: VFX[];
  hoverTile: Vec2 | null;
  lastMove: { unitId: number; from: Vec2; to: Vec2 } | null;
}
