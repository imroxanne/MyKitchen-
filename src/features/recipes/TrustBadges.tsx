import { trustBadges } from './present'
import type { RecipeTrust } from './types'

/** Значки доверия. С пояснениями — на странице рецепта, кратко — в карточке списка. */
export function TrustBadges({
  trust,
  detailed = false,
}: {
  trust: RecipeTrust
  detailed?: boolean
}) {
  const badges = trustBadges(trust)
  if (!detailed)
    return (
      <span className="trust-badges">
        {badges.map((b) => (
          <span key={b.key} className={`trust trust-${b.tone}`}>
            {b.label}
          </span>
        ))}
      </span>
    )
  return (
    <ul className="trust-list" aria-label="Статус проверки">
      {badges.map((b) => (
        <li key={b.key}>
          <span className={`trust trust-${b.tone}`}>{b.label}</span>
          <span className="muted small">{b.explanation}</span>
        </li>
      ))}
    </ul>
  )
}
