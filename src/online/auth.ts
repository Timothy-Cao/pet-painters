import { getSupabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  // Preserve any ?room=CODE param through the OAuth redirect so deep links survive sign-in.
  const params = new URLSearchParams(window.location.search);
  params.set('screen', 'lobby');
  const redirectTo = `${window.location.origin}/?${params.toString()}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
}

function randomGuestName(): string {
  const adj = ['Swift', 'Brave', 'Clever', 'Lucky', 'Sneaky', 'Mighty', 'Fuzzy', 'Jolly', 'Zippy', 'Plucky'];
  const animal = ['Panda', 'Fox', 'Otter', 'Koala', 'Parrot', 'Penguin', 'Badger', 'Falcon', 'Moose', 'Gecko'];
  const a = adj[Math.floor(Math.random() * adj.length)];
  const b = animal[Math.floor(Math.random() * animal.length)];
  const n = Math.floor(Math.random() * 100);
  return `${a}${b}${n}`;
}

export async function signInAsGuest(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  await supabase.auth.signOut();
}

/** Use getUser() (server-validated) instead of getSession() (cached local storage). */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
}

/**
 * Upsert profile for current user. For guests, only sets display_name on first
 * creation (COALESCE keeps the existing name on subsequent calls so guests don't
 * get a new random name every page load).
 */
export async function ensureProfile(): Promise<Profile> {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('not signed in');
  const isAnonymous = user.is_anonymous ?? !user.email;
  const displayName = isAnonymous
    ? (user.user_metadata?.display_name ?? randomGuestName())
    : (user.user_metadata?.full_name ?? null);
  const email = user.email ?? `guest-${user.id.slice(0, 8)}@anonymous`;

  // Try to read existing profile first. If it exists, only update non-null fields
  // so guest display names are stable across page reloads.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  const nameToStore = existing?.display_name ?? displayName;

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email,
        display_name: nameToStore,
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

export async function isGuest(): Promise<boolean> {
  const u = await getCurrentUser();
  if (!u) return false;
  return u.is_anonymous ?? !u.email;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const supabase = getSupabase();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
