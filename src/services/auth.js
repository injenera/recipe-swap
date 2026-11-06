import { supabase } from './supabase.js';

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, bio, avatar_path, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();
  return { data, error };
}

export async function updateProfile(userId, fields) {
  const payload = {};
  for (const key of ['display_name', 'bio', 'avatar_path']) {
    if (key in fields) payload[key] = fields[key];
  }
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('id, display_name, bio, avatar_path, created_at, updated_at')
    .single();
  return { data, error };
}

export async function register(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  return { data, error };
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export function onAuthChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null, event);
  });
  return subscription;
}

export async function isAdmin() {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}
