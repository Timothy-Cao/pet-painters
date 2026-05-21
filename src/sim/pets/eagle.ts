import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { paintTile } from '../board';
import { anyPetAt, facingDelta, scurryTurn, tileInBounds } from '../behaviors';
import { enemiesInFront } from '../combat';
import { getPetDef } from '../pet-defs';
import { pushFlutter, pushHit, pushDamage } from '../../render/effects';

const STATS = {
  cost: 3,
  speedTilesPerSec: 1,            // one tuple-fire per second
  weight: 1,
  maxHp: 3,
  atk: 2,                         // base damage vs any enemy (doubled vs 1×1 targets)
  atkSpeedPerSec: 1,
  order: 2,
} as const;

function eagleFly(pet: Pet, state: MatchState): void {
  // The eagle flies exactly 2 tiles forward each step — ignoring whatever pet
  // happens to be in the intermediate tile. Painting only happens on the
  // landing tile.
  const d = facingDelta(pet.facing);
  const landing: Vec2 = {
    x: pet.anchor.x + d.x * 2,
    y: pet.anchor.y + d.y * 2,
  };
  if (!tileInBounds(state, landing) || anyPetAt(state, landing, pet)) {
    // Can't land — turn instead.
    scurryTurn(pet);
    return;
  }
  // Liftoff flutter at the takeoff tile.
  pushFlutter(pet.anchor.x, pet.anchor.y, pet.owner, d.x, d.y);
  pet.anchor = landing;
  paintTile(state.board, landing, pet.owner);
}

function eagleTalon(pet: Pet, state: MatchState): void {
  const def = getPetDef(pet.defId);
  for (const target of enemiesInFront(pet, state)) {
    const targetDef = getPetDef(target.defId);
    const isSmall = targetDef.size.w === 1 && targetDef.size.h === 1;
    const dmg = isSmall ? def.atk * 2 : def.atk;
    target.hp -= dmg;
    pushHit(target.anchor.x, target.anchor.y, pet.owner);
    if (dmg > 0) pushDamage(target.anchor.x, target.anchor.y, pet.owner, dmg);
  }
}

export const EAGLE: PetDefinition = {
  id: 'eagle',
  displayName: 'Eagle',
  emoji: '🦅',
  cost: STATS.cost,
  size: { w: 1, h: 1 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  role: 'specialist',
  ui: {
    hotkey: '9',
    short: 'Flies 2 tiles, +2× dmg vs small',
    ability:
      'Once a second, the eagle flies 2 tiles forward, ignoring any pet in between. Paints only the landing tile. Deals 2 damage per strike to any enemy in front, doubled to 4 damage against 1×1 pets.',
  },
  tuples: [
    { intervalSec: 1 / STATS.speedTilesPerSec, trigger: () => true, action: eagleFly },
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: eagleTalon,
    },
  ],
};
