import type { PetDefinition } from '../../types/pet';
import { enemiesInFront, applyAttack } from '../combat';
import { walkOrTurnAtWall } from '../behaviors';

const STATS = {
  cost: 6,
  speedTilesPerSec: 0.5,
  weight: 10,
  maxHp: 25,
  atk: 2,
  atkSpeedPerSec: 0.5,
  order: 1,
} as const;

export const ELEPHANT: PetDefinition = {
  id: 'elephant',
  displayName: 'Elephant',
  emoji: '🐘',
  cost: STATS.cost,
  size: { w: 2, h: 2 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  immovable: true,
  stats: STATS,
  role: 'tank',
  ui: {
    hotkey: '2',
    short: 'Unmovable, steady',
    ability:
      'Cannot be pushed by anything. Trudges in straight lines and only about-faces at walls, ramming through lighter pets along the way.',
  },
  tuples: [
    // Walk forward; about-face only at walls. Pets in front are handled by the
    // push system thanks to weight 10 and the immovable flag.
    {
      intervalSec: 1 / STATS.speedTilesPerSec,
      trigger: () => true,
      action: walkOrTurnAtWall,
    },
    // Stomp whatever's right in front.
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: applyAttack,
    },
  ],
};
