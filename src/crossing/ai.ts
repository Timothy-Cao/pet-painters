/**
 * ai.ts — AI for Critter Crossing v2.
 *
 * Scoring heuristic: advance toward goal, capture enemies, protect scored units.
 */

import type { CGameState, Vec2 } from './types';
import { getValidMoves, type MoveOption } from './moves';
import { BOARD_SIZE, goalRow, forwardDir } from './board';

interface ScoredMove {
  unitId: number;
  move: MoveOption;
  score: number;
}

export function pickAIMove(state: CGameState): { unitId: number; to: Vec2 } | null {
  const player = state.currentPlayer;
  const candidates: ScoredMove[] = [];

  for (const unit of state.units) {
    if (unit.owner !== player) continue;
    const moves = getValidMoves(state, unit);
    for (const move of moves) {
      const score = evaluateMove(state, unit.unitId, unit.pos, move, player);
      candidates.push({ unitId: unit.unitId, move, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);

  const topN = Math.min(3, candidates.length);
  const pick = Math.floor(Math.random() * topN);
  return { unitId: candidates[pick].unitId, to: candidates[pick].move.to };
}

function evaluateMove(
  state: CGameState,
  unitId: number,
  from: Vec2,
  move: MoveOption,
  player: 'A' | 'B',
): number {
  let score = 0;
  const to = move.to;
  const goal = goalRow(player);
  const unit = state.units.find(u => u.unitId === unitId)!;

  // Forward progress
  const progressBefore = player === 'A' ? from.y : (BOARD_SIZE - 1 - from.y);
  const progressAfter = player === 'A' ? to.y : (BOARD_SIZE - 1 - to.y);
  score += (progressAfter - progressBefore) * 5;

  // Scoring bonus
  if (to.y === goal) score += 30;
  if (Math.abs(to.y - goal) <= 1) score += 10;

  // Capture bonus (huge — sending enemy back is very strong)
  if (move.captureId != null) {
    const capturedUnit = state.units.find(u => u.unitId === move.captureId)!;
    // Extra value for capturing an enemy that was about to score
    const enemyGoal = goalRow(capturedUnit.owner);
    const enemyDistToGoal = Math.abs(capturedUnit.pos.y - enemyGoal);
    score += 15 + (7 - enemyDistToGoal) * 3; // more value for advanced enemies
    if (capturedUnit.scored) score += 25; // un-scoring an enemy is massive
  }

  // Push bonus
  if (move.push) {
    const pushTarget = state.units.find(u => u.unitId === move.push!.unitId)!;
    const pushDir = Math.sign(move.push.to.y - pushTarget.pos.y);
    // Pushing enemy backward = good
    if (pushDir === -forwardDir(pushTarget.owner)) score += 8;
    else score += 3;
  }

  // Don't move scored units unless they're in danger
  if (unit.scored) score -= 15;

  // Penalty for backward movement
  if ((player === 'A' && to.y < from.y) || (player === 'B' && to.y > from.y)) {
    score -= 4;
  }

  // Defend: if our unit is on goal row and could be captured, slight incentive to stay
  // (handled by the scored penalty above)

  // Randomness
  score += (Math.random() - 0.5) * 4;

  return score;
}

export function scheduleAIMove(
  state: CGameState,
  onMove: (unitId: number, to: Vec2) => void,
): () => void {
  let cancelled = false;
  const delay = 400 + Math.random() * 500;

  const timer = setTimeout(() => {
    if (cancelled || state.phase !== 'playing') return;
    const move = pickAIMove(state);
    if (move) onMove(move.unitId, move.to);
  }, delay);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
