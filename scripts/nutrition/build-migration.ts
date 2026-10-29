// Собирает миграцию с КБЖУ и массами единиц из content/nutrition/usda-*.tsv
// (их, в свою очередь, создаёт extract-fdc.ts из файлов USDA).
//   node scripts/nutrition/build-migration.ts          — записать миграцию
//   node scripts/nutrition/build-migration.ts --check  — проверить, что миграция актуальна (CI)
// Проверяет: продукты есть в справочнике, единицы допустимы, у массы единицы есть КБЖУ,
// калорийность согласуется с белками, жирами и углеводами (ловит опечатки).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseCatalog } from '../catalog/build-migration.ts'
import { BATCHES, batchFiles, parseTsv, type Batch } from './data.ts'

export const SOURCE_CODE = 'usda_fdc_sr_legacy'

/** Единицы, для которых хранится масса: ml — плотность, остальные — масса одной штуки. */
const WEIGHT_UNITS = new Set(['ml', 'pcs', 'clove', 'bunch', 'pack'])

/**
 * Продукты, у которых USDA считает энергию не по общим коэффициентам 4/9/4:
 * спирт, кислоты, много клетчатки или минеральных веществ.
 */
export const ATWATER_EXCEPTIONS: Record<string, string> = {
  Ваниль: 'экстракт содержит спирт',
  'Уксус винный': 'энергия уксусной кислоты',
  'Дрожжи прессованные': 'уточнённые коэффициенты USDA',
  Зира: 'много клетчатки',
  'Лавровый лист': 'много клетчатки',
  Лимон: 'уточнённые коэффициенты для фруктов',
  'Перец красный молотый': 'много клетчатки',
  'Перец чёрный горошком': 'много клетчатки',
  'Перец чёрный молотый': 'много клетчатки',
  Тмин: 'много клетчатки',
  'Томатная паста': 'уточнённые коэффициенты для овощей',
  Разрыхлитель: 'углеводы — крахмал-наполнитель, остальное минеральные соли',
}

export interface NutrientRow {
  name: string
  fdc: string
  description: string
  kcal: number
  protein: number
  fat: number
  carbs: number
  approximate: boolean
  note: string
}

export interface WeightRow {
  name: string
  unit: string
  grams: number
  fdc: string
  portion: string
  note: string
}

export function parseNutrients(text: string): NutrientRow[] {
  return parseTsv(text, 9).map(([name, fdc, description, kcal, p, f, c, approx, note]) => ({
    name,
    fdc,
    description,
    kcal: Number(kcal),
    protein: Number(p),
    fat: Number(f),
    carbs: Number(c),
    approximate: approx === '1',
    note,
  }))
}

export function parseWeights(text: string): WeightRow[] {
  return parseTsv(text, 6).map(([name, unit, grams, fdc, portion, note]) => ({
    name,
    unit,
    grams: Number(grams),
    fdc,
    portion,
    note,
  }))
}

export function validate(nutrients: NutrientRow[], weights: WeightRow[], catalog: Set<string>) {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const n of nutrients) {
    if (!catalog.has(n.name)) errors.push(`«${n.name}» нет в справочнике продуктов`)
    if (seen.has(n.name)) errors.push(`«${n.name}» повторяется`)
    seen.add(n.name)
    const values = [n.kcal, n.protein, n.fat, n.carbs]
    if (values.some((v) => !Number.isFinite(v) || v < 0)) errors.push(`«${n.name}»: неверные числа`)
    if (n.protein + n.fat + n.carbs > 100.5) errors.push(`«${n.name}»: Б+Ж+У больше 100 г`)
    const atwater = 4 * n.protein + 9 * n.fat + 4 * n.carbs
    if (Math.abs(n.kcal - atwater) > Math.max(0.12 * n.kcal, 12) && !ATWATER_EXCEPTIONS[n.name])
      errors.push(`«${n.name}»: ${n.kcal} ккал не согласуется с БЖУ (${Math.round(atwater)})`)
  }
  const weightKeys = new Set<string>()
  for (const w of weights) {
    if (!seen.has(w.name)) errors.push(`масса единицы для «${w.name}» без КБЖУ`)
    if (!WEIGHT_UNITS.has(w.unit)) errors.push(`«${w.name}»: недопустимая единица ${w.unit}`)
    if (!(w.grams > 0)) errors.push(`«${w.name}» ${w.unit}: масса должна быть больше 0`)
    if (w.unit === 'ml' && (w.grams < 0.2 || w.grams > 2))
      errors.push(`«${w.name}»: плотность ${w.grams} г/мл неправдоподобна`)
    const key = `${w.name}|${w.unit}`
    if (weightKeys.has(key)) errors.push(`«${w.name}» ${w.unit} повторяется`)
    weightKeys.add(key)
  }
  if (errors.length) throw new Error(`Ошибки в данных КБЖУ:\n${errors.join('\n')}`)
}

const sql = (value: string) => `'${value.replaceAll("'", "''")}'`
const nullable = (value: string) => (value ? sql(value) : 'null')

export function buildMigration(
  nutrients: NutrientRow[],
  weights: WeightRow[],
  state: Batch['state'] = 'as_purchased',
): string {
  if (state !== 'as_purchased') return buildStateMigration(nutrients, weights, state)
  const nutrientValues = nutrients
    .map(
      (n) =>
        `  (${sql(n.name)}, ${sql(n.fdc)}, ${sql(n.description)}, ${n.kcal}, ${n.protein}, ` +
        `${n.fat}, ${n.carbs}, ${n.approximate}, ${nullable(n.note)})`,
    )
    .join(',\n')
  const weightValues = weights
    .map(
      (w) =>
        `  (${sql(w.name)}, ${sql(w.unit)}, ${w.grams}, ${sql(w.fdc)}, ${sql(w.portion)}, ` +
        `${nullable(w.note)})`,
    )
    .join(',\n')
  return `-- A7. КБЖУ продуктов справочника (${nutrients.length}) и масса единиц (${weights.length}).
-- Источник: USDA FoodData Central, SR Legacy (2018-04), общественное достояние (CC0 1.0).
-- СГЕНЕРИРОВАНО из content/nutrition/usda-*.tsv (node scripts/nutrition/build-migration.ts).
-- Не редактировать вручную.

insert into public.ingredient_nutrition
  (ingredient_id, source_code, source_food_id, source_food_name, kcal, protein_g, fat_g, carbs_g,
   is_approximate, note)
select i.id, '${SOURCE_CODE}', v.fdc, v.description, v.kcal, v.protein, v.fat, v.carbs, v.approx, v.note
from (values
${nutrientValues}
) as v (name, fdc, description, kcal, protein, fat, carbs, approx, note)
join public.ingredients i on i.name = v.name and i.owner_id is null;

insert into public.ingredient_unit_weights
  (ingredient_id, unit_code, grams, source_code, source_food_id, source_portion, note)
select i.id, v.unit, v.grams, '${SOURCE_CODE}', v.fdc, v.portion, v.note
from (values
${weightValues}
) as v (name, unit, grams, fdc, portion, note)
join public.ingredients i on i.name = v.name and i.owner_id is null;

-- Все строки нашли свой продукт в справочнике.
do $$
begin
  if (select count(*) from public.ingredient_nutrition where source_code = '${SOURCE_CODE}') <> ${nutrients.length}
    or (select count(*) from public.ingredient_unit_weights where source_code = '${SOURCE_CODE}') <> ${weights.length}
  then
    raise exception 'КБЖУ: не все продукты найдены в справочнике';
  end if;
end;
$$;
`
}

/** Партия продуктов в другом состоянии (после варки): те же таблицы, своё значение state. */
function buildStateMigration(
  nutrients: NutrientRow[],
  weights: WeightRow[],
  state: string,
): string {
  const nutrientValues = nutrients
    .map(
      (n) =>
        `  (${sql(n.name)}, ${sql(n.fdc)}, ${sql(n.description)}, ${n.kcal}, ${n.protein}, ` +
        `${n.fat}, ${n.carbs}, ${n.approximate}, ${nullable(n.note)})`,
    )
    .join(',\n')
  const weightValues = weights
    .map(
      (w) =>
        `  (${sql(w.name)}, ${sql(w.unit)}, ${w.grams}, ${sql(w.fdc)}, ${sql(w.portion)}, ` +
        `${nullable(w.note)})`,
    )
    .join(',\n')
  return `-- B1. КБЖУ продуктов в состоянии «${state}» (${nutrients.length}) и масса единиц (${weights.length}).
-- Источник: USDA FoodData Central, SR Legacy (2018-04), общественное достояние (CC0 1.0).
-- СГЕНЕРИРОВАНО из content/nutrition/usda-*-${state}.tsv (node scripts/nutrition/build-migration.ts).
-- Не редактировать вручную.

insert into public.ingredient_nutrition
  (ingredient_id, state, source_code, source_food_id, source_food_name, kcal, protein_g, fat_g,
   carbs_g, is_approximate, note)
select i.id, '${state}', '${SOURCE_CODE}', v.fdc, v.description, v.kcal, v.protein, v.fat, v.carbs,
  v.approx, v.note
from (values
${nutrientValues}
) as v (name, fdc, description, kcal, protein, fat, carbs, approx, note)
join public.ingredients i on i.name = v.name and i.owner_id is null;

insert into public.ingredient_unit_weights
  (ingredient_id, state, unit_code, grams, source_code, source_food_id, source_portion, note)
select i.id, '${state}', v.unit, v.grams, '${SOURCE_CODE}', v.fdc, v.portion, v.note
from (values
${weightValues}
) as v (name, unit, grams, fdc, portion, note)
join public.ingredients i on i.name = v.name and i.owner_id is null;

-- Все строки нашли свой продукт в справочнике.
do $$
begin
  if (select count(*) from public.ingredient_nutrition where state = '${state}') <> ${nutrients.length}
    or (select count(*) from public.ingredient_unit_weights where state = '${state}') <> ${weights.length}
  then
    raise exception 'КБЖУ (${state}): не все продукты найдены в справочнике';
  end if;
end;
$$;
`
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const catalogDir = `${root}scripts/catalog/`
  const catalog = new Set(
    readdirSync(catalogDir)
      .filter((f) => f.endsWith('.tsv'))
      .flatMap((f) => parseCatalog(readFileSync(catalogDir + f, 'utf8')).map((r) => r.name)),
  )
  const content = `${root}content/nutrition/`
  const migrationsDir = `${root}supabase/migrations/`
  let stale = false
  for (const batch of BATCHES) {
    const files = batchFiles(batch)
    const nutrients = parseNutrients(readFileSync(content + files.nutrients, 'utf8'))
    const weights = parseWeights(readFileSync(content + files.weights, 'utf8'))
    validate(nutrients, weights, catalog)

    const output = buildMigration(nutrients, weights, batch.state)
    const existing = readdirSync(migrationsDir).find((f) => f.endsWith(files.migrationEnd))
    if (process.argv.includes('--check')) {
      if (!existing || readFileSync(migrationsDir + existing, 'utf8') !== output) {
        console.error(
          `Миграция КБЖУ (${files.nutrients}) устарела: запустите node scripts/nutrition/build-migration.ts`,
        )
        stale = true
      } else
        console.log(
          `КБЖУ ${files.nutrients}: ${nutrients.length} продуктов, ${weights.length} масс единиц, миграция актуальна`,
        )
    } else {
      // Модель (таблицы) должна идти раньше данных: метка времени — после неё.
      const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
      const path = migrationsDir + (existing ?? stamp + files.migrationEnd)
      writeFileSync(path, output)
      console.log(`Записано: ${path}`)
    }
  }
  if (stale) process.exit(1)
}
