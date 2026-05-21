import type { MatchState } from '../types/game';
import { getPetDef } from './pet-defs';
import { TICKS_PER_SEC } from '../config/constants';

export function advanceTick(state: MatchState): void {
  if (state.phase !== 'execution') return;
  state.tick += 1;

  for (const pet of state.pets) {
    if (pet.hp <= 0) continue;
    const def = getPetDef(pet.defId);
    for (let i = 0; i < def.tuples.length; i++) {
      if (pet.hp <= 0) break;
      const tuple = def.tuples[i];
      const intervalTicks = Math.round(tuple.intervalSec * TICKS_PER_SEC);
      const lastFire = pet.tupleLastFireTick[i];
      const referenceTick = lastFire >= 0 ? lastFire : pet.deployTick;
      if (state.tick - referenceTick >= intervalTicks) {
        if (tuple.trigger(pet, state)) {
          tuple.action(pet, state);
        }
        pet.tupleLastFireTick[i] = state.tick;
      }
    }
  }

  // Death cleanup (Task 7 will add resolveMovements call after this line)
  state.pets = state.pets.filter((p) => p.hp > 0);
}
