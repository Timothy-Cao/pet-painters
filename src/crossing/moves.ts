/**
 * moves.ts — Movement engine for Critter Crossing.
 *
 * Computes valid moves for each unit type and resolves side-effects
 * (pushes, hops, splashes) when a move is executed.
 */

import type { CGameState, CUnit, Vec2, PlayerId } from './types';
import { getUnitDef } from './units';
import { BOARD_SIZE, getTerrain, inBounds, footprint, footprintInBounds } from './board';

// ── Helpers ────────────────────────────────────────────────────────────

/** Check if a tile is occupied by any unit OTHER than the given one. */
function occupiedBy(state: CGameState, pos: Vec2, excludeId: number): CUnit | null {
  for (const u of state.units) {
    if (u.scored || u.unitId === excludeId) continue;
    const def = getUnitDef(u.defId);
    const fp = footprint(u.pos, def.size);
    for (const t of fp) {
      if (t.x === pos.x && t.y === pos.y) return u;
    }
  }
  return null;
}

/** Check if a full footprint (for size > 1) is free of other units. */
function footprintFree(state: CGameState, pos: Vec2, size: number, excludeId: number): boolean {
  for (const t of footprint(pos, size)) {
    if (!inBounds(t)) return false;
    if (occupiedBy(state, t, excludeId)) return false;
  }
  return true;
}

/** Can a unit with the given terrain type stand on this tile? */
function canOccupyTerrain(unitTerrain: string, tileTerrain: string): boolean {
  if (unitTerrain === 'flying') return true;
  if (unitTerrain === 'amphibious') return true;
  if (unitTerrain === 'land') return tileTerrain === 'land';
  if (unitTerrain === 'water') return tileTerrain === 'water';
  return false;
}

/** Check if all tiles in a footprint have valid terrain for this unit. */
function canOccupyFootprint(state: CGameState, pos: Vec2, size: number, unitTerrain: string): boolean {
  for (const t of footprint(pos, size)) {
    if (!inBounds(t)) return false;
    if (!canOccupyTerrain(unitTerrain, getTerrain(state.board, t))) return false;
  }
  return true;
}

/** Direction vector: +1 toward the goal for the given player. */
export function forwardDir(player: PlayerId): number {
  return player === 'A' ? 1 : -1;
}

const DIRS_4: Vec2[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
];

const DIRS_8: Vec2[] = [
  ...DIRS_4,
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

// ── Move result ────────────────────────────────────────────────────────

export interface MoveResult {
  /** The tile the unit moved to. */
  to: Vec2;
  /** Units that were pushed and where they ended up. */
  pushes: { unitId: number; from: Vec2; to: Vec2 }[];
  /** Whether the moving unit scored (crossed goal). */
  scored: boolean;
}

// ── Valid move computation per unit type ────────────────────────────────

export function getValidMoves(state: CGameState, unit: CUnit): Vec2[] {
  const def = getUnitDef(unit.defId);
  switch (def.id) {
    case 'mouse': return getMouseMoves(state, unit);
    case 'cat': return getCatMoves(state, unit);
    case 'rabbit': return getRabbitMoves(state, unit);
    case 'turtle': return getTurtleMoves(state, unit);
    case 'eagle': return getEagleMoves(state, unit);
    case 'frog': return getFrogMoves(state, unit);
    case 'elephant': return getElephantMoves(state, unit);
    case 'whale': return getWhaleMoves(state, unit);
    default: return getBasicMoves(state, unit, 1);
  }
}

/** Basic 1-step moves in 4 directions for a unit of given size. */
function getBasicMoves(state: CGameState, unit: CUnit, range: number): Vec2[] {
  const def = getUnitDef(unit.defId);
  const moves: Vec2[] = [];
  for (const d of DIRS_4) {
    for (let r = 1; r <= range; r++) {
      const to = { x: unit.pos.x + d.x * r, y: unit.pos.y + d.y * r };
      if (!footprintInBounds(to, def.size)) break;
      if (!canOccupyFootprint(state, to, def.size, def.terrain)) break;
      if (!footprintFree(state, to, def.size, unit.unitId)) break;
      moves.push(to);
    }
  }
  return moves;
}

// ── Mouse: 1 step any dir, can pass through friendly units ──

function getMouseMoves(state: CGameState, unit: CUnit): Vec2[] {
  const def = getUnitDef(unit.defId);
  const moves: Vec2[] = [];
  for (const d of DIRS_4) {
    const to = { x: unit.pos.x + d.x, y: unit.pos.y + d.y };
    if (!inBounds(to)) continue;
    if (!canOccupyTerrain(def.terrain, getTerrain(state.board, to))) continue;
    const occ = occupiedBy(state, to, unit.unitId);
    // Mouse can move through friendlies but not enemies; can't stop on occupied tile
    if (occ) {
      // Check one tile further (pass through friendly)
      if (occ.owner === unit.owner) {
        const beyond = { x: to.x + d.x, y: to.y + d.y };
        if (inBounds(beyond) && canOccupyTerrain(def.terrain, getTerrain(state.board, beyond))
            && !occupiedBy(state, beyond, unit.unitId)) {
          moves.push(beyond);
        }
      }
      continue;
    }
    moves.push(to);
  }
  return moves;
}

// ── Cat: 1 step any dir, OR 2 forward, OR pounce over 1 adjacent unit ──

function getCatMoves(state: CGameState, unit: CUnit): Vec2[] {
  const def = getUnitDef(unit.defId);
  const moves: Vec2[] = [];
  const fwd = forwardDir(unit.owner);

  // Basic 1-step in any direction
  for (const d of DIRS_4) {
    const to = { x: unit.pos.x + d.x, y: unit.pos.y + d.y };
    if (!inBounds(to)) continue;
    if (!canOccupyTerrain(def.terrain, getTerrain(state.board, to))) continue;
    if (occupiedBy(state, to, unit.unitId)) {
      // Pounce: leap over 1 adjacent unit (friend or foe) to land 1 beyond
      const beyond = { x: to.x + d.x, y: to.y + d.y };
      if (inBounds(beyond) && canOccupyTerrain(def.terrain, getTerrain(state.board, beyond))
          && !occupiedBy(state, beyond, unit.unitId)) {
        moves.push(beyond);
      }
      continue;
    }
    moves.push(to);
  }

  // 2 steps forward (if path is clear)
  const twoFwd = { x: unit.pos.x, y: unit.pos.y + fwd * 2 };
  const oneFwd = { x: unit.pos.x, y: unit.pos.y + fwd };
  if (inBounds(twoFwd) && inBounds(oneFwd)
      && canOccupyTerrain(def.terrain, getTerrain(state.board, oneFwd))
      && canOccupyTerrain(def.terrain, getTerrain(state.board, twoFwd))
      && !occupiedBy(state, oneFwd, unit.unitId)
      && !occupiedBy(state, twoFwd, unit.unitId)) {
    // Only add if not already in the list
    if (!moves.some(m => m.x === twoFwd.x && m.y === twoFwd.y)) {
      moves.push(twoFwd);
    }
  }

  return moves;
}

// ── Rabbit: Chain hop — jump over consecutive units until empty tile ──

function getRabbitMoves(state: CGameState, unit: CUnit): Vec2[] {
  const def = getUnitDef(unit.defId);
  const moves: Vec2[] = [];

  for (const d of DIRS_4) {
    // Walk along the direction. Must start by hopping over at least 1 unit.
    let cx = unit.pos.x + d.x;
    let cy = unit.pos.y + d.y;
    let hoppedAny = false;

    // Skip over consecutive occupied tiles
    while (inBounds({ x: cx, y: cy })) {
      const occ = occupiedBy(state, { x: cx, y: cy }, unit.unitId);
      if (!occ) break;
      hoppedAny = true;
      cx += d.x;
      cy += d.y;
    }

    // Landing tile
    if (hoppedAny && inBounds({ x: cx, y: cy })
        && canOccupyTerrain(def.terrain, getTerrain(state.board, { x: cx, y: cy }))) {
      moves.push({ x: cx, y: cy });
    }
  }

  // Also allow basic 1-step move if no hop available (so rabbit isn't stuck)
  for (const d of DIRS_4) {
    const to = { x: unit.pos.x + d.x, y: unit.pos.y + d.y };
    if (!inBounds(to)) continue;
    if (!canOccupyTerrain(def.terrain, getTerrain(state.board, to))) continue;
    if (occupiedBy(state, to, unit.unitId)) continue;
    if (!moves.some(m => m.x === to.x && m.y === to.y)) {
      moves.push(to);
    }
  }

  return moves;
}

// ── Turtle: 1 step any dir, amphibious ──

function getTurtleMoves(state: CGameState, unit: CUnit): Vec2[] {
  return getBasicMoves(state, unit, 1);
}

// ── Eagle: 2 steps any dir (including diagonals), flies over everything ──

function getEagleMoves(state: CGameState, unit: CUnit): Vec2[] {
  const moves: Vec2[] = [];
  // Eagle can move 1 or 2 tiles in any of 8 directions, ignoring units/terrain in between
  for (const d of DIRS_8) {
    for (let r = 1; r <= 2; r++) {
      const to = { x: unit.pos.x + d.x * r, y: unit.pos.y + d.y * r };
      if (!inBounds(to)) continue;
      // Flying: can land on any terrain, but can't land on occupied tile
      if (occupiedBy(state, to, unit.unitId)) continue;
      moves.push(to);
    }
  }
  return moves;
}

// ── Frog: 1 step on land; from water, can leap 3 tiles forward ──

function getFrogMoves(state: CGameState, unit: CUnit): Vec2[] {
  const moves = getBasicMoves(state, unit, 1);
  const fwd = forwardDir(unit.owner);
  const currentTerrain = getTerrain(state.board, unit.pos);

  if (currentTerrain === 'water') {
    // Leap: 3 tiles forward from water (ignoring units in between)
    const leapTo = { x: unit.pos.x, y: unit.pos.y + fwd * 3 };
    if (inBounds(leapTo) && !occupiedBy(state, leapTo, unit.unitId)) {
      // Frog is amphibious so can land on anything
      if (!moves.some(m => m.x === leapTo.x && m.y === leapTo.y)) {
        moves.push(leapTo);
      }
    }
    // Also allow 2-tile leap
    const leap2 = { x: unit.pos.x, y: unit.pos.y + fwd * 2 };
    if (inBounds(leap2) && !occupiedBy(state, leap2, unit.unitId)) {
      if (!moves.some(m => m.x === leap2.x && m.y === leap2.y)) {
        moves.push(leap2);
      }
    }
  }

  return moves;
}

// ── Elephant: 2×2, 1 step any dir, pushes small units in move direction ──

function getElephantMoves(state: CGameState, unit: CUnit): Vec2[] {
  const def = getUnitDef(unit.defId);
  const moves: Vec2[] = [];

  for (const d of DIRS_4) {
    const to = { x: unit.pos.x + d.x, y: unit.pos.y + d.y };
    if (!footprintInBounds(to, def.size)) continue;
    if (!canOccupyFootprint(state, to, def.size, def.terrain)) continue;

    // Check what's in the new footprint (excluding self)
    const newFp = footprint(to, def.size);
    let canMove = true;
    for (const t of newFp) {
      const occ = occupiedBy(state, t, unit.unitId);
      if (occ) {
        const occDef = getUnitDef(occ.defId);
        // Can push small units but not other large units or turtles (shell)
        if (occDef.size > 1 || occDef.id === 'turtle') {
          canMove = false;
          break;
        }
        // Check if the push destination is valid
        const pushTo = { x: occ.pos.x + d.x * 2, y: occ.pos.y + d.y * 2 };
        if (!inBounds(pushTo)) { canMove = false; break; }
        if (!canOccupyTerrain(occDef.terrain, getTerrain(state.board, pushTo))) { canMove = false; break; }
      }
    }
    if (canMove) moves.push(to);
  }

  return moves;
}

// ── Whale: 2×2, water only, 1 step, splashes adjacent small units away ──

function getWhaleMoves(state: CGameState, unit: CUnit): Vec2[] {
  return getBasicMoves(state, unit, 1);
}

// ── Move execution ────────────────────────────────────────────────────

/**
 * Execute a move: move the unit, resolve pushes/abilities, check scoring.
 * Mutates state in place. Returns a MoveResult describing what happened.
 */
export function executeMove(state: CGameState, unitId: number, to: Vec2): MoveResult {
  const unit = state.units.find(u => u.unitId === unitId);
  if (!unit || unit.scored) throw new Error(`Unit ${unitId} not found or scored`);

  const def = getUnitDef(unit.defId);
  const from = { ...unit.pos };
  const pushes: MoveResult['pushes'] = [];

  // Resolve pre-move abilities based on unit type
  if (def.id === 'elephant') {
    // Trample: push small units in the move direction
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    const newFp = footprint(to, def.size);
    for (const t of newFp) {
      const occ = occupiedBy(state, t, unit.unitId);
      if (occ && getUnitDef(occ.defId).size === 1 && occ.defId !== 'turtle') {
        const pushFrom = { ...occ.pos };
        occ.pos = { x: occ.pos.x + dx * 2, y: occ.pos.y + dy * 2 };
        // Clamp to bounds
        occ.pos.x = Math.max(0, Math.min(BOARD_SIZE - 1, occ.pos.x));
        occ.pos.y = Math.max(0, Math.min(BOARD_SIZE - 1, occ.pos.y));
        pushes.push({ unitId: occ.unitId, from: pushFrom, to: { ...occ.pos } });
      }
    }
  }

  // Move the unit
  unit.pos = { ...to };

  // Post-move abilities
  if (def.id === 'whale') {
    // Splash: push adjacent small units 1 tile away from whale center
    const cx = to.x + 0.5; // center of 2×2
    const cy = to.y + 0.5;
    const whaleFp = new Set(footprint(to, def.size).map(t => `${t.x},${t.y}`));

    for (const u of state.units) {
      if (u.scored || u.unitId === unitId) continue;
      const uDef = getUnitDef(u.defId);
      if (uDef.size > 1 || uDef.id === 'turtle') continue;

      // Check if adjacent to any whale tile
      let adjacent = false;
      for (const wt of footprint(to, def.size)) {
        for (const d of DIRS_4) {
          if (u.pos.x === wt.x + d.x && u.pos.y === wt.y + d.y && !whaleFp.has(`${u.pos.x},${u.pos.y}`)) {
            adjacent = true;
          }
        }
      }
      if (!adjacent) continue;

      // Push away from whale center
      const pdx = Math.sign(u.pos.x - cx);
      const pdy = Math.sign(u.pos.y - cy);
      const pushTo = { x: u.pos.x + (pdx || 0), y: u.pos.y + (pdy || 0) };
      if (inBounds(pushTo) && canOccupyTerrain(uDef.terrain, getTerrain(state.board, pushTo))
          && !occupiedBy(state, pushTo, u.unitId)) {
        const pushFrom = { ...u.pos };
        u.pos = pushTo;
        pushes.push({ unitId: u.unitId, from: pushFrom, to: pushTo });
      }
    }
  }

  // Check if the moved unit scored
  const scored = hasCrossedGoal(unit, state);

  return { to, pushes, scored };
}

/** Check if a unit has crossed its owner's goal. */
function hasCrossedGoal(unit: CUnit, _state: CGameState): boolean {
  const def = getUnitDef(unit.defId);
  if (unit.owner === 'A') {
    // All tiles of the footprint must be at row >= GOAL_ROW_A
    return footprint(unit.pos, def.size).every(t => t.y >= 6);
  } else {
    return footprint(unit.pos, def.size).every(t => t.y <= 5);
  }
}
