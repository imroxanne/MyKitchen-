// Подбор рецептов по продуктам пользователя (A5). Чистые функции, без обращения к сети.
//
// Правила (ТЗ §3, §5):
// * учитывается значимость ингредиента: основа блюда > основной > второстепенный;
//   «по желанию» и «по вкусу» на подбор не влияют, но показываются;
// * продукт с пометкой «не учитывать» считается отсутствующим;
// * неизвестное количество не считается достаточным: «есть, количество не сравнивалось»;
// * количества сравниваются, только если единицы сопоставимы (масса с массой, объём с объёмом,
//   одинаковые штучные единицы); иначе — тоже «не сравнивалось».
import { normalizeName } from '../../lib/normalize'
import type { CatalogItem, Unit, UserProduct } from '../pantry/types'
import type { RecipeIngredientRef, RecipeSummary } from '../recipes/types'

export type Availability =
  /** Есть, и известного количества хватает. */
  | 'enough'
  /** Есть, но количество неизвестно или не сравнимо. */
  | 'present'
  /** Есть, но известного количества меньше, чем нужно. */
  | 'low'
  | 'missing'
  /** Считается доступным всегда (вода). */
  | 'assumed'

/** Продукты, которые не требуется заводить в запасах. */
const ALWAYS_AVAILABLE = new Set(['вода'])
/** Обобщённые ингредиенты справочника и категории, любой продукт которых подходит. */
const GENERIC_BY_CATEGORY: Record<string, string> = { 'мясо (любое)': 'meat' }

export const IMPORTANCE_WEIGHT: Record<RecipeIngredientRef['importance'], number> = {
  key: 10,
  main: 3,
  minor: 1,
  optional: 0,
}

export interface Pantry {
  products: UserProduct[]
  catalog: CatalogItem[]
  units: Unit[]
}

export interface PantryIndex {
  byIngredient: Map<number, UserProduct>
  byCategory: Map<string, UserProduct[]>
  units: Map<string, Unit>
  isEmpty: boolean
}

export function indexPantry(pantry: Pantry): PantryIndex {
  const categoryOf = new Map(pantry.catalog.map((item) => [item.id, item.categorySlug]))
  const byIngredient = new Map<number, UserProduct>()
  const byCategory = new Map<string, UserProduct[]>()
  for (const product of pantry.products) {
    if (product.isExcluded) continue
    byIngredient.set(product.ingredientId, product)
    const category = categoryOf.get(product.ingredientId)
    if (category) byCategory.set(category, [...(byCategory.get(category) ?? []), product])
  }
  return {
    byIngredient,
    byCategory,
    units: new Map(pantry.units.map((u) => [u.code, u])),
    isEmpty: byIngredient.size === 0,
  }
}

/** Количество в базовых единицах (г, мл) или в исходной штучной единице; null — не сравнить. */
function comparable(
  quantity: number | null,
  unitCode: string | null,
  units: Map<string, Unit>,
): { kind: string; value: number } | null {
  if (quantity === null || unitCode === null) return null
  const unit = units.get(unitCode)
  if (!unit) return null
  if ((unit.kind === 'mass' || unit.kind === 'volume') && unit.baseFactor)
    return { kind: unit.kind, value: quantity * unit.baseFactor }
  if (unit.kind === 'count') return { kind: `count:${unit.code}`, value: quantity }
  return null
}

function compareAmount(
  line: RecipeIngredientRef,
  product: UserProduct,
  units: Map<string, Unit>,
): Availability {
  const need = comparable(line.quantity, line.unitCode, units)
  const have = comparable(product.quantity, product.unitCode, units)
  if (!need || !have || need.kind !== have.kind) return 'present'
  return have.value >= need.value ? 'enough' : 'low'
}

export function ingredientAvailability(
  line: RecipeIngredientRef,
  index: PantryIndex,
): Availability {
  const name = normalizeName(line.name)
  if (ALWAYS_AVAILABLE.has(name)) return 'assumed'
  const product = index.byIngredient.get(line.ingredientId)
  if (product) return compareAmount(line, product, index.units)
  const genericCategory = GENERIC_BY_CATEGORY[name]
  if (genericCategory && index.byCategory.get(genericCategory)?.length) return 'present'
  return 'missing'
}

/** Влияет ли ингредиент на подбор (не «по желанию» и не «по вкусу»). */
export function isRequired(line: RecipeIngredientRef): boolean {
  return line.importance !== 'optional' && line.unitCode !== 'to_taste'
}

export interface IngredientMatch {
  line: RecipeIngredientRef
  availability: Availability
  required: boolean
}

export interface RecipeMatch {
  recipe: RecipeSummary
  lines: IngredientMatch[]
  /** Обязательные ингредиенты, которых нет или не хватает (их нужно докупить). */
  toBuy: IngredientMatch[]
  /** Обязательные, которые есть, но количество не сравнивалось. */
  unchecked: IngredientMatch[]
  /** Сумма весов недостающих обязательных ингредиентов: чем меньше, тем лучше. */
  missingWeight: number
  missingKey: boolean
  requiredCount: number
  availableCount: number
  totalMinutes: number | null
}

export function totalMinutes(prep: number | null, cook: number | null): number | null {
  return prep === null && cook === null ? null : (prep ?? 0) + (cook ?? 0)
}

export function matchRecipe(recipe: RecipeSummary, index: PantryIndex): RecipeMatch {
  const lines = recipe.ingredients.map((line) => ({
    line,
    availability: ingredientAvailability(line, index),
    required: isRequired(line),
  }))
  const required = lines.filter((m) => m.required)
  const toBuy = required.filter((m) => m.availability === 'missing' || m.availability === 'low')
  return {
    recipe,
    lines,
    toBuy,
    unchecked: required.filter((m) => m.availability === 'present'),
    missingWeight: toBuy.reduce((sum, m) => sum + IMPORTANCE_WEIGHT[m.line.importance], 0),
    missingKey: toBuy.some((m) => m.line.importance === 'key'),
    requiredCount: required.length,
    availableCount: required.length - toBuy.length,
    totalMinutes: totalMinutes(recipe.prepMinutes, recipe.cookMinutes),
  }
}

// ---------------------------------------------------------------------------
// Фильтры и выдача.

export type Mode = 'have' | 'buy' | 'ignore'
export type Sort = 'match' | 'time'

export interface Filters {
  /** have — только из имеющегося; buy — докупить не больше maxToBuy; ignore — без учёта запасов. */
  mode: Mode
  maxToBuy: number
  /** Максимальное общее время, мин; null — без ограничения. */
  maxMinutes: number | null
  mealType: string | null
  query: string
  verifiedOnly: boolean
  sort: Sort
}

export const DEFAULT_FILTERS: Filters = {
  mode: 'buy',
  maxToBuy: 3,
  maxMinutes: null,
  mealType: null,
  query: '',
  verifiedOnly: false,
  sort: 'match',
}

function matchesQuery(recipe: RecipeSummary, query: string): boolean {
  const terms = normalizeName(query).split(' ').filter(Boolean)
  if (!terms.length) return true
  const haystack = normalizeName(
    [recipe.title, ...recipe.tags, ...recipe.ingredients.map((i) => i.name)].join(' '),
  )
  return terms.every((term) => haystack.includes(term))
}

export interface SelectionResult {
  matches: RecipeMatch[]
  /** Сколько рецептов скрыто фильтром по времени, потому что время не указано в источнике. */
  hiddenUnknownTime: number
}

export function selectRecipes(
  recipes: RecipeSummary[],
  index: PantryIndex,
  filters: Filters,
): SelectionResult {
  let hiddenUnknownTime = 0
  const matches = recipes
    .map((recipe) => matchRecipe(recipe, index))
    .filter((m) => {
      const r = m.recipe
      if (filters.verifiedOnly && !r.trust.sourceCheckedAt && !r.trust.cookedVerifiedAt)
        return false
      if (filters.mealType && !r.mealTypes.includes(filters.mealType)) return false
      if (!matchesQuery(r, filters.query)) return false
      if (filters.mode === 'have' && m.toBuy.length > 0) return false
      if (filters.mode === 'buy' && m.toBuy.length > filters.maxToBuy) return false
      if (filters.maxMinutes !== null) {
        if (m.totalMinutes === null) {
          hiddenUnknownTime++
          return false
        }
        if (m.totalMinutes > filters.maxMinutes) return false
      }
      return true
    })

  const byTime = (a: RecipeMatch, b: RecipeMatch) =>
    (a.totalMinutes ?? Infinity) - (b.totalMinutes ?? Infinity)
  const byTitle = (a: RecipeMatch, b: RecipeMatch) =>
    a.recipe.title.localeCompare(b.recipe.title, 'ru')
  const byMatch = (a: RecipeMatch, b: RecipeMatch) =>
    Number(a.missingKey) - Number(b.missingKey) ||
    a.missingWeight - b.missingWeight ||
    a.toBuy.length - b.toBuy.length ||
    // При равной нехватке выше рецепт, где количества подтверждены, а не «не сравнивались».
    a.unchecked.length - b.unchecked.length ||
    b.availableCount / Math.max(b.requiredCount, 1) -
      a.availableCount / Math.max(a.requiredCount, 1)

  matches.sort((a, b) => {
    if (filters.sort === 'time') return byTime(a, b) || byTitle(a, b)
    if (filters.mode === 'ignore') return byTitle(a, b)
    return byMatch(a, b) || byTime(a, b) || byTitle(a, b)
  })
  return { matches, hiddenUnknownTime }
}

/** Короткие пояснения под карточкой (ТЗ §5): почему рецепт в выдаче и чего не хватает. */
export function explain(match: RecipeMatch, usePantry: boolean): string[] {
  const notes: string[] = []
  if (usePantry) {
    if (match.toBuy.length === 0) notes.push('Все нужные продукты есть')
    else {
      const names = match.toBuy.map(
        (m) =>
          `${m.line.name}${m.availability === 'low' ? ' (мало)' : ''}${m.line.importance === 'key' ? ' — основа блюда' : ''}`,
      )
      notes.push(`Не хватает: ${names.join(', ')}`)
    }
    if (match.unchecked.length)
      notes.push(
        `Количество не сравнивалось: ${match.unchecked.map((m) => m.line.name).join(', ')}`,
      )
  }
  if (match.totalMinutes !== null && match.totalMinutes <= 30)
    notes.push(`Готовится за ${match.totalMinutes} мин`)
  return notes
}
