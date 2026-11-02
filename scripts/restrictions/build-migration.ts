// Собирает миграцию с группами ограничений и разметкой продуктов из content/restrictions/*.tsv.
//   node scripts/restrictions/build-migration.ts          — записать миграцию
//   node scripts/restrictions/build-migration.ts --check  — проверить, что миграция актуальна (CI)
// Проверяет: известные коды групп, нет кода сразу в «содержит» и «может содержать», каждый
// продукт общего справочника размечен (строка без кодов — «проверен, групп нет»), нет лишних.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseCatalog } from '../catalog/build-migration.ts'

export interface Group {
  code: string
  kind: 'allergen' | 'diet'
  name: string
  description: string
}

export interface Marking {
  name: string
  contains: string[]
  mayContain: string[]
  note: string
}

function rows(text: string, columns: number): string[][] {
  const result: string[][] = []
  text.split('\n').forEach((raw, index) => {
    if (!raw.trim() || raw.startsWith('#')) return
    const cells = raw.split('\t')
    if (cells.length !== columns)
      throw new Error(`строка ${index + 1}: ожидалось столбцов ${columns}, есть ${cells.length}`)
    result.push(cells.map((c) => c.trim()))
  })
  return result
}

export function parseGroups(text: string): Group[] {
  const groups = rows(text, 4).map(([code, kind, name, description]) => {
    if (!/^[a-z_]+$/.test(code!)) throw new Error(`код группы «${code}»: только a–z и _`)
    if (kind !== 'allergen' && kind !== 'diet') throw new Error(`группа ${code}: вид «${kind}»`)
    return { code: code!, kind, name: name!, description: description! } as Group
  })
  const codes = groups.map((g) => g.code)
  if (new Set(codes).size !== codes.length) throw new Error('повтор кода группы')
  return groups
}

const codes = (cell: string) =>
  cell
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)

export function parseMarkings(text: string, groups: Group[], catalog: string[]): Marking[] {
  const known = new Set(groups.map((g) => g.code))
  const errors: string[] = []
  const markings = rows(text, 4).map(([name, contains, may, note]) => {
    const m = { name: name!, contains: codes(contains!), mayContain: codes(may!), note: note! }
    for (const c of [...m.contains, ...m.mayContain])
      if (!known.has(c)) errors.push(`${m.name}: неизвестная группа «${c}»`)
    for (const c of m.contains)
      if (m.mayContain.includes(c)) errors.push(`${m.name}: «${c}» и в «содержит», и в «может»`)
    if (m.note.length > 300) errors.push(`${m.name}: пояснение длиннее 300 символов`)
    return m
  })
  const names = markings.map((m) => m.name)
  const seen = new Set<string>()
  for (const n of names) {
    if (seen.has(n)) errors.push(`«${n}» размечен дважды`)
    seen.add(n)
  }
  for (const n of catalog) if (!seen.has(n)) errors.push(`«${n}» из справочника не размечен`)
  const inCatalog = new Set(catalog)
  for (const n of names) if (!inCatalog.has(n)) errors.push(`«${n}» нет в справочнике`)
  if (errors.length) throw new Error(`Ошибки разметки ограничений:\n${errors.join('\n')}`)
  return markings
}

const sql = (value: string) => `'${value.replaceAll("'", "''")}'`

export function buildMigration(groups: Group[], markings: Marking[]): string {
  const groupValues = groups
    .map(
      (g, i) =>
        `  (${sql(g.code)}, ${sql(g.kind)}, ${sql(g.name)}, ${sql(g.description)}, ${i + 1})`,
    )
    .join(',\n')
  const reviewed = markings
    .map((m) => `  (${sql(m.name)}, ${m.note ? sql(m.note) : 'null'})`)
    .join(',\n')
  const relations = markings
    .flatMap((m) => [
      ...m.contains.map((c) => `  (${sql(m.name)}, ${sql(c)}, 'contains')`),
      ...m.mayContain.map((c) => `  (${sql(m.name)}, ${sql(c)}, 'may_contain')`),
    ])
    .join(',\n')
  return `-- B4. Группы ограничений и разметка ${markings.length} продуктов общего справочника.
-- СГЕНЕРИРОВАНО из content/restrictions/*.tsv (node scripts/restrictions/build-migration.ts).
-- Не редактировать вручную. Разметка по типичному составу продукта, а не по конкретной упаковке.

insert into public.restriction_groups (code, kind, name, description, sort) values
${groupValues};

update public.ingredients i
set composition_reviewed = true, composition_note = v.note
from (values
${reviewed}
) as v (name, note)
where i.name = v.name and i.owner_id is null;

insert into public.ingredient_restriction_groups (ingredient_id, group_code, relation)
select i.id, v.code, v.relation
from (values
${relations}
) as v (name, code, relation)
join public.ingredients i on i.name = v.name and i.owner_id is null;
`
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const catalogDir = `${root}scripts/catalog/`
  const catalog = readdirSync(catalogDir)
    .filter((f) => f.endsWith('.tsv'))
    .flatMap((f) => parseCatalog(readFileSync(catalogDir + f, 'utf8')).map((r) => r.name))
  const groups = parseGroups(readFileSync(`${root}content/restrictions/groups.tsv`, 'utf8'))
  const markings = parseMarkings(
    readFileSync(`${root}content/restrictions/ingredients.tsv`, 'utf8'),
    groups,
    catalog,
  )
  const output = buildMigration(groups, markings)
  // Имя файла начинается с версии, под которой миграция применена к облаку; ищем по суффиксу.
  const migrationsDir = `${root}supabase/migrations/`
  const migrationEnd = '_restrictions_data.sql'
  const existing = readdirSync(migrationsDir).find((f) => f.endsWith(migrationEnd))
  if (process.argv.includes('--check')) {
    if (!existing || readFileSync(migrationsDir + existing, 'utf8') !== output) {
      console.error(
        'Миграция разметки ограничений устарела: запустите node scripts/restrictions/build-migration.ts',
      )
      process.exit(1)
    }
    console.log(
      `Ограничения: ${groups.length} групп, ${markings.length} продуктов, миграция актуальна`,
    )
  } else {
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
    const path = migrationsDir + (existing ?? stamp + migrationEnd)
    writeFileSync(path, output)
    console.log(`Записано: ${path}`)
  }
}
