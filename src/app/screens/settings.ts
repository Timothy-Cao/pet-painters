import type { Screen } from '../router';
import { navigate } from '../router';
import { applyPalette, getPaletteName, type PaletteName } from '../../render/palette';
import { getCurrentUser, signOut } from '../../online/auth';
import { isSupabaseConfigured } from '../../config/env';

export const SettingsScreen: Screen = {
  name: 'settings',
  mount(root) {
    const currentPalette = getPaletteName();
    root.innerHTML = `
      <div class="settings-screen">
        <h2>Settings</h2>
        <label>
          Color palette
          <select id="palette-select">
            <option value="default" ${currentPalette === 'default' ? 'selected' : ''}>Default (red/blue)</option>
            <option value="cb-blue-orange" ${currentPalette === 'cb-blue-orange' ? 'selected' : ''}>Colorblind (blue/orange)</option>
          </select>
        </label>
        <div id="auth-section"></div>
        <button class="back-btn" id="btn-back">← Home</button>
      </div>
    `;
    root.querySelector('#palette-select')!.addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value as PaletteName;
      applyPalette(v);
    });
    if (isSupabaseConfigured()) {
      getCurrentUser().then((user) => {
        const sec = root.querySelector('#auth-section') as HTMLElement;
        if (user) {
          const p = document.createElement('p');
          p.textContent = `Signed in as ${user.email ?? 'Guest'}`;
          const btn = document.createElement('button');
          btn.className = 'big-btn';
          btn.textContent = 'Sign out';
          btn.addEventListener('click', async () => {
            await signOut();
            navigate('home');
          });
          sec.appendChild(p);
          sec.appendChild(btn);
        }
      }).catch(() => { /* ignore */ });
    }
    root.querySelector('#btn-back')!.addEventListener('click', () => navigate('home'));
  },
};
