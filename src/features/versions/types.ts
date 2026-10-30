import type { RecipeIngredientLine } from '../recipes/types'

/** Строка своей версии: как строка рецепта, плюс связь со строкой оригинала. */
export interface VersionLine extends RecipeIngredientLine {
  /** Позиция строки оригинала, из которой получена эта; null — добавлена в версии. */
  originalPosition: number | null
}

/** Своя версия рецепта (B2): отдельная копия состава, оригинал ею не меняется. */
export interface RecipeVersion {
  id: number
  recipeId: number
  name: string
  servings: number | null
  yieldGrams: number | null
  note: string | null
  updatedAt: string
  ingredients: VersionLine[]
}

/** Черновик в редакторе: ещё не сохранённая (id = null) или изменяемая версия. */
export type VersionDraft = Omit<RecipeVersion, 'id' | 'updatedAt'> & { id: number | null }
