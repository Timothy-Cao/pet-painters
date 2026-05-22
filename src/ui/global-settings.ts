/**
 * global-settings.ts — Always-visible settings gear that opens a floating panel
 * with SFX volume, Music volume, and colorblind toggle.
 *
 * Injected once at app init. Persists across screen transitions.
 */

import { getSfxVolume, getMusicVolume, setSfxVolume, setMusicVolume, loadAudioPrefs, unlockAudio } from '../render/audio';
import { loadSoundPref, setSoundEnabled, isSoundEnabled } from '../render/sfx';
import { applyPalette, getPaletteName } from '../render/palette';

let _mounted = false;

export function mountGlobalSettings(): void {
  if (_mounted) return;
  _mounted = true;

  loadAudioPrefs();
  loadSoundPref();

  // If SFX volume > 0 and sound was previously enabled, keep it on.
  // Otherwise enable sound by default now that we have volume controls.
  if (getSfxVolume() > 0 && !isSoundEnabled()) {
    setSoundEnabled(true);
  }

  const btn = document.createElement('button');
  btn.className = 'global-settings-btn';
  btn.id = 'global-settings-btn';
  btn.setAttribute('aria-label', 'Settings');
  btn.textContent = '⚙';

  const panel = document.createElement('div');
  panel.className = 'global-settings-panel';
  panel.id = 'global-settings-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="gs-title">Settings</div>
    <label class="gs-row">
      <span>SFX</span>
      <input type="range" id="gs-sfx" min="0" max="100" value="${getSfxVolume()}" />
      <span class="gs-val" id="gs-sfx-val">${getSfxVolume()}%</span>
    </label>
    <label class="gs-row">
      <span>Music</span>
      <input type="range" id="gs-music" min="0" max="100" value="${getMusicVolume()}" />
      <span class="gs-val" id="gs-music-val">${getMusicVolume()}%</span>
    </label>
    <label class="gs-row gs-toggle">
      <span>Colorblind palette</span>
      <input type="checkbox" id="gs-cb" ${getPaletteName() === 'cb-blue-orange' ? 'checked' : ''} />
    </label>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // Toggle panel
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    unlockAudio();
    panel.hidden = !panel.hidden;
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target as Node) && e.target !== btn) {
      panel.hidden = true;
    }
  });

  // SFX slider
  const sfxSlider = panel.querySelector('#gs-sfx') as HTMLInputElement;
  const sfxVal = panel.querySelector('#gs-sfx-val') as HTMLElement;
  sfxSlider.addEventListener('input', () => {
    const v = parseInt(sfxSlider.value, 10);
    setSfxVolume(v);
    sfxVal.textContent = `${v}%`;
    // Enable/disable SFX based on volume.
    setSoundEnabled(v > 0);
  });

  // Music slider
  const musicSlider = panel.querySelector('#gs-music') as HTMLInputElement;
  const musicVal = panel.querySelector('#gs-music-val') as HTMLElement;
  musicSlider.addEventListener('input', () => {
    const v = parseInt(musicSlider.value, 10);
    setMusicVolume(v);
    musicVal.textContent = `${v}%`;
  });

  // Colorblind toggle
  const cbToggle = panel.querySelector('#gs-cb') as HTMLInputElement;
  cbToggle.addEventListener('change', () => {
    applyPalette(cbToggle.checked ? 'cb-blue-orange' : 'default');
  });
}
