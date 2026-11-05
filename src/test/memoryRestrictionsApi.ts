import type {
  IngredientComposition,
  RestrictionGroup,
  RestrictionsApi,
  Substitution,
  UserRestriction,
} from '../features/restrictions/types'
import { KINDS_WITH_EXCEPTIONS } from '../features/restrictions/types'

// ТЕСТОВЫЙ справочник групп и разметка продуктов testCatalog и recipeFixtures.
export const testGroups: RestrictionGroup[] = [
  { code: 'milk', kind: 'allergen', name: 'Молоко (белок молока)', description: 'Белок молока.' },
  { code: 'lactose', kind: 'allergen', name: 'Лактоза', description: 'Молочный сахар.' },
  { code: 'gluten', kind: 'allergen', name: 'Глютен', description: 'Злаки с глютеном.' },
  { code: 'meat', kind: 'diet', name: 'Мясо', description: 'Мясо и мясные продукты.' },
]

const reviewed = (...groups: [string, 'contains' | 'may_contain'][]): IngredientComposition => ({
  reviewed: true,
  note: null,
  groups: groups.map(([code, relation]) => ({ code, relation })),
})

/** id продуктов — как в testCatalog (1–6) и recipeFixtures (7 — сметана). */
export const testComposition = new Map<number, IngredientComposition>([
  [1, reviewed()],
  [2, reviewed()],
  [3, reviewed()],
  [4, reviewed(['milk', 'contains'], ['lactose', 'contains'])],
  [5, reviewed()],
  [6, reviewed()],
  [7, reviewed(['milk', 'contains'], ['lactose', 'contains'])],
  [20, reviewed(['milk', 'contains'])],
  [21, reviewed()],
  [22, reviewed(['milk', 'contains'], ['lactose', 'contains'])],
])

// ТЕСТОВЫЕ замены: молоко (id 4) → безлактозное (id 20) и вода (id 21) только для выпечки;
// сметана (id 7) → йогурт (id 22). Состав замен — в testComposition.
const testSub = (
  id: number,
  from: number,
  to: number,
  toName: string,
  contexts: Substitution['contexts'],
): Substitution => ({
  id,
  fromIngredientId: from,
  toIngredientId: to,
  toName,
  toCategorySlug: 'dairy',
  ratio: 1,
  toUnit: null,
  amountNote: '1:1',
  contexts,
  scope: `ТЕСТ: где применима замена «${toName}»`,
  effect: `ТЕСТ: влияние замены «${toName}»`,
  warning: `ТЕСТ: предупреждение о замене «${toName}»`,
  confidence: 'practice',
})

export const testSubstitutions: Substitution[] = [
  testSub(1, 4, 20, 'Молоко безлактозное', []),
  testSub(2, 4, 21, 'Вода', ['baking']),
  testSub(3, 7, 22, 'Йогурт натуральный', []),
]

/** Ограничения в памяти с правилами БД: одна запись на группу/продукт, исключения — не при аллергии. */
export function createMemoryRestrictionsApi() {
  const store = {
    restrictions: [] as UserRestriction[],
    nextId: 1,
    failNext: null as string | null,
  }
  const maybeFail = async () => {
    await Promise.resolve()
    if (store.failNext) {
      const message = store.failNext
      store.failNext = null
      throw new Error(message)
    }
  }
  const find = (id: number) => {
    const r = store.restrictions.find((x) => x.id === id)
    if (!r) throw new Error('Ограничение не найдено')
    return r
  }
  const api: RestrictionsApi = {
    async loadReference() {
      await maybeFail()
      return {
        groups: testGroups,
        composition: new Map(testComposition),
        substitutions: structuredClone(testSubstitutions),
      }
    },
    async list() {
      await maybeFail()
      return structuredClone(store.restrictions)
    },
    async add(r) {
      await maybeFail()
      if (
        store.restrictions.some(
          (x) =>
            (r.groupCode !== null && x.groupCode === r.groupCode) ||
            (r.ingredientId !== null && x.ingredientId === r.ingredientId),
        )
      )
        throw new Error('Такое ограничение уже есть — измените его вид')
      const saved = { ...r, id: store.nextId++, exceptions: [] }
      store.restrictions.push(saved)
      return structuredClone(saved)
    },
    async update(id, patch) {
      await maybeFail()
      const r = find(id)
      Object.assign(r, patch)
      if (!KINDS_WITH_EXCEPTIONS.includes(r.kind)) r.exceptions = []
      return structuredClone(r)
    },
    async remove(id) {
      await maybeFail()
      store.restrictions = store.restrictions.filter((x) => x.id !== id)
    },
    async setExceptions(id, ingredientIds) {
      await maybeFail()
      const r = find(id)
      if (ingredientIds.length > 0 && (!KINDS_WITH_EXCEPTIONS.includes(r.kind) || !r.groupCode))
        throw new Error('Нет прав на это действие — войдите заново')
      r.exceptions = [...ingredientIds].sort((a, b) => a - b)
      return structuredClone(r)
    },
  }
  return { api, store }
}
