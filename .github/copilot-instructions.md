# Copilot Instructions - Recipe Swap

## App context

Recipe Swap is a student capstone project: a community recipe-sharing app.

- Users post recipes with photos, rate and comment on recipes, and favorite them.
- Users build a weekly meal plan from saved recipes.
- Admins manage users, roles, categories, and featured recipes.

## Stack rules

- Vanilla JavaScript ES modules only. NO TypeScript, NO React/Vue/other frameworks.
- Vite for the dev server and builds.
- Bootstrap 5 + Bootstrap Icons for all UI. No other CSS frameworks.
- Supabase JS (@supabase/supabase-js) for auth and database access.

## Architecture

- Multi-page app: one HTML file per page at the repo root (index.html, login.html,
  register.html, recipe.html, recipe-edit.html, profile.html, meal-plan.html, admin.html).
- Each page has a matching entry module in src/pages/<name>.js and is registered in
  vite.config.js under build.rollupOptions.input.
- Every page renders the shared navbar into <div id="navbar"></div> via
  renderNavbar() from src/components/navbar.js, and has <main id="app"> as the
  page content root.
- src/services/: all Supabase access goes through services (supabase.js holds the
  client, auth.js wraps auth and the isAdmin() role check).
- src/components/: reusable UI rendered by multiple pages.
- src/utils/: DOM helpers (dom.js) and route guards (guard.js: requireAuth,
  requireAdmin).
- src/styles/main.css: light custom theme on top of Bootstrap.

## Security

- Row Level Security is authoritative - never rely on client-side checks for
  access control; guards only improve UX.
- Roles live in the user_roles table (user_id, role). Check admin rights via
  isAdmin() in src/services/auth.js.
- Never commit secrets. Supabase credentials come from .env via
  VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (see .env.example).
- Database schema changes only via SQL migrations in supabase/migrations/.

## UI conventions

- Fully responsive, mobile-first layouts using the Bootstrap grid and components
  (navbar collapse on mobile).
- Use Bootstrap Icons (<i class="bi bi-*"></i>) for icons.
- Use straight quotes (") in all UI text - never typographic quotes.
