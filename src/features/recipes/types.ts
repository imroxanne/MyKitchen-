import type { NutritionLine, NutritionSource } from '../nutrition/types'

export interface RecipeTrust {
  origin: 'curated' | 'external' | 'user'
  isSample: boolean
  sourceCheckedAt: string | null
  sourceCheckedNote: string | null
  cookedVerifiedAt: string | null
  cookedVerifiedNote: string | null
}

/** Ингредиент рецепта в объёме, нужном для подбора по продуктам и расчёта КБЖУ. */
export interface RecipeIngredientRef extends NutritionLine {
  ingredientId: number
}

export interface RecipeSummary {
  id: number
  title: string
  description: string | null
  prepMinutes: number | null
  cookMinutes: number | null
  servings: number | null
  mealTypes: string[]
  tags: string[]
  trust: RecipeTrust
  ingredients: RecipeIngredientRef[]
}

export interface RecipeSource {
  kind: string
  title: string
  url: string | null
  author: string | null
  authorsUrl: string | null
  retrievedOn: string | null
  revision: string | null
  rights: string
  license: string | null
  licenseUrl: string | null
}

export interface RecipeIngredientLine extends RecipeIngredientRef {
  position: number
  unitName: string | null
  quantityText: string | null
  note: string | null
}

export interface RecipeStep {
  position: number
  instruction: string
  durationMinutes: number | null
}

export interface RecipeDetail extends Omit<RecipeSummary, 'ingredients'> {
  source: RecipeSource | null
  adaptationNote: string | null
  cuisine: string | null
  cookingMethods: string[]
  equipment: string[]
  tags: string[]
  difficulty: number | null
  yieldGrams: number | null
  ingredients: RecipeIngredientLine[]
  steps: RecipeStep[]
  /** Источники пищевых данных, на которые ссылаются ингредиенты. */
  nutritionSources: NutritionSource[]
}

export interface RecipesApi {
  listRecipes(): Promise<RecipeSummary[]>
  /** null — рецепт не найден или недоступен. */
  getRecipe(id: number): Promise<RecipeDetail | null>
}
