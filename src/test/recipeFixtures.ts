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
      return recipes.map(
        ({ id, title, description, prepMinutes, cookMinutes, servings, mealTypes, trust }) => ({
          id,
          title,
          description,
          prepMinutes,
          cookMinutes,
          servings,
          mealTypes,
          trust,
        }),
      )
    },
    async getRecipe(id) {
      return recipes.find((r) => r.id === id) ?? null
    },
  }
}
