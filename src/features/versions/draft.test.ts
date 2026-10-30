import { describe, expect, it } from 'vitest'
import { calculateNutrition } from '../nutrition/calc'
import { milkRecipe, openLicenseRecipe } from '../../test/recipeFixtures'
import {
  addLine,
  diffWithOriginal,
  draftFromRecipe,
  removeLine,
  replaceIngredient,
  rescaleDraft,
  scaleLines,
  updateLine,
  validateDraft,
} from './draft'

// ТЕСТОВЫЕ данные: суп (свёкла 300 г, соль по вкусу, сметана по желанию; 4 порции),
// каша (молоко 200 мл, морковь 2 шт.; 2 порции).
const yogurt = {
  ingredientId: 77,
  name: 'Йогурт (ТЕСТ)',
  categorySlug: 'dairy',
  nutrition: {
    kcal: 60,
    protein: 4,
    fat: 2,
    carbs: 6,
    approximate: false,
    note: null,
    sourceCode: 'test',
    sourceFoodId: '77',
    sourceFoodName: 'TEST yogurt',
  },
  unitWeights: [{ unitCode: 'ml', grams: 1, portion: 'TEST' }],
}

describe('черновик своей версии', () => {
  it('копия оригинала: тот же состав, связь со строками, оригинал не меняется', () => {
    const draft = draftFromRecipe(openLicenseRecipe)
    expect(draft.ingredients.map((l) => [l.name, l.originalPosition])).toEqual([
      ['Свёкла', 1],
      ['Соль', 2],
      ['Сметана', 3],
    ])
    const changed = updateLine(draft, 1, { quantity: 150 })
    expect(openLicenseRecipe.ingredients[0].quantity).toBe(300)
    expect(draft.ingredients[0].quantity).toBe(300)
    expect(changed.ingredients[0].quantity).toBe(150)
    expect(diffWithOriginal(openLicenseRecipe.ingredients, draft, 4, null).changed).toBe(false)
  })

  it('пересчёт на число порций: известные количества × коэффициент, «по вкусу» не трогаем', () => {
    const draft = rescaleDraft(draftFromRecipe(openLicenseRecipe), 6)
    expect(draft.servings).toBe(6)
    expect(draft.ingredients.map((l) => l.quantity)).toEqual([450, null, null])
    // 1 порция из 3: 0,333… → три знака, без хвоста плавающей точки.
    expect(scaleLines([{ quantity: 1 }], 1 / 3)[0].quantity).toBe(0.333)
    expect(scaleLines([{ quantity: 0.1 }], 3)[0].quantity).toBe(0.3)
  })

  it('без известного числа порций пересчёт только меняет порции', () => {
    const draft = rescaleDraft({ ...draftFromRecipe(openLicenseRecipe), servings: null }, 2)
    expect(draft.ingredients[0].quantity).toBe(300)
    expect(draft.servings).toBe(2)
  })

  it('отличия от оригинала: количество, замена, добавление, удаление', () => {
    let draft = draftFromRecipe(milkRecipe)
    draft = updateLine(draft, 2, { quantity: 3 })
    draft = replaceIngredient(draft, 1, yogurt)
    draft = removeLine(draft, 2)
    draft = addLine(
      draft,
      { ...yogurt, ingredientId: 6, name: 'Свёкла' },
      {
        code: 'g',
        name: 'г',
        kind: 'mass',
        baseFactor: 1,
      },
    )
    const diff = diffWithOriginal(milkRecipe.ingredients, draft, 2, null)
    expect(draft.ingredients.map((l) => [l.position, l.name])).toEqual([
      [1, 'Йогурт (ТЕСТ)'],
      [2, 'Свёкла'],
    ])
    expect(diff.byPosition.get(1)).toEqual({ kind: 'replaced', was: 'Молоко' })
    expect(diff.byPosition.get(2)).toEqual({ kind: 'added' })
    expect(diff.removed.map((l) => l.name)).toEqual(['Морковь'])
    expect(diff.changed).toBe(true)

    const amount = diffWithOriginal(
      milkRecipe.ingredients,
      updateLine(draftFromRecipe(milkRecipe), 2, { quantity: 3 }),
      2,
      null,
    )
    expect(amount.byPosition.get(2)).toEqual({ kind: 'amount', was: '2 шт.' })
  })

  it('КБЖУ версии пересчитывается сразу и не меняет КБЖУ оригинала', () => {
    // Каша: молоко 200 мл ≈ 200 г × 60 = 120 + морковь 2 × 50 г × 40 = 40 → 160 ккал.
    const original = calculateNutrition(milkRecipe.ingredients, 2)
    // Своя версия: молоко → йогурт 200 мл × 60 = 120; моркови 1 шт. = 20 → 140 ккал.
    let draft = replaceIngredient(draftFromRecipe(milkRecipe), 1, yogurt)
    draft = updateLine(draft, 2, { quantity: 1 })
    const version = calculateNutrition(draft.ingredients, draft.servings)
    expect(original.total.kcal).toBeCloseTo(160, 6)
    expect(version.total.kcal).toBeCloseTo(140, 6)
    expect(version.perServing?.kcal).toBeCloseTo(70, 6)
    // На 4 порции — всё вдвое, на порцию — столько же.
    const doubled = calculateNutrition(rescaleDraft(draft, 4).ingredients, 4)
    expect(doubled.total.kcal).toBeCloseTo(280, 6)
    expect(doubled.perServing?.kcal).toBeCloseTo(70, 6)
  })

  it('проверка перед сохранением', () => {
    const draft = draftFromRecipe(milkRecipe)
    expect(validateDraft(draft)).toEqual([])
    expect(validateDraft({ ...draft, name: '  ' })).toContain('Укажите название версии.')
    expect(validateDraft({ ...draft, servings: 0 })[0]).toMatch(/Число порций/)
    expect(validateDraft({ ...draft, yieldGrams: -5 })[0]).toMatch(/Масса готового блюда/)
    expect(validateDraft({ ...draft, ingredients: [] })[0]).toMatch(/хотя бы один/)
    expect(validateDraft(updateLine(draft, 1, { quantity: 0 }))[0]).toMatch(/Молоко: количество/)
    expect(validateDraft(updateLine(draft, 1, { unitCode: null }))[0]).toMatch(
      /Молоко: укажите единицу/,
    )
  })
})
