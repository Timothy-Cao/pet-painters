import type { Screen } from '../router';
import { navigate } from '../router';
import { signInWithGoogle, getCurrentUser } from '../../online/auth';
import { isSupabaseConfigured } from '../../config/env';

export const SignInScreen: Screen = {
  name: 'sign-in',
  mount(root) {
    if (!isSupabaseConfigured()) {
      root.innerHTML = `
        <div class="sign-in-screen">
          <h2>Online play unavailable</h2>
          <p>Supabase is not configured for this deployment. The site owner needs to set up the backend (see <code>docs/superpowers/handoff/</code>).</p>
          <button class="big-btn" id="btn-home">Back to home</button>
        </div>
      `;
      root.querySelector('#btn-home')!.addEventListener('click', () => navigate('home'));
      return;
    }
    // Already signed in → skip to lobby.
    getCurrentUser().then((user) => {
      if (user) navigate('lobby');
    });
    root.innerHTML = `
      <div class="sign-in-screen">
        <h2>Sign in to play online</h2>
        <p>You need a Google account to create or join rooms.</p>
        <button class="big-btn google-btn" id="btn-google">
          <span class="g-icon">G</span> Sign in with Google
        </button>
        <button class="back-btn" id="btn-back">← Home</button>
      </div>
    `;
    root.querySelector('#btn-google')!.addEventListener('click', () => signInWithGoogle().catch((e) => {
      const errEl = document.createElement('p');
      errEl.style.color = '#f88';
      errEl.textContent = (e as Error).message;
      root.querySelector('.sign-in-screen')!.appendChild(errEl);
    }));
    root.querySelector('#btn-back')!.addEventListener('click', () => navigate('home'));
  },
};
