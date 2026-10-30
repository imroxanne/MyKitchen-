-- Фото блюда: только https или копия на сайте, всегда с подписью об авторе/правах (ТЗ §4);
-- менять фото и загружать файлы может только владелица.
begin;

insert into public.recipes (title, origin, is_published, image_url, image_credit)
values ('Фото с подписью', 'curated', true, 'https://example.test/dish.jpg', 'Фото: автор, CC BY-SA 4.0');

do $$
declare
  ok boolean;
begin
  ok := false;
  begin
    insert into public.recipes (title, origin, image_url) values ('Фото без подписи', 'curated', 'https://example.test/x.jpg');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'фото без подписи об авторе принято'; end if;

  ok := false;
  begin
    insert into public.recipes (title, origin, image_url, image_credit)
    values ('Не https', 'curated', 'javascript:alert(1)', 'Фото: автор');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'ссылка на фото не по http(s) принята'; end if;

  ok := false;
  begin
    insert into public.recipes (title, origin, image_url, image_credit)
    values ('Пустая подпись', 'curated', 'https://example.test/y.jpg', '   ');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'пустая подпись к фото принята'; end if;

  ok := false;
  begin
    insert into public.recipes (title, origin, image_url, image_credit)
    values ('Не https', 'curated', 'http://example.test/z.jpg', 'Фото: автор');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'фото по незащищённому http принято'; end if;

  -- Копия на самом сайте — допустима.
  insert into public.recipes (title, origin, image_url, image_credit)
  values ('Копия на сайте', 'curated', '/recipe-images/test.jpg', 'Фото: автор, CC BY 2.0');
end;
$$;

-- Фото партии images-01 нашли свои рецепты, у каждого есть подпись и страница фото.
do $$ begin
  if (select count(*) from public.recipes
      where image_url like '/recipe-images/%' and image_credit like 'Фото: %'
        and image_source_url like 'https://commons.wikimedia.org/%') < 20 then
    raise exception 'фото из источников проставлены не всем рецептам партии';
  end if;
end; $$;

-- Владелица и обычный пользователь.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000d1', 'd1@example.test'),
  ('00000000-0000-4000-8000-0000000000d2', 'd2@example.test');
insert into public.app_admins (user_id) values ('00000000-0000-4000-8000-0000000000d2');
do $$ begin
  perform set_config('t.recipe', id::text, true) from public.recipes where title = 'Фото с подписью';
end; $$;

-- Вошедший пользователь читает фото и подпись опубликованного рецепта.
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1"}', true);
  if not exists (
    select 1 from public.recipes
    where title = 'Фото с подписью' and image_credit = 'Фото: автор, CC BY-SA 4.0'
  ) then
    raise exception 'фото опубликованного рецепта не читается';
  end if;
end; $$;

-- Обычный пользователь: не владелица, фото менять и загружать не может.
do $$
declare ok boolean := false;
begin
  if public.is_admin() then raise exception 'обычный пользователь считается владелицей'; end if;
  begin
    perform public.set_recipe_image(current_setting('t.recipe')::bigint, null, null);
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'обычный пользователь убрал фото рецепта'; end if;
  ok := false;
  begin
    insert into storage.objects (bucket_id, name) values ('recipe-images', 'd1/x.jpg');
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'обычный пользователь загрузил файл в хранилище фото'; end if;
  if exists (select 1 from public.app_admins) then
    raise exception 'обычный пользователь видит список владельцев';
  end if;
end;
$$;

-- Владелица: загружает файл, ставит и убирает фото; без подписи фото не принимается.
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d2"}', true);
end; $$;
do $$
declare ok boolean := false;
begin
  if not public.is_admin() then raise exception 'владелица не распознана'; end if;
  insert into storage.objects (bucket_id, name) values ('recipe-images', 'd2/x.jpg');
  perform public.set_recipe_image(current_setting('t.recipe')::bigint,
    'https://example.test/storage/v1/object/public/recipe-images/d2/x.jpg', 'Фото: моё', null);
  if not exists (select 1 from public.recipes where image_credit = 'Фото: моё') then
    raise exception 'фото владелицы не сохранилось';
  end if;
  begin
    perform public.set_recipe_image(current_setting('t.recipe')::bigint, 'https://example.test/y.jpg', null);
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'фото без подписи принято через функцию'; end if;
  perform public.set_recipe_image(current_setting('t.recipe')::bigint, null, null);
  if exists (select 1 from public.recipes where id = current_setting('t.recipe')::bigint
             and (image_url is not null or image_credit is not null)) then
    raise exception 'фото не убралось';
  end if;
end;
$$;

rollback;
