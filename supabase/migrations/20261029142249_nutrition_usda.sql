-- A7. КБЖУ продуктов справочника (71) и масса единиц (41).
-- Источник: USDA FoodData Central, SR Legacy (2018-04), общественное достояние (CC0 1.0).
-- СГЕНЕРИРОВАНО из content/nutrition/usda-*.tsv (node scripts/nutrition/build-migration.ts).
-- Не редактировать вручную.

insert into public.ingredient_nutrition
  (ingredient_id, source_code, source_food_id, source_food_name, kcal, protein_g, fat_g, carbs_g,
   is_approximate, note)
select i.id, 'usda_fdc_sr_legacy', v.fdc, v.description, v.kcal, v.protein, v.fat, v.carbs, v.approx, v.note
from (values
  ('Анчоусы', '174183', 'Fish, anchovy, european, canned in oil, drained solids', 210, 28.89, 9.71, 0, false, 'консервированные в масле, без жидкости'),
  ('Артишоки', '169205', 'Artichokes, (globe or french), raw', 47, 3.27, 0.15, 10.51, false, null),
  ('Базилик', '172232', 'Basil, fresh', 23, 3.15, 0.64, 2.65, false, null),
  ('Банан', '173944', 'Bananas, raw', 89, 1.09, 0.33, 22.84, false, null),
  ('Баранина', '172496', 'Lamb, shoulder, whole (arm and blade), separable lean and fat, trimmed to 1/4" fat, choice, raw', 264, 16.58, 21.45, 0, true, 'лопатка с жиром; жирность баранины сильно различается'),
  ('Бульон', '172883', 'Soup, stock, beef, home-prepared', 13, 1.97, 0.09, 1.2, true, 'говяжий домашний; состав бульона зависит от рецепта'),
  ('Ваниль', '173471', 'Vanilla extract', 288, 0.06, 0.06, 12.65, true, 'ванильный экстракт; ванильный сахар — другой продукт'),
  ('Ветчина', '173864', 'Ham, sliced, regular (approximately 11% fat)', 164, 16.6, 8.8, 3.63, true, 'нарезка, около 11 % жира'),
  ('Вода', '174158', 'Water, bottled, generic', 0, 0, 0, 0, false, null),
  ('Говядина', '169542', 'Beef, tenderloin, steak, separable lean and fat, trimmed to 1/8" fat, all grades, raw', 247, 19.61, 18.16, 0, true, 'вырезка с жиром; жирность говядины зависит от части туши'),
  ('Горох колотый', '172428', 'Peas, green, split, mature seeds, raw', 364, 23.12, 3.89, 61.63, false, 'сухой'),
  ('Горошек зелёный', '170013', 'Peas, green (includes baby and lesuer types), canned, drained solids, unprepared', 68, 4.47, 0.8, 11.36, true, 'консервированный, без жидкости; свежий или замороженный — другие значения'),
  ('Горчица', '172234', 'Mustard, prepared, yellow', 60, 3.74, 3.34, 5.83, true, 'американская жёлтая; русская горчица отличается'),
  ('Грецкие орехи', '170187', 'Nuts, walnuts, english', 654, 15.23, 65.21, 13.71, false, null),
  ('Гречка', '170685', 'Buckwheat groats, roasted, dry', 346, 11.73, 2.71, 74.95, false, 'ядрица, сухая'),
  ('Дрожжи прессованные', '175042', 'Leavening agents, yeast, baker''s, compressed', 105, 8.4, 1.9, 18.1, false, null),
  ('Жир топлёный', '171401', 'Lard', 902, 0, 100, 0, true, 'свиной; говяжий близок по калорийности'),
  ('Зира', '170923', 'Spices, cumin seed', 375, 17.81, 22.27, 44.24, false, 'семена'),
  ('Изюм', '168165', 'Raisins, dark, seedless (Includes foods for USDA''s Food Distribution Program)', 299, 3.3, 0.25, 79.32, false, null),
  ('Капуста белокочанная', '169975', 'Cabbage, raw', 25, 1.28, 0.1, 5.8, false, null),
  ('Картофель', '170026', 'Potatoes, flesh and skin, raw', 77, 2.05, 0.09, 17.49, false, 'с кожурой, сырой'),
  ('Кинза', '169997', 'Coriander (cilantro) leaves, raw', 23, 2.13, 0.52, 3.67, false, 'листья'),
  ('Лавровый лист', '170917', 'Spices, bay leaf', 313, 7.61, 8.36, 74.97, false, null),
  ('Лимон', '167746', 'Lemons, raw, without peel', 29, 1.1, 0.3, 9.32, false, 'без кожуры'),
  ('Лук зелёный', '170005', 'Onions, spring or scallions (includes tops and bulb), raw', 32, 1.83, 0.19, 7.34, false, null),
  ('Лук красный', '170000', 'Onions, raw', 40, 1.1, 0.1, 9.34, true, 'данные репчатого лука; у красного в USDA нет отдельной записи'),
  ('Лук репчатый', '170000', 'Onions, raw', 40, 1.1, 0.1, 9.34, false, null),
  ('Майонез', '171009', 'Salad dressing, mayonnaise, regular', 680, 0.96, 74.85, 0.57, true, 'классический американский, около 75 % жира; российский бывает 30–80 %'),
  ('Макароны', '169736', 'Pasta, dry, enriched', 371, 13.04, 1.51, 74.67, false, 'сухие'),
  ('Манная крупа', '169715', 'Semolina, enriched', 360, 12.68, 1.05, 72.83, false, null),
  ('Масло оливковое', '171413', 'Oil, olive, salad or cooking', 884, 0, 100, 0, false, null),
  ('Масло подсолнечное', '171017', 'Oil, sunflower, linoleic (less than 60%)', 884, 0, 100, 0, false, null),
  ('Масло сливочное', '173430', 'Butter, without salt', 717, 0.85, 81.11, 0.06, true, 'несолёное, 81 % жира; российское — 72,5–82,5 %'),
  ('Масло топлёное', '173412', 'Butter oil, anhydrous', 876, 0.28, 99.48, 0, false, null),
  ('Молоко', '171265', 'Milk, whole, 3.25% milkfat, with added vitamin D', 61, 3.15, 3.25, 4.8, true, '3,25 %; российское чаще 2,5–3,2 %'),
  ('Морковь', '170393', 'Carrots, raw', 41, 0.93, 0.24, 9.58, false, null),
  ('Мука пшеничная', '168894', 'Wheat flour, white, all-purpose, enriched, bleached', 364, 10.33, 0.98, 76.31, false, 'высший сорт'),
  ('Огурец', '168409', 'Cucumber, with peel, raw', 15, 0.65, 0.11, 3.63, false, 'с кожурой'),
  ('Огурцы маринованные', '169379', 'Pickles, cucumber, sour', 11, 0.33, 0.2, 2.26, true, 'солёные (квашеные); маринованные близки'),
  ('Оливки', '169094', 'Olives, ripe, canned (small-extra large)', 116, 0.84, 10.9, 6.04, false, 'чёрные консервированные'),
  ('Панировочные сухари', '174928', 'Bread, crumbs, dry, grated, plain', 395, 13.35, 5.3, 71.98, false, null),
  ('Перец болгарский', '170108', 'Peppers, sweet, red, raw', 26, 0.99, 0.3, 6.03, true, 'красный; зелёный немного менее калорийный'),
  ('Перец красный молотый', '170932', 'Spices, pepper, red or cayenne', 318, 12.01, 17.27, 56.63, false, 'кайенский'),
  ('Перец чили', '170106', 'Peppers, hot chili, red, raw', 40, 1.87, 0.44, 8.81, false, 'красный, свежий'),
  ('Перец чёрный горошком', '170931', 'Spices, pepper, black', 251, 10.39, 3.26, 63.95, false, null),
  ('Перец чёрный молотый', '170931', 'Spices, pepper, black', 251, 10.39, 3.26, 63.95, false, null),
  ('Петрушка', '170416', 'Parsley, fresh', 36, 2.97, 0.79, 6.33, false, null),
  ('Разрыхлитель', '172803', 'Leavening agents, baking powder, double-acting, sodium aluminum sulfate', 53, 0, 0, 27.7, false, null),
  ('Рис', '168877', 'Rice, white, long-grain, regular, raw, enriched', 365, 7.13, 0.66, 79.95, false, 'белый длиннозёрный, сухой'),
  ('Салат листовой', '169249', 'Lettuce, green leaf, raw', 15, 1.36, 0.15, 2.87, false, null),
  ('Сахар', '169655', 'Sugars, granulated', 387, 0, 0, 99.98, false, null),
  ('Свёкла', '169145', 'Beets, raw', 43, 1.61, 0.17, 9.56, false, null),
  ('Сельдерей стеблевой', '169988', 'Celery, raw', 14, 0.69, 0.17, 2.97, false, null),
  ('Сметана', '171257', 'Cream, sour, cultured', 198, 2.44, 19.35, 4.63, true, 'около 19 % жира; российская — 10–30 %'),
  ('Сода пищевая', '175040', 'Leavening agents, baking soda', 0, 0, 0, 0, false, null),
  ('Соль', '173468', 'Salt, table', 0, 0, 0, 0, false, null),
  ('Сыр твёрдый', '171241', 'Cheese, gouda', 356, 24.94, 27.44, 2.22, true, 'данные гауды; российские твёрдые сыры близки'),
  ('Творог', '172179', 'Cheese, cottage, creamed, large or small curd', 98, 11.12, 4.3, 3.38, true, 'зернёный 4 %; российский творог — 0–18 %'),
  ('Тмин', '170918', 'Spices, caraway seed', 333, 19.77, 14.59, 49.9, false, 'семена'),
  ('Томат', '170457', 'Tomatoes, red, ripe, raw, year round average', 18, 0.88, 0.2, 3.89, false, null),
  ('Томат-пюре', '170460', 'Tomato products, canned, puree, without salt added', 38, 1.65, 0.21, 8.98, false, 'консервированное, без соли'),
  ('Томатная паста', '170459', 'Tomato products, canned, paste, without salt added (Includes foods for USDA''s Food Distribution Program)', 82, 4.32, 0.47, 18.91, false, 'без соли'),
  ('Укроп', '172233', 'Dill weed, fresh', 43, 3.46, 1.12, 7.02, false, null),
  ('Уксус винный', '172240', 'Vinegar, red wine', 19, 0.04, 0, 0.27, true, 'данные красного винного уксуса; белый близок'),
  ('Фарш свино-говяжий', '174036+167902', 'Beef, ground, 80% lean meat / 20% fat, raw + Pork, fresh, ground, raw', 258.5, 17.02, 20.59, 0, true, 'среднее говяжьего (80/20) и свиного фарша поровну'),
  ('Фасоль стручковая', '169961', 'Beans, snap, green, raw', 31, 1.83, 0.22, 6.97, false, null),
  ('Хлеб пшеничный', '174924', 'Bread, white, commercially prepared (includes soft bread crumbs)', 266, 8.85, 3.33, 49.42, false, 'белый'),
  ('Чеснок', '169230', 'Garlic, raw', 149, 6.36, 0.5, 33.06, false, null),
  ('Шоколад тёмный', '170273', 'Chocolate, dark, 70-85% cacao solids', 598, 7.79, 42.63, 45.9, true, '70–85 % какао'),
  ('Яблоко', '171688', 'Apples, raw, with skin (Includes foods for USDA''s Food Distribution Program)', 52, 0.26, 0.17, 13.81, false, 'с кожурой'),
  ('Яйцо куриное', '171287', 'Egg, whole, raw, fresh', 143, 12.56, 9.51, 0.72, false, 'без скорлупы')
) as v (name, fdc, description, kcal, protein, fat, carbs, approx, note)
join public.ingredients i on i.name = v.name and i.owner_id is null;

insert into public.ingredient_unit_weights
  (ingredient_id, unit_code, grams, source_code, source_food_id, source_portion, note)
select i.id, v.unit, v.grams, 'usda_fdc_sr_legacy', v.fdc, v.portion, v.note
from (values
  ('Яйцо куриное', 'pcs', 50, '171287', '1 large = 50g', 'крупное, без скорлупы'),
  ('Лук репчатый', 'pcs', 110, '170000', '1 medium (2-1/2" dia) = 110g', 'средняя луковица'),
  ('Лук репчатый', 'ml', 0.6763, '170000', '1 cup, chopped = 160g', 'нарезанный'),
  ('Лук красный', 'pcs', 110, '170000', '1 medium (2-1/2" dia) = 110g', 'средняя луковица'),
  ('Морковь', 'pcs', 61, '170393', '1 medium = 61g', null),
  ('Картофель', 'pcs', 213, '170026', '1 Potato medium (2-1/4" to 3-1/4" dia) = 213g', null),
  ('Томат', 'pcs', 123, '170457', '1 medium whole (2-3/5" dia) = 123g', null),
  ('Яблоко', 'pcs', 182, '171688', '1 medium (3" dia) = 182g', null),
  ('Банан', 'pcs', 118, '173944', '1 medium (7" to 7-7/8" long) = 118g', null),
  ('Свёкла', 'pcs', 82, '169145', '1 beet (2" dia) = 82g', 'небольшая'),
  ('Огурец', 'pcs', 301, '168409', '1 cucumber (8-1/4") = 301g', 'крупный'),
  ('Огурцы маринованные', 'pcs', 65, '169379', '1 medium (3-3/4" long) = 65g', null),
  ('Перец болгарский', 'pcs', 119, '170108', '1 medium (approx 2-3/4" long, 2-1/2 dia.) = 119g', null),
  ('Артишоки', 'pcs', 128, '169205', '1 artichoke, medium = 128g', null),
  ('Грецкие орехи', 'pcs', 4, '170187', '1 cup, in shell, edible yield (7 nuts) = 28g', 'ядро одного ореха'),
  ('Чеснок', 'clove', 3, '169230', '1 clove = 3g', null),
  ('Хлеб пшеничный', 'pcs', 29, '174924', '1 slice = 29g', 'ломтик'),
  ('Салат листовой', 'pcs', 360, '169249', '1 head = 360g', 'кочан'),
  ('Лимон', 'pcs', 58, '167746', '1 fruit (2-1/8" dia) = 58g', null),
  ('Молоко', 'ml', 1.0313, '171265', '1 cup = 244g', null),
  ('Мука пшеничная', 'ml', 0.5283, '168894', '1 cup = 125g', null),
  ('Сахар', 'ml', 0.8454, '169655', '1 cup = 200g', null),
  ('Масло подсолнечное', 'ml', 0.9214, '171017', '1 cup = 218g', null),
  ('Масло оливковое', 'ml', 0.913, '171413', '1 cup = 216g', null),
  ('Масло сливочное', 'ml', 0.9595, '173430', '1 cup = 227g', null),
  ('Сметана', 'ml', 0.9722, '171257', '1 cup = 230g', null),
  ('Вода', 'ml', 1, '174158', '1 ml = 1g', null),
  ('Бульон', 'ml', 1.0144, '172883', '1 cup = 240g', null),
  ('Томат-пюре', 'ml', 1.0567, '170460', '1 cup = 250g', null),
  ('Томатная паста', 'ml', 1.1074, '170459', '1 cup = 262g', null),
  ('Рис', 'ml', 0.782, '168877', '1 cup = 185g', null),
  ('Гречка', 'ml', 0.6932, '170685', '1 cup = 164g', null),
  ('Манная крупа', 'ml', 0.7059, '169715', '1 cup = 167g', null),
  ('Ваниль', 'ml', 0.8792, '173471', '1 cup = 208g', null),
  ('Разрыхлитель', 'ml', 0.9333, '172803', '1 tsp = 4.6g', null),
  ('Сода пищевая', 'ml', 0.9333, '175040', '1 tsp = 4.6g', null),
  ('Соль', 'ml', 1.2173, '173468', '1 tsp = 6g', null),
  ('Майонез', 'ml', 0.9299, '171009', '1 cup = 220g', null),
  ('Панировочные сухари', 'ml', 0.4565, '174928', '1 cup = 108g', null),
  ('Уксус винный', 'ml', 1.0102, '172240', '1 cup = 239g', null),
  ('Сыр твёрдый', 'ml', 0.4776, '173414', '1 cup, shredded = 113g', 'тёртый; мера по чеддеру — у гауды в USDA нет меры объёма')
) as v (name, unit, grams, fdc, portion, note)
join public.ingredients i on i.name = v.name and i.owner_id is null;

-- Все строки нашли свой продукт в справочнике.
do $$
begin
  if (select count(*) from public.ingredient_nutrition where source_code = 'usda_fdc_sr_legacy') <> 71
    or (select count(*) from public.ingredient_unit_weights where source_code = 'usda_fdc_sr_legacy') <> 41
  then
    raise exception 'КБЖУ: не все продукты найдены в справочнике';
  end if;
end;
$$;
