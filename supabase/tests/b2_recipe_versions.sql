-- B2: своя версия рецепта сохраняется отдельно, оригинал неизменен, чужие версии недоступны.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'c1@example.test'),
  ('00000000-0000-4000-8000-0000000000c2', 'c2@example.test');
insert into public.recipes (title, origin, is_published, servings) values ('B2 рецепт', 'curated', true, 4);
insert into public.recipe_ingredients (recipe_id, position, ingredient_id, quantity, unit_code, importance)
select r.id, 1, i.id, 300, 'g', 'key' from public.recipes r, public.ingredients i
where r.title = 'B2 рецепт' and i.name = 'Свёкла' and i.owner_id is null;
insert into public.recipe_ingredients (recipe_id, position, ingredient_id, quantity, unit_code, importance)
select r.id, 2, i.id, 2, 'tbsp', 'optional' from public.recipes r, public.ingredients i
where r.title = 'B2 рецепт' and i.name = 'Сметана' and i.owner_id is null;
-- Личный продукт второго пользователя.
insert into public.ingredients (name, owner_id) values ('B2 чужой продукт', '00000000-0000-4000-8000-0000000000c2');

do $$ begin
  perform set_config('b2.recipe', id::text, true) from public.recipes where title = 'B2 рецепт';
  perform set_config('b2.beet', id::text, true) from public.ingredients where name = 'Свёкла' and owner_id is null;
  perform set_config('b2.milk', id::text, true) from public.ingredients where name = 'Молоко' and owner_id is null;
  perform set_config('b2.foreign', id::text, true) from public.ingredients where name = 'B2 чужой продукт';
end; $$;

set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1"}', true);
end; $$;

do $$
declare
  v_id bigint;
  v_again bigint;
  ok boolean := false;
  lines jsonb := jsonb_build_array(
    jsonb_build_object('ingredientId', current_setting('b2.beet')::bigint, 'quantity', 150,
      'unitCode', 'g', 'importance', 'key', 'originalPosition', 1),
    -- Замена: сметана → молоко.
    jsonb_build_object('ingredientId', current_setting('b2.milk')::bigint, 'quantity', 1, 'unitCode', 'tbsp',
      'importance', 'optional', 'originalPosition', 2)
  );
begin
  -- Создать версию на 2 порции.
  v_id := public.save_recipe_version(null, current_setting('b2.recipe')::bigint, 'На двоих', 2, null, null, lines);
  if (select count(*) from public.recipe_version_ingredients where version_id = v_id) <> 2 then
    raise exception 'состав версии не сохранился';
  end if;
  -- Оригинал не изменился.
  if (select string_agg(position || ':' || quantity || unit_code, ',' order by position)
      from public.recipe_ingredients where recipe_id = current_setting('b2.recipe')::bigint)
     <> '1:300g,2:2tbsp' then
    raise exception 'оригинальный рецепт изменился';
  end if;
  -- Повторное сохранение заменяет состав целиком (удалили вторую строку, добавили новую).
  v_again := public.save_recipe_version(v_id, current_setting('b2.recipe')::bigint, 'На двоих', 2, 500, null,
    jsonb_build_array(
      jsonb_build_object('ingredientId', current_setting('b2.beet')::bigint, 'quantity', 200, 'unitCode', 'g'),
      jsonb_build_object('ingredientId', current_setting('b2.beet')::bigint, 'quantity', null, 'unitCode', null)
    ));
  if v_again <> v_id
     or (select string_agg(position || ':' || coalesce(quantity::text, '-') || ':' || coalesce(original_position::text, 'new'), ',' order by position)
         from public.recipe_version_ingredients where version_id = v_id) <> '1:200:new,2:-:new'
     or (select yield_grams from public.recipe_versions where id = v_id) <> 500 then
    raise exception 'повторное сохранение не заменило версию';
  end if;

  -- Оригинал пользователю не изменить.
  begin
    update public.recipe_ingredients set quantity = 1;
    if found then raise exception 'пользователь изменил оригинал'; end if;
    insert into public.recipe_ingredients (recipe_id, position, ingredient_id)
    values (current_setting('b2.recipe')::bigint, 9, current_setting('b2.beet')::bigint);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'пользователь добавил строку в оригинал'; end if;

  -- Неверные данные: пустой состав, количество без единицы, чужой личный продукт.
  ok := false;
  begin
    perform public.save_recipe_version(null, current_setting('b2.recipe')::bigint, 'Пусто', null, null, null, '[]');
  exception when others then ok := sqlstate = 'P0001';
  end;
  if not ok then raise exception 'сохранена пустая версия'; end if;
  ok := false;
  begin
    perform public.save_recipe_version(null, current_setting('b2.recipe')::bigint, 'Без единицы', null, null, null,
      jsonb_build_array(jsonb_build_object('ingredientId', current_setting('b2.beet')::bigint, 'quantity', 5)));
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'сохранено количество без единицы'; end if;
  ok := false;
  begin
    perform public.save_recipe_version(null, current_setting('b2.recipe')::bigint, 'Чужое', null, null, null,
      jsonb_build_array(jsonb_build_object('ingredientId', current_setting('b2.foreign')::bigint)));
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'в версию добавлен чужой личный продукт'; end if;

  perform set_config('b2.version', v_id::text, true);
end;
$$;

-- Другой пользователь: не видит, не меняет и не удаляет чужую версию.
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2"}', true);
end; $$;
do $$
declare ok boolean := false;
begin
  if exists (select 1 from public.recipe_versions) or exists (select 1 from public.recipe_version_ingredients) then
    raise exception 'чужая версия видна';
  end if;
  begin
    perform public.save_recipe_version(current_setting('b2.version')::bigint, current_setting('b2.recipe')::bigint,
      'Взлом', null, null, null,
      jsonb_build_array(jsonb_build_object('ingredientId', current_setting('b2.beet')::bigint)));
  exception when others then ok := sqlstate = 'P0001';
  end;
  if not ok then raise exception 'чужая версия перезаписана'; end if;
  ok := false;
  begin
    insert into public.recipe_version_ingredients (version_id, position, ingredient_id)
    values (current_setting('b2.version')::bigint, 9, current_setting('b2.beet')::bigint);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'в чужую версию добавлена строка'; end if;
  delete from public.recipe_versions;
end;
$$;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1"}', true);
end; $$;
do $$
begin
  if (select name from public.recipe_versions) <> 'На двоих' then
    raise exception 'чужой пользователь изменил или удалил версию';
  end if;
  -- Удаление своей версии удаляет и её состав.
  delete from public.recipe_versions;
  if exists (select 1 from public.recipe_version_ingredients) then
    raise exception 'состав удалённой версии остался';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
declare ok boolean := false;
begin
  begin
    perform 1 from public.recipe_versions;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'аноним читает версии'; end if;
end;
$$;

rollback;
\echo 'b2_recipe_versions: OK'
