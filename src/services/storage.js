import { supabase } from './supabase.js';
import { getCurrentUser } from './auth.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

function validateImageFile(file, maxSize, maxLabel) {
  if (!ALLOWED_TYPES.has(file.type)) {
    return `"${file.name}" is not a supported image. Use JPG, PNG or WebP.`;
  }
  if (file.size > maxSize) {
    return `"${file.name}" is larger than ${maxLabel}.`;
  }
  return null;
}

async function requireUser(message) {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: new Error(message) };
  return { user, error: null };
}

export async function uploadRecipePhoto(file, recipeId) {
  const invalid = validateImageFile(file, MAX_PHOTO_SIZE, '5 MB');
  if (invalid) return { data: null, error: new Error(invalid) };
  const { user, error: authError } = await requireUser('You must be logged in to upload photos.');
  if (authError) return { data: null, error: authError };
  const ext = EXT_BY_TYPE[file.type] || 'jpg';
  const path = `${user.id}/${recipeId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('recipe-photos')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { data: null, error };
  return { data: path, error: null };
}

export async function uploadAvatar(file) {
  const invalid = validateImageFile(file, MAX_AVATAR_SIZE, '2 MB');
  if (invalid) return { data: null, error: new Error(invalid) };
  const { user, error: authError } = await requireUser('You must be logged in to upload an avatar.');
  if (authError) return { data: null, error: authError };
  const ext = EXT_BY_TYPE[file.type] || 'jpg';
  const path = `${user.id}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { data: null, error };
  return { data: path, error: null };
}

export function getPublicUrl(bucket, path) {
  if (!path) return '';
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || '';
}

export async function removeFiles(bucket, paths) {
  const list = (paths || []).filter(Boolean);
  if (list.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.storage.from(bucket).remove(list);
  return { data, error };
}

export async function downloadFile(bucket, path, filename) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) return { data: null, error };
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || path.split('/').pop() || 'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { data: true, error: null };
}
