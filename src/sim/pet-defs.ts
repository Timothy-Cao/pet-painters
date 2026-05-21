import type { PetDefinition, Pet } from '../types/pet';
import type { MatchState } from '../types/game';
import { MOUSE_STATS, ELEPHANT_STATS } from '../config/balance';
import { frontTiles } from './pets';

function getPetDefLocal(id: string): PetDefinition {
  return REGISTRY[id];
}

function frontTilesOnBoard(pet: Pet, state: MatchState): boolean {
  const def = getPetDefLocal(pet.defId);
  const fronts = frontTiles(pet.anchor, def.size, pet.facing);
  for (const t of fronts) {
    if (t.x < 0 || t.x >= state.board.size || t.y < 0 || t.y >= state.board.size) return false;
  }
  return true;
}

function declareMove(pet: Pet, state: MatchState): void {
  const to = { x: pet.anchor.x, y: pet.anchor.y };
  switch (pet.facing) {
    case 'N': to.y += 1; break;
    case 'S': to.y -= 1; break;
    case 'E': to.x += 1; break;
    case 'W': to.x -= 1; break;
  }
  state.moveIntents.push({ petId: pet.petId, from: pet.anchor, to });
}

const stubAttackTuple = {
  intervalSec: 1,
  trigger: () => false,
  action: () => {},
};

export const MOUSE: PetDefinition = {
  id: 'mouse',
  displayName: 'Mouse',
  emoji: '🐭',
  cost: MOUSE_STATS.cost,
  size: { w: 1, h: 1 },
  weight: MOUSE_STATS.weight,
  maxHp: MOUSE_STATS.maxHp,
  atk: MOUSE_STATS.atk,
  order: MOUSE_STATS.order,
  tuples: [
    {
      intervalSec: 1 / MOUSE_STATS.speedTilesPerSec,
      trigger: frontTilesOnBoard,
      action: declareMove,
    },
    { ...stubAttackTuple, intervalSec: 1 / MOUSE_STATS.atkSpeedPerSec },   // attack (Task 8)
  ],
};

export const ELEPHANT: PetDefinition = {
  id: 'elephant',
  displayName: 'Elephant',
  emoji: '🐘',
  cost: ELEPHANT_STATS.cost,
  size: { w: 2, h: 2 },
  weight: ELEPHANT_STATS.weight,
  maxHp: ELEPHANT_STATS.maxHp,
  atk: ELEPHANT_STATS.atk,
  order: ELEPHANT_STATS.order,
  tuples: [
    {
      intervalSec: 1 / ELEPHANT_STATS.speedTilesPerSec,
      trigger: frontTilesOnBoard,
      action: declareMove,
    },
    { ...stubAttackTuple, intervalSec: 1 / ELEPHANT_STATS.atkSpeedPerSec }, // attack (Task 8)
  ],
};

const REGISTRY: Record<string, PetDefinition> = {
  [MOUSE.id]: MOUSE,
  [ELEPHANT.id]: ELEPHANT,
};

export function getPetDef(id: string): PetDefinition {
  const def = REGISTRY[id];
  if (!def) throw new Error(`Unknown pet def: ${id}`);
  return def;
}

export const TUPLE_INDEX_MOVE = 0;
export const TUPLE_INDEX_ATTACK = 1;
