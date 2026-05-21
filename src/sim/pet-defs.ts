// Thin facade over the per-pet modules in src/sim/pets/. Existing callers
// (`getPetDef`, exported MOUSE/ELEPHANT/etc.) keep working unchanged. New code
// should prefer importing from `./pets` directly.

import type { PetDefinition } from '../types/pet';
import { ALL_PETS } from './pets';

export { ALL_PETS } from './pets';
export { MOUSE, ELEPHANT, CAT, RABBIT, TURTLE, SKUNK } from './pets';

const REGISTRY: Record<string, PetDefinition> = Object.fromEntries(
  ALL_PETS.map((def) => [def.id, def]),
);

export function getPetDef(id: string): PetDefinition {
  const def = REGISTRY[id];
  if (!def) throw new Error(`Unknown pet def: ${id}`);
  return def;
}

// Tuple indices for the Mouse, used by older tests. Kept here for the test
// harness; new code should reference behavior by name, not by tuple index.
export const TUPLE_INDEX_MOVE = 0;
export const TUPLE_INDEX_ATTACK = 1;
