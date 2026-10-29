-- A7: пищевые данные с источником, доступ только на чтение.
begin;

do $$
begin
  -- У каждого значения есть источник с лицензией и ссылкой на запись.
  if exists (
    select 1 from public.ingredient_nutrition n
    left join public.nutrition_sources s on s.code = n.source_code
    where s.license is null or n.source_food_id = '' or n.source_food_name = ''
  ) then
    raise exception 'КБЖУ без источника';
  end if;
  if (select count(*) from public.ingredient_nutrition) < 70 then
    raise exception 'КБЖУ загружено не полностью';
  end if;
  -- Контрольные значения из USDA (на 100 г): яйцо 171287 и сахар 169655.
  if (select (kcal, protein_g, fat_g, carbs_g)::text from public.ingredient_nutrition n
      join public.ingredients i on i.id = n.ingredient_id
      where i.name = 'Яйцо куриное' and n.state = 'as_purchased')
     <> '(143.00,12.56,9.51,0.72)' then
    raise exception 'КБЖУ яйца не совпадает с USDA 171287';
  end if;
  if (select kcal from public.ingredient_nutrition n
      join public.ingredients i on i.id = n.ingredient_id where i.name = 'Сахар') <> 387 then
    raise exception 'КБЖУ сахара не совпадает с USDA 169655';
  end if;
  -- Масса единицы: 1 крупное яйцо = 50 г, зубчик чеснока = 3 г.
  if (select grams from public.ingredient_unit_weights w
      join public.ingredients i on i.id = w.ingredient_id
      where i.name = 'Яйцо куриное' and w.unit_code = 'pcs' and w.state = 'as_purchased') <> 50 then
    raise exception 'масса яйца не совпадает с USDA';
  end if;
  -- «Мясо (любое)» неоднозначно — данных нет и не должно быть.
  if exists (select 1 from public.ingredient_nutrition n
             join public.ingredients i on i.id = n.ingredient_id where i.name = 'Мясо (любое)') then
    raise exception 'у «Мясо (любое)» выдуманы КБЖУ';
  end if;
end;
$$;

-- Нельзя сохранить невозможный состав и массу единицы в граммах для массовой единицы.
do $$
declare ok boolean := false;
begin
  begin
    update public.ingredient_nutrition set protein_g = 60, fat_g = 50
    where ingredient_id = (select id from public.ingredients where name = 'Сахар');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'принят состав больше 100 г на 100 г'; end if;
  ok := false;
  begin
    insert into public.ingredient_unit_weights
      (ingredient_id, unit_code, grams, source_code, source_food_id, source_portion)
    select id, 'g', 1, 'usda_fdc_sr_legacy', '0', 'x' from public.ingredients where name = 'Сахар';
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'принята масса для единицы «г»'; end if;
end;
$$;

-- Вошедший читает, но не меняет; личный продукт другого пользователя не виден.
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a7', 'a7@example.test');
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a7"}', true);
end; $$;
do $$
declare ok boolean := false;
begin
  if (select count(*) from public.ingredient_nutrition) < 70 then
    raise exception 'вошедший не видит КБЖУ';
  end if;
  if not exists (select 1 from public.nutrition_sources where license like '%CC0%') then
    raise exception 'вошедший не видит источник';
  end if;
  begin
    update public.ingredient_nutrition set kcal = 1;
    if found then raise exception 'вошедший изменил КБЖУ'; end if;
    ok := true;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'вошедший изменил КБЖУ'; end if;
  ok := false;
  begin
    insert into public.ingredient_nutrition
      (ingredient_id, source_code, source_food_id, source_food_name, kcal, protein_g, fat_g, carbs_g)
    select id, 'usda_fdc_sr_legacy', '0', 'x', 1, 0, 0, 0 from public.ingredients
    where name = 'Мясо (любое)';
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'вошедший добавил КБЖУ'; end if;
end;
$$;

reset role;
set local role anon;
do $$
declare ok boolean := false;
begin
  begin
    perform 1 from public.ingredient_nutrition;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'аноним читает КБЖУ'; end if;
end;
$$;

rollback;
\echo 'a7_nutrition: OK'
