-- A4. Лицензии источников и пометка об адаптации.
-- Открытые лицензии (CC BY-SA и т. п.) требуют указать авторов, лицензию со ссылкой
-- и что изменено. Для вики-источников храним номер версии страницы, с которой взят рецепт.

alter table public.recipe_sources drop constraint recipe_sources_rights_check;
alter table public.recipe_sources add constraint recipe_sources_rights_check
  check (rights in ('own', 'permission', 'open_license', 'link_only', 'public_domain', 'unknown'));

alter table public.recipe_sources
  add column license text,
  add column license_url text check (license_url ~ '^https?://'),
  add column authors_url text check (authors_url ~ '^https?://'),
  add column source_revision text,
  add constraint recipe_sources_open_license_check
    check (rights <> 'open_license' or (license is not null and license_url is not null));

comment on column public.recipe_sources.license is 'Название лицензии, например «CC BY-SA 4.0»';
comment on column public.recipe_sources.authors_url is 'Страница со списком авторов (история правок вики)';
comment on column public.recipe_sources.source_revision is 'Версия страницы-источника (oldid для вики)';

alter table public.recipes
  add column adaptation_note text;

comment on column public.recipes.adaptation_note is 'Что изменено относительно источника (пересказ шагов, перевод единиц и т. п.)';

-- Рецепт с внешним источником без указания прав не публикуется.
create or replace function public.recipe_publish_check()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_rights text;
begin
  if new.is_published and new.source_id is not null then
    select rights into v_rights from public.recipe_sources where id = new.source_id;
    if v_rights = 'unknown' then
      raise exception 'Нельзя опубликовать рецепт, права на источник которого не установлены';
    end if;
  end if;
  return new;
end;
$$;

create trigger recipes_publish_check
  before insert or update on public.recipes
  for each row execute function public.recipe_publish_check();
