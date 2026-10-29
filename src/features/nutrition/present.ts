import type { ExclusionReason, NutritionResult } from './calc'

const number = (value: number, digits: number) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: digits })

/** Ккал — целыми. */
export const formatKcal = (kcal: number) => number(Math.round(kcal), 0)

/** Граммы: до 10 — с одним знаком, дальше целыми (ТЗ §9: разумное округление). */
export const formatGrams = (grams: number) => number(grams, grams < 10 ? 1 : 0)

export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  optional: 'по желанию',
  no_quantity: 'количество не указано',
  no_data: 'нет данных о составе',
  no_unit_weight: 'единица не переводится в граммы',
}

/** Короткая строка для карточки рецепта; null — посчитать нечего. */
export function kcalSummary(result: NutritionResult): string | null {
  if (result.counted.length === 0 || result.total.kcal === 0) return null
  const [value, basis] = result.perServing
    ? [result.perServing.kcal, 'на порцию']
    : [result.total.kcal, 'на всё блюдо']
  return result.incomplete
    ? `от ${formatKcal(value)} ккал ${basis} — расчёт неполный`
    : `≈ ${formatKcal(value)} ккал ${basis}`
}
