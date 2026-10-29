import { useState, type FormEvent } from 'react'
import { parseQuantity } from './format'
import {
  KIND_TITLES,
  type ProductKind,
  type ProductPatch,
  type Unit,
  type UserProduct,
} from './types'

interface Props {
  product: UserProduct
  productName: string
  defaultUnit: string | null
  units: Unit[]
  onSave(patch: ProductPatch): Promise<void>
  onDelete(): Promise<void>
  onClose(): void
}

export function ProductEditor({
  product,
  productName,
  defaultUnit,
  units,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [quantity, setQuantity] = useState(
    product.quantity === null ? '' : String(product.quantity).replace('.', ','),
  )
  const [unitCode, setUnitCode] = useState(product.unitCode ?? defaultUnit ?? 'g')
  const [expiresOn, setExpiresOn] = useState(product.expiresOn ?? '')
  const [kind, setKind] = useState<ProductKind>(product.kind)
  const [isExcluded, setIsExcluded] = useState(product.isExcluded)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Единицы «по вкусу»/«щепотка» не подходят для запасов.
  const stockUnits = units.filter((u) => u.kind !== 'other')

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseQuantity(quantity)
    if (parsed === undefined) {
      setError(
        'Количество — положительное число, например 2 или 0,5. Оставьте пустым, если не знаете.',
      )
      return
    }
    run(() =>
      onSave({
        quantity: parsed,
        unitCode: parsed === null ? null : unitCode,
        expiresOn: expiresOn || null,
        kind,
        isExcluded,
      }),
    )
  }

  const idPrefix = `product-${product.id}`

  return (
    <form className="editor" onSubmit={submit} aria-label={`Изменить: ${productName}`}>
      <div className="field-row">
        <label htmlFor={`${idPrefix}-qty`}>Количество</label>
        <div className="qty">
          <input
            id={`${idPrefix}-qty`}
            inputMode="decimal"
            placeholder="не знаю"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <select
            aria-label="Единица"
            value={unitCode}
            onChange={(e) => setUnitCode(e.target.value)}
          >
            {stockUnits.map((u) => (
              <option key={u.code} value={u.code}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row">
        <label htmlFor={`${idPrefix}-exp`}>Годен до</label>
        <input
          id={`${idPrefix}-exp`}
          type="date"
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
        />
      </div>

      <fieldset className="segmented">
        <legend>Группа</legend>
        {(['current', 'staple'] as const).map((k) => (
          <label key={k}>
            <input
              type="radio"
              name={`${idPrefix}-kind`}
              checked={kind === k}
              onChange={() => setKind(k)}
            />
            {KIND_TITLES[k]}
          </label>
        ))}
      </fieldset>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={isExcluded}
          onChange={(e) => setIsExcluded(e.target.checked)}
        />
        Не учитывать при подборе рецептов
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          Сохранить
        </button>
        <button type="button" onClick={onClose} disabled={busy}>
          Отмена
        </button>
        {confirmDelete ? (
          <span className="confirm">
            Удалить «{productName}»?{' '}
            <button type="button" className="danger" disabled={busy} onClick={() => run(onDelete)}>
              Да, удалить
            </button>{' '}
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Нет
            </button>
          </span>
        ) : (
          <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
            Удалить
          </button>
        )}
      </div>
    </form>
  )
}
