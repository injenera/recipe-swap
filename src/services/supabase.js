import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
      'in a .env file (see .env.example), then restart the dev server.'
  );
}

// Placeholder values keep createClient from throwing when env vars are missing;
// the console.error above explains how to configure the real credentials.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export async function getCommunityStats() {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/community-stats`);
    if (!res.ok) return { data: null, error: new Error(`Stats request failed (${res.status}).`) };
    return { data: await res.json(), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}
