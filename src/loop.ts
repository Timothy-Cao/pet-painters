import type { MatchState } from './types/game';
import { tickMatch, endExecution } from './sim/match';
import { TICKS_PER_SEC } from './config/constants';
import { EXECUTION_PHASE_SECONDS } from './config/balance';

export interface GameLoopBindings {
  /** Called once, synchronously, right after the execution phase ends each round. */
  onExecutionEnd?: () => void;
  /** Called once when stop() is invoked, to allow callers to perform cleanup. */
  onStop?: () => void;
}

export class GameLoop {
  private accumulatedMs = 0;
  private lastFrameMs = 0;
  private execElapsedTicks = 0;
  private readonly tickIntervalMs = 1000 / TICKS_PER_SEC;
  private readonly execPhaseTicks = EXECUTION_PHASE_SECONDS * TICKS_PER_SEC;
  private stopped = false;
  private rafId: number | null = null;

  constructor(
    private state: MatchState,
    private onRender: () => void,
    private bindings?: GameLoopBindings,
  ) {}

  start(): void {
    this.lastFrameMs = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** Permanently stop the loop. After calling stop(), no more frames will be scheduled. */
  stop(): void {
    this.stopped = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.bindings?.onStop?.();
  }

  private frame = (now: number): void => {
    if (this.stopped) return;

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
          this.bindings?.onExecutionEnd?.();
          break;
        }
      }
    } else {
      this.accumulatedMs = 0;
      this.execElapsedTicks = 0;
    }

    this.onRender();

    // Always keep rendering — phase transitions (incl. reset out of 'ended') are handled in-place.
    this.rafId = requestAnimationFrame(this.frame);
  };
}
