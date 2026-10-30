-- B3. Дневник питания: «Съедено».
--
-- * Запись хранит СНИМОК на момент записи: название, состав и КБЖУ «основы» (всего блюда,
--   100 г продукта или одной порции покупного блюда). Последующие правки рецепта или версии
--   историю не меняют — запись на них больше не опирается.
-- * Съеденное — порции (0,5; 1,5 …), доля блюда или масса; КБЖУ съеденного считает сама БД
--   из снимка.
-- * Пользователь может поменять дату, время, приём пищи, количество, название и заметку,
--   но не снимок (права на уровне столбцов).

create table public.diary_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_on date not null,
  eaten_time time,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  -- recipe — блюдо по рецепту (оригинал или своя версия); product — продукт из справочника;
  -- custom — своё блюдо без рецепта (например, покупное) с КБЖУ с упаковки.
  kind text not null check (kind in ('recipe', 'product', 'custom')),
  title text not null check (length(btrim(title)) between 1 and 200),
  -- Откуда запись (только для справки: снимок от них не зависит).
  recipe_id bigint references public.recipes (id) on delete set null,
  version_id bigint references public.recipe_versions (id) on delete set null,
  ingredient_id bigint references public.ingredients (id) on delete set null,

  -- Снимок «основы»: сколько порций и какая масса (г или мл) ей соответствуют и её КБЖУ.
  base_servings numeric check (base_servings > 0),
  -- portion — порции; dish — доли всего блюда (когда число порций в рецепте не указано).
  serving_unit text not null default 'portion' check (serving_unit in ('portion', 'dish')),
  base_amount numeric check (base_amount > 0),
  amount_unit text not null default 'g' check (amount_unit in ('g', 'ml')),
  base_kcal numeric not null check (base_kcal >= 0),
  base_protein numeric not null check (base_protein >= 0),
  base_fat numeric not null check (base_fat >= 0),
  base_carbs numeric not null check (base_carbs >= 0),
  -- В расчёте основы не хватало заметных продуктов: итог занижен.
  nutrition_incomplete boolean not null default false,
  -- Состав на момент записи: [{name, amount, kcal}], только для показа.
  composition jsonb not null default '[]'
    check (jsonb_typeof(composition) = 'array' and jsonb_array_length(composition) <= 100),

  -- Сколько съедено: порции или масса — что-то одно.
  servings numeric check (servings > 0 and servings <= 100),
  amount numeric check (amount > 0 and amount <= 10000),
  check ((servings is null) <> (amount is null)),
  check (servings is null or base_servings is not null),
  check (amount is null or base_amount is not null),

  -- КБЖУ съеденного = КБЖУ основы × доля.
  kcal numeric generated always as
    (round(base_kcal * coalesce(servings / base_servings, amount / base_amount), 2)) stored,
  protein numeric generated always as
    (round(base_protein * coalesce(servings / base_servings, amount / base_amount), 2)) stored,
  fat numeric generated always as
    (round(base_fat * coalesce(servings / base_servings, amount / base_amount), 2)) stored,
  carbs numeric generated always as
    (round(base_carbs * coalesce(servings / base_servings, amount / base_amount), 2)) stored,

  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.diary_entries is
  'Дневник питания: фактически съеденное со снимком состава и КБЖУ на момент записи';

create index diary_entries_user_day_idx on public.diary_entries (user_id, eaten_on);
create index diary_entries_recipe_idx on public.diary_entries (recipe_id);
create index diary_entries_version_idx on public.diary_entries (version_id);
create index diary_entries_ingredient_idx on public.diary_entries (ingredient_id);

create trigger diary_entries_updated_at
  before update on public.diary_entries
  for each row execute function public.set_updated_at();

alter table public.diary_entries enable row level security;

-- Дневник приватен: только свои записи. Ссылаться можно только на видимое пользователю.
create policy diary_entries_read on public.diary_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy diary_entries_insert on public.diary_entries for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (recipe_id is null or exists (select 1 from public.recipes r where r.id = recipe_id))
    and (version_id is null or public.recipe_version_owned(version_id))
    and (ingredient_id is null or public.ingredient_visible(ingredient_id))
  );
create policy diary_entries_update on public.diary_entries for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy diary_entries_delete on public.diary_entries for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.diary_entries from anon;
-- Снимок после записи не меняется: изменять можно только эти столбцы.
revoke update on public.diary_entries from authenticated;
grant update (eaten_on, eaten_time, meal, title, servings, amount, note)
  on public.diary_entries to authenticated;
