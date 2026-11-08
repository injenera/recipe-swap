import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        register: resolve(__dirname, 'register.html'),
        'forgot-password': resolve(__dirname, 'forgot-password.html'),
        'update-password': resolve(__dirname, 'update-password.html'),
        recipe: resolve(__dirname, 'recipe.html'),
        'recipe-edit': resolve(__dirname, 'recipe-edit.html'),
        profile: resolve(__dirname, 'profile.html'),
        'meal-plan': resolve(__dirname, 'meal-plan.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
