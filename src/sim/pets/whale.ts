import type { PetDefinition } from '../../types/pet';
import { walkOrTurnAtWall } from '../behaviors';

const STATS = {
  cost: 6,                        // reduced from 7 — enables more budget-compatible combos (e.g. whale+bear+cat)
  speedTilesPerSec: 0.4,          // slowest — even a touch slower than elephant
  weight: 15,                     // 50% heavier than elephant; pushes everything except itself
  maxHp: 35,                      // largest HP pool of any pet
  atk: 0,                         // pacifist — its mass is the weapon
  atkSpeedPerSec: 0,
  order: 1,                       // acts early, but only walks
} as const;

export const WHALE: PetDefinition = {
  id: 'whale',
  displayName: 'Whale',
  emoji: '🐳',
  cost: STATS.cost,
  size: { w: 3, h: 3 },            // first 3×3 pet
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  immovable: true,
  stats: STATS,
  role: 'painter',
  ui: {
    hotkey: 'e',
    short: 'Massive ocean drift',
    ability:
      '3×3 painter. Drifts forward slowly and turns at walls. Its sheer size paints three fresh tiles every step — and nothing can move it.',
  },
  tuples: [
    {
      intervalSec: 1 / STATS.speedTilesPerSec,
      trigger: () => true,
      action: walkOrTurnAtWall,
    },
  ],
};
