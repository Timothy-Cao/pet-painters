import type { PetDefinition, Pet } from '../../types/pet';
import type { MatchState } from '../../types/game';
import { enemiesInFront } from '../combat';
import { walkOrTurnAtWall } from '../behaviors';
import { getPetDef } from '../pet-defs';
import { footprintTiles } from '../geometry';
import { pushHit, pushDamage } from '../../render/effects';

const STATS = {
  cost: 5,                          // stomp r2: 3→5 — at 3 Elephant dominated at 84.8%; cost forces real tradeoff
  speedTilesPerSec: 0.75,           // final balance r2: 0.5→0.75 — needs to reach combat sooner
  weight: 10,
  maxHp: 25,
  atk: 2,
  rageAtk: 6,                       // final balance: tusks rage — atk doubles at half HP
  atkSpeedPerSec: 0.5,
  stompDamage: 3,                   // stomp r2: 5→3 — still one-shots Mouse/Rabbit/Spider (3hp); leaves Cat/Lion/Eagle (4hp) alive
  stompIntervalSec: 1,
  order: 1,
} as const;

function isRaged(pet: Pet): boolean {
  return pet.hp <= STATS.maxHp / 2;
}

/** Tusks rage attack: doubled damage when at half HP or below. */
function elephantAttack(pet: Pet, state: MatchState): void {
  const targets = enemiesInFront(pet, state);
  if (!targets.length) return;
  const damage = isRaged(pet) ? STATS.rageAtk : STATS.atk;
  for (const target of targets) {
    target.hp -= damage;
    pushHit(target.anchor.x, target.anchor.y, pet.owner);
    pushDamage(target.anchor.x, target.anchor.y, pet.owner, damage);
  }
}

/**
 * Stomp trigger: returns true if any enemy 1×1 pet is within Chebyshev
 * distance 1 of Elephant's footprint (i.e. adjacent or overlapping).
 */
function hasAdjacentSmallEnemy(pet: Pet, state: MatchState): boolean {
  const myDef = getPetDef(pet.defId);
  // Collect all tiles in and around the elephant's footprint (Chebyshev 1)
  const expandedTiles = new Set<string>();
  for (let dy = -1; dy <= myDef.size.h; dy++) {
    for (let dx = -1; dx <= myDef.size.w; dx++) {
      expandedTiles.add(`${pet.anchor.x + dx},${pet.anchor.y + dy}`);
    }
  }

  for (const other of state.pets) {
    if (other.owner === pet.owner) continue;
    const oDef = getPetDef(other.defId);
    if (oDef.size.w !== 1 || oDef.size.h !== 1) continue;
    const oFoot = footprintTiles(other.anchor, oDef.size);
    for (const tile of oFoot) {
      if (expandedTiles.has(`${tile.x},${tile.y}`)) return true;
    }
  }
  return false;
}

/**
 * Stomp action: deal stompDamage to each adjacent 1×1 enemy pet.
 * Each pet is hit at most once per stomp (dedup by petId).
 */
function elephantStomp(pet: Pet, state: MatchState): void {
  const myDef = getPetDef(pet.defId);
  const expandedTiles = new Set<string>();
  for (let dy = -1; dy <= myDef.size.h; dy++) {
    for (let dx = -1; dx <= myDef.size.w; dx++) {
      expandedTiles.add(`${pet.anchor.x + dx},${pet.anchor.y + dy}`);
    }
  }

  const hit = new Set<number>();
  for (const other of state.pets) {
    if (other.owner === pet.owner) continue;
    if (hit.has(other.petId)) continue;
    const oDef = getPetDef(other.defId);
    if (oDef.size.w !== 1 || oDef.size.h !== 1) continue;
    const oFoot = footprintTiles(other.anchor, oDef.size);
    for (const tile of oFoot) {
      if (expandedTiles.has(`${tile.x},${tile.y}`)) {
        other.hp -= STATS.stompDamage;
        hit.add(other.petId);
        pushHit(other.anchor.x, other.anchor.y, pet.owner);
        pushDamage(other.anchor.x, other.anchor.y, pet.owner, STATS.stompDamage);
        break;
      }
    }
  }
}

export const ELEPHANT: PetDefinition = {
  id: 'elephant',
  displayName: 'Elephant',
  emoji: '🐘',
  cost: STATS.cost,
  size: { w: 2, h: 2 },
  weight: STATS.weight,
  maxHp: STATS.maxHp,
  atk: STATS.atk,
  order: STATS.order,
  immovable: true,
  stats: STATS,
  role: 'tank',
  ui: {
    hotkey: '2',
    short: 'Stomps small enemies; tusks rage at half HP',
    ability:
      '2×2 pachyderm. Walks slowly forward, painting and pushing. Every second, STOMPS adjacent 1×1 pets for 5 damage — one-shots mice, cats, rabbits, skunks, and spiders. At half HP, basic attack damage doubles.',
  },
  tuples: [
    // Walk forward; about-face only at walls. Pets in front are handled by the
    // push system thanks to weight 10 and the immovable flag.
    {
      intervalSec: 1 / STATS.speedTilesPerSec,
      trigger: () => true,
      action: walkOrTurnAtWall,
    },
    // Tusks stomp: deals doubled damage when at half HP.
    {
      intervalSec: 1 / STATS.atkSpeedPerSec,
      trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
      action: elephantAttack,
    },
    // Stomp: every second, one-shot any adjacent 1×1 enemy pet.
    {
      intervalSec: STATS.stompIntervalSec,
      trigger: hasAdjacentSmallEnemy,
      action: elephantStomp,
    },
  ],
};
