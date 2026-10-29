import { effectiveWeights, toGrams, toMilliliters, type Conversion } from './convert'
import type { Macros, NutritionLine } from './types'

export type { Conversion } from './convert'

export type ExclusionReason = 'optional' | 'no_quantity' | 'no_data' | 'no_unit_weight'

export interface LineResult {
  line: NutritionLine
  /** Количество в единицах данных (г или мл); null — не удалось определить. */
  amount: number | null
  amountUnit: 'g' | 'ml'
  /** Как получено количество, если не напрямую. */
  conversion: Conversion | null
  /** Количество получено через среднюю массу штуки или плотность. */
  approximate: boolean
  /** Чьи данные: справочник или ваша упаковка. */
  source: 'reference' | 'package' | null
  values: Macros | null
  excluded: ExclusionReason | null
  /** Исключение почти не влияет на итог: «по вкусу», «щепотка». */
  negligible: boolean
}

export interface NutritionResult {
  total: Macros
  perServing: Macros | null
  per100g: Macros | null
  lines: LineResult[]
  counted: LineResult[]
  /** Неучтённые строки, заметно влияющие на итог. */
  missing: LineResult[]
  /** Неучтённые строки «по вкусу» — их вклад мал. */
  minor: LineResult[]
  /** Ингредиенты «по желанию» — в базовый расчёт не входят. */
  optional: LineResult[]
  /** Есть заметные неучтённые продукты: итог занижен. */
  incomplete: boolean
}

const ZERO: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0 }

const scale = (m: Macros, k: number): Macros => ({
  kcal: m.kcal * k,
  protein: m.protein * k,
  fat: m.fat * k,
  carbs: m.carbs * k,
})

const add = (a: Macros, b: Macros): Macros => ({
  kcal: a.kcal + b.kcal,
  protein: a.protein + b.protein,
  fat: a.fat + b.fat,
  carbs: a.carbs + b.carbs,
})

const SEASONING_UNITS = new Set(['to_taste', 'pinch'])

/** Данные строки: ваши с упаковки (на 100 г или 100 мл) или справочные (на 100 г). */
function effectiveData(line: NutritionLine) {
  if (line.userNutrition)
    return {
      macros: line.userNutrition as Macros,
      basis: line.userNutrition.basis,
      source: 'package' as const,
    }
  if (line.nutrition)
    return {
      macros: line.nutrition as Macros,
      basis: '100g' as const,
      source: 'reference' as const,
    }
  return null
}

const isZero = (m: Macros) => m.kcal === 0 && m.protein === 0 && m.fat === 0 && m.carbs === 0

/**
 * КБЖУ блюда по ингредиентам: КБЖУ_на_100г × масса_г / 100, сумма по строкам (ТЗ §9).
 * Неизвестное не подменяется числом: такие строки перечисляются отдельно.
 */
export function calculateNutrition(
  lines: NutritionLine[],
  servings: number | null,
  yieldGrams: number | null = null,
): NutritionResult {
  const results = lines.map((line): LineResult => {
    const data = effectiveData(line)
    const base = {
      line,
      amount: null,
      amountUnit: data?.basis === '100ml' ? ('ml' as const) : ('g' as const),
      conversion: null,
      approximate: false,
      source: data?.source ?? null,
      negligible: false,
    }
    // Продукты без энергии и состава (вода, соль, сода) ничего не добавляют при любом количестве.
    if (data && isZero(data.macros)) return { ...base, values: ZERO, excluded: null }
    if (line.importance === 'optional') return { ...base, values: null, excluded: 'optional' }
    const negligible = line.unitCode !== null && SEASONING_UNITS.has(line.unitCode)
    if (line.quantity === null || negligible)
      return { ...base, values: null, excluded: 'no_quantity', negligible }
    if (!data) return { ...base, values: null, excluded: 'no_data' }
    const unit = { code: line.unitCode, kind: line.unitKind, baseFactor: line.unitBaseFactor }
    const weights = effectiveWeights(line.unitWeights, line.userNutrition)
    const amount =
      data.basis === '100ml'
        ? toMilliliters(line.quantity, unit, weights)
        : toGrams(line.quantity, unit, weights)
    if (!amount) return { ...base, values: null, excluded: 'no_unit_weight' }
    return {
      ...base,
      amount: amount.value,
      conversion: amount.conversion,
      approximate: amount.approximate,
      values: scale(data.macros, amount.value / 100),
      excluded: null,
    }
  })
  const counted = results.filter((r) => r.excluded === null)
  const total = counted.reduce((sum, r) => add(sum, r.values ?? ZERO), ZERO)
  const missing = results.filter(
    (r) => r.excluded !== null && r.excluded !== 'optional' && !r.negligible,
  )
  return {
    total,
    perServing: servings ? scale(total, 1 / servings) : null,
    per100g: yieldGrams ? scale(total, 100 / yieldGrams) : null,
    lines: results,
    counted,
    missing,
    minor: results.filter((r) => r.excluded !== null && r.negligible),
    optional: results.filter((r) => r.excluded === 'optional'),
    incomplete: missing.length > 0,
  }
}
