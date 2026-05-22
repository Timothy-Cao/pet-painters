/**
 * sfx.ts — Minimal synthesized sound effects via Web Audio API.
 *
 * All sounds are procedurally generated (sine/triangle waves) — no audio
 * file assets needed.  Default OFF on first load; user must toggle on.
 *
 * Respects prefers-reduced-motion: sounds disabled when that media query is set.
 */

import { sfxGain } from './audio';

const STORAGE_KEY = 'pet-painters-sound';

// ---------- state ----------
let _ctx: AudioContext | null = null;
let _enabled = false;
let _masterGain: GainNode | null = null;

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
  if (!_ctx) {
    _ctx = new AudioContext();
    _masterGain = _ctx.createGain();
    _masterGain.connect(_ctx.destination);
  }
  // Update master gain to current SFX volume each time.
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
  gain.connect(_masterGain ?? ctx.destination);

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
  gain.connect(_masterGain ?? ctx.destination);
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

// ---------- Pet-specific deploy SFX ----------
// Each pet gets a unique short synth sound when deployed on the board.
// Mapped by defId (lowercase pet name).

const PET_DEPLOY_SFX: Record<string, () => void> = {
  mouse: () => {
    // Quick high squeak
    playTone({ freq: 1200, type: 'sine', gainPeak: 0.10, attackMs: 3, decayMs: 60 });
    playTone({ freq: 1400, type: 'sine', gainPeak: 0.07, attackMs: 3, decayMs: 40, startOffsetMs: 30 });
  },
  cat: () => {
    // Soft purr-like vibrato
    playTone({ freq: 320, type: 'triangle', gainPeak: 0.10, attackMs: 10, decayMs: 140 });
    playTone({ freq: 340, type: 'triangle', gainPeak: 0.08, attackMs: 8, decayMs: 120, startOffsetMs: 60 });
  },
  rabbit: () => {
    // Bouncy double boop
    playTone({ freq: 520, type: 'sine', gainPeak: 0.10, attackMs: 5, decayMs: 70 });
    playTone({ freq: 620, type: 'sine', gainPeak: 0.08, attackMs: 5, decayMs: 60, startOffsetMs: 50 });
  },
  turtle: () => {
    // Low sturdy thud
    playTone({ freq: 140, type: 'triangle', gainPeak: 0.14, attackMs: 15, decayMs: 200 });
  },
  spider: () => {
    // Eerie descending whistle
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(_masterGain ?? ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  },
  eagle: () => {
    // Sharp ascending screech
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(_masterGain ?? ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  },
  lion: () => {
    // Low growl burst
    playTone({ freq: 120, type: 'sawtooth', gainPeak: 0.10, attackMs: 10, decayMs: 180 });
    playTone({ freq: 160, type: 'triangle', gainPeak: 0.08, attackMs: 8, decayMs: 140, startOffsetMs: 40 });
  },
  bear: () => {
    // Deep rumbling thump
    playTone({ freq: 90, type: 'triangle', gainPeak: 0.14, attackMs: 20, decayMs: 250 });
    playTone({ freq: 110, type: 'sine', gainPeak: 0.08, attackMs: 15, decayMs: 200, startOffsetMs: 60 });
  },
  elephant: () => {
    // Trumpet-like ascending blast
    playTone({ freq: 180, type: 'sawtooth', gainPeak: 0.10, attackMs: 15, decayMs: 200 });
    playTone({ freq: 360, type: 'sine', gainPeak: 0.08, attackMs: 10, decayMs: 160, startOffsetMs: 50 });
  },
  whale: () => {
    // Deep whale-song sweep
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.30);
    gain.gain.setValueAtTime(0.10, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain);
    gain.connect(_masterGain ?? ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  },
  dragon: () => {
    // Fiery roar: noise-like sawtooth burst
    playTone({ freq: 100, type: 'sawtooth', gainPeak: 0.12, attackMs: 10, decayMs: 160 });
    playTone({ freq: 200, type: 'sawtooth', gainPeak: 0.08, attackMs: 8, decayMs: 200, startOffsetMs: 40 });
    playTone({ freq: 400, type: 'sine', gainPeak: 0.06, attackMs: 5, decayMs: 180, startOffsetMs: 80 });
  },
  rhino: () => {
    // Heavy charge stomp
    playTone({ freq: 100, type: 'triangle', gainPeak: 0.14, attackMs: 8, decayMs: 160 });
    playTone({ freq: 80, type: 'sine', gainPeak: 0.10, attackMs: 12, decayMs: 200, startOffsetMs: 40 });
  },
  skunk: () => {
    // Hissy puff
    playTone({ freq: 800, type: 'sawtooth', gainPeak: 0.05, attackMs: 5, decayMs: 100 });
    playTone({ freq: 200, type: 'triangle', gainPeak: 0.08, attackMs: 10, decayMs: 120, startOffsetMs: 30 });
  },
};

/** Play pet-specific deploy sound. Falls back to generic deploy if no custom SFX. */
export function playPetDeploy(defId: string): void {
  const fn = PET_DEPLOY_SFX[defId];
  if (fn) {
    fn();
  } else {
    playDeploy();
  }
}
