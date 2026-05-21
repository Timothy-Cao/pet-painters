import { describe, it, expect } from 'vitest';
import { createInitialBoard, getTile, paintTile, scoreFor } from '../../src/sim/board';
import {
  BOARD_SIZE,
  HOME_ZONE_SIZE,
  HOME_A_MIN_X, HOME_A_MAX_X, HOME_A_MIN_Y, HOME_A_MAX_Y,
  HOME_B_MIN_X, HOME_B_MAX_X, HOME_B_MIN_Y, HOME_B_MAX_Y,
} from '../../src/config/constants';

describe('createInitialBoard', () => {
  it('creates a board with the configured size', () => {
    const b = createInitialBoard();
    expect(b.size).toBe(BOARD_SIZE);
    expect(b.tiles.length).toBe(BOARD_SIZE * BOARD_SIZE);
  });

  it('pre-paints the bottom-left 5×5 corner for player A', () => {
    const b = createInitialBoard();
    for (let y = HOME_A_MIN_Y; y <= HOME_A_MAX_Y; y++) {
      for (let x = HOME_A_MIN_X; x <= HOME_A_MAX_X; x++) {
        expect(getTile(b, { x, y })).toBe('A');
      }
    }
  });

  it('pre-paints the top-right 5×5 corner for player B', () => {
    const b = createInitialBoard();
    for (let y = HOME_B_MIN_Y; y <= HOME_B_MAX_Y; y++) {
      for (let x = HOME_B_MIN_X; x <= HOME_B_MAX_X; x++) {
        expect(getTile(b, { x, y })).toBe('B');
      }
    }
  });

  it('leaves non-corner tiles neutral', () => {
    const b = createInitialBoard();
    // Check a tile in middle that should definitely be neutral
    expect(getTile(b, { x: 10, y: 10 })).toBe('neutral');
    // Bottom-right corner — not player A's zone
    expect(getTile(b, { x: BOARD_SIZE - 1, y: 0 })).toBe('neutral');
    // Top-left corner — not player B's zone
    expect(getTile(b, { x: 0, y: BOARD_SIZE - 1 })).toBe('neutral');
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
    expect(scoreFor(b, 'A')).toBe(HOME_ZONE_SIZE * HOME_ZONE_SIZE);
    expect(scoreFor(b, 'B')).toBe(HOME_ZONE_SIZE * HOME_ZONE_SIZE);
  });

  it('updates as tiles are painted', () => {
    const b = createInitialBoard();
    const start = scoreFor(b, 'A');
    paintTile(b, { x: 5, y: 5 }, 'A');
    expect(scoreFor(b, 'A')).toBe(start + 1);
  });
});
