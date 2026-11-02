import { useEffect, useState, type FormEvent } from 'react'
import type { Catalog, CatalogItem, PantryApi } from '../pantry/types'
import { IngredientPicker } from '../versions/VersionEditor'
import {
  KIND_LABEL,
  KINDS_WITH_EXCEPTIONS,
  RESTRICTION_KINDS,
  type RestrictionGroup,
  type RestrictionKind,
  type RestrictionReference,
  type RestrictionsApi,
  type UserRestriction,
} from './types'

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      reference: RestrictionReference
      catalog: Catalog
      restrictions: UserRestriction[]
    }

/** Быстрые наборы предпочтений: добавляются только недостающие группы. */
const PRESETS: { name: string; groups: string[] }[] = [
  { name: 'Вегетарианство', groups: ['meat', 'poultry', 'fish', 'crustaceans', 'molluscs'] },
  {
    name: 'Веганство',
    groups: ['meat', 'poultry', 'fish', 'crustaceans', 'molluscs', 'milk', 'eggs', 'honey'],
  },
]

/**
 * Пищевые ограничения в профиле (B4): аллергия, непереносимость, медицинское ограничение,
 * предпочтение — на группу продуктов или на конкретный продукт.
 */
export function RestrictionsSection({
  api,
  pantryApi,
}: {
  api: RestrictionsApi
  pantryApi: PantryApi
}) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.loadReference(), pantryApi.loadCatalog(), api.list()]).then(
      ([reference, catalog, restrictions]) =>
        !cancelled && setState({ status: 'ready', reference, catalog, restrictions }),
      (e: unknown) => !cancelled && setState({ status: 'error', message: errorText(e) }),
    )
    return () => {
      cancelled = true
    }
  }, [api, pantryApi, attempt])

  return (
    <section className="card restrictions" aria-labelledby="restrictions-title">
      <h2 id="restrictions-title">Пищевые ограничения</h2>
      <p className="small">
        Рецепты с запрещённым для вас продуктом не показываются в подборе, сомнительные — помечаются
        «проверьте». Продукты размечены по типичному составу: состав на упаковке важнее. MyKitchen
        не ставит диагнозов и не заменяет врача.
      </p>
      {state.status === 'loading' && <p aria-busy="true">Загрузка ограничений…</p>}
      {state.status === 'error' && (
        <div className="error" role="alert">
          <p>{state.message}</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: 'loading' })
              setAttempt((a) => a + 1)
            }}
          >
            Повторить
          </button>
        </div>
      )}
      {message && (
        <p className="success small" role="status">
          {message}
        </p>
      )}
      {state.status === 'ready' && (
        <Restrictions
          api={api}
          reference={state.reference}
          catalog={state.catalog}
          restrictions={state.restrictions}
          onChange={(restrictions, text) => {
            setState({ ...state, restrictions })
            setMessage(text)
          }}
        />
      )}
    </section>
  )
}

function targetName(
  r: Pick<UserRestriction, 'groupCode' | 'ingredientId'>,
  groups: RestrictionGroup[],
  catalog: Catalog,
): string {
  if (r.groupCode) return groups.find((g) => g.code === r.groupCode)?.name ?? r.groupCode
  return catalog.items.find((i) => i.id === r.ingredientId)?.name ?? 'Продукт'
}

function Restrictions({
  api,
  reference,
  catalog,
  restrictions,
  onChange,
}: {
  api: RestrictionsApi
  reference: RestrictionReference
  catalog: Catalog
  restrictions: UserRestriction[]
  onChange(restrictions: UserRestriction[], message: string): void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = (r: Pick<UserRestriction, 'groupCode' | 'ingredientId'>) =>
    targetName(r, reference.groups, catalog)

  async function run(action: () => Promise<UserRestriction[]>, text: string) {
    setBusy(true)
    setError(null)
    try {
      onChange(await action(), text)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const replace = (saved: UserRestriction) =>
    restrictions.map((r) => (r.id === saved.id ? saved : r))

  async function applyPreset(groups: string[], presetName: string) {
    const missing = groups.filter(
      (g) =>
        reference.groups.some((x) => x.code === g) && !restrictions.some((r) => r.groupCode === g),
    )
    await run(
      async () => {
        const added: UserRestriction[] = []
        for (const groupCode of missing)
          added.push(
            await api.add({ kind: 'preference', groupCode, ingredientId: null, note: presetName }),
          )
        return [...restrictions, ...added]
      },
      missing.length ? `Добавлено: ${presetName.toLowerCase()}.` : 'Эти группы уже есть в списке.',
    )
  }

  return (
    <>
      {restrictions.length === 0 ? (
        <p className="muted">Ограничений нет — подбор показывает все рецепты.</p>
      ) : (
        <ul className="restriction-list" aria-label="Ваши ограничения">
          {restrictions.map((r) => (
            <RestrictionItem
              key={r.id}
              restriction={r}
              name={name(r)}
              reference={reference}
              catalog={catalog}
              busy={busy}
              onKind={(kind) =>
                run(
                  async () => replace(await api.update(r.id, { kind, note: r.note })),
                  `${name(r)}: ${KIND_LABEL[kind].toLowerCase()}.`,
                )
              }
              onExceptions={(ids) =>
                run(
                  async () => replace(await api.setExceptions(r.id, ids)),
                  `${name(r)}: переносимые продукты сохранены.`,
                )
              }
              onRemove={() =>
                run(
                  async () => {
                    await api.remove(r.id)
                    return restrictions.filter((x) => x.id !== r.id)
                  },
                  `Ограничение «${name(r)}» удалено.`,
                )
              }
            />
          ))}
        </ul>
      )}
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
      <AddRestriction
        reference={reference}
        catalog={catalog}
        restrictions={restrictions}
        busy={busy}
        onAdd={(r) =>
          run(async () => [...restrictions, await api.add(r)], `Добавлено ограничение: ${name(r)}.`)
        }
      />
      <div className="actions" role="group" aria-label="Быстрые наборы">
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p.name}
            disabled={busy}
            onClick={() => void applyPreset(p.groups, p.name)}
          >
            + {p.name}
          </button>
        ))}
      </div>
    </>
  )
}

function RestrictionItem({
  restriction: r,
  name,
  reference,
  catalog,
  busy,
  onKind,
  onExceptions,
  onRemove,
}: {
  restriction: UserRestriction
  name: string
  reference: RestrictionReference
  catalog: Catalog
  busy: boolean
  onKind(kind: RestrictionKind): void
  onExceptions(ids: number[]): void
  onRemove(): void
}) {
  const [confirm, setConfirm] = useState(false)
  const canExcept = r.groupCode !== null && KINDS_WITH_EXCEPTIONS.includes(r.kind)
  return (
    <li className="restriction-item">
      <div className="restriction-head">
        <strong>{name}</strong>
        {r.ingredientId !== null && <span className="badge">продукт</span>}
        {r.note && <span className="muted small"> — {r.note}</span>}
      </div>
      <div className="actions">
        <label className="inline-field">
          <span className="visually-hidden">Вид ограничения: {name}</span>
          <select
            value={r.kind}
            disabled={busy}
            aria-label={`Вид ограничения: ${name}`}
            onChange={(e) => onKind(e.target.value as RestrictionKind)}
          >
            {RESTRICTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        {confirm ? (
          <>
            <span className="small">Удалить?</span>
            <button type="button" className="danger" disabled={busy} onClick={onRemove}>
              Да, удалить
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirm(false)}>
              Нет
            </button>
          </>
        ) : (
          <button type="button" aria-label={`Удалить: ${name}`} onClick={() => setConfirm(true)}>
            Удалить
          </button>
        )}
      </div>
      {canExcept && (
        <Exceptions
          restriction={r}
          name={name}
          reference={reference}
          catalog={catalog}
          busy={busy}
          onSave={onExceptions}
        />
      )}
      {r.groupCode && !canExcept && (
        <p className="muted small">
          При аллергии и медицинском ограничении переносимые продукты не отмечаются.
        </p>
      )}
    </li>
  )
}

/** Переносимые продукты группы — например, твёрдый сыр при непереносимости лактозы. */
function Exceptions({
  restriction: r,
  name,
  reference,
  catalog,
  busy,
  onSave,
}: {
  restriction: UserRestriction
  name: string
  reference: RestrictionReference
  catalog: Catalog
  busy: boolean
  onSave(ids: number[]): void
}) {
  const [selected, setSelected] = useState<number[]>(r.exceptions)
  const inGroup = catalog.items
    .filter((i) => reference.composition.get(i.id)?.groups.some((g) => g.code === r.groupCode))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  const changed = selected.join() !== r.exceptions.join()
  return (
    <details className="exceptions">
      <summary>
        Переношу{r.exceptions.length > 0 ? `: ${r.exceptions.length}` : ''} — отметить продукты
      </summary>
      <fieldset>
        <legend className="small">
          Продукты группы «{name}», которые вам подходят. Их рецепты не будут скрываться.
        </legend>
        <ul className="exceptions-list">
          {inGroup.map((item) => (
            <li key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, item.id].sort((a, b) => a - b)
                        : s.filter((id) => id !== item.id),
                    )
                  }
                />
                {item.name}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <button type="button" disabled={busy || !changed} onClick={() => onSave(selected)}>
        Сохранить переносимые
      </button>
    </details>
  )
}

function AddRestriction({
  reference,
  catalog,
  restrictions,
  busy,
  onAdd,
}: {
  reference: RestrictionReference
  catalog: Catalog
  restrictions: UserRestriction[]
  busy: boolean
  onAdd(r: {
    kind: RestrictionKind
    groupCode: string | null
    ingredientId: number | null
    note: string | null
  }): Promise<void>
}) {
  const [kind, setKind] = useState<RestrictionKind>('allergy')
  const [target, setTarget] = useState<'group' | 'product'>('group')
  const [groupCode, setGroupCode] = useState('')
  const [product, setProduct] = useState<CatalogItem | null>(null)
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const freeGroups = reference.groups.filter(
    (g) => !restrictions.some((r) => r.groupCode === g.code),
  )
  const description = reference.groups.find((g) => g.code === groupCode)?.description

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (target === 'group' && !groupCode) return setProblem('Выберите группу продуктов.')
    if (target === 'product' && !product) return setProblem('Выберите продукт.')
    if (target === 'product' && restrictions.some((r) => r.ingredientId === product!.id))
      return setProblem('Этот продукт уже в списке — измените вид ограничения там.')
    setProblem(null)
    await onAdd({
      kind,
      groupCode: target === 'group' ? groupCode : null,
      ingredientId: target === 'product' ? product!.id : null,
      note: note.trim() || null,
    })
    setGroupCode('')
    setProduct(null)
    setNote('')
  }

  return (
    <form className="add-restriction" aria-label="Добавить ограничение" onSubmit={submit}>
      <h3>Добавить ограничение</h3>
      <label className="inline-field">
        Вид
        <select value={kind} onChange={(e) => setKind(e.target.value as RestrictionKind)}>
          {RESTRICTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="segmented">
        <legend>На что</legend>
        <label>
          <input type="radio" checked={target === 'group'} onChange={() => setTarget('group')} />
          группа продуктов
        </label>
        <label>
          <input
            type="radio"
            checked={target === 'product'}
            onChange={() => setTarget('product')}
          />
          конкретный продукт
        </label>
      </fieldset>
      {target === 'group' ? (
        <>
          <label className="inline-field">
            Группа
            <select
              aria-label="Группа"
              value={groupCode}
              onChange={(e) => setGroupCode(e.target.value)}
            >
              <option value="">— выберите —</option>
              <optgroup label="Аллергены">
                {freeGroups
                  .filter((g) => g.kind === 'allergen')
                  .map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Образ питания">
                {freeGroups
                  .filter((g) => g.kind === 'diet')
                  .map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          {description && <p className="muted small">{description}</p>}
        </>
      ) : product ? (
        <p>
          <strong>{product.name}</strong>{' '}
          <button type="button" className="link" onClick={() => setProduct(null)}>
            другой продукт
          </button>
        </p>
      ) : (
        <IngredientPicker
          catalog={catalog}
          label="Продукт"
          onPick={setProduct}
          onCancel={() => setTarget('group')}
        />
      )}
      <label className="inline-field">
        Заметка (необязательно)
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      </label>
      {problem && (
        <p className="error small" role="alert">
          {problem}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          Добавить ограничение
        </button>
      </div>
    </form>
  )
}
