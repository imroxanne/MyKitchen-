import { describe, expect, it } from 'vitest'
import { evaluateLines, type EvaluatedLine } from './evaluate'
import { describePlan, dishContexts, optionsFor, planSubstitutions, usable } from './substitutions'
import type {
  DishContext,
  IngredientComposition,
  RestrictionProfile,
  Substitution,
  UserRestriction,
} from './types'

// ТЕСТОВАЯ разметка и замены (повторяют content/restrictions и content/substitutions).
const comp = (...g: [string, 'contains' | 'may_contain'][]): IngredientComposition => ({
  reviewed: true,
  note: null,
  groups: g.map(([code, relation]) => ({ code, relation })),
})
const MILK = 1
const LF_MILK = 2
const COCONUT = 3
const WATER = 4
const FLOUR = 5
const CORN_STARCH = 6
const BUCKWHEAT_FLAKES = 7 // замена «может содержать глютен»
const EGG = 8
const BEEF = 9
const MUSHROOMS = 10
const composition = new Map<number, IngredientComposition>([
  [MILK, comp(['milk', 'contains'], ['lactose', 'contains'])],
  [LF_MILK, comp(['milk', 'contains'])],
  [COCONUT, comp(['sulphites', 'may_contain'])],
  [WATER, comp()],
  [FLOUR, comp(['gluten', 'contains'])],
  [CORN_STARCH, comp()],
  [BUCKWHEAT_FLAKES, comp(['gluten', 'may_contain'])],
  [EGG, comp(['eggs', 'contains'])],
  [BEEF, comp(['meat', 'contains'])],
  [MUSHROOMS, comp()],
])

let nextSub = 1
const sub = (
  from: number,
  to: number,
  toName: string,
  contexts: DishContext[] = [],
): Substitution => ({
  id: nextSub++,
  fromIngredientId: from,
  toIngredientId: to,
  toName,
  toCategorySlug: 'other',
  ratio: 1,
  toUnit: null,
  amountNote: '1:1',
  contexts,
  scope: 'тест',
  effect: 'тест',
  warning: 'тест',
  confidence: 'practice',
})
const substitutions = [
  sub(MILK, LF_MILK, 'Молоко безлактозное'),
  sub(MILK, COCONUT, 'Кокосовое молоко', ['baking', 'boiling']),
  sub(MILK, WATER, 'Вода', ['baking']),
  sub(FLOUR, CORN_STARCH, 'Крахмал кукурузный', ['stewing', 'boiling']),
  sub(FLOUR, BUCKWHEAT_FLAKES, 'Гречневая мука', ['baking']),
  sub(BEEF, MUSHROOMS, 'Шампиньоны', ['stewing', 'frying']),
]

const restriction = (r: Partial<UserRestriction>): UserRestriction => ({
  id: 1,
  kind: 'allergy',
  groupCode: null,
  ingredientId: null,
  note: null,
  exceptions: [],
  ...r,
})
const profile = (...restrictions: UserRestriction[]): RestrictionProfile => ({
  restrictions,
  reference: { groups: [], composition, substitutions },
})
const line = (ingredientId: number, name: string): EvaluatedLine => ({
  ingredientId,
  name,
  importance: 'main',
})
const names = (options: ReturnType<typeof optionsFor>) =>
  options.map((o) => [o.substitution.toName, o.applicable, o.verdict])

describe('замены при ограничениях', () => {
  it('вид блюда по способам приготовления; без способов — без нагрева', () => {
    expect(dishContexts(['Жарка', 'варка'])).toEqual(['frying', 'boiling'])
    expect(dishContexts([])).toEqual(['cold'])
    expect(dishContexts(['копчение'])).toEqual(['cold'])
  })

  it('аллергия на молоко: безлактозное молоко заблокировано, остальные — в порядке справочника', () => {
    const p = profile(restriction({ kind: 'allergy', groupCode: 'milk' }))
    const options = optionsFor(MILK, ['baking'], p)
    expect(names(options)).toEqual([
      ['Кокосовое молоко', true, 'ok'],
      ['Вода', true, 'ok'],
      ['Молоко безлактозное', true, 'forbidden'],
    ])
    expect(options.filter(usable).map((o) => o.substitution.toName)).not.toContain(
      'Молоко безлактозное',
    )
  })

  it('непереносимость лактозы: безлактозное молоко подходит', () => {
    const p = profile(restriction({ kind: 'intolerance', groupCode: 'lactose' }))
    const [first] = optionsFor(MILK, ['frying'], p)
    expect(first?.substitution.toName).toBe('Молоко безлактозное')
    expect(usable(first!)).toBe(true)
  })

  it('замена не для этого блюда не предлагается', () => {
    const p = profile(restriction({ kind: 'allergy', groupCode: 'milk' }))
    const options = optionsFor(MILK, ['cold'], p)
    expect(names(options)).toEqual([
      ['Кокосовое молоко', false, 'ok'],
      ['Вода', false, 'ok'],
      ['Молоко безлактозное', true, 'forbidden'],
    ])
    expect(options.some(usable)).toBe(false)
  })

  it('рецепт с заменами: план по каждому запрещённому продукту', () => {
    const p = profile(
      restriction({ kind: 'allergy', groupCode: 'milk' }),
      restriction({ id: 2, kind: 'medical', groupCode: 'gluten' }),
    )
    const lines = [line(MILK, 'Молоко'), line(FLOUR, 'Мука пшеничная'), line(EGG, 'Яйцо')]
    const result = evaluateLines(lines, p)
    expect(result.verdict).toBe('forbidden')

    // Выпечка: молоко → кокосовое (подходит), мука → гречневая (может содержать глютен).
    const baking = planSubstitutions(result, ['baking'], p)
    expect(describePlan(baking!)).toBe('Молоко → Кокосовое молоко, Мука пшеничная → Гречневая мука')
    expect(baking!.verdict).toBe('check')
    // Тушение: молоку нечем заменить — рецепт не подходит.
    expect(planSubstitutions(result, ['stewing'], p)).toBeNull()
  })

  it('без запрещённого плана нет; подходящий план без «проверьте» — ok', () => {
    const p = profile(restriction({ kind: 'preference', groupCode: 'meat' }))
    const ok = evaluateLines([line(EGG, 'Яйцо')], p)
    expect(planSubstitutions(ok, ['frying'], p)).toBeNull()
    const beef = evaluateLines([line(BEEF, 'Говядина')], p)
    expect(planSubstitutions(beef, ['frying'], p)).toMatchObject({ verdict: 'ok' })
  })
})
