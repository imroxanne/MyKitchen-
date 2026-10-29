import { useMemo, useState, type FormEvent } from 'react'
import { findExact, searchCatalog, type SearchHit } from './search'
import { KIND_TITLES, type Catalog, type ProductKind } from './types'

interface Props {
  catalog: Catalog
  /** id продуктов, которые уже есть в списках пользователя. */
  presentIds: Set<number>
  onAdd(ingredientIds: number[], kind: ProductKind): Promise<void>
  onCreateOwn(name: string, categorySlug: string, kind: ProductKind): Promise<void>
}

export function AddProducts({ catalog, presentIds, onAdd, onCreateOwn }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [kind, setKind] = useState<ProductKind>('current')
  const [ownCategory, setOwnCategory] = useState('other')
  const [ownOpen, setOwnOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  const hits: SearchHit[] = useMemo(() => {
    if (query.trim()) return searchCatalog(catalog.items, query)
    if (category)
      return catalog.items
        .filter((item) => item.categorySlug === category)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        .map((item) => ({ item, viaSynonym: null, score: 0 }))
    return []
  }, [catalog.items, query, category])

  const trimmed = query.trim()
  const canCreateOwn = trimmed.length > 0 && !findExact(catalog.items, trimmed)

  function toggle(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage({ text: success, error: false })
      setSelected(new Set())
      setQuery('')
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true })
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (selected.size === 0) return
    const count = selected.size
    run(() => onAdd([...selected], kind), `Добавлено: ${count} в «${KIND_TITLES[kind]}»`)
  }

  return (
    <form className="card add-products" onSubmit={submit} aria-labelledby="add-title">
      <h2 id="add-title">Добавить продукты</h2>

      <label className="search-field">
        <span className="visually-hidden">Найти продукт</span>
        <input
          type="search"
          placeholder="Найти продукт, например «помидор»"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOwnOpen(false)
          }}
          autoComplete="off"
          aria-label="Найти продукт"
        />
      </label>

      {!trimmed && (
        <div className="chips" role="group" aria-label="Категории">
          {catalog.categories.map((c) => (
            <button
              type="button"
              key={c.slug}
              className={category === c.slug ? 'chip chip-active' : 'chip'}
              aria-pressed={category === c.slug}
              onClick={() => setCategory(category === c.slug ? null : c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {(trimmed || category) && (
        <ul className="search-results" aria-label="Найденные продукты">
          {hits.length === 0 && <li className="muted">Ничего не найдено</li>}
          {hits.map(({ item, viaSynonym }) => {
            const present = presentIds.has(item.id)
            return (
              <li key={item.id}>
                <label className={present ? 'result result-present' : 'result'}>
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    disabled={present || busy}
                    onChange={() => toggle(item.id)}
                  />
                  <span>
                    {item.name}
                    {viaSynonym && <span className="muted"> ({viaSynonym})</span>}
                    {item.isOwn && <span className="badge">свой</span>}
                    {present && <span className="muted"> — уже в списке</span>}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {canCreateOwn && hits.length > 0 && !ownOpen && (
        <button type="button" className="link" onClick={() => setOwnOpen(true)}>
          Нет нужного? Добавить «{trimmed}» как свой продукт…
        </button>
      )}

      {canCreateOwn && (hits.length === 0 || ownOpen) && (
        <div className="own-product">
          <p className="muted">
            Нет в справочнике? Добавьте как свой продукт — его видите только вы.
          </p>
          <label>
            Категория
            <select value={ownCategory} onChange={(e) => setOwnCategory(e.target.value)}>
              {catalog.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => onCreateOwn(trimmed, ownCategory, kind),
                `«${trimmed}» добавлен в «${KIND_TITLES[kind]}»`,
              )
            }
          >
            Добавить «{trimmed}» как свой продукт
          </button>
        </div>
      )}

      <fieldset className="segmented">
        <legend>Куда добавить</legend>
        {(['current', 'staple'] as const).map((k) => (
          <label key={k}>
            <input
              type="radio"
              name="target-kind"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
            />
            {KIND_TITLES[k]}
          </label>
        ))}
      </fieldset>

      <button type="submit" className="primary" disabled={busy || selected.size === 0}>
        {busy ? 'Сохранение…' : `Добавить выбранные (${selected.size})`}
      </button>

      {message && (
        <p
          className={message.error ? 'error' : 'success'}
          role={message.error ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </form>
  )
}
