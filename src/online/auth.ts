import { getSupabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/?screen=lobby' },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
}

export async function ensureProfile(): Promise<Profile> {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('not signed in');
  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email!,
        display_name: user.user_metadata?.full_name ?? null,
      },
      { onConflict: 'id' },
    );
  if (upsertError) throw upsertError;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, is_admin')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data as Profile;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const supabase = getSupabase();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
