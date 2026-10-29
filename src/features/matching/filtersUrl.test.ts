import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS } from './match'
import { parseFilters, serializeFilters } from './filtersUrl'

describe('фильтры в адресе', () => {
  it('без параметров: «докупить до 3», при пустых запасах — «без учёта запасов»', () => {
    expect(parseFilters(new URLSearchParams(), false)).toEqual(DEFAULT_FILTERS)
    expect(parseFilters(new URLSearchParams(), true).mode).toBe('ignore')
    expect(parseFilters(new URLSearchParams('mode=have'), true).mode).toBe('have')
  })

  it('туда и обратно без потерь', () => {
    const f = {
      ...DEFAULT_FILTERS,
      mode: 'buy' as const,
      maxToBuy: 1,
      maxMinutes: 30,
      mealType: 'breakfast',
      query: 'яйцо',
      verifiedOnly: true,
      sort: 'time' as const,
    }
    expect(parseFilters(serializeFilters(f), false)).toEqual(f)
  })

  it('игнорирует мусор в адресе', () => {
    const f = parseFilters(new URLSearchParams('mode=x&n=abc&t=-5&meal=supper&sort=?'), false)
    expect(f).toEqual(DEFAULT_FILTERS)
  })
})
