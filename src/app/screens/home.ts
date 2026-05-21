import type { Screen } from '../router';
import { navigate } from '../router';

export const HomeScreen: Screen = {
  name: 'home',
  mount(root) {
    root.innerHTML = `
      <div class="home-screen">
        <h1>Pet Painters</h1>
        <p class="home-tagline">Drop pets. They walk. They paint. Most paint wins.</p>
        <div class="home-buttons">
          <button class="big-btn" id="btn-sandbox">Sandbox <span class="btn-sub">(local hot-seat)</span></button>
          <button class="big-btn" id="btn-online">Online Play <span class="btn-sub">(sign in to play with a friend)</span></button>
          <button class="big-btn" id="btn-settings">Settings</button>
        </div>
      </div>
    `;
    root.querySelector('#btn-sandbox')!.addEventListener('click', () => navigate('sandbox'));
    root.querySelector('#btn-online')!.addEventListener('click', () => navigate('sign-in'));
    root.querySelector('#btn-settings')!.addEventListener('click', () => navigate('settings'));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') navigate('sandbox');
      else if (e.key === '2') navigate('sign-in');
      else if (e.key === '3') navigate('settings');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  },
};
