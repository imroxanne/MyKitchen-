-- B1: состояния продукта, свои данные с упаковки, масса готового блюда.
begin;

do $$
begin
  -- Сырая и варёная гречка — разные строки, значения не смешаны (USDA 170685 и 170686).
  if (select string_agg(state || ':' || kcal::int, ',' order by state) from public.ingredient_nutrition n
      join public.ingredients i on i.id = n.ingredient_id where i.name = 'Гречка')
     <> 'as_purchased:346,cooked:92' then
    raise exception 'гречка: ожидались значения до и после варки';
  end if;
  if (select count(*) from public.ingredient_nutrition where state = 'cooked') < 12 then
    raise exception 'данные после варки загружены не полностью';
  end if;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000b1', 'b1@example.test'),
  ('00000000-0000-4000-8000-0000000000b2', 'b2@example.test');
insert into public.recipes (title, origin, is_published) values ('B1 рецепт', 'curated', true);
do $$ begin
  perform set_config('b1.recipe_id', id::text, true) from public.recipes where title = 'B1 рецепт';
end; $$;

set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1"}', true);
end; $$;

-- Свои данные с упаковки и масса готового блюда: создать, изменить, прочитать.
insert into public.user_ingredient_nutrition
  (ingredient_id, brand, basis, kcal, protein_g, fat_g, carbs_g, package_grams, piece_grams)
select id, 'Тестовая марка', '100ml', 52, 2.8, 2.5, 4.7, 930, null
from public.ingredients where name = 'Молоко';
update public.user_ingredient_nutrition set kcal = 53;
insert into public.recipe_yield_measurements (recipe_id, yield_grams)
values (current_setting('b1.recipe_id')::bigint, 850);

do $$
declare ok boolean := false;
begin
  if (select kcal from public.user_ingredient_nutrition) <> 53 then
    raise exception 'свои данные не изменились';
  end if;
  if (select yield_grams from public.recipe_yield_measurements) <> 850 then
    raise exception 'масса готового блюда не сохранилась';
  end if;
  -- На 100 г состав больше 100 г невозможен; для 100 мл — допустим (молоко плотнее воды).
  begin
    insert into public.user_ingredient_nutrition (ingredient_id, basis, kcal, protein_g, fat_g, carbs_g)
    select id, '100g', 900, 60, 50, 0 from public.ingredients where name = 'Сахар';
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'принят состав больше 100 г на 100 г'; end if;
  ok := false;
  begin
    insert into public.recipe_yield_measurements (recipe_id, yield_grams)
    values (current_setting('b1.recipe_id')::bigint, 0);
  exception when check_violation or unique_violation then ok := true;
  end;
  if not ok then raise exception 'принята нулевая масса блюда'; end if;
  -- Справочные данные пользователь не меняет.
  update public.ingredient_nutrition set kcal = 1;
  if found then raise exception 'пользователь изменил справочные КБЖУ'; end if;
end;
$$;

-- Другой пользователь не видит и не меняет чужие данные.
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2"}', true);
end; $$;
do $$
declare ok boolean := false;
begin
  if exists (select 1 from public.user_ingredient_nutrition)
     or exists (select 1 from public.recipe_yield_measurements) then
    raise exception 'чужие данные с упаковки или взвешивания видны';
  end if;
  update public.user_ingredient_nutrition set kcal = 1;
  delete from public.recipe_yield_measurements;
  begin
    insert into public.user_ingredient_nutrition (user_id, ingredient_id, basis, kcal, protein_g, fat_g, carbs_g)
    select '00000000-0000-4000-8000-0000000000b1', id, '100g', 1, 0, 0, 0
    from public.ingredients where name = 'Сахар';
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'записаны данные за другого пользователя'; end if;
end;
$$;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1"}', true);
end; $$;
do $$
begin
  if (select kcal from public.user_ingredient_nutrition) <> 53
     or not exists (select 1 from public.recipe_yield_measurements) then
    raise exception 'чужой пользователь изменил или удалил данные';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
declare ok boolean := false;
begin
  begin
    perform 1 from public.user_ingredient_nutrition;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'аноним читает данные с упаковки'; end if;
end;
$$;

rollback;
\echo 'b1_nutrition_reference: OK'
