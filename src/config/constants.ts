export const TICK_RATE_HZ = 20;
export const TICKS_PER_SEC = TICK_RATE_HZ;
export const BOARD_SIZE = 20;  // 20x20 grid

// Home zones are 5×5 corner squares.
// Player A: bottom-left (rows 0..4, cols 0..4)
// Player B: top-right (rows 15..19, cols 15..19)
export const HOME_ZONE_SIZE = 5;
export const HOME_A_MIN_X = 0;
export const HOME_A_MAX_X = HOME_ZONE_SIZE - 1;
export const HOME_A_MIN_Y = 0;
export const HOME_A_MAX_Y = HOME_ZONE_SIZE - 1;
export const HOME_B_MIN_X = BOARD_SIZE - HOME_ZONE_SIZE;
export const HOME_B_MAX_X = BOARD_SIZE - 1;
export const HOME_B_MIN_Y = BOARD_SIZE - HOME_ZONE_SIZE;
export const HOME_B_MAX_Y = BOARD_SIZE - 1;
