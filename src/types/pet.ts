import type { Direction, PlayerId, Vec2, MatchState } from './game';

export interface PetTuple {
  intervalSec: number;
  trigger: (pet: Pet, state: MatchState) => boolean;
  action: (pet: Pet, state: MatchState) => void;
}

/**
 * Stats that are tunable per pet. The required fields appear in the popup; any
 * extra bespoke fields (e.g. wanderTurnChance, splashPerSec) can live on the
 * concrete pet stats object without showing up here.
 */
export interface PetStats {
  readonly cost: number;
  readonly speedTilesPerSec: number;
  readonly weight: number;
  readonly maxHp: number;
  readonly atk: number;
  readonly atkSpeedPerSec: number;
  readonly order: number;
}

/** UI metadata co-located with the pet so adding a pet stays one-file. */
export interface PetUiMetadata {
  /** Keyboard digit for quick-select. Should be unique across pets. */
  readonly hotkey: string;
  /** 3–5 word blurb shown on the roster card. */
  readonly short: string;
  /** Longer description shown in the anchored popup. */
  readonly ability: string;
}

/**
 * Broad gameplay archetype. Drives the aura color rendered behind the pet
 * sprite so players can read role at a glance. Multiple pets may share a role.
 */
export type PetRole = 'painter' | 'predator' | 'tank' | 'disruptor' | 'specialist';

export interface PetDefinition {
  id: string;
  displayName: string;
  emoji: string;
  cost: number;
  size: { w: number; h: number };
  weight: number;
  maxHp: number;
  atk: number;
  order: number;
  tuples: PetTuple[];
  /** Raw stat block (the source of truth — top-level fields are mirrored from here). */
  stats: PetStats;
  /** UI/UX metadata used by the roster and HUD. */
  ui: PetUiMetadata;
  /** Visual archetype. Drives the role aura behind the pet. */
  role: PetRole;
  // Optional traits
  immovable?: boolean;
}

export interface Pet {
  petId: number;            // unique per match
  defId: string;
  owner: PlayerId;
  anchor: Vec2;             // top-left tile of the footprint
  facing: Direction;
  hp: number;
  deployTick: number;
  // last-fired tick per tuple index, parallel to def.tuples; -1 means never fired
  tupleLastFireTick: number[];
}
