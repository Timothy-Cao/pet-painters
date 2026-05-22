/**
 * moves.ts — Movement engine for Critter Crossing.
 *
 * Computes valid moves for each unit type and resolves side-effects
 * (pushes, hops, splashes, bumps) when a move is executed.
 *
 * SYNERGY DESIGN: Units are designed to interact with each other.
 * - Mouse slides through friendly formations
 * - Cat/Rabbit use ANY unit as a stepping stone (friend or foe)
 * - Turtle enables water crossings as a hop target
 * - Elephant pushes friendlies AND foes (boost your own units!)
 * - Whale splashes everyone outward (launch allies from water)
 * - Eagle bumps enemies on landing (clear the path for allies)
 * - Frog dives under water units (unique water traversal)
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

/** Check if a unit can be pushed (small, not a turtle). */
function isPushable(unit: CUnit): boolean {
  const def = getUnitDef(unit.defId);
  return def.size === 1 && def.id !== 'turtle';
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

// ═══════════════════════════════════════════════════════════════════════
// MOUSE — Scurry: slides through ALL friendly units in a line
// ═══════════════════════════════════════════════════════════════════════
// Synergy: Line up your units → mouse slides through the entire formation.
// More allies in a row = further the mouse travels.

function getMouseMoves(state: CGameState, unit: CUnit): Vec2[] {
  const def = getUnitDef(unit.defId);
  const moves: Vec2[] = [];

  for (const d of DIRS_4) {
    const first = { x: unit.pos.x + d.x, y: unit.pos.y + d.y };
    if (!inBounds(first)) continue;
    if (!canOccupyTerrain(def.terrain, getTerrain(state.board, first))) continue;

    const occ = occupiedBy(state, first, unit.unitId);
    if (!occ) {
      // Empty tile — normal 1-step move
      moves.push(first);
    } else if (occ.owner === unit.owner) {
      // Friendly unit — chain-slide through ALL consecutive friendlies
      let cx = first.x + d.x;
      let cy = first.y + d.y;
      while (inBounds({ x: cx, y: cy })) {
        if (!canOccupyTerrain(def.terrain, getTerrain(state.board, { x: cx, y: cy }))) break;
        const nextOcc = occupiedBy(state, { x: cx, y: cy }, unit.unitId);
        if (nextOcc) {
          if (nextOcc.owner === unit.owner) {
            // Keep sliding through friendlies
            cx += d.x;
            cy += d.y;
            continue;
          }
          break; // Blocked by enemy
        }
        // Empty tile — this is where mouse stops
        moves.push({ x: cx, y: cy });
        break;
      }
    }
    // Blocked by enemy in first tile — can't move this direction
  }

  return moves;
}

// ═══════════════════════════════════════════════════════════════════════
// CAT — Pounce: leaps over 1 adjacent unit (friend or foe) to land behind
// ═══════════════════════════════════════════════════════════════════════
// Synergy: Any unit works as a stepping stone. Position a turtle in water
// → cat pounces over it to cross. Use allies as launch pads.

function getCatMoves(state: CGameState, unit: CUnit): Vec2[] {
  const def = getUnitDef(unit.defId);
  const moves: Vec2[] = [];

  for (const d of DIRS_4) {
    const to = { x: unit.pos.x + d.x, y: unit.pos.y + d.y };
    if (!inBounds(to)) continue;
    if (!canOccupyTerrain(def.terrain, getTerrain(state.board, to))) continue;

    const occ = occupiedBy(state, to, unit.unitId);
    if (!occ) {
      // Normal 1-step move
      moves.push(to);
    } else {
      // Pounce: leap over any adjacent unit to land 1 beyond
      const beyond = { x: to.x + d.x, y: to.y + d.y };
      if (inBounds(beyond)
          && canOccupyTerrain(def.terrain, getTerrain(state.board, beyond))
          && !occupiedBy(state, beyond, unit.unitId)) {
        moves.push(beyond);
      }
    }
  }

  return moves;
}

// ═══════════════════════════════════════════════════════════════════════
// RABBIT — Chain Hop: bounces over consecutive units in a line
// ═══════════════════════════════════════════════════════════════════════
// Synergy: THE combo unit. Pack units together in a line and rabbit
// chain-hops over all of them. 3 allies in a row = rabbit crosses half
// the board. Works with ANY unit — friend or foe.

function getRabbitMoves(state: CGameState, unit: CUnit): Vec2[] {
  const def = getUnitDef(unit.defId);
  const moves: Vec2[] = [];

  for (const d of DIRS_4) {
    // Walk along the direction — skip over consecutive occupied tiles
    let cx = unit.pos.x + d.x;
    let cy = unit.pos.y + d.y;
    let hoppedAny = false;

    while (inBounds({ x: cx, y: cy })) {
      const occ = occupiedBy(state, { x: cx, y: cy }, unit.unitId);
      if (!occ) break;
      hoppedAny = true;
      cx += d.x;
      cy += d.y;
    }

    // Landing tile — must be valid terrain and in bounds
    if (hoppedAny && inBounds({ x: cx, y: cy })
        && canOccupyTerrain(def.terrain, getTerrain(state.board, { x: cx, y: cy }))) {
      moves.push({ x: cx, y: cy });
    }
  }

  // Also allow basic 1-step moves (so rabbit isn't stuck with no adjacent units)
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

// ═══════════════════════════════════════════════════════════════════════
// TURTLE — Shell: amphibious, cannot be pushed, acts as hop bridge
// ═══════════════════════════════════════════════════════════════════════
// Synergy: Move turtle into water → cats and rabbits can JUMP OVER the
// turtle to cross water. Turtle is the water enabler for your land army.
// Also blocks push chains (elephant/whale can't move turtle).

function getTurtleMoves(state: CGameState, unit: CUnit): Vec2[] {
  return getBasicMoves(state, unit, 1);
}

// ═══════════════════════════════════════════════════════════════════════
// EAGLE — Soar: flies 2 tiles any direction + bumps 1 enemy on landing
// ═══════════════════════════════════════════════════════════════════════
// Synergy: Eagle dive-bombs into position, bumping an enemy out of the
// way. Creates openings for allies to advance through. Pairs well with
// mouse (eagle clears path → mouse slides through).

function getEagleMoves(state: CGameState, unit: CUnit): Vec2[] {
  const moves: Vec2[] = [];
  // Eagle can move 1 or 2 tiles in any of 8 directions, ignoring everything
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

// ═══════════════════════════════════════════════════════════════════════
// FROG — Leap & Dive: from water, leaps forward; dives under water units
// ═══════════════════════════════════════════════════════════════════════
// Synergy: Frog enters water → leaps 3 tiles forward across the channel.
// While in water, frog can dive under whales/turtles/other frogs to
// navigate the water zone. Pair with turtle to create water pathways.

function getFrogMoves(state: CGameState, unit: CUnit): Vec2[] {
  const moves = getBasicMoves(state, unit, 1);
  const fwd = forwardDir(unit.owner);
  const currentTerrain = getTerrain(state.board, unit.pos);

  if (currentTerrain === 'water') {
    // Leap: 2 or 3 tiles forward from water (ignoring units in between)
    for (const range of [2, 3]) {
      const leapTo = { x: unit.pos.x, y: unit.pos.y + fwd * range };
      if (inBounds(leapTo) && !occupiedBy(state, leapTo, unit.unitId)) {
        if (!moves.some(m => m.x === leapTo.x && m.y === leapTo.y)) {
          moves.push(leapTo);
        }
      }
    }

    // Dive: move through occupied water tiles (go UNDER other units)
    for (const d of DIRS_4) {
      let cx = unit.pos.x + d.x;
      let cy = unit.pos.y + d.y;
      let dived = false;

      while (inBounds({ x: cx, y: cy })) {
        const terrain = getTerrain(state.board, { x: cx, y: cy });
        // Can only dive through water tiles
        if (terrain !== 'water') {
          // Surfaced onto land — can land here if empty (and frog is amphibious)
          if (dived && !occupiedBy(state, { x: cx, y: cy }, unit.unitId)) {
            if (!moves.some(m => m.x === cx && m.y === cy)) {
              moves.push({ x: cx, y: cy });
            }
          }
          break;
        }
        const occ = occupiedBy(state, { x: cx, y: cy }, unit.unitId);
        if (occ) {
          // Dive under this unit — keep going
          dived = true;
          cx += d.x;
          cy += d.y;
          continue;
        }
        // Empty water tile — can surface here
        if (dived) {
          if (!moves.some(m => m.x === cx && m.y === cy)) {
            moves.push({ x: cx, y: cy });
          }
        }
        break;
      }
    }
  }

  return moves;
}

// ═══════════════════════════════════════════════════════════════════════
// ELEPHANT — Trample: pushes ALL small units in path 1 tile (friend+foe)
// ═══════════════════════════════════════════════════════════════════════
// Synergy: THE support unit. Move elephant forward → it pushes your own
// small units forward too! Line up mice and rabbits in front, then
// elephant tramples them all 1 tile closer to the goal. Risk: also
// pushes enemies in the same direction.

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
        if (!isPushable(occ)) {
          canMove = false;
          break;
        }
        // Check if the push destination is valid (1 tile in move direction)
        const pushTo = { x: occ.pos.x + d.x, y: occ.pos.y + d.y };
        if (!inBounds(pushTo)) { canMove = false; break; }
        if (!canOccupyTerrain(getUnitDef(occ.defId).terrain, getTerrain(state.board, pushTo))) { canMove = false; break; }
        // Can't push into another unit (unless that unit would also be pushed,
        // but we keep it simple: push blocked if destination is occupied)
        if (occupiedBy(state, pushTo, occ.unitId) && !newFp.some(fp => fp.x === pushTo.x && fp.y === pushTo.y)) {
          canMove = false;
          break;
        }
      }
    }
    if (canMove) moves.push(to);
  }

  return moves;
}

// ═══════════════════════════════════════════════════════════════════════
// WHALE — Splash: pushes ALL adjacent small units 1 tile outward (friend+foe)
// ═══════════════════════════════════════════════════════════════════════
// Synergy: Position allies around whale in water → splash pushes them
// outward, potentially onto land near the goal! Whale can launch frogs,
// mice, cats out of water. Also pushes away enemy blockers.

function getWhaleMoves(state: CGameState, unit: CUnit): Vec2[] {
  return getBasicMoves(state, unit, 1);
}

// ═══════════════════════════════════════════════════════════════════════
// MOVE EXECUTION — resolves pushes, bumps, splashes
// ═══════════════════════════════════════════════════════════════════════

export function executeMove(state: CGameState, unitId: number, to: Vec2): MoveResult {
  const unit = state.units.find(u => u.unitId === unitId);
  if (!unit || unit.scored) throw new Error(`Unit ${unitId} not found or scored`);

  const def = getUnitDef(unit.defId);
  const from = { ...unit.pos };
  const pushes: MoveResult['pushes'] = [];

  // ── Pre-move abilities ──

  if (def.id === 'elephant') {
    // Trample: push ALL small pushable units in the new footprint 1 tile
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    const newFp = footprint(to, def.size);

    // Collect units to push (to avoid modifying while iterating)
    const toPush: CUnit[] = [];
    for (const t of newFp) {
      const occ = occupiedBy(state, t, unit.unitId);
      if (occ && isPushable(occ) && !toPush.includes(occ)) {
        toPush.push(occ);
      }
    }

    for (const target of toPush) {
      const pushFrom = { ...target.pos };
      const pushTo = {
        x: target.pos.x + dx,
        y: target.pos.y + dy,
      };
      // Clamp to bounds
      pushTo.x = Math.max(0, Math.min(BOARD_SIZE - 1, pushTo.x));
      pushTo.y = Math.max(0, Math.min(BOARD_SIZE - 1, pushTo.y));
      target.pos = pushTo;
      pushes.push({ unitId: target.unitId, from: pushFrom, to: { ...pushTo } });
    }
  }

  // ── Move the unit ──
  unit.pos = { ...to };

  // ── Post-move abilities ──

  if (def.id === 'eagle') {
    // Dive-bomb: bump 1 adjacent small enemy 1 tile away from eagle
    let bestTarget: CUnit | null = null;
    let bestDir: Vec2 | null = null;

    for (const d of DIRS_4) {
      const adj = { x: to.x + d.x, y: to.y + d.y };
      if (!inBounds(adj)) continue;
      const target = occupiedBy(state, adj, unit.unitId);
      if (!target || target.owner === unit.owner) continue;
      if (!isPushable(target)) continue;

      const bumpTo = { x: adj.x + d.x, y: adj.y + d.y };
      if (!inBounds(bumpTo)) continue;
      const targetDef = getUnitDef(target.defId);
      if (!canOccupyTerrain(targetDef.terrain, getTerrain(state.board, bumpTo))) continue;
      if (occupiedBy(state, bumpTo, target.unitId)) continue;

      // Prefer bumping enemies backward (away from their goal)
      if (!bestTarget || d.y === -forwardDir(target.owner)) {
        bestTarget = target;
        bestDir = d;
      }
    }

    if (bestTarget && bestDir) {
      const pushFrom = { ...bestTarget.pos };
      bestTarget.pos = {
        x: bestTarget.pos.x + bestDir.x,
        y: bestTarget.pos.y + bestDir.y,
      };
      pushes.push({ unitId: bestTarget.unitId, from: pushFrom, to: { ...bestTarget.pos } });
    }
  }

  if (def.id === 'whale') {
    // Splash: push ALL adjacent small units 1 tile outward (friend AND foe)
    const cx = to.x + 0.5; // center of 2×2
    const cy = to.y + 0.5;
    const whaleFp = new Set(footprint(to, def.size).map(t => `${t.x},${t.y}`));

    const toSplash: { unit: CUnit; dx: number; dy: number }[] = [];

    for (const u of state.units) {
      if (u.scored || u.unitId === unitId) continue;
      if (!isPushable(u)) continue;

      // Check if adjacent to any whale tile
      let adjacent = false;
      for (const wt of footprint(to, def.size)) {
        for (const d of DIRS_4) {
          if (u.pos.x === wt.x + d.x && u.pos.y === wt.y + d.y
              && !whaleFp.has(`${u.pos.x},${u.pos.y}`)) {
            adjacent = true;
          }
        }
      }
      if (!adjacent) continue;

      // Push away from whale center
      const pdx = Math.sign(u.pos.x - cx) || 0;
      const pdy = Math.sign(u.pos.y - cy) || 0;
      toSplash.push({ unit: u, dx: pdx, dy: pdy });
    }

    for (const { unit: target, dx, dy } of toSplash) {
      const pushTo = { x: target.pos.x + dx, y: target.pos.y + dy };
      const targetDef = getUnitDef(target.defId);
      if (inBounds(pushTo)
          && canOccupyTerrain(targetDef.terrain, getTerrain(state.board, pushTo))
          && !occupiedBy(state, pushTo, target.unitId)) {
        const pushFrom = { ...target.pos };
        target.pos = pushTo;
        pushes.push({ unitId: target.unitId, from: pushFrom, to: pushTo });
      }
    }
  }

  // Check if the moved unit scored
  const scored = hasCrossedGoal(unit);

  return { to, pushes, scored };
}

/** Check if a unit has crossed its owner's goal. */
function hasCrossedGoal(unit: CUnit): boolean {
  const def = getUnitDef(unit.defId);
  if (unit.owner === 'A') {
    return footprint(unit.pos, def.size).every(t => t.y >= 6);
  } else {
    return footprint(unit.pos, def.size).every(t => t.y <= 5);
  }
}
