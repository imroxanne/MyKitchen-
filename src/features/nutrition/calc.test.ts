// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseNutrients, parseWeights } from '../../../scripts/nutrition/build-migration'
import { calculateNutrition } from './calc'
import type { IngredientNutrition, NutritionLine } from './types'

const food = (kcal: number, protein: number, fat: number, carbs: number): IngredientNutrition => ({
  kcal,
  protein,
  fat,
  carbs,
  approximate: false,
  note: null,
  sourceCode: 'test',
  sourceFoodId: '0',
  sourceFoodName: 'ТЕСТОВЫЙ продукт',
})

const line = (patch: Partial<NutritionLine>): NutritionLine => ({
  name: 'Продукт',
  categorySlug: 'other',
  importance: 'main',
  quantity: 100,
  unitCode: 'g',
  unitKind: 'mass',
  unitBaseFactor: 1,
  nutrition: food(100, 10, 5, 10),
  unitWeights: [],
  ...patch,
})

describe('расчёт КБЖУ: контрольные примеры', () => {
  it('граммы и килограммы: КБЖУ_на_100г × масса / 100', () => {
    const r = calculateNutrition(
      [
        line({ quantity: 200, nutrition: food(50, 2, 1, 8) }),
        line({ quantity: 0.5, unitCode: 'kg', unitBaseFactor: 1000, nutrition: food(20, 1, 0, 4) }),
      ],
      4,
    )
    // 200 г × 50/100 = 100 ккал; 500 г × 20/100 = 100 ккал.
    expect(r.total).toEqual({ kcal: 200, protein: 9, fat: 2, carbs: 36 })
    expect(r.perServing).toEqual({ kcal: 50, protein: 2.25, fat: 0.5, carbs: 9 })
    expect(r.incomplete).toBe(false)
  })

  it('штуки и ложки — через массу единицы и плотность', () => {
    const r = calculateNutrition(
      [
        // 3 яйца × 50 г = 150 г × 143/100 = 214,5 ккал.
        line({
          quantity: 3,
          unitCode: 'pcs',
          unitKind: 'count',
          unitBaseFactor: null,
          nutrition: food(143, 12.56, 9.51, 0.72),
          unitWeights: [{ unitCode: 'pcs', grams: 50, portion: '1 large = 50g' }],
        }),
        // 2 ст. л. = 30 мл × 0,9214 г/мл = 27,642 г × 884/100 = 244,35528 ккал.
        line({
          quantity: 2,
          unitCode: 'tbsp',
          unitKind: 'volume',
          unitBaseFactor: 15,
          nutrition: food(884, 0, 100, 0),
          unitWeights: [{ unitCode: 'ml', grams: 0.9214, portion: '1 cup = 218g' }],
        }),
      ],
      null,
    )
    expect(r.lines[0].grams).toBe(150)
    expect(r.lines[1].grams).toBeCloseTo(27.642, 6)
    expect(r.total.kcal).toBeCloseTo(214.5 + 244.35528, 6)
    expect(r.total.fat).toBeCloseTo(14.265 + 27.642, 6)
    // Порции неизвестны — на порцию не считаем, а не делим на выдуманное число.
    expect(r.perServing).toBeNull()
    expect(r.per100g).toBeNull()
  })

  it('неизвестное не подменяется числом и перечисляется отдельно', () => {
    const r = calculateNutrition(
      [
        line({ name: 'Мясо (любое)', nutrition: null }),
        line({
          name: 'Масло',
          quantity: null,
          unitCode: null,
          unitKind: null,
          unitBaseFactor: null,
        }),
        line({ name: 'Перец', quantity: null, unitCode: 'to_taste', unitKind: 'other' }),
        line({
          name: 'Огурец',
          quantity: 1,
          unitCode: 'pcs',
          unitKind: 'count',
          unitBaseFactor: null,
        }),
        line({
          name: 'Вода',
          quantity: 3,
          unitCode: 'l',
          unitKind: 'volume',
          nutrition: food(0, 0, 0, 0),
        }),
        line({ name: 'Соль', quantity: null, unitCode: 'to_taste', nutrition: food(0, 0, 0, 0) }),
        line({ name: 'Сметана', quantity: 50, importance: 'optional' }),
      ],
      2,
    )
    expect(r.missing.map((m) => [m.line.name, m.excluded])).toEqual([
      ['Мясо (любое)', 'no_data'],
      ['Масло', 'no_quantity'],
      ['Огурец', 'no_unit_weight'],
    ])
    expect(r.minor.map((m) => m.line.name)).toEqual(['Перец'])
    // «По желанию» в базовый расчёт не входит и неполным его не делает.
    expect(r.optional.map((m) => m.line.name)).toEqual(['Сметана'])
    expect(r.incomplete).toBe(true)
    expect(r.total.kcal).toBe(0)
  })

  it('на 100 г — только при известной массе готового блюда', () => {
    const r = calculateNutrition([line({ quantity: 300 })], 3, 600)
    expect(r.per100g).toEqual({ kcal: 50, protein: 5, fat: 2.5, carbs: 5 })
  })
})

describe('контрольный пример на настоящих данных: шакшука', () => {
  const content = (path: string) =>
    readFileSync(new URL(`../../../content/${path}`, import.meta.url), 'utf8')
  const nutrients = new Map(
    parseNutrients(content('nutrition/usda-nutrients.tsv')).map((n) => [n.name, n]),
  )
  const weights = parseWeights(content('nutrition/usda-unit-weights.tsv'))
  const UNITS: Record<string, { kind: NutritionLine['unitKind']; base: number | null }> = {
    g: { kind: 'mass', base: 1 },
    tbsp: { kind: 'volume', base: 15 },
    pcs: { kind: 'count', base: null },
    clove: { kind: 'count', base: null },
    to_taste: { kind: 'other', base: null },
  }
  const recipe = JSON.parse(content('recipes/batch-01/shakshuka.json')) as {
    servings: number
    ingredients: {
      ingredient: string
      quantity?: number | null
      unit?: string | null
      importance: NutritionLine['importance']
    }[]
  }
  const lines: NutritionLine[] = recipe.ingredients.map((i) => {
    const n = nutrients.get(i.ingredient)
    return {
      name: i.ingredient,
      categorySlug: 'other',
      importance: i.importance,
      quantity: i.quantity ?? null,
      unitCode: i.unit ?? null,
      unitKind: i.unit ? UNITS[i.unit].kind : null,
      unitBaseFactor: i.unit ? UNITS[i.unit].base : null,
      nutrition: n
        ? {
            ...n,
            note: n.note || null,
            sourceCode: 'usda',
            sourceFoodId: n.fdc,
            sourceFoodName: n.description,
          }
        : null,
      unitWeights: weights
        .filter((w) => w.name === i.ingredient)
        .map((w) => ({ unitCode: w.unit, grams: w.grams, portion: w.portion })),
    }
  })

  it('совпадает с ручным расчётом', () => {
    const r = calculateNutrition(lines, recipe.servings)
    // Ручной расчёт (USDA SR Legacy, на 100 г; массы единиц — меры USDA):
    //   Лук репчатый 1 шт. = 110 г × 40   = 44
    //   Чеснок 1 зубчик   = 3 г   × 149  = 4,47
    //   Перец болгарский  = 119 г × 26   = 30,94
    //   Томат 2 шт.       = 246 г × 18   = 44,28
    //   Томатная паста 2 ст. л. = 30 мл × 1,1074 = 33,222 г × 82 = 27,24204
    //   Яйцо 3 шт.        = 150 г × 143  = 214,5
    //   Итого 365,43204 ккал; Б 25,01889; Ж 15,395143; У 35,37318.
    expect(r.total.kcal).toBeCloseTo(365.43204, 4)
    expect(r.total.protein).toBeCloseTo(25.01889, 4)
    expect(r.total.fat).toBeCloseTo(15.395143, 4)
    expect(r.total.carbs).toBeCloseTo(35.37318, 4)
    expect(r.perServing?.kcal).toBeCloseTo(365.43204 / 3, 4)
    // Масло оливковое указано без количества — честно не учтено, итог неполный.
    expect(r.missing.map((m) => m.line.name)).toEqual(['Масло оливковое'])
    expect(r.minor.map((m) => m.line.name)).toEqual(['Перец чили', 'Зира', 'Тмин', 'Кинза'])
  })
})
