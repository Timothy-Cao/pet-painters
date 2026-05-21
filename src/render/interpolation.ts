// Per-pet render-side interpolation cache. The sim assigns each pet a discrete
// `anchor` and `facing` at every tick; this module is responsible for sliding
// pets smoothly between those discrete states across animation frames.
//
// Each pet's cache entry has a (from, to) pair and a startMs. When the sim
// updates the pet to a new target, the lerp's "from" is rebased to the pet's
// current interpolated position so movement is never visibly snapped.

import type { Pet } from '../types/pet';
import type { Direction } from '../types/game';
import { TICKS_PER_SEC } from '../config/constants';

const TICK_MS = 1000 / TICKS_PER_SEC;        // 50ms at 20Hz
const LERP_MS = TICK_MS;                     // one full tick per slide

const FACING_RAD: Record<Direction, number> = {
  N: 0,
  E: Math.PI / 2,
  S: Math.PI,
  W: -Math.PI / 2,
};

interface History {
  fromX: number;
  fromY: number;
  fromRad: number;
  toX: number;
  toY: number;
  toRad: number;
  startMs: number;
}

const history = new Map<number, History>();

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Wraps a delta into (-π, π] so a turn always takes the shorter arc. */
function shortestRadDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}

/** Quadratic ease-out — fast start, gentle finish. Reads as confident motion. */
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export interface RenderPosition {
  x: number;      // fractional anchor x in tile space
  y: number;      // fractional anchor y in tile space
  rad: number;    // facing in radians (can drift outside [-π, π]; renderer doesn't care)
}

export function getRenderPosition(pet: Pet): RenderPosition {
  const targetX = pet.anchor.x;
  const targetY = pet.anchor.y;
  const targetRad = FACING_RAD[pet.facing];
  const t = now();
  let hist = history.get(pet.petId);

  if (!hist) {
    // First sighting — skip the lerp, snap to current.
    hist = {
      fromX: targetX, fromY: targetY, fromRad: targetRad,
      toX: targetX, toY: targetY, toRad: targetRad,
      startMs: t - LERP_MS,
    };
    history.set(pet.petId, hist);
    return { x: targetX, y: targetY, rad: targetRad };
  }

  const targetChanged =
    hist.toX !== targetX || hist.toY !== targetY || hist.toRad !== targetRad;

  if (targetChanged) {
    // Rebase: compute where we are right NOW under the old lerp, then start
    // a fresh lerp from that point to the new target.
    const elapsed = t - hist.startMs;
    const tNorm = Math.min(1, Math.max(0, elapsed / LERP_MS));
    const eased = easeOut(tNorm);
    const currX = hist.fromX + (hist.toX - hist.fromX) * eased;
    const currY = hist.fromY + (hist.toY - hist.fromY) * eased;
    const currRad = hist.fromRad + shortestRadDelta(hist.fromRad, hist.toRad) * eased;

    hist.fromX = currX;
    hist.fromY = currY;
    hist.fromRad = currRad;
    hist.toX = targetX;
    hist.toY = targetY;
    hist.toRad = targetRad;
    hist.startMs = t;
  }

  const elapsed = t - hist.startMs;
  const tNorm = Math.min(1, Math.max(0, elapsed / LERP_MS));
  const eased = easeOut(tNorm);
  return {
    x: hist.fromX + (hist.toX - hist.fromX) * eased,
    y: hist.fromY + (hist.toY - hist.fromY) * eased,
    rad: hist.fromRad + shortestRadDelta(hist.fromRad, hist.toRad) * eased,
  };
}

/** Drop entries whose petId is no longer in the live pet list. */
export function pruneRenderHistory(livePetIds: Iterable<number>): void {
  const alive = new Set<number>();
  for (const id of livePetIds) alive.add(id);
  for (const id of history.keys()) {
    if (!alive.has(id)) history.delete(id);
  }
}

/** Wipe everything — used on match reset. */
export function clearRenderHistory(): void {
  history.clear();
}
