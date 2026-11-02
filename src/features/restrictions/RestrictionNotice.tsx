import { Link } from 'react-router'
import type { RestrictionResult } from './evaluate'
import { describeIssue } from './present'
import type { RestrictionProfile } from './types'

/** Что в рецепте не подходит по ограничениям пользователя и почему (B4). */
export function RestrictionNotice({
  result,
  profile,
}: {
  result: RestrictionResult
  /** null — ограничения не загрузились; undefined — ещё загружаются. */
  profile: RestrictionProfile | null | undefined
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
  return (
    <section
      className={`card restriction-card restriction-${result.verdict}`}
      aria-labelledby="restriction-title"
    >
      <h2 id="restriction-title">
        {forbidden ? 'Не подходит по вашим ограничениям' : 'Проверьте по вашим ограничениям'}
      </h2>
      <ul>
        {result.issues.map((issue, i) => (
          <li key={i} className={`issue-${issue.verdict}`}>
            {describeIssue(issue, profile.reference.groups)}
          </li>
        ))}
      </ul>
      <p className="muted small">
        Продукты размечены по типичному составу; у конкретной упаковки он может отличаться.{' '}
        <Link to="/profile">Мои ограничения</Link>
      </p>
    </section>
  )
}
