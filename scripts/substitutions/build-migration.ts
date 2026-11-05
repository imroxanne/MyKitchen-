// Собирает миграцию справочника замен из content/substitutions/substitutions.tsv.
//   node scripts/substitutions/build-migration.ts          — записать миграцию
//   node scripts/substitutions/build-migration.ts --check  — проверить, что миграция актуальна (CI)
// Проверяет: оба продукта есть в справочнике и размечены по составу, единица известна, пропорция
// — число больше нуля, виды блюд допустимы, область применимости, влияние и предупреждение
// заполнены, уровень подтверждения известен, пары не повторяются.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseCatalog } from '../catalog/build-migration.ts'

export const CONTEXTS = ['baking', 'frying', 'boiling', 'stewing', 'cold'] as const
const CONFIDENCE = ['practice', 'source', 'tested']
const UNITS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'pcs', 'clove', 'bunch', 'pack']

export interface Substitution {
  from: string
  to: string
  ratio: number
  toUnit: string | null
  amountNote: string
  contexts: string[]
  scope: string
  effect: string
  warning: string
  confidence: string
}

export function parseSubstitutions(text: string, catalog: string[]): Substitution[] {
  const known = new Set(catalog)
  const errors: string[] = []
  const seen = new Set<string>()
  const result: Substitution[] = []
  text.split('\n').forEach((raw, index) => {
    if (!raw.trim() || raw.startsWith('#')) return
    const line = index + 1
    const cells = raw.split('\t').map((c) => c.trim())
    if (cells.length !== 10) {
      errors.push(`строка ${line}: ожидалось столбцов 10, есть ${cells.length}`)
      return
    }
    const [from, to, ratio, toUnit, amountNote, contexts, scope, effect, warning, confidence] =
      cells as [string, string, string, string, string, string, string, string, string, string]
    const s: Substitution = {
      from,
      to,
      ratio: Number(ratio),
      toUnit: toUnit || null,
      amountNote,
      contexts: contexts
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      scope,
      effect,
      warning,
      confidence,
    }
    const where = `строка ${line} (${from} → ${to})`
    for (const name of [from, to])
      if (!known.has(name)) errors.push(`${where}: «${name}» нет в справочнике`)
    if (from === to) errors.push(`${where}: замена на тот же продукт`)
    if (!(s.ratio > 0 && s.ratio <= 10)) errors.push(`${where}: пропорция «${ratio}»`)
    if (s.toUnit && !UNITS.includes(s.toUnit)) errors.push(`${where}: единица «${s.toUnit}»`)
    for (const c of s.contexts)
      if (!(CONTEXTS as readonly string[]).includes(c)) errors.push(`${where}: вид блюда «${c}»`)
    for (const [field, value] of [
      ['как отмерить', amountNote],
      ['применимость', scope],
      ['влияние', effect],
      ['предупреждение', warning],
    ] as const)
      if (!value) errors.push(`${where}: не заполнено «${field}»`)
      else if (value.length > (field === 'как отмерить' ? 200 : 300))
        errors.push(`${where}: «${field}» слишком длинное`)
    if (!CONFIDENCE.includes(confidence)) errors.push(`${where}: уровень «${confidence}»`)
    const key = `${from}→${to}`
    if (seen.has(key)) errors.push(`${where}: пара повторяется`)
    seen.add(key)
    result.push(s)
  })
  if (errors.length) throw new Error(`Ошибки в справочнике замен:\n${errors.join('\n')}`)
  return result
}

const sql = (value: string) => `'${value.replaceAll("'", "''")}'`

export function buildMigration(rows: Substitution[]): string {
  const values = rows
    .map(
      (s) =>
        `  (${sql(s.from)}, ${sql(s.to)}, ${s.ratio}, ${s.toUnit ? sql(s.toUnit) : 'null'}, ` +
        `${sql(s.amountNote)}, ${sql(`{${s.contexts.join(',')}}`)}, ${sql(s.scope)}, ` +
        `${sql(s.effect)}, ${sql(s.warning)}, ${sql(s.confidence)})`,
    )
    .join(',\n')
  return `-- B5. Справочник замен: ${rows.length} пар.
-- СГЕНЕРИРОВАНО из content/substitutions/substitutions.tsv (node scripts/substitutions/build-migration.ts).
-- Не редактировать вручную.

insert into public.ingredient_substitutions
  (from_ingredient_id, to_ingredient_id, ratio, to_unit, amount_note, contexts, scope_note, effect,
   warning, confidence)
select f.id, t.id, v.ratio, v.to_unit, v.amount_note, v.contexts::text[], v.scope_note, v.effect,
  v.warning, v.confidence
from (values
${values}
) as v (from_name, to_name, ratio, to_unit, amount_note, contexts, scope_note, effect, warning,
  confidence)
join public.ingredients f on f.name = v.from_name and f.owner_id is null
join public.ingredients t on t.name = v.to_name and t.owner_id is null;
`
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const catalogDir = `${root}scripts/catalog/`
  const catalog = readdirSync(catalogDir)
    .filter((f) => f.endsWith('.tsv'))
    .flatMap((f) => parseCatalog(readFileSync(catalogDir + f, 'utf8')).map((r) => r.name))
  const rows = parseSubstitutions(
    readFileSync(`${root}content/substitutions/substitutions.tsv`, 'utf8'),
    catalog,
  )
  const output = buildMigration(rows)
  // Имя файла начинается с версии, под которой миграция применена к облаку; ищем по суффиксу.
  const migrationsDir = `${root}supabase/migrations/`
  const migrationEnd = '_substitutions_data.sql'
  const existing = readdirSync(migrationsDir).find((f) => f.endsWith(migrationEnd))
  if (process.argv.includes('--check')) {
    if (!existing || readFileSync(migrationsDir + existing, 'utf8') !== output) {
      console.error(
        'Миграция справочника замен устарела: запустите node scripts/substitutions/build-migration.ts',
      )
      process.exit(1)
    }
    console.log(`Замены: ${rows.length} пар, миграция актуальна`)
  } else {
    const path = migrationsDir + (existing ?? `20261105100100${migrationEnd}`)
    writeFileSync(path, output)
    console.log(`Записано: ${path}`)
  }
}
