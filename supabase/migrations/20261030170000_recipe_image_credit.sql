-- Фото блюда на карточке и в рецепте (дизайн, вариант «карточка с обложкой»).
-- ТЗ §4: изображение — только если разрешено; у каждого фото указан автор/источник.
alter table public.recipes
  add column image_credit text check (length(btrim(image_credit)) between 1 and 300);

alter table public.recipes
  add constraint recipes_image_credit_required check (image_url is null or image_credit is not null);

comment on column public.recipes.image_url is 'Фото блюда (https), только с разрешёнными правами';
comment on column public.recipes.image_credit is
  'Подпись к фото: автор, источник и лицензия — например «Фото: автор, CC BY-SA 4.0»';
