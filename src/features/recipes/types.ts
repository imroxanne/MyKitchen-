import type { NutritionLine, NutritionSource, YieldMeasurement } from '../nutrition/types'
import type { RecipeVersion, VersionDraft } from '../versions/types'

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
  /** Масса готового блюда по своему взвешиванию (B1); null — не взвешивали. */
  getYield(recipeId: number): Promise<YieldMeasurement | null>
  saveYield(recipeId: number, grams: number): Promise<YieldMeasurement>
  deleteYield(recipeId: number): Promise<void>
  /** Свои версии рецепта (B2), сначала изменённые последними. */
  listVersions(recipeId: number): Promise<RecipeVersion[]>
  /** Создаёт (id = null) или целиком заменяет версию; оригинал не меняется. */
  saveVersion(draft: VersionDraft): Promise<RecipeVersion>
  deleteVersion(id: number): Promise<void>
}
