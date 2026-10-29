// Фильтры подбора хранятся в адресе страницы: «назад» и ссылка сохраняют выбор.
import { DEFAULT_FILTERS, type Filters, type Mode, type Sort } from './match'

const MODES: Mode[] = ['have', 'buy', 'ignore']
const SORTS: Sort[] = ['match', 'time']
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'] as const
export const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
  dessert: 'Десерт',
  drink: 'Напиток',
}
export const TIME_OPTIONS = [15, 30, 60, 120] as const

/**
 * Читает фильтры из параметров адреса. Без явного режима и при пустых запасах
 * подбор идёт «без учёта запасов» — иначе выдача была бы пустой.
 */
export function parseFilters(params: URLSearchParams, pantryEmpty: boolean): Filters {
  const mode = params.get('mode') as Mode | null
  const n = Number(params.get('n'))
  const t = Number(params.get('t'))
  const meal = params.get('meal')
  const sort = params.get('sort') as Sort | null
  return {
    mode: mode && MODES.includes(mode) ? mode : pantryEmpty ? 'ignore' : DEFAULT_FILTERS.mode,
    maxToBuy: Number.isInteger(n) && n >= 1 && n <= 10 ? n : DEFAULT_FILTERS.maxToBuy,
    maxMinutes: Number.isInteger(t) && t > 0 ? t : null,
    mealType: meal && (MEAL_TYPES as readonly string[]).includes(meal) ? meal : null,
    query: params.get('q') ?? '',
    verifiedOnly: params.get('verified') === '1',
    sort: sort && SORTS.includes(sort) ? sort : DEFAULT_FILTERS.sort,
  }
}

/** Записывает в адрес только отличия от значений по умолчанию. */
export function serializeFilters(filters: Filters): URLSearchParams {
  const p = new URLSearchParams()
  p.set('mode', filters.mode)
  if (filters.mode === 'buy' && filters.maxToBuy !== DEFAULT_FILTERS.maxToBuy)
    p.set('n', String(filters.maxToBuy))
  if (filters.maxMinutes !== null) p.set('t', String(filters.maxMinutes))
  if (filters.mealType) p.set('meal', filters.mealType)
  if (filters.query.trim()) p.set('q', filters.query)
  if (filters.verifiedOnly) p.set('verified', '1')
  if (filters.sort !== DEFAULT_FILTERS.sort) p.set('sort', filters.sort)
  return p
}
