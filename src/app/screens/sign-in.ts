import type { Screen } from '../router';
import { navigate } from '../router';
import { signInWithGoogle, signInAsGuest, getCurrentUser } from '../../online/auth';
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
        <p>Sign in with Google to create and join rooms, or join as a guest.</p>
        <button class="big-btn google-btn" id="btn-google">
          <span class="g-icon">G</span> Sign in with Google
        </button>
        <div class="sign-in-divider"><span>or</span></div>
        <button class="big-btn guest-btn" id="btn-guest">Join as Guest</button>
        <p class="guest-note">Guests can join rooms but not create them.</p>
        <div id="sign-in-err"></div>
        <button class="back-btn" id="btn-back">← Home</button>
      </div>
    `;
    function showErr(msg: string) {
      const el = root.querySelector('#sign-in-err')!;
      el.innerHTML = `<p style="color:#f88">${msg}</p>`;
    }
    root.querySelector('#btn-google')!.addEventListener('click', () =>
      signInWithGoogle().catch((e) => showErr((e as Error).message)),
    );
    root.querySelector('#btn-guest')!.addEventListener('click', async () => {
      try {
        await signInAsGuest();
        navigate('lobby');
      } catch (e) { showErr((e as Error).message); }
    });
    root.querySelector('#btn-back')!.addEventListener('click', () => navigate('home'));
  },
};
