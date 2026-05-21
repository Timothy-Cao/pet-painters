import { getSupabase } from './supabase';
import { ensureProfile } from './auth';

export interface Room {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  status: 'waiting' | 'playing' | 'ended' | 'abandoned';
  current_round: number;
  created_at: string;
  last_activity_at: string;
}

export async function createRoom(password: string | null): Promise<Room> {
  await ensureProfile();
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('create_room', { password_plain: password || null });
  if (error) throw new Error(humanizeRpcError(error.message));
  const row = (data as Array<{ id: string; code: string }>)[0];
  const { data: roomRow, error: readErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', row.id)
    .single();
  if (readErr) throw readErr;
  return roomRow as Room;
}

export async function joinRoom(code: string, password: string | null): Promise<Room> {
  await ensureProfile();
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('join_room', {
    room_code: code.toUpperCase(),
    password_plain: password || null,
  });
  if (error) throw new Error(humanizeRpcError(error.message));
  const { data: roomRow, error: readErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', data as string)
    .single();
  if (readErr) throw readErr;
  return roomRow as Room;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: room } = await supabase
    .from('rooms')
    .select('host_id, guest_id, status')
    .eq('id', roomId)
    .single();
  if (!room) return;
  const profile = await ensureProfile();
  if (room.host_id === profile.id && room.status === 'waiting') {
    await supabase.from('rooms').update({ status: 'abandoned' }).eq('id', roomId);
  } else if (room.guest_id === profile.id) {
    await supabase.from('rooms').update({ guest_id: null }).eq('id', roomId);
  } else {
    await supabase.from('rooms').update({ status: 'abandoned' }).eq('id', roomId);
  }
}

export async function listAdminRooms(): Promise<Room[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .in('status', ['waiting', 'playing'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Room[];
}

export async function adminDeleteRoom(roomId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('rooms').delete().eq('id', roomId);
  if (error) throw error;
}

export async function getRoom(roomId: string): Promise<Room | null> {
  const supabase = getSupabase();
  const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  return data as Room | null;
}

import type { RealtimeChannel } from '@supabase/supabase-js';

export function subscribeToRoom(roomId: string, onChange: (room: Room) => void): () => void {
  const supabase = getSupabase();
  const channel: RealtimeChannel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => onChange(payload.new as Room),
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

function humanizeRpcError(msg: string): string {
  if (msg.includes('room cap reached')) return 'The server is full right now — try again later.';
  if (msg.includes('rate limit exceeded')) return 'Slow down — you can only create 3 rooms per minute.';
  if (msg.includes('no such room')) return "That room code doesn't exist.";
  if (msg.includes('room not joinable')) return 'That room is no longer accepting players.';
  if (msg.includes('cannot join your own room')) return "You can't join a room you created.";
  if (msg.includes('room full')) return 'That room is full.';
  if (msg.includes('wrong password')) return 'Wrong password.';
  return msg;
}
