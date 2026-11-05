import { useState } from 'react'
import { Link } from 'react-router'
import type { RestrictionIssue, RestrictionResult } from './evaluate'
import { describeIssue } from './present'
import { optionsFor, usable, type SubstitutionOption } from './substitutions'
import { CONFIDENCE_LABEL, type DishContext, type RestrictionProfile } from './types'

/** Что в рецепте не подходит по ограничениям пользователя, почему и чем заменить (B4, B5). */
export function RestrictionNotice({
  result,
  profile,
  contexts,
  onApply,
}: {
  result: RestrictionResult
  /** null — ограничения не загрузились; undefined — ещё загружаются. */
  profile: RestrictionProfile | null | undefined
  /** Виды блюда — для применимости замен. */
  contexts: DishContext[]
  /** Создать свою версию рецепта с заменой; без него кнопки нет. */
  onApply?: (ingredientId: number, option: SubstitutionOption) => Promise<void>
}) {
  if (profile === undefined) return null
  if (profile === null)
    return (
      <p className="error small" role="alert">
        Ваши пищевые ограничения не загрузились — рецепт по ним не проверен.
      </p>
    )
  if (profile.restrictions.length === 0) return null
  if (result.verdict === 'ok')
    return (
      <p className="restriction-ok small">
        По вашим ограничениям подходит.{' '}
        <span className="muted">
          Продукты размечены по типичному составу — состав на упаковке важнее.
        </span>
      </p>
    )
  const forbidden = result.verdict === 'forbidden'
  // Замены показываем один раз на продукт, даже если он нарушает несколько ограничений.
  const withOptions = new Set<number>()
  return (
    <section
      className={`card restriction-card restriction-${result.verdict}`}
      aria-labelledby="restriction-title"
    >
      <h2 id="restriction-title">
        {forbidden ? 'Не подходит по вашим ограничениям' : 'Проверьте по вашим ограничениям'}
      </h2>
      <ul>
        {result.issues.map((issue, i) => {
          const first = issue.reason !== 'unknown' && !withOptions.has(issue.ingredientId)
          if (first) withOptions.add(issue.ingredientId)
          return (
            <li key={i} className={`issue-${issue.verdict}`}>
              {describeIssue(issue, profile.reference.groups)}
              {first && (
                <Substitutions
                  issue={issue}
                  options={optionsFor(issue.ingredientId, contexts, profile)}
                  profile={profile}
                  onApply={onApply}
                />
              )}
            </li>
          )
        })}
      </ul>
      <p className="muted small">
        Продукты размечены по типичному составу; у конкретной упаковки он может отличаться.{' '}
        <Link to="/profile">Мои ограничения</Link>
      </p>
    </section>
  )
}

function Substitutions({
  issue,
  options,
  profile,
  onApply,
}: {
  issue: RestrictionIssue
  options: SubstitutionOption[]
  profile: RestrictionProfile
  onApply?: (ingredientId: number, option: SubstitutionOption) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (options.length === 0)
    return <p className="small substitutions-none">Замен для этого продукта в справочнике нет.</p>
  const apply = async (option: SubstitutionOption) => {
    if (!onApply) return
    setBusy(true)
    setError(null)
    try {
      await onApply(issue.ingredientId, option)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }
  return (
    <div className="substitutions">
      <p className="small">Замены:</p>
      <ul aria-label={`Замены: ${issue.name}`}>
        {options.map((o) => {
          const s = o.substitution
          const ownIssue = o.issues[0]
          return (
            <li key={s.id} className={usable(o) ? 'substitution' : 'substitution blocked'}>
              <strong>{s.toName}</strong> — {s.amountNote}.
              {o.verdict === 'forbidden' ? (
                <span className="substitution-status">
                  {' '}
                  Вам не подходит:{' '}
                  {ownIssue ? describeIssue(ownIssue, profile.reference.groups) : ''}
                </span>
              ) : !o.applicable ? (
                <span className="substitution-status"> Не для этого блюда: {s.scope}</span>
              ) : (
                <>
                  {' '}
                  <span>{s.scope}</span> <span>{s.effect}</span>{' '}
                  <span className="substitution-warning">⚠ {s.warning}</span>
                  {o.verdict === 'check' && ownIssue && (
                    <span className="substitution-status">
                      {' '}
                      Проверьте: {describeIssue(ownIssue, profile.reference.groups)}
                    </span>
                  )}
                  <span className="muted"> Подтверждение: {CONFIDENCE_LABEL[s.confidence]}.</span>
                  {onApply && (
                    <button
                      type="button"
                      className="link"
                      disabled={busy}
                      onClick={() => void apply(o)}
                    >
                      Своя версия с заменой на «{s.toName}»
                    </button>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
