import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { paintTile } from '../board';
import {
  anyPetAt, declareMove, facingDelta,
  frontBlocked, frontHasPet, scurryTurn, tileInBounds,
} from '../behaviors';

const STATS = {
  cost: 3,
  speedTilesPerSec: 2,
  weight: 1,
  maxHp: 3,
  atk: 0,
  atkSpeedPerSec: 0,
  order: 3,
} as const;

function rabbitStep(pet: Pet, state: MatchState): void {
  // Walk forward whenever the path is clear.
  if (!frontBlocked(pet, state)) {
    declareMove(pet, state);
    return;
  }
  // Try to vault: front is a pet AND the tile two steps ahead is clear.
  if (frontHasPet(pet, state)) {
    const d = facingDelta(pet.facing);
    const landing: Vec2 = {
      x: pet.anchor.x + d.x * 2,
      y: pet.anchor.y + d.y * 2,
    };
    if (tileInBounds(state, landing) && !anyPetAt(state, landing, pet)) {
      pet.anchor = landing;
      paintTile(state.board, landing, pet.owner);
      return;
    }
  }
  // Wall ahead, or pet with no clear landing → scurry-turn.
  scurryTurn(pet);
}

export const RABBIT: PetDefinition = {
  id: 'rabbit',
  displayName: 'Rabbit',
  emoji: '🐰',
  cost: STATS.cost,
  size: { w: 1, h: 1 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  ui: {
    hotkey: '4',
    short: 'Hops over blockers',
    ability:
      'When a pet blocks its path, leaps over it onto the tile beyond. Refuses to fight — paints and hops only.',
  },
  tuples: [
    { intervalSec: 1 / STATS.speedTilesPerSec, trigger: () => true, action: rabbitStep },
  ],
};
