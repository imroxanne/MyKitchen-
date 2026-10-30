-- Фото блюд: копии с сайта (public/recipe-images, из источников со свободной лицензией)
-- и фото, загруженные владелицей через кнопку. ТЗ §4: у каждого фото — автор и права.

-- Адрес фото: копия на самом сайте или https (хранилище Supabase).
alter table public.recipes drop constraint recipes_image_url_check;
alter table public.recipes
  add constraint recipes_image_url_check check (image_url ~ '^(https://|/recipe-images/)');

-- Страница фото с автором и лицензией (например, файл на Wikimedia Commons).
alter table public.recipes add column image_source_url text check (image_source_url ~ '^https://');
comment on column public.recipes.image_source_url is 'Страница фото: автор, лицензия, оригинал';

-- Владелица сервиса. Строки добавляются только вручную в облаке (не миграцией: id — личные данные).
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.app_admins is 'Владелица: меняет общие данные (фото рецептов); не роль модератора C1';
alter table public.app_admins enable row level security;
create policy app_admins_read_self on public.app_admins for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.app_admins from anon;

create function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()))
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Хранилище загруженных фото: читать может любой по ссылке, менять — только владелица.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy recipe_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-images' and (select public.is_admin()));
create policy recipe_images_update on storage.objects for update to authenticated
  using (bucket_id = 'recipe-images' and (select public.is_admin()));
create policy recipe_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-images' and (select public.is_admin()));

-- Поставить или убрать фото рецепта. Меняются только поля фото; без подписи фото не принять.
create function public.set_recipe_image(
  p_recipe_id bigint,
  p_url text,
  p_credit text,
  p_source_url text default null
) returns void
  language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Менять фото рецепта может только владелица' using errcode = '42501';
  end if;
  update public.recipes
  set image_url = p_url,
      image_credit = case when p_url is null then null else p_credit end,
      image_source_url = case when p_url is null then null else p_source_url end,
      updated_at = now()
  where id = p_recipe_id;
  if not found then
    raise exception 'Рецепт % не найден', p_recipe_id using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.set_recipe_image(bigint, text, text, text) from public, anon;
grant execute on function public.set_recipe_image(bigint, text, text, text) to authenticated;
