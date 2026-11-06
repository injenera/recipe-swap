import { supabase } from './supabase.js';

export async function listCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, icon')
    .order('name', { ascending: true });
  return { data: data || [], error };
}

export async function createCategory(name, icon = 'bi-bookmark') {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: name.trim(), icon })
    .select('id, name, icon')
    .single();
  return { data, error };
}

export async function updateCategory(id, fields) {
  const payload = {};
  if (fields.name != null) payload.name = fields.name.trim();
  if (fields.icon != null) payload.icon = fields.icon;
  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select('id, name, icon')
    .single();
  if (error?.code === 'PGRST116') {
    return { data: null, error: new Error('Category not found or you do not have permission to edit it.') };
  }
  return { data, error };
}

export async function deleteCategory(id) {
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) return { data: null, error };
  if (!data || data.length === 0) {
    return { data: null, error: new Error('Category not found or you do not have permission to delete it.') };
  }
  return { data: true, error: null };
}
