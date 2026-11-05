import { supabase } from './supabase.js';
import { getCurrentUser } from './auth.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function uploadRecipePhoto(file, recipeId) {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { data: null, error: new Error(`"${file.name}" is not a supported image. Use JPG, PNG or WebP.`) };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { data: null, error: new Error(`"${file.name}" is larger than 5 MB.`) };
  }
  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: new Error('You must be logged in to upload photos.') };
  }
  const ext = EXT_BY_TYPE[file.type] || 'jpg';
  const path = `${user.id}/${recipeId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('recipe-photos')
    .upload(path, file, { contentType: file.type, upsert: false });
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
