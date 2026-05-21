import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { anyPetAt, tileInBounds, walkOrTurnAtWall } from '../behaviors';
import { pushDamage, pushFlame, pushHit } from '../../render/effects';

const STATS = {
  cost: 9,
  speedTilesPerSec: 0.5,
  weight: 9,                      // just under Elephant — still pushable by an elephant
  maxHp: 20,
  atk: 3,                         // damage per affected tile in the cone
  atkSpeedPerSec: 0.75,           // breathes every ~1.33s (was every 2s)
  order: 1,
  breathRange: 3,                 // tiles ahead of the front edge to scorch
} as const;

/** All tiles in the dragon's forward "cone": its 2-wide front edge, extended
 *  `breathRange` tiles in the facing direction. */
function coneTiles(pet: Pet, range: number): Vec2[] {
  const tiles: Vec2[] = [];
  // For each depth (1..range) and each lateral position on the front edge.
  for (let depth = 1; depth <= range; depth++) {
    if (pet.facing === 'N' || pet.facing === 'S') {
      const y = pet.anchor.y + (pet.facing === 'N' ? 2 + (depth - 1) : -depth);
      // Footprint is 2 wide along x, so two cone columns.
      tiles.push({ x: pet.anchor.x, y });
      tiles.push({ x: pet.anchor.x + 1, y });
    } else {
      const x = pet.anchor.x + (pet.facing === 'E' ? 2 + (depth - 1) : -depth);
      tiles.push({ x, y: pet.anchor.y });
      tiles.push({ x, y: pet.anchor.y + 1 });
    }
  }
  return tiles;
}

function dragonBreath(pet: Pet, state: MatchState): void {
  const cone = coneTiles(pet, STATS.breathRange);
  const damaged = new Set<number>();

  for (const t of cone) {
    if (!tileInBounds(state, t)) continue;
    // Always paint the flame for that tile, even if no target — it sells the
    // breath as a sustained AOE rather than a per-target attack.
    pushFlame(t.x, t.y, pet.owner);

    const occupant = anyPetAt(state, t, pet);
    if (!occupant || occupant.owner === pet.owner) continue;
    if (damaged.has(occupant.petId)) continue;
    damaged.add(occupant.petId);
    occupant.hp -= STATS.atk;
    pushHit(t.x, t.y, pet.owner);
    pushDamage(t.x, t.y, pet.owner, STATS.atk);
  }
}

export const DRAGON: PetDefinition = {
  id: 'dragon',
  displayName: 'Dragon',
  emoji: '🐉',
  cost: STATS.cost,
  size: { w: 2, h: 2 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  role: 'predator',
  ui: {
    hotkey: 'w',
    short: 'Breathes fire ahead',
    ability:
      '2×2 caster. Walks slowly forward, but every 2 seconds exhales a 2×3 cone of fire that hits every enemy in the six tiles directly ahead for 3 damage each.',
  },
  tuples: [
    // Slow patrol.
    {
      intervalSec: 1 / STATS.speedTilesPerSec,
      trigger: () => true,
      action: walkOrTurnAtWall,
    },
    // Fire breath fires unconditionally — even into open air, the flame
    // animation plays and any enemies caught take damage.
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: () => true,
      action: dragonBreath,
    },
  ],
};
