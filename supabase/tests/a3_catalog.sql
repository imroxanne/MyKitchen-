-- A3: общий справочник продуктов и поиск по нормализованным названиям/синонимам.
begin;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a3', 'a3@example.test');
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3"}', true);
end; $$;

do $$
declare v_id bigint;
begin
  if (select count(*) from public.ingredients where owner_id is null) < 200 then
    raise exception 'в справочнике меньше 200 продуктов';
  end if;
  if exists (select 1 from public.ingredients where owner_id is null and default_unit is null) then
    raise exception 'у продукта справочника нет единицы по умолчанию';
  end if;
  -- Справочник не выдумывает пищевые данные: масса штуки и плотность не заполнены.
  if exists (select 1 from public.ingredients
             where owner_id is null and (piece_weight_g is not null or density_g_per_ml is not null)) then
    raise exception 'в справочнике есть непроверенные числовые данные';
  end if;

  -- Поиск по синониму после нормализации.
  select s.ingredient_id into v_id from public.ingredient_synonyms s
  where s.synonym_normalized = public.normalize_name(' ПОМИДОР ');
  if (select name from public.ingredients where id = v_id) <> 'Томат' then
    raise exception 'синоним «помидор» не ведёт к «Томат»';
  end if;
  if not exists (select 1 from public.ingredients where name_normalized = public.normalize_name('свекла')) then
    raise exception 'поиск без учёта ё не работает';
  end if;

  -- Пользователь сохраняет продукт из справочника и меняет его.
  insert into public.user_products (ingredient_id, kind) values (v_id, 'current');
  update public.user_products set quantity = 1.5, unit_code = 'kg', expires_on = '2030-01-15'
  where ingredient_id = v_id;
  if (select quantity from public.user_products where ingredient_id = v_id) <> 1.5 then
    raise exception 'количество не сохранилось';
  end if;
end;
$$;

rollback;
\echo 'a3_catalog: OK'
