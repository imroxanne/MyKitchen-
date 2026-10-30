import { formatGrams, formatKcal } from '../nutrition/present'
import type { Macros } from '../nutrition/types'
import { eatenFromState, type EatenFormState } from './formState'
import { eatenMacros, validateEaten } from './logic'
import type { DiarySnapshot } from './types'
import { MEAL_LABEL, MEALS, type Meal } from './types'

/** «≈ 45 ккал · Б 2,3 г · Ж 0 г · У 7,5 г». */
export function MacrosLine({ macros, className }: { macros: Macros; className?: string }) {
  return (
    <span className={className}>
      {formatKcal(macros.kcal)} ккал · Б {formatGrams(macros.protein)} г · Ж{' '}
      {formatGrams(macros.fat)} г · У {formatGrams(macros.carbs)} г
    </span>
  )
}

const QUICK_SERVINGS = ['0,5', '1', '1,5', '2']

/**
 * Дата, время, приём пищи и сколько съедено — для новой записи и для правки.
 * КБЖУ съеденного пересчитывается сразу из снимка.
 */
export function EatenFields({
  snapshot,
  value,
  onChange,
}: {
  snapshot: DiarySnapshot
  value: EatenFormState
  onChange(next: EatenFormState): void
}) {
  const set = (patch: Partial<EatenFormState>) => onChange({ ...value, ...patch })
  const dish = snapshot.servingUnit === 'dish'
  const unit = snapshot.amountUnit === 'ml' ? 'мл' : 'г'
  const eaten = eatenFromState(value)
  const preview = validateEaten(eaten) ? null : eatenMacros(snapshot, eaten)
  const canServings = snapshot.baseServings !== null
  const canAmount = snapshot.baseAmount !== null
  return (
    <>
      <div className="filter-row">
        <label className="inline-field">
          Дата
          <input
            type="date"
            required
            value={value.eatenOn}
            onChange={(e) => set({ eatenOn: e.target.value })}
          />
        </label>
        <label className="inline-field">
          Время
          <input
            type="time"
            value={value.eatenTime}
            onChange={(e) => set({ eatenTime: e.target.value })}
          />
        </label>
        <label className="inline-field">
          Приём пищи
          <select value={value.meal} onChange={(e) => set({ meal: e.target.value as Meal })}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {canServings && canAmount && (
        <fieldset className="segmented">
          <legend>Сколько съели</legend>
          <label>
            <input
              type="radio"
              checked={value.mode === 'servings'}
              onChange={() => set({ mode: 'servings', amountText: '1' })}
            />
            {dish ? 'часть блюда' : 'порции'}
          </label>
          <label>
            <input
              type="radio"
              checked={value.mode === 'amount'}
              onChange={() => set({ mode: 'amount', amountText: '' })}
            />
            граммы
          </label>
        </fieldset>
      )}

      <div className="filter-row eaten-amount">
        <label className="inline-field">
          {value.mode === 'servings'
            ? dish
              ? 'Доля блюда (1 — всё блюдо)'
              : 'Порций'
            : `Масса, ${unit}`}
          <input
            inputMode="decimal"
            value={value.amountText}
            aria-invalid={validateEaten(eaten) !== null && value.amountText.trim() !== ''}
            onChange={(e) => set({ amountText: e.target.value })}
          />
        </label>
        {value.mode === 'servings' && (
          <div className="quick-amounts" role="group" aria-label="Быстрый выбор">
            {QUICK_SERVINGS.map((q) => (
              <button
                type="button"
                key={q}
                aria-pressed={value.amountText === q}
                onClick={() => set({ amountText: q })}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
      {value.mode === 'servings' && dish && (
        <p className="muted small">
          В рецепте не указано число порций — укажите, какую часть блюда съели: 0,5 — половину.
        </p>
      )}

      <p className="eaten-preview" aria-live="polite">
        Съедено:{' '}
        {preview ? (
          <MacrosLine macros={preview} />
        ) : (
          <span className="muted">укажите количество</span>
        )}
      </p>
      {snapshot.incomplete && (
        <p className="note-missing small">
          Расчёт блюда неполный: часть продуктов не учтена — фактически калорий больше.
        </p>
      )}

      <label className="inline-field">
        Заметка (необязательно)
        <input value={value.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} />
      </label>
    </>
  )
}
