-- A4. Рецепты, партия batch-01: 22 шт.
-- СГЕНЕРИРОВАНО из content/recipes/batch-01/*.json (node scripts/recipes/build-migration.ts batch-01).
-- Не редактировать вручную; после применения к облаку партию не менять.

-- Банановый хлеб (bananovyi-hleb)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Банановый хлеб', 'https://ru.wikibooks.org/wiki/Рецепт:Банановый_хлеб', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%91%D0%B0%D0%BD%D0%B0%D0%BD%D0%BE%D0%B2%D1%8B%D0%B9_%D1%85%D0%BB%D0%B5%D0%B1&action=history',
    '2026-10-29', '268926', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Банановый хлеб', 'Сладкий кекс из спелых бананов с грецкими орехами.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 268926.', 'Взят вариант «основной» со страницы; шаги пересказаны своими словами, количества — как в источнике. Соль в источнике указана как «1 горсть», ваниль — «1 чайная ложка» (вид ванили не уточнён); перенесено как есть.', null,
    array['dessert', 'breakfast']::text[], array['выпечка']::text[], array['духовка', 'форма']::text[], array[]::text[],
    null, 90, null, 2, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Банан', 3::numeric, 'pcs', null, 'key', null),
    (2, 'Масло сливочное', 110::numeric, 'g', null, 'main', null),
    (3, 'Сахар', 220::numeric, 'g', null, 'main', null),
    (4, 'Яйцо куриное', 2::numeric, 'pcs', null, 'main', null),
    (5, 'Ваниль', 1::numeric, 'tsp', null, 'minor', null),
    (6, 'Разрыхлитель', 1::numeric, 'tsp', null, 'minor', null),
    (7, 'Соль', null::numeric, null, '1 горсть (так в источнике)', 'minor', null),
    (8, 'Мука пшеничная', null::numeric, null, '280–290 г', 'key', null),
    (9, 'Грецкие орехи', 10::numeric, 'pcs', null, 'optional', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Взбить в кастрюле сахар со сливочным маслом.', null::integer),
    (2, 'Добавить яйца и ваниль, перемешать.', null::integer),
    (3, 'Размять бананы и добавить в тесто.', null::integer),
    (4, 'В отдельной миске смешать муку с разрыхлителем и солью и переложить в тесто.', null::integer),
    (5, 'Очистить грецкие орехи и добавить в тесто, оставив несколько для украшения.', null::integer),
    (6, 'Смазать форму сливочным и растительным маслом, выложить тесто, сверху — оставленные орехи.', null::integer),
    (7, 'Выпекать в разогретой до 180 °C духовке полтора часа.', 90::integer),
    (8, 'Дать остыть 20 минут.', 20::integer)
) as v (position, instruction, minutes);

-- Бефстроганов (befstroganov)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Бефстроганов', 'https://ru.wikibooks.org/wiki/Рецепт:Бефстроганов', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%91%D0%B5%D1%84%D1%81%D1%82%D1%80%D0%BE%D0%B3%D0%B0%D0%BD%D0%BE%D0%B2&action=history',
    '2026-10-29', '253184', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Бефстроганов', 'Говядина соломкой, обжаренная с луком и доведённая в сметане.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 253184.', 'Взят вариант «Бефстроганов 2» со страницы; шаги пересказаны своими словами, количества — как в источнике. на странице Викиучебника вариант приводится по «Книге о вкусной и здоровой пище» (1952). Соус «Южный» — фабричный острый соус советского времени. Соль и перец — по вкусу.', null,
    array['lunch', 'dinner']::text[], array['жарка']::text[], array['сковорода']::text[], array[]::text[],
    null, 15, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Говядина', 500::numeric, 'g', null, 'key', 'филейная часть, тонкий край или кострец'),
    (2, 'Лук репчатый', 2::numeric, 'pcs', null, 'main', null),
    (3, 'Мука пшеничная', 1::numeric, 'tbsp', null, 'main', null),
    (4, 'Сметана', 0.75::numeric, 'cup', null, 'key', null),
    (5, 'Масло сливочное', 3::numeric, 'tbsp', null, 'main', 'в источнике — «масло»'),
    (6, 'Соус «Южный»', 1::numeric, 'tbsp', null, 'minor', null),
    (7, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (8, 'Перец чёрный молотый', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (9, 'Картофель', 1::numeric, 'kg', null, 'optional', 'на гарнир, жареный'),
    (10, 'Укроп', null::numeric, null, 'для подачи', 'optional', 'или петрушка')
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Мясо обмыть, зачистить от сухожилий, нарезать ломтиками, отбить и нарезать соломкой.', null::integer),
    (2, 'Нашинковать лук и обжарить на масле.', null::integer),
    (3, 'Добавить к луку мясо, посыпанное солью и перцем, и жарить 5–6 минут, помешивая.', 6::integer),
    (4, 'Посыпать мясо мукой, перемешать и жарить ещё 2–3 минуты.', 3::integer),
    (5, 'Добавить сметану, перемешать и проварить 2–3 минуты; заправить соусом «Южный» и солью по вкусу.', 3::integer),
    (6, 'Подавать с жареным картофелем, посыпав укропом или петрушкой.', null::integer)
) as v (position, instruction, minutes);

-- Блины на пресном тесте (bliny-presnye)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Блины', 'https://ru.wikibooks.org/wiki/Рецепт:Блины', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%91%D0%BB%D0%B8%D0%BD%D1%8B&action=history',
    '2026-10-29', '270074', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Блины на пресном тесте', 'Тонкие блины на молоке со взбитыми белками.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 270074.', 'Взят вариант «Пресное тесто для блинов» со страницы; шаги пересказаны своими словами, количества — как в источнике. Жир для сковороды в этом варианте источника не указан. Стакан — бытовая мера, около 250 мл.', null,
    array['breakfast']::text[], array['жарка']::text[], array['сковорода', 'миска']::text[], array[]::text[],
    null, null, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Яйцо куриное', 5::numeric, 'pcs', null, 'key', 'желтки и белки отдельно'),
    (2, 'Молоко', 3::numeric, 'cup', null, 'key', null),
    (3, 'Масло сливочное', 50::numeric, 'g', null, 'main', 'растопленное'),
    (4, 'Сахар', null::numeric, null, '1–2 ст. л.', 'main', null),
    (5, 'Соль', null::numeric, null, 'неполная ч. л.', 'minor', null),
    (6, 'Мука пшеничная', 2::numeric, 'cup', null, 'key', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Взбить желтки.', null::integer),
    (2, 'Добавить к желткам молоко, растопленное сливочное масло, сахар и соль.', null::integer),
    (3, 'Непрерывно перемешивая, всыпать муку. Источник советует наоборот — вливать жидкость в муку тонкой струйкой, чтобы не было комков.', null::integer),
    (4, 'Ввести в тесто отдельно взбитые белки и снова перемешать.', null::integer),
    (5, 'Выпекать блины тонким слоем на хорошо разогретой сковороде.', null::integer)
) as v (position, instruction, minutes);

-- Брауни (brauni)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Брауни', 'https://ru.wikibooks.org/wiki/Рецепт:Брауни', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%91%D1%80%D0%B0%D1%83%D0%BD%D0%B8&action=history',
    '2026-10-29', '253213', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Брауни', 'Шоколадное пирожное, нарезанное прямоугольными кусочками.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 253213.', 'Взят вариант «основной» со страницы; шаги пересказаны своими словами, количества — как в источнике. Разрыхлитель указан в составе, но в шагах источника не упомянут. Стакан — бытовая мера.', null,
    array['dessert']::text[], array['выпечка']::text[], array['духовка', 'прямоугольная форма']::text[], array[]::text[],
    null, 20, null, 2, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Масло сливочное', 150::numeric, 'g', null, 'main', null),
    (2, 'Шоколад тёмный', 250::numeric, 'g', null, 'key', null),
    (3, 'Сахар', 0.75::numeric, 'cup', null, 'main', null),
    (4, 'Мука пшеничная', 0.5::numeric, 'cup', null, 'main', null),
    (5, 'Разрыхлитель', 0.5::numeric, 'tsp', null, 'minor', null),
    (6, 'Яйцо куриное', 3::numeric, 'pcs', null, 'key', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Растопить сливочное масло вместе с шоколадом.', null::integer),
    (2, 'Взбивать яйца с сахаром около трёх минут, до светлой пышной массы.', 3::integer),
    (3, 'Когда масло с шоколадом остынет, влить их в яичную смесь и перемешать.', null::integer),
    (4, 'Соединить смесь с мукой и аккуратно перемешать силиконовой лопаткой, чтобы не осталось белых разводов.', null::integer),
    (5, 'Разогреть духовку до 180 °C, вылить тесто в прямоугольную форму.', null::integer),
    (6, 'Выпекать 20 минут.', 20::integer),
    (7, 'Перевернуть брауни на разделочную доску и нарезать кусочками.', null::integer)
) as v (position, instruction, minutes);

-- Драники (draniki)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Драники', 'https://ru.wikibooks.org/wiki/Рецепт:Драники', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%94%D1%80%D0%B0%D0%BD%D0%B8%D0%BA%D0%B8&action=history',
    '2026-10-29', '253332', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Драники', 'Картофельные оладьи, обжаренные до румяной корочки.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 253332.', 'Взят вариант «Драники 1» со страницы; шаги пересказаны своими словами, количества — как в источнике. Количество картофеля в источнике — диапазон «10–12 шт.»; соль и перец — по вкусу.', 'белорусская',
    array['breakfast', 'dinner']::text[], array['жарка']::text[], array['тёрка', 'сковорода']::text[], array[]::text[],
    null, null, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Картофель', null::numeric, null, '10–12 шт.', 'key', null),
    (2, 'Яйцо куриное', 5::numeric, 'pcs', null, 'main', 'только белки'),
    (3, 'Мука пшеничная', 2::numeric, 'tbsp', null, 'main', null),
    (4, 'Сода пищевая', 0.5::numeric, 'tsp', null, 'minor', null),
    (5, 'Масло подсолнечное', 0.5::numeric, 'cup', null, 'main', 'или топлёное, для жарки'),
    (6, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (7, 'Перец чёрный молотый', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (8, 'Сметана', 1::numeric, 'cup', null, 'optional', 'для подачи')
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Натереть очищенный картофель на мелкой тёрке.', null::integer),
    (2, 'Добавить предварительно хорошо взбитые белки, муку, соль, перец и соду, перемешать.', null::integer),
    (3, 'Выкладывать массу ложкой небольшими порциями на раскалённую сковороду с маслом и обжаривать до румяной корочки.', null::integer),
    (4, 'Подавать по 3–4 штуки на порцию, полив сметаной или сметанным либо чесночным соусом.', null::integer)
) as v (position, instruction, minutes);

-- Голубцы мясные (golubcy-myasnye)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Голубцы', 'https://ru.wikibooks.org/wiki/Рецепт:Голубцы', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%93%D0%BE%D0%BB%D1%83%D0%B1%D1%86%D1%8B&action=history',
    '2026-10-29', '259418', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Голубцы мясные', 'Капустные листья с начинкой из мяса и крупы, потушенные в сметанно-томатном соусе.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 259418.', 'Взят вариант «Голубцы 2 («Голубцы мясные»)» со страницы; шаги пересказаны своими словами, количества — как в источнике. на странице Викиучебника вариант приводится по «Книге о вкусной и здоровой пище» (1952). Вид мяса не уточнён; крупа — рис, пшено или перловка. Соль и перец — по вкусу.', null,
    array['lunch', 'dinner']::text[], array['варка', 'жарка', 'тушение']::text[], array['кастрюля', 'сковорода', 'мясорубка']::text[], array[]::text[],
    null, 40, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Мясо (любое)', 300::numeric, 'g', null, 'key', 'мякоть'),
    (2, 'Капуста белокочанная', 800::numeric, 'g', null, 'key', null),
    (3, 'Рис', 0.5::numeric, 'cup', null, 'main', 'или пшено, перловка'),
    (4, 'Лук репчатый', 1::numeric, 'pcs', null, 'main', null),
    (5, 'Мука пшеничная', 1::numeric, 'tbsp', null, 'main', null),
    (6, 'Томат-пюре', 2::numeric, 'tbsp', null, 'main', null),
    (7, 'Сметана', 2::numeric, 'tbsp', null, 'main', null),
    (8, 'Масло сливочное', 2::numeric, 'tbsp', null, 'main', 'в источнике — «масло»'),
    (9, 'Вода', 1::numeric, 'cup', null, 'main', null),
    (10, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (11, 'Перец чёрный молотый', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (12, 'Укроп', null::numeric, null, 'для подачи', 'optional', 'или петрушка')
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Пропустить мясо через мясорубку. Крупу отварить, охладить и смешать с фаршем, добавив мелко нарезанный слегка обжаренный лук, соль и перец.', null::integer),
    (2, 'Целые капустные листья проварить в кипящей воде 5–7 минут, охладить, разложить и отбить утолщения у стеблей до толщины листа.', 7::integer),
    (3, 'Положить на листья начинку, свернуть колбасками и обжарить на сковороде, затем переложить в кастрюлю.', null::integer),
    (4, 'На сковороду влить сметану, томат-пюре, стакан воды, добавить муку, вскипятить и посолить.', null::integer),
    (5, 'Залить голубцы соусом и тушить под крышкой на слабом огне (или в духовке без крышки) 30–40 минут.', 40::integer),
    (6, 'Подавать в соусе, посыпав укропом или петрушкой. Без сметаны берут немного больше томата-пюре.', null::integer)
) as v (position, instruction, minutes);

-- Гороховый суп (gorohovyi-sup)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Гороховый суп', 'https://ru.wikibooks.org/wiki/Рецепт:Гороховый_суп', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%93%D0%BE%D1%80%D0%BE%D1%85%D0%BE%D0%B2%D1%8B%D0%B9_%D1%81%D1%83%D0%BF&action=history',
    '2026-10-29', '253295', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Гороховый суп', 'Суп из гороха на мясном бульоне с обжаренными кореньями.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 253295; количество воды в источнике не указано.', 'Взят вариант «Гороховый суп 1» со страницы; шаги пересказаны своими словами, количества — как в источнике. на странице Викиучебника вариант приводится по «Книге о вкусной и здоровой пище» (1952). «Коренья и лук» указаны в источнике общей массой 200 г; количество воды для бульона не указано.', null,
    array['lunch']::text[], array['варка']::text[], array['кастрюля', 'сковорода']::text[], array[]::text[],
    null, 90, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Мясо (любое)', 500::numeric, 'g', null, 'main', 'для бульона'),
    (2, 'Горох колотый', 250::numeric, 'g', null, 'key', 'замоченный заранее'),
    (3, 'Морковь', null::numeric, null, 'коренья вместе с луком — 200 г', 'main', 'и другие коренья'),
    (4, 'Лук репчатый', null::numeric, null, 'входит в 200 г кореньев и лука', 'main', null),
    (5, 'Масло сливочное', 2::numeric, 'tbsp', null, 'main', 'в источнике — «масло»'),
    (6, 'Вода', null::numeric, null, 'количество в источнике не указано', 'main', 'для бульона'),
    (7, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (8, 'Ветчина', null::numeric, null, 'по желанию', 'optional', 'или копчёная грудинка'),
    (9, 'Хлеб пшеничный', null::numeric, null, 'для гренок', 'optional', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Сварить мясной бульон.', null::integer),
    (2, 'Положить в бульон замоченный заранее горох и варить около полутора часов.', 90::integer),
    (3, 'Промыть и очистить коренья и лук, нарезать мелкими кубиками и слегка обжарить на масле.', null::integer),
    (4, 'За 15–20 минут до готовности добавить обжаренные овощи в суп и посолить. По желанию можно варить суп с ветчиной или копчёной грудинкой.', 15::integer),
    (5, 'Подавать с гренками из белого хлеба, нарезанного кубиками.', null::integer)
) as v (position, instruction, minutes);

-- Гречневая каша с маслом (grechnevaya-kasha)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Гречневая каша', 'https://ru.wikibooks.org/wiki/Рецепт:Гречневая_каша', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%93%D1%80%D0%B5%D1%87%D0%BD%D0%B5%D0%B2%D0%B0%D1%8F_%D0%BA%D0%B0%D1%88%D0%B0&action=history',
    '2026-10-29', '253306', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Гречневая каша с маслом', 'Рассыпчатая гречневая каша, сваренная и оставленная упревать.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 253306.', 'Взят вариант «Гречневая каша 2 («Гречневая каша с маслом»)» со страницы; шаги пересказаны своими словами, количества — как в источнике. на странице Викиучебника вариант приводится по «Книге о вкусной и здоровой пище» (1952). Упревание 3–4 часа — по источнику; время готовки указано по нижним границам диапазонов.', null,
    array['breakfast', 'lunch', 'dinner']::text[], array['варка']::text[], array['кастрюля с крышкой']::text[], array[]::text[],
    null, 195, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Гречка', 2::numeric, 'cup', null, 'key', null),
    (2, 'Вода', 3::numeric, 'cup', null, 'main', null),
    (3, 'Соль', 1::numeric, 'tsp', null, 'minor', null),
    (4, 'Масло сливочное', 2::numeric, 'tbsp', null, 'main', 'в источнике — «масло»')
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Вскипятить подсоленную воду.', null::integer),
    (2, 'Всыпать в кипящую воду гречку и, помешивая, варить до загустения 15–20 минут.', 15::integer),
    (3, 'Плотно накрыть кастрюлю крышкой и оставить кашу упревать на 3–4 часа.', 180::integer),
    (4, 'Подавать с маслом.', null::integer)
) as v (position, instruction, minutes);

-- Картофельное пюре (kartofelnoe-pyure)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Картофельное пюре', 'https://ru.wikibooks.org/wiki/Рецепт:Картофельное_пюре', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%9A%D0%B0%D1%80%D1%82%D0%BE%D1%84%D0%B5%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5_%D0%BF%D1%8E%D1%80%D0%B5&action=history',
    '2026-10-29', '253404', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Картофельное пюре', 'Пюре из отварного картофеля с маслом и горячим молоком.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 253404.', 'Взят вариант «Картофельное пюре 1» со страницы; шаги пересказаны своими словами, количества — как в источнике. на странице Викиучебника вариант приводится по «Книге о вкусной и здоровой пище» (1952). В источнике — «масло»; по смыслу рецепта это сливочное. Соль — по вкусу, без количества.', null,
    array['lunch', 'dinner']::text[], array['варка']::text[], array['кастрюля', 'толкушка или сито']::text[], array[]::text[],
    null, null, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Картофель', 1::numeric, 'kg', null, 'key', null),
    (2, 'Молоко', 1::numeric, 'cup', null, 'main', 'горячее'),
    (3, 'Масло сливочное', 2::numeric, 'tbsp', null, 'main', null),
    (4, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Очищенный промытый картофель отварить и слить воду.', null::integer),
    (2, 'Подержать кастрюлю с картофелем ещё немного на слабом огне или в духовке, чтобы испарилась оставшаяся вода.', null::integer),
    (3, 'Пока картофель горячий, размять его или протереть через сито.', null::integer),
    (4, 'Добавить масло и соль и, помешивая, постепенно влить горячее молоко.', null::integer)
) as v (position, instruction, minutes);

-- Луковый суп с гренками (lukovyi-sup)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Луковый суп', 'https://ru.wikibooks.org/wiki/Рецепт:Луковый_суп', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%9B%D1%83%D0%BA%D0%BE%D0%B2%D1%8B%D0%B9_%D1%81%D1%83%D0%BF&action=history',
    '2026-10-29', '253561', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Луковый суп с гренками', 'Суп из пассерованного лука с гренками и тёртым сыром.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 253561.', 'Взят вариант «Луковый суп 2» со страницы; шаги пересказаны своими словами, количества — как в источнике. Количество соли в источнике не указано. Вместо воды можно использовать мясной бульон.', 'французская',
    array['lunch']::text[], array['варка', 'жарка']::text[], array['кастрюля', 'сковорода']::text[], array[]::text[],
    null, 15, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Вода', 3::numeric, 'l', null, 'main', 'или мясной бульон'),
    (2, 'Лук репчатый', 250::numeric, 'g', null, 'key', null),
    (3, 'Масло сливочное', 2::numeric, 'tbsp', null, 'main', null),
    (4, 'Мука пшеничная', 0.5::numeric, 'tbsp', null, 'main', null),
    (5, 'Соль', null::numeric, null, 'количество в источнике не указано', 'minor', null),
    (6, 'Хлеб пшеничный', 6::numeric, 'pcs', null, 'main', 'ломтики, поджаренные в сливочном масле'),
    (7, 'Сыр твёрдый', 1::numeric, 'tbsp', null, 'main', 'тёртый')
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Нарезать лук очень тонкими ломтиками и потушить со столовой ложкой сливочного масла, не давая подрумяниться.', null::integer),
    (2, 'Когда лук размякнет, снять кастрюлю с огня и добавить муку.', null::integer),
    (3, 'Перемешивать, пока лук с мукой не пожелтеют, затем, не переставая мешать, развести водой или бульоном.', null::integer),
    (4, 'Посолить и варить четверть часа на слабом огне.', 15::integer),
    (5, 'Поджарить ломтики белого хлеба на сливочном масле, посыпать тёртым сыром и положить по ломтику в каждую тарелку.', null::integer)
) as v (position, instruction, minutes);

-- Макароны по-флотски (makarony-po-flotski)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Макароны по-флотски', 'https://ru.wikibooks.org/wiki/Рецепт:Макароны_по-флотски', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%9C%D0%B0%D0%BA%D0%B0%D1%80%D0%BE%D0%BD%D1%8B_%D0%BF%D0%BE-%D1%84%D0%BB%D0%BE%D1%82%D1%81%D0%BA%D0%B8&action=history',
    '2026-10-29', '263010', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Макароны по-флотски', 'Отварные макароны с тушёным мясным фаршем и луком.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 263010.', 'Взят вариант «Макароны по-флотски 1» со страницы; шаги пересказаны своими словами, количества — как в источнике. На странице вариант приводится по книге «Кулинария» (1955). Количества — на одну порцию; мясо — говядина, баранина или свинина. Соль для воды в норме не указана.', null,
    array['lunch', 'dinner']::text[], array['варка', 'жарка', 'тушение']::text[], array['кастрюля', 'сковорода', 'мясорубка']::text[], array[]::text[],
    null, null, null, 1, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Макароны', 80::numeric, 'g', null, 'key', null),
    (2, 'Говядина', 75::numeric, 'g', null, 'key', 'или баранина, свинина'),
    (3, 'Лук репчатый', 20::numeric, 'g', null, 'main', null),
    (4, 'Масло топлёное', 15::numeric, 'g', null, 'main', 'для лука'),
    (5, 'Жир топлёный', 10::numeric, 'g', null, 'main', 'свиной или говяжий, для мяса'),
    (6, 'Бульон', 30::numeric, 'g', null, 'main', null),
    (7, 'Соль', null::numeric, null, 'для воды, по вкусу', 'minor', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Пропустить мясо через мясорубку и обжарить на топлёном жире.', null::integer),
    (2, 'Переложить мясо в посуду, добавить мелко нарезанный лук, пассерованный на топлёном масле, влить бульон и тушить до готовности.', null::integer),
    (3, 'Отварить макароны в подсоленной воде и слить воду.', null::integer),
    (4, 'Смешать макароны с тушёным мясом.', null::integer)
) as v (position, instruction, minutes);

-- Оладьи дрожжевые (oladi-drozhzhevye)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Оладьи', 'https://ru.wikibooks.org/wiki/Рецепт:Оладьи', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%9E%D0%BB%D0%B0%D0%B4%D1%8C%D0%B8&action=history',
    '2026-10-29', '253651', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Оладьи дрожжевые', 'Пышные оладьи из дрожжевого теста.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 253651.', 'Взят вариант «Оладьи 2 («Из теста»)» со страницы; шаги пересказаны своими словами, количества — как в источнике. на странице Викиучебника вариант приводится по «Книге о вкусной и здоровой пище» (1952). Масло — «коровье или растительное»: столовая ложка идёт в тесто, остальное — для жарки.', null,
    array['breakfast']::text[], array['жарка']::text[], array['миска', 'сковорода']::text[], array[]::text[],
    null, null, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Мука пшеничная', 500::numeric, 'g', null, 'key', null),
    (2, 'Молоко', 2::numeric, 'cup', null, 'main', 'тёплое; или вода'),
    (3, 'Яйцо куриное', 2::numeric, 'pcs', null, 'main', null),
    (4, 'Сахар', 1.5::numeric, 'tbsp', null, 'main', null),
    (5, 'Соль', 0.5::numeric, 'tsp', null, 'minor', null),
    (6, 'Дрожжи прессованные', 25::numeric, 'g', null, 'key', null),
    (7, 'Масло сливочное', null::numeric, null, '3–4 ст. л.', 'main', 'или растительное'),
    (8, 'Изюм', null::numeric, null, 'по желанию', 'optional', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Развести дрожжи в тёплом молоке, всыпать муку и вымесить. Дать тесту подняться в тёплом месте.', null::integer),
    (2, 'Добавить яйца, соль, сахар и столовую ложку масла, вымесить и дать тесту подняться ещё раз.', null::integer),
    (3, 'Не перемешивая тесто, брать его смоченной в воде ложкой и выкладывать на горячую сковороду с маслом.', null::integer),
    (4, 'Обжарить оладьи с обеих сторон. Подавать с сахаром, мёдом, вареньем или творогом со сметаной. По желанию в тесто добавляют промытый изюм.', null::integer)
) as v (position, instruction, minutes);

-- Оливье (мясной салат) (olive)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Оливье', 'https://ru.wikibooks.org/wiki/Рецепт:Оливье', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%9E%D0%BB%D0%B8%D0%B2%D1%8C%D0%B5&action=history',
    '2026-10-29', '270348', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Оливье (мясной салат)', 'Салат из мяса, картофеля, яиц и огурцов под майонезом. Часто добавляют варёную колбасу вместо мяса, морковь, горошек и лук — в источнике это отмечено как распространённые добавки.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 270348.', 'Взят вариант «Основной рецепт» со страницы; шаги пересказаны своими словами, количества — как в источнике. На странице рецепт приводится по «Краткой энциклопедии домашнего хозяйства» (1959), «примерно на 4 порции».', null,
    array['lunch', 'dinner']::text[], array[]::text[], array['салатник']::text[], array['салат']::text[],
    null, null, null, 4, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Мясо (любое)', 200::numeric, 'g', null, 'key', 'отварное или жареное'),
    (2, 'Картофель', 200::numeric, 'g', null, 'key', 'отварной'),
    (3, 'Яйцо куриное', 2::numeric, 'pcs', null, 'main', 'варёные'),
    (4, 'Огурец', 2::numeric, 'pcs', null, 'main', 'свежие или солёные'),
    (5, 'Майонез', 150::numeric, 'g', null, 'main', null),
    (6, 'Салат листовой', null::numeric, null, 'для украшения', 'optional', 'латук'),
    (7, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Нарезать мясо, картофель (немного крупнее), огурцы и часть яиц тонкими ломтиками.', null::integer),
    (2, 'Посолить, заправить майонезом и аккуратно перемешать.', null::integer),
    (3, 'Выложить в салатник горкой и украсить листьями латука, дольками яйца, огурца и кусочками мяса.', null::integer)
) as v (position, instruction, minutes);

-- Плов ферганский (plov-ferganskii)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Плов', 'https://ru.wikibooks.org/wiki/Рецепт:Плов', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%9F%D0%BB%D0%BE%D0%B2&action=history',
    '2026-10-29', '270259', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Плов ферганский', 'Плов из риса, баранины и моркови, приготовленный в казане.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 270259.', 'Взят вариант «Классический вариант (ферганский плов)» со страницы; шаги пересказаны своими словами, количества — как в источнике. В источнике время — «2–3 часа», указано по нижней границе. Вместо растительного масла можно вытопить жир из 85–90 г курдючного сала.', 'узбекская',
    array['lunch', 'dinner']::text[], array['жарка', 'тушение', 'варка']::text[], array['казан или кастрюля с толстым дном', 'шумовка']::text[], array[]::text[],
    0, 120, null, 3, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Рис', 250::numeric, 'g', null, 'key', null),
    (2, 'Баранина', 150::numeric, 'g', null, 'key', 'или говядина'),
    (3, 'Морковь', 150::numeric, 'g', null, 'key', null),
    (4, 'Лук репчатый', 100::numeric, 'g', null, 'main', null),
    (5, 'Масло подсолнечное', 55::numeric, 'g', null, 'main', 'без выраженного запаха'),
    (6, 'Зира', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (7, 'Барбарис', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (8, 'Перец красный молотый', null::numeric, 'to_taste', 'по вкусу', 'minor', 'слабожгучий; можно стручками'),
    (9, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (10, 'Вода', null::numeric, null, 'горячая, сколько нужно', 'main', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Нарезать лук кольцами или полукольцами, мясо — ломтиками, морковь — соломкой. Рис хорошо промыть тёплой водой до прозрачной воды (можно заранее замочить на 30–120 минут в подсоленной воде около 60 °C — тогда соли и воды в казан кладут меньше).', null::integer),
    (2, 'На сильном огне раскалить масло до лёгкого дымка. Обжарить лук до золотисто-коричневого цвета, затем мясо до румяной корочки, затем морковь до полуготовности, периодически помешивая.', null::integer),
    (3, 'Влить воду вровень с содержимым, довести до кипения, убавить огонь, добавить пряности и соль и тушить 50–80 минут (это зирвак). Зирвак солят с небольшим запасом — на несолёный рис.', 50::integer),
    (4, 'Ровно выложить рис на зирвак и залить водой на 1–2 см выше, поливая через шумовку. Быстро довести до кипения и варить при интенсивном кипении, постепенно убавляя огонь по мере впитывания.', null::integer),
    (5, 'Когда сверху рис останется без воды, осторожно перемешать верхние слои риса, не задевая мясо и овощи. Если воды не хватает, сделать до дна 2–3 отверстия и долить воду.', null::integer),
    (6, 'Когда вода впитается и рис будет готов, убавить огонь до минимума, собрать плов горкой, сделать несколько отверстий до дна, плотно накрыть крышкой, обёрнутой полотенцем, и оставить упревать на 20–40 минут.', 20::integer)
) as v (position, instruction, minutes);

-- Салат Нисуаз (salat-nisuaz)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Салат Нисуаз', 'https://ru.wikibooks.org/wiki/Рецепт:Салат_Нисуаз', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%A1%D0%B0%D0%BB%D0%B0%D1%82_%D0%9D%D0%B8%D1%81%D1%83%D0%B0%D0%B7&action=history',
    '2026-10-29', '266923', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Салат Нисуаз', 'Французский салат из помидоров, овощей, яиц, анчоусов и оливок.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 266923.', 'Взят вариант «Салат Нисуаз 2» со страницы; шаги пересказаны своими словами, количества — как в источнике. Вариант на странице — перевод из французской Википедии. Стручковую фасоль и артишоки по сезону можно сочетать, заменять друг другом или не использовать. Соль и перец — по вкусу.', 'французская',
    array['lunch', 'dinner']::text[], array[]::text[], array['большая салатница']::text[], array['салат']::text[],
    null, null, null, 6, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Томат', 10::numeric, 'pcs', null, 'key', 'средние, очень спелые'),
    (2, 'Огурец', 1::numeric, 'pcs', null, 'main', 'крупный, твёрдый'),
    (3, 'Фасоль стручковая', 200::numeric, 'g', null, 'optional', 'мелкая'),
    (4, 'Артишоки', 12::numeric, 'pcs', null, 'optional', 'небольшие фиолетовые'),
    (5, 'Перец болгарский', null::numeric, null, '1–2 шт.', 'main', 'зелёный, длинный'),
    (6, 'Лук зелёный', null::numeric, null, '6 маленьких луковиц', 'main', null),
    (7, 'Базилик', null::numeric, null, '6 листьев', 'main', null),
    (8, 'Чеснок', 1::numeric, 'clove', null, 'main', null),
    (9, 'Яйцо куриное', 3::numeric, 'pcs', null, 'main', 'сваренные вкрутую'),
    (10, 'Анчоусы', null::numeric, null, '12 филе', 'key', 'или 1 банка тунца на 300 г'),
    (11, 'Оливки', 100::numeric, 'g', null, 'main', 'чёрные, без косточек'),
    (12, 'Масло оливковое', 6::numeric, 'tbsp', null, 'main', null),
    (13, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (14, 'Перец чёрный молотый', null::numeric, 'to_taste', 'по вкусу', 'minor', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Помидоры очистить, разрезать на четвертинки, слегка посолить и отложить. Огурец очистить, нарезать тонкими ломтиками, посолить и тоже отложить.', null::integer),
    (2, 'Яйца нарезать четвертинками или кружками, филе анчоусов разделить на 3–4 части (тунец — нарезать ломтиками). Зелёный перец и лук нарезать тонкими кольцами, фасоль очистить, артишоки нарезать полосками.', null::integer),
    (3, 'Натереть дно и стенки салатницы разрезанным зубчиком чеснока. Выложить все овощи, кроме помидоров и огурцов, добавить анчоусы или тунец.', null::integer),
    (4, 'Слить с помидоров и огурцов выделившийся сок и добавить их в салатницу.', null::integer),
    (5, 'Смешать 6 столовых ложек оливкового масла с мелко нарезанным базиликом, солью и перцем и заправить салат. Сверху выложить яйца, украсить листьями базилика и охладить перед подачей.', null::integer)
) as v (position, instruction, minutes);

-- Шакшука (shakshuka)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Шакшука', 'https://ru.wikibooks.org/wiki/Рецепт:Шакшука', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%A8%D0%B0%D0%BA%D1%88%D1%83%D0%BA%D0%B0&action=history',
    '2026-10-29', '270132', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Шакшука', 'Яйца, приготовленные в густом соусе из помидоров и перца (матбухе).', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 270132.', 'Взят вариант «основной» со страницы; шаги пересказаны своими словами, количества — как в источнике. В источнике указано только общее время — 30 мин. Соль, масло и вода упомянуты в шагах источника без количества.', 'арабская, израильская',
    array['breakfast', 'dinner']::text[], array['жарка', 'тушение']::text[], array['сковорода']::text[], array[]::text[],
    0, 30, null, 3, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Лук репчатый', 1::numeric, 'pcs', null, 'main', null),
    (2, 'Чеснок', 1::numeric, 'clove', null, 'main', null),
    (3, 'Перец болгарский', 1::numeric, 'pcs', null, 'key', null),
    (4, 'Перец чили', null::numeric, 'to_taste', 'по вкусу', 'minor', 'острый стручковый'),
    (5, 'Томат', 2::numeric, 'pcs', null, 'key', null),
    (6, 'Томатная паста', 2::numeric, 'tbsp', null, 'main', null),
    (7, 'Яйцо куриное', 3::numeric, 'pcs', null, 'key', null),
    (8, 'Зира', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (9, 'Тмин', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (10, 'Кинза', null::numeric, 'to_taste', 'по вкусу', 'minor', 'зелень кинзы или кориандр'),
    (11, 'Масло оливковое', null::numeric, null, 'для жарки', 'minor', 'или другое растительное'),
    (12, 'Вода', null::numeric, null, 'немного', 'minor', 'или бульон'),
    (13, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Разогреть на сковороде (лучше чугунной) оливковое или другое растительное масло.', null::integer),
    (2, 'Лук нарезать полукольцами, чеснок измельчить; обжаривать их вместе несколько минут на среднем огне.', null::integer),
    (3, 'Помидоры бланшировать, снять кожицу и нарезать кубиками. Болгарский перец нарезать соломкой, острый — колечками.', null::integer),
    (4, 'Добавить на сковороду помидоры и оба перца, перемешать и тушить несколько минут на уменьшенном огне.', null::integer),
    (5, 'Добавить томатную пасту и немного воды или бульона, приправить зирой, тмином, кориандром и солью. Тушить, пока соус не загустеет.', null::integer),
    (6, 'Сделать в соусе углубления, разбить в них яйца и готовить на малом огне.', null::integer),
    (7, 'Посыпать рубленой кинзой соус, но не яйца. Подавать горячим прямо в сковороде, с питой.', null::integer)
) as v (position, instruction, minutes);

-- Шарлотка с яблоками (sharlotka)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Шарлотка', 'https://ru.wikibooks.org/wiki/Рецепт:Шарлотка', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%A8%D0%B0%D1%80%D0%BB%D0%BE%D1%82%D0%BA%D0%B0&action=history',
    '2026-10-29', '262456', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Шарлотка с яблоками', 'Бисквитное тесто, запечённое со слоем яблок.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 262456.', 'Взят вариант «Альтернативный рецепт» со страницы; шаги пересказаны своими словами, количества — как в источнике. Время выпечки в источнике — «не менее часа».', null,
    array['dessert']::text[], array['выпечка']::text[], array['духовка', 'форма или сковорода']::text[], array[]::text[],
    null, 60, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Яйцо куриное', 3::numeric, 'pcs', null, 'key', null),
    (2, 'Мука пшеничная', 250::numeric, 'g', null, 'key', '1 стакан'),
    (3, 'Сахар', 250::numeric, 'g', null, 'main', '1 стакан'),
    (4, 'Сода пищевая', 0.5::numeric, 'tsp', null, 'minor', null),
    (5, 'Сметана', 2::numeric, 'tsp', null, 'minor', null),
    (6, 'Яблоко', 5::numeric, 'pcs', null, 'key', 'крупные'),
    (7, 'Масло сливочное', null::numeric, null, 'немного, для смазки формы', 'minor', 'или подсолнечное')
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Разогреть духовку до 150–180 °C.', null::integer),
    (2, 'Взбить яйца с сахаром, содой и сметаной.', null::integer),
    (3, 'Всыпать муку и снова взбить до однородности.', null::integer),
    (4, 'Смазать форму (часто используют сковороду) сливочным или подсолнечным маслом.', null::integer),
    (5, 'Удалить у яблок сердцевину, нарезать кубиками около 1 см и ровно распределить по дну формы слоем 1,5–2 см.', null::integer),
    (6, 'Залить яблоки тестом.', null::integer),
    (7, 'Выпекать не менее часа; готовность проверить деревянной палочкой — тесто не должно к ней прилипать.', 60::integer)
) as v (position, instruction, minutes);

-- Шведские фрикадельки (shvedskie-frikadelki)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Шведские фрикадельки', 'https://ru.wikibooks.org/wiki/Рецепт:Шведские_фрикадельки', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%A8%D0%B2%D0%B5%D0%B4%D1%81%D0%BA%D0%B8%D0%B5_%D1%84%D1%80%D0%B8%D0%BA%D0%B0%D0%B4%D0%B5%D0%BB%D1%8C%D0%BA%D0%B8&action=history',
    '2026-10-29', '254233', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Шведские фрикадельки', 'Небольшие мясные шарики, обжаренные на сковороде.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 254233.', 'Взят вариант «Шведские фрикадельки 1» со страницы; шаги пересказаны своими словами, количества — как в источнике. Количество жидкости в источнике — диапазон 200–300 мл; соль и перец — без количества. Лук указан в составе, но в шагах источника не упомянут.', 'шведская',
    array['lunch', 'dinner']::text[], array['жарка']::text[], array['миска', 'сковорода']::text[], array[]::text[],
    null, null, null, 4, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Фарш свино-говяжий', 0.5::numeric, 'kg', null, 'key', 'или другой фарш'),
    (2, 'Яйцо куриное', 1::numeric, 'pcs', null, 'main', null),
    (3, 'Панировочные сухари', 50::numeric, 'ml', null, 'main', null),
    (4, 'Лук репчатый', 2::numeric, 'tbsp', null, 'main', 'мелко нарезанный; можно немного чеснока'),
    (5, 'Молоко', null::numeric, null, '200–300 мл', 'main', 'или вода, или сливки'),
    (6, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (7, 'Перец чёрный молотый', null::numeric, 'to_taste', 'по вкусу', 'minor', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Смешать в миске жидкость с панировочными сухарями и оставить примерно на 10 минут, чтобы сухари набухли.', 10::integer),
    (2, 'Смешать фарш с набухшими сухарями, яйцом, солью и перцем.', null::integer),
    (3, 'Скатать круглые фрикадельки, смачивая руки холодной водой.', null::integer),
    (4, 'Обжарить фрикадельки на среднем огне. Подавать с картофелем или пюре, коричневым соусом, брусникой или салатом.', null::integer)
) as v (position, instruction, minutes);

-- Сырники (syrniki)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Сырники', 'https://ru.wikibooks.org/wiki/Рецепт:Сырники', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%A1%D1%8B%D1%80%D0%BD%D0%B8%D0%BA%D0%B8&action=history',
    '2026-10-29', '254063', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Сырники', 'Творожные лепёшки, обжаренные в панировке.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 254063.', 'Взят вариант «Сырники 1» со страницы; шаги пересказаны своими словами, количества — как в источнике.', null,
    array['breakfast']::text[], array['жарка']::text[], array['сковорода']::text[], array[]::text[],
    null, null, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Творог', 500::numeric, 'g', null, 'key', null),
    (2, 'Яйцо куриное', 1::numeric, 'pcs', null, 'main', null),
    (3, 'Соль', 1::numeric, 'pinch', null, 'minor', null),
    (4, 'Сахар', 2::numeric, 'tbsp', null, 'main', null),
    (5, 'Манная крупа', 2::numeric, 'tbsp', null, 'main', null),
    (6, 'Мука пшеничная', 1::numeric, 'tbsp', null, 'main', null),
    (7, 'Панировочные сухари', null::numeric, null, 'для обваливания', 'main', null),
    (8, 'Масло подсолнечное', null::numeric, null, 'для обжаривания', 'main', 'любое растительное')
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Смешать творог, яйцо, соль, сахар, манную крупу и муку, вымесить однородную массу.', null::integer),
    (2, 'Сформовать из массы сырники и обвалять их в панировочных сухарях.', null::integer),
    (3, 'Обжарить с двух сторон на растительном масле на среднем огне.', null::integer),
    (4, 'Подавать со сметаной, вареньем или сиропом.', null::integer)
) as v (position, instruction, minutes);

-- Тефтели в томате (tefteli-v-tomate)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Тефтели', 'https://ru.wikibooks.org/wiki/Рецепт:Тефтели', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%A2%D0%B5%D1%84%D1%82%D0%B5%D0%BB%D0%B8&action=history',
    '2026-10-29', '254093', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Тефтели в томате', 'Мясные шарики, обжаренные и потушенные в томатном соусе.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 254093.', 'Взят вариант «Тефтели 1 («Тефтели в томате»)» со страницы; шаги пересказаны своими словами, количества — как в источнике. на странице Викиучебника вариант приводится по «Книге о вкусной и здоровой пище» (1952). Вид мяса не уточнён («мякоть»); белый хлеб входит в норму для фарша. «Масло» — так в источнике.', null,
    array['lunch', 'dinner']::text[], array['жарка', 'тушение']::text[], array['сковорода', 'кастрюля']::text[], array[]::text[],
    null, 20, null, null, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Мясо (любое)', 500::numeric, 'g', null, 'key', 'мякоть, для фарша'),
    (2, 'Хлеб пшеничный', 100::numeric, 'g', null, 'main', null),
    (3, 'Лук зелёный', 100::numeric, 'g', null, 'main', 'или 1 головка репчатого лука'),
    (4, 'Мука пшеничная', 2::numeric, 'tbsp', null, 'main', null),
    (5, 'Масло сливочное', 2::numeric, 'tbsp', null, 'main', 'в источнике — «масло»'),
    (6, 'Томат-пюре', 0.5::numeric, 'cup', null, 'key', null),
    (7, 'Бульон', 1::numeric, 'cup', null, 'main', 'мясной'),
    (8, 'Лавровый лист', null::numeric, null, '1–2 листа', 'minor', null),
    (9, 'Перец чёрный горошком', null::numeric, null, '5–6 горошин', 'minor', null),
    (10, 'Чеснок', null::numeric, null, '2–3 зубчика', 'minor', null),
    (11, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null),
    (12, 'Соус томатный острый', 1::numeric, 'tsp', null, 'optional', null),
    (13, 'Петрушка', null::numeric, null, 'для подачи', 'optional', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Приготовить мясной фарш, добавить мелко нарезанный зелёный лук (или натёртую головку репчатого) и хорошо перемешать.', null::integer),
    (2, 'Сформовать шарики по 20–30 г, обвалять в муке и обжарить со всех сторон в масле на разогретой сковороде.', null::integer),
    (3, 'Переложить тефтели в неглубокую кастрюлю, добавить томат-пюре, бульон, лавровый лист, перец горошком и растёртый с солью чеснок.', null::integer),
    (4, 'Накрыть крышкой и тушить на слабом огне 10–20 минут.', 20::integer),
    (5, 'Посолить, добавить ложечку острого томатного соуса. Подавать, посыпав рубленой петрушкой, с рисом, гречкой или картофелем.', null::integer)
) as v (position, instruction, minutes);

-- Вальдорфский салат (valdorfskii-salat)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Вальдорфский салат', 'https://ru.wikibooks.org/wiki/Рецепт:Вальдорфский_салат', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%92%D0%B0%D0%BB%D1%8C%D0%B4%D0%BE%D1%80%D1%84%D1%81%D0%BA%D0%B8%D0%B9_%D1%81%D0%B0%D0%BB%D0%B0%D1%82&action=history',
    '2026-10-29', '253238', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Вальдорфский салат', 'Американский салат из яблок, сельдерея и грецких орехов.', src.id, 'external', true, false, '2026-10-29'::timestamptz,
    'Состав и шаги сверены с версией страницы 253238.', 'Взят вариант «Вальдорфский салат 1» со страницы; шаги пересказаны своими словами, количества — как в источнике. Количество горчицы и лимонного сока в источнике не указано.', 'американская',
    array['lunch', 'snack']::text[], array[]::text[], array['миска']::text[], array['салат']::text[],
    null, null, null, 2, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Яблоко', 2::numeric, 'pcs', null, 'key', null),
    (2, 'Сельдерей стеблевой', null::numeric, null, '3 стебля', 'key', null),
    (3, 'Грецкие орехи', null::numeric, null, 'горсть', 'main', null),
    (4, 'Салат листовой', 1::numeric, 'pcs', null, 'main', 'кочан латука'),
    (5, 'Майонез', 4::numeric, 'tbsp', null, 'main', null),
    (6, 'Горчица', null::numeric, null, 'количество в источнике не указано', 'minor', null),
    (7, 'Лимон', null::numeric, null, 'сок, количество не указано', 'minor', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Смешать майонез с горчицей — это заправка.', null::integer),
    (2, 'Разрезать яблоки пополам, удалить семенные коробки и нарезать дольками.', null::integer),
    (3, 'Полить яблоки лимонным соком.', null::integer),
    (4, 'Нарезать сельдерей.', null::integer),
    (5, 'Смешать в миске латук, яблоки, сельдерей и кусочки орехов. Подавать с заправкой.', null::integer)
) as v (position, instruction, minutes);

-- Винегрет (vinegret)
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values ('website', 'Викиучебник — Рецепт:Винегрет', 'https://ru.wikibooks.org/wiki/Рецепт:Винегрет', 'Участники Викиучебника', 'https://ru.wikibooks.org/w/index.php?title=%D0%A0%D0%B5%D1%86%D0%B5%D0%BF%D1%82%3A%D0%92%D0%B8%D0%BD%D0%B5%D0%B3%D1%80%D0%B5%D1%82&action=history',
    '2026-10-29', '253274', 'open_license', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru')
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select 'Винегрет', 'Холодный салат из печёной свёклы и отварных овощей с растительным маслом.', src.id, 'external', true, false, null,
    null, 'Взят вариант «Винегрет 1» со страницы; шаги пересказаны своими словами, количества — как в источнике. Источник неполный: в шагах упоминается квашеная капуста, которой нет в составе, а горошек и уксус есть в составе, но не упомянуты в шагах. Перенесено без исправлений, поэтому статус проверки источника не выставлен. В источнике указано общее время — 2 часа.', 'русская',
    array['lunch', 'dinner', 'snack']::text[], array[]::text[], array['духовка', 'кастрюля', 'фольга']::text[], array['салат']::text[],
    0, 120, null, 6, null
  from src
  returning id
), ing as (
  insert into public.recipe_ingredients
    (recipe_id, position, ingredient_id, quantity, unit_code, quantity_text, importance, note)
  select rec.id, v.position,
    -- Подзапрос вернёт null для неизвестного продукта, и NOT NULL остановит миграцию.
    (select i.id from public.ingredients i where i.name = v.name and i.owner_id is null),
    v.quantity, v.unit, v.qtext, v.importance, v.note
  from rec, (values
    (1, 'Свёкла', 4::numeric, 'pcs', null, 'key', null),
    (2, 'Картофель', 3::numeric, 'pcs', null, 'main', null),
    (3, 'Огурцы маринованные', 4::numeric, 'pcs', null, 'main', 'солёные'),
    (4, 'Горошек зелёный', 350::numeric, 'g', null, 'main', null),
    (5, 'Морковь', 3::numeric, 'pcs', null, 'main', null),
    (6, 'Лук красный', 2::numeric, 'pcs', null, 'main', null),
    (7, 'Масло оливковое', 150::numeric, 'ml', null, 'main', null),
    (8, 'Уксус винный', 50::numeric, 'g', null, 'main', 'белый'),
    (9, 'Соль', 3::numeric, 'g', null, 'minor', null),
    (10, 'Перец чёрный молотый', null::numeric, 'to_taste', 'по вкусу', 'minor', null)
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
    (1, 'Обернуть свёклу фольгой и запекать в духовке 1,5 часа при 200 °C. Картофель и морковь отварить.', 90::integer),
    (2, 'Нарезать огурцы кубиками.', null::integer),
    (3, 'Если используется квашеная капуста и она очень солёная, промыть её и мелко нашинковать (капуста упомянута в шагах источника, но её нет в составе).', null::integer),
    (4, 'Смешать картофель, морковь, огурцы, лук, капусту и свёклу, немного посолить.', null::integer),
    (5, 'Заправить растительным маслом.', null::integer)
) as v (position, instruction, minutes);
