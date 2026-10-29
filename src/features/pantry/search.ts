import { normalizeName } from '../../lib/normalize'
import type { CatalogItem } from './types'

export interface SearchHit {
  item: CatalogItem
  /** Синоним, по которому найден продукт (если не по названию). */
  viaSynonym: string | null
  score: number
}

function scoreTerm(term: string, query: string): number {
  if (term === query) return 100
  if (term.startsWith(query)) return 80
  if (term.split(/[\s-]/).some((word) => word.startsWith(query))) return 60
  if (term.includes(query)) return 40
  return 0
}

function bestMatch(item: CatalogItem, query: string): SearchHit | null {
  let best: SearchHit | null = null
  const nameScore = scoreTerm(normalizeName(item.name), query)
  if (nameScore) best = { item, viaSynonym: null, score: nameScore }
  for (const synonym of item.synonyms) {
    // Совпадение по синониму чуть ниже, чем такое же по названию.
    const score = scoreTerm(normalizeName(synonym), query) - 5
    if (score > 0 && (!best || score > best.score)) best = { item, viaSynonym: synonym, score }
  }
  return best
}

function rank(items: CatalogItem[], query: string, penalty: number): SearchHit[] {
  const hits: SearchHit[] = []
  for (const item of items) {
    const hit = bestMatch(item, query)
    if (hit) hits.push({ ...hit, score: hit.score - penalty })
  }
  return hits.sort(
    (a, b) =>
      b.score - a.score ||
      a.item.name.length - b.item.name.length ||
      a.item.name.localeCompare(b.item.name, 'ru'),
  )
}

/**
 * Поиск по названиям и синонимам: точное совпадение, начало, начало слова, вхождение.
 * Если ничего не найдено, пробует отбросить окончание («помидоры» → «помидор»).
 */
export function searchCatalog(items: CatalogItem[], rawQuery: string, limit = 30): SearchHit[] {
  const query = normalizeName(rawQuery)
  if (!query) return []
  let hits = rank(items, query, 0)
  for (let cut = 1; hits.length === 0 && cut <= 2 && query.length - cut >= 3; cut++) {
    hits = rank(items, query.slice(0, -cut), 20)
  }
  return hits.slice(0, limit)
}

/** Есть ли в справочнике продукт с точно таким названием (без учёта регистра и ё). */
export function findExact(items: CatalogItem[], rawName: string): CatalogItem | undefined {
  const name = normalizeName(rawName)
  return items.find(
    (item) =>
      normalizeName(item.name) === name || item.synonyms.some((s) => normalizeName(s) === name),
  )
}
