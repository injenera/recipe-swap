import { getCurrentUser, isAdmin } from '../services/auth.js';

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    const target = window.location.pathname + window.location.search;
    window.location.replace(`/login.html?redirect=${encodeURIComponent(target)}`);
    return null;
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return null;
  if (!(await isAdmin())) {
    window.location.replace('/index.html');
    return null;
  }
  return user;
}
