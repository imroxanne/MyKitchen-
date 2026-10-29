import { describe, expect, it } from 'vitest'
import { calculateNutrition } from './calc'
import {
  compareQuantities,
  effectiveWeights,
  toGrams,
  toMilliliters,
  type UnitInfo,
} from './convert'
import type { NutritionLine, UnitWeight, UserNutrition } from './types'

// ТЕСТОВЫЕ меры (не настоящие данные продуктов).
const G: UnitInfo = { code: 'g', kind: 'mass', baseFactor: 1 }
const KG: UnitInfo = { code: 'kg', kind: 'mass', baseFactor: 1000 }
const L: UnitInfo = { code: 'l', kind: 'volume', baseFactor: 1000 }
const TBSP: UnitInfo = { code: 'tbsp', kind: 'volume', baseFactor: 15 }
const CUP: UnitInfo = { code: 'cup', kind: 'volume', baseFactor: 250 }
const PCS: UnitInfo = { code: 'pcs', kind: 'count', baseFactor: null }
const PACK: UnitInfo = { code: 'pack', kind: 'count', baseFactor: null }
const TO_TASTE: UnitInfo = { code: 'to_taste', kind: 'other', baseFactor: null }

const flour: UnitWeight[] = [{ unitCode: 'ml', grams: 0.5, portion: 'TEST 1 cup = 125g' }]
const egg: UnitWeight[] = [{ unitCode: 'pcs', grams: 50, portion: 'TEST 1 large = 50g' }]

const userData = (patch: Partial<UserNutrition>): UserNutrition => ({
  ingredientId: 1,
  brand: 'ТЕСТ',
  basis: '100g',
  kcal: 100,
  protein: 10,
  fat: 5,
  carbs: 4,
  packageGrams: null,
  pieceGrams: null,
  note: null,
  ...patch,
})

describe('пересчёт в граммы и миллилитры', () => {
  it('масса и объём в своей системе — точно', () => {
    expect(toGrams(1.5, KG, [])).toEqual({ value: 1500, approximate: false, conversion: null })
    expect(toMilliliters(2, L, [])).toEqual({ value: 2000, approximate: false, conversion: null })
    expect(toMilliliters(3, TBSP, [])?.value).toBe(45)
  })

  it('объём → граммы через плотность — приближённо и с пояснением', () => {
    // 2 стакана × 250 мл × 0,5 г/мл = 250 г.
    const r = toGrams(2, CUP, flour)
    expect(r?.value).toBe(250)
    expect(r?.approximate).toBe(true)
    expect(r?.conversion).toEqual({
      kind: 'volume',
      mlPerUnit: 250,
      gramsPerMl: 0.5,
      portion: 'TEST 1 cup = 125g',
    })
  })

  it('граммы → миллилитры через плотность — приближённо', () => {
    const r = toMilliliters(100, G, [{ unitCode: 'ml', grams: 1.03, portion: 'TEST' }])
    expect(r?.value).toBeCloseTo(97.087, 3)
    expect(r?.approximate).toBe(true)
  })

  it('штуки → граммы через массу штуки — приближённо', () => {
    expect(toGrams(3, PCS, egg)).toMatchObject({ value: 150, approximate: true })
  })

  it('неизвестное не пересчитывается: нет плотности, массы штуки, «по вкусу», нет количества', () => {
    expect(toGrams(2, CUP, [])).toBeNull()
    expect(toGrams(1, PCS, [])).toBeNull()
    expect(toGrams(1, TO_TASTE, egg)).toBeNull()
    expect(toGrams(null, G, [])).toBeNull()
    expect(toMilliliters(1, PCS, egg)).toBeNull() // штука есть, плотности нет
  })

  it('своя масса штуки и упаковки заменяет справочную', () => {
    const weights = effectiveWeights(egg, userData({ pieceGrams: 60, packageGrams: 930 }))
    expect(toGrams(3, PCS, weights)?.value).toBe(180)
    expect(toGrams(1, PACK, weights)?.value).toBe(930)
    expect(weights.find((w) => w.unitCode === 'pcs')?.portion).toBe('ваша масса штуки')
  })
})

describe('сравнение количеств для подбора', () => {
  it('в одной системе — точно', () => {
    expect(compareQuantities({ quantity: 1, unit: KG }, { quantity: 1000, unit: G }, [])).toBe(
      'enough',
    )
    expect(compareQuantities({ quantity: 999, unit: G }, { quantity: 1, unit: KG }, [])).toBe('low')
    expect(compareQuantities({ quantity: 10, unit: PCS }, { quantity: 3, unit: PCS }, [])).toBe(
      'enough',
    )
  })

  it('через граммы — только с запасом 15 %, иначе неизвестно', () => {
    // Нужно 2 стакана муки = 250 г.
    const need = { quantity: 2, unit: CUP }
    expect(compareQuantities({ quantity: 1, unit: KG }, need, flour)).toBe('enough')
    expect(compareQuantities({ quantity: 200, unit: G }, need, flour)).toBe('low')
    // 260 г: на 4 % больше — при приближённой мере не обещаем, что хватит.
    expect(compareQuantities({ quantity: 260, unit: G }, need, flour)).toBe('unknown')
    // Без плотности сравнить нельзя.
    expect(compareQuantities({ quantity: 1, unit: KG }, need, [])).toBe('unknown')
    expect(compareQuantities({ quantity: null, unit: G }, need, flour)).toBe('unknown')
  })
})

describe('КБЖУ по данным с упаковки', () => {
  const line = (patch: Partial<NutritionLine>): NutritionLine => ({
    name: 'Молоко',
    categorySlug: 'dairy',
    importance: 'key',
    quantity: 1,
    unitCode: 'cup',
    unitKind: 'volume',
    unitBaseFactor: 250,
    nutrition: {
      kcal: 61,
      protein: 3.15,
      fat: 3.25,
      carbs: 4.8,
      approximate: true,
      note: 'TEST',
      sourceCode: 'test',
      sourceFoodId: '1',
      sourceFoodName: 'TEST milk',
    },
    unitWeights: [{ unitCode: 'ml', grams: 1.03, portion: 'TEST' }],
    ...patch,
  })

  it('на 100 мл: стакан = 250 мл → 2,5 × значения, точно', () => {
    const r = calculateNutrition(
      [
        line({
          userNutrition: userData({ basis: '100ml', kcal: 52, protein: 2.8, fat: 2.5, carbs: 4.7 }),
        }),
      ],
      null,
    )
    expect(r.lines[0]).toMatchObject({ source: 'package', amount: 250, amountUnit: 'ml' })
    expect(r.lines[0].approximate).toBe(false)
    expect(r.total.kcal).toBeCloseTo(130, 6)
    expect(r.total.fat).toBeCloseTo(6.25, 6)
  })

  it('на 100 мл при количестве в граммах — через плотность, приближённо', () => {
    const r = calculateNutrition(
      [
        line({
          quantity: 206,
          unitCode: 'g',
          unitKind: 'mass',
          unitBaseFactor: 1,
          userNutrition: userData({ basis: '100ml', kcal: 52 }),
        }),
      ],
      null,
    )
    // 206 г / 1,03 г/мл = 200 мл → 104 ккал.
    expect(r.lines[0].amount).toBeCloseTo(200, 6)
    expect(r.lines[0].approximate).toBe(true)
    expect(r.total.kcal).toBeCloseTo(104, 6)
  })

  it('без своих данных — справочные; на 100 г, через плотность', () => {
    const r = calculateNutrition([line({})], null)
    // 250 мл × 1,03 = 257,5 г × 61 / 100 = 157,075 ккал.
    expect(r.lines[0]).toMatchObject({ source: 'reference', amountUnit: 'g' })
    expect(r.total.kcal).toBeCloseTo(157.075, 6)
  })
})
