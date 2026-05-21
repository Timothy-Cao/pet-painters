import type { PetDefinition, Pet } from '../types/pet';
import type { MatchState, Direction } from '../types/game';
import { MOUSE_STATS, ELEPHANT_STATS } from '../config/balance';
import { frontTiles, footprintTiles } from './pets';
import { enemiesInFront, applyAttack } from './combat';

function getPetDefLocal(id: string): PetDefinition {
  return REGISTRY[id];
}

// ---------- Helpers exposed to behaviors ----------

function frontInBounds(pet: Pet, state: MatchState): boolean {
  const def = getPetDefLocal(pet.defId);
  for (const t of frontTiles(pet.anchor, def.size, pet.facing)) {
    if (t.x < 0 || t.x >= state.board.size || t.y < 0 || t.y >= state.board.size) return false;
  }
  return true;
}

function frontHasPet(pet: Pet, state: MatchState): boolean {
  const def = getPetDefLocal(pet.defId);
  const fronts = frontTiles(pet.anchor, def.size, pet.facing);
  for (const other of state.pets) {
    if (other === pet) continue;
    const odef = getPetDefLocal(other.defId);
    const occupied = footprintTiles(other.anchor, odef.size);
    for (const f of fronts) {
      for (const o of occupied) {
        if (o.x === f.x && o.y === f.y) return true;
      }
    }
  }
  return false;
}

function frontIsWall(pet: Pet, state: MatchState): boolean {
  return !frontInBounds(pet, state);
}

function frontBlocked(pet: Pet, state: MatchState): boolean {
  return frontIsWall(pet, state) || frontHasPet(pet, state);
}

// Choose a new facing avoiding the current one. Used by scurry.
const CW_NEXT: Record<Direction, Direction> = { N: 'E', E: 'S', S: 'W', W: 'N' };
const CCW_NEXT: Record<Direction, Direction> = { N: 'W', W: 'S', S: 'E', E: 'N' };
const OPPOSITE: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };

function scurryTurn(pet: Pet): void {
  // 45% left, 45% right, 10% back — biases to keep moving but lets it double back.
  const r = Math.random();
  if (r < 0.45) pet.facing = CCW_NEXT[pet.facing];
  else if (r < 0.9) pet.facing = CW_NEXT[pet.facing];
  else pet.facing = OPPOSITE[pet.facing];
}

function declareMove(pet: Pet, state: MatchState): void {
  const to = { x: pet.anchor.x, y: pet.anchor.y };
  switch (pet.facing) {
    case 'N': to.y += 1; break;
    case 'S': to.y -= 1; break;
    case 'E': to.x += 1; break;
    case 'W': to.x -= 1; break;
  }
  state.moveIntents.push({ petId: pet.petId, from: pet.anchor, to });
}

function turnAround(pet: Pet, _state: MatchState): void {
  pet.facing = OPPOSITE[pet.facing];
}

// ---------- Pet definitions ----------

function scurryOrMove(pet: Pet, state: MatchState): void {
  if (frontBlocked(pet, state)) scurryTurn(pet);
  else declareMove(pet, state);
}

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
    // Scurry-or-step: blocked → random turn; clear → walk forward. Either way,
    // exactly one action fires per interval, so the mouse never turns AND moves
    // in the same tick.
    {
      intervalSec: 1 / MOUSE_STATS.speedTilesPerSec,
      trigger: () => true,
      action: scurryOrMove,
    },
    // Mouse can still bite if cornered, but its goal is to keep moving.
    {
      intervalSec: 1 / MOUSE_STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: applyAttack,
    },
  ],
};

function elephantStep(pet: Pet, state: MatchState): void {
  // Wall ahead → about-face. Otherwise just barrel forward; the push system
  // will resolve any pets that happen to be in the way.
  if (frontIsWall(pet, state)) turnAround(pet, state);
  else declareMove(pet, state);
}

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
  immovable: true,
  tuples: [
    {
      intervalSec: 1 / ELEPHANT_STATS.speedTilesPerSec,
      trigger: () => true,
      action: elephantStep,
    },
    // Stomp anything immediately in front.
    {
      intervalSec: 1 / ELEPHANT_STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: applyAttack,
    },
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

// Index into MOUSE.tuples for callers that need stable references.
export const TUPLE_INDEX_MOVE = 0;
export const TUPLE_INDEX_ATTACK = 1;
