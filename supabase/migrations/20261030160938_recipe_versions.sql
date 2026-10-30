-- B2. Собственные версии рецептов.
--
-- * Версия — отдельная копия состава: оригинальный рецепт ею не меняется (в recipes и
--   recipe_ingredients пользователь писать не может вообще).
-- * В версии можно изменить количество и единицу, заменить, удалить и добавить ингредиент
--   (в том числе свой продукт), задать число порций и массу готового блюда.
-- * original_position связывает строку версии со строкой оригинала — чтобы показать, что изменено.
-- * Сохраняется целиком одной функцией save_recipe_version: версия не остаётся «наполовину».

create table public.recipe_versions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id bigint not null references public.recipes (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  servings numeric(6, 2) check (servings > 0 and servings <= 100),
  yield_grams numeric check (yield_grams > 0 and yield_grams <= 100000),
  note text check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recipe_versions is 'Своя версия рецепта пользователя; оригинал не меняется';

create index recipe_versions_user_recipe_idx on public.recipe_versions (user_id, recipe_id);
create index recipe_versions_recipe_idx on public.recipe_versions (recipe_id);

create trigger recipe_versions_updated_at
  before update on public.recipe_versions
  for each row execute function public.set_updated_at();

create table public.recipe_version_ingredients (
  id bigint generated always as identity primary key,
  version_id bigint not null references public.recipe_versions (id) on delete cascade,
  position smallint not null check (position > 0),
  ingredient_id bigint not null references public.ingredients (id) on delete restrict,
  quantity numeric check (quantity > 0),
  unit_code text references public.units (code),
  quantity_text text check (length(quantity_text) <= 100),
  importance text not null default 'main' check (importance in ('key', 'main', 'minor', 'optional')),
  note text check (length(note) <= 300),
  -- Строка оригинала, из которой получена эта; null — добавлена в версии.
  original_position smallint check (original_position > 0),
  unique (version_id, position),
  check (quantity is null or unit_code is not null)
);

create index recipe_version_ingredients_ingredient_idx on public.recipe_version_ingredients (ingredient_id);

alter table public.recipe_versions enable row level security;
alter table public.recipe_version_ingredients enable row level security;

-- Версии видит и меняет только их автор; создать можно только для видимого ему рецепта.
create policy recipe_versions_read on public.recipe_versions for select to authenticated
  using (user_id = (select auth.uid()));
create policy recipe_versions_insert on public.recipe_versions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id)
  );
create policy recipe_versions_update on public.recipe_versions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id)
  );
create policy recipe_versions_delete on public.recipe_versions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Строки версии — через владельца версии; продукт должен быть виден пользователю.
create or replace function public.recipe_version_owned(p_version_id bigint)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.recipe_versions v
    where v.id = p_version_id and v.user_id = (select auth.uid())
  );
$$;

create policy recipe_version_ingredients_read on public.recipe_version_ingredients
  for select to authenticated using (public.recipe_version_owned(version_id));
create policy recipe_version_ingredients_insert on public.recipe_version_ingredients
  for insert to authenticated
  with check (public.recipe_version_owned(version_id) and public.ingredient_visible(ingredient_id));
create policy recipe_version_ingredients_update on public.recipe_version_ingredients
  for update to authenticated
  using (public.recipe_version_owned(version_id))
  with check (public.recipe_version_owned(version_id) and public.ingredient_visible(ingredient_id));
create policy recipe_version_ingredients_delete on public.recipe_version_ingredients
  for delete to authenticated using (public.recipe_version_owned(version_id));

-- Сохранение версии целиком: создать (p_id is null) или заменить поля и состав существующей.
-- Работает с правами вызывающего — RLS выше действует как обычно.
create or replace function public.save_recipe_version(
  p_id bigint,
  p_recipe_id bigint,
  p_name text,
  p_servings numeric,
  p_yield_grams numeric,
  p_note text,
  p_lines jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'В версии должен быть хотя бы один ингредиент';
  end if;

  if p_id is null then
    insert into public.recipe_versions (recipe_id, name, servings, yield_grams, note)
    values (p_recipe_id, p_name, p_servings, p_yield_grams, p_note)
    returning id into v_id;
  else
    update public.recipe_versions
    set name = p_name, servings = p_servings, yield_grams = p_yield_grams, note = p_note
    where id = p_id and recipe_id = p_recipe_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Версия не найдена';
    end if;
    delete from public.recipe_version_ingredients where version_id = v_id;
  end if;

  insert into public.recipe_version_ingredients
    (version_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note,
     original_position)
  select v_id, t.ord, (t.l ->> 'ingredientId')::bigint, (t.l ->> 'quantity')::numeric,
    t.l ->> 'unitCode', t.l ->> 'quantityText', coalesce(t.l ->> 'importance', 'main'),
    t.l ->> 'note', (t.l ->> 'originalPosition')::smallint
  from jsonb_array_elements(p_lines) with ordinality as t (l, ord);

  return v_id;
end;
$$;

revoke all on public.recipe_versions, public.recipe_version_ingredients from anon;
revoke all on function public.recipe_version_owned(bigint) from public, anon;
grant execute on function public.recipe_version_owned(bigint) to authenticated;
revoke all on function public.save_recipe_version(bigint, bigint, text, numeric, numeric, text, jsonb)
  from public, anon;
grant execute on function public.save_recipe_version(bigint, bigint, text, numeric, numeric, text, jsonb)
  to authenticated;
