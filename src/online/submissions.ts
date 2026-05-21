import { getSupabase } from './supabase';
import type { Direction, Vec2 } from '../types/game';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface DeploymentDTO {
  defId: string;
  anchor: Vec2;
  facing: Direction;
}

export interface RoundSubmission {
  id: string;
  room_id: string;
  round: number;
  player_slot: 'A' | 'B';
  user_id: string;
  deployments: DeploymentDTO[];
  submitted_at: string;
}

export async function submitRound(
  roomId: string,
  round: number,
  slot: 'A' | 'B',
  deployments: DeploymentDTO[],
): Promise<void> {
  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('not signed in');
  const { error } = await supabase.from('round_submissions').insert({
    room_id: roomId,
    round,
    player_slot: slot,
    user_id: userId,
    deployments,
  });
  if (error) throw error;
}

export async function fetchSubmissions(roomId: string, round: number): Promise<RoundSubmission[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('round_submissions')
    .select('*')
    .eq('room_id', roomId)
    .eq('round', round);
  if (error) throw error;
  return (data ?? []) as RoundSubmission[];
}

export function subscribeToSubmissions(
  roomId: string,
  onInsert: (sub: RoundSubmission) => void,
): () => void {
  const supabase = getSupabase();
  const channel: RealtimeChannel = supabase
    .channel(`subs:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'round_submissions', filter: `room_id=eq.${roomId}` },
      (payload) => onInsert(payload.new as RoundSubmission),
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
