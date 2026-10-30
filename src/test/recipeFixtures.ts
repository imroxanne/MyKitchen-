import type { IngredientNutrition, YieldMeasurement } from '../features/nutrition/types'
import type { RecipeDetail, RecipesApi } from '../features/recipes/types'
import type { RecipeVersion } from '../features/versions/types'

// ТЕСТОВЫЕ пищевые данные (не настоящие значения продуктов).
const testFood = (
  kcal: number,
  protein: number,
  fat: number,
  carbs: number,
): IngredientNutrition => ({
  kcal,
  protein,
  fat,
  carbs,
  approximate: false,
  note: null,
  sourceCode: 'test',
  sourceFoodId: '1',
  sourceFoodName: 'TEST food',
})
const mass = { unitKind: 'mass' as const, unitBaseFactor: 1 }
const noUnit = { unitKind: null, unitBaseFactor: null }

// ТЕСТОВЫЕ ДАННЫЕ для проверки интерфейса — не настоящие рецепты.
export const openLicenseRecipe: RecipeDetail = {
  id: 1,
  title: 'Тестовый суп',
  description: 'Описание тестового супа.',
  prepMinutes: 15,
  cookMinutes: 45,
  servings: 4,
  mealTypes: ['lunch'],
  trust: {
    origin: 'external',
    isSample: false,
    sourceCheckedAt: '2026-10-29T00:00:00Z',
    sourceCheckedNote: 'Ингредиенты и шаги сверены с версией 123.',
    cookedVerifiedAt: null,
    cookedVerifiedNote: null,
  },
  source: {
    kind: 'website',
    title: 'Книга рецептов/Тестовый суп',
    url: 'https://ru.wikibooks.org/wiki/Тест',
    author: 'Участники Викиучебника',
    authorsUrl: 'https://ru.wikibooks.org/w/index.php?title=Тест&action=history',
    retrievedOn: '2026-10-29',
    revision: '123',
    rights: 'open_license',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru',
  },
  adaptationNote: 'Шаги пересказаны своими словами.',
  cuisine: 'русская',
  cookingMethods: ['варка'],
  equipment: ['кастрюля'],
  tags: [],
  difficulty: 2,
  yieldGrams: null,
  ingredients: [
    {
      position: 1,
      ingredientId: 6,
      categorySlug: 'vegetables',
      name: 'Свёкла',
      quantity: 300,
      unitCode: 'g',
      ...mass,
      nutrition: testFood(40, 2, 0, 10),
      unitWeights: [],
      unitName: 'г',
      quantityText: null,
      importance: 'key',
      note: null,
    },
    {
      position: 2,
      ingredientId: 5,
      categorySlug: 'sauces',
      name: 'Соль',
      quantity: null,
      unitCode: 'to_taste',
      unitKind: 'other',
      unitBaseFactor: null,
      nutrition: testFood(0, 0, 0, 0),
      unitWeights: [],
      unitName: 'по вкусу',
      quantityText: 'по вкусу',
      importance: 'minor',
      note: null,
    },
    {
      position: 3,
      ingredientId: 7,
      categorySlug: 'dairy',
      name: 'Сметана',
      quantity: null,
      unitCode: null,
      ...noUnit,
      nutrition: testFood(200, 3, 20, 4),
      unitWeights: [],
      unitName: null,
      quantityText: 'для подачи',
      importance: 'optional',
      note: null,
    },
  ],
  steps: [
    { position: 1, instruction: 'Нарезать свёклу.', durationMinutes: 10 },
    { position: 2, instruction: 'Варить до готовности.', durationMinutes: null },
  ],
  nutritionSources: [
    {
      code: 'test',
      title: 'ТЕСТОВЫЙ справочник',
      url: 'https://example.test/nutrition',
      datasetVersion: null,
      license: 'тестовые данные',
      licenseUrl: null,
      citation: 'ТЕСТ',
    },
  ],
}

export const unverifiedRecipe: RecipeDetail = {
  ...openLicenseRecipe,
  id: 2,
  title: 'Тестовый салат без проверки',
  prepMinutes: null,
  cookMinutes: null,
  servings: null,
  trust: { ...openLicenseRecipe.trust, sourceCheckedAt: null, sourceCheckedNote: null },
}

export function createMemoryRecipesApi(recipes: RecipeDetail[]): RecipesApi {
  const yields = new Map<number, YieldMeasurement>()
  const versions: RecipeVersion[] = []
  let nextVersionId = 100
  let clock = 0
  return {
    async listRecipes() {
      return recipes.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        servings: r.servings,
        mealTypes: r.mealTypes,
        tags: r.tags,
        trust: r.trust,
        ingredients: r.ingredients.map(
          ({ position: _p, unitName: _u, quantityText: _q, note: _n, ...ref }) => ref,
        ),
      }))
    },
    async getRecipe(id) {
      return recipes.find((r) => r.id === id) ?? null
    },
    async getYield(recipeId) {
      return yields.get(recipeId) ?? null
    },
    async saveYield(recipeId, grams) {
      const y = { grams, measuredAt: '2026-11-01T10:00:00Z' }
      yields.set(recipeId, y)
      return y
    },
    async deleteYield(recipeId) {
      yields.delete(recipeId)
    },
    // Версии повторяют правила БД: непустой состав, количество только с единицей.
    async listVersions(recipeId) {
      return versions
        .filter((v) => v.recipeId === recipeId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((v) => structuredClone(v))
    },
    async saveVersion(draft) {
      if (draft.ingredients.length === 0)
        throw new Error('В версии должен быть хотя бы один ингредиент')
      if (draft.ingredients.some((l) => l.quantity !== null && (l.quantity <= 0 || !l.unitCode)))
        throw new Error('Количество — больше нуля и с единицей')
      const saved: RecipeVersion = {
        ...structuredClone(draft),
        id: draft.id ?? nextVersionId++,
        updatedAt: `2026-11-01T10:00:${String(clock++).padStart(2, '0')}Z`,
        ingredients: draft.ingredients.map((l, i) => ({ ...structuredClone(l), position: i + 1 })),
      }
      const at = versions.findIndex((v) => v.id === saved.id)
      if (draft.id !== null && at < 0) throw new Error('Версия не найдена')
      if (at >= 0) versions[at] = saved
      else versions.push(saved)
      return structuredClone(saved)
    },
    async deleteVersion(id) {
      const at = versions.findIndex((v) => v.id === id)
      if (at >= 0) versions.splice(at, 1)
    },
  }
}

// ТЕСТОВЫЙ рецепт, которому при тестовых запасах не хватает моркови.
export const milkRecipe: RecipeDetail = {
  ...openLicenseRecipe,
  id: 3,
  title: 'Тестовая молочная каша',
  prepMinutes: 5,
  cookMinutes: 10,
  servings: 2,
  mealTypes: ['breakfast'],
  ingredients: [
    {
      position: 1,
      ingredientId: 4,
      categorySlug: 'dairy',
      name: 'Молоко',
      quantity: 200,
      unitCode: 'ml',
      unitKind: 'volume',
      unitBaseFactor: 1,
      nutrition: testFood(60, 3, 3, 5),
      unitWeights: [{ unitCode: 'ml', grams: 1, portion: 'TEST 1 ml = 1g' }],
      unitName: 'мл',
      quantityText: null,
      importance: 'key',
      note: null,
    },
    {
      position: 2,
      ingredientId: 3,
      categorySlug: 'vegetables',
      name: 'Морковь',
      quantity: 2,
      unitCode: 'pcs',
      unitKind: 'count',
      unitBaseFactor: null,
      nutrition: testFood(40, 1, 0, 10),
      unitWeights: [{ unitCode: 'pcs', grams: 50, portion: 'TEST 1 = 50g' }],
      unitName: 'шт.',
      quantityText: null,
      importance: 'main',
      note: null,
    },
  ],
}
