-- B4: разметка продуктов полная и верная в ключевых местах; ограничения пользователя приватны;
-- переносимые продукты — только при непереносимости или предпочтении, не при аллергии.
begin;

do $$
begin
  if exists (select 1 from public.ingredients where owner_id is null and not composition_reviewed) then
    raise exception 'есть неразмеченные продукты общего справочника: %',
      (select string_agg(name, ', ') from public.ingredients where owner_id is null and not composition_reviewed);
  end if;
  -- Ключевые случаи из ТЗ §7.
  if (select string_agg(g.group_code || ':' || g.relation, ',' order by g.group_code)
      from public.ingredient_restriction_groups g join public.ingredients i on i.id = g.ingredient_id
      where i.name = 'Молоко безлактозное' and i.owner_id is null) <> 'milk:contains' then
    raise exception 'безлактозное молоко: белок молока должен остаться, лактозы — нет';
  end if;
  if not exists (select 1 from public.ingredient_restriction_groups g join public.ingredients i on i.id = g.ingredient_id
                 where i.name = 'Овсяные хлопья' and g.group_code = 'gluten' and g.relation = 'contains') then
    raise exception 'овёс должен считаться содержащим глютен';
  end if;
  if (select count(*) from public.ingredient_restriction_groups g join public.ingredients i on i.id = g.ingredient_id
      where i.name = 'Соевый соус' and g.group_code in ('soy', 'gluten') and g.relation = 'contains') <> 2 then
    raise exception 'соевый соус: соя и глютен';
  end if;
  if not exists (select 1 from public.ingredient_restriction_groups g join public.ingredients i on i.id = g.ingredient_id
                 where i.name = 'Гречка' and g.group_code = 'gluten' and g.relation = 'may_contain') then
    raise exception 'гречка: возможен перекрёстный контакт с глютеном';
  end if;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'e1@example.test'),
  ('00000000-0000-4000-8000-0000000000e2', 'e2@example.test');
insert into public.ingredients (name, owner_id) values ('B4 чужой продукт', '00000000-0000-4000-8000-0000000000e2');

do $$ begin
  perform set_config('b4.cheese', id::text, true) from public.ingredients where name = 'Сыр твёрдый' and owner_id is null;
  perform set_config('b4.cilantro', id::text, true) from public.ingredients where name = 'Кинза' and owner_id is null;
  perform set_config('b4.foreign', id::text, true) from public.ingredients where name = 'B4 чужой продукт';
end; $$;

set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1"}', true);
end; $$;

do $$
declare
  milk_id bigint;
  lactose_id bigint;
  ok boolean := false;
begin
  -- Справочник групп и разметку пользователь только читает.
  if (select count(*) from public.restriction_groups) < 20 then raise exception 'группы не видны'; end if;
  begin
    update public.restriction_groups set name = 'x';
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'пользователь изменил справочник групп'; end if;
  ok := false;
  begin
    delete from public.ingredient_restriction_groups;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'пользователь удалил разметку'; end if;

  -- Личный продукт не может быть «проверен».
  ok := false;
  begin
    insert into public.ingredients (name, owner_id, composition_reviewed)
    values ('B4 мой продукт', '00000000-0000-4000-8000-0000000000e1', true);
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'личный продукт отмечен проверенным'; end if;

  insert into public.user_restrictions (kind, group_code) values ('allergy', 'milk') returning id into milk_id;
  insert into public.user_restrictions (kind, group_code, note) values ('intolerance', 'lactose', 'немного можно')
    returning id into lactose_id;
  insert into public.user_restrictions (kind, ingredient_id) values ('preference', current_setting('b4.cilantro')::bigint);

  -- Повтор той же группы — нельзя (вид меняется правкой).
  ok := false;
  begin
    insert into public.user_restrictions (kind, group_code) values ('preference', 'milk');
  exception when unique_violation then ok := true;
  end;
  if not ok then raise exception 'группа добавлена дважды'; end if;

  -- Переносимый продукт: при непереносимости — можно, при аллергии — нет.
  insert into public.user_restriction_exceptions (restriction_id, ingredient_id)
  values (lactose_id, current_setting('b4.cheese')::bigint);
  ok := false;
  begin
    insert into public.user_restriction_exceptions (restriction_id, ingredient_id)
    values (milk_id, current_setting('b4.cheese')::bigint);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'исключение при аллергии принято'; end if;

  -- Цель ограничения не меняется; вид меняется, и при аллергии исключения снимаются.
  ok := false;
  begin
    update public.user_restrictions set group_code = 'eggs' where id = lactose_id;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'изменена группа ограничения'; end if;
  update public.user_restrictions set kind = 'allergy' where id = lactose_id;
  if exists (select 1 from public.user_restriction_exceptions where restriction_id = lactose_id) then
    raise exception 'исключения остались после смены на аллергию';
  end if;

  -- Чужой личный продукт — нельзя.
  ok := false;
  begin
    insert into public.user_restrictions (kind, ingredient_id) values ('preference', current_setting('b4.foreign')::bigint);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'ограничение на чужой личный продукт принято'; end if;

  perform set_config('b4.milk', milk_id::text, true);
end;
$$;

-- Другой пользователь не видит и не меняет чужие ограничения.
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2"}', true);
end; $$;
do $$
declare ok boolean := false;
begin
  if exists (select 1 from public.user_restrictions) then raise exception 'чужие ограничения видны'; end if;
  update public.user_restrictions set kind = 'preference';
  delete from public.user_restrictions;
  begin
    insert into public.user_restriction_exceptions (restriction_id, ingredient_id)
    values (current_setting('b4.milk')::bigint, current_setting('b4.cheese')::bigint);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'исключение к чужому ограничению принято'; end if;
end;
$$;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1"}', true);
end; $$;
do $$
begin
  if (select string_agg(kind || ':' || coalesce(group_code, 'продукт'), ',' order by id) from public.user_restrictions)
     <> 'allergy:milk,allergy:lactose,preference:продукт' then
    raise exception 'чужой пользователь изменил ограничения';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
declare ok boolean := false;
begin
  begin
    perform 1 from public.user_restrictions;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'аноним читает ограничения'; end if;
end;
$$;

rollback;
\echo 'b4_restrictions: OK'
