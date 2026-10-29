-- A7. Пищевая ценность продуктов и масса единиц — с источником каждого числа.
--
-- * КБЖУ хранится на 100 г съедобной части продукта в том виде, в каком он взвешивается
--   в рецепте (сырой, если не сказано иное).
-- * Масса единицы: для ml — граммы в 1 мл (плотность), для штучных единиц — граммы в одной штуке.
--   Заменяет неиспользованные поля ingredients.density_g_per_ml и piece_weight_g, у которых
--   не было места для источника.
-- * Неизвестное не подменяется числом: нет строки — продукт в расчёте КБЖУ не учитывается,
--   и интерфейс сообщает об этом.

alter table public.ingredients
  drop column density_g_per_ml,
  drop column piece_weight_g;

create table public.nutrition_sources (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  title text not null,
  publisher text not null,
  url text not null check (url ~ '^https://'),
  dataset_version text,
  license text not null,
  license_url text check (license_url ~ '^https://'),
  retrieved_on date not null,
  citation text not null
);

comment on table public.nutrition_sources is 'Источники пищевых данных: справочник, версия, права, как цитировать';

insert into public.nutrition_sources
  (code, title, publisher, url, dataset_version, license, license_url, retrieved_on, citation)
values (
  'usda_fdc_sr_legacy',
  'USDA FoodData Central — SR Legacy',
  'U.S. Department of Agriculture, Agricultural Research Service',
  'https://fdc.nal.usda.gov/',
  'SR Legacy, апрель 2018',
  'Общественное достояние (CC0 1.0)',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  '2026-10-29',
  'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central: SR Legacy, 2018. fdc.nal.usda.gov'
);

create table public.ingredient_nutrition (
  ingredient_id bigint primary key references public.ingredients (id) on delete cascade,
  source_code text not null references public.nutrition_sources (code),
  -- Запись в источнике: номер и название, чтобы значение можно было перепроверить.
  source_food_id text not null,
  source_food_name text not null,
  kcal numeric(7, 2) not null check (kcal >= 0 and kcal <= 950),
  protein_g numeric(6, 2) not null check (protein_g >= 0),
  fat_g numeric(6, 2) not null check (fat_g >= 0),
  carbs_g numeric(6, 2) not null check (carbs_g >= 0),
  -- Состав российского продукта заметно отличается или выбран один вариант из многих.
  is_approximate boolean not null default false,
  note text,
  check (protein_g + fat_g + carbs_g <= 100.5)
);

comment on table public.ingredient_nutrition is 'КБЖУ на 100 г съедобной части, с источником';

create index ingredient_nutrition_source_idx on public.ingredient_nutrition (source_code);

create table public.ingredient_unit_weights (
  ingredient_id bigint not null references public.ingredients (id) on delete cascade,
  -- ml — граммы в 1 мл; штучные единицы — граммы в одной штуке.
  unit_code text not null references public.units (code)
    check (unit_code in ('ml', 'pcs', 'clove', 'bunch', 'pack')),
  grams numeric not null check (grams > 0),
  source_code text not null references public.nutrition_sources (code),
  source_food_id text not null,
  source_portion text not null,
  note text,
  primary key (ingredient_id, unit_code)
);

comment on table public.ingredient_unit_weights is 'Масса единицы продукта для пересчёта в граммы, с источником';

create index ingredient_unit_weights_source_idx on public.ingredient_unit_weights (source_code);

alter table public.nutrition_sources enable row level security;
alter table public.ingredient_nutrition enable row level security;
alter table public.ingredient_unit_weights enable row level security;

-- Чтение — вошедшим, для видимых им продуктов. Запись — только миграциями
-- (ручной ввод данных с упаковки для своих продуктов — B1).
create policy nutrition_sources_read on public.nutrition_sources for select to authenticated
  using (true);
create policy ingredient_nutrition_read on public.ingredient_nutrition for select to authenticated
  using (public.ingredient_visible(ingredient_id));
create policy ingredient_unit_weights_read on public.ingredient_unit_weights for select to authenticated
  using (public.ingredient_visible(ingredient_id));

revoke all on public.nutrition_sources, public.ingredient_nutrition, public.ingredient_unit_weights
  from anon;
