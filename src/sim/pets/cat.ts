import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState, Vec2 } from '../../types/game';
import { paintTile } from '../board';
import { anyPetAt, declareMove, frontBlocked, scurryTurn, tileInBounds, KING_DELTAS } from '../behaviors';
import { pushPounce, pushDamage } from '../../render/effects';
import { MOUSE } from './mouse';

const STATS = {
  cost: 3,
  speedTilesPerSec: 2,
  weight: 2,
  maxHp: 4,
  atk: 0,
  atkSpeedPerSec: 0,
  order: 2,
  // bespoke
  wanderTurnChance: 0.25,
  pouncePerSec: 2,
} as const;

function catWander(pet: Pet, state: MatchState): void {
  // Capricious random turn even when the way is clear — keeps the cat
  // covering ground in unpredictable arcs instead of straight lines.
  if (Math.random() < STATS.wanderTurnChance) {
    scurryTurn(pet);
    return;
  }
  if (frontBlocked(pet, state)) scurryTurn(pet);
  else declareMove(pet, state);
}

function catPounce(pet: Pet, state: MatchState): void {
  // 8-neighborhood scan for enemy mice only.
  for (const d of KING_DELTAS) {
    const t: Vec2 = { x: pet.anchor.x + d.x, y: pet.anchor.y + d.y };
    if (!tileInBounds(state, t)) continue;
    const occupant = anyPetAt(state, t, pet);
    if (!occupant) continue;
    if (occupant.defId !== MOUSE.id) continue;
    if (occupant.owner === pet.owner) continue;
    const lethalDmg = occupant.hp;
    occupant.hp = 0;
    paintTile(state.board, t, pet.owner);
    pushPounce(t.x, t.y, pet.owner);
    if (lethalDmg > 0) pushDamage(t.x, t.y, pet.owner, lethalDmg);
    return;
  }
}

export const CAT: PetDefinition = {
  id: 'cat',
  displayName: 'Cat',
  emoji: '🐱',
  cost: STATS.cost,
  size: { w: 1, h: 1 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  stats: STATS,
  role: 'predator',
  ui: {
    hotkey: '3',
    short: 'Wanders wide, eats mice (+2 dmg)',
    ability:
      'Drifts in unpredictable arcs, turning randomly even when nothing blocks the path. Ignores most pets, but pounces on any enemy mouse within one tile (orthogonal or diagonal) for an instant kill. Deals +2 damage to mice (the pounce always exceeds this threshold).',
  },
  tuples: [
    { intervalSec: 1 / STATS.speedTilesPerSec, trigger: () => true, action: catWander },
    { intervalSec: 1 / STATS.pouncePerSec, trigger: () => true, action: catPounce },
  ],
};
