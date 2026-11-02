// Строгий отбор по пищевым ограничениям (B4). Чистые функции.
//
// * «содержит» запрещённое → рецепт не подходит (forbidden); если продукт «по желанию» —
//   подходит без него, но требует внимания (check);
// * «может содержать» (состав зависит от производителя, перекрёстный контакт) → check;
// * состав продукта не проверен (личный продукт, нет разметки) при ограничениях по группам →
//   check: неизвестное не считается безопасным (ТЗ §7);
// * переносимые продукты учитываются только при непереносимости и предпочтении — не при аллергии
//   и медицинском ограничении, даже если в данных они вдруг есть.
import type { Relation, RestrictionProfile, UserRestriction } from './types'
import { KINDS_WITH_EXCEPTIONS } from './types'

export type Verdict = 'ok' | 'check' | 'forbidden'

export interface EvaluatedLine {
  ingredientId: number
  name: string
  importance: 'key' | 'main' | 'minor' | 'optional'
}

export interface RestrictionIssue {
  ingredientId: number
  name: string
  optional: boolean
  /** null — состав продукта не проверен (относится ко всем ограничениям по группам). */
  restriction: UserRestriction | null
  /** Группа, по которой сработало ограничение; null — ограничение на сам продукт. */
  groupCode: string | null
  reason: Relation | 'unknown' | 'excluded'
  verdict: Exclude<Verdict, 'ok'>
}

export interface RestrictionResult {
  verdict: Verdict
  issues: RestrictionIssue[]
}

export const OK: RestrictionResult = { verdict: 'ok', issues: [] }

const RANK: Record<Verdict, number> = { ok: 0, check: 1, forbidden: 2 }

export const worst = (a: Verdict, b: Verdict): Verdict => (RANK[a] >= RANK[b] ? a : b)

function exceptionApplies(r: UserRestriction, ingredientId: number): boolean {
  return KINDS_WITH_EXCEPTIONS.includes(r.kind) && r.exceptions.includes(ingredientId)
}

export function evaluateLines(
  lines: EvaluatedLine[],
  profile: RestrictionProfile | null,
): RestrictionResult {
  if (!profile || profile.restrictions.length === 0) return OK
  const byGroup = profile.restrictions.filter((r) => r.groupCode !== null)
  const issues: RestrictionIssue[] = []
  for (const line of lines) {
    const optional = line.importance === 'optional'
    const base = { ingredientId: line.ingredientId, name: line.name, optional }
    const severity = (relation: Relation | 'excluded') =>
      relation === 'may_contain' || optional ? ('check' as const) : ('forbidden' as const)

    for (const r of profile.restrictions)
      if (r.ingredientId === line.ingredientId)
        issues.push({
          ...base,
          restriction: r,
          groupCode: null,
          reason: 'excluded',
          verdict: severity('excluded'),
        })

    const relevant = byGroup.filter((r) => !exceptionApplies(r, line.ingredientId))
    if (relevant.length === 0) continue
    const composition = profile.reference.composition.get(line.ingredientId)
    if (!composition?.reviewed) {
      issues.push({
        ...base,
        restriction: null,
        groupCode: null,
        reason: 'unknown',
        verdict: 'check',
      })
      continue
    }
    for (const r of relevant) {
      const hit = composition.groups.find((g) => g.code === r.groupCode)
      if (hit)
        issues.push({
          ...base,
          restriction: r,
          groupCode: hit.code,
          reason: hit.relation,
          verdict: severity(hit.relation),
        })
    }
  }
  return {
    verdict: issues.reduce<Verdict>((v, i) => worst(v, i.verdict), 'ok'),
    // Сначала запрещённое, потом «проверьте»; внутри — в порядке состава.
    issues: issues.sort((a, b) => RANK[b.verdict] - RANK[a.verdict]),
  }
}
