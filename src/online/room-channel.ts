// Realtime room channel for ephemeral, non-game state: opponent presence
// (online or not) and chat messages. Distinct from the submissions table
// (which is persistent / authoritative) — this channel carries pure UX
// signals.

import { getSupabase } from './supabase';
import type { PlayerId } from '../types/game';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
  fromSlot: PlayerId;
  text: string;
  /** Wallclock millis from the sender. Used only for client-side ordering / display. */
  at: number;
}

export interface RoomChannel {
  /** Broadcast a chat message. Sender also receives it locally so it appears immediately. */
  sendChat(text: string): void;
  /** Cleanly leave the channel. Call from screen unmount. */
  detach(): void;
}

export interface RoomChannelHandlers {
  mySlot: PlayerId;
  /** Called whenever the opponent's presence changes (joined / left). */
  onOpponentPresence?: (present: boolean) => void;
  /** Called for every chat message we should display (including our own). */
  onChat?: (msg: ChatMessage) => void;
}

export function joinRoomChannel(roomId: string, handlers: RoomChannelHandlers): RoomChannel {
  const supabase = getSupabase();
  const channel: RealtimeChannel = supabase.channel(`room:${roomId}`, {
    config: { presence: { key: handlers.mySlot } },
  });

  const opponentSlot: PlayerId = handlers.mySlot === 'A' ? 'B' : 'A';

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState() as Record<string, unknown[]>;
    const presentArr = state[opponentSlot];
    handlers.onOpponentPresence?.(Array.isArray(presentArr) && presentArr.length > 0);
  });

  channel.on('broadcast', { event: 'chat' }, ({ payload }: { payload: ChatMessage }) => {
    // Sender already echoed their own message locally; skip the round-trip copy.
    if (payload && payload.fromSlot !== handlers.mySlot) {
      handlers.onChat?.(payload);
    }
  });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      void channel.track({ slot: handlers.mySlot });
    }
  });

  return {
    sendChat(text: string): void {
      const msg: ChatMessage = { fromSlot: handlers.mySlot, text, at: Date.now() };
      channel.send({ type: 'broadcast', event: 'chat', payload: msg });
      handlers.onChat?.(msg);
    },
    detach(): void {
      void channel.unsubscribe();
      supabase.removeChannel(channel);
    },
  };
}
