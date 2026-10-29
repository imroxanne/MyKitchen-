import { describe, expect, it } from 'vitest'
import { normalizeName } from '../../lib/normalize'
import { testCatalog } from '../../test/memoryPantryApi'
import { findExact, searchCatalog } from './search'

const names = (query: string) => searchCatalog(testCatalog.items, query).map((h) => h.item.name)

describe('normalizeName', () => {
  it('совпадает с SQL-функцией normalize_name (те же контрольные примеры)', () => {
    expect(normalizeName('  Ёжик   В  ТУМАНЕ ')).toBe('ежик в тумане')
    expect(normalizeName('Свёкла')).toBe('свекла')
    expect(normalizeName('\tЛук\nрепчатый ')).toBe('лук репчатый')
  })
})

describe('searchCatalog', () => {
  it('находит по синониму и показывает, по какому', () => {
    const [hit] = searchCatalog(testCatalog.items, 'Помидор')
    expect(hit.item.name).toBe('Томат')
    expect(hit.viaSynonym).toBe('помидор')
  })

  it('точное совпадение выше вхождения', () => {
    expect(names('томат')).toEqual(['Томат', 'Томатная паста'])
  })

  it('не различает ё/е и регистр', () => {
    expect(names('СВЕКЛА')).toEqual(['Свёкла'])
  })

  it('находит по началу слова и по вхождению', () => {
    expect(names('паст')).toEqual(['Томатная паста'])
    expect(names('орков')).toEqual(['Морковь'])
  })

  it('прощает окончание слова', () => {
    expect(names('морковки')).toEqual(['Морковь'])
  })

  it('пустой запрос — пустой результат, неизвестное — пустой', () => {
    expect(names('  ')).toEqual([])
    expect(names('ананасище')).toEqual([])
  })
})

describe('findExact', () => {
  it('ищет точное совпадение по названию и синонимам', () => {
    expect(findExact(testCatalog.items, 'буряк')?.name).toBe('Свёкла')
    expect(findExact(testCatalog.items, ' томат ')?.name).toBe('Томат')
    expect(findExact(testCatalog.items, 'томаты')).toBeUndefined()
  })
})
