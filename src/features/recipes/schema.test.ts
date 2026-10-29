// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildBatch } from '../../../scripts/recipes/build-migration'
import { validateRecipe, type RecipeFile } from '../../../scripts/recipes/schema'

const catalog = new Set(['Свёкла', 'Соль'])

// ТЕСТОВЫЙ рецепт для проверки валидатора — не настоящий.
const valid: RecipeFile = {
  slug: 'test-soup',
  title: 'Тестовый суп',
  description: null,
  source: {
    kind: 'website',
    title: 'Книга рецептов/Тест',
    url: 'https://ru.wikibooks.org/wiki/Тест',
    author: 'Участники Викиучебника',
    authorsUrl: 'https://ru.wikibooks.org/w/index.php?title=Тест&action=history',
    retrievedOn: '2026-10-29',
    revision: '123',
    rights: 'open_license',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru',
  },
  adaptationNote: 'Шаги пересказаны.',
  sourceCheck: { date: '2026-10-29', note: 'Сверено с версией 123.' },
  cuisine: null,
  mealTypes: ['lunch'],
  cookingMethods: [],
  equipment: [],
  tags: [],
  prepMinutes: null,
  cookMinutes: 60,
  difficulty: null,
  servings: 4,
  yieldGrams: null,
  ingredients: [
    { ingredient: 'Свёкла', quantity: 300, unit: 'g', text: null, importance: 'key', note: null },
    {
      ingredient: 'Соль',
      quantity: null,
      unit: 'to_taste',
      text: 'по вкусу',
      importance: 'minor',
      note: null,
    },
  ],
  steps: [{ text: "Сварить «как у O'Neil».", minutes: null }],
}

describe('проверка файла рецепта', () => {
  it('корректный рецепт проходит', () => {
    expect(validateRecipe(valid, catalog)).toEqual([])
  })

  it('ловит выдуманные или неполные данные', () => {
    const bad: RecipeFile = {
      ...valid,
      source: { ...valid.source, license: null, url: 'http://x' },
      adaptationNote: '',
      ingredients: [
        {
          ingredient: 'Единорог',
          quantity: 1,
          unit: 'pcs',
          text: null,
          importance: 'key',
          note: null,
        },
        {
          ingredient: 'Соль',
          quantity: 5,
          unit: null,
          text: null,
          importance: 'minor',
          note: null,
        },
        {
          ingredient: 'Свёкла',
          quantity: null,
          unit: null,
          text: null,
          importance: 'main',
          note: null,
        },
      ],
      steps: [],
    }
    const errors = validateRecipe(bad, catalog).join('\n')
    expect(errors).toMatch(/source.url/)
    expect(errors).toMatch(/license и licenseUrl/)
    expect(errors).toMatch(/adaptationNote/)
    expect(errors).toMatch(/«Единорог»: нет в справочнике/)
    expect(errors).toMatch(/количество без единицы/)
    expect(errors).toMatch(/без количества нужен текст/)
    expect(errors).toMatch(/steps: пусто/)
  })

  it('SQL экранирует кавычки и подставляет null для неизвестного', () => {
    const sql = buildBatch('batch-test', [valid], catalog)
    expect(sql).toContain("'Сварить «как у O''Neil».'")
    expect(sql).toContain("(2, 'Соль', null::numeric, 'to_taste', 'по вкусу', 'minor', null)")
    expect(sql).toContain("'2026-10-29'::timestamptz")
    expect(() => buildBatch('batch-test', [valid, valid], catalog)).toThrow(/повторяющийся slug/)
  })
})
