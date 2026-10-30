// Собирает миграцию с фото рецептов из content/recipes/images-NN.json (см. fetch-images.ts).
//   node scripts/recipes/build-images-migration.ts images-01          — записать миграцию
//   node scripts/recipes/build-images-migration.ts --check-all        — проверить все (CI)
// Рецепт находится по ссылке на источник. Миграция, уже применённая к облаку, не меняется:
// новые фото — новой партией. Файл копии фото обязан лежать в public/.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { RecipeImageEntry } from './fetch-images.ts'

const sql = (v: string) => `'${v.replaceAll("'", "''")}'`

export const imageCredit = (e: RecipeImageEntry) =>
  `Фото: ${e.author}, ${e.license}, Wikimedia Commons`

export function validateEntry(e: RecipeImageEntry, root: string): string[] {
  const errors: string[] = []
  if (!/^\/recipe-images\/[a-z0-9-]+\.(jpg|png|webp)$/.test(e.path)) errors.push('path')
  else if (!existsSync(`${root}public${e.path}`)) errors.push(`нет файла public${e.path}`)
  if (!e.author.trim()) errors.push('author')
  if (!/^https:\/\//.test(e.sourceUrl)) errors.push('sourceUrl')
  if (!/^https:\/\/ru\.wikibooks\.org\//.test(e.recipeSourceUrl)) errors.push('recipeSourceUrl')
  if (imageCredit(e).length > 300) errors.push('подпись длиннее 300 символов')
  return errors.map((m) => `${e.slug}: ${m}`)
}

export function imagesSql(batch: string, entries: RecipeImageEntry[]): string {
  const updates = entries
    .map(
      (e) => `-- ${e.slug}: ${e.file}
update public.recipes r set image_url = ${sql(e.path)}, image_credit = ${sql(imageCredit(e))},
  image_source_url = ${sql(e.sourceUrl)}
from public.recipe_sources s
where r.source_id = s.id and s.url = ${sql(e.recipeSourceUrl)};`,
    )
    .join('\n\n')
  return `-- Фото рецептов, партия ${batch}: ${entries.length} шт.
-- СГЕНЕРИРОВАНО из content/recipes/${batch}.json (node scripts/recipes/build-images-migration.ts ${batch}).
-- Не редактировать вручную; после применения к облаку партию не менять.
-- Фото — копии с Wikimedia Commons со свободной лицензией; автор и лицензия — в подписи.

${updates}

-- Каждое фото должно найти свой рецепт.
do $$ begin
  if (select count(*) from public.recipes where image_url like '/recipe-images/%') < ${entries.length} then
    raise exception 'не все фото партии ${batch} нашли рецепт';
  end if;
end; $$;
`
}

const suffix = (batch: string) => `_recipe_${batch.replace('-', '_')}.sql`

function migrationPath(root: string, batch: string): string | null {
  const dir = `${root}supabase/migrations/`
  const found = readdirSync(dir).find((f) => f.endsWith(suffix(batch)))
  return found ? dir + found : null
}

function build(root: string, batch: string, check: boolean): boolean {
  const entries = JSON.parse(
    readFileSync(`${root}content/recipes/${batch}.json`, 'utf8'),
  ) as RecipeImageEntry[]
  const errors = entries.flatMap((e) => validateEntry(e, root))
  if (errors.length) throw new Error(`Ошибки в ${batch}:\n${errors.join('\n')}`)
  const text = imagesSql(batch, entries)
  const existing = migrationPath(root, batch)
  if (check) {
    const ok = existing !== null && readFileSync(existing, 'utf8') === text
    console.log(`${ok ? '✓' : '✗'} ${batch}${ok ? '' : ': миграция устарела или отсутствует'}`)
    return ok
  }
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  const path = existing ?? `${root}supabase/migrations/${stamp}${suffix(batch)}`
  writeFileSync(path, text)
  console.log(`Записано: ${path}`)
  return true
}

function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const args = process.argv.slice(2)
  if (args[0] === '--check-all') {
    const batches = readdirSync(`${root}content/recipes/`)
      .filter((f) => /^images-\d+\.json$/.test(f))
      .map((f) => f.replace('.json', ''))
    const ok = batches.map((b) => build(root, b, true)).every(Boolean)
    if (!ok) process.exit(1)
    return
  }
  if (!args[0]) throw new Error('Укажите партию фото: images-01')
  build(root, args[0], args.includes('--check'))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
