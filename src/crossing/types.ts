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

  // ── Animation state (managed by game.ts, consumed by render.ts) ──
  /** Previous position for slide animation. */
  animFrom?: Vec2;
  /** Animation start timestamp (performance.now()). */
  animStart?: number;
}

/** Visual effect for rendering (scoring flash, last-move marker, etc). */
export interface VFX {
  type: 'score-flash' | 'last-move' | 'push';
  pos: Vec2;
  /** Size of the unit (for footprint rendering). */
  size: number;
  /** Who triggered / owns this effect. */
  owner: PlayerId;
  startTime: number;
  /** Duration in ms. */
  duration: number;
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

  // ── Visual state ──
  /** Active visual effects (auto-cleaned by renderer). */
  vfx: VFX[];
  /** Tile hovered by the cursor (for highlight). */
  hoverTile: Vec2 | null;
  /** Last move made (for showing what AI did). */
  lastMove: { unitId: number; from: Vec2; to: Vec2 } | null;
}
