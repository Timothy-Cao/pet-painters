import type { Screen } from '../router';
import { navigate } from '../router';
import { getRoom, leaveRoom, subscribeToRoom, type Room } from '../../online/rooms';
import { ensureProfile } from '../../online/auth';

export const RoomWaitingScreen: Screen = {
  name: 'room-waiting',
  mount(root, params) {
    const roomId = params?.room;
    if (!roomId) { navigate('lobby'); return; }

    root.innerHTML = `
      <div class="room-waiting-screen">
        <h2>Waiting for opponent…</h2>
        <p id="host-info" class="room-host-info"></p>
        <p class="room-code-label">Share this code with a friend:</p>
        <div class="room-code" id="room-code">------</div>
        <div class="room-waiting-actions">
          <button class="big-btn" id="btn-copy-code">📋 Copy Code</button>
          <button class="big-btn" id="btn-copy-link">🔗 Copy Link</button>
        </div>
        <p id="copy-feedback" class="copy-feedback"></p>
        <div class="room-waiting-spinner">
          <div class="spinner-dots"><span></span><span></span><span></span></div>
        </div>
        <button class="back-btn" id="btn-leave">← Leave room</button>
      </div>
    `;

    let unmounted = false;
    let unsub: (() => void) | null = null;

    // Show host display name
    ensureProfile().then((profile) => {
      if (unmounted) return;
      const el = root.querySelector('#host-info') as HTMLElement;
      el.textContent = `Hosted by ${profile.display_name || profile.email}`;
    }).catch(() => {});

    function showFeedback(msg: string) {
      const fb = root.querySelector('#copy-feedback') as HTMLElement;
      fb.textContent = msg;
      setTimeout(() => {
        if (!unmounted && fb) fb.textContent = '';
      }, 2500);
    }

    getRoom(roomId).then((room) => {
      if (!room || unmounted) return;
      (root.querySelector('#room-code') as HTMLElement).textContent = room.code;
      if (room.guest_id) {
        navigate('online-match', { room: roomId });
        return;
      }
      unsub = subscribeToRoom(roomId, (r: Room) => {
        if (r.guest_id) navigate('online-match', { room: roomId });
      });
    });

    // Copy just the code
    root.querySelector('#btn-copy-code')!.addEventListener('click', async () => {
      const code = (root.querySelector('#room-code') as HTMLElement).textContent ?? '';
      try {
        await navigator.clipboard.writeText(code);
        showFeedback('Code copied!');
      } catch {
        showFeedback(code);
      }
    });

    // Copy full invite link
    root.querySelector('#btn-copy-link')!.addEventListener('click', async () => {
      const code = (root.querySelector('#room-code') as HTMLElement).textContent ?? '';
      const url = `${window.location.origin}/?room=${code}&screen=sign-in`;
      try {
        await navigator.clipboard.writeText(url);
        showFeedback('Link copied!');
      } catch {
        showFeedback(url);
      }
    });

    // Leave room button
    root.querySelector('#btn-leave')!.addEventListener('click', async () => {
      await leaveRoom(roomId);
      navigate('lobby');
    });

    // Clean up room on tab close
    const onBeforeUnload = () => {
      // Use sendBeacon for reliability on tab close (fetch may be cancelled).
      // Fall back to sync call via leaveRoom.
      leaveRoom(roomId).catch(() => {});
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      unmounted = true;
      if (unsub) unsub();
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  },
};
