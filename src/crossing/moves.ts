/**
 * moves.ts — Movement engine for Critter Crossing v2.
 *
 * Chess-inspired movement with capture = respawn mechanic.
 *
 * Unit roles:
 * - Mouse: rook-like (1-2 orthogonal), slips through units
 * - Cat: bishop-like (1-2 diagonal), checkers-capture (hop over enemy)
 * - Rabbit: knight-like (L-shape), hops over everything
 * - Eagle: queen-like (1-3 any dir), but CANNOT capture
 * - Elephant: king-like (1 orthogonal), pushes enemies, immune to capture
 */

import type { CGameState, CUnit, Vec2 } from './types';
import { getUnitDef } from './units';
import { BOARD_SIZE, inBounds, homeRow } from './board';

// ── Helpers ────────────────────────────────────────────────────────────

/** Find which unit (if any) occupies a tile. */
function unitAt(state: CGameState, pos: Vec2, excludeId: number = -1): CUnit | null {
  for (const u of state.units) {
    if (u.unitId === excludeId) continue;
    if (u.pos.x === pos.x && u.pos.y === pos.y) return u;
  }
  return null;
}

/** Check if a tile is empty. */
function isEmpty(state: CGameState, pos: Vec2, excludeId: number = -1): boolean {
  return !unitAt(state, pos, excludeId);
}

const DIRS_ORTHO: Vec2[] = [
  { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
];

const DIRS_DIAG: Vec2[] = [
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

const DIRS_ALL: Vec2[] = [...DIRS_ORTHO, ...DIRS_DIAG];

const KNIGHT_MOVES: Vec2[] = [
  { x: 1, y: 2 }, { x: 2, y: 1 }, { x: 2, y: -1 }, { x: 1, y: -2 },
  { x: -1, y: -2 }, { x: -2, y: -1 }, { x: -2, y: 1 }, { x: -1, y: 2 },
];

// ── Move types ─────────────────────────────────────────────────────────

export interface MoveOption {
  to: Vec2;
  /** If this move captures an enemy, which unit? */
  captureId: number | null;
  /** If this move pushes an enemy, details. */
  push: { unitId: number; to: Vec2 } | null;
}

// ── Valid move computation ─────────────────────────────────────────────

export function getValidMoves(state: CGameState, unit: CUnit): MoveOption[] {
  const def = getUnitDef(unit.defId);
  switch (def.id) {
    case 'mouse': return getMouseMoves(state, unit);
    case 'cat': return getCatMoves(state, unit);
    case 'rabbit': return getRabbitMoves(state, unit);
    case 'eagle': return getEagleMoves(state, unit);
    case 'elephant': return getElephantMoves(state, unit);
    default: return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MOUSE — 1-2 tiles orthogonal, slips through occupied tiles
// ═══════════════════════════════════════════════════════════════════════

function getMouseMoves(state: CGameState, unit: CUnit): MoveOption[] {
  const moves: MoveOption[] = [];

  for (const d of DIRS_ORTHO) {
    for (let r = 1; r <= 2; r++) {
      const to = { x: unit.pos.x + d.x * r, y: unit.pos.y + d.y * r };
      if (!inBounds(to)) break;

      const occ = unitAt(state, to, unit.unitId);
      if (occ) {
        if (r === 1) {
          // Mouse slips past — can continue to r=2 even if r=1 is occupied
          // But can also capture at r=1 if it's an enemy
          if (occ.owner !== unit.owner && occ.defId !== 'elephant') {
            moves.push({ to, captureId: occ.unitId, push: null });
          }
          continue; // keep going to r=2
        }
        // r=2: can capture enemy here
        if (occ.owner !== unit.owner && occ.defId !== 'elephant') {
          moves.push({ to, captureId: occ.unitId, push: null });
        }
        break;
      }
      moves.push({ to, captureId: null, push: null });
    }
  }

  return moves;
}

// ═══════════════════════════════════════════════════════════════════════
// CAT — 1-2 tiles diagonal + checkers-style pounce capture
// ═══════════════════════════════════════════════════════════════════════

function getCatMoves(state: CGameState, unit: CUnit): MoveOption[] {
  const moves: MoveOption[] = [];

  for (const d of DIRS_DIAG) {
    for (let r = 1; r <= 2; r++) {
      const to = { x: unit.pos.x + d.x * r, y: unit.pos.y + d.y * r };
      if (!inBounds(to)) break;

      const occ = unitAt(state, to, unit.unitId);
      if (occ) {
        if (r === 1 && occ.owner !== unit.owner && occ.defId !== 'elephant') {
          // Checkers pounce: jump over enemy to land behind them
          const beyond = { x: to.x + d.x, y: to.y + d.y };
          if (inBounds(beyond) && isEmpty(state, beyond, unit.unitId)) {
            moves.push({ to: beyond, captureId: occ.unitId, push: null });
          }
        }
        break; // blocked for normal moves
      }
      moves.push({ to, captureId: null, push: null });
    }
  }

  return moves;
}

// ═══════════════════════════════════════════════════════════════════════
// RABBIT — L-shape knight moves, hops over everything
// ═══════════════════════════════════════════════════════════════════════

function getRabbitMoves(state: CGameState, unit: CUnit): MoveOption[] {
  const moves: MoveOption[] = [];

  for (const km of KNIGHT_MOVES) {
    const to = { x: unit.pos.x + km.x, y: unit.pos.y + km.y };
    if (!inBounds(to)) continue;

    const occ = unitAt(state, to, unit.unitId);
    if (occ) {
      if (occ.owner !== unit.owner && occ.defId !== 'elephant') {
        moves.push({ to, captureId: occ.unitId, push: null });
      }
      // Can't land on friendly
      continue;
    }
    moves.push({ to, captureId: null, push: null });
  }

  return moves;
}

// ═══════════════════════════════════════════════════════════════════════
// EAGLE — 1-3 tiles any direction, CANNOT capture
// ═══════════════════════════════════════════════════════════════════════

function getEagleMoves(state: CGameState, unit: CUnit): MoveOption[] {
  const moves: MoveOption[] = [];

  for (const d of DIRS_ALL) {
    for (let r = 1; r <= 3; r++) {
      const to = { x: unit.pos.x + d.x * r, y: unit.pos.y + d.y * r };
      if (!inBounds(to)) break;

      const occ = unitAt(state, to, unit.unitId);
      if (occ) break; // Eagle can't capture and can't pass through
      moves.push({ to, captureId: null, push: null });
    }
  }

  return moves;
}

// ═══════════════════════════════════════════════════════════════════════
// ELEPHANT — 1 tile orthogonal, pushes enemies, immune to capture
// ═══════════════════════════════════════════════════════════════════════

function getElephantMoves(state: CGameState, unit: CUnit): MoveOption[] {
  const moves: MoveOption[] = [];

  for (const d of DIRS_ORTHO) {
    const to = { x: unit.pos.x + d.x, y: unit.pos.y + d.y };
    if (!inBounds(to)) continue;

    const occ = unitAt(state, to, unit.unitId);
    if (occ) {
      if (occ.owner !== unit.owner) {
        // Push: shove enemy 1 tile in the same direction
        const pushTo = { x: to.x + d.x, y: to.y + d.y };
        if (inBounds(pushTo) && isEmpty(state, pushTo, unit.unitId)) {
          moves.push({ to, captureId: null, push: { unitId: occ.unitId, to: pushTo } });
        }
        // If push destination is out of bounds or occupied, can't move there
      }
      // Can't move onto friendly
      continue;
    }
    moves.push({ to, captureId: null, push: null });
  }

  return moves;
}

// ═══════════════════════════════════════════════════════════════════════
// MOVE EXECUTION
// ═══════════════════════════════════════════════════════════════════════

export interface MoveResult {
  to: Vec2;
  captured: { unitId: number; sentTo: Vec2 } | null;
  pushed: { unitId: number; from: Vec2; to: Vec2 } | null;
  scored: boolean;
}

export function executeMove(state: CGameState, unitId: number, move: MoveOption): MoveResult {
  const unit = state.units.find(u => u.unitId === unitId)!;
  const from = { ...unit.pos };
  let captured: MoveResult['captured'] = null;
  let pushed: MoveResult['pushed'] = null;

  // Handle push (elephant)
  if (move.push) {
    const target = state.units.find(u => u.unitId === move.push!.unitId)!;
    const pushFrom = { ...target.pos };
    target.pos = { ...move.push.to };
    target.animFrom = pushFrom;
    target.animStart = performance.now();
    pushed = { unitId: target.unitId, from: pushFrom, to: { ...target.pos } };
  }

  // Handle capture (send to home row)
  if (move.captureId != null) {
    const target = state.units.find(u => u.unitId === move.captureId)!;
    const captureFrom = { ...target.pos };
    // Find an empty spot on the home row
    const row = homeRow(target.owner);
    let respawnX = target.pos.x; // try same column first
    if (!isEmpty(state, { x: respawnX, y: row }, target.unitId)) {
      // Find any empty spot on home row
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (isEmpty(state, { x, y: row }, target.unitId) && !(x === move.to.x && row === move.to.y)) {
          respawnX = x;
          break;
        }
      }
    }
    // If the captured unit was scored, decrement their score
    const wasScored = target.scored;
    target.pos = { x: respawnX, y: row };
    target.scored = false;
    target.animFrom = captureFrom;
    target.animStart = performance.now();
    captured = { unitId: target.unitId, sentTo: { ...target.pos } };

    if (wasScored) {
      state.scored[target.owner]--;
    }
  }

  // Move the unit
  unit.animFrom = from;
  unit.animStart = performance.now();
  unit.pos = { ...move.to };

  // Check scoring: did this unit reach the opponent's back row?
  const scored = checkScored(unit);
  if (scored && !unit.scored) {
    unit.scored = true;
    state.scored[unit.owner]++;
  }

  return { to: move.to, captured, pushed, scored };
}

function checkScored(unit: CUnit): boolean {
  if (unit.owner === 'A') return unit.pos.y === 7;
  return unit.pos.y === 0;
}
