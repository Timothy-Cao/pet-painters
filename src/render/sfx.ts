/**
 * sfx.ts — Minimal synthesized sound effects via Web Audio API.
 *
 * All sounds are procedurally generated (sine/triangle waves) — no audio
 * file assets needed.  Default OFF on first load; user must toggle on.
 *
 * Respects prefers-reduced-motion: sounds disabled when that media query is set.
 */

const STORAGE_KEY = 'pet-painters-sound';

// ---------- state ----------
let _ctx: AudioContext | null = null;
let _enabled = false;

function isReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Load persisted preference; defaults to false (off). */
export function loadSoundPref(): void {
  try {
    _enabled = localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    _enabled = false;
  }
}

export function isSoundEnabled(): boolean {
  return _enabled;
}

export function setSoundEnabled(on: boolean): void {
  _enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch { /* storage unavailable */ }
  if (_enabled && !_ctx) {
    _ctx = new AudioContext();
  }
}

// ---------- internal helpers ----------

function getCtx(): AudioContext | null {
  if (!_enabled || isReducedMotion()) return null;
  if (!_ctx) _ctx = new AudioContext();
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
    gainPeak = 0.18,
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
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + (attackMs + decayMs) / 1000 + 0.01);
}

// ---------- public SFX functions ----------

/** Soft pop when a deployment is confirmed. */
export function playDeploy(): void {
  playTone({ freq: 220, type: 'triangle', gainPeak: 0.14, attackMs: 10, decayMs: 80 });
  playTone({ freq: 330, type: 'triangle', gainPeak: 0.08, attackMs: 5, decayMs: 100, startOffsetMs: 30 });
}

/** Short higher-pitch click on combat hit. */
export function playHit(): void {
  playTone({ freq: 560, type: 'sine', gainPeak: 0.12, attackMs: 4, decayMs: 60 });
}

/** Short downward sweep when a pet dies. */
export function playDeath(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.28);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.32);
}

/** Two-tone ascending chime at round start. */
export function playRoundStart(): void {
  playTone({ freq: 330, type: 'sine', gainPeak: 0.16, attackMs: 15, decayMs: 160 });
  playTone({ freq: 495, type: 'sine', gainPeak: 0.14, attackMs: 10, decayMs: 200, startOffsetMs: 130 });
}

/** Ascending chord on win. */
export function playWin(): void {
  // Three notes rising quickly — C-E-G in roughly 220Hz territory
  playTone({ freq: 262, type: 'sine', gainPeak: 0.18, attackMs: 20, decayMs: 400 });
  playTone({ freq: 330, type: 'sine', gainPeak: 0.16, attackMs: 15, decayMs: 450, startOffsetMs: 80 });
  playTone({ freq: 392, type: 'sine', gainPeak: 0.14, attackMs: 12, decayMs: 500, startOffsetMs: 160 });
  playTone({ freq: 524, type: 'triangle', gainPeak: 0.12, attackMs: 10, decayMs: 600, startOffsetMs: 260 });
}

/** Tick sound during countdown (3…2…1). */
export function playCountdownTick(): void {
  playTone({ freq: 440, type: 'triangle', gainPeak: 0.12, attackMs: 5, decayMs: 70 });
}

/** "GO" sound at start of execution. */
export function playCountdownGo(): void {
  playTone({ freq: 660, type: 'sine', gainPeak: 0.20, attackMs: 8, decayMs: 200 });
  playTone({ freq: 880, type: 'sine', gainPeak: 0.14, attackMs: 5, decayMs: 260, startOffsetMs: 60 });
}
