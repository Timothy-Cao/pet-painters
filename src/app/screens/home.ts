import type { Screen } from '../router';
import { navigate } from '../router';
import { showTutorial } from '../../ui/tutorial';

export const HomeScreen: Screen = {
  name: 'home',
  mount(root) {
    root.innerHTML = `
      <div class="home-screen">
        <h1>Pet Painters</h1>
        <p class="home-tagline">Deploy emoji pets on a 20×20 board. They walk, paint tiles, and fight. Control 60% to win!</p>
        <div class="home-showcase" aria-hidden="true">
          <span class="showcase-pet" style="--delay:0s">🐭</span>
          <span class="showcase-pet" style="--delay:0.3s">🐱</span>
          <span class="showcase-pet" style="--delay:0.6s">🦁</span>
          <span class="showcase-pet" style="--delay:0.9s">🐉</span>
          <span class="showcase-pet" style="--delay:1.2s">🐘</span>
          <span class="showcase-pet" style="--delay:1.5s">🦅</span>
        </div>
        <div class="home-buttons">
          <button class="big-btn big-btn-primary" id="btn-ai">Play vs AI <span class="btn-sub">(solo — challenge the computer)</span></button>
          <button class="big-btn" id="btn-sandbox">Local Play <span class="btn-sub">(2 players, same screen)</span></button>
          <button class="big-btn" id="btn-online">Online Play <span class="btn-sub">(play with a friend online)</span></button>
        </div>
        <button class="how-to-play-btn" id="btn-how-to-play">? How to Play</button>
        <div class="home-footer">Pet Painters v0.1 · Made with 🎨</div>
      </div>
    `;
    root.querySelector('#btn-ai')!.addEventListener('click', () => navigate('sandbox', { mode: 'ai' }));
    root.querySelector('#btn-sandbox')!.addEventListener('click', () => navigate('sandbox'));
    root.querySelector('#btn-online')!.addEventListener('click', () => navigate('sign-in'));
    root.querySelector('#btn-how-to-play')!.addEventListener('click', () => {
      showTutorial(root);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') navigate('sandbox');
      else if (e.key === '2') navigate('sign-in');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  },
};
