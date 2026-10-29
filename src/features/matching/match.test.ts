import { describe, expect, it } from 'vitest'
import type { CatalogItem, UserProduct } from '../pantry/types'
import type { RecipeIngredientRef, RecipeSummary } from '../recipes/types'
import { testCatalog } from '../../test/memoryPantryApi'
import {
  DEFAULT_FILTERS,
  explain,
  indexPantry,
  ingredientAvailability,
  matchRecipe,
  selectRecipes,
  type Filters,
} from './match'

// ТЕСТОВЫЕ продукты и рецепты.
const catalog: CatalogItem[] = [
  {
    id: 1,
    name: 'Яйцо куриное',
    categorySlug: 'dairy',
    defaultUnit: 'pcs',
    isOwn: false,
    synonyms: [],
  },
  {
    id: 2,
    name: 'Томат',
    categorySlug: 'vegetables',
    defaultUnit: 'pcs',
    isOwn: false,
    synonyms: [],
  },
  {
    id: 3,
    name: 'Мука пшеничная',
    categorySlug: 'grains',
    defaultUnit: 'g',
    isOwn: false,
    synonyms: [],
  },
  { id: 4, name: 'Молоко', categorySlug: 'dairy', defaultUnit: 'ml', isOwn: false, synonyms: [] },
  { id: 5, name: 'Соль', categorySlug: 'sauces', defaultUnit: 'g', isOwn: false, synonyms: [] },
  { id: 6, name: 'Говядина', categorySlug: 'meat', defaultUnit: 'g', isOwn: false, synonyms: [] },
  {
    id: 7,
    name: 'Мясо (любое)',
    categorySlug: 'meat',
    defaultUnit: 'g',
    isOwn: false,
    synonyms: [],
  },
  { id: 8, name: 'Вода', categorySlug: 'drinks', defaultUnit: 'ml', isOwn: false, synonyms: [] },
  {
    id: 9,
    name: 'Сыр твёрдый',
    categorySlug: 'dairy',
    defaultUnit: 'g',
    isOwn: false,
    synonyms: [],
  },
]
const units = testCatalog.units

const ref = (
  id: number,
  importance: RecipeIngredientRef['importance'],
  quantity: number | null = null,
  unitCode: string | null = null,
): RecipeIngredientRef => {
  const item = catalog.find((c) => c.id === id)!
  return {
    ingredientId: id,
    name: item.name,
    categorySlug: item.categorySlug,
    quantity,
    unitCode,
    importance,
    // Для подбора не нужны.
    unitKind: null,
    unitBaseFactor: null,
    nutrition: null,
    unitWeights: [],
  }
}

const recipe = (
  id: number,
  title: string,
  ingredients: RecipeIngredientRef[],
  extra: Partial<RecipeSummary> = {},
): RecipeSummary => ({
  id,
  title,
  description: null,
  prepMinutes: null,
  cookMinutes: null,
  servings: null,
  mealTypes: [],
  tags: [],
  trust: {
    origin: 'external',
    isSample: false,
    sourceCheckedAt: '2026-10-29T00:00:00Z',
    sourceCheckedNote: 'x',
    cookedVerifiedAt: null,
    cookedVerifiedNote: null,
  },
  ingredients,
  ...extra,
})

const product = (
  ingredientId: number,
  quantity: number | null = null,
  unitCode: string | null = null,
  extra: Partial<UserProduct> = {},
): UserProduct => ({
  id: ingredientId,
  ingredientId,
  kind: 'current',
  quantity,
  unitCode,
  expiresOn: null,
  isExcluded: false,
  ...extra,
})

const index = (...products: UserProduct[]) => indexPantry({ products, catalog, units })

describe('доступность ингредиента', () => {
  it('сравнивает количества в сопоставимых единицах и не выдумывает неизвестное', () => {
    const flour = ref(3, 'key', 300, 'g')
    expect(ingredientAvailability(flour, index(product(3, 1, 'kg')))).toBe('enough')
    expect(ingredientAvailability(flour, index(product(3, 200, 'g')))).toBe('low')
    expect(ingredientAvailability(flour, index(product(3)))).toBe('present')
    expect(ingredientAvailability(flour, index(product(3, 2, 'pcs')))).toBe('present')
    expect(ingredientAvailability(flour, index())).toBe('missing')
    // Объём: 2 стакана = 500 мл.
    const milk = ref(4, 'main', 2, 'cup')
    expect(ingredientAvailability(milk, index(product(4, 0.5, 'kg')))).toBe('present')
    expect(ingredientAvailability(milk, index(product(4, 400, 'ml')))).toBe('low')
    expect(ingredientAvailability(milk, index(product(4, 1000, 'ml')))).toBe('enough')
    // Штуки сравниваются только со штуками.
    const eggs = ref(1, 'key', 3, 'pcs')
    expect(ingredientAvailability(eggs, index(product(1, 2, 'pcs')))).toBe('low')
  })

  it('«не учитывать» = нет; вода есть всегда; «мясо (любое)» — любой продукт категории', () => {
    expect(
      ingredientAvailability(ref(1, 'key'), index(product(1, null, null, { isExcluded: true }))),
    ).toBe('missing')
    expect(ingredientAvailability(ref(8, 'main', 1, 'cup'), index())).toBe('assumed')
    expect(ingredientAvailability(ref(7, 'key', 300, 'g'), index(product(6, 1, 'kg')))).toBe(
      'present',
    )
    expect(ingredientAvailability(ref(7, 'key'), index(product(9)))).toBe('missing')
  })
})

describe('подбор и ранжирование', () => {
  const omelette = recipe(
    1,
    'Омлет',
    [ref(1, 'key', 3, 'pcs'), ref(4, 'main', 100, 'ml'), ref(5, 'minor', null, 'to_taste')],
    {
      prepMinutes: 5,
      cookMinutes: 10,
      mealTypes: ['breakfast'],
    },
  )
  const pancakes = recipe(
    2,
    'Блины',
    [ref(3, 'key', 200, 'g'), ref(4, 'key', 500, 'ml'), ref(1, 'main', 1, 'pcs')],
    {
      cookMinutes: 30,
      mealTypes: ['breakfast'],
    },
  )
  const salad = recipe(3, 'Салат', [ref(2, 'key', 2, 'pcs'), ref(9, 'optional', 50, 'g')], {
    mealTypes: ['lunch'],
  })
  const stew = recipe(
    4,
    'Рагу',
    [ref(7, 'key', 300, 'g'), ref(2, 'main', 2, 'pcs'), ref(8, 'main', 1, 'cup')],
    {
      prepMinutes: 20,
      cookMinutes: 60,
      mealTypes: ['dinner'],
      trust: { ...omelette.trust, sourceCheckedAt: null, sourceCheckedNote: null },
    },
  )
  const all = [omelette, pancakes, salad, stew]
  const pantry = index(product(1, 6, 'pcs'), product(4), product(2, 3, 'pcs'), product(6, 500, 'g'))
  const titles = (f: Partial<Filters>, idx = pantry) =>
    selectRecipes(all, idx, { ...DEFAULT_FILTERS, ...f }).matches.map((m) => m.recipe.title)

  it('нехватка основы блюда опускает рецепт ниже нехватки второстепенного', () => {
    // Блинам не хватает муки (основа блюда), остальным — ничего обязательного.
    // Салат выше: все количества подтверждены; у омлета и рагу есть «не сравнивалось».
    expect(titles({ mode: 'buy', maxToBuy: 3 })).toEqual(['Салат', 'Омлет', 'Рагу', 'Блины'])
    const m = matchRecipe(pancakes, pantry)
    expect(m.missingKey).toBe(true)
    expect(m.toBuy.map((x) => x.line.name)).toEqual(['Мука пшеничная'])
  })

  it('при равном числе недостающих выше тот, где не хватает менее важного', () => {
    const noKey = recipe(10, 'А: без основы', [ref(3, 'key', 100, 'g'), ref(2, 'main', 1, 'pcs')])
    const noMain = recipe(11, 'Б: без основного', [
      ref(2, 'key', 1, 'pcs'),
      ref(3, 'main', 100, 'g'),
    ])
    const noMinor = recipe(12, 'В: без второстепенного', [
      ref(2, 'key', 1, 'pcs'),
      ref(3, 'minor', 100, 'g'),
    ])
    const idx = index(product(2, 5, 'pcs'))
    const order = selectRecipes([noKey, noMain, noMinor], idx, { ...DEFAULT_FILTERS }).matches.map(
      (m) => m.recipe.title,
    )
    // У всех трёх не хватает ровно одного продукта — муки; алфавит дал бы обратный порядок.
    expect(order).toEqual(['В: без второстепенного', 'Б: без основного', 'А: без основы'])
  })

  it('«по вкусу» и «по желанию» не мешают режиму «из имеющегося»', () => {
    // В омлете соль «по вкусу», в салате сыр «по желанию» — их нет, но рецепты подходят.
    expect(titles({ mode: 'have' })).toEqual(['Салат', 'Омлет', 'Рагу'])
  })

  it('режим «докупить не больше N»', () => {
    const empty = index()
    expect(titles({ mode: 'buy', maxToBuy: 1 }, empty)).toEqual(['Салат'])
    expect(titles({ mode: 'buy', maxToBuy: 2 }, empty).sort()).toEqual(['Омлет', 'Рагу', 'Салат'])
    expect(titles({ mode: 'have' }, empty)).toEqual([])
  })

  it('«без учёта запасов» показывает всё по алфавиту', () => {
    expect(titles({ mode: 'ignore' }, index())).toEqual(['Блины', 'Омлет', 'Рагу', 'Салат'])
  })

  it('фильтры совмещаются: время, тип блюда, поиск, проверенный источник', () => {
    // Время: салат без указанного времени скрывается и учитывается отдельно.
    const r = selectRecipes(all, pantry, { ...DEFAULT_FILTERS, mode: 'ignore', maxMinutes: 30 })
    expect(r.matches.map((m) => m.recipe.title)).toEqual(['Блины', 'Омлет'])
    expect(r.hiddenUnknownTime).toBe(1)
    expect(titles({ mode: 'ignore', mealType: 'breakfast', maxMinutes: 20 })).toEqual(['Омлет'])
    expect(titles({ mode: 'ignore', query: 'молоко' })).toEqual(['Блины', 'Омлет'])
    expect(titles({ mode: 'ignore', query: 'молок яйц' })).toEqual(['Блины', 'Омлет'])
    expect(titles({ mode: 'ignore', verifiedOnly: true })).toEqual(['Блины', 'Омлет', 'Салат'])
    expect(titles({ mode: 'have', mealType: 'breakfast', query: 'омлет' })).toEqual(['Омлет'])
  })

  it('сортировка по времени', () => {
    expect(titles({ mode: 'ignore', sort: 'time' })).toEqual(['Омлет', 'Блины', 'Рагу', 'Салат'])
  })

  it('пояснения: что есть, чего не хватает, где количество не сравнивалось', () => {
    expect(explain(matchRecipe(omelette, pantry), true)).toEqual([
      'Все нужные продукты есть',
      'Количество не сравнивалось: Молоко',
      'Готовится за 15 мин',
    ])
    expect(explain(matchRecipe(pancakes, pantry), true)[0]).toBe(
      'Не хватает: Мука пшеничная — основа блюда',
    )
    expect(explain(matchRecipe(omelette, index(product(1, 2, 'pcs'), product(4))), true)[0]).toBe(
      'Не хватает: Яйцо куриное (мало) — основа блюда',
    )
    expect(explain(matchRecipe(omelette, pantry), false)).toEqual(['Готовится за 15 мин'])
  })
})
