import { useEffect, useState, type FormEvent } from 'react'
import { formatGrams, formatKcal } from '../nutrition/present'
import type { Macros } from '../nutrition/types'
import type { Catalog, CatalogItem, PantryApi } from '../pantry/types'
import { IngredientPicker } from '../versions/VersionEditor'
import { EatenFields } from './EatenFields'
import { newFormState, readForm, type EatenFormState } from './formState'
import { localDate, parseDecimal, snapshotFromCustom, snapshotFromProduct } from './logic'
import type { DiaryApi, DiaryEntry, DiarySnapshot } from './types'

/** Откуда взять КБЖУ продукта: ваши данные с упаковки или справочник (в исходном виде/после варки). */
interface ProductOption {
  key: string
  label: string
  per100: Macros
  unit: 'g' | 'ml'
  /** Уточнение в названии записи: «после варки». */
  suffix: string
}

const describe = (m: Macros) =>
  `${formatKcal(m.kcal)} ккал, Б ${formatGrams(m.protein)}, Ж ${formatGrams(m.fat)}, У ${formatGrams(m.carbs)}`

/**
 * Запись без рецепта (ТЗ §10): продукт из справочника или своё блюдо — например, покупное —
 * с КБЖУ с упаковки.
 */
export function AddWithoutRecipe({
  api,
  pantryApi,
  date,
  now,
  onSaved,
  onCancel,
}: {
  api: DiaryApi
  pantryApi: PantryApi | null
  /** День, открытый в дневнике: запись по умолчанию — на него. */
  date: string
  now: Date
  onSaved(entry: DiaryEntry): void
  onCancel(): void
}) {
  const [kind, setKind] = useState<'product' | 'custom'>('product')
  // Запись на открытый день; время — только если это сегодня.
  const start = (snapshot: DiarySnapshot): EatenFormState => ({
    ...newFormState(snapshot, now),
    eatenOn: date,
    ...(date === localDate(now) ? {} : { eatenTime: '' }),
  })
  return (
    <section className="card add-entry" aria-labelledby="add-entry-title">
      <h2 id="add-entry-title">Записать без рецепта</h2>
      <fieldset className="segmented">
        <legend>Что записать</legend>
        <label>
          <input type="radio" checked={kind === 'product'} onChange={() => setKind('product')} />
          продукт из справочника
        </label>
        <label>
          <input type="radio" checked={kind === 'custom'} onChange={() => setKind('custom')} />
          своё блюдо (например, покупное)
        </label>
      </fieldset>
      {kind === 'product' ? (
        <ProductEntry
          api={api}
          pantryApi={pantryApi}
          start={start}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      ) : (
        <CustomEntry api={api} start={start} onSaved={onSaved} onCancel={onCancel} />
      )}
    </section>
  )
}

function SaveButtons({ busy, onCancel }: { busy: boolean; onCancel(): void }) {
  return (
    <div className="actions">
      <button type="submit" className="primary" disabled={busy}>
        Записать в дневник
      </button>
      <button type="button" disabled={busy} onClick={onCancel}>
        Отмена
      </button>
    </div>
  )
}

function useSave(api: DiaryApi, onSaved: (entry: DiaryEntry) => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async (snapshot: DiarySnapshot, state: EatenFormState) => {
    const { fields, error: problem } = readForm(state)
    if (!fields) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      onSaved(await api.add({ ...snapshot, ...fields }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }
  return { busy, error, setError, save }
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p className="error small" role="alert">
      {error}
    </p>
  ) : null
}

function ProductEntry({
  api,
  pantryApi,
  start,
  onSaved,
  onCancel,
}: {
  api: DiaryApi
  pantryApi: PantryApi | null
  start(snapshot: DiarySnapshot): EatenFormState
  onSaved(entry: DiaryEntry): void
  onCancel(): void
}) {
  const [catalog, setCatalog] = useState<Catalog | 'error' | null>(null)
  const [picked, setPicked] = useState<CatalogItem | null>(null)
  const [options, setOptions] = useState<ProductOption[] | 'error' | null>(null)
  const [choice, setChoice] = useState<string | null>(null)
  const [state, setState] = useState<EatenFormState | null>(null)
  const { busy, error, save } = useSave(api, onSaved)

  useEffect(() => {
    if (!pantryApi) return
    let cancelled = false
    pantryApi.loadCatalog().then(
      (c) => !cancelled && setCatalog(c),
      () => !cancelled && setCatalog('error'),
    )
    return () => {
      cancelled = true
    }
  }, [pantryApi])

  async function pick(item: CatalogItem) {
    if (!pantryApi) return
    setPicked(item)
    setOptions(null)
    try {
      const [own, reference] = await Promise.all([
        pantryApi.listUserNutrition(),
        item.isOwn ? Promise.resolve([]) : pantryApi.loadReferenceNutrition(item.id),
      ])
      const mine = own.find((n) => n.ingredientId === item.id)
      const list: ProductOption[] = [
        ...(mine
          ? [
              {
                key: 'package',
                label: `ваши данные с упаковки${mine.brand ? ` (${mine.brand})` : ''}`,
                per100: mine,
                unit: mine.basis === '100ml' ? ('ml' as const) : ('g' as const),
                suffix: '',
              },
            ]
          : []),
        ...reference.map((r) => ({
          key: r.state,
          label: r.state === 'cooked' ? 'справочник: после варки' : 'справочник: в исходном виде',
          per100: r.nutrition,
          unit: 'g' as const,
          suffix: r.state === 'cooked' ? ' (после варки)' : '',
        })),
      ]
      setOptions(list)
      const first = list[0]
      setChoice(first?.key ?? null)
      if (first) setState(start(snapshotOf(item, first)))
    } catch {
      setOptions('error')
    }
  }

  const snapshotOf = (item: CatalogItem, option: ProductOption) =>
    snapshotFromProduct({
      ingredientId: item.id,
      title: item.name + option.suffix,
      per100: option.per100,
      unit: option.unit,
    })

  if (!pantryApi) return <p className="muted">Справочник продуктов недоступен.</p>
  if (catalog === 'error')
    return <p className="error small">Справочник продуктов не загрузился. Попробуйте позже.</p>
  if (catalog === null) return <p aria-busy="true">Загрузка справочника…</p>

  if (!picked)
    return (
      <IngredientPicker
        catalog={catalog}
        label="Продукт"
        onPick={(item) => void pick(item)}
        onCancel={onCancel}
      />
    )

  const option = Array.isArray(options) ? options.find((o) => o.key === choice) : undefined
  const snapshot = option ? snapshotOf(picked, option) : null
  return (
    <form
      aria-label={`Записать продукт: ${picked.name}`}
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        if (snapshot && state) void save(snapshot, state)
      }}
    >
      <p>
        <strong>{picked.name}</strong>{' '}
        <button
          type="button"
          className="link"
          onClick={() => {
            setPicked(null)
            setState(null)
          }}
        >
          другой продукт
        </button>
      </p>
      {options === null && <p aria-busy="true">Загрузка данных о составе…</p>}
      {options === 'error' && (
        <p className="error small">Данные о составе не загрузились. Попробуйте ещё раз.</p>
      )}
      {Array.isArray(options) && options.length === 0 && (
        <p className="note-missing small">
          Для этого продукта нет данных о КБЖУ. Укажите их с упаковки в разделе «Мои продукты» или
          запишите как своё блюдо.
        </p>
      )}
      {Array.isArray(options) && options.length > 1 && (
        <fieldset className="segmented">
          <legend>КБЖУ на 100 г (мл)</legend>
          {options.map((o) => (
            <label key={o.key}>
              <input
                type="radio"
                checked={choice === o.key}
                onChange={() => {
                  setChoice(o.key)
                  // Единица (г или мл) могла смениться — количество вводится заново.
                  setState(start(snapshotOf(picked, o)))
                }}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      )}
      {option && (
        <p className="muted small">
          На 100 {option.unit === 'ml' ? 'мл' : 'г'}: {describe(option.per100)}.
        </p>
      )}
      {snapshot && state && (
        <>
          <EatenFields snapshot={snapshot} value={state} onChange={setState} />
          <ErrorText error={error} />
          <SaveButtons busy={busy} onCancel={onCancel} />
        </>
      )}
      {!snapshot && (
        <div className="actions">
          <button type="button" onClick={onCancel}>
            Отмена
          </button>
        </div>
      )}
    </form>
  )
}

const MACRO_FIELDS: { key: keyof Macros; label: string }[] = [
  { key: 'kcal', label: 'Калории, ккал' },
  { key: 'protein', label: 'Белки, г' },
  { key: 'fat', label: 'Жиры, г' },
  { key: 'carbs', label: 'Углеводы, г' },
]

function CustomEntry({
  api,
  start,
  onSaved,
  onCancel,
}: {
  api: DiaryApi
  start(snapshot: DiarySnapshot): EatenFormState
  onSaved(entry: DiaryEntry): void
  onCancel(): void
}) {
  const [title, setTitle] = useState('')
  const [per, setPer] = useState<'100g' | 'portion'>('100g')
  const [values, setValues] = useState<Record<keyof Macros, string>>({
    kcal: '',
    protein: '',
    fat: '',
    carbs: '',
  })
  const parsed = Object.fromEntries(
    MACRO_FIELDS.map(({ key }) => [key, parseDecimal(values[key])]),
  ) as Record<keyof Macros, number | null>
  const ready = MACRO_FIELDS.every(({ key }) => Number.isFinite(parsed[key]))
  const snapshot = snapshotFromCustom({
    title: title.trim() || 'Своё блюдо',
    per,
    macros: ready ? (parsed as Macros) : { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  })
  const [state, setState] = useState(() => start(snapshot))
  const { busy, error, setError, save } = useSave(api, onSaved)

  function problem(): string | null {
    if (!title.trim()) return 'Укажите название — например, «Сырники из кулинарии».'
    if (!ready) return 'Укажите калории, белки, жиры и углеводы — числа, например 2,5.'
    if (per === '100g' && parsed.kcal! > 950) return 'Калорий не бывает больше 950 на 100 г.'
    if (per === '100g' && parsed.protein! + parsed.fat! + parsed.carbs! > 100.5)
      return 'Белков, жиров и углеводов вместе не может быть больше 100 г на 100 г.'
    return null
  }

  return (
    <form
      aria-label="Записать своё блюдо"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        const p = problem()
        if (p) return setError(p)
        void save(snapshot, state)
      }}
    >
      <label className="inline-field">
        Название
        <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <fieldset className="segmented">
        <legend>КБЖУ с упаковки указаны</legend>
        <label>
          <input
            type="radio"
            checked={per === '100g'}
            onChange={() => {
              setPer('100g')
              setState((s) => ({ ...s, mode: 'amount', amountText: '' }))
            }}
          />
          на 100 г
        </label>
        <label>
          <input
            type="radio"
            checked={per === 'portion'}
            onChange={() => {
              setPer('portion')
              setState((s) => ({ ...s, mode: 'servings', amountText: '1' }))
            }}
          />
          на 1 порцию (штуку, упаковку)
        </label>
      </fieldset>
      <div className="filter-row">
        {MACRO_FIELDS.map(({ key, label }) => (
          <label className="inline-field" key={key}>
            {label}
            <input
              inputMode="decimal"
              value={values[key]}
              aria-invalid={Number.isNaN(parsed[key])}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <EatenFields snapshot={snapshot} value={state} onChange={setState} />
      <ErrorText error={error} />
      <SaveButtons busy={busy} onCancel={onCancel} />
    </form>
  )
}
