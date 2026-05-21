import type { PetDefinition, Pet } from '../types/pet';
import type { MatchState, Direction, Vec2 } from '../types/game';
import { MOUSE_STATS, ELEPHANT_STATS, CAT_STATS, RABBIT_STATS, TURTLE_STATS } from '../config/balance';
import { frontTiles, footprintTiles } from './pets';
import { enemiesInFront, applyAttack } from './combat';
import { paintTile } from './board';

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

function facingDelta(d: Direction): Vec2 {
  switch (d) {
    case 'N': return { x: 0, y: 1 };
    case 'S': return { x: 0, y: -1 };
    case 'E': return { x: 1, y: 0 };
    case 'W': return { x: -1, y: 0 };
  }
}

// Cast a 1-wide ray from the pet's front edge. Returns the first thing it
// hits: an enemy pet, an allied pet, the wall, or nothing within range.
type Sighted =
  | { kind: 'enemy'; pet: Pet; distance: number }
  | { kind: 'ally'; pet: Pet; distance: number }
  | { kind: 'wall'; distance: number }
  | { kind: 'clear' };

function lookAhead(pet: Pet, state: MatchState, maxDistance: number): Sighted {
  const def = getPetDefLocal(pet.defId);
  const d = facingDelta(pet.facing);
  const fronts = frontTiles(pet.anchor, def.size, pet.facing);
  for (let dist = 0; dist < maxDistance; dist++) {
    for (const f of fronts) {
      const t: Vec2 = { x: f.x + d.x * dist, y: f.y + d.y * dist };
      if (t.x < 0 || t.x >= state.board.size || t.y < 0 || t.y >= state.board.size) {
        return { kind: 'wall', distance: dist + 1 };
      }
      for (const other of state.pets) {
        if (other === pet) continue;
        const odef = getPetDefLocal(other.defId);
        for (const o of footprintTiles(other.anchor, odef.size)) {
          if (o.x === t.x && o.y === t.y) {
            return {
              kind: other.owner !== pet.owner ? 'enemy' : 'ally',
              pet: other,
              distance: dist + 1,
            };
          }
        }
      }
    }
  }
  return { kind: 'clear' };
}

function enemyInSightline(pet: Pet, state: MatchState, maxDistance: number): boolean {
  return lookAhead(pet, state, maxDistance).kind === 'enemy';
}

function tileInBounds(state: MatchState, t: Vec2): boolean {
  return t.x >= 0 && t.x < state.board.size && t.y >= 0 && t.y < state.board.size;
}

function anyPetAt(state: MatchState, t: Vec2, except: Pet): Pet | null {
  for (const other of state.pets) {
    if (other === except) continue;
    const odef = getPetDefLocal(other.defId);
    for (const o of footprintTiles(other.anchor, odef.size)) {
      if (o.x === t.x && o.y === t.y) return other;
    }
  }
  return null;
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

function catStep(pet: Pet, state: MatchState): void {
  // Front blocked by a wall or ally → turn clockwise to keep searching.
  // (If an enemy is in the front tile, the attack tuple will handle it.)
  if (frontIsWall(pet, state) || (frontHasPet(pet, state) && enemiesInFront(pet, state).length === 0)) {
    pet.facing = CW_NEXT[pet.facing];
    return;
  }
  if (!frontHasPet(pet, state)) declareMove(pet, state);
}

export const CAT: PetDefinition = {
  id: 'cat',
  displayName: 'Cat',
  emoji: '🐱',
  cost: CAT_STATS.cost,
  size: { w: 1, h: 1 },
  weight: CAT_STATS.weight,
  maxHp: CAT_STATS.maxHp,
  atk: CAT_STATS.atk,
  order: CAT_STATS.order,
  tuples: [
    // Hunt: enemy seen in line ahead → sprint forward at hunt cadence.
    {
      intervalSec: 1 / CAT_STATS.huntSpeedTilesPerSec,
      trigger: (pet, state) => enemyInSightline(pet, state, CAT_STATS.sightRange),
      action: catStep,
    },
    // Wander: no enemy ahead → stroll forward at base cadence and turn when blocked.
    {
      intervalSec: 1 / CAT_STATS.speedTilesPerSec,
      trigger: (pet, state) => !enemyInSightline(pet, state, CAT_STATS.sightRange),
      action: catStep,
    },
    // Claw whatever is right in front of it.
    {
      intervalSec: 1 / CAT_STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: applyAttack,
    },
  ],
};

function rabbitStep(pet: Pet, state: MatchState): void {
  // Walk forward whenever the path is clear.
  if (!frontBlocked(pet, state)) {
    declareMove(pet, state);
    return;
  }
  // Try to vault: front is a pet AND the tile two steps ahead is clear and in-bounds.
  if (frontHasPet(pet, state)) {
    const d = facingDelta(pet.facing);
    const landing: Vec2 = {
      x: pet.anchor.x + d.x * 2,
      y: pet.anchor.y + d.y * 2,
    };
    if (tileInBounds(state, landing) && !anyPetAt(state, landing, pet)) {
      pet.anchor = landing;
      paintTile(state.board, landing, pet.owner);
      return;
    }
  }
  // Wall ahead, or pet ahead with no clear landing tile → scurry-turn.
  scurryTurn(pet);
}

export const RABBIT: PetDefinition = {
  id: 'rabbit',
  displayName: 'Rabbit',
  emoji: '🐰',
  cost: RABBIT_STATS.cost,
  size: { w: 1, h: 1 },
  weight: RABBIT_STATS.weight,
  maxHp: RABBIT_STATS.maxHp,
  atk: RABBIT_STATS.atk,
  order: RABBIT_STATS.order,
  tuples: [
    {
      intervalSec: 1 / RABBIT_STATS.speedTilesPerSec,
      trigger: () => true,
      action: rabbitStep,
    },
  ],
};

function turtleStep(pet: Pet, state: MatchState): void {
  if (frontBlocked(pet, state)) {
    pet.facing = CW_NEXT[pet.facing];
    return;
  }
  declareMove(pet, state);
}

function turtleSplash(pet: Pet, state: MatchState): void {
  // Paint the 4 orthogonal neighbors of the turtle's anchor in its color.
  const neighbors: Vec2[] = [
    { x: pet.anchor.x + 1, y: pet.anchor.y },
    { x: pet.anchor.x - 1, y: pet.anchor.y },
    { x: pet.anchor.x, y: pet.anchor.y + 1 },
    { x: pet.anchor.x, y: pet.anchor.y - 1 },
  ];
  for (const t of neighbors) {
    if (tileInBounds(state, t)) paintTile(state.board, t, pet.owner);
  }
}

export const TURTLE: PetDefinition = {
  id: 'turtle',
  displayName: 'Turtle',
  emoji: '🐢',
  cost: TURTLE_STATS.cost,
  size: { w: 1, h: 1 },
  weight: TURTLE_STATS.weight,
  maxHp: TURTLE_STATS.maxHp,
  atk: TURTLE_STATS.atk,
  order: TURTLE_STATS.order,
  tuples: [
    // Walk forward; turn clockwise whenever the front is blocked.
    {
      intervalSec: 1 / TURTLE_STATS.speedTilesPerSec,
      trigger: () => true,
      action: turtleStep,
    },
    // Splash paint orthogonal neighbors on its own cadence.
    {
      intervalSec: 1 / TURTLE_STATS.splashPerSec,
      trigger: () => true,
      action: turtleSplash,
    },
  ],
};

const REGISTRY: Record<string, PetDefinition> = {
  [MOUSE.id]: MOUSE,
  [ELEPHANT.id]: ELEPHANT,
  [CAT.id]: CAT,
  [RABBIT.id]: RABBIT,
  [TURTLE.id]: TURTLE,
};

export function getPetDef(id: string): PetDefinition {
  const def = REGISTRY[id];
  if (!def) throw new Error(`Unknown pet def: ${id}`);
  return def;
}

// Index into MOUSE.tuples for callers that need stable references.
export const TUPLE_INDEX_MOVE = 0;
export const TUPLE_INDEX_ATTACK = 1;
