import type { MatchState } from '../types/game';

// HUD is now rendered by the DOM-based sandbox UI in src/ui/sandbox-ui.ts.
// This export is kept for backward compatibility and is a no-op.
export function renderHUD(_state: MatchState): void {
  // intentionally empty
}
