import type { MatchState } from '../types/game';
import type { Pet } from '../types/pet';
import { getPetDef } from './pet-defs';
import { frontTiles, footprintTiles } from './geometry';
import { pushHit } from '../render/effects';

export function enemiesInFront(pet: Pet, state: MatchState): Pet[] {
  const def = getPetDef(pet.defId);
  const fronts = frontTiles(pet.anchor, def.size, pet.facing);
  const result: Pet[] = [];
  const seen = new Set<number>();
  for (const other of state.pets) {
    if (other.owner === pet.owner) continue;
    if (seen.has(other.petId)) continue;
    const odef = getPetDef(other.defId);
    const ofoot = footprintTiles(other.anchor, odef.size);
    for (const ft of fronts) {
      if (ofoot.some((p) => p.x === ft.x && p.y === ft.y)) {
        result.push(other);
        seen.add(other.petId);
        break;
      }
    }
  }
  return result;
}

export function applyAttack(pet: Pet, state: MatchState): void {
  const def = getPetDef(pet.defId);
  for (const target of enemiesInFront(pet, state)) {
    target.hp -= def.atk;
    pushHit(target.anchor.x, target.anchor.y, pet.owner);
  }
}
