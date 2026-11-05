import { supabase } from './supabase.js';

export async function listCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, icon')
    .order('name', { ascending: true });
  return { data: data || [], error };
}
