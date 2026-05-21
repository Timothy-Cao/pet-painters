import type { MatchState } from '../types/game';
import { getPetDef } from './pet-defs';
import { TICKS_PER_SEC } from '../config/constants';
import { resolveMovements } from './movement';
import { pushEvent } from '../ui/event-log';

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

  // Death cleanup — log each dying pet then remove from the live list.
  for (const p of state.pets) {
    if (p.hp <= 0) {
      const d = getPetDef(p.defId);
      pushEvent(d.emoji, `${d.displayName} (${p.owner}) fell`);
    }
  }
  state.pets = state.pets.filter((p) => p.hp > 0);

  resolveMovements(state);
}
