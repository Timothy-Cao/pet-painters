import type { PetDefinition } from '../types/pet';
import { MOUSE_STATS, ELEPHANT_STATS } from '../config/balance';

const stubTuple = {
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
    { ...stubTuple, intervalSec: 1 / MOUSE_STATS.speedTilesPerSec },     // move
    { ...stubTuple, intervalSec: 1 / MOUSE_STATS.atkSpeedPerSec },        // attack
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
    { ...stubTuple, intervalSec: 1 / ELEPHANT_STATS.speedTilesPerSec },
    { ...stubTuple, intervalSec: 1 / ELEPHANT_STATS.atkSpeedPerSec },
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
