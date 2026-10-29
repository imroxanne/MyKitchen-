import { describe, expect, it } from 'vitest'
import { openLicenseRecipe } from '../../test/recipeFixtures'
import {
  describeAmount,
  describeServings,
  describeTime,
  sourceSiteName,
  trustBadges,
} from './present'

describe('trustBadges', () => {
  it('всегда показывает оба статуса — и проверенные, и нет', () => {
    const labels = trustBadges(openLicenseRecipe.trust).map((b) => b.label)
    expect(labels).toEqual(['Не проверен приготовлением', 'Источник и полнота проверены'])
  })

  it('без проверки источника — честная пометка; тестовые и пользовательские данные отмечены', () => {
    const labels = trustBadges({
      ...openLicenseRecipe.trust,
      origin: 'user',
      isSample: true,
      sourceCheckedAt: null,
      sourceCheckedNote: null,
    }).map((b) => b.label)
    expect(labels).toEqual([
      'Тестовые данные',
      'Не проверен приготовлением',
      'Источник не проверен',
      'Добавлен пользователем',
    ])
  })

  it('проверка приготовлением показывает дату и основание', () => {
    const [cooked] = trustBadges({
      ...openLicenseRecipe.trust,
      cookedVerifiedAt: '2026-11-01T00:00:00Z',
      cookedVerifiedNote: 'Приготовлено владелицей',
    })
    expect(cooked.label).toBe('Проверен приготовлением')
    expect(cooked.explanation).toBe('1 ноября 2026 г.: Приготовлено владелицей')
  })
})

describe('время, порции, количества', () => {
  it('не выдумывает отсутствующее время', () => {
    expect(describeTime(15, 45)).toBe('1 ч')
    expect(describeTime(null, 90)).toBe('1 ч 30 мин (указано не полностью)')
    expect(describeTime(null, null)).toBe('время не указано в источнике')
  })

  it('склоняет порции и честно пишет об их отсутствии', () => {
    expect(describeServings(1)).toBe('1 порция')
    expect(describeServings(4)).toBe('4 порции')
    expect(describeServings(12)).toBe('12 порций')
    expect(describeServings(null)).toBe('число порций не указано в источнике')
  })

  it('количество — число с единицей либо текст источника', () => {
    const [beet, salt, cream] = openLicenseRecipe.ingredients
    expect(describeAmount(beet)).toBe('300 г')
    expect(describeAmount(salt)).toBe('по вкусу')
    expect(describeAmount(cream)).toBe('для подачи')
  })

  it('называет сайт источника', () => {
    expect(sourceSiteName(openLicenseRecipe.source!)).toBe('Викиучебник')
  })
})
