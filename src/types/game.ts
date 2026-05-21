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
  tick: number;            // monotonically increasing across execution phases
  execPhaseStartTick: number;
  activePlanningPlayer: PlayerId; // for hot-seat
  ready: { A: boolean; B: boolean };
  winner: PlayerId | null;
  pendingDeployments: PendingDeployment[];
  moveIntents: MoveIntent[];
  sandbox: boolean;
}

export interface PendingDeployment {
  owner: PlayerId;
  defId: string;
  anchor: Vec2;
  facing: Direction;
}
