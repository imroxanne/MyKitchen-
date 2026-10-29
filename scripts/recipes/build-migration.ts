// Собирает SQL-миграцию партии рецептов из content/recipes/<партия>/*.json.
//   node scripts/recipes/build-migration.ts <партия>          — записать миграцию
//   node scripts/recipes/build-migration.ts <партия> --check  — проверить актуальность (CI)
//   node scripts/recipes/build-migration.ts --check-all       — проверить все партии
// Миграция партии, уже применённая к облаку, не меняется: новые рецепты — новой партией.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseCatalog } from '../catalog/build-migration.ts'
import { validateRecipe, type RecipeFile } from './schema.ts'

const sql = (v: string | null) => (v === null ? 'null' : `'${v.replaceAll("'", "''")}'`)
const num = (v: number | null) => (v === null ? 'null' : String(v))
const arr = (v: string[]) => `array[${v.map(sql).join(', ')}]::text[]`

export function loadCatalogNames(root: string): Set<string> {
  const dir = `${root}scripts/catalog/`
  const names = new Set<string>()
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith('.tsv'))
    .sort())
    for (const row of parseCatalog(readFileSync(dir + f, 'utf8'))) names.add(row.name)
  return names
}

export function recipeSql(r: RecipeFile): string {
  const s = r.source
  const ingredients = r.ingredients
    .map(
      (ing, i) =>
        `    (${i + 1}, ${sql(ing.ingredient)}, ${num(ing.quantity)}::numeric, ${sql(ing.unit)}, ` +
        `${sql(ing.text)}, ${sql(ing.importance)}, ${sql(ing.note)})`,
    )
    .join(',\n')
  const steps = r.steps
    .map((step, i) => `    (${i + 1}, ${sql(step.text)}, ${num(step.minutes)}::integer)`)
    .join(',\n')
  const checkedAt = r.sourceCheck ? `${sql(r.sourceCheck.date)}::timestamptz` : 'null'

  return `-- ${r.title} (${r.slug})
with src as (
  insert into public.recipe_sources
    (kind, title, url, author, authors_url, retrieved_on, source_revision, rights, license, license_url)
  values (${sql(s.kind)}, ${sql(s.title)}, ${sql(s.url)}, ${sql(s.author)}, ${sql(s.authorsUrl)},
    ${sql(s.retrievedOn)}, ${sql(s.revision)}, ${sql(s.rights)}, ${sql(s.license)}, ${sql(s.licenseUrl)})
  returning id
), rec as (
  insert into public.recipes
    (title, description, source_id, origin, is_published, is_sample, source_checked_at,
     source_checked_note, adaptation_note, cuisine, meal_types, cooking_methods, equipment, tags,
     prep_minutes, cook_minutes, difficulty, servings, yield_grams)
  select ${sql(r.title)}, ${sql(r.description)}, src.id, 'external', true, false, ${checkedAt},
    ${sql(r.sourceCheck?.note ?? null)}, ${sql(r.adaptationNote)}, ${sql(r.cuisine)},
    ${arr(r.mealTypes)}, ${arr(r.cookingMethods)}, ${arr(r.equipment)}, ${arr(r.tags)},
    ${num(r.prepMinutes)}, ${num(r.cookMinutes)}, ${num(r.difficulty)}, ${num(r.servings)}, ${num(r.yieldGrams)}
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
${ingredients}
  ) as v (position, name, quantity, unit, qtext, importance, note)
  returning 1
)
insert into public.recipe_steps (recipe_id, position, instruction, duration_minutes)
select rec.id, v.position, v.instruction, v.minutes
from rec, (values
${steps}
) as v (position, instruction, minutes);
`
}

export function buildBatch(
  batch: string,
  recipes: RecipeFile[],
  catalogNames: Set<string>,
): string {
  const errors: string[] = []
  const slugs = new Set<string>()
  for (const r of recipes) {
    if (slugs.has(r.slug)) errors.push(`${r.slug}: повторяющийся slug`)
    slugs.add(r.slug)
    for (const e of validateRecipe(r, catalogNames)) errors.push(`${r.slug}: ${e}`)
  }
  if (errors.length) throw new Error(`Ошибки в рецептах партии ${batch}:\n${errors.join('\n')}`)
  const sorted = [...recipes].sort((a, b) => a.slug.localeCompare(b.slug))
  return `-- A4. Рецепты, партия ${batch}: ${sorted.length} шт.
-- СГЕНЕРИРОВАНО из content/recipes/${batch}/*.json (node scripts/recipes/build-migration.ts ${batch}).
-- Не редактировать вручную; после применения к облаку партию не менять.

${sorted.map(recipeSql).join('\n')}`
}

function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const migrationsDir = `${root}supabase/migrations/`
  const catalogNames = loadCatalogNames(root)
  const args = process.argv.slice(2)
  const batches = args.includes('--check-all')
    ? readdirSync(`${root}content/recipes`, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : args.filter((a) => !a.startsWith('--'))
  if (!batches.length) {
    if (args.includes('--check-all')) return console.log('Партий рецептов нет')
    throw new Error('Укажите партию, например: batch-01')
  }
  const check = args.includes('--check') || args.includes('--check-all')

  for (const batch of batches) {
    const dir = `${root}content/recipes/${batch}/`
    if (!existsSync(dir)) throw new Error(`Нет папки ${dir}`)
    const recipes = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(dir + f, 'utf8')) as RecipeFile)
    const output = buildBatch(batch, recipes, catalogNames)
    const suffix = `_recipes_${batch.replaceAll('-', '_')}.sql`
    const existing = readdirSync(migrationsDir).find((f) => f.endsWith(suffix))
    if (check) {
      if (!existing || readFileSync(migrationsDir + existing, 'utf8') !== output) {
        console.error(
          `Миграция партии ${batch} устарела: node scripts/recipes/build-migration.ts ${batch}`,
        )
        process.exit(1)
      }
      console.log(`Рецепты ${batch}: ${recipes.length} шт., миграция актуальна`)
    } else {
      const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
      const path = migrationsDir + (existing ?? `${stamp}${suffix}`)
      writeFileSync(path, output)
      console.log(`Записано: ${path}`)
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
