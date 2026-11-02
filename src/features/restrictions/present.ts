// Как объяснять результат отбора по ограничениям: что именно и почему.
import type { RestrictionIssue, RestrictionResult } from './evaluate'
import type { RestrictionGroup, RestrictionKind, RestrictionProfile } from './types'

const KIND_SHORT: Record<RestrictionKind, string> = {
  allergy: 'аллергия',
  intolerance: 'непереносимость',
  medical: 'медицинское ограничение',
  preference: 'не едите',
}

/** Название группы с маленькой буквы — для середины фразы. */
export function groupName(groups: RestrictionGroup[], code: string | null): string {
  const name = groups.find((g) => g.code === code)?.name ?? code ?? ''
  return name.charAt(0).toLowerCase() + name.slice(1)
}

/** «Масло сливочное: молоко (белок молока) — аллергия». */
export function describeIssue(issue: RestrictionIssue, groups: RestrictionGroup[]): string {
  const kind = issue.restriction ? KIND_SHORT[issue.restriction.kind] : ''
  const optional = issue.optional ? ' Продукт по желанию — можно не добавлять.' : ''
  switch (issue.reason) {
    case 'excluded':
      return `${issue.name}: исключён — ${kind}.${optional}`
    case 'contains':
      return `${issue.name}: ${groupName(groups, issue.groupCode)} — ${kind}.${optional}`
    case 'may_contain':
      return `${issue.name}: возможно, есть ${groupName(groups, issue.groupCode)} (${kind}) — проверьте состав на упаковке.${optional}`
    case 'unknown':
      return `${issue.name}: состав не проверен — убедитесь, что продукт вам подходит.${optional}`
  }
}

/** Коротко для карточки: «Не подходит: молоко (белок молока)» или «Проверьте: глютен, состав «Мой соус»». */
export function summarize(result: RestrictionResult, groups: RestrictionGroup[]): string | null {
  if (result.verdict === 'ok') return null
  const relevant = result.issues.filter((i) => i.verdict === result.verdict)
  const parts = [
    ...new Set(
      relevant.map((i) =>
        i.reason === 'unknown'
          ? `состав «${i.name}»`
          : i.reason === 'excluded'
            ? i.name
            : groupName(groups, i.groupCode),
      ),
    ),
  ]
  return `${result.verdict === 'forbidden' ? 'Не подходит' : 'Проверьте'}: ${parts.join(', ')}`
}

/** Пометка карточки по ограничениям; null — подходит. */
export function restrictionMark(
  result: RestrictionResult | undefined,
  profile: RestrictionProfile | null,
): { verdict: 'check' | 'forbidden'; text: string } | null {
  if (!result || result.verdict === 'ok' || !profile) return null
  return { verdict: result.verdict, text: summarize(result, profile.reference.groups)! }
}
