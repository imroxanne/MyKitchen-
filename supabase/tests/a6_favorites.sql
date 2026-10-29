-- A6: избранное видно и меняется только владельцем.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a6', 'a6@example.test'),
  ('00000000-0000-4000-8000-0000000000b6', 'b6@example.test');
insert into public.recipes (title, origin, is_published) values ('A6 опубликованный', 'curated', true);
insert into public.recipes (title, origin, owner_id, is_published)
values ('A6 черновик чужой', 'user', '00000000-0000-4000-8000-0000000000b6', false);
-- id черновика запоминаем заранее: пользователю A6 он не виден.
select set_config('a6.draft_id', id::text, true) from public.recipes where title = 'A6 черновик чужой';

set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a6"}', true);
end; $$;

-- Своё избранное: добавить, прочитать; повтор — ошибка уникальности.
insert into public.favorite_recipes (recipe_id)
select id from public.recipes where title = 'A6 опубликованный';
do $$
declare ok boolean := false;
begin
  if (select count(*) from public.favorite_recipes) <> 1 then
    raise exception 'своё избранное не видно';
  end if;
  begin
    insert into public.favorite_recipes (recipe_id)
    select id from public.recipes where title = 'A6 опубликованный';
  exception when unique_violation then ok := true;
  end;
  if not ok then raise exception 'рецепт добавлен в избранное дважды'; end if;
end;
$$;

-- Чужой неопубликованный рецепт и запись за другого пользователя — запрещены.
do $$
declare ok boolean := false;
begin
  begin
    insert into public.favorite_recipes (recipe_id)
    values (current_setting('a6.draft_id')::bigint);
  exception when others then ok := sqlstate = '42501';
  end;
  if not ok then raise exception 'в избранное добавлен невидимый рецепт'; end if;

  ok := false;
  begin
    insert into public.favorite_recipes (user_id, recipe_id)
    select '00000000-0000-4000-8000-0000000000b6', id from public.recipes where title = 'A6 опубликованный';
  exception when others then ok := sqlstate = '42501';
  end;
  if not ok then raise exception 'добавлено избранное за другого пользователя'; end if;
end;
$$;

-- Другой пользователь не видит и не удаляет чужое избранное.
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b6"}', true);
end; $$;
do $$
begin
  if exists (select 1 from public.favorite_recipes) then
    raise exception 'чужое избранное видно';
  end if;
  delete from public.favorite_recipes;
end;
$$;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a6"}', true);
end; $$;
do $$
begin
  if (select count(*) from public.favorite_recipes) <> 1 then
    raise exception 'чужой пользователь удалил избранное';
  end if;
  -- Удаление своего.
  delete from public.favorite_recipes;
  if exists (select 1 from public.favorite_recipes) then
    raise exception 'своё избранное не удаляется';
  end if;
end;
$$;

-- Аноним не имеет доступа.
reset role;
set local role anon;
do $$
declare ok boolean := false;
begin
  begin
    perform 1 from public.favorite_recipes;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'аноним читает избранное'; end if;
end;
$$;

rollback;
\echo 'a6_favorites: OK'
