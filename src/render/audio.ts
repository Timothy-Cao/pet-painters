/**
 * audio.ts — Music player + volume management for SFX and music.
 *
 * Music tracks loop continuously. Two categories of tracks (menu, gameplay)
 * are randomly selected from their pool. Crossfades on category switch.
 *
 * Volume model:
 *  - Master SFX volume (0-100, default 75, stored in localStorage)
 *  - Master Music volume (0-100, default 50, stored in localStorage)
 *  - Music plays at 50% of the displayed volume (so default = 25% real gain)
 */

const MUSIC_KEY = 'pet-painters-music-vol';
const SFX_KEY = 'pet-painters-sfx-vol';
const CROSSFADE_MS = 1200;

// ---------- Volume state ----------

let _sfxVol = 75;   // 0–100
let _musicVol = 50;  // 0–100

export function loadAudioPrefs(): void {
  try {
    const s = localStorage.getItem(SFX_KEY);
    if (s != null) _sfxVol = Math.max(0, Math.min(100, parseInt(s, 10) || 75));
    const m = localStorage.getItem(MUSIC_KEY);
    if (m != null) _musicVol = Math.max(0, Math.min(100, parseInt(m, 10) || 50));
  } catch { /* storage unavailable */ }
}

export function getSfxVolume(): number { return _sfxVol; }
export function getMusicVolume(): number { return _musicVol; }

export function setSfxVolume(v: number): void {
  _sfxVol = Math.max(0, Math.min(100, v));
  try { localStorage.setItem(SFX_KEY, String(_sfxVol)); } catch {}
}

export function setMusicVolume(v: number): void {
  _musicVol = Math.max(0, Math.min(100, v));
  try { localStorage.setItem(MUSIC_KEY, String(_musicVol)); } catch {}
  // Update live music element volume.
  if (_currentAudio) {
    _currentAudio.volume = effectiveMusicGain();
  }
}

/** Real gain for music: displayed volume × 0.5 (music is always half-loudness). */
function effectiveMusicGain(): number {
  return (_musicVol / 100) * 0.5;
}

/** Real gain multiplier for SFX (0–1). Used by sfx.ts. */
export function sfxGain(): number {
  return _sfxVol / 100;
}

// ---------- Music player ----------

type MusicCategory = 'menu' | 'gameplay' | 'none';

const TRACKS: Record<Exclude<MusicCategory, 'none'>, string[]> = {
  menu: ['/menu1.mp3', '/menu2.mp3'],
  gameplay: ['/gameplay1.mp3', '/gameplay2.mp3'],
};

let _currentAudio: HTMLAudioElement | null = null;
let _currentCategory: MusicCategory = 'none';
let _userInteracted = false;

/** Must be called once from a user gesture (click) to unlock audio. */
export function unlockAudio(): void {
  _userInteracted = true;
}

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Switch music to a category. If already playing that category, does nothing.
 * Pass 'none' to stop music.
 */
export function setMusicCategory(cat: MusicCategory): void {
  if (cat === _currentCategory) return;
  _currentCategory = cat;

  if (cat === 'none') {
    fadeOut(_currentAudio);
    _currentAudio = null;
    return;
  }

  if (!_userInteracted) return;
  if (_musicVol === 0) return;

  const src = pickRandom(TRACKS[cat]);
  const audio = new Audio(src);
  audio.loop = true;
  audio.volume = 0;

  // Fade out old
  fadeOut(_currentAudio);

  // Fade in new
  _currentAudio = audio;
  audio.play().then(() => {
    fadeIn(audio, effectiveMusicGain());
  }).catch(() => {
    // Autoplay blocked — will retry on next user interaction.
  });
}

function fadeIn(audio: HTMLAudioElement, targetVol: number): void {
  const start = performance.now();
  const tick = () => {
    if (audio !== _currentAudio) return; // superseded
    const elapsed = performance.now() - start;
    const t = Math.min(1, elapsed / CROSSFADE_MS);
    audio.volume = targetVol * t;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function fadeOut(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  const startVol = audio.volume;
  const start = performance.now();
  const ref = audio; // capture
  const tick = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(1, elapsed / CROSSFADE_MS);
    ref.volume = startVol * (1 - t);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      ref.pause();
      ref.src = '';
    }
  };
  requestAnimationFrame(tick);
}

/** When the next track ends, pick another from the same category. */
export function enableAutoSwitch(): void {
  // Not needed — we use loop=true, so the same track repeats.
  // If you want track rotation, set loop=false and listen for 'ended'.
}
