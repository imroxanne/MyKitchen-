-- A2: проверки модели данных и правил доступа (RLS).
-- Всё выполняется в транзакции и откатывается — данные в БД не остаются.
-- Шаблон «ожидаемая ошибка»: оператор во вложенном блоке, сверяется SQLSTATE.
--   42501 — нет прав / нарушение RLS, 23514 — CHECK, 23505 — уникальность,
--   23503 — внешний ключ.

begin;

-- 1. Справочники и нормализация ---------------------------------------------
do $$
begin
  if (select count(*) from public.units) < 13 then raise exception 'единицы не заполнены'; end if;
  if (select count(*) from public.ingredient_categories) < 17 then raise exception 'категории не заполнены'; end if;
  if (select base_factor from public.units where code = 'kg') <> 1000 then raise exception 'кг ≠ 1000 г'; end if;
  if public.normalize_name('  Ёжик   В  ТУМАНЕ ') <> 'ежик в тумане' then
    raise exception 'normalize_name: %', public.normalize_name('  Ёжик   В  ТУМАНЕ ');
  end if;
end;
$$;

-- 2. Общий справочник (от имени администратора) ------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'a2-user1@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'a2-user2@example.test');

insert into public.ingredients (name, category_slug, default_unit)
values ('Тестовый Томат', 'vegetables', 'pcs');
insert into public.ingredient_synonyms (ingredient_id, synonym)
select id, 'Тестовый помидор' from public.ingredients where name = 'Тестовый Томат';

do $$
declare ok boolean := false;
begin
  begin
    insert into public.ingredients (name) values ('  тестовый  томат ');
  exception when others then ok := sqlstate = '23505';
  end;
  if not ok then raise exception 'дубликат в общем справочнике не отклонён'; end if;
end;
$$;

do $$
declare ok boolean := false;
begin
  begin
    insert into public.ingredients (name, category_slug) values ('Тест', 'нет_такой');
  exception when others then ok := sqlstate in ('23503', '23514');
  end;
  if not ok then raise exception 'несуществующая категория не отклонена'; end if;
end;
$$;

-- Рецепт с источником, ингредиентами и шагами.
insert into public.recipe_sources (kind, title, url, author, retrieved_on, rights)
values ('website', 'Тестовый источник', 'https://example.test/recipe', 'Автор', '2026-10-29', 'link_only');

insert into public.recipes (title, source_id, origin, is_published, is_sample, servings, prep_minutes)
select 'Тестовый салат', id, 'external', true, true, 2, 10
from public.recipe_sources where title = 'Тестовый источник';

insert into public.recipes (title, origin, is_published, is_sample)
values ('Тестовый черновик', 'curated', false, true);

insert into public.recipe_ingredients (recipe_id, position, ingredient_id, quantity, unit_code, importance)
select r.id, 1, i.id, 2, 'pcs', 'key'
from public.recipes r, public.ingredients i
where r.title = 'Тестовый салат' and i.name = 'Тестовый Томат';

insert into public.recipe_ingredients (recipe_id, position, ingredient_id, unit_code, quantity_text, importance)
select r.id, 2, i.id, 'to_taste', 'по вкусу', 'minor'
from public.recipes r, public.ingredients i
where r.title = 'Тестовый салат' and i.name = 'Тестовый Томат';

insert into public.recipe_steps (recipe_id, position, instruction)
select id, 1, 'Нарезать.' from public.recipes where title = 'Тестовый салат';

-- Статус доверия без основания, внешний рецепт без источника — запрещены.
do $$
declare ok boolean := false;
begin
  begin
    insert into public.recipes (title, origin, source_checked_at) values ('X', 'curated', now());
  exception when others then ok := sqlstate = '23514';
  end;
  if not ok then raise exception 'статус «проверен» без пояснения не отклонён'; end if;

  ok := false;
  begin
    insert into public.recipes (title, origin) values ('X', 'external');
  exception when others then ok := sqlstate = '23514';
  end;
  if not ok then raise exception 'внешний рецепт без источника не отклонён'; end if;

  ok := false;
  begin
    insert into public.recipe_ingredients (recipe_id, position, ingredient_id, quantity)
    select r.id, 3, i.id, 5 from public.recipes r, public.ingredients i
    where r.title = 'Тестовый салат' and i.name = 'Тестовый Томат';
  exception when others then ok := sqlstate = '23514';
  end;
  if not ok then raise exception 'количество без единицы не отклонено'; end if;

  -- Удаление продукта, который используется в рецепте, запрещено.
  ok := false;
  begin
    delete from public.ingredients where name = 'Тестовый Томат';
  exception when others then ok := sqlstate = '23503';
  end;
  if not ok then raise exception 'удаление используемого продукта не отклонено'; end if;
end;
$$;

-- Обновление: триггер ставит updated_at сам, ручное значение не принимается.
update public.recipes set servings = 3, updated_at = '2000-01-01' where title = 'Тестовый салат';
do $$
begin
  if (select updated_at from public.recipes where title = 'Тестовый салат') < '2026-01-01' then
    raise exception 'триггер updated_at не сработал';
  end if;
end;
$$;

-- 3. Пользователь 1 -----------------------------------------------------------
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001"}', true); end; $$;

insert into public.user_products (ingredient_id, kind, quantity, unit_code, expires_on)
select id, 'current', 3, 'pcs', '2026-11-05' from public.ingredients where name = 'Тестовый Томат';

insert into public.ingredients (name, category_slug, owner_id)
values ('Соус бабушки', 'sauces', '00000000-0000-4000-8000-000000000001');

insert into public.user_products (ingredient_id, kind)
select id, 'staple' from public.ingredients where name = 'Соус бабушки';

do $$
declare ok boolean := false;
begin
  -- user_id подставился сам; читаются только свои записи.
  if (select count(*) from public.user_products) <> 2 then raise exception 'пользователь 1 не видит свои продукты'; end if;
  if exists (select 1 from public.user_products where user_id <> auth.uid()) then
    raise exception 'user_id не равен auth.uid()';
  end if;

  -- Перенос между группами, изменение количества, сброс в «неизвестно».
  update public.user_products set kind = 'staple', quantity = 500, unit_code = 'g'
  where ingredient_id = (select id from public.ingredients where name = 'Тестовый Томат');
  update public.user_products set quantity = null, unit_code = null
  where ingredient_id = (select id from public.ingredients where name = 'Тестовый Томат');
  if (select quantity from public.user_products
      where ingredient_id = (select id from public.ingredients where name = 'Тестовый Томат')) is not null then
    raise exception 'количество не сбросилось';
  end if;

  begin
    update public.user_products set quantity = 2
    where ingredient_id = (select id from public.ingredients where name = 'Тестовый Томат');
  exception when others then ok := sqlstate = '23514';
  end;
  if not ok then raise exception 'количество без единицы не отклонено'; end if;

  ok := false;
  begin
    insert into public.user_products (ingredient_id, kind)
    select id, 'current' from public.ingredients where name = 'Тестовый Томат';
  exception when others then ok := sqlstate = '23505';
  end;
  if not ok then raise exception 'повторный продукт не отклонён'; end if;

  -- Пользователь читает опубликованный рецепт, но не черновик.
  if (select count(*) from public.recipes where title like 'Тестовый%') <> 1 then
    raise exception 'видимость рецептов неверна';
  end if;
  if (select count(*) from public.recipe_ingredients ri join public.recipes r on r.id = ri.recipe_id
      where r.title = 'Тестовый салат') <> 2 then
    raise exception 'ингредиенты рецепта не читаются';
  end if;
  if (select count(*) from public.ingredient_synonyms where synonym = 'Тестовый помидор') <> 1 then
    raise exception 'синонимы не читаются';
  end if;

  -- Пользователь не может менять общий справочник и рецепты.
  ok := false;
  begin
    insert into public.ingredients (name) values ('Чужая запись в справочник');
  exception when others then ok := sqlstate = '42501';
  end;
  if not ok then raise exception 'пользователь добавил продукт в общий справочник'; end if;

  ok := false;
  begin
    insert into public.recipes (title, origin) values ('Мой рецепт', 'curated');
  exception when others then ok := sqlstate = '42501';
  end;
  if not ok then raise exception 'пользователь создал рецепт без модерации'; end if;

  update public.recipes set servings = 100 where title = 'Тестовый салат';
  update public.ingredients set name = 'Взлом' where name = 'Тестовый Томат';
end;
$$;

-- 4. Пользователь 2 не видит и не трогает чужое ------------------------------
reset role;
do $$ begin
  perform set_config('test.private_ingredient_id',
    (select id::text from public.ingredients where name = 'Соус бабушки'), true);
end; $$;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002"}', true); end; $$;

do $$
declare ok boolean := false;
begin
  if (select count(*) from public.user_products) <> 0 then raise exception 'пользователь 2 видит чужие продукты'; end if;
  if exists (select 1 from public.ingredients where name = 'Соус бабушки') then
    raise exception 'пользователь 2 видит чужой личный продукт';
  end if;

  update public.user_products set quantity = 1, unit_code = 'pcs';
  delete from public.user_products;

  -- Ссылка на чужой личный продукт по id отклоняется.
  begin
    insert into public.user_products (ingredient_id, kind)
    values (current_setting('test.private_ingredient_id')::bigint, 'current');
  exception when others then ok := sqlstate = '42501';
  end;
  if not ok then raise exception 'пользователь 2 сослался на чужой личный продукт'; end if;

  -- Одинаковое название личного продукта у разных пользователей допустимо.
  insert into public.ingredients (name, owner_id)
  values ('Соус бабушки', '00000000-0000-4000-8000-000000000002');
end;
$$;

-- 5. Проверки от имени администратора: чужие действия ничего не изменили ----
reset role;

do $$
begin
  if (select count(*) from public.user_products
      where user_id = '00000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'пользователь 2 изменил/удалил чужие продукты';
  end if;
  if exists (select 1 from public.user_products
             where user_id = '00000000-0000-4000-8000-000000000001' and quantity = 1) then
    raise exception 'пользователь 2 изменил чужое количество';
  end if;
  if (select servings from public.recipes where title = 'Тестовый салат') <> 3 then
    raise exception 'пользователь изменил рецепт';
  end if;
  if not exists (select 1 from public.ingredients where name = 'Тестовый Томат') then
    raise exception 'пользователь изменил общий справочник';
  end if;
  if (select count(*) from public.user_products
      where user_id = '00000000-0000-4000-8000-000000000002') <> 0 then
    raise exception 'пользователь 2 сохранил ссылку на чужой продукт';
  end if;
end;
$$;

-- 6. Анонимная роль не имеет доступа к данным ---------------------------------
set local role anon;
do $$
declare ok boolean := false;
begin
  begin
    perform 1 from public.user_products;
  exception when others then ok := sqlstate = '42501';
  end;
  if not ok then raise exception 'anon читает user_products'; end if;
end;
$$;
reset role;

-- 7. Каскады: удаление рецепта и пользователя ---------------------------------
delete from public.recipes where title = 'Тестовый салат';
delete from auth.users where id = '00000000-0000-4000-8000-000000000001';

do $$
begin
  if exists (select 1 from public.recipe_steps s
             where not exists (select 1 from public.recipes r where r.id = s.recipe_id)) then
    raise exception 'шаги удалённого рецепта остались';
  end if;
  if exists (select 1 from public.user_products
             where user_id = '00000000-0000-4000-8000-000000000001') then
    raise exception 'продукты удалённого пользователя остались';
  end if;
  if exists (select 1 from public.ingredients
             where owner_id = '00000000-0000-4000-8000-000000000001') then
    raise exception 'личные продукты удалённого пользователя остались';
  end if;
end;
$$;

rollback;
\echo 'a2_data_model: OK'
