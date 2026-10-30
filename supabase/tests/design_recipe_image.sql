-- Фото блюда: только https и только с подписью об авторе/правах (ТЗ §4).
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
end;
$$;

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

rollback;
