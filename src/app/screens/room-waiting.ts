import type { Screen } from '../router';
import { navigate } from '../router';
import { getRoom, leaveRoom, subscribeToRoom, type Room } from '../../online/rooms';

export const RoomWaitingScreen: Screen = {
  name: 'room-waiting',
  mount(root, params) {
    const roomId = params?.room;
    if (!roomId) { navigate('lobby'); return; }

    root.innerHTML = `
      <div class="room-waiting-screen">
        <h2>Waiting for opponent…</h2>
        <p class="room-code-label">Share this code:</p>
        <div class="room-code" id="room-code">------</div>
        <button class="link-btn" id="btn-copy">Copy invite link</button>
        <p id="copy-feedback" class="copy-feedback"></p>
        <button class="big-btn" id="btn-leave">Leave room</button>
      </div>
    `;

    let unmounted = false;
    let unsub: (() => void) | null = null;

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

    root.querySelector('#btn-copy')!.addEventListener('click', async () => {
      const code = (root.querySelector('#room-code') as HTMLElement).textContent;
      const url = `${window.location.origin}/?room=${code}`;
      try {
        await navigator.clipboard.writeText(url);
        (root.querySelector('#copy-feedback') as HTMLElement).textContent = 'Copied!';
      } catch {
        (root.querySelector('#copy-feedback') as HTMLElement).textContent = url;
      }
      setTimeout(() => {
        if (unmounted) return;
        const fb = root.querySelector('#copy-feedback') as HTMLElement | null;
        if (fb) fb.textContent = '';
      }, 2000);
    });

    root.querySelector('#btn-leave')!.addEventListener('click', async () => {
      await leaveRoom(roomId);
      navigate('lobby');
    });

    return () => {
      unmounted = true;
      if (unsub) unsub();
    };
  },
};
