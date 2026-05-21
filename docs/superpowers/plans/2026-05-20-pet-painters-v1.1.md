# Pet Painters v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally playable 2-player browser game implementing the v1.1 design spec — tick-and-plan time model, 12×12 board, Mouse and Elephant pets, paint-to-75% win.

**Architecture:** Pure-functional simulation engine in TypeScript (deterministic, easy to test), with a thin Canvas2D renderer that interpolates between sim ticks for smooth animation. Game state advances at 20 ticks per second during execution phases; the main loop sits idle during planning phases waiting for both players to ready. Pets are data: each is a `PetDefinition` with a list of `(trigger, action, intervalSec)` tuples that the tick loop processes independently. Hot-seat 2-player: each planning phase, the active player is indicated and switched on submit.

**Tech Stack:** TypeScript (strict), Vite (dev server + bundler), Vitest (TDD), Canvas2D for rendering. No game frameworks; vanilla TS keeps the simulation pure.

**Spec reference:** [docs/superpowers/specs/2026-05-20-pet-painters-design.md](../specs/2026-05-20-pet-painters-design.md)

---

## Task 1: Project bootstrap

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main.ts`

- [ ] **Step 1: Initialize npm package**

Run:
```bash
npm init -y
```

Then edit `package.json` to set name and scripts:
```json
{
  "name": "pet-painters",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install --save-dev typescript vite vitest @types/node
```

- [ ] **Step 3: Create tsconfig.json (strict)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, open: true },
});
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 6: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Pet Painters</title>
  <style>
    body { margin: 0; background: #1a1a1a; color: #fff; font-family: system-ui, sans-serif; }
    #game { display: block; margin: 20px auto; background: #2a2a2a; }
    #ui { text-align: center; margin: 10px; }
  </style>
</head>
<body>
  <div id="ui">Pet Painters</div>
  <canvas id="game" width="600" height="600"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 7: Create src/main.ts (hello world)**

```typescript
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = '#888';
ctx.font = '24px sans-serif';
ctx.fillText('Pet Painters — placeholder', 100, 300);
```

- [ ] **Step 8: Verify dev server runs**

Run:
```bash
npm run dev
```
Expected: Vite starts on port 5173, opens a browser. Canvas shows the placeholder text. Stop with Ctrl+C.

- [ ] **Step 9: Verify Vitest runs (no tests yet, should report zero)**

Run:
```bash
npm test
```
Expected: Vitest runs successfully with "No test files found" or zero tests.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts index.html src/main.ts
git commit -m "task 1: project bootstrap (Vite + TS + Vitest)"
```

---

## Task 2: Configuration and core types

**Files:**
- Create: `src/config/balance.ts`
- Create: `src/config/constants.ts`
- Create: `src/types/game.ts`
- Create: `src/types/pet.ts`

This task creates no logic — just the data shapes and constants the rest of the code references.

- [ ] **Step 1: Create src/config/constants.ts (non-tunable structural constants)**

```typescript
export const TICK_RATE_HZ = 20;
export const TICKS_PER_SEC = TICK_RATE_HZ;
export const BOARD_SIZE = 12; // 12x12 grid
export const HOME_ROWS = 2;   // pre-painted bottom rows per player
```

- [ ] **Step 2: Create src/config/balance.ts (all tunable values, single source of truth)**

```typescript
// All numbers here are playtest-tunable. Spec deliberately keeps them rough.
import { BOARD_SIZE } from './constants';

export const STARTING_ENERGY = 3;
export const ENERGY_CAP = 10;
export const ENERGY_PER_EXEC_SECOND = 1;

export const EXECUTION_PHASE_SECONDS = 8;
export const PLANNING_TIMEOUT_EARLY_SECONDS = 15;
export const PLANNING_TIMEOUT_LATE_SECONDS = 8;

export const WIN_PAINT_THRESHOLD = Math.floor(BOARD_SIZE * BOARD_SIZE * 0.75); // 108

// Pet stats — keep in lockstep with src/sim/pet-defs.ts
export const MOUSE_STATS = {
  cost: 2,
  speedTilesPerSec: 2,
  weight: 1,
  maxHp: 2,
  atk: 1,
  atkSpeedPerSec: 1.0,
  order: 2,
};

export const ELEPHANT_STATS = {
  cost: 5,
  speedTilesPerSec: 0.5,
  weight: 10,
  maxHp: 8,
  atk: 2,
  atkSpeedPerSec: 0.5,
  order: 1,
};
```

- [ ] **Step 3: Create src/types/game.ts**

```typescript
export type PlayerId = 'A' | 'B';
export type Direction = 'N' | 'S' | 'E' | 'W';

export type TileColor = PlayerId | 'neutral';

export interface Board {
  size: number;            // BOARD_SIZE
  tiles: TileColor[];      // length size*size, row-major (y*size + x)
}

export interface Vec2 {
  x: number;
  y: number;
}

export type MatchPhase = 'planning' | 'execution' | 'ended';

export interface MatchState {
  board: Board;
  pets: import('./pet').Pet[];
  nextPetId: number;
  energy: { A: number; B: number };
  phase: MatchPhase;
  tick: number;            // monotonically increasing across execution phases
  execPhaseStartTick: number;
  activePlanningPlayer: PlayerId; // for hot-seat
  ready: { A: boolean; B: boolean };
  winner: PlayerId | null;
  pendingDeployments: PendingDeployment[];
}

export interface PendingDeployment {
  owner: PlayerId;
  defId: string;
  anchor: Vec2;
  facing: Direction;
}
```

- [ ] **Step 4: Create src/types/pet.ts**

```typescript
import type { Direction, PlayerId, Vec2, MatchState } from './game';

export interface PetTuple {
  intervalSec: number;
  trigger: (pet: Pet, state: MatchState) => boolean;
  action: (pet: Pet, state: MatchState) => void;
}

export interface PetDefinition {
  id: string;              // 'mouse' | 'elephant'
  displayName: string;
  emoji: string;
  cost: number;
  size: { w: number; h: number };
  weight: number;
  maxHp: number;
  atk: number;
  order: number;
  tuples: PetTuple[];
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
```

- [ ] **Step 5: Verify types compile (no tests yet, just typecheck)**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/config src/types
git commit -m "task 2: balance config + core types"
```

---

## Task 3: Board model and painting

**Files:**
- Create: `src/sim/board.ts`
- Create: `tests/sim/board.test.ts`

- [ ] **Step 1: Write failing tests for board**

`tests/sim/board.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createInitialBoard, getTile, paintTile, scoreFor } from '../../src/sim/board';
import { BOARD_SIZE, HOME_ROWS } from '../../src/config/constants';

describe('createInitialBoard', () => {
  it('creates a board with the configured size', () => {
    const b = createInitialBoard();
    expect(b.size).toBe(BOARD_SIZE);
    expect(b.tiles.length).toBe(BOARD_SIZE * BOARD_SIZE);
  });

  it('pre-paints the bottom HOME_ROWS rows for player A', () => {
    const b = createInitialBoard();
    for (let y = 0; y < HOME_ROWS; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        expect(getTile(b, { x, y })).toBe('A');
      }
    }
  });

  it('pre-paints the top HOME_ROWS rows for player B', () => {
    const b = createInitialBoard();
    for (let y = BOARD_SIZE - HOME_ROWS; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        expect(getTile(b, { x, y })).toBe('B');
      }
    }
  });

  it('leaves middle rows neutral', () => {
    const b = createInitialBoard();
    for (let y = HOME_ROWS; y < BOARD_SIZE - HOME_ROWS; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        expect(getTile(b, { x, y })).toBe('neutral');
      }
    }
  });
});

describe('paintTile', () => {
  it('overwrites tile color', () => {
    const b = createInitialBoard();
    paintTile(b, { x: 5, y: 5 }, 'A');
    expect(getTile(b, { x: 5, y: 5 })).toBe('A');
    paintTile(b, { x: 5, y: 5 }, 'B');
    expect(getTile(b, { x: 5, y: 5 })).toBe('B');
  });

  it('is a no-op for off-board coordinates', () => {
    const b = createInitialBoard();
    expect(() => paintTile(b, { x: -1, y: 5 }, 'A')).not.toThrow();
    expect(() => paintTile(b, { x: BOARD_SIZE, y: 5 }, 'A')).not.toThrow();
  });
});

describe('scoreFor', () => {
  it('counts tiles of a given color', () => {
    const b = createInitialBoard();
    // initial: 24 A tiles (2 rows * 12), 24 B tiles, 96 neutral
    expect(scoreFor(b, 'A')).toBe(BOARD_SIZE * HOME_ROWS);
    expect(scoreFor(b, 'B')).toBe(BOARD_SIZE * HOME_ROWS);
  });

  it('updates as tiles are painted', () => {
    const b = createInitialBoard();
    const start = scoreFor(b, 'A');
    paintTile(b, { x: 5, y: 5 }, 'A'); // was neutral
    expect(scoreFor(b, 'A')).toBe(start + 1);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run:
```bash
npm test
```
Expected: Tests fail with "Cannot find module './sim/board'".

- [ ] **Step 3: Implement src/sim/board.ts**

```typescript
import type { Board, TileColor, Vec2, PlayerId } from '../types/game';
import { BOARD_SIZE, HOME_ROWS } from '../config/constants';

function inBounds(board: Board, p: Vec2): boolean {
  return p.x >= 0 && p.x < board.size && p.y >= 0 && p.y < board.size;
}

export function createInitialBoard(): Board {
  const size = BOARD_SIZE;
  const tiles: TileColor[] = new Array(size * size).fill('neutral');
  for (let y = 0; y < HOME_ROWS; y++) {
    for (let x = 0; x < size; x++) tiles[y * size + x] = 'A';
  }
  for (let y = size - HOME_ROWS; y < size; y++) {
    for (let x = 0; x < size; x++) tiles[y * size + x] = 'B';
  }
  return { size, tiles };
}

export function getTile(board: Board, p: Vec2): TileColor {
  if (!inBounds(board, p)) return 'neutral';
  return board.tiles[p.y * board.size + p.x];
}

export function paintTile(board: Board, p: Vec2, color: TileColor): void {
  if (!inBounds(board, p)) return;
  board.tiles[p.y * board.size + p.x] = color;
}

export function scoreFor(board: Board, player: PlayerId): number {
  let n = 0;
  for (const t of board.tiles) if (t === player) n++;
  return n;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run:
```bash
npm test
```
Expected: 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/sim/board.ts tests/sim/board.test.ts
git commit -m "task 3: board model and painting"
```

---

## Task 4: Pet runtime helpers (footprint, front tiles)

**Files:**
- Create: `src/sim/pets.ts`
- Create: `tests/sim/pets.test.ts`

These are pure-function helpers that compute geometry from a Pet's anchor, size, and facing. The Pet's `defId` is looked up via `getPetDef` (introduced in Task 5).

- [ ] **Step 1: Write failing tests**

`tests/sim/pets.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { footprintTiles, frontTiles } from '../../src/sim/pets';

describe('footprintTiles', () => {
  it('returns single tile for 1x1', () => {
    const tiles = footprintTiles({ x: 5, y: 7 }, { w: 1, h: 1 });
    expect(tiles).toEqual([{ x: 5, y: 7 }]);
  });

  it('returns four tiles for 2x2 (anchor is top-left)', () => {
    const tiles = footprintTiles({ x: 3, y: 4 }, { w: 2, h: 2 });
    expect(tiles).toEqual([
      { x: 3, y: 4 }, { x: 4, y: 4 },
      { x: 3, y: 5 }, { x: 4, y: 5 },
    ]);
  });
});

describe('frontTiles', () => {
  it('1x1 facing N: one tile north of anchor', () => {
    expect(frontTiles({ x: 5, y: 5 }, { w: 1, h: 1 }, 'N')).toEqual([{ x: 5, y: 6 }]);
  });

  it('1x1 facing S: one tile south', () => {
    expect(frontTiles({ x: 5, y: 5 }, { w: 1, h: 1 }, 'S')).toEqual([{ x: 5, y: 4 }]);
  });

  it('1x1 facing E: one tile east', () => {
    expect(frontTiles({ x: 5, y: 5 }, { w: 1, h: 1 }, 'E')).toEqual([{ x: 6, y: 5 }]);
  });

  it('1x1 facing W: one tile west', () => {
    expect(frontTiles({ x: 5, y: 5 }, { w: 1, h: 1 }, 'W')).toEqual([{ x: 4, y: 5 }]);
  });

  it('2x2 facing N: two tiles north of front edge', () => {
    // anchor (3,4) → footprint occupies (3,4) (4,4) (3,5) (4,5). Front edge facing N is y=5; in front = y=6.
    expect(frontTiles({ x: 3, y: 4 }, { w: 2, h: 2 }, 'N')).toEqual([{ x: 3, y: 6 }, { x: 4, y: 6 }]);
  });

  it('2x2 facing E: two tiles east of front edge', () => {
    expect(frontTiles({ x: 3, y: 4 }, { w: 2, h: 2 }, 'E')).toEqual([{ x: 5, y: 4 }, { x: 5, y: 5 }]);
  });
});
```

Note: this codebase uses the convention that **y increases northward** (positive Y is up/north). The render layer will flip if needed.

- [ ] **Step 2: Run tests, verify they fail**

Run:
```bash
npm test
```
Expected: Tests fail with "Cannot find module './sim/pets'".

- [ ] **Step 3: Implement src/sim/pets.ts**

```typescript
import type { Direction, Vec2 } from '../types/game';

export interface Size { w: number; h: number; }

export function footprintTiles(anchor: Vec2, size: Size): Vec2[] {
  const out: Vec2[] = [];
  for (let dy = 0; dy < size.h; dy++) {
    for (let dx = 0; dx < size.w; dx++) {
      out.push({ x: anchor.x + dx, y: anchor.y + dy });
    }
  }
  return out;
}

export function frontTiles(anchor: Vec2, size: Size, facing: Direction): Vec2[] {
  // The "front edge" of a footprint depends on facing. We return the tiles immediately past that edge.
  const out: Vec2[] = [];
  switch (facing) {
    case 'N': {
      const y = anchor.y + size.h; // one tile beyond top of footprint
      for (let dx = 0; dx < size.w; dx++) out.push({ x: anchor.x + dx, y });
      break;
    }
    case 'S': {
      const y = anchor.y - 1;
      for (let dx = 0; dx < size.w; dx++) out.push({ x: anchor.x + dx, y });
      break;
    }
    case 'E': {
      const x = anchor.x + size.w;
      for (let dy = 0; dy < size.h; dy++) out.push({ x, y: anchor.y + dy });
      break;
    }
    case 'W': {
      const x = anchor.x - 1;
      for (let dy = 0; dy < size.h; dy++) out.push({ x, y: anchor.y + dy });
      break;
    }
  }
  return out;
}

export function advanceAnchor(anchor: Vec2, facing: Direction): Vec2 {
  switch (facing) {
    case 'N': return { x: anchor.x, y: anchor.y + 1 };
    case 'S': return { x: anchor.x, y: anchor.y - 1 };
    case 'E': return { x: anchor.x + 1, y: anchor.y };
    case 'W': return { x: anchor.x - 1, y: anchor.y };
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run:
```bash
npm test
```
Expected: All passing (board + pets tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/pets.ts tests/sim/pets.test.ts
git commit -m "task 4: pet runtime helpers (footprint, front tiles, advance)"
```

---

## Task 5: Pet definitions and deployment

**Files:**
- Create: `src/sim/pet-defs.ts`
- Create: `src/sim/deploy.ts`
- Create: `tests/sim/deploy.test.ts`

This wires `MOUSE` and `ELEPHANT` definitions (cost, size, stats) and implements deployment-zone validation. Tuple `trigger`/`action` functions are stubbed here and filled in by Tasks 6 and 7.

- [ ] **Step 1: Create src/sim/pet-defs.ts (stub tuples)**

```typescript
import type { PetDefinition } from '../types/pet';
import { MOUSE_STATS, ELEPHANT_STATS } from '../config/balance';

const stubTuple = {
  intervalSec: 1,
  trigger: () => false,
  action: () => {},
};

export const MOUSE: PetDefinition = {
  id: 'mouse',
  displayName: 'Mouse',
  emoji: '🐭',
  cost: MOUSE_STATS.cost,
  size: { w: 1, h: 1 },
  weight: MOUSE_STATS.weight,
  maxHp: MOUSE_STATS.maxHp,
  atk: MOUSE_STATS.atk,
  order: MOUSE_STATS.order,
  tuples: [
    { ...stubTuple, intervalSec: 1 / MOUSE_STATS.speedTilesPerSec },     // move
    { ...stubTuple, intervalSec: 1 / MOUSE_STATS.atkSpeedPerSec },        // attack
  ],
};

export const ELEPHANT: PetDefinition = {
  id: 'elephant',
  displayName: 'Elephant',
  emoji: '🐘',
  cost: ELEPHANT_STATS.cost,
  size: { w: 2, h: 2 },
  weight: ELEPHANT_STATS.weight,
  maxHp: ELEPHANT_STATS.maxHp,
  atk: ELEPHANT_STATS.atk,
  order: ELEPHANT_STATS.order,
  tuples: [
    { ...stubTuple, intervalSec: 1 / ELEPHANT_STATS.speedTilesPerSec },
    { ...stubTuple, intervalSec: 1 / ELEPHANT_STATS.atkSpeedPerSec },
  ],
};

const REGISTRY: Record<string, PetDefinition> = {
  [MOUSE.id]: MOUSE,
  [ELEPHANT.id]: ELEPHANT,
};

export function getPetDef(id: string): PetDefinition {
  const def = REGISTRY[id];
  if (!def) throw new Error(`Unknown pet def: ${id}`);
  return def;
}

export const TUPLE_INDEX_MOVE = 0;
export const TUPLE_INDEX_ATTACK = 1;
```

- [ ] **Step 2: Write failing tests for deployment**

`tests/sim/deploy.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { MOUSE, ELEPHANT } from '../../src/sim/pet-defs';
import { BOARD_SIZE, HOME_ROWS } from '../../src/config/constants';
import type { MatchState } from '../../src/types/game';

describe('tryDeploy', () => {
  let state: MatchState;
  beforeEach(() => { state = createInitialMatch(); });

  it('player A can deploy a 1x1 mouse on row 0', () => {
    const r = tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pet.owner).toBe('A');
      expect(r.pet.anchor).toEqual({ x: 3, y: 0 });
      expect(r.pet.hp).toBe(MOUSE.maxHp);
    }
  });

  it('player A can deploy a 2x2 elephant with anchor on row 0', () => {
    // anchor (3,0) → occupies (3,0) (4,0) (3,1) (4,1). All within HOME_ROWS=2.
    const r = tryDeploy(state, 'A', ELEPHANT.id, { x: 3, y: 0 }, 'N');
    expect(r.ok).toBe(true);
  });

  it('player A cannot deploy if footprint exits the home zone', () => {
    // anchor (3,1) → 2x2 would occupy (3,1) (4,1) (3,2) (4,2). y=2 is outside HOME_ROWS.
    const r = tryDeploy(state, 'A', ELEPHANT.id, { x: 3, y: 1 }, 'N');
    expect(r.ok).toBe(false);
  });

  it('player B home zone is the top rows', () => {
    const topRow = BOARD_SIZE - 1;
    const r = tryDeploy(state, 'B', MOUSE.id, { x: 5, y: topRow }, 'S');
    expect(r.ok).toBe(true);
  });

  it('B cannot deploy in A home zone', () => {
    const r = tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 0 }, 'N');
    expect(r.ok).toBe(false);
  });

  it('cannot deploy where energy is insufficient', () => {
    state.energy.A = 0;
    const r = tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(r.ok).toBe(false);
  });

  it('cannot deploy on a tile already occupied by another pet', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    state.energy.A = 5; // refill
    const r = tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(r.ok).toBe(false);
  });

  it('debits energy on successful deploy', () => {
    const before = state.energy.A;
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    expect(state.energy.A).toBe(before - MOUSE.cost);
  });
});
```

- [ ] **Step 3: Create stub src/sim/match.ts so the test compiles**

```typescript
import type { MatchState } from '../types/game';
import { createInitialBoard } from './board';
import { STARTING_ENERGY } from '../config/balance';

export function createInitialMatch(): MatchState {
  return {
    board: createInitialBoard(),
    pets: [],
    nextPetId: 1,
    energy: { A: STARTING_ENERGY, B: STARTING_ENERGY },
    phase: 'planning',
    tick: 0,
    execPhaseStartTick: 0,
    activePlanningPlayer: 'A',
    ready: { A: false, B: false },
    winner: null,
    pendingDeployments: [],
  };
}
```

(This stub will be extended in Task 9 for full match flow; for now it just gives `tryDeploy` something to operate on.)

- [ ] **Step 4: Implement src/sim/deploy.ts**

```typescript
import type { MatchState, PlayerId, Vec2, Direction } from '../types/game';
import type { Pet } from '../types/pet';
import { getPetDef } from './pet-defs';
import { footprintTiles } from './pets';
import { BOARD_SIZE, HOME_ROWS } from '../config/constants';

export type DeployResult =
  | { ok: true; pet: Pet }
  | { ok: false; reason: string };

function homeZoneContains(owner: PlayerId, p: Vec2): boolean {
  if (p.x < 0 || p.x >= BOARD_SIZE) return false;
  if (owner === 'A') return p.y >= 0 && p.y < HOME_ROWS;
  return p.y >= BOARD_SIZE - HOME_ROWS && p.y < BOARD_SIZE;
}

export function tryDeploy(
  state: MatchState,
  owner: PlayerId,
  defId: string,
  anchor: Vec2,
  facing: Direction,
): DeployResult {
  const def = getPetDef(defId);

  if (state.energy[owner] < def.cost) {
    return { ok: false, reason: 'insufficient energy' };
  }

  const tiles = footprintTiles(anchor, def.size);
  for (const t of tiles) {
    if (!homeZoneContains(owner, t)) return { ok: false, reason: 'out of home zone' };
  }

  // Check tile occupancy
  const occupied = new Set<string>();
  for (const p of state.pets) {
    const pdef = getPetDef(p.defId);
    for (const ft of footprintTiles(p.anchor, pdef.size)) occupied.add(`${ft.x},${ft.y}`);
  }
  for (const t of tiles) {
    if (occupied.has(`${t.x},${t.y}`)) return { ok: false, reason: 'tile occupied' };
  }

  const pet: Pet = {
    petId: state.nextPetId++,
    defId,
    owner,
    anchor,
    facing,
    hp: def.maxHp,
    deployTick: state.tick,
    tupleLastFireTick: def.tuples.map(() => -1),
  };

  state.energy[owner] -= def.cost;
  state.pets.push(pet);
  return { ok: true, pet };
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run:
```bash
npm test
```
Expected: All passing (board, pets, deploy).

- [ ] **Step 6: Commit**

```bash
git add src/sim/pet-defs.ts src/sim/deploy.ts src/sim/match.ts tests/sim/deploy.test.ts
git commit -m "task 5: pet definitions, deployment, zone + energy + occupancy checks"
```

---

## Task 6: Tick loop and tuple processing

**Files:**
- Create: `src/sim/tick.ts`
- Create: `tests/sim/tick.test.ts`

The tick processes all pets' tuples. For now, tuples are still stubs (returning false trigger), so the tick is a no-op functionally — but we test that timer accounting works correctly. Movement and attack tuples come in Tasks 7 and 8.

- [ ] **Step 1: Write failing tests**

`tests/sim/tick.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { advanceTick } from '../../src/sim/tick';
import { MOUSE } from '../../src/sim/pet-defs';
import { TICKS_PER_SEC } from '../../src/config/constants';
import type { MatchState } from '../../src/types/game';

function runTicks(state: MatchState, n: number) {
  for (let i = 0; i < n; i++) advanceTick(state);
}

describe('advanceTick', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
  });

  it('increments tick by 1', () => {
    const t = state.tick;
    advanceTick(state);
    expect(state.tick).toBe(t + 1);
  });

  it('does not advance when phase is not execution', () => {
    state.phase = 'planning';
    advanceTick(state);
    expect(state.tick).toBe(0);
  });

  it('fires a pet tuple exactly once per interval', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    const pet = state.pets[0];
    // Mouse move tuple interval = 0.5s = 10 ticks at 20Hz
    // After 9 ticks: shouldn't have fired yet (relative to deployTick=0)
    runTicks(state, 9);
    expect(pet.tupleLastFireTick[0]).toBe(-1);
    // After 10 ticks (the 10th call): should fire
    advanceTick(state);
    expect(pet.tupleLastFireTick[0]).toBe(10);
    // After 20 ticks total: should have fired again
    runTicks(state, 10);
    expect(pet.tupleLastFireTick[0]).toBe(20);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run:
```bash
npm test
```
Expected: Fails with "Cannot find module './sim/tick'".

- [ ] **Step 3: Implement src/sim/tick.ts**

```typescript
import type { MatchState } from '../types/game';
import { getPetDef } from './pet-defs';
import { TICKS_PER_SEC } from '../config/constants';

export function advanceTick(state: MatchState): void {
  if (state.phase !== 'execution') return;
  state.tick += 1;

  for (const pet of state.pets) {
    if (pet.hp <= 0) continue; // pet died earlier this tick — skip remaining tuples
    const def = getPetDef(pet.defId);
    for (let i = 0; i < def.tuples.length; i++) {
      if (pet.hp <= 0) break; // pet died mid-tuple-loop (e.g., thorns-like effect)
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

  // Death cleanup (also runs after movement, defined later)
  state.pets = state.pets.filter((p) => p.hp > 0);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run:
```bash
npm test
```
Expected: All passing.

- [ ] **Step 5: Commit**

```bash
git add src/sim/tick.ts tests/sim/tick.test.ts
git commit -m "task 6: tick loop with per-tuple timer accounting"
```

---

## Task 7: Movement tuple — trigger + action with weight-based entry conflicts and push-through

**Files:**
- Modify: `src/sim/pet-defs.ts` (replace stub move tuple)
- Create: `src/sim/movement.ts`
- Create: `tests/sim/movement.test.ts`

Per spec § 6 and § 8:

- A pet's move tuple fires every `1/speed` seconds.
- The move trigger fires whenever the front tile(s) are on the board (occupancy is *not* part of the trigger — the resolver decides).
- The move action records a *move intent*. Actual movement happens in `resolveMovements`, called after all tuples fire and after combat damage has been applied and dead pets removed.
- **Same-empty-tile conflict** (two pets want the same empty tile): higher `weight` wins; tie = random; loser doesn't move.
- **Occupied front tile**: the move may still succeed via **push**. Heavy pet `H` can push a chain of lighter pets in its path if `2 × sum(chain.weight) < H.weight` AND there is an empty tile beyond the chain. The chain stops at the first pet whose own weight `≥ H.weight / 2`, at the board edge, or at the first empty tile (good case).
- Pushed pets shift one tile in `H`'s facing direction. They keep their own facing.

The pure-functional approach: the trigger is liberal, the resolver is smart. This centralizes all conflict and push logic in one function.

- [ ] **Step 1: Extend MatchState type with `moveIntents`**

Modify `src/types/game.ts`:
```typescript
// Add to MatchState interface:
//   moveIntents: MoveIntent[];

export interface MoveIntent {
  petId: number;
  from: Vec2;
  to: Vec2;
}
```

Then update `createInitialMatch` in `src/sim/match.ts` to include `moveIntents: []`.

- [ ] **Step 2: Write failing tests**

`tests/sim/movement.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { advanceTick } from '../../src/sim/tick';
import { MOUSE, ELEPHANT } from '../../src/sim/pet-defs';
import { TICKS_PER_SEC } from '../../src/config/constants';
import { getTile } from '../../src/sim/board';
import type { MatchState } from '../../src/types/game';

function runTicks(state: MatchState, n: number) {
  for (let i = 0; i < n; i++) advanceTick(state);
}

describe('mouse movement', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
  });

  it('advances 1 tile after move interval', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    runTicks(state, 10); // 0.5s = 10 ticks
    expect(state.pets[0].anchor).toEqual({ x: 3, y: 1 });
  });

  it('paints the tile it enters', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 1 }, 'N');
    // (3,1) is A home → already A. (3,2) is neutral.
    runTicks(state, 10);
    expect(getTile(state.board, { x: 3, y: 2 })).toBe('A');
  });

  it('stops at board edge', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    // Mouse will march from y=0 northward, eventually hits edge at y=11. Run plenty of ticks.
    runTicks(state, TICKS_PER_SEC * 10);
    expect(state.pets[0].anchor.y).toBe(11);
  });

  it('stops when blocked by an allied pet in front', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 0 }, 'N');
    tryDeploy(state, 'A', MOUSE.id, { x: 3, y: 1 }, 'N');
    runTicks(state, 10);
    // Pet 1 at (3,0) should be blocked by pet 2 at (3,1)
    expect(state.pets[0].anchor).toEqual({ x: 3, y: 0 });
    expect(state.pets[1].anchor).toEqual({ x: 3, y: 2 });
  });
});

describe('entry conflicts', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
  });

  it('two mice racing to the same empty tile: equal weight → exactly one wins (random)', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 5, y: 1 }, 'N'); // target (5,2)
    state.energy.B = 10;
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 3 }, 'S'); // target (5,2)
    runTicks(state, 10);
    const occupants = state.pets.filter(p => p.anchor.x === 5 && p.anchor.y === 2);
    expect(occupants.length).toBe(1); // exactly one entered; the other stayed
  });
});

describe('push-through movement', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
    state.energy = { A: 50, B: 50 };
  });

  it('Elephant pushes a single Mouse forward', () => {
    // Place Elephant at (5,5) facing N, Mouse at (5,7) (one tile north of elephant's front (5,7)).
    tryDeploy(state, 'A', ELEPHANT.id, { x: 5, y: 0 }, 'N');
    state.pets[0].anchor = { x: 5, y: 5 }; // occupies (5,5)(6,5)(5,6)(6,6); fronts (5,7)(6,7)
    tryDeploy(state, 'A', MOUSE.id, { x: 5, y: 1 }, 'N');
    state.pets[1].anchor = { x: 5, y: 7 };
    // Elephant move interval = 2s = 40 ticks. Trigger fires every 40 ticks.
    // Mouse move interval = 0.5s = 10 ticks.
    // After enough ticks for Elephant to make one move (40 ticks), Mouse has moved on its own,
    // so set Mouse facing W to keep it stationary against the (off-row) edge:
    state.pets[1].facing = 'W';
    state.pets[1].anchor = { x: 0, y: 7 }; // Mouse pinned at west edge
    // Reset: put Elephant directly behind Mouse in the same row
    state.pets[0].anchor = { x: 1, y: 6 }; // Elephant footprint (1,6)(2,6)(1,7)(2,7); facing N → fronts (1,8)(2,8)
    state.pets[0].facing = 'N';
    state.pets[1].anchor = { x: 1, y: 8 }; // Mouse in front of Elephant's left front tile
    // Now run 40 ticks → Elephant attempts move N. Front contains Mouse → push attempt.
    // Mouse weight 1, 2*1=2 < 10 → push succeeds. Mouse moves to (1,9). Elephant moves to anchor (1,7).
    runTicks(state, 40);
    expect(state.pets[1].anchor).toEqual({ x: 1, y: 9 });
    expect(state.pets[0].anchor).toEqual({ x: 1, y: 7 });
  });

  it('Elephant pushes a chain of 4 Mice (sum 4 < 5)', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 1, y: 0 }, 'N');
    state.pets[0].anchor = { x: 1, y: 4 }; // footprint (1,4)(2,4)(1,5)(2,5); fronts (1,6)(2,6)
    // Place 4 Mice in column x=1, rows y=6,7,8,9 — but only the column-1 ones are in the chain
    for (let i = 0; i < 4; i++) {
      tryDeploy(state, 'A', MOUSE.id, { x: 1, y: 1 }, 'N');
      state.pets[1 + i].anchor = { x: 1, y: 6 + i };
      state.pets[1 + i].facing = 'W'; // pin them so they don't drift
    }
    // Also column x=2 row 6 occupant so elephant's 2nd front tile isn't empty (otherwise push doesn't apply there).
    // For simplicity, make sure (2,6) is empty — push only on x=1 chain. But elephant's front includes (2,6).
    // To avoid that complication, use only Mice in the x=1 column and an empty x=2 col → no push needed for x=2.
    // Push rule for 2x2: BOTH perpendicular tiles in the new footprint must be valid.
    //   Elephant moving N from (1,4): new footprint (1,5)(2,5)(1,6)(2,6). (1,6) needs to be cleared by push;
    //   (2,6) must be empty already. We set up: x=1 column has Mice; x=2 column empty. ✓
    runTicks(state, 40);
    // Each x=1 Mouse should have shifted north by 1 → at y=7,8,9,10
    for (let i = 0; i < 4; i++) {
      expect(state.pets[1 + i].anchor).toEqual({ x: 1, y: 7 + i });
    }
    // Elephant anchor should be (1,5)
    expect(state.pets[0].anchor).toEqual({ x: 1, y: 5 });
  });

  it('Elephant blocked by 5 Mice (sum 5, NOT strictly less than 5)', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 1, y: 0 }, 'N');
    state.pets[0].anchor = { x: 1, y: 4 };
    for (let i = 0; i < 5; i++) {
      tryDeploy(state, 'A', MOUSE.id, { x: 1, y: 1 }, 'N');
      state.pets[1 + i].anchor = { x: 1, y: 6 + i };
      state.pets[1 + i].facing = 'W';
    }
    runTicks(state, 40);
    expect(state.pets[0].anchor).toEqual({ x: 1, y: 4 }); // didn't move
  });

  it('Elephant blocked when chain hits board edge with no empty tile', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 1, y: 0 }, 'N');
    state.pets[0].anchor = { x: 1, y: 9 }; // footprint (1,9)(2,9)(1,10)(2,10); fronts (1,11)(2,11)
    // Single Mouse at (1,11) — north edge, no empty tile beyond.
    tryDeploy(state, 'A', MOUSE.id, { x: 1, y: 1 }, 'N');
    state.pets[1].anchor = { x: 1, y: 11 };
    state.pets[1].facing = 'W';
    runTicks(state, 40);
    expect(state.pets[0].anchor).toEqual({ x: 1, y: 9 }); // push fails — Mouse has nowhere to go
  });

  it('Mouse cannot push an Elephant (weight 1 vs 10)', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 5, y: 1 }, 'N');
    state.pets[0].anchor = { x: 5, y: 5 };
    tryDeploy(state, 'B', ELEPHANT.id, { x: 5, y: 11 }, 'S');
    state.pets[1].anchor = { x: 5, y: 6 }; // Elephant footprint (5,6)(6,6)(5,7)(6,7); Mouse facing N → front (5,6) = Elephant.
    state.pets[1].facing = 'W'; // pin so it doesn't march
    runTicks(state, 10);
    expect(state.pets[0].anchor).toEqual({ x: 5, y: 5 }); // Mouse stays put
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run:
```bash
npm test
```
Expected: Tests fail with movement-related errors.

- [ ] **Step 4: Implement movement tuple in src/sim/pet-defs.ts**

Replace the stub move tuple. Add at the top of `src/sim/pet-defs.ts`:
```typescript
import { frontTiles } from './pets';
import type { Pet } from '../types/pet';
import type { MatchState } from '../types/game';

function frontTilesOnBoard(pet: Pet, state: MatchState): boolean {
  const def = getPetDef(pet.defId);
  const fronts = frontTiles(pet.anchor, def.size, pet.facing);
  for (const t of fronts) {
    if (t.x < 0 || t.x >= state.board.size || t.y < 0 || t.y >= state.board.size) return false;
  }
  return true;
}

function declareMove(pet: Pet, state: MatchState): void {
  // Always record intent if trigger fired. resolveMovements decides whether the move actually happens
  // (it may be blocked by occupancy + insufficient weight for push, or by entry-conflicts with other movers).
  let to = { x: pet.anchor.x, y: pet.anchor.y };
  switch (pet.facing) {
    case 'N': to.y += 1; break;
    case 'S': to.y -= 1; break;
    case 'E': to.x += 1; break;
    case 'W': to.x -= 1; break;
  }
  state.moveIntents.push({ petId: pet.petId, from: pet.anchor, to });
}
```

Replace the move tuple in the MOUSE and ELEPHANT definitions:
```typescript
// In MOUSE.tuples[0]:
{
  intervalSec: 1 / MOUSE_STATS.speedTilesPerSec,
  trigger: frontTilesOnBoard,
  action: declareMove,
}
// Same for ELEPHANT.tuples[0]:
{
  intervalSec: 1 / ELEPHANT_STATS.speedTilesPerSec,
  trigger: frontTilesOnBoard,
  action: declareMove,
}
```

- [ ] **Step 5: Implement src/sim/movement.ts (intent resolver with weight tiebreak + push)**

```typescript
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

/**
 * Compute the chain of pets that would need to be pushed if `pusher` advances one tile in its facing
 * direction. Returns:
 *   - { kind: 'clear' } if the front is already empty
 *   - { kind: 'pushable', chain } if push is geometrically and weight-wise viable
 *   - { kind: 'blocked' } otherwise
 *
 * The chain stops at the first pet whose own weight ≥ pusher.weight / 2 (an "immovable anchor"),
 * at the board edge with no empty tile (push fails), or at the first empty tile (good).
 *
 * For 2×2 pushers, all perpendicular tiles in the new footprint must be valid (either part of the
 * push chain or empty).
 */
function evaluatePush(
  pusher: Pet,
  state: MatchState,
): { kind: 'clear' } | { kind: 'pushable'; chain: Pet[] } | { kind: 'blocked' } {
  const def = getPetDef(pusher.defId);
  const d = delta(pusher.facing);
  const pusherWeight = def.weight;

  // Compute the set of "lead" tiles — the tiles just in front of pusher's front edge.
  const newFront: Vec2[] = [];
  if (pusher.facing === 'N' || pusher.facing === 'S') {
    const newRow = pusher.facing === 'N' ? pusher.anchor.y + def.size.h : pusher.anchor.y - 1;
    for (let dx = 0; dx < def.size.w; dx++) newFront.push({ x: pusher.anchor.x + dx, y: newRow });
  } else {
    const newCol = pusher.facing === 'E' ? pusher.anchor.x + def.size.w : pusher.anchor.x - 1;
    for (let dy = 0; dy < def.size.h; dy++) newFront.push({ x: newCol, y: pusher.anchor.y + dy });
  }
  for (const t of newFront) if (!inBounds(state, t)) return { kind: 'blocked' };

  // Find unique pets occupying any newFront tile.
  const directBlockers = new Set<Pet>();
  for (const t of newFront) {
    const p = petAt(state, t);
    if (p && p !== pusher) directBlockers.add(p);
  }

  if (directBlockers.size === 0) return { kind: 'clear' };

  // Walk the chain. Starting from each direct blocker, advance in the push direction collecting pets.
  // To keep it simple in v1.1: only support pushing 1×1 pets in a single column/row. If any direct
  // blocker is larger than 1×1 we treat as blocked (defer multi-size push to a later version).
  for (const b of directBlockers) {
    const bdef = getPetDef(b.defId);
    if (bdef.size.w !== 1 || bdef.size.h !== 1) return { kind: 'blocked' };
    if (bdef.weight * 2 >= pusherWeight) return { kind: 'blocked' }; // immovable individually
  }

  // Build per-blocker chains (one chain per newFront tile's column/row).
  const chain: Pet[] = [];
  for (const start of newFront) {
    let cursor: Vec2 = { x: start.x, y: start.y };
    // The first cell IS a blocker; if not, skip
    let first = petAt(state, cursor);
    if (!first || first === pusher) continue;
    chain.push(first);
    // Walk forward
    while (true) {
      const next: Vec2 = { x: cursor.x + d.x, y: cursor.y + d.y };
      if (!inBounds(state, next)) return { kind: 'blocked' }; // chain hits edge, nowhere to push to
      const np = petAt(state, next);
      if (!np) break; // empty tile found — chain ends, push viable for this lane
      const ndef = getPetDef(np.defId);
      if (ndef.size.w !== 1 || ndef.size.h !== 1) return { kind: 'blocked' };
      if (ndef.weight * 2 >= pusherWeight) return { kind: 'blocked' };
      chain.push(np);
      cursor = next;
    }
  }

  // Weight check on the full chain
  const sum = chain.reduce((s, p) => s + getPetDef(p.defId).weight, 0);
  if (2 * sum >= pusherWeight) return { kind: 'blocked' };

  return { kind: 'pushable', chain };
}

export function resolveMovements(state: MatchState): void {
  // 1. Skip intents from pets that died this tick (already removed from state.pets).
  const aliveIntents = state.moveIntents.filter((i) => state.pets.some((p) => p.petId === i.petId));

  // 2. Group intents by destination anchor for empty-tile conflict resolution.
  //    (Pets going into occupied tiles will be handled in the push phase; same-empty-tile conflict
  //    is decided by weight here.)
  const byDest = new Map<string, { pet: Pet; intentIdx: number }[]>();
  aliveIntents.forEach((intent, i) => {
    const pet = state.pets.find((p) => p.petId === intent.petId)!;
    const key = tileKey(intent.to);
    if (!byDest.has(key)) byDest.set(key, []);
    byDest.get(key)!.push({ pet, intentIdx: i });
  });

  const blocked = new Set<number>();
  for (const group of byDest.values()) {
    if (group.length === 1) continue;
    // Only "same empty tile" conflicts get resolved here. If the destination is already occupied,
    // each pet's push attempt is independent (one might succeed, others fail).
    const destOccupied = petAt(state, aliveIntents[group[0].intentIdx].to) !== null;
    if (destOccupied) continue;
    // Higher weight wins. Tie = random.
    group.sort((a, b) => {
      const aw = getPetDef(a.pet.defId).weight;
      const bw = getPetDef(b.pet.defId).weight;
      if (bw !== aw) return bw - aw;
      return Math.random() - 0.5;
    });
    for (let i = 1; i < group.length; i++) blocked.add(group[i].pet.petId);
  }

  // 3. Process intents in deterministic order (by pet weight desc, then petId asc).
  //    Higher-weight pets push first, so chained pushes resolve correctly when multiple heavies move.
  const ordered = aliveIntents
    .filter((i) => !blocked.has(i.petId))
    .map((i) => ({ intent: i, pet: state.pets.find((p) => p.petId === i.petId)! }))
    .sort((a, b) => {
      const aw = getPetDef(a.pet.defId).weight;
      const bw = getPetDef(b.pet.defId).weight;
      if (bw !== aw) return bw - aw;
      return a.pet.petId - b.pet.petId;
    });

  for (const { intent, pet } of ordered) {
    const result = evaluatePush(pet, state);
    if (result.kind === 'blocked') continue;

    const def = getPetDef(pet.defId);
    const oldFootprint = footprintTiles(pet.anchor, def.size);

    if (result.kind === 'pushable') {
      // Shift each chain pet by one tile in pusher's facing.
      const d = delta(pet.facing);
      for (const c of result.chain) {
        c.anchor = { x: c.anchor.x + d.x, y: c.anchor.y + d.y };
      }
    }

    // Now advance the pusher.
    pet.anchor = intent.to;
    const newFootprint = footprintTiles(pet.anchor, def.size);
    const oldKeys = new Set(oldFootprint.map(tileKey));
    for (const t of newFootprint) {
      if (!oldKeys.has(tileKey(t))) {
        paintTile(state.board, t, pet.owner);
      }
    }
  }

  state.moveIntents = [];
}
```

**v1.1 simplifications captured in this code:**
- Multi-size push (e.g., Elephant pushing another Elephant or a future 2×2 pet) is treated as blocked. v1.2+ can extend `evaluatePush` to handle non-1×1 chain members.
- Push priority is by pet weight (heaviest pushes first). This avoids race conditions when two heavies move toward each other on the same tick.
- A pet that died earlier this tick (combat) is already absent from `state.pets` because death cleanup runs in `advanceTick` before `resolveMovements`. So the chain naturally shortens around freshly-dead pets.

- [ ] **Step 6: Wire `resolveMovements` into the tick**

Modify `src/sim/tick.ts`. The new order of operations within a tick is:

1. Process all pets' tuples (combat damage applied immediately).
2. **Death cleanup** — remove pets at hp ≤ 0.
3. **`resolveMovements`** — uses post-cleanup state so dead pets don't appear in push chains.

```typescript
import { resolveMovements } from './movement';
// ...
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
        if (tuple.trigger(pet, state)) tuple.action(pet, state);
        pet.tupleLastFireTick[i] = state.tick;
      }
    }
  }

  // Death cleanup BEFORE movement resolution (so push chains see a clean board)
  state.pets = state.pets.filter((p) => p.hp > 0);

  resolveMovements(state);
}
```

- [ ] **Step 7: Run tests, verify they pass**

Run:
```bash
npm test
```
Expected: All passing.

- [ ] **Step 8: Commit**

```bash
git add src/sim/pet-defs.ts src/sim/movement.ts src/sim/tick.ts src/sim/match.ts src/types/game.ts tests/sim/movement.test.ts
git commit -m "task 7: movement tuple with entry-conflict resolution and painting"
```

---

## Task 8: Attack tuple — damage in front of facing edge

**Files:**
- Modify: `src/sim/pet-defs.ts` (replace stub attack tuple)
- Create: `src/sim/combat.ts`
- Create: `tests/sim/combat.test.ts`

The attack tuple's `trigger` returns true if any enemy occupies the front tiles. The `action` deals `atk` damage to each distinct enemy pet whose footprint touches any of those tiles. Damage is applied directly (no intent system needed — combat is independent of movement and resolves immediately within the tuple).

- [ ] **Step 1: Write failing tests**

`tests/sim/combat.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialMatch } from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { advanceTick } from '../../src/sim/tick';
import { MOUSE, ELEPHANT } from '../../src/sim/pet-defs';
import { TICKS_PER_SEC } from '../../src/config/constants';
import type { MatchState } from '../../src/types/game';

function runTicks(state: MatchState, n: number) {
  for (let i = 0; i < n; i++) advanceTick(state);
}

describe('combat', () => {
  let state: MatchState;
  beforeEach(() => {
    state = createInitialMatch();
    state.phase = 'execution';
    state.energy = { A: 20, B: 20 };
  });

  it('mouse attacks an enemy in front, dealing 1 damage at 1s intervals', () => {
    tryDeploy(state, 'A', MOUSE.id, { x: 5, y: 1 }, 'N');
    // Manually place a B mouse directly in front by deploying & then mutating (skip zone check by using deploy in B home and then moving)
    // Simpler: deploy a B mouse at (5,11) facing S which will end up moving toward but for this test we mutate directly:
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 10 }, 'S');
    state.pets[1].anchor = { x: 5, y: 2 };

    const before = state.pets[1].hp;
    runTicks(state, TICKS_PER_SEC); // 1 second = 1 attack interval for mouse
    expect(state.pets[1].hp).toBe(before - MOUSE.atk);
  });

  it('flank attack: defender takes damage but does not retaliate', () => {
    // Pin A at the east edge facing E (front is off-board → cannot move and cannot attack).
    // B sits one tile west of A facing E (B's front contains A → B attacks; A's front off-board → no retaliation).
    tryDeploy(state, 'A', MOUSE.id, { x: 5, y: 1 }, 'E');
    state.pets[0].anchor = { x: 11, y: 5 };
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 10 }, 'E');
    state.pets[1].anchor = { x: 10, y: 5 };

    const aHpBefore = state.pets[0].hp;
    const bHpBefore = state.pets[1].hp;
    runTicks(state, TICKS_PER_SEC); // 1s
    expect(state.pets[0].hp).toBeLessThan(aHpBefore); // A took damage from B
    expect(state.pets[1].hp).toBe(bHpBefore);         // A's front is off-board → no retaliation
  });

  it('elephant facing two mice in front hits both per attack', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 5, y: 0 }, 'N');
    state.pets[0].anchor = { x: 5, y: 5 }; // 2x2 elephant occupies (5,5) (6,5) (5,6) (6,6); fronts: (5,7) (6,7)
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 10 }, 'S');
    state.pets[1].anchor = { x: 5, y: 7 };
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 11 }, 'S');
    state.pets[2].anchor = { x: 6, y: 7 };

    runTicks(state, TICKS_PER_SEC * 2); // 2s = 1 elephant attack interval
    // Elephant atk=2, mouse hp=2 → both should die in one hit
    expect(state.pets.find((p) => p.petId === 2)).toBeUndefined();
    expect(state.pets.find((p) => p.petId === 3)).toBeUndefined();
  });

  it('pet dies and is removed at hp 0', () => {
    tryDeploy(state, 'A', ELEPHANT.id, { x: 5, y: 0 }, 'N');
    state.pets[0].anchor = { x: 5, y: 5 };
    tryDeploy(state, 'B', MOUSE.id, { x: 5, y: 11 }, 'S');
    state.pets[1].anchor = { x: 5, y: 7 };

    runTicks(state, TICKS_PER_SEC * 2);
    expect(state.pets.find((p) => p.defId === MOUSE.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run:
```bash
npm test
```
Expected: Combat tests fail (no attack tuple yet).

- [ ] **Step 3: Add combat helpers to src/sim/combat.ts**

```typescript
import type { MatchState } from '../types/game';
import type { Pet } from '../types/pet';
import { getPetDef } from './pet-defs';
import { frontTiles, footprintTiles } from './pets';

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
  }
}
```

- [ ] **Step 4: Wire attack tuple into src/sim/pet-defs.ts**

In `src/sim/pet-defs.ts`, import and use:
```typescript
import { enemiesInFront, applyAttack } from './combat';
```

Replace the attack tuple in MOUSE and ELEPHANT:
```typescript
// MOUSE.tuples[1]:
{
  intervalSec: 1 / MOUSE_STATS.atkSpeedPerSec,
  trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
  action: applyAttack,
}
// ELEPHANT.tuples[1]:
{
  intervalSec: 1 / ELEPHANT_STATS.atkSpeedPerSec,
  trigger: (pet, state) => enemiesInFront(pet, state).length > 0,
  action: applyAttack,
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run:
```bash
npm test
```
Expected: All passing.

- [ ] **Step 6: Commit**

```bash
git add src/sim/combat.ts src/sim/pet-defs.ts tests/sim/combat.test.ts
git commit -m "task 8: attack tuple with front-only damage and 2x2 dual-target hits"
```

---

## Task 9: Match state, phase transitions, energy, win condition

**Files:**
- Modify: `src/sim/match.ts`
- Create: `tests/sim/match.test.ts`

Add the match-level functions: `submitReady`, `enterExecution`, `tickMatch` (drives sim + checks win), `endExecution`.

- [ ] **Step 1: Write failing tests**

`tests/sim/match.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialMatch,
  submitReady,
  tickMatch,
  endExecution,
} from '../../src/sim/match';
import { tryDeploy } from '../../src/sim/deploy';
import { MOUSE } from '../../src/sim/pet-defs';
import {
  STARTING_ENERGY,
  ENERGY_CAP,
  ENERGY_PER_EXEC_SECOND,
  EXECUTION_PHASE_SECONDS,
  WIN_PAINT_THRESHOLD,
} from '../../src/config/balance';
import { TICKS_PER_SEC, BOARD_SIZE } from '../../src/config/constants';

describe('match flow', () => {
  it('starts in planning phase with starting energy', () => {
    const s = createInitialMatch();
    expect(s.phase).toBe('planning');
    expect(s.energy.A).toBe(STARTING_ENERGY);
    expect(s.energy.B).toBe(STARTING_ENERGY);
  });

  it('both submitting ready transitions to execution', () => {
    const s = createInitialMatch();
    submitReady(s, 'A');
    expect(s.phase).toBe('planning');
    submitReady(s, 'B');
    expect(s.phase).toBe('execution');
    expect(s.ready.A).toBe(false); // reset
    expect(s.ready.B).toBe(false);
  });

  it('regenerates +1 energy per second during execution', () => {
    const s = createInitialMatch();
    submitReady(s, 'A'); submitReady(s, 'B');
    const before = s.energy.A;
    for (let i = 0; i < TICKS_PER_SEC; i++) tickMatch(s); // 1 second of execution
    expect(s.energy.A).toBe(before + ENERGY_PER_EXEC_SECOND);
  });

  it('caps energy at ENERGY_CAP', () => {
    const s = createInitialMatch();
    s.energy.A = ENERGY_CAP;
    submitReady(s, 'A'); submitReady(s, 'B');
    for (let i = 0; i < TICKS_PER_SEC * 5; i++) tickMatch(s);
    expect(s.energy.A).toBe(ENERGY_CAP);
  });

  it('endExecution returns to planning phase', () => {
    const s = createInitialMatch();
    submitReady(s, 'A'); submitReady(s, 'B');
    endExecution(s);
    expect(s.phase).toBe('planning');
  });

  it('declares winner when paint threshold is reached', () => {
    const s = createInitialMatch();
    // Force A's score above threshold by painting tiles directly
    for (let i = 0; i < WIN_PAINT_THRESHOLD - 24; i++) {
      const y = 2 + Math.floor(i / BOARD_SIZE);
      const x = i % BOARD_SIZE;
      s.board.tiles[y * BOARD_SIZE + x] = 'A';
    }
    submitReady(s, 'A'); submitReady(s, 'B');
    tickMatch(s);
    expect(s.phase).toBe('ended');
    expect(s.winner).toBe('A');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run:
```bash
npm test
```
Expected: Match-related tests fail.

- [ ] **Step 3: Extend src/sim/match.ts**

```typescript
import type { MatchState, PlayerId } from '../types/game';
import { createInitialBoard, scoreFor } from './board';
import {
  STARTING_ENERGY,
  ENERGY_CAP,
  ENERGY_PER_EXEC_SECOND,
  WIN_PAINT_THRESHOLD,
} from '../config/balance';
import { TICKS_PER_SEC } from '../config/constants';
import { advanceTick } from './tick';

export function createInitialMatch(): MatchState {
  return {
    board: createInitialBoard(),
    pets: [],
    nextPetId: 1,
    energy: { A: STARTING_ENERGY, B: STARTING_ENERGY },
    phase: 'planning',
    tick: 0,
    execPhaseStartTick: 0,
    activePlanningPlayer: 'A',
    ready: { A: false, B: false },
    winner: null,
    pendingDeployments: [],
    moveIntents: [],
  };
}

export function submitReady(state: MatchState, player: PlayerId): void {
  if (state.phase !== 'planning') return;
  state.ready[player] = true;
  if (state.ready.A && state.ready.B) {
    state.phase = 'execution';
    state.execPhaseStartTick = state.tick;
    state.ready = { A: false, B: false };
    state.activePlanningPlayer = 'A';
  }
}

function regenEnergy(state: MatchState): void {
  // +ENERGY_PER_EXEC_SECOND per second = +1 every TICKS_PER_SEC ticks
  const elapsed = state.tick - state.execPhaseStartTick;
  if (elapsed > 0 && elapsed % TICKS_PER_SEC === 0) {
    state.energy.A = Math.min(ENERGY_CAP, state.energy.A + ENERGY_PER_EXEC_SECOND);
    state.energy.B = Math.min(ENERGY_CAP, state.energy.B + ENERGY_PER_EXEC_SECOND);
  }
}

function checkWin(state: MatchState): void {
  const aScore = scoreFor(state.board, 'A');
  const bScore = scoreFor(state.board, 'B');
  if (aScore >= WIN_PAINT_THRESHOLD && bScore >= WIN_PAINT_THRESHOLD) {
    state.winner = aScore >= bScore ? 'A' : 'B';
    state.phase = 'ended';
    return;
  }
  if (aScore >= WIN_PAINT_THRESHOLD) {
    state.winner = 'A';
    state.phase = 'ended';
    return;
  }
  if (bScore >= WIN_PAINT_THRESHOLD) {
    state.winner = 'B';
    state.phase = 'ended';
    return;
  }
}

export function tickMatch(state: MatchState): void {
  if (state.phase !== 'execution') return;
  advanceTick(state);
  regenEnergy(state);
  checkWin(state);
}

export function endExecution(state: MatchState): void {
  if (state.phase !== 'execution') return;
  state.phase = 'planning';
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run:
```bash
npm test
```
Expected: All passing.

- [ ] **Step 5: Commit**

```bash
git add src/sim/match.ts tests/sim/match.test.ts
git commit -m "task 9: match phases, energy regen, win condition"
```

---

## Task 10: Render — canvas, board, pets

**Files:**
- Create: `src/render/canvas.ts`
- Create: `src/render/board.ts`
- Create: `src/render/pets.ts`
- Create: `src/render/ui.ts`

No tests for rendering — it's I/O. We rely on visual inspection during dev. Each file is small and focused.

- [ ] **Step 1: Create src/render/canvas.ts**

```typescript
import { BOARD_SIZE } from '../config/constants';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  tileSize: number;
  width: number;
  height: number;
}

export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  const tileSize = Math.floor(Math.min(canvas.width, canvas.height) / BOARD_SIZE);
  const ctx = canvas.getContext('2d')!;
  return { ctx, tileSize, width: canvas.width, height: canvas.height };
}

export function clearCanvas(rc: RenderContext): void {
  rc.ctx.fillStyle = '#1a1a1a';
  rc.ctx.fillRect(0, 0, rc.width, rc.height);
}

export function tileToPixel(rc: RenderContext, x: number, y: number): { px: number; py: number } {
  // y=0 is bottom (south player home); render with origin at top-left so flip y.
  return {
    px: x * rc.tileSize,
    py: (BOARD_SIZE - 1 - y) * rc.tileSize,
  };
}
```

- [ ] **Step 2: Create src/render/board.ts**

```typescript
import { RenderContext, tileToPixel } from './canvas';
import type { Board } from '../types/game';
import { BOARD_SIZE } from '../config/constants';

const COLORS = {
  neutral: '#3a3a3a',
  A: '#5688f5',   // blue
  B: '#f55656',   // red
};

export function renderBoard(rc: RenderContext, board: Board): void {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const color = board.tiles[y * BOARD_SIZE + x];
      const { px, py } = tileToPixel(rc, x, y);
      rc.ctx.fillStyle = COLORS[color];
      rc.ctx.fillRect(px, py, rc.tileSize, rc.tileSize);
      rc.ctx.strokeStyle = '#222';
      rc.ctx.strokeRect(px, py, rc.tileSize, rc.tileSize);
    }
  }
}
```

- [ ] **Step 3: Create src/render/pets.ts**

```typescript
import { RenderContext, tileToPixel } from './canvas';
import type { Pet } from '../types/pet';
import { getPetDef } from '../sim/pet-defs';

export function renderPets(rc: RenderContext, pets: Pet[]): void {
  for (const pet of pets) {
    const def = getPetDef(pet.defId);
    const { px, py } = tileToPixel(rc, pet.anchor.x, pet.anchor.y + def.size.h - 1);
    const w = def.size.w * rc.tileSize;
    const h = def.size.h * rc.tileSize;

    // Owner ring
    rc.ctx.strokeStyle = pet.owner === 'A' ? '#9bf' : '#fbb';
    rc.ctx.lineWidth = 3;
    rc.ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);

    // Emoji
    rc.ctx.font = `${Math.floor(h * 0.7)}px sans-serif`;
    rc.ctx.textAlign = 'center';
    rc.ctx.textBaseline = 'middle';
    rc.ctx.fillText(def.emoji, px + w / 2, py + h / 2);

    // Facing arrow
    rc.ctx.fillStyle = '#fff';
    rc.ctx.font = `${Math.floor(h * 0.25)}px sans-serif`;
    const arrowChar = { N: '▲', S: '▼', E: '▶', W: '◀' }[pet.facing];
    rc.ctx.fillText(arrowChar, px + w / 2, py + h - 8);

    // HP bar
    const hpFrac = pet.hp / def.maxHp;
    rc.ctx.fillStyle = '#222';
    rc.ctx.fillRect(px + 4, py + 4, w - 8, 4);
    rc.ctx.fillStyle = '#4f4';
    rc.ctx.fillRect(px + 4, py + 4, (w - 8) * hpFrac, 4);
  }
}
```

- [ ] **Step 4: Create src/render/ui.ts**

```typescript
import type { MatchState } from '../types/game';
import { scoreFor } from '../sim/board';
import { WIN_PAINT_THRESHOLD } from '../config/balance';

export function renderHUD(state: MatchState): void {
  const ui = document.getElementById('ui')!;
  const aScore = scoreFor(state.board, 'A');
  const bScore = scoreFor(state.board, 'B');
  ui.textContent =
    `Phase: ${state.phase}  |  ` +
    `A: ${aScore}/${WIN_PAINT_THRESHOLD} (energy ${state.energy.A})  ` +
    `B: ${bScore}/${WIN_PAINT_THRESHOLD} (energy ${state.energy.B})` +
    (state.phase === 'planning' ? `  |  active: ${state.activePlanningPlayer}` : '') +
    (state.winner ? `  |  WINNER: ${state.winner}` : '');
}
```

- [ ] **Step 5: Verify build still works**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/render/
git commit -m "task 10: canvas, board, pets, and HUD rendering"
```

---

## Task 11: Input — deployment UX

**Files:**
- Create: `src/input/deploy-ui.ts`

This handles the planning-phase UI: number keys to select a pet, WASD for facing, mouse for hover preview, click to deploy. For hot-seat, the side panel indicates whose turn to plan.

- [ ] **Step 1: Create src/input/deploy-ui.ts**

```typescript
import type { MatchState, Direction, Vec2 } from '../types/game';
import { tryDeploy } from '../sim/deploy';
import { submitReady } from '../sim/match';
import { MOUSE, ELEPHANT, getPetDef } from '../sim/pet-defs';
import { BOARD_SIZE } from '../config/constants';
import type { RenderContext } from '../render/canvas';
import { tileToPixel } from '../render/canvas';

const PET_HOTKEYS: Record<string, string> = {
  '1': MOUSE.id,
  '2': ELEPHANT.id,
};

export interface DeployUIState {
  selectedDefId: string | null;
  facing: Direction;
  hoverTile: Vec2 | null;
}

export function createDeployUIState(): DeployUIState {
  return { selectedDefId: null, facing: 'N', hoverTile: null };
}

export function attachDeployUI(
  canvas: HTMLCanvasElement,
  rc: RenderContext,
  state: MatchState,
  ui: DeployUIState,
): void {
  window.addEventListener('keydown', (e) => {
    if (state.phase !== 'planning') return;
    const k = e.key.toLowerCase();
    if (PET_HOTKEYS[k]) { ui.selectedDefId = PET_HOTKEYS[k]; return; }
    if (k === 'w') ui.facing = 'N';
    else if (k === 's') ui.facing = 'S';
    else if (k === 'a') ui.facing = 'W';
    else if (k === 'd') ui.facing = 'E';
    else if (k === ' ' || k === 'enter') submitReady(state, state.activePlanningPlayer);
    else if (k === 'tab') {
      e.preventDefault();
      state.activePlanningPlayer = state.activePlanningPlayer === 'A' ? 'B' : 'A';
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const x = Math.floor(px / rc.tileSize);
    const y = BOARD_SIZE - 1 - Math.floor(py / rc.tileSize);
    if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
      ui.hoverTile = { x, y };
    } else {
      ui.hoverTile = null;
    }
  });

  canvas.addEventListener('click', () => {
    if (state.phase !== 'planning') return;
    if (!ui.selectedDefId || !ui.hoverTile) return;
    tryDeploy(state, state.activePlanningPlayer, ui.selectedDefId, ui.hoverTile, ui.facing);
  });
}

export function renderDeployPreview(rc: RenderContext, ui: DeployUIState): void {
  if (!ui.selectedDefId || !ui.hoverTile) return;
  const def = getPetDef(ui.selectedDefId);
  const { px, py } = tileToPixel(rc, ui.hoverTile.x, ui.hoverTile.y + def.size.h - 1);
  rc.ctx.globalAlpha = 0.5;
  rc.ctx.fillStyle = '#ff0';
  rc.ctx.fillRect(px, py, def.size.w * rc.tileSize, def.size.h * rc.tileSize);
  rc.ctx.globalAlpha = 1;
  rc.ctx.font = `${Math.floor(rc.tileSize * 0.6)}px sans-serif`;
  rc.ctx.textAlign = 'center';
  rc.ctx.textBaseline = 'middle';
  rc.ctx.fillStyle = '#fff';
  rc.ctx.fillText(def.emoji, px + (def.size.w * rc.tileSize) / 2, py + (def.size.h * rc.tileSize) / 2);
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/input/
git commit -m "task 11: deploy UX — keyboard, mouse hover, click to place"
```

---

## Task 12: Main game loop

**Files:**
- Create: `src/loop.ts`
- Modify: `src/main.ts`

The main loop uses `requestAnimationFrame` to drive rendering. Inside the RAF callback, we accumulate elapsed time and advance the sim by `tickMatch` exactly TICKS_PER_SEC times per second of execution-phase wall time. When the execution phase has run for `EXECUTION_PHASE_SECONDS`, we call `endExecution`.

- [ ] **Step 1: Create src/loop.ts**

```typescript
import type { MatchState } from './types/game';
import { tickMatch, endExecution } from './sim/match';
import { TICKS_PER_SEC } from './config/constants';
import { EXECUTION_PHASE_SECONDS } from './config/balance';

export class GameLoop {
  private accumulatedMs = 0;
  private lastFrameMs = 0;
  private execElapsedTicks = 0;
  private readonly tickIntervalMs = 1000 / TICKS_PER_SEC;
  private readonly execPhaseTicks = EXECUTION_PHASE_SECONDS * TICKS_PER_SEC;

  constructor(
    private state: MatchState,
    private onRender: () => void,
  ) {}

  start(): void {
    this.lastFrameMs = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    const dt = now - this.lastFrameMs;
    this.lastFrameMs = now;

    if (this.state.phase === 'execution') {
      this.accumulatedMs += dt;
      while (this.accumulatedMs >= this.tickIntervalMs) {
        tickMatch(this.state);
        this.accumulatedMs -= this.tickIntervalMs;
        this.execElapsedTicks += 1;
        if (this.execElapsedTicks >= this.execPhaseTicks) {
          endExecution(this.state);
          this.execElapsedTicks = 0;
          this.accumulatedMs = 0;
          break;
        }
      }
    } else {
      // Planning or ended — reset accumulators
      this.accumulatedMs = 0;
      this.execElapsedTicks = 0;
    }

    this.onRender();

    if (this.state.phase !== 'ended') {
      requestAnimationFrame(this.frame);
    }
  };
}
```

- [ ] **Step 2: Rewrite src/main.ts to wire everything together**

```typescript
import { createInitialMatch } from './sim/match';
import { createRenderContext, clearCanvas } from './render/canvas';
import { renderBoard } from './render/board';
import { renderPets } from './render/pets';
import { renderHUD } from './render/ui';
import {
  createDeployUIState,
  attachDeployUI,
  renderDeployPreview,
} from './input/deploy-ui';
import { GameLoop } from './loop';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const rc = createRenderContext(canvas);
const state = createInitialMatch();
const ui = createDeployUIState();
attachDeployUI(canvas, rc, state, ui);

function render() {
  clearCanvas(rc);
  renderBoard(rc, state.board);
  renderPets(rc, state.pets);
  renderDeployPreview(rc, ui);
  renderHUD(state);
}

const loop = new GameLoop(state, render);
loop.start();
```

- [ ] **Step 3: Manually verify dev server**

Run:
```bash
npm run dev
```

Expected steps in browser:
1. Open localhost:5173.
2. HUD shows "Phase: planning | A: 24/108 (energy 3) B: 24/108 (energy 3) | active: A".
3. Press `1` to select Mouse, hover over the bottom row, click — yellow preview appears, then a 🐭 with blue ring is deployed. Energy goes 3→1.
4. Press Tab to switch to Player B, press `1`, hover over the top row, click — 🐭 with red ring deployed.
5. Press Space → energy doesn't deplete; press Tab + Space to ready B → phase changes to "execution".
6. Pets begin marching toward each other; tiles paint behind them.
7. After ~8 seconds, phase returns to "planning"; energy goes up to ~3+8=10 (capped) for each side.

- [ ] **Step 4: Commit**

```bash
git add src/loop.ts src/main.ts
git commit -m "task 12: main game loop driving sim ticks + render"
```

---

## Task 13: Manual playtest checklist and polish

**Files:**
- Modify: `src/main.ts` (small polish)
- Modify: `src/render/ui.ts` (instructions hint)

This task is mostly verification, not new code. Run through the playtest, fix anything obviously broken, and document known issues.

- [ ] **Step 1: Add an instructions strip to the HUD**

Modify `src/render/ui.ts` — after the existing `ui.textContent = ...`, add:
```typescript
const help = document.getElementById('help');
if (!help) {
  const div = document.createElement('div');
  div.id = 'help';
  div.style.textAlign = 'center';
  div.style.color = '#aaa';
  div.style.fontSize = '12px';
  div.style.margin = '6px';
  div.textContent =
    '1=Mouse  2=Elephant  |  WASD sets facing  |  Click to deploy  ' +
    '|  Tab switches player  |  Space readies current player';
  document.body.appendChild(div);
}
```

- [ ] **Step 2: Manual playtest checklist (no automation; do all by hand)**

Run `npm run dev` and verify each:

- [ ] Initial board shows 2 blue rows at bottom, 2 red rows at top, 8 neutral rows in middle.
- [ ] HUD shows scores 24/108 for each side and energy 3 for each.
- [ ] Press `1`, hover over row 0 or 1 (blue zone) → yellow 🐭 preview appears.
- [ ] Click → 🐭 with blue ring deploys, energy 3→1.
- [ ] Press `2` while in row 0, click → "out of zone" (the click silently fails because 2×2 elephant at y=0 needs y∈{0,1}, which is fine). Try anchor at (5,0): 🐘 deploys, energy 1 (insufficient — should fail silently).
- [ ] Refill: temporarily set `STARTING_ENERGY=10` in balance.ts and verify Elephant deploys.
- [ ] Press WASD: facing direction visibly changes on the next deploy preview (▲▼▶◀).
- [ ] Press Tab: HUD's "active: A" flips to "active: B".
- [ ] As B, place a pet in the top zone, then Space + Tab + Space (or just hit both readies) → phase switches to execution.
- [ ] Pets slide forward at their speed; tiles paint behind them. (Note: smooth interpolation between ticks is not implemented in v1.1; pets jump tile-by-tile — see Open Issue below.)
- [ ] Head-on collision: a Mouse runs into an Elephant → Mouse dies after a couple of seconds.
- [ ] After execution phase ends (~8 sec), HUD returns to "planning" and energy has gone up.
- [ ] A game can be won by painting enough tiles: temporarily lower `WIN_PAINT_THRESHOLD` to 30 to verify the win banner shows.

- [ ] **Step 3: Document known issues**

Modify the README.md to add a "Known v1.1 limitations" section:
```markdown
## Known v1.1 limitations

- Pets jump tile-to-tile each move tick instead of interpolating smoothly between them. Interpolation is purely a visual concern and can be added without changing simulation logic. (Tracked for v1.2.)
- Hot-seat planning shows both players' deployed pets on the same screen — there is no "screen handoff" to hide one player's queue from the other. v1.1 is a single-developer playtest tool; secrecy can be added later.
- Planning phase has no timer (the soft-timeout from the spec is unimplemented). Both players must press Space to ready.
- No sound, no animations, no game-over restart button — refresh the page to play again.
```

- [ ] **Step 4: Commit**

```bash
git add src/render/ui.ts README.md
git commit -m "task 13: HUD instructions and known v1.1 limitations"
```

- [ ] **Step 5: Final verification**

Run all tests one more time:
```bash
npm test
npx tsc --noEmit
```
Expected: All tests passing, no type errors.

---

## Recap and what's next

After Task 13, the game should be playable end-to-end. The codebase deliberately leaves easy extension points for v1.2+:

- **New pets:** add to `pet-defs.ts` with new tuples; balance numbers go in `balance.ts`.
- **New triggers/actions:** the `(trigger, action, intervalSec)` model already supports anything (AoE, ranged, heal, deathrattle). Just add new pure functions.
- **Smooth animation:** the renderer can interpolate pet position by reading `(pet.anchor, lastMoveTick, currentTick)` and lerping. No sim change needed.
- **Networking:** the sim is pure-functional and deterministic given inputs; suitable for lockstep multiplayer with `pendingDeployments` as the only network payload per planning phase.
- **More brain modes:** swap out the `frontTilesClearAndOnBoard` trigger and `declareMove` action for variants that pick directions dynamically.

The user has indicated they will playtest and decide what to add next based on feel. Do not pre-design v1.2 mechanics.
