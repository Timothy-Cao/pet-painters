import type { Screen } from '../router';
import { navigate } from '../router';
import { createRoom, joinRoom, listAdminRooms, adminDeleteRoom } from '../../online/rooms';
import { ensureProfile, signOut, isGuest } from '../../online/auth';

export const LobbyScreen: Screen = {
  name: 'lobby',
  mount(root) {
    root.innerHTML = `
      <div class="lobby-screen">
        <div class="lobby-header">
          <span id="lobby-user">Loading…</span>
          <button class="link-btn" id="btn-signout">Sign out</button>
        </div>
        <h2>Online Play</h2>
        <div class="lobby-actions">
          <div class="action-card" id="create-card">
            <h3>Create Room</h3>
            <input type="password" id="create-pw" placeholder="Optional password" />
            <button class="big-btn" id="btn-create">Create</button>
          </div>
          <div class="action-card">
            <h3>Join Room</h3>
            <input type="text" id="join-code" placeholder="6-letter code" maxlength="6" autocomplete="off" />
            <input type="password" id="join-pw" placeholder="Password (if required)" />
            <button class="big-btn" id="btn-join">Join</button>
          </div>
        </div>
        <div id="admin-panel" style="display: none;">
          <h3>Admin: active rooms</h3>
          <ul id="admin-rooms"></ul>
        </div>
        <div id="lobby-err" class="lobby-err"></div>
        <button class="back-btn" id="btn-back">← Home</button>
      </div>
    `;

    const errEl = root.querySelector('#lobby-err') as HTMLDivElement;
    function showErr(msg: string) { errEl.textContent = msg; }

    // Pre-fill join code from ?room=XYZ query param if present
    const urlParams = new URLSearchParams(window.location.search);
    const prefilledCode = urlParams.get('room');
    if (prefilledCode) {
      (root.querySelector('#join-code') as HTMLInputElement).value = prefilledCode.toUpperCase();
      (root.querySelector('#join-pw') as HTMLInputElement).focus();
    }

    ensureProfile()
      .then(async (profile) => {
        const guest = await isGuest();
        const userEl = root.querySelector('#lobby-user') as HTMLElement;
        userEl.textContent =
          `Playing as ${profile.display_name || profile.email}${profile.is_admin ? ' (admin)' : ''}${guest ? ' (guest)' : ''}`;
        if (guest) {
          const createCard = root.querySelector('#create-card') as HTMLElement;
          if (createCard) createCard.style.display = 'none';
        }
        if (profile.is_admin) {
          (root.querySelector('#admin-panel') as HTMLElement).style.display = 'block';
          refreshAdminRooms();
        }
      })
      .catch((e) => {
        const msg = (e as Error).message || '';
        if (msg.includes('not signed in')) {
          navigate('sign-in');
        } else {
          console.error('ensureProfile failed:', e);
          (root.querySelector('#lobby-user') as HTMLElement).textContent = 'Signed in';
          showErr('Profile sync failed: ' + msg);
        }
      });

    const createBtn = root.querySelector('#btn-create') as HTMLButtonElement;
    const joinBtn = root.querySelector('#btn-join') as HTMLButtonElement;

    createBtn.addEventListener('click', async () => {
      showErr('');
      createBtn.disabled = true;
      createBtn.textContent = 'Creating…';
      try {
        const pw = (root.querySelector('#create-pw') as HTMLInputElement).value;
        const room = await createRoom(pw || null);
        navigate('room-waiting', { room: room.id });
      } catch (e) {
        showErr((e as Error).message);
        createBtn.disabled = false;
        createBtn.textContent = 'Create';
      }
    });

    joinBtn.addEventListener('click', async () => {
      showErr('');
      const code = (root.querySelector('#join-code') as HTMLInputElement).value.trim();
      if (!code) { showErr('Enter a 6-letter room code.'); return; }
      joinBtn.disabled = true;
      joinBtn.textContent = 'Joining…';
      try {
        const pw = (root.querySelector('#join-pw') as HTMLInputElement).value;
        const room = await joinRoom(code, pw || null);
        navigate('online-match', { room: room.id });
      } catch (e) {
        showErr((e as Error).message);
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join';
      }
    });

    root.querySelector('#btn-back')!.addEventListener('click', () => navigate('home'));
    root.querySelector('#btn-signout')!.addEventListener('click', async () => {
      await signOut();
      navigate('home');
    });

    async function refreshAdminRooms() {
      try {
        const rooms = await listAdminRooms();
        const ul = root.querySelector('#admin-rooms') as HTMLUListElement;
        ul.innerHTML = '';
        if (rooms.length === 0) {
          const li = document.createElement('li');
          li.textContent = 'No active rooms.';
          li.style.color = 'var(--text-dim, #888)';
          ul.appendChild(li);
          return;
        }
        for (const r of rooms) {
          const li = document.createElement('li');
          const code = document.createElement('code');
          code.textContent = r.code;
          li.appendChild(code);
          li.appendChild(document.createTextNode(` · ${r.status} · created ${new Date(r.created_at).toLocaleTimeString()} `));
          const btn = document.createElement('button');
          btn.className = 'link-btn';
          btn.textContent = 'Delete';
          btn.addEventListener('click', async () => {
            if (!confirm('Delete this room?')) return;
            await adminDeleteRoom(r.id);
            refreshAdminRooms();
          });
          li.appendChild(btn);
          ul.appendChild(li);
        }
      } catch (e) {
        showErr('Failed to list rooms: ' + (e as Error).message);
      }
    }
  },
};
