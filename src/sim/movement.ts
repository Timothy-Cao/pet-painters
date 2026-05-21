import type { MatchState, Vec2, Direction } from '../types/game';
import type { Pet } from '../types/pet';
import { getPetDef } from './pet-defs';
import { footprintTiles } from './pets';
import { paintTile } from './board';

function tileKey(v: Vec2): string { return `${v.x},${v.y}`; }

function delta(facing: Direction): Vec2 {
  switch (facing) {
    case 'N': return { x: 0, y: 1 };
    case 'S': return { x: 0, y: -1 };
    case 'E': return { x: 1, y: 0 };
    case 'W': return { x: -1, y: 0 };
  }
}

function inBounds(state: MatchState, p: Vec2): boolean {
  return p.x >= 0 && p.x < state.board.size && p.y >= 0 && p.y < state.board.size;
}

function petAt(state: MatchState, p: Vec2): Pet | null {
  for (const other of state.pets) {
    const odef = getPetDef(other.defId);
    for (const ft of footprintTiles(other.anchor, odef.size)) {
      if (ft.x === p.x && ft.y === p.y) return other;
    }
  }
  return null;
}

type PushResult =
  | { kind: 'clear' }
  | { kind: 'pushable'; chain: Pet[] }
  | { kind: 'blocked' };

function evaluatePush(pusher: Pet, state: MatchState): PushResult {
  const def = getPetDef(pusher.defId);
  const d = delta(pusher.facing);
  const pusherWeight = def.weight;

  // Compute the pusher's front tiles (one step ahead of its footprint in facing direction)
  const newFront: Vec2[] = [];
  if (pusher.facing === 'N' || pusher.facing === 'S') {
    const newRow = pusher.facing === 'N'
      ? pusher.anchor.y + def.size.h
      : pusher.anchor.y - 1;
    for (let dx = 0; dx < def.size.w; dx++) {
      newFront.push({ x: pusher.anchor.x + dx, y: newRow });
    }
  } else {
    const newCol = pusher.facing === 'E'
      ? pusher.anchor.x + def.size.w
      : pusher.anchor.x - 1;
    for (let dy = 0; dy < def.size.h; dy++) {
      newFront.push({ x: newCol, y: pusher.anchor.y + dy });
    }
  }

  // If any front tile is out of bounds, pusher is blocked by wall
  for (const t of newFront) {
    if (!inBounds(state, t)) return { kind: 'blocked' };
  }

  // Gather direct blockers (pets occupying front tiles)
  const directBlockers = new Set<Pet>();
  for (const t of newFront) {
    const p = petAt(state, t);
    if (p && p !== pusher) directBlockers.add(p);
  }

  // No blockers → clear path
  if (directBlockers.size === 0) return { kind: 'clear' };

  // Check each direct blocker: must be 1x1, not flagged immovable, and weight < pusher/2
  for (const b of directBlockers) {
    const bdef = getPetDef(b.defId);
    if (bdef.immovable) return { kind: 'blocked' };
    if (bdef.size.w !== 1 || bdef.size.h !== 1) return { kind: 'blocked' };
    if (bdef.weight * 2 >= pusherWeight) return { kind: 'blocked' };
  }

  // Build push chain: walk each front column until empty tile or obstruction
  const chainSet = new Set<number>(); // petIds to avoid duplicates
  const chain: Pet[] = [];

  for (const start of newFront) {
    const firstPet = petAt(state, start);
    if (!firstPet || firstPet === pusher) continue;
    if (chainSet.has(firstPet.petId)) continue;
    chainSet.add(firstPet.petId);
    chain.push(firstPet);

    let cursor: Vec2 = { x: start.x, y: start.y };
    while (true) {
      const next: Vec2 = { x: cursor.x + d.x, y: cursor.y + d.y };
      if (!inBounds(state, next)) return { kind: 'blocked' };
      const np = petAt(state, next);
      if (!np) break; // empty tile found — chain can be pushed
      if (np === pusher) break;
      const ndef = getPetDef(np.defId);
      if (ndef.immovable) return { kind: 'blocked' };
      if (ndef.size.w !== 1 || ndef.size.h !== 1) return { kind: 'blocked' };
      if (ndef.weight * 2 >= pusherWeight) return { kind: 'blocked' };
      if (!chainSet.has(np.petId)) {
        chainSet.add(np.petId);
        chain.push(np);
      }
      cursor = next;
    }
  }

  // Check total weight of chain
  const sum = chain.reduce((s, p) => s + getPetDef(p.defId).weight, 0);
  if (2 * sum >= pusherWeight) return { kind: 'blocked' };

  return { kind: 'pushable', chain };
}

export function resolveMovements(state: MatchState): void {
  // Only process intents for pets that are still alive
  const aliveIntents = state.moveIntents.filter((i) =>
    state.pets.some((p) => p.petId === i.petId)
  );

  // Group intents by destination tile key to find conflicts
  const byDest = new Map<string, { pet: Pet; intentIdx: number }[]>();
  aliveIntents.forEach((intent, i) => {
    const pet = state.pets.find((p) => p.petId === intent.petId)!;
    const key = tileKey(intent.to);
    if (!byDest.has(key)) byDest.set(key, []);
    byDest.get(key)!.push({ pet, intentIdx: i });
  });

  // Resolve same-empty-tile conflicts: higher weight wins; tie = random; loser is blocked
  const blockedIds = new Set<number>();
  for (const group of byDest.values()) {
    if (group.length <= 1) continue;
    // Only apply conflict resolution if the destination is currently empty
    const destKey = tileKey(aliveIntents[group[0].intentIdx].to);
    const destCoord = aliveIntents[group[0].intentIdx].to;
    const destOccupied = petAt(state, destCoord) !== null;
    if (destOccupied) continue; // push logic will handle occupied tiles
    // Sort: higher weight first; tie → random
    group.sort((a, b) => {
      const aw = getPetDef(a.pet.defId).weight;
      const bw = getPetDef(b.pet.defId).weight;
      if (bw !== aw) return bw - aw;
      return Math.random() - 0.5;
    });
    // All but the first are blocked
    for (let i = 1; i < group.length; i++) {
      blockedIds.add(group[i].pet.petId);
    }
    void destKey; // suppress unused warning
  }

  // Process intents in weight-descending order (heavier pets resolve first)
  const ordered = aliveIntents
    .filter((i) => !blockedIds.has(i.petId))
    .map((i) => ({ intent: i, pet: state.pets.find((p) => p.petId === i.petId)! }))
    .sort((a, b) => {
      const aw = getPetDef(a.pet.defId).weight;
      const bw = getPetDef(b.pet.defId).weight;
      if (bw !== aw) return bw - aw;
      return a.pet.petId - b.pet.petId; // tie → lower petId first
    });

  for (const { pet } of ordered) {
    const result = evaluatePush(pet, state);
    if (result.kind === 'blocked') continue;

    const def = getPetDef(pet.defId);
    const oldFootprint = footprintTiles(pet.anchor, def.size);
    const oldKeys = new Set(oldFootprint.map(tileKey));

    if (result.kind === 'pushable') {
      // Shift all pushed pets one tile in the pusher's facing direction
      const d = delta(pet.facing);
      for (const c of result.chain) {
        c.anchor = { x: c.anchor.x + d.x, y: c.anchor.y + d.y };
      }
    }

    // Advance the pusher's anchor one step in facing direction
    const d = delta(pet.facing);
    pet.anchor = { x: pet.anchor.x + d.x, y: pet.anchor.y + d.y };

    // Paint newly entered tiles
    const newFootprint = footprintTiles(pet.anchor, def.size);
    for (const t of newFootprint) {
      if (!oldKeys.has(tileKey(t))) {
        paintTile(state.board, t, pet.owner);
      }
    }
  }

  state.moveIntents = [];
}
