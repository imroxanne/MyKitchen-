// Формат файла рецепта (content/recipes/<партия>/<slug>.json) и его проверка.
// Правило: ничего не выдумывать. Чего нет в источнике — null (время, порции)
// или текст как в источнике («по вкусу») вместо числа.

export interface RecipeSourceFile {
  kind: 'website' | 'youtube' | 'book' | 'own' | 'other'
  /** Название страницы/книги, как в источнике. */
  title: string
  url: string | null
  author: string | null
  /** Страница со списком авторов (история правок). */
  authorsUrl: string | null
  /** Дата получения, YYYY-MM-DD. */
  retrievedOn: string
  /** Версия страницы (oldid), с которой взят рецепт. */
  revision: string | null
  rights: 'own' | 'permission' | 'open_license' | 'link_only' | 'public_domain'
  license: string | null
  licenseUrl: string | null
}

export interface RecipeIngredientFile {
  /** Каноническое название из справочника (scripts/catalog/*.tsv). */
  ingredient: string
  quantity: number | null
  unit: string | null
  /** Как в источнике, если не сводится к числу: «по вкусу», «2–3 шт.». */
  text: string | null
  importance: 'key' | 'main' | 'minor' | 'optional'
  note: string | null
}

export interface RecipeFile {
  slug: string
  title: string
  description: string | null
  source: RecipeSourceFile
  /** Что изменено относительно источника. */
  adaptationNote: string
  /** Проверка источника и полноты данных: дата и что именно сверено. */
  sourceCheck: { date: string; note: string } | null
  cuisine: string | null
  mealTypes: string[]
  cookingMethods: string[]
  equipment: string[]
  tags: string[]
  prepMinutes: number | null
  cookMinutes: number | null
  difficulty: 1 | 2 | 3 | null
  servings: number | null
  yieldGrams: number | null
  ingredients: RecipeIngredientFile[]
  steps: { text: string; minutes: number | null }[]
}

export const UNIT_CODES = new Set([
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
const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'drink'])
const IMPORTANCE = new Set(['key', 'main', 'minor', 'optional'])
const RIGHTS = new Set(['own', 'permission', 'open_license', 'link_only', 'public_domain'])
const DATE = /^\d{4}-\d{2}-\d{2}$/
const URL = /^https:\/\/\S+$/

const isNonNegInt = (v: unknown) => v === null || (Number.isInteger(v) && (v as number) >= 0)
const isPositive = (v: unknown) => v === null || (typeof v === 'number' && v > 0)
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0

/** Возвращает список ошибок рецепта (пустой — всё в порядке). */
export function validateRecipe(r: RecipeFile, catalogNames: Set<string>): string[] {
  const e: string[] = []
  if (!/^[a-z0-9-]+$/.test(r.slug ?? '')) e.push('slug: только латиница, цифры и дефис')
  if (!text(r.title)) e.push('title: пусто')
  if (!text(r.adaptationNote))
    e.push('adaptationNote: опишите, что изменено относительно источника')

  const s = r.source
  if (!s) e.push('source: не указан')
  else {
    if (!text(s.title)) e.push('source.title: пусто')
    if (s.kind !== 'own' && s.kind !== 'book' && !URL.test(s.url ?? ''))
      e.push('source.url: нужна https-ссылка на оригинал')
    if (!DATE.test(s.retrievedOn ?? '')) e.push('source.retrievedOn: дата YYYY-MM-DD')
    if (!RIGHTS.has(s.rights)) e.push(`source.rights: недопустимо «${s.rights}»`)
    if (s.rights === 'open_license') {
      if (!text(s.license) || !URL.test(s.licenseUrl ?? ''))
        e.push('source: для открытой лицензии нужны license и licenseUrl')
      if (!URL.test(s.authorsUrl ?? '') && !text(s.author))
        e.push('source: для открытой лицензии нужны авторы (author или authorsUrl)')
    }
  }

  if (r.sourceCheck && (!DATE.test(r.sourceCheck.date) || !text(r.sourceCheck.note)))
    e.push('sourceCheck: нужны дата и описание того, что сверено')

  for (const m of r.mealTypes ?? []) if (!MEAL_TYPES.has(m)) e.push(`mealTypes: «${m}»`)
  if (!isNonNegInt(r.prepMinutes) || !isNonNegInt(r.cookMinutes))
    e.push('prepMinutes/cookMinutes: целое ≥ 0 или null')
  if (r.difficulty !== null && ![1, 2, 3].includes(r.difficulty)) e.push('difficulty: 1–3 или null')
  if (!isPositive(r.servings) || !isPositive(r.yieldGrams))
    e.push('servings/yieldGrams: > 0 или null')

  if (!r.ingredients?.length) e.push('ingredients: пусто')
  r.ingredients?.forEach((ing, i) => {
    const at = `ingredients[${i + 1}] «${ing.ingredient}»`
    if (!catalogNames.has(ing.ingredient)) e.push(`${at}: нет в справочнике продуктов`)
    if (!IMPORTANCE.has(ing.importance)) e.push(`${at}: importance «${ing.importance}»`)
    if (ing.unit !== null && !UNIT_CODES.has(ing.unit)) e.push(`${at}: единица «${ing.unit}»`)
    if (ing.quantity !== null && !(ing.quantity > 0)) e.push(`${at}: количество > 0`)
    if (ing.quantity !== null && ing.unit === null) e.push(`${at}: количество без единицы`)
    if (ing.quantity === null && !text(ing.text))
      e.push(`${at}: без количества нужен текст из источника («по вкусу» и т. п.)`)
  })

  if (!r.steps?.length) e.push('steps: пусто')
  r.steps?.forEach((step, i) => {
    if (!text(step.text)) e.push(`steps[${i + 1}]: пустой шаг`)
    if (!isNonNegInt(step.minutes)) e.push(`steps[${i + 1}]: minutes — целое ≥ 0 или null`)
  })
  return e
}
