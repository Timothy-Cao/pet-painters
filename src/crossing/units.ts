/**
 * units.ts — Unit definitions for Critter Crossing.
 *
 * Each unit has unique movement and ability rules.
 * Movement computation lives in moves.ts; this file defines the roster.
 *
 * SYNERGY DESIGN: Units are intentionally designed to work together.
 * See moves.ts header for the full synergy map.
 */

import type { UnitDef } from './types';

export const MOUSE: UnitDef = {
  id: 'mouse',
  displayName: 'Mouse',
  emoji: '\u{1F42D}', // 🐭
  size: 1,
  terrain: 'land',
  abilityDesc: 'Scurry: Slides through friendly units in a line.',
};

export const CAT: UnitDef = {
  id: 'cat',
  displayName: 'Cat',
  emoji: '\u{1F431}', // 🐱
  size: 1,
  terrain: 'land',
  abilityDesc: 'Pounce: Leaps over any adjacent unit to land behind it.',
};

export const RABBIT: UnitDef = {
  id: 'rabbit',
  displayName: 'Rabbit',
  emoji: '\u{1F430}', // 🐰
  size: 1,
  terrain: 'land',
  abilityDesc: 'Chain Hop: Bounces over consecutive units in a line.',
};

export const TURTLE: UnitDef = {
  id: 'turtle',
  displayName: 'Turtle',
  emoji: '\u{1F422}', // 🐢
  size: 1,
  terrain: 'amphibious',
  abilityDesc: 'Shell: Swims anywhere. Cannot be pushed. Hoppers use it as a bridge.',
};

export const EAGLE: UnitDef = {
  id: 'eagle',
  displayName: 'Eagle',
  emoji: '\u{1F985}', // 🦅
  size: 1,
  terrain: 'flying',
  abilityDesc: 'Dive-bomb: Flies 2 tiles any direction. Bumps 1 enemy on landing.',
};

export const FROG: UnitDef = {
  id: 'frog',
  displayName: 'Frog',
  emoji: '\u{1F438}', // 🐸
  size: 1,
  terrain: 'amphibious',
  abilityDesc: 'Dive & Leap: In water, dives under units. From water, leaps 3 forward.',
};

export const ELEPHANT: UnitDef = {
  id: 'elephant',
  displayName: 'Elephant',
  emoji: '\u{1F418}', // 🐘
  size: 2,
  terrain: 'land',
  abilityDesc: 'Trample: Pushes ALL small units in its path — friend or foe!',
};

export const WHALE: UnitDef = {
  id: 'whale',
  displayName: 'Whale',
  emoji: '\u{1F40B}', // 🐋
  size: 2,
  terrain: 'water',
  abilityDesc: 'Splash: Pushes ALL adjacent small units outward — friend or foe!',
};

/** All unit definitions, ordered for the roster display. */
export const ALL_CROSSING_UNITS: readonly UnitDef[] = [
  MOUSE, CAT, RABBIT, TURTLE, EAGLE, FROG, ELEPHANT, WHALE,
];

/** Lookup a unit definition by id. */
export function getUnitDef(defId: string): UnitDef {
  const def = ALL_CROSSING_UNITS.find((d) => d.id === defId);
  if (!def) throw new Error(`Unknown crossing unit: ${defId}`);
  return def;
}

/** The default starting army for each player. */
export interface ArmyEntry {
  defId: string;
  count: number;
}

export const DEFAULT_ARMY: ArmyEntry[] = [
  { defId: 'rabbit', count: 3 },
  { defId: 'mouse', count: 2 },
  { defId: 'cat', count: 2 },
  { defId: 'turtle', count: 1 },
  { defId: 'eagle', count: 1 },
  { defId: 'frog', count: 1 },
  { defId: 'elephant', count: 1 },
  { defId: 'whale', count: 1 },
];
