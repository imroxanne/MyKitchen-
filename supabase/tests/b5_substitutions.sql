-- B5: справочник замен полный и непротиворечивый; у каждой замены есть применимость и
-- предупреждение; состав каждой замены размечен (иначе безопасность не проверить); справочник
-- только для чтения.
begin;

do $$
declare ok boolean := false;
begin
  if (select count(*) from public.ingredient_substitutions) < 50 then
    raise exception 'справочник замен не загружен';
  end if;
  -- Замена с неразмеченным составом не может быть оценена по ограничениям.
  if exists (
    select 1 from public.ingredient_substitutions s
    join public.ingredients t on t.id = s.to_ingredient_id
    where not t.composition_reviewed
  ) then
    raise exception 'есть замена с непроверенным составом';
  end if;
  -- Пример из ТЗ §7: безлактозное молоко — без лактозы, но с белком молока.
  if (select string_agg(g.group_code, ',' order by g.group_code)
      from public.ingredient_substitutions s
      join public.ingredients f on f.id = s.from_ingredient_id and f.name = 'Молоко'
      join public.ingredients t on t.id = s.to_ingredient_id and t.name = 'Молоко безлактозное'
      join public.ingredient_restriction_groups g on g.ingredient_id = t.id) <> 'milk' then
    raise exception 'замена молока на безлактозное: состав замены должен содержать белок молока';
  end if;
  -- Без предупреждения и применимости замену не сохранить.
  begin
    insert into public.ingredient_substitutions
      (from_ingredient_id, to_ingredient_id, ratio, amount_note, scope_note, effect, warning, confidence)
    select f.id, t.id, 1, '1:1', 'везде', 'никак', '', 'practice'
    from public.ingredients f, public.ingredients t
    where f.name = 'Морковь' and t.name = 'Свёкла' and f.owner_id is null and t.owner_id is null;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'замена без предупреждения принята'; end if;
  ok := false;
  begin
    insert into public.ingredient_substitutions
      (from_ingredient_id, to_ingredient_id, ratio, amount_note, contexts, scope_note, effect, warning,
       confidence)
    select f.id, t.id, 1, '1:1', '{microwave}', 'везде', 'никак', 'осторожно', 'practice'
    from public.ingredients f, public.ingredients t
    where f.name = 'Морковь' and t.name = 'Свёкла' and f.owner_id is null and t.owner_id is null;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'неизвестный вид блюда принят'; end if;
end;
$$;

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000f1', 'f1@example.test');
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1"}', true);
end; $$;
do $$
declare ok boolean := false;
begin
  if (select count(*) from public.ingredient_substitutions) < 50 then
    raise exception 'пользователь не видит справочник замен';
  end if;
  begin
    update public.ingredient_substitutions set warning = 'безопасно';
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'пользователь изменил справочник замен'; end if;
end;
$$;

reset role;
set local role anon;
do $$
declare ok boolean := false;
begin
  begin
    perform 1 from public.ingredient_substitutions;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'аноним читает справочник замен'; end if;
end;
$$;

rollback;
\echo 'b5_substitutions: OK'
