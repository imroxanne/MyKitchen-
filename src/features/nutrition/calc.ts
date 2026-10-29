import type { Macros, NutritionLine } from './types'

export type ExclusionReason = 'optional' | 'no_quantity' | 'no_data' | 'no_unit_weight'

export interface LineResult {
  line: NutritionLine
  /** Масса в граммах; null — не удалось определить. */
  grams: number | null
  /** Как получена масса, если не из граммов. */
  conversion: Conversion | null
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

/** Как масса получена из бытовой меры — для пояснения в интерфейсе. */
export type Conversion =
  | { kind: 'volume'; mlPerUnit: number; gramsPerMl: number; portion: string }
  | { kind: 'piece'; gramsPerPiece: number; portion: string }

/** Масса строки в граммах; null — единица не переводится в граммы для этого продукта. */
function toGrams(line: NutritionLine): { grams: number; conversion: Conversion | null } | null {
  const { quantity, unitKind, unitBaseFactor, unitCode } = line
  if (quantity === null) return null
  if (unitKind === 'mass' && unitBaseFactor)
    return { grams: quantity * unitBaseFactor, conversion: null }
  if (unitKind === 'volume' && unitBaseFactor) {
    const density = line.unitWeights.find((w) => w.unitCode === 'ml')
    if (!density) return null
    return {
      grams: quantity * unitBaseFactor * density.grams,
      conversion: {
        kind: 'volume',
        mlPerUnit: unitBaseFactor,
        gramsPerMl: density.grams,
        portion: density.portion,
      },
    }
  }
  if (unitKind === 'count' && unitCode) {
    const piece = line.unitWeights.find((w) => w.unitCode === unitCode)
    if (!piece) return null
    return {
      grams: quantity * piece.grams,
      conversion: { kind: 'piece', gramsPerPiece: piece.grams, portion: piece.portion },
    }
  }
  return null
}

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
    const n = line.nutrition
    // Продукты без энергии и состава (вода, соль, сода) ничего не добавляют при любом количестве.
    if (n && n.kcal === 0 && n.protein === 0 && n.fat === 0 && n.carbs === 0)
      return {
        line,
        grams: null,
        conversion: null,
        values: ZERO,
        excluded: null,
        negligible: false,
      }
    if (line.importance === 'optional')
      return {
        line,
        grams: null,
        conversion: null,
        values: null,
        excluded: 'optional',
        negligible: false,
      }
    const negligible = line.unitCode !== null && SEASONING_UNITS.has(line.unitCode)
    if (line.quantity === null || negligible)
      return {
        line,
        grams: null,
        conversion: null,
        values: null,
        excluded: 'no_quantity',
        negligible,
      }
    if (!n)
      return { line, grams: null, conversion: null, values: null, excluded: 'no_data', negligible }
    const mass = toGrams(line)
    if (!mass)
      return {
        line,
        grams: null,
        conversion: null,
        values: null,
        excluded: 'no_unit_weight',
        negligible,
      }
    return {
      line,
      grams: mass.grams,
      conversion: mass.conversion,
      values: scale(n, mass.grams / 100),
      excluded: null,
      negligible: false,
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
