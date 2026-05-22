/**
 * ai.ts — AI for Critter Crossing v2.
 *
 * Three difficulty levels:
 * - Easy: high randomness, ignores captures, picks from top 6
 * - Normal: balanced heuristic, picks from top 3
 * - Hard: precise play, always picks the best move, deeper positional awareness
 */

import type { CGameState, Vec2, AIDifficulty } from './types';
import { getValidMoves, type MoveOption } from './moves';
import { BOARD_SIZE, goalRow, forwardDir } from './board';

interface ScoredMove {
  unitId: number;
  move: MoveOption;
  score: number;
}

export function pickAIMove(state: CGameState): { unitId: number; to: Vec2 } | null {
  const player = state.currentPlayer;
  const difficulty = state.difficulty;
  const candidates: ScoredMove[] = [];

  for (const unit of state.units) {
    if (unit.owner !== player) continue;
    const moves = getValidMoves(state, unit);
    for (const move of moves) {
      const score = evaluateMove(state, unit.unitId, unit.pos, move, player, difficulty);
      candidates.push({ unitId: unit.unitId, move, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);

  // Selection pool varies by difficulty
  let topN: number;
  switch (difficulty) {
    case 'easy': topN = Math.min(6, candidates.length); break;
    case 'hard': topN = 1; break;
    default: topN = Math.min(3, candidates.length); break;
  }

  const pick = Math.floor(Math.random() * topN);
  return { unitId: candidates[pick].unitId, to: candidates[pick].move.to };
}

function evaluateMove(
  state: CGameState,
  unitId: number,
  from: Vec2,
  move: MoveOption,
  player: 'A' | 'B',
  difficulty: AIDifficulty,
): number {
  let score = 0;
  const to = move.to;
  const goal = goalRow(player);
  const unit = state.units.find(u => u.unitId === unitId)!;

  // ── Forward progress ──
  const progressBefore = player === 'A' ? from.y : (BOARD_SIZE - 1 - from.y);
  const progressAfter = player === 'A' ? to.y : (BOARD_SIZE - 1 - to.y);
  score += (progressAfter - progressBefore) * 5;

  // ── Scoring bonus ──
  if (to.y === goal) {
    score += 30;
    // Hard AI considers cooldown risk: scoring makes you vulnerable for 1 turn
    if (difficulty === 'hard') {
      const threatsAtGoal = countThreats(state, to, player);
      if (threatsAtGoal > 0) score -= 8; // risky to score if enemies can reach you
    }
  }
  if (Math.abs(to.y - goal) <= 1) score += 10;

  // ── Capture bonus ──
  if (move.captureId != null) {
    if (difficulty === 'easy') {
      // Easy AI barely values captures
      score += 5;
    } else {
      const capturedUnit = state.units.find(u => u.unitId === move.captureId)!;
      const enemyGoal = goalRow(capturedUnit.owner);
      const enemyDistToGoal = Math.abs(capturedUnit.pos.y - enemyGoal);
      score += 15 + (7 - enemyDistToGoal) * 3;
      if (capturedUnit.scored) score += 25;
      // Capturing a unit on cooldown is easy pickings — bonus
      if (capturedUnit.cooldown > 0) score += 10;

      // Hard AI also considers which unit type is most dangerous
      if (difficulty === 'hard') {
        if (capturedUnit.defId === 'eagle') score += 5; // eagle is fast scorer
        if (capturedUnit.defId === 'rabbit') score += 3; // rabbit is hard to block
      }
    }
  }

  // ── Push bonus ──
  if (move.push) {
    const pushTarget = state.units.find(u => u.unitId === move.push!.unitId)!;
    const pushDir = Math.sign(move.push.to.y - pushTarget.pos.y);
    if (pushDir === -forwardDir(pushTarget.owner)) score += 8;
    else score += 3;
  }

  // ── Don't move scored units unless capturing ──
  if (unit.scored) {
    score -= difficulty === 'hard' ? 20 : 15;
    // But if it's a capture, reduce penalty
    if (move.captureId != null && difficulty === 'hard') score += 10;
  }

  // ── Backward movement penalty ──
  if ((player === 'A' && to.y < from.y) || (player === 'B' && to.y > from.y)) {
    score -= difficulty === 'hard' ? 2 : 4; // Hard AI is less afraid of tactical retreats
  }

  // ── Hard AI: positional awareness ──
  if (difficulty === 'hard') {
    // Prefer center columns (more mobility)
    const centerDist = Math.abs(to.x - 3.5);
    score += (3.5 - centerDist) * 0.8;

    // Avoid stacking units — penalize moving to a column with many friendlies
    const friendsInCol = state.units.filter(u =>
      u.owner === player && u.unitId !== unitId && u.pos.x === to.x
    ).length;
    score -= friendsInCol * 2;

    // Threat awareness: bonus for moving out of danger
    const threatsAtFrom = countThreats(state, from, player);
    const threatsAtTo = countThreats(state, to, player);
    if (threatsAtFrom > 0 && threatsAtTo < threatsAtFrom) score += 4;

    // Bonus for threatening enemy scored units
    if (move.captureId != null) {
      const target = state.units.find(u => u.unitId === move.captureId)!;
      if (target.scored) score += 10; // extra incentive to un-score
    }
  }

  // ── Randomness (varies by difficulty) ──
  const randomRange = difficulty === 'easy' ? 12 : difficulty === 'hard' ? 1.5 : 4;
  score += (Math.random() - 0.5) * randomRange;

  return score;
}

/** Count how many enemy units can attack a given position. */
function countThreats(state: CGameState, pos: Vec2, player: 'A' | 'B'): number {
  let threats = 0;
  for (const enemy of state.units) {
    if (enemy.owner === player) continue;
    if (enemy.defId === 'eagle') continue; // eagles can't capture
    const moves = getValidMoves(state, enemy);
    if (moves.some(m => m.to.x === pos.x && m.to.y === pos.y && m.captureId != null)) {
      threats++;
    }
  }
  return threats;
}

export function scheduleAIMove(
  state: CGameState,
  onMove: (unitId: number, to: Vec2) => void,
): () => void {
  let cancelled = false;
  // Faster on hard (feels snappier), slower on easy (feels more casual)
  const baseDelay = state.difficulty === 'hard' ? 300 : state.difficulty === 'easy' ? 600 : 400;
  const delay = baseDelay + Math.random() * 400;

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
