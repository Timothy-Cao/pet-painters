// Auto-registry of all pet definitions. To add a new pet:
//   1. Create src/sim/pets/<name>.ts exporting a PetDefinition
//   2. Add it to ALL_PETS below.
//
// Everything downstream (sim, render, UI, hotkeys) iterates ALL_PETS — so this
// is the only file outside the pet module itself that needs to know the pet
// exists.

import type { PetDefinition } from '../../types/pet';
import { MOUSE } from './mouse';
import { ELEPHANT } from './elephant';
import { CAT } from './cat';
import { RABBIT } from './rabbit';
import { TURTLE } from './turtle';
import { SKUNK } from './skunk';

export const ALL_PETS: ReadonlyArray<PetDefinition> = [
  MOUSE,
  ELEPHANT,
  CAT,
  RABBIT,
  TURTLE,
  SKUNK,
];

export { MOUSE, ELEPHANT, CAT, RABBIT, TURTLE, SKUNK };
