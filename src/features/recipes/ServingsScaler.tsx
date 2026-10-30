import { describeServings } from './present'

/**
 * Пересчёт количеств на другое число порций — только для просмотра, ничего не сохраняет (B2).
 * Если число порций в источнике не указано, вместо порций меняется множитель.
 */
export function ServingsScaler({
  servings,
  factor,
  onChange,
}: {
  servings: number | null
  factor: number
  onChange(factor: number): void
}) {
  const byServings = servings !== null
  const current = byServings ? Math.round(servings * factor * 100) / 100 : factor
  const step = byServings ? 1 : 0.5
  const min = byServings ? 1 : 0.5
  const set = (value: number) => onChange(byServings ? value / servings : value)
  const label = byServings ? describeServings(current) : `×${current.toLocaleString('ru-RU')}`
  return (
    <div className="servings-scaler" role="group" aria-label="Пересчёт количеств">
      <span className="muted small">{byServings ? 'Порции:' : 'Количество:'}</span>
      <button
        type="button"
        aria-label={byServings ? 'Меньше порций' : 'Уменьшить количество'}
        disabled={current - step < min}
        onClick={() => set(current - step)}
      >
        −
      </button>
      <output aria-live="polite">{label}</output>
      <button
        type="button"
        aria-label={byServings ? 'Больше порций' : 'Увеличить количество'}
        disabled={current + step > 50}
        onClick={() => set(current + step)}
      >
        +
      </button>
      {factor !== 1 && (
        <button type="button" className="link" onClick={() => onChange(1)}>
          как в рецепте
        </button>
      )}
    </div>
  )
}
