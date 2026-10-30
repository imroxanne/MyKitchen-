// Дневник питания (B3): снимок блюда или продукта, КБЖУ съеденного, суммы за день.
// Чистые функции, без обращения к сети.
import { calculateNutrition } from '../nutrition/calc'
import type { Macros, NutritionLine } from '../nutrition/types'
import { describeAmount, plural } from '../recipes/present'
import type { RecipeIngredientLine } from '../recipes/types'
import type { DiaryEntry, DiarySnapshot, Eaten, Meal } from './types'
import { MEALS } from './types'

const ZERO: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0 }

/** Как в БД: два знака после запятой. */
const round2 = (v: number) => Math.round(v * 100) / 100

const mapMacros = (m: Macros, f: (v: number) => number): Macros => ({
  kcal: f(m.kcal),
  protein: f(m.protein),
  fat: f(m.fat),
  carbs: f(m.carbs),
})

const addMacros = (a: Macros, b: Macros): Macros => ({
  kcal: a.kcal + b.kcal,
  protein: a.protein + b.protein,
  fat: a.fat + b.fat,
  carbs: a.carbs + b.carbs,
})

/**
 * Снимок блюда по рецепту (оригинал или своя версия) — состав и КБЖУ всего блюда так, как они
 * показаны на странице. Если порции не указаны, записывается доля блюда.
 */
export function snapshotFromRecipe(input: {
  recipeId: number
  versionId: number | null
  title: string
  lines: (RecipeIngredientLine & NutritionLine)[]
  servings: number | null
  /** Масса готового блюда (своё взвешивание или источник); null — по массе не записать. */
  yieldGrams: number | null
}): DiarySnapshot {
  const result = calculateNutrition(input.lines, input.servings, input.yieldGrams)
  return {
    kind: 'recipe',
    title: input.title,
    recipeId: input.recipeId,
    versionId: input.versionId,
    ingredientId: null,
    baseServings: input.servings ?? 1,
    servingUnit: input.servings ? 'portion' : 'dish',
    baseAmount: input.yieldGrams,
    amountUnit: 'g',
    base: mapMacros(result.total, round2),
    incomplete: result.incomplete,
    composition: input.lines.map((line, i) => {
      const values = result.lines[i]?.values
      return {
        name: line.name,
        amount: describeAmount(line),
        kcal: values && result.lines[i]?.excluded === null ? round2(values.kcal) : null,
      }
    }),
  }
}

/** Снимок продукта: КБЖУ на 100 г (или 100 мл — для данных с упаковки на 100 мл). */
export function snapshotFromProduct(input: {
  ingredientId: number
  title: string
  per100: Macros
  unit: 'g' | 'ml'
}): DiarySnapshot {
  return {
    kind: 'product',
    title: input.title,
    recipeId: null,
    versionId: null,
    ingredientId: input.ingredientId,
    baseServings: null,
    servingUnit: 'portion',
    baseAmount: 100,
    amountUnit: input.unit,
    base: mapMacros(input.per100, round2),
    incomplete: false,
    composition: [],
  }
}

/** Своё блюдо без рецепта (например, покупное): КБЖУ на 100 г или на одну порцию. */
export function snapshotFromCustom(input: {
  title: string
  macros: Macros
  per: '100g' | 'portion'
}): DiarySnapshot {
  return {
    kind: 'custom',
    title: input.title,
    recipeId: null,
    versionId: null,
    ingredientId: null,
    baseServings: input.per === 'portion' ? 1 : null,
    servingUnit: 'portion',
    baseAmount: input.per === '100g' ? 100 : null,
    amountUnit: 'g',
    base: mapMacros(input.macros, round2),
    incomplete: false,
    composition: [],
  }
}

/** Доля основы, которая съедена; null — так записать нельзя (нет порций или массы). */
export function eatenFraction(snapshot: DiarySnapshot, eaten: Eaten): number | null {
  if (eaten.servings !== null)
    return snapshot.baseServings ? eaten.servings / snapshot.baseServings : null
  return snapshot.baseAmount ? eaten.amount / snapshot.baseAmount : null
}

/** КБЖУ съеденного — как считает БД: КБЖУ основы × доля, два знака. */
export function eatenMacros(snapshot: DiarySnapshot, eaten: Eaten): Macros | null {
  const fraction = eatenFraction(snapshot, eaten)
  return fraction === null ? null : mapMacros(snapshot.base, (v) => round2(v * fraction))
}

export interface MealGroup {
  meal: Meal
  entries: DiaryEntry[]
  total: Macros
}

export interface DaySummary {
  total: Macros
  /** Только приёмы пищи, в которых есть записи, по порядку дня. */
  meals: MealGroup[]
  /** Хотя бы у одной записи расчёт неполный: итог занижен. */
  incomplete: boolean
}

const sumEaten = (entries: DiaryEntry[]) => entries.reduce((s, e) => addMacros(s, e.eaten), ZERO)

export function daySummary(entries: DiaryEntry[]): DaySummary {
  return {
    total: mapMacros(sumEaten(entries), round2),
    meals: MEALS.map((meal) => {
      const list = entries.filter((e) => e.meal === meal)
      return { meal, entries: list, total: mapMacros(sumEaten(list), round2) }
    }).filter((g) => g.entries.length > 0),
    incomplete: entries.some((e) => e.incomplete),
  }
}

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

/** «1,5 порции», «0,5 блюда», «200 г», «250 мл». */
export function describeEaten(entry: Pick<DiarySnapshot, 'servingUnit' | 'amountUnit'> & Eaten) {
  if (entry.servings === null)
    return `${numberFormat.format(entry.amount)} ${entry.amountUnit === 'ml' ? 'мл' : 'г'}`
  const forms: [string, string, string] =
    entry.servingUnit === 'dish' ? ['блюдо', 'блюда', 'блюд'] : ['порция', 'порции', 'порций']
  return `${numberFormat.format(entry.servings)} ${plural(entry.servings, forms)}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Дата YYYY-MM-DD по местному времени. */
export const localDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Сдвиг даты YYYY-MM-DD на n дней (без влияния перехода на летнее время). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y!, m! - 1, d! + days, 12))
}

export const isValidDate = (date: string | null): date is string =>
  !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && shiftDate(date, 0) === date

/** Приём пищи по времени — только подсказка по умолчанию. */
export function defaultMeal(time: Date): Meal {
  const h = time.getHours()
  if (h >= 5 && h < 11) return 'breakfast'
  if (h >= 11 && h < 16) return 'lunch'
  if (h >= 16 && h < 22) return 'dinner'
  return 'snack'
}

/** Число > 0 с запятой или точкой; '' → null; иначе NaN. */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!t) return null
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN
}

export const showDecimal = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))

/** Ошибка количества съеденного или null, если всё в порядке. */
export function validateEaten(eaten: Eaten): string | null {
  if (eaten.servings !== null)
    return eaten.servings > 0 && eaten.servings <= 100
      ? null
      : 'Количество — число больше нуля, например 0,5 или 1,5.'
  return eaten.amount > 0 && eaten.amount <= 10000
    ? null
    : 'Масса — число граммов больше нуля (не больше 10 000).'
}

/** Сообщение после записи: что записано. */
export const eatenMessage = (entry: DiaryEntry) =>
  `Записано в дневник: ${entry.title}, ${describeEaten(entry)}.`
