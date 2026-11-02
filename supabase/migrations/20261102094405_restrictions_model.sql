-- B4. Пищевые ограничения: справочник групп, разметка продуктов, ограничения пользователя.
--
-- * Группы — аллергены (ТР ТС 022/2011, Регламент ЕС 1169/2011, плюс лактоза) и группы для
--   предпочтений (мясо, птица…). Продукт либо «содержит» группу, либо «может содержать»
--   (зависит от производителя, перекрёстный контакт) — это «проверьте», а не «безопасно».
-- * composition_reviewed: состав продукта размечен. Неразмеченный (в том числе личный продукт
--   пользователя) при ограничениях по группам считается «требует проверки».
-- * Ограничение пользователя — отдельная сущность своего вида (аллергия, непереносимость,
--   медицинское, предпочтение) на группу или на конкретный продукт. Для непереносимости и
--   предпочтения можно отметить переносимые продукты группы; для аллергии — нельзя.

create table public.restriction_groups (
  code text primary key check (code ~ '^[a-z_]+$'),
  kind text not null check (kind in ('allergen', 'diet')),
  name text not null check (length(name) between 1 and 100),
  description text not null check (length(description) <= 300),
  sort smallint not null default 0
);

comment on table public.restriction_groups is 'Группы для пищевых ограничений: аллергены и образ питания';

create table public.ingredient_restriction_groups (
  ingredient_id bigint not null references public.ingredients (id) on delete cascade,
  group_code text not null references public.restriction_groups (code),
  relation text not null check (relation in ('contains', 'may_contain')),
  primary key (ingredient_id, group_code)
);

create index ingredient_restriction_groups_group_idx on public.ingredient_restriction_groups (group_code);

comment on table public.ingredient_restriction_groups is
  'Разметка продукта: содержит группу или может содержать (проверить состав)';

alter table public.ingredients
  add column composition_reviewed boolean not null default false,
  add column composition_note text check (length(composition_note) <= 300),
  -- Состав личного продукта пользователя не проверен: при ограничениях — «требует проверки».
  add constraint ingredients_own_not_reviewed check (owner_id is null or not composition_reviewed);

alter table public.restriction_groups enable row level security;
alter table public.ingredient_restriction_groups enable row level security;

create policy restriction_groups_read on public.restriction_groups for select to authenticated
  using (true);
create policy ingredient_restriction_groups_read on public.ingredient_restriction_groups
  for select to authenticated using (public.ingredient_visible(ingredient_id));

-- Ограничения пользователя.
create table public.user_restrictions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('allergy', 'intolerance', 'medical', 'preference')),
  group_code text references public.restriction_groups (code),
  ingredient_id bigint references public.ingredients (id) on delete cascade,
  note text check (length(note) <= 300),
  created_at timestamptz not null default now(),
  check ((group_code is null) <> (ingredient_id is null))
);

comment on table public.user_restrictions is
  'Пищевые ограничения пользователя: аллергия, непереносимость, медицинское, предпочтение';

create unique index user_restrictions_group_uq on public.user_restrictions (user_id, group_code)
  where group_code is not null;
create unique index user_restrictions_ingredient_uq on public.user_restrictions (user_id, ingredient_id)
  where ingredient_id is not null;
create index user_restrictions_group_idx on public.user_restrictions (group_code);
create index user_restrictions_ingredient_idx on public.user_restrictions (ingredient_id);

-- Переносимые продукты группы (например, твёрдый сыр при непереносимости лактозы).
create table public.user_restriction_exceptions (
  restriction_id bigint not null references public.user_restrictions (id) on delete cascade,
  ingredient_id bigint not null references public.ingredients (id) on delete cascade,
  primary key (restriction_id, ingredient_id)
);

create index user_restriction_exceptions_ingredient_idx on public.user_restriction_exceptions (ingredient_id);

alter table public.user_restrictions enable row level security;
alter table public.user_restriction_exceptions enable row level security;

create policy user_restrictions_read on public.user_restrictions for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_restrictions_insert on public.user_restrictions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (ingredient_id is null or public.ingredient_visible(ingredient_id))
  );
create policy user_restrictions_update on public.user_restrictions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy user_restrictions_delete on public.user_restrictions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Исключения — только к своему ограничению по группе вида «непереносимость» или «предпочтение».
create or replace function public.restriction_allows_exceptions(p_restriction_id bigint)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.user_restrictions r
    where r.id = p_restriction_id
      and r.user_id = (select auth.uid())
      and r.group_code is not null
      and r.kind in ('intolerance', 'preference')
  );
$$;

create policy user_restriction_exceptions_read on public.user_restriction_exceptions
  for select to authenticated
  using (exists (
    select 1 from public.user_restrictions r
    where r.id = restriction_id and r.user_id = (select auth.uid())
  ));
create policy user_restriction_exceptions_insert on public.user_restriction_exceptions
  for insert to authenticated
  with check (
    public.restriction_allows_exceptions(restriction_id)
    and public.ingredient_visible(ingredient_id)
  );
create policy user_restriction_exceptions_delete on public.user_restriction_exceptions
  for delete to authenticated
  using (exists (
    select 1 from public.user_restrictions r
    where r.id = restriction_id and r.user_id = (select auth.uid())
  ));

-- Если ограничение стало аллергией или медицинским — переносимые продукты больше не действуют.
create or replace function public.user_restrictions_drop_exceptions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.kind in ('allergy', 'medical') then
    delete from public.user_restriction_exceptions where restriction_id = new.id;
  end if;
  return new;
end;
$$;

create trigger user_restrictions_drop_exceptions
  after update of kind on public.user_restrictions
  for each row execute function public.user_restrictions_drop_exceptions();

revoke all on public.restriction_groups, public.ingredient_restriction_groups,
  public.user_restrictions, public.user_restriction_exceptions from anon;
-- Справочник групп и разметку пользователь только читает.
revoke insert, update, delete, truncate on public.restriction_groups,
  public.ingredient_restriction_groups from authenticated;
-- В ограничении меняются только вид и заметка; цель (группа или продукт) — нет.
revoke update on public.user_restrictions from authenticated;
grant update (kind, note) on public.user_restrictions to authenticated;
revoke update on public.user_restriction_exceptions from authenticated;
revoke all on function public.restriction_allows_exceptions(bigint) from public, anon;
grant execute on function public.restriction_allows_exceptions(bigint) to authenticated;
revoke all on function public.user_restrictions_drop_exceptions() from public, anon, authenticated;
