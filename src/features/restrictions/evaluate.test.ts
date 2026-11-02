import { describe, expect, it } from 'vitest'
import { evaluateLines, type EvaluatedLine } from './evaluate'
import { describeIssue, summarize } from './present'
import type {
  IngredientComposition,
  RestrictionGroup,
  RestrictionProfile,
  UserRestriction,
} from './types'

// ТЕСТОВАЯ разметка (повторяет content/restrictions для этих продуктов).
const groups: RestrictionGroup[] = [
  { code: 'milk', kind: 'allergen', name: 'Молоко (белок молока)', description: '' },
  { code: 'lactose', kind: 'allergen', name: 'Лактоза', description: '' },
  { code: 'gluten', kind: 'allergen', name: 'Глютен', description: '' },
  { code: 'meat', kind: 'diet', name: 'Мясо', description: '' },
]
const comp = (
  ...g: [code: string, relation: 'contains' | 'may_contain'][]
): IngredientComposition => ({
  reviewed: true,
  note: null,
  groups: g.map(([code, relation]) => ({ code, relation })),
})
const MILK = 1
const LACTOSE_FREE_MILK = 2
const HARD_CHEESE = 3
const BUCKWHEAT = 4
const FLOUR = 5
const CARROT = 6
const OWN_SAUCE = 7 // личный продукт: состав не проверен
const CILANTRO = 8
const composition = new Map<number, IngredientComposition>([
  [MILK, comp(['milk', 'contains'], ['lactose', 'contains'])],
  [LACTOSE_FREE_MILK, comp(['milk', 'contains'])],
  [HARD_CHEESE, comp(['milk', 'contains'], ['lactose', 'may_contain'])],
  [BUCKWHEAT, comp(['gluten', 'may_contain'])],
  [FLOUR, comp(['gluten', 'contains'])],
  [CARROT, comp()],
  [CILANTRO, comp()],
])

const line = (
  ingredientId: number,
  name: string,
  importance: EvaluatedLine['importance'] = 'main',
): EvaluatedLine => ({ ingredientId, name, importance })

let nextId = 1
const restriction = (r: Partial<UserRestriction>): UserRestriction => ({
  id: nextId++,
  kind: 'allergy',
  groupCode: null,
  ingredientId: null,
  note: null,
  exceptions: [],
  ...r,
})
const profile = (...restrictions: UserRestriction[]): RestrictionProfile => ({
  restrictions,
  reference: { groups, composition },
})

describe('строгий отбор по ограничениям', () => {
  it('без ограничений всё подходит, даже непроверенный состав', () => {
    expect(evaluateLines([line(OWN_SAUCE, 'Мой соус')], profile()).verdict).toBe('ok')
    expect(evaluateLines([line(MILK, 'Молоко')], null).verdict).toBe('ok')
  })

  it('аллергия на молоко: молоко и безлактозное молоко — нельзя', () => {
    const p = profile(restriction({ kind: 'allergy', groupCode: 'milk' }))
    expect(evaluateLines([line(MILK, 'Молоко')], p).verdict).toBe('forbidden')
    const r = evaluateLines(
      [line(LACTOSE_FREE_MILK, 'Молоко безлактозное'), line(CARROT, 'Морковь')],
      p,
    )
    expect(r.verdict).toBe('forbidden')
    expect(r.issues.map((i) => describeIssue(i, groups))).toEqual([
      'Молоко безлактозное: молоко (белок молока) — аллергия.',
    ])
  })

  it('непереносимость лактозы: безлактозное подходит, твёрдый сыр — проверить или переносимый', () => {
    const lactose = restriction({ kind: 'intolerance', groupCode: 'lactose' })
    expect(
      evaluateLines([line(LACTOSE_FREE_MILK, 'Молоко безлактозное')], profile(lactose)).verdict,
    ).toBe('ok')
    expect(evaluateLines([line(MILK, 'Молоко')], profile(lactose)).verdict).toBe('forbidden')
    const cheese = evaluateLines([line(HARD_CHEESE, 'Сыр твёрдый')], profile(lactose))
    expect(cheese.verdict).toBe('check')
    expect(describeIssue(cheese.issues[0]!, groups)).toBe(
      'Сыр твёрдый: возможно, есть лактоза (непереносимость) — проверьте состав на упаковке.',
    )
    // Отмечен как переносимый — подходит.
    const tolerated = { ...lactose, exceptions: [HARD_CHEESE, MILK] }
    expect(evaluateLines([line(HARD_CHEESE, 'Сыр твёрдый')], profile(tolerated)).verdict).toBe('ok')
    expect(evaluateLines([line(MILK, 'Молоко')], profile(tolerated)).verdict).toBe('ok')
  })

  it('при аллергии «переносимые» продукты не действуют, даже если попали в данные', () => {
    const allergy = restriction({ kind: 'allergy', groupCode: 'milk', exceptions: [MILK] })
    expect(evaluateLines([line(MILK, 'Молоко')], profile(allergy)).verdict).toBe('forbidden')
    const medical = restriction({ kind: 'medical', groupCode: 'milk', exceptions: [MILK] })
    expect(evaluateLines([line(MILK, 'Молоко')], profile(medical)).verdict).toBe('forbidden')
  })

  it('глютен: мука — нельзя, гречка — проверить (перекрёстный контакт)', () => {
    const p = profile(restriction({ kind: 'medical', groupCode: 'gluten', note: 'целиакия' }))
    expect(evaluateLines([line(FLOUR, 'Мука пшеничная')], p).verdict).toBe('forbidden')
    const r = evaluateLines([line(BUCKWHEAT, 'Гречка')], p)
    expect(r.verdict).toBe('check')
    expect(summarize(r, groups)).toBe('Проверьте: глютен')
  })

  it('непроверенный состав при ограничениях по группам — «требует проверки», а не «безопасно»', () => {
    const p = profile(restriction({ kind: 'preference', groupCode: 'meat' }))
    const r = evaluateLines([line(OWN_SAUCE, 'Мой соус'), line(CARROT, 'Морковь')], p)
    expect(r.verdict).toBe('check')
    expect(r.issues).toHaveLength(1)
    expect(describeIssue(r.issues[0]!, groups)).toBe(
      'Мой соус: состав не проверен — убедитесь, что продукт вам подходит.',
    )
    expect(summarize(r, groups)).toBe('Проверьте: состав «Мой соус»')
    // Ограничение только на конкретный продукт — состав других не важен.
    const onlyProduct = profile(restriction({ kind: 'preference', ingredientId: CILANTRO }))
    expect(evaluateLines([line(OWN_SAUCE, 'Мой соус')], onlyProduct).verdict).toBe('ok')
  })

  it('исключённый продукт; «по желанию» — подходит без него, но с пометкой', () => {
    const p = profile(restriction({ kind: 'preference', ingredientId: CILANTRO }))
    expect(evaluateLines([line(CILANTRO, 'Кинза')], p).verdict).toBe('forbidden')
    const optional = evaluateLines([line(CILANTRO, 'Кинза', 'optional')], p)
    expect(optional.verdict).toBe('check')
    expect(describeIssue(optional.issues[0]!, groups)).toBe(
      'Кинза: исключён — не едите. Продукт по желанию — можно не добавлять.',
    )
  })

  it('итог — худшее; сначала запрещённое; кратко для карточки', () => {
    const p = profile(
      restriction({ kind: 'allergy', groupCode: 'milk' }),
      restriction({ kind: 'medical', groupCode: 'gluten' }),
    )
    const r = evaluateLines(
      [line(BUCKWHEAT, 'Гречка'), line(MILK, 'Молоко'), line(FLOUR, 'Мука пшеничная')],
      p,
    )
    expect(r.verdict).toBe('forbidden')
    expect(r.issues.map((i) => [i.name, i.verdict])).toEqual([
      ['Молоко', 'forbidden'],
      ['Мука пшеничная', 'forbidden'],
      ['Гречка', 'check'],
    ])
    expect(summarize(r, groups)).toBe('Не подходит: молоко (белок молока), глютен')
  })
})
