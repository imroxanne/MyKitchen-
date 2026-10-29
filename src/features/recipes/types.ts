export interface RecipeTrust {
  origin: 'curated' | 'external' | 'user'
  isSample: boolean
  sourceCheckedAt: string | null
  sourceCheckedNote: string | null
  cookedVerifiedAt: string | null
  cookedVerifiedNote: string | null
}

export interface RecipeSummary {
  id: number
  title: string
  description: string | null
  prepMinutes: number | null
  cookMinutes: number | null
  servings: number | null
  mealTypes: string[]
  trust: RecipeTrust
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

export interface RecipeIngredientLine {
  position: number
  name: string
  quantity: number | null
  unitCode: string | null
  unitName: string | null
  quantityText: string | null
  importance: 'key' | 'main' | 'minor' | 'optional'
  note: string | null
}

export interface RecipeStep {
  position: number
  instruction: string
  durationMinutes: number | null
}

export interface RecipeDetail extends RecipeSummary {
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
}

export interface RecipesApi {
  listRecipes(): Promise<RecipeSummary[]>
  /** null — рецепт не найден или недоступен. */
  getRecipe(id: number): Promise<RecipeDetail | null>
}
