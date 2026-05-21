import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { paintTile } from '../board';
import { tileInBounds, walkOrRotateCW, ORTHO_DELTAS, KING_DELTAS } from '../behaviors';
import { footprintTiles } from '../geometry';
import { getPetDef } from '../pet-defs';

const STATS = {
  cost: 3,
  speedTilesPerSec: 0.5,
  weight: 3,
  maxHp: 8,
  atk: 0,
  atkSpeedPerSec: 0,
  order: 2,
  // bespoke
  splashPerSec: 1.5,
  shellCheckPerSec: 2,
  shellPaintPerSec: 1.5,          // 8-neighbor king ring paint while in shell
  shellRange: 3,                  // Chebyshev distance that triggers shell
  shellExitTicks: 40,             // ~2 s of no enemies before exiting shell (at 20 tps)
} as const;

// Module-level per-pet shell state.
// Key = petId. Value = tick at which the last "enemy nearby" event was recorded.
const shellLastThreatTick = new Map<number, number>();

function isInShellMode(pet: Pet, state: MatchState): boolean {
  const lastThreat = shellLastThreatTick.get(pet.petId) ?? -Infinity;
  return state.tick - lastThreat < STATS.shellExitTicks;
}

/** Chebyshev distance between two tiles. */
function chebyshev(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function enemyNearby(pet: Pet, state: MatchState): boolean {
  for (const other of state.pets) {
    if (other.owner === pet.owner) continue;
    const odef = getPetDef(other.defId);
    for (const t of footprintTiles(other.anchor, odef.size)) {
      if (chebyshev(pet.anchor, t) <= STATS.shellRange) return true;
    }
  }
  return false;
}

/** Checked frequently; just records the threat tick. */
function turtleShellCheck(pet: Pet, state: MatchState): void {
  if (enemyNearby(pet, state)) {
    shellLastThreatTick.set(pet.petId, state.tick);
  }
}

/**
 * Shell ring paint: when threatened, paints all 8 king-move neighbors.
 * Turtle keeps walking normally — the extra ring paint is the shell bonus.
 */
function turtleShellRing(pet: Pet, state: MatchState): void {
  if (!isInShellMode(pet, state)) return;
  for (const d of KING_DELTAS) {
    const t: Vec2 = { x: pet.anchor.x + d.x, y: pet.anchor.y + d.y };
    if (tileInBounds(state, t)) paintTile(state.board, t, pet.owner);
  }
}

function turtleSplash(pet: Pet, state: MatchState): void {
  // Paint all 4 orthogonal neighbors in the turtle's color (always active).
  for (const d of ORTHO_DELTAS) {
    const t: Vec2 = { x: pet.anchor.x + d.x, y: pet.anchor.y + d.y };
    if (tileInBounds(state, t)) paintTile(state.board, t, pet.owner);
  }
}

export const TURTLE: PetDefinition = {
  id: 'turtle',
  displayName: 'Turtle',
  emoji: '🐢',
  cost: STATS.cost,
  size: { w: 1, h: 1 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  role: 'painter',
  ui: {
    hotkey: '5',
    short: 'Shell mode when threatened',
    ability:
      'Slow walker that paints all four neighbors every 0.67 s. When an enemy enters within 3 tiles, enters shell mode: additionally paints all 8 surrounding tiles every 0.67 s. Exits shell 2 s after enemies leave.',
  },
  tuples: [
    // Movement (always active — turtle keeps walking even in shell).
    { intervalSec: 1 / STATS.speedTilesPerSec, trigger: () => true, action: walkOrRotateCW },
    // Regular orthogonal splash (always).
    { intervalSec: 1 / STATS.splashPerSec, trigger: () => true, action: turtleSplash },
    // Shell state update (frequent check).
    { intervalSec: 1 / STATS.shellCheckPerSec, trigger: () => true, action: turtleShellCheck },
    // Shell king-ring paint (only fires while in shell mode).
    { intervalSec: 1 / STATS.shellPaintPerSec, trigger: isInShellMode, action: turtleShellRing },
  ],
};
