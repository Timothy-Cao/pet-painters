/**
 * game.ts — Turn engine and game state machine for Critter Crossing.
 */

import type { CGameState, CUnit, PlayerId, Vec2 } from './types';
import { createBoard, BOARD_SIZE, WATER_COLS } from './board';
import { DEFAULT_ARMY, getUnitDef } from './units';
import { getValidMoves, executeMove } from './moves';

/**
 * Create a new game with default armies placed in home zones.
 */
export function createCrossingGame(): CGameState {
  const board = createBoard();
  const units: CUnit[] = [];
  let nextId = 1;

  // Place armies for both players
  for (const player of ['A', 'B'] as PlayerId[]) {
    const rows = player === 'A' ? [0, 1] : [10, 11];
    const placed = placeArmy(player, rows, nextId);
    units.push(...placed);
    nextId += placed.length;
  }

  const totalA = units.filter(u => u.owner === 'A').length;
  const totalB = units.filter(u => u.owner === 'B').length;

  return {
    board,
    units,
    nextUnitId: nextId,
    phase: 'playing', // skip placing phase for v1, use preset layout
    currentPlayer: 'A',
    scored: { A: 0, B: 0 },
    totalUnits: { A: totalA, B: totalB },
    winner: null,
    selectedUnitId: null,
    turn: 1,
    vfx: [],
    hoverTile: null,
    lastMove: null,
  };
}

/**
 * Place a preset army in the given home rows.
 * Arranges units left-to-right, filling row by row.
 * Water columns are skipped for land units; water units go in water columns.
 */
function placeArmy(player: PlayerId, rows: number[], startId: number): CUnit[] {
  const units: CUnit[] = [];
  let id = startId;

  // Separate land/amphibious units from water units
  const landEntries: { defId: string }[] = [];
  const waterEntries: { defId: string }[] = [];

  for (const entry of DEFAULT_ARMY) {
    const def = getUnitDef(entry.defId);
    for (let i = 0; i < entry.count; i++) {
      if (def.terrain === 'water') {
        waterEntries.push({ defId: entry.defId });
      } else {
        landEntries.push({ defId: entry.defId });
      }
    }
  }

  // Place land/amphibious/flying units on land columns (0-4, 9-11)
  const landCols = Array.from({ length: BOARD_SIZE }, (_, i) => i).filter(c => !WATER_COLS.has(c));
  let li = 0;

  // Sort: put large units (2×2) first to ensure they fit
  landEntries.sort((a, b) => getUnitDef(b.defId).size - getUnitDef(a.defId).size);

  for (const entry of landEntries) {
    const def = getUnitDef(entry.defId);
    let placed = false;

    for (const row of rows) {
      for (const col of landCols) {
        if (placed) break;
        const pos = { x: col, y: row };

        // For 2×2 units, check full footprint
        if (def.size === 2) {
          if (col + 1 >= BOARD_SIZE) continue;
          if (WATER_COLS.has(col + 1)) continue;
          // Check row+1 is also a home row
          const nextRow = player === 'A' ? row + 1 : row - 1;
          if (!rows.includes(nextRow) && !rows.includes(row)) continue;
          // Use the lower-left corner for player A, adjust for B
          const actualPos = player === 'A' ? { x: col, y: row } : { x: col, y: row - 1 };
          if (actualPos.y < 0 || actualPos.y + 1 >= BOARD_SIZE) continue;

          // Check not already occupied
          const occupied = units.some(u => {
            const uDef = getUnitDef(u.defId);
            for (let dy = 0; dy < uDef.size; dy++) {
              for (let dx = 0; dx < uDef.size; dx++) {
                for (let dy2 = 0; dy2 < def.size; dy2++) {
                  for (let dx2 = 0; dx2 < def.size; dx2++) {
                    if (u.pos.x + dx === actualPos.x + dx2 && u.pos.y + dy === actualPos.y + dy2) return true;
                  }
                }
              }
            }
            return false;
          });
          if (occupied) continue;

          units.push({ unitId: id++, defId: entry.defId, owner: player, pos: actualPos, scored: false });
          placed = true;
        } else {
          // 1×1 unit
          const occupied = units.some(u => {
            const uDef = getUnitDef(u.defId);
            for (let dy = 0; dy < uDef.size; dy++) {
              for (let dx = 0; dx < uDef.size; dx++) {
                if (u.pos.x + dx === pos.x && u.pos.y + dy === pos.y) return true;
              }
            }
            return false;
          });
          if (occupied) continue;

          units.push({ unitId: id++, defId: entry.defId, owner: player, pos, scored: false });
          placed = true;
        }
      }
    }
    li++;
  }

  // Place water units on water columns
  const waterCols = Array.from(WATER_COLS);
  let wi = 0;
  for (const entry of waterEntries) {
    const def = getUnitDef(entry.defId);
    let placed = false;

    for (const row of rows) {
      for (const col of waterCols) {
        if (placed) break;
        const pos = { x: col, y: row };

        if (def.size === 2) {
          if (col + 1 >= BOARD_SIZE || !WATER_COLS.has(col + 1)) continue;
          const actualPos = player === 'A' ? { x: col, y: row } : { x: col, y: row - 1 };
          if (actualPos.y < 0 || actualPos.y + 1 >= BOARD_SIZE) continue;
          if (!rows.includes(actualPos.y) || !rows.includes(actualPos.y + 1)) continue;

          const occupied = units.some(u => {
            const uDef = getUnitDef(u.defId);
            for (let dy = 0; dy < uDef.size; dy++) {
              for (let dx = 0; dx < uDef.size; dx++) {
                for (let dy2 = 0; dy2 < def.size; dy2++) {
                  for (let dx2 = 0; dx2 < def.size; dx2++) {
                    if (u.pos.x + dx === actualPos.x + dx2 && u.pos.y + dy === actualPos.y + dy2) return true;
                  }
                }
              }
            }
            return false;
          });
          if (occupied) continue;

          units.push({ unitId: id++, defId: entry.defId, owner: player, pos: actualPos, scored: false });
          placed = true;
        } else {
          const occupied = units.some(u => u.pos.x === pos.x && u.pos.y === pos.y);
          if (occupied) continue;
          units.push({ unitId: id++, defId: entry.defId, owner: player, pos, scored: false });
          placed = true;
        }
      }
    }
    wi++;
  }

  return units;
}

/**
 * Get all units belonging to the current player that can move.
 */
export function getMovableUnits(state: CGameState): CUnit[] {
  return state.units.filter(u =>
    !u.scored && u.owner === state.currentPlayer && getValidMoves(state, u).length > 0
  );
}

/**
 * Perform a move: move unit to target, resolve abilities, check scoring/win.
 * Returns false if the move is invalid.
 */
export function performMove(state: CGameState, unitId: number, to: Vec2): boolean {
  const unit = state.units.find(u => u.unitId === unitId && !u.scored);
  if (!unit || unit.owner !== state.currentPlayer) return false;

  const valid = getValidMoves(state, unit);
  if (!valid.some(m => m.x === to.x && m.y === to.y)) return false;

  const fromPos = { ...unit.pos };
  const result = executeMove(state, unitId, to);

  // Set slide animation on the moved unit
  const now = performance.now();
  unit.animFrom = fromPos;
  unit.animStart = now;

  // Track last move for visual indicator
  state.lastMove = { unitId, from: fromPos, to: { ...to } };

  // Set slide animation on pushed units
  for (const push of result.pushes) {
    const pushedUnit = state.units.find(u => u.unitId === push.unitId);
    if (pushedUnit) {
      pushedUnit.animFrom = push.from;
      pushedUnit.animStart = now;
      state.vfx.push({
        type: 'push',
        pos: push.to,
        size: 1,
        owner: pushedUnit.owner,
        startTime: now,
        duration: 400,
      });
    }
  }

  // Check if the moved unit scored
  if (result.scored) {
    unit.scored = true;
    state.scored[unit.owner]++;
    state.vfx.push({
      type: 'score-flash',
      pos: { ...to },
      size: getUnitDef(unit.defId).size,
      owner: unit.owner,
      startTime: now + 250, // delay until slide finishes
      duration: 800,
    });
  }

  // Check if any pushed units scored (pushed across their own goal = still counts!)
  for (const push of result.pushes) {
    const pushedUnit = state.units.find(u => u.unitId === push.unitId);
    if (pushedUnit && !pushedUnit.scored) {
      const def = getUnitDef(pushedUnit.defId);
      const fp = footprintTiles(pushedUnit.pos, def.size);
      const allCrossed = pushedUnit.owner === 'A'
        ? fp.every(t => t.y >= 6)
        : fp.every(t => t.y <= 5);
      if (allCrossed) {
        pushedUnit.scored = true;
        state.scored[pushedUnit.owner]++;
      }
    }
  }

  // Check win
  if (state.scored.A >= state.totalUnits.A) {
    state.winner = 'A';
    state.phase = 'ended';
  } else if (state.scored.B >= state.totalUnits.B) {
    state.winner = 'B';
    state.phase = 'ended';
  }

  // Advance turn
  if (state.phase !== 'ended') {
    state.currentPlayer = state.currentPlayer === 'A' ? 'B' : 'A';
    state.turn++;
  }

  state.selectedUnitId = null;
  return true;
}

function footprintTiles(pos: Vec2, size: number): Vec2[] {
  const tiles: Vec2[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      tiles.push({ x: pos.x + dx, y: pos.y + dy });
    }
  }
  return tiles;
}

/**
 * Check if a player has no valid moves (stalemate for them — skip turn).
 */
export function hasAnyMoves(state: CGameState, player: PlayerId): boolean {
  return state.units.some(u =>
    !u.scored && u.owner === player && getValidMoves(state, u).length > 0
  );
}

/**
 * Skip the current player's turn if they have no moves.
 */
export function skipTurnIfNeeded(state: CGameState): boolean {
  if (!hasAnyMoves(state, state.currentPlayer)) {
    state.currentPlayer = state.currentPlayer === 'A' ? 'B' : 'A';
    state.turn++;
    return true;
  }
  return false;
}
