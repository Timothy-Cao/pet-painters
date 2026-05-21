import type { PetDefinition } from '../../types/pet';
import { enemiesInFront, applyAttack } from '../combat';
import { walkOrScurry } from '../behaviors';

const STATS = {
  cost: 2,
  speedTilesPerSec: 4,
  weight: 1,
  maxHp: 3,
  atk: 1,
  atkSpeedPerSec: 1,
  order: 2,
} as const;

export const MOUSE: PetDefinition = {
  id: 'mouse',
  displayName: 'Mouse',
  emoji: '🐭',
  cost: STATS.cost,
  size: { w: 1, h: 1 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  ui: {
    hotkey: '1',
    short: 'Scurries, scared of others',
    ability:
      'Sprints in a straight line, then turns randomly the moment anything blocks its path. Painter, not a fighter.',
  },
  tuples: [
    // Move-or-turn in one tuple: random turn if blocked, else step forward.
    // Single tuple guarantees the mouse never turns AND moves in the same tick.
    {
      intervalSec: 1 / STATS.speedTilesPerSec,
      trigger: () => true,
      action: walkOrScurry,
    },
    // Mouse can bite if cornered.
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: applyAttack,
    },
  ],
};
