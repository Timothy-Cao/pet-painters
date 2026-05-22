import type { MatchState } from '../types/game';
import type { Pet } from '../types/pet';
import { getPetDef } from './pet-defs';
import { frontTiles, footprintTiles } from './geometry';
import { pushHit, pushDamage } from '../render/effects';

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
  const targets = enemiesInFront(pet, state);
  // Compute attack direction from facing for attack bump animation.
  const dirVec: Record<string, [number, number]> = { N: [0,1], S: [0,-1], E: [1,0], W: [-1,0] };
  const [aDx, aDy] = dirVec[pet.facing] ?? [0, 0];
  for (const target of targets) {
    target.hp -= def.atk;
    pushHit(target.anchor.x, target.anchor.y, pet.owner, target.petId, pet.petId, aDx, aDy);
    if (def.atk > 0) pushDamage(target.anchor.x, target.anchor.y, pet.owner, def.atk);
  }
}
