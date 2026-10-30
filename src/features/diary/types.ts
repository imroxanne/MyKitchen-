import type { Macros } from '../nutrition/types'

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
}

/** Строка состава на момент записи — только для показа. */
export interface CompositionItem {
  name: string
  /** «2 шт.», «по вкусу»; null — количество не указано. */
  amount: string | null
  /** null — не учтено в расчёте. */
  kcal: number | null
}

/**
 * Снимок на момент записи: «основа» (всё блюдо, 100 г продукта, одна порция покупного блюда)
 * и её КБЖУ. Правки рецепта или версии потом его не меняют.
 */
export interface DiarySnapshot {
  kind: 'recipe' | 'product' | 'custom'
  title: string
  recipeId: number | null
  versionId: number | null
  ingredientId: number | null
  /** Сколько порций в основе; null — порциями не записать. */
  baseServings: number | null
  /** portion — порции; dish — доли блюда (порции в рецепте не указаны). */
  servingUnit: 'portion' | 'dish'
  /** Масса (г или мл) основы; null — по массе не записать. */
  baseAmount: number | null
  amountUnit: 'g' | 'ml'
  base: Macros
  /** В основе не учтены заметные продукты: итог занижен. */
  incomplete: boolean
  composition: CompositionItem[]
}

/** Сколько съедено: порции (доли блюда) или масса — что-то одно. */
export type Eaten = { servings: number; amount: null } | { servings: null; amount: number }

export type DiaryEntryFields = {
  /** YYYY-MM-DD, по местному времени. */
  eatenOn: string
  /** ЧЧ:ММ; null — время не указано. */
  eatenTime: string | null
  meal: Meal
  note: string | null
} & Eaten

export type NewDiaryEntry = DiarySnapshot & DiaryEntryFields

export type DiaryEntry = NewDiaryEntry & {
  id: number
  /** КБЖУ съеденного (считает БД из снимка). */
  eaten: Macros
  createdAt: string
}

/** Что можно изменить в записи: снимок не меняется. */
export type DiaryPatch = DiaryEntryFields & { title: string }

/** Доступ к дневнику. Реальная реализация — Supabase, в тестах — память. */
export interface DiaryApi {
  /** Записи за день: по приёмам пищи, времени и порядку записи. */
  listDay(date: string): Promise<DiaryEntry[]>
  add(entry: NewDiaryEntry): Promise<DiaryEntry>
  update(id: number, patch: DiaryPatch): Promise<DiaryEntry>
  remove(id: number): Promise<void>
}
