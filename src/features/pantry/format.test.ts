import { describe, expect, it } from 'vitest'
import { testCatalog } from '../../test/memoryPantryApi'
import { describeExpiry, formatQuantity, parseQuantity } from './format'

describe('parseQuantity', () => {
  it('понимает запятую и точку', () => {
    expect(parseQuantity('0,5')).toBe(0.5)
    expect(parseQuantity(' 1.25 ')).toBe(1.25)
    expect(parseQuantity('3')).toBe(3)
  })

  it('пустое значение — количество неизвестно', () => {
    expect(parseQuantity('')).toBeNull()
    expect(parseQuantity('   ')).toBeNull()
  })

  it('отклоняет ноль, отрицательные и мусор', () => {
    for (const bad of ['0', '-1', 'abc', '1,2,3', '1/2', '2 шт']) {
      expect(parseQuantity(bad)).toBeUndefined()
    }
  })
})

describe('formatQuantity', () => {
  it('выводит количество с единицей и не выдумывает неизвестное', () => {
    expect(formatQuantity(0.5, 'kg', testCatalog.units)).toBe('0,5 кг')
    expect(formatQuantity(null, null, testCatalog.units)).toBe('количество не указано')
  })
})

describe('describeExpiry', () => {
  const today = new Date(2026, 9, 29)
  it('различает просроченное, скоро и обычное', () => {
    expect(describeExpiry('2026-10-28', today).status).toBe('expired')
    expect(describeExpiry('2026-10-29', today)).toEqual({
      text: 'годен до сегодня',
      status: 'soon',
    })
    expect(describeExpiry('2026-10-31', today).status).toBe('soon')
    expect(describeExpiry('2026-11-05', today).status).toBe('ok')
  })
})
