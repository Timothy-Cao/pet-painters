import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { paintTile } from '../board';
import { anyPetAt, facingDelta, scurryTurn, tileInBounds } from '../behaviors';
import { pushFlutter } from '../../render/effects';

const STATS = {
  cost: 4,
  speedTilesPerSec: 1,            // one tuple-fire per second
  weight: 1,
  maxHp: 3,
  atk: 0,
  atkSpeedPerSec: 0,
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
    short: 'Flies 2 tiles per step',
    ability:
      'Once a second, the eagle flies 2 tiles forward, ignoring any pet in between. Paints only the landing tile. Refuses to fight.',
  },
  tuples: [
    { intervalSec: 1 / STATS.speedTilesPerSec, trigger: () => true, action: eagleFly },
  ],
};
