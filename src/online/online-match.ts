import type { MatchState, PlayerId } from '../types/game';
import { createRng, hashSeed } from '../sim/rng';
import { tryDeploy } from '../sim/deploy';
import { submitReady as localSubmitReady } from '../sim/match';
import { getPetDef } from '../sim/pet-defs';
import {
  submitRound,
  fetchSubmissions,
  subscribeToSubmissions,
  type DeploymentDTO,
} from './submissions';
import { getSupabase } from './supabase';

export class OnlineMatchController {
  private unsubSubmissions: (() => void) | null = null;
  private pendingDeployments: DeploymentDTO[] = [];
  private readyForCurrentRound = false;
  private bothInFlight = false;
  private opponentReadyForCurrentRound = false;
  private opponentReadyListener: (() => void) | null = null;

  constructor(
    private roomId: string,
    private mySlot: PlayerId,
    private state: MatchState,
  ) {
    this.reseedRng();
  }

  attach(): void {
    // Mark room as playing now that both players are in the match.
    const supabase = getSupabase();
    supabase.from('rooms').update({ status: 'playing' }).eq('id', this.roomId).then(() => {});

    this.unsubSubmissions = subscribeToSubmissions(this.roomId, (sub) => {
      if (sub.round !== this.state.round) return;
      if (sub.player_slot !== this.mySlot && !this.opponentReadyForCurrentRound) {
        this.opponentReadyForCurrentRound = true;
        this.opponentReadyListener?.();
      }
      this.maybeStartRound();
    });
    // Catch up on submissions that might have been sent before subscribe registered.
    this.maybeStartRound();
  }

  detach(): void {
    if (this.unsubSubmissions) {
      this.unsubSubmissions();
      this.unsubSubmissions = null;
    }
  }

  /**
   * Player queued a deployment locally. We DON'T add it to state.pets yet —
   * deployments only enter the board when both submissions are merged at execution start.
   * Returns false if Ready was already pressed, OR if the player can't afford
   * this deployment given their current energy minus what's already queued.
   */
  queueLocalDeployment(d: DeploymentDTO): boolean {
    if (this.readyForCurrentRound) return false;
    if (this.remainingEnergy() < getPetDef(d.defId).cost) return false;
    this.pendingDeployments.push(d);
    return true;
  }

  /** Energy this player still has to spend after subtracting all queued (but not yet committed) deployments. */
  remainingEnergy(): number {
    const available = this.state.energy[this.mySlot];
    const queued = this.pendingDeployments.reduce(
      (sum, p) => sum + getPetDef(p.defId).cost,
      0,
    );
    return available - queued;
  }

  /** True if this player has already submitted for the current round. */
  hasReadied(): boolean {
    return this.readyForCurrentRound;
  }

  /** True if the opponent has submitted for the current round. */
  hasOpponentReadied(): boolean {
    return this.opponentReadyForCurrentRound;
  }

  /** Register a callback fired whenever opponent-ready or own-ready transitions. */
  setOpponentReadyListener(fn: (() => void) | null): void {
    this.opponentReadyListener = fn;
  }

  cancelLastLocalDeployment(): boolean {
    if (this.readyForCurrentRound) return false;
    return this.pendingDeployments.pop() != null;
  }

  getPendingDeployments(): readonly DeploymentDTO[] {
    return this.pendingDeployments;
  }

  isReady(): boolean {
    return this.readyForCurrentRound;
  }

  async submitMyReady(): Promise<void> {
    if (this.readyForCurrentRound) return;
    await submitRound(this.roomId, this.state.round, this.mySlot, this.pendingDeployments);
    this.readyForCurrentRound = true;
    this.maybeStartRound();
  }

  private async maybeStartRound(): Promise<void> {
    if (this.state.phase !== 'planning') return;
    if (this.bothInFlight) return;
    this.bothInFlight = true;
    try {
      const subs = await fetchSubmissions(this.roomId, this.state.round);
      if (subs.length < 2) {
        this.bothInFlight = false;
        return;
      }
      // Apply both players' deployments in a deterministic order.
      const ordered = [...subs].sort((a, b) => a.player_slot.localeCompare(b.player_slot));
      for (const sub of ordered) {
        for (const d of sub.deployments) {
          tryDeploy(this.state, sub.player_slot as import('../types/game').PlayerId, d.defId, d.anchor, d.facing);
        }
      }
      this.reseedRng();
      // Trigger local execution-phase transition for both sides.
      localSubmitReady(this.state, 'A');
      localSubmitReady(this.state, 'B');
      // Reset for next round.
      this.pendingDeployments = [];
      this.readyForCurrentRound = false;
      this.opponentReadyForCurrentRound = false;
      this.opponentReadyListener?.();
      this.bothInFlight = false;
    } catch (e) {
      console.error('maybeStartRound failed:', e);
      this.bothInFlight = false;
    }
  }

  /**
   * Called by the game loop when the local execution phase ends.
   * `state.round` was already incremented by `submitReady` when both players
   * went ready (see sim/match.ts). We just reseed the RNG for the new round
   * and persist the round number on the server for reconnect support.
   */
  async onExecutionEnd(): Promise<void> {
    this.reseedRng();
    try {
      const supabase = getSupabase();
      await supabase.from('rooms').update({
        current_round: this.state.round,
        last_activity_at: new Date().toISOString(),
      }).eq('id', this.roomId);
    } catch {
      // Best-effort. Round counter still works locally; reconnects may be off-by-one
      // but the deterministic sim catches up.
    }
  }

  private reseedRng(): void {
    this.state.rng = createRng(hashSeed(this.roomId, this.state.round));
  }
}
