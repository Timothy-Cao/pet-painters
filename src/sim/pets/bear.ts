import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { enemiesInFront, applyAttack } from '../combat';
import { walkOrTurnAtWall } from '../behaviors';
import { getPetDef } from '../pet-defs';
import { footprintTiles } from '../geometry';

const STATS = {
  cost: 4,                          // reworks r2: 5→4 — must be cheaper to compete
  speedTilesPerSec: 1.0,
  rageSpeedTilesPerSec: 1.6,        // wounded = faster
  brawlSpeedTilesPerSec: 2.5,       // surrounded = berserk
  weight: 8,                        // lighter than elephant (10) — Elephant CAN push Bear
  maxHp: 18,
  atk: 3,                           // higher than elephant; mouse dies in one swipe
  atkSpeedPerSec: 1,
  order: 1,
  brawlRange: 3,                    // reworks r2: 2→3 — easier to trigger brawl on busy board
  brawlThreshold: 1,                // final balance: 2→1 — brawl triggers as soon as Bear meets ANY enemy
} as const;

function isRaged(pet: Pet): boolean {
  return pet.hp <= STATS.maxHp / 2;
}

/** Chebyshev distance between two tiles. */
function chebyshev(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Returns how many distinct enemy pets have any tile within brawlRange. */
function nearbyEnemyCount(pet: Pet, state: MatchState): number {
  let count = 0;
  for (const other of state.pets) {
    if (other.owner === pet.owner) continue;
    const odef = getPetDef(other.defId);
    for (const t of footprintTiles(other.anchor, odef.size)) {
      if (chebyshev(pet.anchor, t) <= STATS.brawlRange) {
        count++;
        break; // count this pet once even if multiple tiles are close
      }
    }
  }
  return count;
}

function isBrawling(pet: Pet, state: MatchState): boolean {
  return nearbyEnemyCount(pet, state) >= STATS.brawlThreshold;
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
  // Aura goes red and intense once HP drops to half; blazing orange when brawling.
  getAuraColor(pet) {
    return isRaged(pet)
      ? 'rgba(242, 95, 92, 0.85)'    // hot rage red
      : 'rgba(255, 174, 102, 0.65)'; // warm bear orange
  },
  ui: {
    hotkey: '0',
    short: 'Wounded = faster; surrounded = berserk',
    ability:
      '2×2 bruiser. At half HP or less it enters rage and moves at 1.6×. When ANY enemy is within 3 tiles it enters brawl mode and moves at 2.5×. Hits hard enough to one-shot mice.',
  },
  tuples: [
    // Brawl mode: 2+ enemies nearby → fastest cadence (trumps rage).
    {
      intervalSec: 1 / STATS.brawlSpeedTilesPerSec,
      trigger: (pet, state) => isBrawling(pet, state),
      action: walkOrTurnAtWall,
    },
    // Rage move (fast cadence) fires when wounded but NOT in brawl.
    {
      intervalSec: 1 / STATS.rageSpeedTilesPerSec,
      trigger: (pet, state) => isRaged(pet) && !isBrawling(pet, state),
      action: walkOrTurnAtWall,
    },
    // Calm move: neither raged nor brawling.
    {
      intervalSec: 1 / STATS.speedTilesPerSec,
      trigger: (pet, state) => !isRaged(pet) && !isBrawling(pet, state),
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
