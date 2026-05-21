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
      this.accumulatedMs = 0;
      this.execElapsedTicks = 0;
    }

    this.onRender();

    if (this.state.phase !== 'ended') {
      requestAnimationFrame(this.frame);
    }
  };
}
