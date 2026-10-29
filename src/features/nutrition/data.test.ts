// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseCsv, portionVolumeMl, renderPortion } from '../../../scripts/nutrition/extract-fdc'
import {
  validate,
  type NutrientRow,
  type WeightRow,
} from '../../../scripts/nutrition/build-migration'
import { calculateNutrition } from './calc'
import { kcalSummary } from './present'
import type { NutritionLine } from './types'

describe('извлечение из USDA', () => {
  it('CSV с кавычками и запятыми внутри полей', () => {
    const rows = parseCsv('"fdc_id","description"\n"1","Beef, ground, ""80/20"""\n')
    expect(rows).toEqual([{ fdc_id: '1', description: 'Beef, ground, "80/20"' }])
  })

  it('мера как в USDA и её объём', () => {
    const p = { amount: '1', modifier: 'chopped', gram_weight: '160' }
    expect(renderPortion(p, 'cup')).toBe('1 cup chopped = 160g')
    expect(
      renderPortion({ amount: '1', modifier: 'large', gram_weight: '50' }, 'undetermined'),
    ).toBe('1 large = 50g')
    expect(portionVolumeMl('1 cup = 244g')).toBeCloseTo(236.588)
    expect(portionVolumeMl('1 tsp = 4.6g')).toBeCloseTo(4.929)
    expect(portionVolumeMl('1 large = 50g')).toBeNull()
  })
})

describe('проверка данных перед миграцией', () => {
  const row = (patch: Partial<NutrientRow>): NutrientRow => ({
    name: 'Сахар',
    fdc: '1',
    description: 'TEST',
    kcal: 387,
    protein: 0,
    fat: 0,
    carbs: 99.98,
    approximate: false,
    note: '',
    ...patch,
  })
  const weight = (patch: Partial<WeightRow>): WeightRow => ({
    name: 'Сахар',
    unit: 'ml',
    grams: 0.85,
    fdc: '1',
    portion: '1 cup = 200g',
    note: '',
    ...patch,
  })
  const catalog = new Set(['Сахар'])

  it('пропускает согласованные данные', () => {
    expect(() => validate([row({})], [weight({})], catalog)).not.toThrow()
  })

  it('ловит опечатку, неизвестный продукт и неправдоподобную плотность', () => {
    expect(() => validate([row({ kcal: 38.7 })], [], catalog)).toThrow(/не согласуется/)
    expect(() => validate([row({ name: 'Сахарок' })], [], catalog)).toThrow(/нет в справочнике/)
    expect(() => validate([row({})], [weight({ grams: 85 })], catalog)).toThrow(/неправдоподобна/)
    expect(() => validate([row({})], [weight({ unit: 'g' })], catalog)).toThrow(/недопустимая/)
  })
})

describe('строка КБЖУ на карточке', () => {
  const line = (patch: Partial<NutritionLine>): NutritionLine => ({
    name: 'Мука',
    categorySlug: 'grains',
    importance: 'key',
    quantity: 100,
    unitCode: 'g',
    unitKind: 'mass',
    unitBaseFactor: 1,
    nutrition: {
      kcal: 350,
      protein: 10,
      fat: 1,
      carbs: 75,
      approximate: false,
      note: null,
      sourceCode: 'test',
      sourceFoodId: '1',
      sourceFoodName: 'TEST',
    },
    unitWeights: [],
    ...patch,
  })

  it('неполный расчёт — «от … — расчёт неполный»', () => {
    const r = calculateNutrition([line({}), line({ name: 'Мясо', nutrition: null })], 2)
    expect(kcalSummary(r)).toBe('от 175 ккал на порцию — расчёт неполный')
  })

  it('нечего показать — пусто, а не «0 ккал»', () => {
    expect(kcalSummary(calculateNutrition([line({ nutrition: null })], 2))).toBeNull()
  })
})
