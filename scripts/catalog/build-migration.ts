// Собирает SQL-миграцию общего справочника продуктов из ingredients.tsv.
//   node scripts/catalog/build-migration.ts          — записать миграцию
//   node scripts/catalog/build-migration.ts --check  — проверить, что миграция актуальна (CI)
// Проверяет: известные категории и единицы, уникальность названий и синонимов
// после нормализации, отсутствие синонимов, совпадающих с чужими названиями.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { normalizeName } from '../../src/lib/normalize.ts'

const CATEGORIES = new Set([
  'vegetables',
  'fruits',
  'mushrooms',
  'grains',
  'legumes',
  'bakery',
  'dairy',
  'meat',
  'fish',
  'nuts',
  'oils',
  'sauces',
  'spices',
  'sweets',
  'canned',
  'drinks',
  'other',
])
const UNITS = new Set([
  'g',
  'kg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'pcs',
  'clove',
  'bunch',
  'pack',
  'pinch',
  'to_taste',
])

interface Row {
  category: string
  name: string
  unit: string
  synonyms: string[]
  line: number
}

export function parseCatalog(text: string): Row[] {
  const rows: Row[] = []
  const errors: string[] = []
  const names = new Map<string, number>()
  const synonyms = new Map<string, number>()

  text.split('\n').forEach((raw, index) => {
    const line = index + 1
    if (!raw.trim() || raw.startsWith('#')) return
    const [category = '', name = '', unit = '', synonymList = ''] = raw.split('\t')
    if (!CATEGORIES.has(category))
      errors.push(`строка ${line}: неизвестная категория «${category}»`)
    if (!UNITS.has(unit)) errors.push(`строка ${line}: неизвестная единица «${unit}»`)
    if (!name.trim()) errors.push(`строка ${line}: пустое название`)
    const key = normalizeName(name)
    if (names.has(key)) errors.push(`строка ${line}: «${name}» повторяет строку ${names.get(key)}`)
    names.set(key, line)
    const syns = synonymList
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const syn of syns) {
      const synKey = normalizeName(syn)
      if (synonyms.has(synKey))
        errors.push(`строка ${line}: синоним «${syn}» уже есть в строке ${synonyms.get(synKey)}`)
      synonyms.set(synKey, line)
    }
    rows.push({ category, name: name.trim(), unit, synonyms: syns, line })
  })

  for (const [synKey, line] of synonyms) {
    const nameLine = names.get(synKey)
    if (nameLine !== undefined)
      errors.push(`строка ${line}: синоним «${synKey}» совпадает с названием в строке ${nameLine}`)
  }
  if (errors.length) throw new Error(`Ошибки в справочнике:\n${errors.join('\n')}`)
  return rows
}

const sql = (value: string) => `'${value.replaceAll("'", "''")}'`

export function buildMigration(
  rows: Row[],
  sourceFile = 'ingredients.tsv',
  title = 'A3. Общий справочник продуктов',
): string {
  const ingredientValues = rows
    .map((r) => `  (${sql(r.name)}, ${sql(r.category)}, ${sql(r.unit)})`)
    .join(',\n')
  const synonymValues = rows
    .flatMap((r) => r.synonyms.map((s) => `  (${sql(r.name)}, ${sql(s)})`))
    .join(',\n')
  return `-- ${title}: ${rows.length} позиций.
-- СГЕНЕРИРОВАНО из scripts/catalog/${sourceFile} (node scripts/catalog/build-migration.ts).
-- Не редактировать вручную. Только названия, категории, единицы и синонимы —
-- пищевая ценность и масса штуки добавляются отдельно с указанием источника (A7/B1).

insert into public.ingredients (name, category_slug, default_unit) values
${ingredientValues};

insert into public.ingredient_synonyms (ingredient_id, synonym)
select i.id, s.synonym
from (values
${synonymValues}
) as s (name, synonym)
join public.ingredients i on i.name = s.name and i.owner_id is null;
`
}

/** Повторы названий и синонимов между файлами справочника (партиями). */
export function checkAcrossFiles(files: { name: string; rows: Row[] }[]): void {
  const seen = new Map<string, string>()
  const errors: string[] = []
  for (const { name, rows } of files)
    for (const row of rows)
      for (const term of [row.name, ...row.synonyms]) {
        const key = normalizeName(term)
        const where = `${name}:${row.line}`
        const prev = seen.get(key)
        if (prev && prev.split(':')[0] !== name)
          errors.push(`«${term}» (${where}) уже есть в ${prev}`)
        seen.set(key, prev ?? where)
      }
  if (errors.length) throw new Error(`Повторы между партиями справочника:\n${errors.join('\n')}`)
}

/** Номер партии по имени файла: ingredients.tsv → '', ingredients-2.tsv → '_2'. */
export function batchSuffix(file: string): string {
  const m = /^ingredients(?:-(\d+))?\.tsv$/.exec(file)
  if (!m) throw new Error(`Неожиданное имя файла справочника: ${file}`)
  return m[1] ? `_${m[1]}` : ''
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const catalogDir = `${root}scripts/catalog/`
  // Имя файла миграции начинается с версии, под которой она применена к облаку; ищем по суффиксу.
  const migrationsDir = `${root}supabase/migrations/`
  const files = readdirSync(catalogDir)
    .filter((f) => f.endsWith('.tsv'))
    .sort((a, b) => batchSuffix(a).localeCompare(batchSuffix(b), 'en', { numeric: true }))
  const parsed = files.map((name) => ({
    name,
    rows: parseCatalog(readFileSync(catalogDir + name, 'utf8')),
  }))
  checkAcrossFiles(parsed)

  for (const { name, rows } of parsed) {
    const suffix = batchSuffix(name)
    const title = suffix
      ? `Справочник продуктов, дополнение ${suffix.slice(1)}`
      : 'A3. Общий справочник продуктов'
    const output = buildMigration(rows, name, title)
    const migrationEnd = `_ingredient_catalog${suffix}.sql`
    const existing = readdirSync(migrationsDir).find((f) => f.endsWith(migrationEnd))
    if (process.argv.includes('--check')) {
      if (!existing || readFileSync(migrationsDir + existing, 'utf8') !== output) {
        console.error(
          `Миграция справочника (${name}) устарела: запустите node scripts/catalog/build-migration.ts`,
        )
        process.exit(1)
      }
      console.log(`Справочник ${name}: ${rows.length} позиций, миграция актуальна`)
    } else {
      const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
      const path = migrationsDir + (existing ?? stamp + migrationEnd)
      writeFileSync(path, output)
      console.log(`Записано: ${path}`)
    }
  }
}
