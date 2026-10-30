import { useEffect, useMemo, useState } from 'react'
import { NutritionBlock } from '../nutrition/NutritionBlock'
import type { NutritionSource, UserNutrition } from '../nutrition/types'
import { applyUserNutrition } from '../nutrition/userNutrition'
import { searchCatalog } from '../pantry/search'
import type { Catalog, CatalogItem, PantryApi } from '../pantry/types'
import { describeAmount, IMPORTANCE_LABEL } from '../recipes/present'
import type { RecipeDetail } from '../recipes/types'
import {
  addLine,
  diffWithOriginal,
  draftFromVersion,
  removeLine,
  replaceIngredient,
  rescaleDraft,
  sameDraft,
  updateLine,
  validateDraft,
  type LineChange,
  type PickedIngredient,
} from './draft'
import type { RecipeVersion, VersionDraft, VersionLine } from './types'

export const SAVED_MESSAGE = 'Версия сохранена. Оригинальный рецепт не изменился.'

/** Число > 0 с запятой или точкой; '' → null; иначе NaN (проверка перед сохранением). */
function parseAmount(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!t) return null
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN
}

const showNumber = (n: number | null) =>
  n === null || Number.isNaN(n) ? '' : String(n).replace('.', ',')

const CHANGE_LABEL = (c: LineChange | undefined): string | null => {
  if (!c || c.kind === 'same') return null
  if (c.kind === 'added') return 'добавлено'
  if (c.kind === 'replaced') return `заменено, было: ${c.was}`
  return `было: ${c.was}`
}

/**
 * Редактор своей версии рецепта (B2): количество и единица, замена, удаление и добавление
 * ингредиента, порции и масса готового блюда. КБЖУ пересчитывается сразу по черновику;
 * оригинал не меняется, версия сохраняется отдельно.
 */
export function VersionEditor({
  original,
  initial,
  saved,
  pantryApi,
  userNutrition,
  sources,
  onSave,
  onDelete,
  initialMessage = null,
}: {
  original: RecipeDetail
  /** Черновик при открытии: новая копия оригинала или сохранённая версия. */
  initial: VersionDraft
  /** Сохранённая версия (для «Отменить изменения»); null — версия ещё не сохранена. */
  saved: RecipeVersion | null
  pantryApi: PantryApi | null
  userNutrition: UserNutrition[]
  sources: NutritionSource[]
  onSave(draft: VersionDraft): Promise<void>
  onDelete(): Promise<void>
  /** Сообщение при открытии — например, после сохранения новой версии. */
  initialMessage?: string | null
}) {
  const [draft, setDraft] = useState<VersionDraft>(initial)
  const [quantityText, setQuantityText] = useState<Record<number, string>>({})
  const [servingsText, setServingsText] = useState(showNumber(initial.servings))
  const [yieldText, setYieldText] = useState(showNumber(initial.yieldGrams))
  const [rescale, setRescale] = useState(true)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [picker, setPicker] = useState<
    { mode: 'add' } | { mode: 'replace'; position: number } | null
  >(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(initialMessage)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!pantryApi) return
    let cancelled = false
    pantryApi.loadCatalog().then(
      (c) => !cancelled && setCatalog(c),
      () =>
        !cancelled &&
        setError('Справочник продуктов не загрузился — замена и добавление недоступны.'),
    )
    return () => {
      cancelled = true
    }
  }, [pantryApi])

  const diff = useMemo(
    () => diffWithOriginal(original.ingredients, draft, original.servings, original.yieldGrams),
    [original, draft],
  )
  const errors = validateDraft(draft)
  const dirty = saved ? !sameDraft(draftFromVersion(saved), draft) : true
  const units = catalog?.units ?? []
  const lines = applyUserNutrition(draft.ingredients, userNutrition)

  const change = (next: VersionDraft) => {
    setDraft(next)
    setMessage(null)
  }

  async function pick(item: CatalogItem) {
    if (!pantryApi || !picker) return
    setError(null)
    let picked: PickedIngredient
    try {
      const reference = await pantryApi.loadReferenceNutrition(item.id)
      const base = reference.find((r) => r.state === 'as_purchased')
      picked = {
        ingredientId: item.id,
        name: item.name,
        categorySlug: item.categorySlug,
        nutrition: base?.nutrition ?? null,
        unitWeights: base?.weights ?? [],
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return
    }
    if (picker.mode === 'replace') change(replaceIngredient(draft, picker.position, picked))
    else {
      const unit = units.find((u) => u.code === item.defaultUnit) ?? null
      change(
        addLine(
          draft,
          picked,
          unit && {
            code: unit.code,
            name: unit.name,
            kind: unit.kind,
            baseFactor: unit.baseFactor,
          },
        ),
      )
    }
    setPicker(null)
  }

  function setUnit(line: VersionLine, code: string) {
    const unit = units.find((u) => u.code === code)
    if (!unit) return
    const amountless = unit.kind === 'other'
    change(
      updateLine(draft, line.position, {
        unitCode: unit.code,
        unitName: unit.name,
        unitKind: unit.kind,
        unitBaseFactor: unit.baseFactor,
        ...(amountless && { quantity: null, quantityText: unit.name }),
      }),
    )
  }

  function setServings(text: string) {
    setServingsText(text)
    const value = parseAmount(text)
    if (value === null) return change({ ...draft, servings: null })
    if (Number.isNaN(value) || value <= 0) return change({ ...draft, servings: value })
    const next = rescale ? rescaleDraft(draft, value) : { ...draft, servings: value }
    change(next)
    // Пересчитанные количества показываем из черновика.
    if (rescale) setQuantityText({})
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await onSave(draft)
      setMessage(SAVED_MESSAGE)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card version-editor" aria-labelledby="version-title">
      <h2 id="version-title">Моя версия</h2>
      <p className="muted small">
        Изменения сохраняются отдельно — оригинальный рецепт остаётся как есть. КБЖУ ниже
        пересчитывается сразу.
      </p>

      <div className="filter-row">
        <label className="inline-field">
          Название версии
          <input
            value={draft.name}
            maxLength={100}
            onChange={(e) => change({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="inline-field">
          Порций
          <input
            inputMode="decimal"
            value={servingsText}
            aria-invalid={draft.servings !== null && !(draft.servings > 0)}
            onChange={(e) => setServings(e.target.value)}
          />
        </label>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={rescale} onChange={(e) => setRescale(e.target.checked)} />
        Пересчитывать количества при изменении порций
      </label>

      <ul className="version-lines" aria-label="Состав версии">
        {draft.ingredients.map((line) => {
          const note = CHANGE_LABEL(diff.byPosition.get(line.position))
          const mark = IMPORTANCE_LABEL[line.importance]
          const amountless = line.unitKind === 'other'
          return (
            <li key={`${line.position}-${line.ingredientId}`} className="version-line">
              <div className="version-line-name">
                <strong>{line.name}</strong>
                {mark && <span className="badge">{mark}</span>}
                {note && <span className="version-change small">{note}</span>}
              </div>
              <div className="version-line-controls">
                <label className="inline-field">
                  <span className="visually-hidden">Количество: {line.name}</span>
                  <input
                    inputMode="decimal"
                    aria-label={`Количество: ${line.name}`}
                    disabled={amountless}
                    placeholder={amountless ? '' : (line.quantityText ?? 'не указано')}
                    value={quantityText[line.position] ?? showNumber(line.quantity)}
                    aria-invalid={line.quantity !== null && !(line.quantity > 0)}
                    onChange={(e) => {
                      setQuantityText((t) => ({ ...t, [line.position]: e.target.value }))
                      change(
                        updateLine(draft, line.position, { quantity: parseAmount(e.target.value) }),
                      )
                    }}
                  />
                </label>
                <label className="inline-field">
                  <span className="visually-hidden">Единица: {line.name}</span>
                  <select
                    aria-label={`Единица: ${line.name}`}
                    value={line.unitCode ?? ''}
                    disabled={units.length === 0}
                    onChange={(e) => setUnit(line, e.target.value)}
                  >
                    {!line.unitCode && <option value="">—</option>}
                    {units.length === 0 && line.unitCode && (
                      <option value={line.unitCode}>{line.unitName ?? line.unitCode}</option>
                    )}
                    {units.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!catalog}
                  onClick={() => setPicker({ mode: 'replace', position: line.position })}
                >
                  Заменить
                </button>
                <button
                  type="button"
                  className="danger"
                  aria-label={`Убрать: ${line.name}`}
                  onClick={() => {
                    setQuantityText({})
                    change(removeLine(draft, line.position))
                  }}
                >
                  Убрать
                </button>
              </div>
              {picker?.mode === 'replace' && picker.position === line.position && catalog && (
                <IngredientPicker
                  catalog={catalog}
                  label={`Чем заменить «${line.name}»`}
                  onPick={(item) => void pick(item)}
                  onCancel={() => setPicker(null)}
                />
              )}
            </li>
          )
        })}
      </ul>

      {diff.removed.length > 0 && (
        <p className="small">
          Убрано из оригинала:{' '}
          {diff.removed.map((l, i) => (
            <span key={l.position}>
              {i > 0 && ', '}
              {l.name} ({describeAmount(l)}){' '}
              <button
                type="button"
                className="link"
                onClick={() =>
                  change({
                    ...draft,
                    ingredients: [
                      ...draft.ingredients,
                      {
                        ...l,
                        position: draft.ingredients.length + 1,
                        originalPosition: l.position,
                      },
                    ],
                  })
                }
              >
                вернуть
              </button>
            </span>
          ))}
        </p>
      )}

      {picker?.mode === 'add' && catalog ? (
        <IngredientPicker
          catalog={catalog}
          label="Какой продукт добавить"
          onPick={(item) => void pick(item)}
          onCancel={() => setPicker(null)}
        />
      ) : (
        <button type="button" disabled={!catalog} onClick={() => setPicker({ mode: 'add' })}>
          + Добавить ингредиент
        </button>
      )}

      <label className="inline-field">
        Масса готового блюда, г (если взвешивали)
        <input
          inputMode="decimal"
          value={yieldText}
          aria-invalid={draft.yieldGrams !== null && !(draft.yieldGrams > 0)}
          onChange={(e) => {
            setYieldText(e.target.value)
            change({ ...draft, yieldGrams: parseAmount(e.target.value) })
          }}
        />
      </label>

      {errors.length > 0 && (
        <ul className="error small" aria-label="Что исправить">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
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
      {dirty && !message && (
        <p className="muted small">
          {saved ? 'Есть несохранённые изменения.' : 'Версия ещё не сохранена.'}
        </p>
      )}

      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={busy || errors.length > 0 || !dirty}
          onClick={() => void save()}
        >
          Сохранить версию
        </button>
        {saved && dirty && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const reset = draftFromVersion(saved)
              setDraft(reset)
              setQuantityText({})
              setServingsText(showNumber(reset.servings))
              setYieldText(showNumber(reset.yieldGrams))
            }}
          >
            Отменить изменения
          </button>
        )}
        {confirmDelete ? (
          <span className="confirm">
            {saved ? 'Удалить версию?' : 'Отказаться от версии?'}{' '}
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                onDelete().catch((e: unknown) => {
                  setError(e instanceof Error ? e.message : String(e))
                  setBusy(false)
                })
              }}
            >
              Да
            </button>{' '}
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Нет
            </button>
          </span>
        ) : (
          <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
            {saved ? 'Удалить версию' : 'Отказаться'}
          </button>
        )}
      </div>

      <NutritionBlock
        lines={lines}
        servings={draft.servings}
        yieldGrams={draft.yieldGrams !== null && draft.yieldGrams > 0 ? draft.yieldGrams : null}
        sources={sources}
      />
    </section>
  )
}

/** Поиск продукта по названию и синонимам — для замены и добавления. */
export function IngredientPicker({
  catalog,
  label,
  onPick,
  onCancel,
}: {
  catalog: Catalog
  label: string
  onPick(item: CatalogItem): void
  onCancel(): void
}) {
  const [query, setQuery] = useState('')
  const hits = query.trim() ? searchCatalog(catalog.items, query, 8) : []
  return (
    <div className="ingredient-picker">
      <label className="inline-field">
        {label}
        <input
          type="search"
          autoFocus
          value={query}
          placeholder="Начните вводить название"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {hits.length > 0 && (
        <ul className="picker-results" aria-label="Найденные продукты">
          {hits.map((hit) => (
            <li key={hit.item.id}>
              <button type="button" className="link" onClick={() => onPick(hit.item)}>
                {hit.item.name}
                {hit.viaSynonym && <span className="muted"> ({hit.viaSynonym})</span>}
                {hit.item.isOwn && <span className="badge">свой</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && hits.length === 0 && <p className="muted small">Ничего не найдено.</p>}
      <button type="button" className="link" onClick={onCancel}>
        Отмена
      </button>
    </div>
  )
}
