-- B1. КБЖУ продуктов в состоянии «cooked» (12) и масса единиц (9).
-- Источник: USDA FoodData Central, SR Legacy (2018-04), общественное достояние (CC0 1.0).
-- СГЕНЕРИРОВАНО из content/nutrition/usda-*-cooked.tsv (node scripts/nutrition/build-migration.ts).
-- Не редактировать вручную.

insert into public.ingredient_nutrition
  (ingredient_id, state, source_code, source_food_id, source_food_name, kcal, protein_g, fat_g,
   carbs_g, is_approximate, note)
select i.id, 'cooked', 'usda_fdc_sr_legacy', v.fdc, v.description, v.kcal, v.protein, v.fat, v.carbs,
  v.approx, v.note
from (values
  ('Гречка', '170686', 'Buckwheat groats, roasted, cooked', 92, 3.38, 0.62, 19.94, false, 'варёная на воде'),
  ('Рис', '168878', 'Rice, white, long-grain, regular, enriched, cooked', 130, 2.69, 0.28, 28.17, false, 'белый длиннозёрный, варёный'),
  ('Макароны', '169737', 'Pasta, cooked, enriched, without added salt', 158, 5.8, 0.93, 30.86, false, 'варёные, без соли'),
  ('Горох колотый', '172429', 'Peas, split, mature seeds, cooked, boiled, without salt', 118, 8.34, 0.39, 21.1, false, 'варёный, без соли'),
  ('Картофель', '170438', 'Potatoes, boiled, cooked in skin, flesh, without salt', 87, 1.87, 0.1, 20.13, false, 'варёный в кожуре, без кожуры при еде'),
  ('Яйцо куриное', '173424', 'Egg, whole, cooked, hard-boiled', 155, 12.58, 10.61, 1.12, false, 'сваренное вкрутую'),
  ('Свёкла', '169146', 'Beets, cooked, boiled, drained', 44, 1.68, 0.18, 9.96, false, 'варёная'),
  ('Морковь', '170394', 'Carrots, cooked, boiled, drained, without salt', 35, 0.76, 0.18, 8.22, false, 'варёная, без соли'),
  ('Манная крупа', '171659', 'Cereals, farina, enriched, assorted brands including CREAM OF WHEAT, quick (1-3 minutes), cooked with water, without salt', 55, 1.82, 0.34, 10.92, true, 'манная каша на воде (данные американской каши из манки быстрого приготовления)'),
  ('Капуста белокочанная', '169976', 'Cabbage, cooked, boiled, drained, without salt', 23, 1.27, 0.06, 5.51, false, 'варёная, без соли'),
  ('Фасоль стручковая', '169141', 'Beans, snap, green, cooked, boiled, drained, without salt', 35, 1.89, 0.28, 7.88, false, 'варёная, без соли'),
  ('Лук репчатый', '170001', 'Onions, cooked, boiled, drained, without salt', 44, 1.36, 0.19, 10.15, false, 'варёный, без соли')
) as v (name, fdc, description, kcal, protein, fat, carbs, approx, note)
join public.ingredients i on i.name = v.name and i.owner_id is null;

insert into public.ingredient_unit_weights
  (ingredient_id, state, unit_code, grams, source_code, source_food_id, source_portion, note)
select i.id, 'cooked', v.unit, v.grams, 'usda_fdc_sr_legacy', v.fdc, v.portion, v.note
from (values
  ('Гречка', 'ml', 0.7101, '170686', '1 cup = 168g', null),
  ('Рис', 'ml', 0.6678, '168878', '1 cup = 158g', null),
  ('Горох колотый', 'ml', 0.8284, '172429', '1 cup = 196g', null),
  ('Манная крупа', 'ml', 1.0144, '171659', '1 cup = 240g', 'каша'),
  ('Яйцо куриное', 'pcs', 50, '173424', '1 large = 50g', 'крупное, без скорлупы'),
  ('Картофель', 'pcs', 136, '170438', '1 potato (2-1/2" dia, sphere) = 136g', null),
  ('Морковь', 'pcs', 46, '170394', '1 carrot = 46g', null),
  ('Свёкла', 'pcs', 50, '169146', '2 beets (2" dia, sphere) = 100g', null),
  ('Лук репчатый', 'pcs', 94, '170001', '1 medium = 94g', null)
) as v (name, unit, grams, fdc, portion, note)
join public.ingredients i on i.name = v.name and i.owner_id is null;

-- Все строки нашли свой продукт в справочнике.
do $$
begin
  if (select count(*) from public.ingredient_nutrition where state = 'cooked') <> 12
    or (select count(*) from public.ingredient_unit_weights where state = 'cooked') <> 9
  then
    raise exception 'КБЖУ (cooked): не все продукты найдены в справочнике';
  end if;
end;
$$;
