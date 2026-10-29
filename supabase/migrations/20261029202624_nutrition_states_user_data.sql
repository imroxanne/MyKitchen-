-- B1. Уточнённый пищевой справочник.
--
-- * Состояние продукта: as_purchased — в исходном виде, до приготовления (так взвешивают в рецепте);
--   cooked — после варки (для записи съеденного по массе готового). Значения разных состояний
--   не смешиваются: у каждой строки своё состояние.
-- * Свои данные с упаковки: КБЖУ на 100 г или на 100 мл, марка, масса упаковки и штуки.
--   Действуют только для их автора и заменяют справочные в его расчётах.
-- * Масса готового блюда по взвешиванию — для КБЖУ на 100 г готового блюда.

alter table public.ingredient_nutrition
  add column state text not null default 'as_purchased' check (state in ('as_purchased', 'cooked'));
alter table public.ingredient_nutrition drop constraint ingredient_nutrition_pkey;
alter table public.ingredient_nutrition add primary key (ingredient_id, state);
comment on column public.ingredient_nutrition.state is
  'as_purchased — в исходном виде (до приготовления), cooked — после варки';

alter table public.ingredient_unit_weights
  add column state text not null default 'as_purchased' check (state in ('as_purchased', 'cooked'));
alter table public.ingredient_unit_weights drop constraint ingredient_unit_weights_pkey;
alter table public.ingredient_unit_weights add primary key (ingredient_id, state, unit_code);

-- ---------------------------------------------------------------------------
create table public.user_ingredient_nutrition (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ingredient_id bigint not null references public.ingredients (id) on delete cascade,
  brand text check (length(brand) <= 100),
  -- На что указаны значения на упаковке.
  basis text not null check (basis in ('100g', '100ml')),
  kcal numeric(7, 2) not null check (kcal >= 0 and kcal <= 950),
  protein_g numeric(6, 2) not null check (protein_g >= 0),
  fat_g numeric(6, 2) not null check (fat_g >= 0),
  carbs_g numeric(6, 2) not null check (carbs_g >= 0),
  package_grams numeric check (package_grams > 0),
  piece_grams numeric check (piece_grams > 0),
  note text check (length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, ingredient_id),
  check (basis <> '100g' or protein_g + fat_g + carbs_g <= 100.5)
);

comment on table public.user_ingredient_nutrition is
  'КБЖУ с упаковки, введённое пользователем; заменяет справочное только в его расчётах';

create index user_ingredient_nutrition_ingredient_idx on public.user_ingredient_nutrition (ingredient_id);

create trigger user_ingredient_nutrition_updated_at
  before update on public.user_ingredient_nutrition
  for each row execute function public.set_updated_at();

create table public.recipe_yield_measurements (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id bigint not null references public.recipes (id) on delete cascade,
  yield_grams numeric not null check (yield_grams > 0 and yield_grams <= 100000),
  measured_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

comment on table public.recipe_yield_measurements is
  'Масса готового блюда по взвешиванию пользователя — для КБЖУ на 100 г';

create index recipe_yield_measurements_recipe_idx on public.recipe_yield_measurements (recipe_id);

alter table public.user_ingredient_nutrition enable row level security;
alter table public.recipe_yield_measurements enable row level security;

create policy user_ingredient_nutrition_read on public.user_ingredient_nutrition
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_ingredient_nutrition_insert on public.user_ingredient_nutrition
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.ingredient_visible(ingredient_id));
create policy user_ingredient_nutrition_update on public.user_ingredient_nutrition
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.ingredient_visible(ingredient_id));
create policy user_ingredient_nutrition_delete on public.user_ingredient_nutrition
  for delete to authenticated using (user_id = (select auth.uid()));

create policy recipe_yield_read on public.recipe_yield_measurements
  for select to authenticated using (user_id = (select auth.uid()));
create policy recipe_yield_insert on public.recipe_yield_measurements
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id)
  );
create policy recipe_yield_update on public.recipe_yield_measurements
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy recipe_yield_delete on public.recipe_yield_measurements
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.user_ingredient_nutrition, public.recipe_yield_measurements from anon;
