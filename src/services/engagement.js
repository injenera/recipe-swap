import { supabase } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { RECIPE_SELECT } from './recipes.js';

const MEAL_PLAN_SELECT =
  'id, plan_date, meal_type, ' +
  'recipe:recipes(id,title,is_featured,category:categories(id,name,icon),' +
  'photos:recipe_photos(id,storage_path,is_cover,position))';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: new Error('You must be logged in to do that.') };
  return { user, error: null };
}

// --- Ratings ---------------------------------------------------------------

export async function getMyRating(recipeId) {
  const { user, error } = await requireUser();
  if (error) return { data: null, error: null };
  const { data, error: queryError } = await supabase
    .from('ratings')
    .select('stars')
    .eq('recipe_id', recipeId)
    .eq('user_id', user.id)
    .maybeSingle();
  return { data: data ? data.stars : null, error: queryError };
}

export async function setRating(recipeId, stars) {
  const { user, error } = await requireUser();
  if (error) return { data: null, error };
  const { data, error: queryError } = await supabase
    .from('ratings')
    .upsert({ recipe_id: recipeId, user_id: user.id, stars }, { onConflict: 'recipe_id,user_id' })
    .select()
    .single();
  return { data, error: queryError };
}

export async function deleteRating(recipeId) {
  const { user, error } = await requireUser();
  if (error) return { data: null, error };
  const { data, error: queryError } = await supabase
    .from('ratings')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('user_id', user.id)
    .select();
  if (queryError) return { data: null, error: queryError };
  if (!data || data.length === 0) {
    return { data: null, error: new Error('Rating not found.') };
  }
  return { data: true, error: null };
}

// --- Comments --------------------------------------------------------------

export async function listComments(recipeId) {
  const { data, error } = await supabase
    .from('comments')
    .select(
      'id, recipe_id, author_id, body, created_at, updated_at, ' +
        'author:profiles!comments_author_id_fkey(id,display_name,avatar_path)'
    )
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: true });
  if (error?.code === 'PGRST116') return { data: [], error: null };
  return { data: data || [], error };
}

export async function addComment(recipeId, body) {
  const { user, error } = await requireUser();
  if (error) return { data: null, error };
  const { data, error: queryError } = await supabase
    .from('comments')
    .insert({ recipe_id: recipeId, author_id: user.id, body: body.trim() })
    .select()
    .single();
  return { data, error: queryError };
}

export async function updateComment(id, body) {
  const { data, error } = await supabase
    .from('comments')
    .update({ body: body.trim() })
    .eq('id', id)
    .select();
  if (error) return { data: null, error };
  if (!data || data.length === 0) {
    return { data: null, error: new Error('Comment not found or you do not have permission to edit it.') };
  }
  return { data: data[0], error: null };
}

export async function deleteComment(id) {
  const { data, error } = await supabase.from('comments').delete().eq('id', id).select();
  if (error) return { data: null, error };
  if (!data || data.length === 0) {
    return {
      data: null,
      error: new Error('Comment not found or you do not have permission to delete it.'),
    };
  }
  return { data: true, error: null };
}

// --- Favorites -------------------------------------------------------------

export async function getFavoriteIds(recipeIds) {
  const { user, error } = await requireUser();
  if (error) return { data: new Set(), error: null };
  const ids = (recipeIds || []).filter(Boolean);
  if (!ids.length) return { data: new Set(), error: null };
  const { data, error: queryError } = await supabase
    .from('favorites')
    .select('recipe_id')
    .eq('user_id', user.id)
    .in('recipe_id', ids);
  if (queryError) return { data: new Set(), error: queryError };
  return { data: new Set((data || []).map((row) => row.recipe_id)), error: null };
}

export async function addFavorite(recipeId) {
  const { user, error } = await requireUser();
  if (error) return { data: null, error };
  // favorites has no UPDATE grant, so a plain insert is used; a duplicate
  // key means the recipe is already saved, which is the desired end state.
  const { data, error: queryError } = await supabase
    .from('favorites')
    .insert({ user_id: user.id, recipe_id: recipeId })
    .select();
  if (queryError?.code === '23505') return { data: true, error: null };
  return { data, error: queryError };
}

export async function removeFavorite(recipeId) {
  const { user, error } = await requireUser();
  if (error) return { data: null, error };
  const { data, error: queryError } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('recipe_id', recipeId)
    .select();
  if (queryError) return { data: null, error: queryError };
  if (!data || data.length === 0) {
    return { data: null, error: new Error('Favorite not found.') };
  }
  return { data: true, error: null };
}

export async function listFavorites() {
  const { user, error } = await requireUser();
  if (error) return { data: [], error };
  const { data, error: queryError } = await supabase
    .from('favorites')
    .select(`recipe_id, created_at, recipe:recipes(${RECIPE_SELECT})`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (queryError) return { data: [], error: queryError };
  return {
    data: (data || []).map((row) => ({ ...row.recipe, favorited_at: row.created_at })).filter((r) => r && r.id),
    error: null,
  };
}

// --- Meal plan -------------------------------------------------------------

export async function listMealPlan(startDateISO, endDateISO) {
  const { user, error } = await requireUser();
  if (error) return { data: [], error };
  let query = supabase
    .from('meal_plan_entries')
    .select(MEAL_PLAN_SELECT)
    .eq('user_id', user.id)
    .order('plan_date', { ascending: true })
    .order('meal_type', { ascending: true });
  if (startDateISO) query = query.gte('plan_date', startDateISO);
  if (endDateISO) query = query.lte('plan_date', endDateISO);
  const { data, error: queryError } = await query;
  return { data: data || [], error: queryError };
}

export async function addMealPlanEntry(recipeId, dateISO, mealType) {
  const { user, error } = await requireUser();
  if (error) return { data: null, error };
  const { data, error: queryError } = await supabase
    .from('meal_plan_entries')
    .insert({ user_id: user.id, recipe_id: recipeId, plan_date: dateISO, meal_type: mealType })
    .select()
    .single();
  if (queryError?.code === '23505') {
    return { data: null, error: new Error('That recipe is already planned for this meal.') };
  }
  return { data, error: queryError };
}

export async function removeMealPlanEntry(id) {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .delete()
    .eq('id', id)
    .select();
  if (error) return { data: null, error };
  if (!data || data.length === 0) {
    return { data: null, error: new Error('Meal plan entry not found.') };
  }
  return { data: true, error: null };
}

export async function moveMealPlanEntry(id, dateISO, mealType) {
  const { data, error } = await supabase
    .from('meal_plan_entries')
    .update({ plan_date: dateISO, meal_type: mealType })
    .eq('id', id)
    .select();
  if (error?.code === '23505') {
    return { data: null, error: new Error('That slot already has this recipe.') };
  }
  if (error) return { data: null, error };
  if (!data || data.length === 0) {
    return { data: null, error: new Error('Meal plan entry not found.') };
  }
  return { data: data[0], error: null };
}

