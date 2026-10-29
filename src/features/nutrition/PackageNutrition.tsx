import { useEffect, useState, type FormEvent } from 'react'
import type { PantryApi, ReferenceNutrition } from '../pantry/types'
import { formatGrams, formatKcal } from './present'
import type { Macros, UserNutrition } from './types'

const STATE_LABEL: Record<ReferenceNutrition['state'], string> = {
  as_purchased: 'в исходном виде',
  cooked: 'после варки',
}

const WEIGHT_LABEL: Record<string, string> = {
  pcs: '1 шт.',
  clove: '1 зубчик',
  pack: '1 упаковка',
  bunch: '1 пучок',
}

const describeMacros = (m: Macros) =>
  `${formatKcal(m.kcal)} ккал, Б ${formatGrams(m.protein)}, Ж ${formatGrams(m.fat)}, У ${formatGrams(m.carbs)}`

/** Число ≥ 0 с запятой или точкой; '' → null (не указано); иначе undefined (ошибка). */
function parseNumber(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.')
  if (!t) return null
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined
  return Number(t)
}

const show = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : String(v).replace('.', ',')

/**
 * КБЖУ продукта: справочные значения (USDA) и свои данные с упаковки (B1).
 * Свои данные заменяют справочные во всех расчётах пользователя.
 */
export function PackageNutrition({
  api,
  ingredientId,
  productName,
  isOwn,
  saved,
  onChange,
}: {
  api: PantryApi
  ingredientId: number
  productName: string
  /** Свой продукт пользователя: справочных данных у него нет. */
  isOwn: boolean
  saved: UserNutrition | null
  onChange(next: UserNutrition | null): void
}) {
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState<ReferenceNutrition[] | null | 'error'>(null)

  useEffect(() => {
    if (!open || isOwn || reference !== null) return
    let cancelled = false
    api.loadReferenceNutrition(ingredientId).then(
      (r) => !cancelled && setReference(r),
      () => !cancelled && setReference('error'),
    )
    return () => {
      cancelled = true
    }
  }, [open, isOwn, reference, api, ingredientId])

  return (
    <details
      className="package-nutrition"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>КБЖУ и упаковка{saved ? ' — ваши данные' : ''}</summary>
      {!isOwn && <ReferenceView reference={reference} />}
      {isOwn && !saved && (
        <p className="muted small">
          Для своего продукта справочных данных нет — укажите их с упаковки.
        </p>
      )}
      <PackageForm
        api={api}
        ingredientId={ingredientId}
        productName={productName}
        saved={saved}
        onChange={onChange}
      />
    </details>
  )
}

function ReferenceView({ reference }: { reference: ReferenceNutrition[] | null | 'error' }) {
  if (reference === null) return <p aria-busy="true">Загрузка справочных данных…</p>
  if (reference === 'error')
    return <p className="error small">Справочные данные не загрузились — можно ввести свои.</p>
  if (reference.length === 0)
    return (
      <p className="muted small">
        В справочнике нет данных для этого продукта — расчёт КБЖУ без него неполный. Укажите их с
        упаковки.
      </p>
    )
  return (
    <div className="reference-nutrition small">
      <p>Справочник (USDA FoodData Central), на 100 г:</p>
      <ul>
        {reference.map((r) => (
          <li key={r.state}>
            {STATE_LABEL[r.state]}: {describeMacros(r.nutrition)}
            {r.nutrition.approximate && r.nutrition.note && (
              <span className="muted"> — приближённо: {r.nutrition.note}</span>
            )}
            {r.weights
              .filter((w) => WEIGHT_LABEL[w.unitCode])
              .map((w) => (
                <span key={w.unitCode} className="muted">
                  ; {WEIGHT_LABEL[w.unitCode]} ≈ {formatGrams(w.grams)} г
                </span>
              ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

function PackageForm({
  api,
  ingredientId,
  productName,
  saved,
  onChange,
}: {
  api: PantryApi
  ingredientId: number
  productName: string
  saved: UserNutrition | null
  onChange(next: UserNutrition | null): void
}) {
  const [brand, setBrand] = useState(saved?.brand ?? '')
  const [basis, setBasis] = useState<UserNutrition['basis']>(saved?.basis ?? '100g')
  const [values, setValues] = useState({
    kcal: show(saved?.kcal),
    protein: show(saved?.protein),
    fat: show(saved?.fat),
    carbs: show(saved?.carbs),
    packageGrams: show(saved?.packageGrams),
    pieceGrams: show(saved?.pieceGrams),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const parsed = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, parseNumber(v)]),
  ) as Record<keyof typeof values, number | null | undefined>
  const macrosReady = (['kcal', 'protein', 'fat', 'carbs'] as const).every(
    (k) => typeof parsed[k] === 'number',
  )
  const atwater = macrosReady ? 4 * parsed.protein! + 9 * parsed.fat! + 4 * parsed.carbs! : null
  const suspicious =
    atwater !== null && Math.abs(parsed.kcal! - atwater) > Math.max(0.15 * parsed.kcal!, 15)

  function validate(): string | null {
    if (!macrosReady) return 'Укажите калории, белки, жиры и углеводы — числа, например 2,5.'
    if (parsed.kcal! > 950) return 'Калорий не бывает больше 950 на 100 г или 100 мл.'
    if (basis === '100g' && parsed.protein! + parsed.fat! + parsed.carbs! > 100.5)
      return 'Белков, жиров и углеводов вместе не может быть больше 100 г на 100 г.'
    for (const k of ['packageGrams', 'pieceGrams'] as const)
      if (parsed[k] === undefined || parsed[k] === 0)
        return 'Масса упаковки и штуки — число граммов больше нуля, или оставьте пустым.'
    return null
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    const problem = validate()
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      const next = await api.saveUserNutrition({
        ingredientId,
        brand: brand.trim() || null,
        basis,
        kcal: parsed.kcal!,
        protein: parsed.protein!,
        fat: parsed.fat!,
        carbs: parsed.carbs!,
        packageGrams: parsed.packageGrams ?? null,
        pieceGrams: parsed.pieceGrams ?? null,
        note: null,
      })
      onChange(next)
      setMessage('Сохранено. Ваши данные используются во всех расчётах КБЖУ.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await api.deleteUserNutrition(ingredientId)
      onChange(null)
      setMessage('Ваши данные удалены — снова используются справочные.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof typeof values, label: string) => (
    <label className="inline-field">
      {label}
      <input
        inputMode="decimal"
        value={values[key]}
        aria-invalid={parsed[key] === undefined}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      />
    </label>
  )

  return (
    <form className="package-form" aria-label={`КБЖУ с упаковки: ${productName}`} onSubmit={submit}>
      <p className="small">Свои данные с упаковки — заменят справочные в ваших расчётах:</p>
      <label className="inline-field">
        Марка (необязательно)
        <input value={brand} maxLength={100} onChange={(e) => setBrand(e.target.value)} />
      </label>
      <fieldset className="segmented">
        <legend>Значения на упаковке указаны</legend>
        <label>
          <input type="radio" checked={basis === '100g'} onChange={() => setBasis('100g')} />
          на 100 г
        </label>
        <label>
          <input type="radio" checked={basis === '100ml'} onChange={() => setBasis('100ml')} />
          на 100 мл
        </label>
      </fieldset>
      <div className="filter-row">
        {field('kcal', 'Калории, ккал')}
        {field('protein', 'Белки, г')}
        {field('fat', 'Жиры, г')}
        {field('carbs', 'Углеводы, г')}
      </div>
      <div className="filter-row">
        {field('packageGrams', 'Масса упаковки, г')}
        {field('pieceGrams', 'Масса 1 шт., г')}
      </div>
      {suspicious && (
        <p className="note-missing small">
          Проверьте цифры: обычно калорийность ≈ 4·Б + 9·Ж + 4·У = {formatKcal(atwater!)} ккал.
          Сохранить всё равно можно.
        </p>
      )}
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success small" role="status">
          {message}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          Сохранить данные с упаковки
        </button>
        {saved && (
          <button type="button" className="danger" disabled={busy} onClick={() => void remove()}>
            Удалить мои данные
          </button>
        )}
      </div>
    </form>
  )
}
