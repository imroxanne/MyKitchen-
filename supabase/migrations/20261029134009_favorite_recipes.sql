-- A6: избранные рецепты пользователя.
create table public.favorite_recipes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id bigint not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

comment on table public.favorite_recipes is 'Избранное: сохранение рецепта не означает, что его готовили';

create index favorite_recipes_recipe_idx on public.favorite_recipes (recipe_id);

alter table public.favorite_recipes enable row level security;

create policy favorite_recipes_read on public.favorite_recipes for select to authenticated
  using (user_id = (select auth.uid()));
-- Добавить можно только видимый пользователю рецепт (RLS recipes отсекает чужие черновики).
create policy favorite_recipes_insert on public.favorite_recipes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id)
  );
create policy favorite_recipes_delete on public.favorite_recipes for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.favorite_recipes from anon;
