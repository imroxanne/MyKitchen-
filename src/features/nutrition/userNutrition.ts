import type { UserNutrition } from './types'

/** Подставляет в строки рецепта свои данные пользователя с упаковки (B1). */
export function applyUserNutrition<L extends { ingredientId: number }>(
  lines: L[],
  data: UserNutrition[],
): (L & { userNutrition: UserNutrition | null })[] {
  const byIngredient = new Map(data.map((n) => [n.ingredientId, n]))
  return lines.map((line) => ({
    ...line,
    userNutrition: byIngredient.get(line.ingredientId) ?? null,
  }))
}
