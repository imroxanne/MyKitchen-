// Ищет фото блюда на странице-источнике рецепта (Викиучебник) и берёт его, только если
// лицензия свободная (CC0, общественное достояние, CC BY, CC BY-SA). Автор и лицензия
// берутся из описания файла на Wikimedia Commons; фото без автора не берётся (ТЗ §4).
//   node scripts/recipes/fetch-images.ts <партия-фото> [<партия рецептов>…]
// Пример: node scripts/recipes/fetch-images.ts images-01 batch-01
// Результат — content/recipes/<партия-фото>.json и уменьшенные копии в public/recipe-images/
// (сайт раздаёт их сам: не зависим от лимитов Wikimedia и не нагружаем её сервер).
// Из JSON build-images-migration.ts собирает миграцию. Нужен интернет; запросы — по одному,
// с паузами, при ответе 429 — повтор с ожиданием.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { RecipeFile } from './schema.ts'

export interface RecipeImageEntry {
  /** slug рецепта и ссылка на его источник — по ссылке миграция находит рецепт в БД. */
  slug: string
  recipeSourceUrl: string
  /** Имя файла на Wikimedia Commons. */
  file: string
  /** Откуда скачана уменьшенная копия (до 960 px). */
  remoteUrl: string
  /** Копия на сайте: public/recipe-images/<slug>.<расширение>. */
  path: string
  /** Страница файла: автор, лицензия, история. */
  sourceUrl: string
  author: string
  license: string
  retrievedOn: string
}

const UA = 'MyKitchenBot/0.1 (https://github.com/imroxanne/MyKitchen-; personal recipe app)'
const API = 'https://ru.wikibooks.org/w/api.php'
const PHOTO = /\.(jpe?g|png|webp)$/i
const FREE_LICENSE = /^(cc0|public domain|pd\b|cc by(-sa)? \d(\.\d)?)/i

/** Фото есть, но не подходит к рецепту — решение принято вручную, с причиной. */
const SKIP: Record<string, string> = {
  sharlotka: 'на странице фото шарлотки с клубникой — другое блюдо, не берём',
}

// Commons подставляет такую фразу, когда автор не указан машиночитаемо.
const UNKNOWN_AUTHOR = /сведения об авторе отсутствуют|author information|unknown author/i

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Запрос с паузой после него и повтором при 429 (слишком много запросов). */
async function get(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    await sleep(1500)
    if (res.status === 429 && attempt < 4) {
      await sleep(10_000 * 2 ** attempt)
      continue
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
    return res
  }
}

async function api(params: Record<string, string>): Promise<any> {
  return (
    await get(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`)
  ).json()
}

/** Текст без HTML: в метаданных Commons автор часто — ссылка на страницу участника. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Фото блюда — первое изображение, упомянутое в тексте самой страницы. Значки и картинки
 * шаблонов (обложка «Книги рецептов», звезда, икра) в текст страницы не входят.
 */
export function pickPhoto(wikitext: string, images: string[]): string | null {
  const norm = (t: string) => t.replace(/^(Файл|File|Изображение|Image):/i, '').replaceAll('_', ' ')
  const text = wikitext.replaceAll('_', ' ')
  let best: { title: string; at: number } | null = null
  for (const title of images) {
    if (!PHOTO.test(title)) continue
    const at = text.indexOf(norm(title))
    if (at >= 0 && (!best || at < best.at)) best = { title, at }
  }
  return best?.title ?? null
}

export const isFreeLicense = (license: string) => FREE_LICENSE.test(license.trim())

async function findImage(
  r: RecipeFile,
  today: string,
  root: string,
): Promise<RecipeImageEntry | string> {
  const url = r.source.url
  if (!url?.startsWith('https://ru.wikibooks.org/wiki/')) return 'источник не Викиучебник'
  const title = decodeURIComponent(url.slice('https://ru.wikibooks.org/wiki/'.length)).replaceAll(
    '_',
    ' ',
  )
  const skip = SKIP[r.slug]
  if (skip) return skip
  const page = (await api({ action: 'query', prop: 'images', imlimit: '50', titles: title })).query
    .pages[0]
  // Текст той версии страницы, с которой сверен рецепт.
  const rev = (
    await api({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      ...(r.source.revision ? { revids: r.source.revision } : { titles: title }),
    })
  ).query.pages[0].revisions?.[0]
  const file = pickPhoto(
    rev?.slots?.main?.content ?? '',
    (page.images ?? []).map((i: { title: string }) => i.title),
  )
  if (!file) return 'на странице нет фото'

  const info = (
    await api({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '960',
      titles: file,
    })
  ).query.pages[0].imageinfo?.[0]
  if (!info) return `нет описания файла ${file}`
  const meta = info.extmetadata ?? {}
  const license = plainText(meta.LicenseShortName?.value ?? '')
  const author = plainText(meta.Artist?.value ?? '').slice(0, 120)
  if (!isFreeLicense(license)) return `${file}: лицензия «${license || 'не указана'}» — не берём`
  if (!author || UNKNOWN_AUTHOR.test(author)) return `${file}: автор не указан — не берём`
  // Без меток отслеживания в адресе.
  const remoteUrl = String(info.thumburl ?? info.url).split('?')[0]
  const ext = (remoteUrl.match(/\.(jpe?g|png|webp)$/i)?.[1] ?? 'jpg').toLowerCase()
  const path = `/recipe-images/${r.slug}.${ext === 'jpeg' ? 'jpg' : ext}`
  const bytes = new Uint8Array(await (await get(remoteUrl)).arrayBuffer())
  mkdirSync(`${root}public/recipe-images`, { recursive: true })
  writeFileSync(`${root}public${path}`, bytes)
  return {
    slug: r.slug,
    recipeSourceUrl: url,
    file: file.replace(/^Файл:/, ''),
    remoteUrl,
    path,
    sourceUrl: info.descriptionurl,
    author,
    license,
    retrievedOn: today,
  }
}

async function main() {
  const [batch, ...recipeBatches] = process.argv.slice(2)
  if (!batch || recipeBatches.length === 0)
    throw new Error('Укажите партию фото и партии рецептов: images-01 batch-01')
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const today = new Date().toISOString().slice(0, 10)
  const found: RecipeImageEntry[] = []
  for (const rb of recipeBatches) {
    const dir = `${root}content/recipes/${rb}/`
    for (const f of readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()) {
      const recipe = JSON.parse(readFileSync(dir + f, 'utf8')) as RecipeFile
      const result = await findImage(recipe, today, root)
      if (typeof result === 'string') console.log(`– ${recipe.title}: ${result}`)
      else {
        console.log(`✓ ${recipe.title}: ${result.file} (${result.author}, ${result.license})`)
        found.push(result)
      }
    }
  }
  const out = `${root}content/recipes/${batch}.json`
  writeFileSync(out, JSON.stringify(found, null, 2) + '\n')
  console.log(`Записано ${found.length} фото в ${out}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
