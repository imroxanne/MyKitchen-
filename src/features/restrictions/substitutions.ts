// Замены ингредиентов при ограничениях (B5). Чистые функции.
//
// * Безопасность замены проверяется так же, как продукт рецепта (evaluateLines): замена, которая
//   сама запрещена пользователю, блокируется — например, безлактозное молоко при аллергии на
//   белок молока (ТЗ §7). «Может содержать» — замена допустима, но с пометкой «проверьте».
// * Замена применима, только если подходит к виду блюда (выпечка, жарка…).
// * Рецепт «подходит с заменами», если у каждого запрещённого продукта есть применимая и
//   не заблокированная замена.
import {
  evaluateLines,
  type RestrictionIssue,
  type RestrictionResult,
  type Verdict,
} from './evaluate'
import type { DishContext, RestrictionProfile, Substitution } from './types'

const METHOD_CONTEXT: Record<string, DishContext> = {
  выпечка: 'baking',
  запекание: 'baking',
  жарка: 'frying',
  варка: 'boiling',
  тушение: 'stewing',
}

/** Виды блюда по способам приготовления рецепта; без способов — блюдо без нагрева. */
export function dishContexts(cookingMethods: string[]): DishContext[] {
  const contexts = [
    ...new Set(cookingMethods.flatMap((m) => METHOD_CONTEXT[m.toLowerCase()] ?? [])),
  ]
  return contexts.length > 0 ? contexts : ['cold']
}

export interface SubstitutionOption {
  substitution: Substitution
  /** Подходит к виду блюда. */
  applicable: boolean
  /** Как замена сама проходит по ограничениям пользователя. */
  verdict: Verdict
  issues: RestrictionIssue[]
}

/** Можно предложить: подходит к блюду и не запрещена пользователю. */
export const usable = (o: SubstitutionOption) => o.applicable && o.verdict !== 'forbidden'

const ORDER = (o: SubstitutionOption) =>
  usable(o) ? (o.verdict === 'ok' ? 0 : 1) : o.verdict === 'forbidden' ? 3 : 2

/** Замены продукта: сначала подходящие, затем «проверьте», не для этого блюда, заблокированные. */
export function optionsFor(
  ingredientId: number,
  contexts: DishContext[],
  profile: RestrictionProfile,
): SubstitutionOption[] {
  return profile.reference.substitutions
    .filter((s) => s.fromIngredientId === ingredientId)
    .map((substitution) => {
      const result = evaluateLines(
        [
          {
            ingredientId: substitution.toIngredientId,
            name: substitution.toName,
            importance: 'main',
          },
        ],
        profile,
      )
      return {
        substitution,
        applicable:
          substitution.contexts.length === 0 ||
          substitution.contexts.some((c) => contexts.includes(c)),
        verdict: result.verdict,
        issues: result.issues,
      }
    })
    .sort((a, b) => ORDER(a) - ORDER(b))
}

export interface SubstitutionPlan {
  /** По одной замене на каждый запрещённый продукт. */
  replacements: { ingredientId: number; name: string; option: SubstitutionOption }[]
  /** С заменами: ok — подходит; check — остаются «проверьте». */
  verdict: Exclude<Verdict, 'forbidden'>
}

/** Можно ли приготовить запрещённый рецепт с заменами; null — нет. */
export function planSubstitutions(
  result: RestrictionResult,
  contexts: DishContext[],
  profile: RestrictionProfile,
): SubstitutionPlan | null {
  if (result.verdict !== 'forbidden') return null
  const forbidden = new Map<number, string>()
  for (const issue of result.issues)
    if (issue.verdict === 'forbidden') forbidden.set(issue.ingredientId, issue.name)
  const replacements: SubstitutionPlan['replacements'] = []
  for (const [ingredientId, name] of forbidden) {
    const option = optionsFor(ingredientId, contexts, profile).find(usable)
    if (!option) return null
    replacements.push({ ingredientId, name, option })
  }
  const remainingCheck = result.issues.some(
    (i) => i.verdict === 'check' && !forbidden.has(i.ingredientId),
  )
  return {
    replacements,
    verdict:
      remainingCheck || replacements.some((r) => r.option.verdict === 'check') ? 'check' : 'ok',
  }
}

/** «Молоко → Молоко безлактозное, Мука пшеничная → Крахмал кукурузный». */
export const describePlan = (plan: SubstitutionPlan) =>
  plan.replacements.map((r) => `${r.name} → ${r.option.substitution.toName}`).join(', ')
