/**
 * sfx.ts — Procedural sound effects for Critter Crossing.
 *
 * Uses Web Audio API to synthesize all sounds — no audio files needed.
 * Respects the shared SFX volume from audio.ts.
 */

import { sfxGain } from '../render/audio';

let _ctx: AudioContext | null = null;
let _masterGain: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (sfxGain() === 0) return null;
  if (!_ctx) {
    try {
      _ctx = new AudioContext();
      _masterGain = _ctx.createGain();
      _masterGain.connect(_ctx.destination);
    } catch {
      return null;
    }
  }
  if (_masterGain) _masterGain.gain.value = sfxGain();
  return _ctx;
}

interface ToneParams {
  freq: number;
  type?: OscillatorType;
  gainPeak?: number;
  attackMs?: number;
  decayMs?: number;
  startOffsetMs?: number;
}

function playTone(params: ToneParams): void {
  const ctx = getCtx();
  if (!ctx) return;
  const {
    freq,
    type = 'sine',
    gainPeak = 0.15,
    attackMs = 8,
    decayMs = 120,
    startOffsetMs = 0,
  } = params;

  const now = ctx.currentTime + startOffsetMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + attackMs / 1000);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (attackMs + decayMs) / 1000);

  osc.connect(gain);
  gain.connect(_masterGain ?? ctx.destination);

  osc.start(now);
  osc.stop(now + (attackMs + decayMs) / 1000 + 0.01);
}

// ── Public SFX ───────────────────────────────────────────────────────

/** Soft click when selecting a unit. */
export function cxPlaySelect(): void {
  playTone({ freq: 660, type: 'triangle', gainPeak: 0.08, attackMs: 3, decayMs: 50 });
}

/** Deselect / cancel. */
export function cxPlayDeselect(): void {
  playTone({ freq: 440, type: 'triangle', gainPeak: 0.06, attackMs: 3, decayMs: 40 });
}

/** Slide sound when moving a piece. */
export function cxPlayMove(): void {
  playTone({ freq: 300, type: 'sine', gainPeak: 0.10, attackMs: 5, decayMs: 90 });
  playTone({ freq: 450, type: 'sine', gainPeak: 0.07, attackMs: 5, decayMs: 70, startOffsetMs: 30 });
}

/** Impact when capturing an enemy unit. */
export function cxPlayCapture(): void {
  playTone({ freq: 180, type: 'sawtooth', gainPeak: 0.12, attackMs: 5, decayMs: 100 });
  playTone({ freq: 520, type: 'sine', gainPeak: 0.10, attackMs: 3, decayMs: 80, startOffsetMs: 25 });
  playTone({ freq: 280, type: 'triangle', gainPeak: 0.08, attackMs: 5, decayMs: 120, startOffsetMs: 60 });
}

/** Heavy thud when elephant pushes. */
export function cxPlayPush(): void {
  playTone({ freq: 120, type: 'triangle', gainPeak: 0.14, attackMs: 8, decayMs: 150 });
  playTone({ freq: 90, type: 'sine', gainPeak: 0.10, attackMs: 12, decayMs: 180, startOffsetMs: 30 });
}

/** Celebratory chime when a unit scores. */
export function cxPlayScore(): void {
  playTone({ freq: 523, type: 'sine', gainPeak: 0.14, attackMs: 10, decayMs: 200 });
  playTone({ freq: 659, type: 'sine', gainPeak: 0.12, attackMs: 8, decayMs: 220, startOffsetMs: 80 });
  playTone({ freq: 784, type: 'sine', gainPeak: 0.10, attackMs: 6, decayMs: 280, startOffsetMs: 160 });
}

/** Ascending chord on player win. */
export function cxPlayWin(): void {
  playTone({ freq: 262, type: 'sine', gainPeak: 0.16, attackMs: 15, decayMs: 400 });
  playTone({ freq: 330, type: 'sine', gainPeak: 0.14, attackMs: 12, decayMs: 450, startOffsetMs: 100 });
  playTone({ freq: 392, type: 'sine', gainPeak: 0.12, attackMs: 10, decayMs: 500, startOffsetMs: 200 });
  playTone({ freq: 523, type: 'triangle', gainPeak: 0.10, attackMs: 8, decayMs: 600, startOffsetMs: 320 });
}

/** Descending tone on player loss. */
export function cxPlayLose(): void {
  playTone({ freq: 400, type: 'sine', gainPeak: 0.12, attackMs: 10, decayMs: 300 });
  playTone({ freq: 300, type: 'sine', gainPeak: 0.10, attackMs: 10, decayMs: 350, startOffsetMs: 120 });
  playTone({ freq: 200, type: 'triangle', gainPeak: 0.08, attackMs: 10, decayMs: 400, startOffsetMs: 260 });
}

/** Short buzz on invalid move attempt. */
export function cxPlayInvalid(): void {
  playTone({ freq: 150, type: 'sawtooth', gainPeak: 0.06, attackMs: 3, decayMs: 80 });
  playTone({ freq: 130, type: 'sawtooth', gainPeak: 0.05, attackMs: 3, decayMs: 60, startOffsetMs: 40 });
}

/** New game start jingle. */
export function cxPlayGameStart(): void {
  playTone({ freq: 392, type: 'sine', gainPeak: 0.12, attackMs: 10, decayMs: 150 });
  playTone({ freq: 523, type: 'sine', gainPeak: 0.10, attackMs: 8, decayMs: 180, startOffsetMs: 100 });
  playTone({ freq: 659, type: 'triangle', gainPeak: 0.08, attackMs: 6, decayMs: 200, startOffsetMs: 200 });
}
