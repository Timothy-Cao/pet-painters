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
    expect(scoreFor(b, 'A')).toBe(BOARD_SIZE * HOME_ROWS);
    expect(scoreFor(b, 'B')).toBe(BOARD_SIZE * HOME_ROWS);
  });

  it('updates as tiles are painted', () => {
    const b = createInitialBoard();
    const start = scoreFor(b, 'A');
    paintTile(b, { x: 5, y: 5 }, 'A');
    expect(scoreFor(b, 'A')).toBe(start + 1);
  });
});
