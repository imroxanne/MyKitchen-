// Пересчёт количества в граммы и миллилитры (B1). Общий для КБЖУ и подбора по продуктам.
//
// * масса → граммы и объём → миллилитры — точно (по коэффициенту единицы);
// * объём ↔ масса — через плотность продукта (мера USDA или ваша упаковка) — приближённо;
// * штуки, зубчики, упаковки → граммы — через массу одной штуки — приближённо;
// * «по вкусу», «щепотка» и единицы без известной массы не пересчитываются: null, а не догадка.
import type { UnitWeight, UserNutrition } from './types'

export interface UnitInfo {
  code: string | null
  kind: 'mass' | 'volume' | 'count' | 'other' | null
  /** Граммы (масса) или миллилитры (объём) в одной единице. */
  baseFactor: number | null
}

/** Как количество переведено, если не напрямую — для пояснения в интерфейсе. */
export type Conversion =
  | { kind: 'volume'; mlPerUnit: number; gramsPerMl: number; portion: string }
  | { kind: 'piece'; gramsPerPiece: number; portion: string }
  | { kind: 'density'; gramsPerMl: number; portion: string }

export interface Converted {
  value: number
  /** Через среднюю массу штуки или плотность — не точное значение. */
  approximate: boolean
  conversion: Conversion | null
}

const density = (weights: UnitWeight[]) => weights.find((w) => w.unitCode === 'ml') ?? null

/**
 * Массы единиц с учётом своих данных: масса штуки и упаковки с вашей упаковки
 * заменяют средние справочные.
 */
export function effectiveWeights(
  reference: UnitWeight[],
  user: UserNutrition | null | undefined,
): UnitWeight[] {
  const own: UnitWeight[] = []
  if (user?.pieceGrams)
    own.push({ unitCode: 'pcs', grams: user.pieceGrams, portion: 'ваша масса штуки' })
  if (user?.packageGrams)
    own.push({ unitCode: 'pack', grams: user.packageGrams, portion: 'ваша упаковка' })
  return [...own, ...reference.filter((w) => !own.some((o) => o.unitCode === w.unitCode))]
}

/** Количество в граммах; null — для этого продукта единица в граммы не переводится. */
export function toGrams(
  quantity: number | null,
  unit: UnitInfo,
  weights: UnitWeight[],
): Converted | null {
  if (quantity === null) return null
  if (unit.kind === 'mass' && unit.baseFactor)
    return { value: quantity * unit.baseFactor, approximate: false, conversion: null }
  if (unit.kind === 'volume' && unit.baseFactor) {
    const d = density(weights)
    if (!d) return null
    return {
      value: quantity * unit.baseFactor * d.grams,
      approximate: true,
      conversion: {
        kind: 'volume',
        mlPerUnit: unit.baseFactor,
        gramsPerMl: d.grams,
        portion: d.portion,
      },
    }
  }
  if (unit.kind === 'count' && unit.code) {
    const piece = weights.find((w) => w.unitCode === unit.code)
    if (!piece) return null
    return {
      value: quantity * piece.grams,
      approximate: true,
      conversion: { kind: 'piece', gramsPerPiece: piece.grams, portion: piece.portion },
    }
  }
  return null
}

/** Количество в миллилитрах (для данных «на 100 мл»); null — не переводится. */
export function toMilliliters(
  quantity: number | null,
  unit: UnitInfo,
  weights: UnitWeight[],
): Converted | null {
  if (quantity === null) return null
  if (unit.kind === 'volume' && unit.baseFactor)
    return { value: quantity * unit.baseFactor, approximate: false, conversion: null }
  const d = density(weights)
  const grams = toGrams(quantity, unit, weights)
  if (!d || !grams) return null
  return {
    value: grams.value / d.grams,
    approximate: true,
    conversion: { kind: 'density', gramsPerMl: d.grams, portion: d.portion },
  }
}

/** Сравнимые величины: точно — в одной системе единиц, иначе — через граммы (приближённо). */
export type Comparison = 'enough' | 'low' | 'unknown'

/**
 * Хватает ли имеющегося количества. Приближённое сравнение (через массу штуки или плотность)
 * даёт ответ только с запасом 15 % в любую сторону; иначе — «не известно».
 */
export function compareQuantities(
  have: { quantity: number | null; unit: UnitInfo },
  need: { quantity: number | null; unit: UnitInfo },
  weights: UnitWeight[],
): Comparison {
  if (have.quantity === null || need.quantity === null) return 'unknown'
  const exact = (u: UnitInfo) =>
    (u.kind === 'mass' || u.kind === 'volume') && u.baseFactor
      ? { kind: u.kind, factor: u.baseFactor }
      : u.kind === 'count' && u.code
        ? { kind: `count:${u.code}`, factor: 1 }
        : null
  const h = exact(have.unit)
  const n = exact(need.unit)
  if (h && n && h.kind === n.kind)
    return have.quantity * h.factor >= need.quantity * n.factor ? 'enough' : 'low'
  const hg = toGrams(have.quantity, have.unit, weights)
  const ng = toGrams(need.quantity, need.unit, weights)
  if (!hg || !ng) return 'unknown'
  if (hg.value >= ng.value * 1.15) return 'enough'
  if (hg.value <= ng.value * 0.85) return 'low'
  return 'unknown'
}
