import { supabase } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { removeFiles } from './storage.js';

export const RECIPE_SELECT =
  '*, category:categories(id,name,icon), ' +
  'author:profiles!recipes_author_id_fkey(id,display_name,avatar_path), ' +
  'photos:recipe_photos(id,storage_path,is_cover,position)';

// PostgREST builds .or() filters from a raw string - strip the characters
// that could break or alter the filter syntax.
function sanitizeSearchTerm(term) {
  return String(term || '')
    .replace(/[,()%*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function listRecipes({ search, categoryId, featuredOnly, limit = 24 } = {}) {
  let query = supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .order('created_at', { ascending: false })
    .order('position', { referencedTable: 'recipe_photos', ascending: true })
    .limit(limit);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (featuredOnly) query = query.eq('is_featured', true);
  const term = sanitizeSearchTerm(search);
  if (term) {
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }
  const { data, error } = await query;
  return { data: data || [], error };
}

export async function listRecipesByAuthor(authorId, limit = 100) {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: data || [], error };
}

export async function getRecipeStats(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (uniqueIds.length === 0) return { data: new Map(), error: null };
  const { data, error } = await supabase
    .from('recipe_stats')
    .select('recipe_id, avg_rating, rating_count, comment_count')
    .in('recipe_id', uniqueIds);
  if (error) return { data: new Map(), error };
  return { data: new Map(data.map((row) => [row.recipe_id, row])), error: null };
}

export async function getRecipe(id) {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('id', id)
    .order('position', { referencedTable: 'recipe_photos', ascending: true })
    .maybeSingle();
  if (error) return { data: null, error };
  return { data, error: null };
}

export async function createRecipe(fields) {
  const user = await getCurrentUser();
  if (!user) return { data: null, error: new Error('You must be logged in to create a recipe.') };
  const payload = { ...fields };
  delete payload.author_id;
  delete payload.is_featured;
  const { data, error } = await supabase
    .from('recipes')
    .insert({ ...payload, author_id: user.id })
    .select()
    .single();
  return { data, error };
}

export async function updateRecipe(id, fields) {
  const payload = { ...fields };
  delete payload.author_id;
  delete payload.is_featured;
  const { data, error } = await supabase
    .from('recipes')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error?.code === 'PGRST116') {
    return { data: null, error: new Error('Recipe not found or you do not have permission to edit it.') };
  }
  return { data, error };
}

export async function deleteRecipe(id) {
  const { data: recipe, error: fetchError } = await supabase
    .from('recipes')
    .select('id, photos:recipe_photos(storage_path)')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) return { data: null, error: fetchError };
  if (!recipe) return { data: null, error: new Error('Recipe not found.') };

  const paths = (recipe.photos || []).map((p) => p.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: storageError } = await removeFiles('recipe-photos', paths);
    if (storageError) return { data: null, error: storageError };
  }

  const { data, error } = await supabase.from('recipes').delete().eq('id', id).select();
  if (error) return { data: null, error };
  if (!data || data.length === 0) {
    return { data: null, error: new Error('Recipe not found or you do not have permission to delete it.') };
  }
  return { data: true, error: null };
}

export async function addRecipePhoto(recipeId, storagePath, isCover = false, position = 0) {
  const { data, error } = await supabase
    .from('recipe_photos')
    .insert({ recipe_id: recipeId, storage_path: storagePath, is_cover: isCover, position })
    .select()
    .single();
  return { data, error };
}

export async function deleteRecipePhoto(photo) {
  const { error: storageError } = await removeFiles('recipe-photos', [photo.storage_path]);
  if (storageError) return { data: null, error: storageError };
  const { data, error } = await supabase
    .from('recipe_photos')
    .delete()
    .eq('id', photo.id)
    .select();
  if (error) return { data: null, error };
  if (!data || data.length === 0) {
    return { data: null, error: new Error('Photo not found or you do not have permission to delete it.') };
  }
  return { data: true, error: null };
}

export async function setCoverPhoto(recipeId, photoId) {
  const { error: unsetError } = await supabase
    .from('recipe_photos')
    .update({ is_cover: false })
    .eq('recipe_id', recipeId)
    .eq('is_cover', true);
  if (unsetError) return { data: null, error: unsetError };
  const { data, error } = await supabase
    .from('recipe_photos')
    .update({ is_cover: true })
    .eq('id', photoId)
    .eq('recipe_id', recipeId)
    .select();
  if (error) return { data: null, error };
  if (!data || data.length === 0) return { data: null, error: new Error('Photo not found.') };
  return { data: data[0], error: null };
}
