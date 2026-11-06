import { supabase } from './supabase.js';

export async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, bio, avatar_path, created_at')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function listUserRoles() {
  const { data, error } = await supabase.from('user_roles').select('user_id, role');
  return { data: data || [], error };
}

export async function grantRole(userId, role) {
  const { data, error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role })
    .select();
  return { data, error };
}

export async function revokeRole(userId, role) {
  const { data, error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role', role)
    .select();
  if (error) return { data: null, error };
  if (!data || data.length === 0) {
    return { data: null, error: new Error('Role not found or you do not have permission to change it.') };
  }
  return { data: true, error: null };
}

export async function listAllRecipes({ search, limit = 100 } = {}) {
  let query = supabase
    .from('recipes')
    .select(
      'id, title, is_featured, created_at, category_id, ' +
        'category:categories(id,name,icon), ' +
        'author:profiles!recipes_author_id_fkey(id,display_name)'
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  const term = String(search || '')
    .replace(/[,()%*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (term) {
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }
  const { data, error } = await query;
  return { data: data || [], error };
}

export async function setRecipeFeatured(id, isFeatured) {
  const { data, error } = await supabase
    .from('recipes')
    .update({ is_featured: isFeatured })
    .eq('id', id)
    .select('id, is_featured');
  if (error) return { data: null, error };
  if (!data || data.length === 0) {
    return { data: null, error: new Error('Recipe not found or you do not have permission to edit it.') };
  }
  return { data: data[0], error: null };
}
