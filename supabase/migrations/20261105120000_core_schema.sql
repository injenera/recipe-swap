-- Recipe Swap: core schema, roles, RLS and grants.

create type public.app_role as enum ('admin', 'user');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text check (char_length(bio) <= 500),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.categories (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(name) between 1 and 40),
  icon text not null default 'bi-bookmark',
  created_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  category_id bigint references public.categories (id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 1000),
  ingredients text not null check (char_length(ingredients) between 1 and 5000),
  instructions text not null check (char_length(instructions) between 1 and 10000),
  prep_minutes integer check (prep_minutes between 0 and 1440),
  cook_minutes integer check (cook_minutes between 0 and 1440),
  servings integer check (servings between 1 and 100),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_author_id_idx on public.recipes (author_id);
create index recipes_category_id_idx on public.recipes (category_id);
create index recipes_created_at_idx on public.recipes (created_at desc);
create index recipes_featured_idx on public.recipes (created_at desc) where is_featured;

create table public.recipe_photos (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  storage_path text not null unique,
  is_cover boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index recipe_photos_recipe_id_idx on public.recipe_photos (recipe_id, position);
create unique index recipe_photos_one_cover_idx on public.recipe_photos (recipe_id) where is_cover;

create table public.ratings (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);

create index ratings_user_id_idx on public.ratings (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_recipe_id_idx on public.comments (recipe_id, created_at);
create index comments_author_id_idx on public.comments (author_id);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create index favorites_recipe_id_idx on public.favorites (recipe_id);

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  plan_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  created_at timestamptz not null default now(),
  unique (user_id, plan_date, meal_type, recipe_id)
);

create index meal_plan_entries_user_date_idx on public.meal_plan_entries (user_id, plan_date);
create index meal_plan_entries_recipe_id_idx on public.meal_plan_entries (recipe_id);

-- Aggregated rating/comment counts (respects the caller's RLS).
create view public.recipe_stats
with (security_invoker = true) as
select
  r.id as recipe_id,
  coalesce(round(avg(ra.stars)::numeric, 1), 0) as avg_rating,
  count(distinct ra.user_id) as rating_count,
  (select count(*) from public.comments c where c.recipe_id = r.id) as comment_count
from public.recipes r
left join public.ratings ra on ra.recipe_id = r.id
group by r.id;

-- ---------------------------------------------------------------------------
-- Functions and triggers
-- ---------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger recipes_set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();
create trigger ratings_set_updated_at before update on public.ratings
  for each row execute function public.set_updated_at();
create trigger comments_set_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- New auth users get a profile and the default 'user' role.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                  split_part(new.email, '@', 1), 'Cook'), 60)
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may feature recipes; authors can never be reassigned.
create function public.protect_recipe_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.is_featured := false;
    else
      new.is_featured := old.is_featured;
    end if;
  end if;
  if tg_op = 'UPDATE' then
    new.author_id := old.author_id;
  end if;
  return new;
end;
$$;

create trigger recipes_protect_columns before insert or update on public.recipes
  for each row execute function public.protect_recipe_columns();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_photos enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;
alter table public.favorites enable row level security;
alter table public.meal_plan_entries enable row level security;

-- profiles
create policy "Profiles are public" on public.profiles
  for select to anon, authenticated using (true);
create policy "Users update own profile, admins any" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- user_roles
create policy "Users see own roles, admins all" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Admins grant roles" on public.user_roles
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins revoke roles except their own" on public.user_roles
  for delete to authenticated
  using ((select public.is_admin()) and user_id <> (select auth.uid()));

-- categories
create policy "Categories are public" on public.categories
  for select to anon, authenticated using (true);
create policy "Admins insert categories" on public.categories
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update categories" on public.categories
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete categories" on public.categories
  for delete to authenticated using ((select public.is_admin()));

-- recipes
create policy "Recipes are public" on public.recipes
  for select to anon, authenticated using (true);
create policy "Users create own recipes" on public.recipes
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Authors or admins update recipes" on public.recipes
  for update to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()))
  with check (author_id = (select auth.uid()) or (select public.is_admin()));
create policy "Authors or admins delete recipes" on public.recipes
  for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));

-- recipe_photos
create policy "Recipe photos are public" on public.recipe_photos
  for select to anon, authenticated using (true);
create policy "Recipe authors add photos" on public.recipe_photos
  for insert to authenticated
  with check (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.author_id = (select auth.uid())
  ));
create policy "Recipe authors or admins update photos" on public.recipe_photos
  for update to authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.author_id = (select auth.uid())
  ))
  with check ((select public.is_admin()) or exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.author_id = (select auth.uid())
  ));
create policy "Recipe authors or admins delete photos" on public.recipe_photos
  for delete to authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.recipes r
    where r.id = recipe_id and r.author_id = (select auth.uid())
  ));

-- ratings
create policy "Ratings are public" on public.ratings
  for select to anon, authenticated using (true);
create policy "Users rate as themselves" on public.ratings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own ratings" on public.ratings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users or admins delete ratings" on public.ratings
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- comments
create policy "Comments are public" on public.comments
  for select to anon, authenticated using (true);
create policy "Users comment as themselves" on public.comments
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Users update own comments" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Users or admins delete comments" on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));

-- favorites (private)
create policy "Users see own favorites" on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users add own favorites" on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users remove own favorites" on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

-- meal_plan_entries (private)
create policy "Users see own meal plan" on public.meal_plan_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users add to own meal plan" on public.meal_plan_entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own meal plan" on public.meal_plan_entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users delete from own meal plan" on public.meal_plan_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Explicit grants (no reliance on default privileges)
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.user_roles, public.categories, public.recipes,
  public.recipe_photos, public.ratings, public.comments, public.favorites,
  public.meal_plan_entries, public.recipe_stats
  from public, anon, authenticated;

grant select on public.profiles, public.categories, public.recipes, public.recipe_photos,
  public.ratings, public.comments, public.recipe_stats
  to anon, authenticated;

grant update (display_name, bio, avatar_path) on public.profiles to authenticated;
grant select, insert, delete on public.user_roles to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.recipes, public.recipe_photos, public.ratings,
  public.comments to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.meal_plan_entries to authenticated;

grant all on public.profiles, public.user_roles, public.categories, public.recipes,
  public.recipe_photos, public.ratings, public.comments, public.favorites,
  public.meal_plan_entries, public.recipe_stats
  to service_role;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

insert into public.categories (name, icon) values
  ('Breakfast', 'bi-sunrise'),
  ('Soups', 'bi-cup-hot'),
  ('Salads', 'bi-flower1'),
  ('Main dishes', 'bi-egg-fried'),
  ('Vegetarian', 'bi-tree'),
  ('Baking', 'bi-basket'),
  ('Desserts', 'bi-cake2'),
  ('Drinks', 'bi-cup-straw');
