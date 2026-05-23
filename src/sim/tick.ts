import type { MatchState } from '../types/game';
import { getPetDef } from './pet-defs';
import { TICKS_PER_SEC } from '../config/constants';
import { resolveMovements } from './movement';
import { pushEvent } from '../ui/event-log';
import { pushPoof } from '../render/effects';

export function advanceTick(state: MatchState): void {
  if (state.phase !== 'execution') return;
  state.tick += 1;

  for (const pet of state.pets) {
    if (pet.hp <= 0) continue;
    // Frozen pets (e.g. webbed by a spider) skip all tuple firing this tick.
    if (pet.frozenUntilTick !== undefined && state.tick < pet.frozenUntilTick) continue;
    // Clear stale boost markers so the renderer only sees active ones.
    if (pet.boostedUntilTick !== undefined && state.tick >= pet.boostedUntilTick) {
      pet.boostedUntilTick = undefined;
    }
    const def = getPetDef(pet.defId);
    // Boosted pets fire all their tuples on a halved interval — 2× action rate
    // for the duration. Movement, attacks, special abilities all accelerate.
    const isBoosted = pet.boostedUntilTick !== undefined && state.tick < pet.boostedUntilTick;
    for (let i = 0; i < def.tuples.length; i++) {
      if (pet.hp <= 0) break;
      const tuple = def.tuples[i];
      const baseIntervalTicks = Math.round(tuple.intervalSec * TICKS_PER_SEC);
      const intervalTicks = isBoosted ? Math.max(1, Math.floor(baseIntervalTicks / 2)) : baseIntervalTicks;
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

  // Death cleanup — emit the death poof and log each dying pet.
  for (const p of state.pets) {
    if (p.hp <= 0) {
      const d = getPetDef(p.defId);
      pushEvent(d.emoji, `${d.displayName} (${p.owner}) fell`);
      // Poof at the pet's center (anchor + half-size for multi-tile pets).
      pushPoof(p.anchor.x + (d.size.w - 1) / 2, p.anchor.y + (d.size.h - 1) / 2, p.owner, p.petId);
    }
  }
  state.pets = state.pets.filter((p) => p.hp > 0);

  resolveMovements(state);
}
