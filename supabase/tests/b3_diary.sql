-- B3: дневник — доли порций считаются верно, снимок не меняется вслед за рецептом и не
-- редактируется, записи приватны.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000d1', 'd1@example.test'),
  ('00000000-0000-4000-8000-0000000000d2', 'd2@example.test');
insert into public.recipes (title, origin, is_published, servings) values ('B3 рецепт', 'curated', true, 3);
insert into public.recipe_ingredients (recipe_id, position, ingredient_id, quantity, unit_code, importance)
select r.id, 1, i.id, 300, 'g', 'key' from public.recipes r, public.ingredients i
where r.title = 'B3 рецепт' and i.name = 'Свёкла' and i.owner_id is null;
insert into public.recipes (title, origin, is_published) values ('B3 черновик', 'curated', false);
insert into public.ingredients (name, owner_id) values ('B3 чужой продукт', '00000000-0000-4000-8000-0000000000d2');

do $$ begin
  perform set_config('b3.recipe', id::text, true) from public.recipes where title = 'B3 рецепт';
  perform set_config('b3.draft', id::text, true) from public.recipes where title = 'B3 черновик';
  perform set_config('b3.beet', id::text, true) from public.ingredients where name = 'Свёкла' and owner_id is null;
  perform set_config('b3.foreign', id::text, true) from public.ingredients where name = 'B3 чужой продукт';
end; $$;

set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1"}', true);
end; $$;

do $$
declare
  e_id bigint;
  p_id bigint;
  ok boolean := false;
  r record;
begin
  -- Блюдо на 3 порции, 360 ккал; съедено 1,5 порции → 180 ккал.
  insert into public.diary_entries (eaten_on, meal, kind, title, recipe_id, base_servings, base_amount,
    base_kcal, base_protein, base_fat, base_carbs, composition, servings)
  values ('2026-10-30', 'lunch', 'recipe', 'B3 рецепт', current_setting('b3.recipe')::bigint, 3, 900,
    360, 15, 30, 45, '[{"name":"Свёкла","amount":"300 г","kcal":360}]', 1.5)
  returning id into e_id;
  select * into r from public.diary_entries where id = e_id;
  if (r.kcal, r.protein, r.fat, r.carbs) <> (180::numeric, 7.5::numeric, 15::numeric, 22.5::numeric) then
    raise exception '1,5 порции посчитаны неверно: % % % %', r.kcal, r.protein, r.fat, r.carbs;
  end if;

  -- Правка количества: 0,5 порции → 60 ккал; затем по массе: 450 г из 900 → 180 ккал.
  update public.diary_entries set servings = 0.5 where id = e_id;
  if (select kcal from public.diary_entries where id = e_id) <> 60 then
    raise exception '0,5 порции посчитаны неверно';
  end if;
  update public.diary_entries set servings = null, amount = 450 where id = e_id;
  if (select kcal from public.diary_entries where id = e_id) <> 180 then
    raise exception 'съеденная масса посчитана неверно';
  end if;

  -- Правка рецепта не меняет запись: снимок хранится в самой записи.
  reset role;
  update public.recipe_ingredients set quantity = 1000 where recipe_id = current_setting('b3.recipe')::bigint;
  update public.recipes set servings = 10 where id = current_setting('b3.recipe')::bigint;
  set local role authenticated;
  if (select (kcal, base_servings, composition->0->>'amount')::text from public.diary_entries where id = e_id)
     <> '(180.00,3,"300 г")' then
    raise exception 'запись изменилась вслед за рецептом';
  end if;

  -- Снимок пользователю не изменить.
  begin
    update public.diary_entries set base_kcal = 1 where id = e_id;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'снимок КБЖУ изменён'; end if;
  ok := false;
  begin
    update public.diary_entries set composition = '[]' where id = e_id;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'снимок состава изменён'; end if;

  -- Продукт без рецепта: 100 г — основа, съедено 250 г.
  insert into public.diary_entries (eaten_on, meal, kind, title, ingredient_id, base_amount,
    base_kcal, base_protein, base_fat, base_carbs, amount)
  values ('2026-10-30', 'snack', 'product', 'Свёкла', current_setting('b3.beet')::bigint, 100, 43, 1.6, 0.2, 9.6, 250)
  returning id into p_id;
  if (select kcal from public.diary_entries where id = p_id) <> 107.5 then
    raise exception 'продукт посчитан неверно';
  end if;

  -- Неверные записи: порции без основы-порций, оба способа сразу, ни одного.
  ok := false;
  begin
    insert into public.diary_entries (eaten_on, meal, kind, title, base_amount, base_kcal, base_protein,
      base_fat, base_carbs, servings)
    values ('2026-10-30', 'snack', 'custom', 'Без порций', 100, 1, 1, 1, 1, 1);
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'порции без основы-порций приняты'; end if;
  ok := false;
  begin
    insert into public.diary_entries (eaten_on, meal, kind, title, base_servings, base_amount, base_kcal,
      base_protein, base_fat, base_carbs, servings, amount)
    values ('2026-10-30', 'snack', 'custom', 'Оба', 1, 100, 1, 1, 1, 1, 1, 100);
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'порции и масса сразу приняты'; end if;
  ok := false;
  begin
    insert into public.diary_entries (eaten_on, meal, kind, title, base_servings, base_kcal,
      base_protein, base_fat, base_carbs)
    values ('2026-10-30', 'snack', 'custom', 'Ничего', 1, 1, 1, 1, 1);
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'запись без количества принята'; end if;

  -- Ссылки только на видимое: чужой личный продукт и неопубликованный рецепт — нельзя.
  ok := false;
  begin
    insert into public.diary_entries (eaten_on, meal, kind, title, ingredient_id, base_amount,
      base_kcal, base_protein, base_fat, base_carbs, amount)
    values ('2026-10-30', 'snack', 'product', 'Чужое', current_setting('b3.foreign')::bigint, 100, 1, 1, 1, 1, 10);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'записан чужой личный продукт'; end if;
  ok := false;
  begin
    insert into public.diary_entries (eaten_on, meal, kind, title, recipe_id, base_servings,
      base_kcal, base_protein, base_fat, base_carbs, servings)
    values ('2026-10-30', 'snack', 'recipe', 'Черновик', current_setting('b3.draft')::bigint, 1, 1, 1, 1, 1, 1);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'записан неопубликованный рецепт'; end if;

  perform set_config('b3.entry', e_id::text, true);
end;
$$;

-- Другой пользователь не видит, не меняет и не удаляет чужие записи.
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d2"}', true);
end; $$;
do $$
begin
  if exists (select 1 from public.diary_entries) then raise exception 'чужой дневник виден'; end if;
  update public.diary_entries set servings = 5, amount = null;
  delete from public.diary_entries;
end;
$$;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1"}', true);
end; $$;
do $$
begin
  if (select count(*) from public.diary_entries) <> 2
     or (select kcal from public.diary_entries where id = current_setting('b3.entry')::bigint) <> 180 then
    raise exception 'чужой пользователь изменил или удалил записи';
  end if;
  delete from public.diary_entries where id = current_setting('b3.entry')::bigint;
  if (select count(*) from public.diary_entries) <> 1 then raise exception 'запись не удалилась'; end if;
end;
$$;

reset role;
set local role anon;
do $$
declare ok boolean := false;
begin
  begin
    perform 1 from public.diary_entries;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'аноним читает дневник'; end if;
end;
$$;

rollback;
\echo 'b3_diary: OK'
