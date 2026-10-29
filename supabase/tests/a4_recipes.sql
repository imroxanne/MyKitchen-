-- A4: источники с лицензиями и публикация рецептов.
begin;

-- Открытая лицензия без названия/ссылки на лицензию запрещена.
do $$
declare ok boolean := false;
begin
  begin
    insert into public.recipe_sources (kind, title, url, rights)
    values ('website', 'Без лицензии', 'https://example.test/a', 'open_license');
  exception when others then ok := sqlstate = '23514';
  end;
  if not ok then raise exception 'open_license без лицензии не отклонена'; end if;
end;
$$;

-- Рецепт с источником без установленных прав нельзя опубликовать.
insert into public.recipe_sources (kind, title, url, rights)
values ('website', 'A4 неизвестные права', 'https://example.test/unknown', 'unknown');
do $$
declare ok boolean := false;
begin
  begin
    insert into public.recipes (title, origin, source_id, is_published)
    select 'A4 тест', 'external', id, true from public.recipe_sources where title = 'A4 неизвестные права';
  exception when others then ok := sqlstate = 'P0001';
  end;
  if not ok then raise exception 'опубликован рецепт с неустановленными правами'; end if;
end;
$$;

-- Все опубликованные рецепты базы: источник с правами, ингредиенты, шаги, без тестовой пометки.
do $$
begin
  if exists (
    select 1 from public.recipes r
    left join public.recipe_sources s on s.id = r.source_id
    where r.is_published and r.origin = 'external'
      and (s.id is null or s.rights = 'unknown' or s.url is null)
  ) then
    raise exception 'опубликован внешний рецепт без источника/прав/ссылки';
  end if;
  if exists (
    select 1 from public.recipes r where r.is_published
      and (not exists (select 1 from public.recipe_ingredients i where i.recipe_id = r.id)
        or not exists (select 1 from public.recipe_steps s where s.recipe_id = r.id))
  ) then
    raise exception 'опубликован рецепт без ингредиентов или шагов';
  end if;
  if exists (select 1 from public.recipes where is_published and is_sample) then
    raise exception 'тестовый рецепт опубликован';
  end if;
  if exists (select 1 from public.recipes where cooked_verified_at is not null) then
    raise exception 'статус «проверен приготовлением» выставлен без приготовления владелицей';
  end if;
end;
$$;

-- Вошедший пользователь видит лицензию и источник опубликованного рецепта.
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a4', 'a4@example.test');
insert into public.recipe_sources (kind, title, url, authors_url, rights, license, license_url, source_revision)
values ('website', 'A4 открытый', 'https://example.test/open', 'https://example.test/open?history',
  'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', '42');
insert into public.recipes (title, origin, source_id, is_published, adaptation_note)
select 'A4 открытый рецепт', 'external', id, true, 'Пересказано'
from public.recipe_sources where title = 'A4 открытый';

set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4"}', true);
end; $$;
do $$
begin
  if (select s.license from public.recipes r join public.recipe_sources s on s.id = r.source_id
      where r.title = 'A4 открытый рецепт') <> 'CC BY-SA 4.0' then
    raise exception 'пользователь не видит лицензию источника';
  end if;
end;
$$;

rollback;
\echo 'a4_recipes: OK'
