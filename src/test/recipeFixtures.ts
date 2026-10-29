import type { RecipeDetail, RecipesApi } from '../features/recipes/types'

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
        ingredients: r.ingredients.map((i) => ({
          ingredientId: i.ingredientId,
          name: i.name,
          categorySlug: i.categorySlug,
          quantity: i.quantity,
          unitCode: i.unitCode,
          importance: i.importance,
        })),
      }))
    },
    async getRecipe(id) {
      return recipes.find((r) => r.id === id) ?? null
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
      unitName: 'шт.',
      quantityText: null,
      importance: 'main',
      note: null,
    },
  ],
}
