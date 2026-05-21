import type { PetDefinition, Pet } from '../../types/pet';
import { enemiesInFront, applyAttack } from '../combat';
import { walkOrTurnAtWall } from '../behaviors';

const STATS = {
  cost: 6,                          // corner-zones r1: 8→6 — dead on 20×20; needs affordability to justify slow crossing
  speedTilesPerSec: 1.0,            // corner-zones r2: 0.8→1.0 — 20×20 diagonal is ~14 tiles; needs reach
  rageSpeedTilesPerSec: 1.6,      // double when wounded
  weight: 8,                      // lighter than elephant (10) — Elephant CAN push Bear
  maxHp: 18,                        // corner-zones r2: 14→18 — longer board crossing means bear needs durability to stay relevant
  atk: 3,                         // higher than elephant; mouse dies in one swipe
  atkSpeedPerSec: 1,
  order: 1,
} as const;

function isRaged(pet: Pet): boolean {
  return pet.hp <= STATS.maxHp / 2;
}

export const BEAR: PetDefinition = {
  id: 'bear',
  displayName: 'Bear',
  emoji: '🐻',
  cost: STATS.cost,
  size: { w: 2, h: 2 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  role: 'predator',
  // Aura goes red and intense once HP drops to half.
  getAuraColor(pet) {
    return isRaged(pet)
      ? 'rgba(242, 95, 92, 0.85)'   // hot rage red
      : 'rgba(255, 174, 102, 0.65)'; // warm bear orange (still in predator family)
  },
  ui: {
    hotkey: '0',
    short: 'Wounded = faster',
    ability:
      '2×2 bruiser. Trudges forward at a walk, but at half HP or less it enters rage and doubles its pace. Hits hard enough to one-shot mice.',
  },
  tuples: [
    // Rage move (fast cadence) fires only when wounded.
    {
      intervalSec: 1 / STATS.rageSpeedTilesPerSec,
      trigger: isRaged,
      action: walkOrTurnAtWall,
    },
    // Calm move otherwise.
    {
      intervalSec: 1 / STATS.speedTilesPerSec,
      trigger: (pet) => !isRaged(pet),
      action: walkOrTurnAtWall,
    },
    // Standard 1/sec swipe.
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: applyAttack,
    },
  ],
};
