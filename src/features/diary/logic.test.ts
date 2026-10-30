import { describe, expect, it } from 'vitest'
import { milkRecipe, openLicenseRecipe, unverifiedRecipe } from '../../test/recipeFixtures'
import {
  daySummary,
  defaultMeal,
  describeEaten,
  eatenMacros,
  isValidDate,
  parseDecimal,
  shiftDate,
  snapshotFromCustom,
  snapshotFromProduct,
  snapshotFromRecipe,
  validateEaten,
} from './logic'
import type { DiaryEntry, DiarySnapshot, Meal } from './types'

// Тестовый суп (ТЕСТОВЫЕ данные): 300 г свёклы по 40 ккал/100 г = 120 ккал на 4 порции.
const soup = () =>
  snapshotFromRecipe({
    recipeId: 1,
    versionId: null,
    title: openLicenseRecipe.title,
    lines: openLicenseRecipe.ingredients,
    servings: 4,
    yieldGrams: 800,
  })

const entry = (snapshot: DiarySnapshot, meal: Meal, servings: number, id = 1): DiaryEntry => ({
  ...snapshot,
  id,
  eatenOn: '2026-10-30',
  eatenTime: null,
  meal,
  servings,
  amount: null,
  note: null,
  eaten: eatenMacros(snapshot, { servings, amount: null })!,
  createdAt: '2026-10-30T10:00:00Z',
})

describe('снимок блюда', () => {
  it('КБЖУ всего блюда и состав с количествами на момент записи', () => {
    const s = soup()
    expect(s.base).toEqual({ kcal: 120, protein: 6, fat: 0, carbs: 30 })
    expect(s.baseServings).toBe(4)
    expect(s.servingUnit).toBe('portion')
    expect(s.baseAmount).toBe(800)
    expect(s.composition).toEqual([
      { name: 'Свёкла', amount: '300 г', kcal: 120 },
      { name: 'Соль', amount: 'по вкусу', kcal: 0 },
      { name: 'Сметана', amount: 'для подачи', kcal: null },
    ])
  })

  it('снимок — копия: изменение рецепта после записи его не меняет', () => {
    const lines = structuredClone(openLicenseRecipe.ingredients)
    const s = snapshotFromRecipe({
      recipeId: 1,
      versionId: null,
      title: 'Суп',
      lines,
      servings: 4,
      yieldGrams: null,
    })
    lines[0]!.quantity = 1000
    lines[0]!.name = 'Другое'
    expect(s.base.kcal).toBe(120)
    expect(s.composition[0]).toEqual({ name: 'Свёкла', amount: '300 г', kcal: 120 })
  })

  it('без числа порций записывается доля блюда', () => {
    const s = snapshotFromRecipe({
      recipeId: 2,
      versionId: null,
      title: unverifiedRecipe.title,
      lines: unverifiedRecipe.ingredients,
      servings: null,
      yieldGrams: null,
    })
    expect(s.baseServings).toBe(1)
    expect(s.servingUnit).toBe('dish')
    expect(s.baseAmount).toBeNull()
    expect(eatenMacros(s, { servings: 0.5, amount: null })?.kcal).toBe(60)
    expect(eatenMacros(s, { servings: null, amount: 100 })).toBeNull()
  })

  it('неполный расчёт отмечается: итог занижен', () => {
    const s = snapshotFromRecipe({
      recipeId: 3,
      versionId: null,
      title: 'Каша',
      lines: milkRecipe.ingredients.map((l) => ({ ...l, nutrition: null })),
      servings: 2,
      yieldGrams: null,
    })
    expect(s.incomplete).toBe(true)
  })
})

describe('КБЖУ съеденного', () => {
  it('0,5 и 1,5 порции — половина и полторы порции', () => {
    const s = soup()
    expect(eatenMacros(s, { servings: 1, amount: null })).toEqual({
      kcal: 30,
      protein: 1.5,
      fat: 0,
      carbs: 7.5,
    })
    expect(eatenMacros(s, { servings: 0.5, amount: null })?.kcal).toBe(15)
    expect(eatenMacros(s, { servings: 1.5, amount: null })?.kcal).toBe(45)
  })

  it('по массе готового блюда: 200 г из 800', () => {
    expect(eatenMacros(soup(), { servings: null, amount: 200 })?.kcal).toBe(30)
  })

  it('округление до двух знаков, как в БД', () => {
    const s = { ...soup(), base: { kcal: 100, protein: 10, fat: 10, carbs: 10 }, baseServings: 3 }
    expect(eatenMacros(s, { servings: 1, amount: null })?.kcal).toBe(33.33)
  })

  it('продукт — на 100 г или 100 мл; покупное блюдо — на 100 г или на порцию', () => {
    const p = snapshotFromProduct({
      ingredientId: 6,
      title: 'Свёкла',
      per100: { kcal: 43, protein: 1.6, fat: 0.2, carbs: 9.6 },
      unit: 'g',
    })
    expect(eatenMacros(p, { servings: null, amount: 250 })?.kcal).toBe(107.5)
    expect(eatenMacros(p, { servings: 1, amount: null })).toBeNull()

    const perPortion = snapshotFromCustom({
      title: 'Сырник из магазина',
      macros: { kcal: 180, protein: 9, fat: 8, carbs: 18 },
      per: 'portion',
    })
    expect(eatenMacros(perPortion, { servings: 2, amount: null })?.kcal).toBe(360)
    expect(eatenMacros(perPortion, { servings: null, amount: 100 })).toBeNull()

    const per100 = snapshotFromCustom({
      title: 'Хумус',
      macros: { kcal: 300, protein: 8, fat: 25, carbs: 12 },
      per: '100g',
    })
    expect(eatenMacros(per100, { servings: null, amount: 50 })?.kcal).toBe(150)
  })
})

describe('итоги дня', () => {
  it('суммы за день и по приёмам пищи в порядке дня', () => {
    const s = soup()
    const summary = daySummary([
      entry(s, 'dinner', 1, 1),
      entry(s, 'breakfast', 0.5, 2),
      entry(s, 'dinner', 1.5, 3),
    ])
    expect(summary.total).toEqual({ kcal: 90, protein: 4.5, fat: 0, carbs: 22.5 })
    expect(summary.meals.map((m) => [m.meal, m.entries.length, m.total.kcal])).toEqual([
      ['breakfast', 1, 15],
      ['dinner', 2, 75],
    ])
    expect(summary.incomplete).toBe(false)
  })

  it('пустой день и неполные записи', () => {
    expect(daySummary([]).total.kcal).toBe(0)
    expect(daySummary([entry({ ...soup(), incomplete: true }, 'lunch', 1)]).incomplete).toBe(true)
  })
})

describe('показ и ввод', () => {
  it('количество съеденного словами', () => {
    expect(
      describeEaten({ servingUnit: 'portion', amountUnit: 'g', servings: 1, amount: null }),
    ).toBe('1 порция')
    expect(
      describeEaten({ servingUnit: 'portion', amountUnit: 'g', servings: 1.5, amount: null }),
    ).toBe('1,5 порции')
    expect(
      describeEaten({ servingUnit: 'portion', amountUnit: 'g', servings: 5, amount: null }),
    ).toBe('5 порций')
    expect(
      describeEaten({ servingUnit: 'dish', amountUnit: 'g', servings: 0.5, amount: null }),
    ).toBe('0,5 блюда')
    expect(
      describeEaten({ servingUnit: 'portion', amountUnit: 'g', servings: null, amount: 200 }),
    ).toBe('200 г')
    expect(
      describeEaten({ servingUnit: 'portion', amountUnit: 'ml', servings: null, amount: 250 }),
    ).toBe('250 мл')
  })

  it('числа с запятой и проверка количества', () => {
    expect(parseDecimal('1,5')).toBe(1.5)
    expect(parseDecimal(' ')).toBeNull()
    expect(parseDecimal('полторы')).toBeNaN()
    expect(validateEaten({ servings: 0.5, amount: null })).toBeNull()
    expect(validateEaten({ servings: 0, amount: null })).toMatch(/больше нуля/)
    expect(validateEaten({ servings: Number.NaN, amount: null })).toMatch(/больше нуля/)
    expect(validateEaten({ servings: null, amount: 20000 })).toMatch(/10 000/)
  })

  it('даты и приём пищи по умолчанию', () => {
    expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(isValidDate('2026-10-30')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('вчера')).toBe(false)
    expect(defaultMeal(new Date(2026, 9, 30, 8))).toBe('breakfast')
    expect(defaultMeal(new Date(2026, 9, 30, 13))).toBe('lunch')
    expect(defaultMeal(new Date(2026, 9, 30, 19))).toBe('dinner')
    expect(defaultMeal(new Date(2026, 9, 30, 23))).toBe('snack')
  })
})
