-- A2. Модель данных: единицы, категории, ингредиенты и синонимы, продукты
-- пользователя, источники, рецепты, ингредиенты рецептов и шаги.
--
-- Принципы:
-- * Общий справочник (owner_id is null) читают все вошедшие, меняет только
--   администратор (миграции/service_role). Личные позиции видит только владелец.
-- * Количество и единица задаются вместе либо не задаются вовсе:
--   неизвестный остаток не подменяется числом.
-- * Статусы доверия рецепта раздельные и выставляются только с основанием
--   (дата + пояснение), пользователь не может выставить их себе сам.

-- ---------------------------------------------------------------------------
-- Нормализация названий: регистр, ё→е, лишние пробелы.
-- Та же логика — в src/lib/normalize.ts (тесты сверяют обе реализации).
create or replace function public.normalize_name(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(translate(lower(btrim(value)), 'ё', 'е'), '\s+', ' ', 'g');
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Единицы измерения. base_factor — сколько базовых единиц своего вида в одной:
-- для массы база — грамм, для объёма — миллилитр. У штук и «прочих» его нет:
-- перевод в граммы требует данных конкретного продукта (piece_weight_g, плотность).
create table public.units (
  code text primary key,
  name text not null,
  kind text not null check (kind in ('mass', 'volume', 'count', 'other')),
  base_factor numeric check (base_factor > 0),
  is_approximate boolean not null default false,
  sort smallint not null default 0,
  check ((kind in ('mass', 'volume')) = (base_factor is not null))
);

comment on table public.units is 'Единицы измерения; base_factor — в граммах (mass) или миллилитрах (volume)';
comment on column public.units.is_approximate is 'Бытовая мера (ложка, стакан): пересчёт ориентировочный';

insert into public.units (code, name, kind, base_factor, is_approximate, sort) values
  ('g', 'г', 'mass', 1, false, 10),
  ('kg', 'кг', 'mass', 1000, false, 11),
  ('ml', 'мл', 'volume', 1, false, 20),
  ('l', 'л', 'volume', 1000, false, 21),
  ('tsp', 'ч. л.', 'volume', 5, true, 22),
  ('tbsp', 'ст. л.', 'volume', 15, true, 23),
  ('cup', 'стакан', 'volume', 250, true, 24),
  ('pcs', 'шт.', 'count', null, false, 30),
  ('clove', 'зубчик', 'count', null, false, 31),
  ('bunch', 'пучок', 'count', null, false, 32),
  ('pack', 'упаковка', 'count', null, false, 33),
  ('pinch', 'щепотка', 'other', null, true, 40),
  ('to_taste', 'по вкусу', 'other', null, true, 41);

-- ---------------------------------------------------------------------------
create table public.ingredient_categories (
  slug text primary key check (slug ~ '^[a-z_]+$'),
  name text not null unique,
  sort smallint not null default 0
);

insert into public.ingredient_categories (slug, name, sort) values
  ('vegetables', 'Овощи и зелень', 10),
  ('fruits', 'Фрукты и ягоды', 20),
  ('mushrooms', 'Грибы', 25),
  ('grains', 'Крупы, макароны, мука', 30),
  ('legumes', 'Бобовые', 35),
  ('bakery', 'Хлеб и выпечка', 40),
  ('dairy', 'Молочные продукты и яйца', 50),
  ('meat', 'Мясо и птица', 60),
  ('fish', 'Рыба и морепродукты', 70),
  ('nuts', 'Орехи и семена', 80),
  ('oils', 'Масла и жиры', 90),
  ('sauces', 'Соусы и приправы', 100),
  ('spices', 'Специи и травы', 110),
  ('sweets', 'Сахар и сладкое', 120),
  ('canned', 'Консервы', 130),
  ('drinks', 'Напитки', 140),
  ('other', 'Другое', 1000);

-- ---------------------------------------------------------------------------
create table public.ingredients (
  id bigint generated always as identity primary key,
  name text not null check (length(btrim(name)) between 1 and 100),
  name_normalized text generated always as (public.normalize_name(name)) stored,
  category_slug text not null default 'other' references public.ingredient_categories (slug),
  default_unit text references public.units (code),
  density_g_per_ml numeric check (density_g_per_ml > 0),
  piece_weight_g numeric check (piece_weight_g > 0),
  -- null — общий справочник; иначе личный продукт пользователя.
  owner_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on column public.ingredients.piece_weight_g is 'Средняя масса одной штуки, если известна (для пересчёта шт. → г)';

create unique index ingredients_catalog_name_key
  on public.ingredients (name_normalized) where owner_id is null;
create unique index ingredients_owner_name_key
  on public.ingredients (owner_id, name_normalized) where owner_id is not null;
create index ingredients_category_idx on public.ingredients (category_slug);

create table public.ingredient_synonyms (
  id bigint generated always as identity primary key,
  ingredient_id bigint not null references public.ingredients (id) on delete cascade,
  synonym text not null check (length(btrim(synonym)) between 1 and 100),
  synonym_normalized text generated always as (public.normalize_name(synonym)) stored,
  unique (synonym_normalized)
);

create index ingredient_synonyms_ingredient_idx on public.ingredient_synonyms (ingredient_id);

-- ---------------------------------------------------------------------------
-- Продукты пользователя: «обычно есть» (staple) и «сейчас есть» (current).
create table public.user_products (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ingredient_id bigint not null references public.ingredients (id) on delete restrict,
  kind text not null check (kind in ('staple', 'current')),
  quantity numeric check (quantity > 0),
  unit_code text references public.units (code),
  expires_on date,
  is_excluded boolean not null default false,
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ingredient_id),
  check ((quantity is null) = (unit_code is null))
);

comment on column public.user_products.quantity is 'null — количество неизвестно (не считается достаточным)';
comment on column public.user_products.is_excluded is 'Временно не учитывать при подборе рецептов';

create index user_products_ingredient_idx on public.user_products (ingredient_id);

create trigger user_products_updated_at
  before update on public.user_products
  for each row execute function public.set_updated_at();

-- Виден ли продукт текущему пользователю (общий или свой). Работает с правами
-- вызывающего, поэтому RLS таблицы ingredients сама отсекает чужие личные продукты.
create or replace function public.ingredient_visible(p_ingredient_id bigint)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.ingredients i where i.id = p_ingredient_id);
$$;

-- ---------------------------------------------------------------------------
create table public.recipe_sources (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('website', 'youtube', 'book', 'own', 'other')),
  title text not null check (length(btrim(title)) > 0),
  url text check (url ~ '^https?://'),
  author text,
  retrieved_on date,
  -- Права использования: own — собственный текст; permission — получено разрешение;
  -- link_only — храним только факты/структуру и ссылку на оригинал; public_domain; unknown.
  rights text not null default 'unknown'
    check (rights in ('own', 'permission', 'link_only', 'public_domain', 'unknown')),
  rights_note text,
  created_at timestamptz not null default now(),
  check (kind in ('own', 'book', 'other') or url is not null)
);

comment on table public.recipe_sources is 'Источник рецепта: ссылка, автор, дата получения, права использования';

create table public.recipes (
  id bigint generated always as identity primary key,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text,
  source_id bigint references public.recipe_sources (id) on delete restrict,
  origin text not null check (origin in ('curated', 'external', 'user')),
  owner_id uuid references auth.users (id) on delete set null,
  is_published boolean not null default false,
  -- Тестовые/демонстрационные данные: не выдаются за настоящие рецепты.
  is_sample boolean not null default false,
  -- Раздельные статусы доверия; ставятся только с основанием.
  source_checked_at timestamptz,
  source_checked_note text,
  cooked_verified_at timestamptz,
  cooked_verified_note text,
  image_url text check (image_url ~ '^https?://'),
  video_url text check (video_url ~ '^https?://'),
  cuisine text,
  meal_types text[] not null default '{}'
    check (meal_types <@ array['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'drink']),
  cooking_methods text[] not null default '{}',
  equipment text[] not null default '{}',
  tags text[] not null default '{}',
  prep_minutes integer check (prep_minutes >= 0),
  cook_minutes integer check (cook_minutes >= 0),
  difficulty smallint check (difficulty between 1 and 3),
  servings numeric(6, 2) check (servings > 0),
  yield_grams numeric check (yield_grams > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source_checked_at is null) = (source_checked_note is null)),
  check ((cooked_verified_at is null) = (cooked_verified_note is null)),
  check (origin <> 'external' or source_id is not null),
  check (origin <> 'user' or owner_id is not null or not is_published)
);

comment on column public.recipes.source_checked_at is 'Статус «проверены источник и полнота данных»';
comment on column public.recipes.cooked_verified_at is 'Статус «проверен приготовлением»';

create index recipes_source_idx on public.recipes (source_id);
create index recipes_owner_idx on public.recipes (owner_id);

create trigger recipes_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id bigint generated always as identity primary key,
  recipe_id bigint not null references public.recipes (id) on delete cascade,
  position smallint not null check (position > 0),
  ingredient_id bigint not null references public.ingredients (id) on delete restrict,
  quantity numeric check (quantity > 0),
  unit_code text references public.units (code),
  -- Как указано в источнике («2–3 шт.», «по вкусу»), если не сводится к числу.
  quantity_text text,
  -- Значимость для подбора: key — без него блюдо не получится.
  importance text not null default 'main' check (importance in ('key', 'main', 'minor', 'optional')),
  note text,
  unique (recipe_id, position),
  check (quantity is null or unit_code is not null)
);

create index recipe_ingredients_ingredient_idx on public.recipe_ingredients (ingredient_id);

create table public.recipe_steps (
  id bigint generated always as identity primary key,
  recipe_id bigint not null references public.recipes (id) on delete cascade,
  position smallint not null check (position > 0),
  instruction text not null check (length(btrim(instruction)) > 0),
  duration_minutes integer check (duration_minutes >= 0),
  unique (recipe_id, position)
);

-- Личный продукт нельзя использовать в рецепте, видимом другим.
create or replace function public.recipe_ingredient_check()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
  v_recipe_owner uuid;
begin
  select owner_id into v_owner from public.ingredients where id = new.ingredient_id;
  if v_owner is not null then
    select owner_id into v_recipe_owner from public.recipes where id = new.recipe_id;
    if v_recipe_owner is distinct from v_owner then
      raise exception 'Личный продукт можно использовать только в рецептах его владельца';
    end if;
  end if;
  return new;
end;
$$;

create trigger recipe_ingredients_check
  before insert or update on public.recipe_ingredients
  for each row execute function public.recipe_ingredient_check();

-- ---------------------------------------------------------------------------
-- Доступ (RLS). Без политики — нет доступа.
alter table public.units enable row level security;
alter table public.ingredient_categories enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_synonyms enable row level security;
alter table public.user_products enable row level security;
alter table public.recipe_sources enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;

-- Справочники: чтение для вошедших.
create policy units_read on public.units for select to authenticated using (true);
create policy categories_read on public.ingredient_categories for select to authenticated using (true);

create policy ingredients_read on public.ingredients for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy ingredients_insert_own on public.ingredients for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy ingredients_update_own on public.ingredients for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy ingredients_delete_own on public.ingredients for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy synonyms_read on public.ingredient_synonyms for select to authenticated
  using (public.ingredient_visible(ingredient_id));

create policy user_products_read on public.user_products for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_products_insert on public.user_products for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.ingredient_visible(ingredient_id)
  );
create policy user_products_update on public.user_products for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.ingredient_visible(ingredient_id)
  );
create policy user_products_delete on public.user_products for delete to authenticated
  using (user_id = (select auth.uid()));

-- Рецепты: опубликованные — всем вошедшим, свои — автору.
-- Запись пользовательских рецептов появится в C2 (с модерацией).
create policy recipe_sources_read on public.recipe_sources for select to authenticated using (true);

create policy recipes_read on public.recipes for select to authenticated
  using (is_published or owner_id = (select auth.uid()));

create policy recipe_ingredients_read on public.recipe_ingredients for select to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and (r.is_published or r.owner_id = (select auth.uid()))
  ));

create policy recipe_steps_read on public.recipe_steps for select to authenticated
  using (exists (
    select 1 from public.recipes r
    where r.id = recipe_id and (r.is_published or r.owner_id = (select auth.uid()))
  ));

-- Анонимной роли данные приложения не нужны.
revoke all on public.units, public.ingredient_categories, public.ingredients,
  public.ingredient_synonyms, public.user_products, public.recipe_sources, public.recipes,
  public.recipe_ingredients, public.recipe_steps from anon;

revoke all on function public.ingredient_visible(bigint) from public, anon;
grant execute on function public.ingredient_visible(bigint) to authenticated;
