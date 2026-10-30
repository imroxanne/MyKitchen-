import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { usePantryApi } from '../matching/usePantry'
import { formatKcal } from '../nutrition/present'
import type { PantryApi } from '../pantry/types'
import { AddWithoutRecipe } from './AddWithoutRecipe'
import { EatenFields, MacrosLine } from './EatenFields'
import { formStateFromEntry, readForm } from './formState'
import { daySummary, describeEaten, isValidDate, localDate, shiftDate } from './logic'
import { sortDay } from './supabaseApi'
import type { DiaryApi, DiaryEntry } from './types'
import { MEAL_LABEL } from './types'
import { useDiaryApi } from './useDiaryApi'

export function DiaryPage({
  api,
  pantryApi,
  now,
}: {
  api?: DiaryApi
  pantryApi?: PantryApi
  /** «Сейчас» — для тестов. */
  now?: Date
}) {
  const diary = useDiaryApi(api)
  const pantry = usePantryApi(pantryApi)
  // «Сегодня» — на момент открытия страницы.
  const [today] = useState(() => now ?? new Date())
  return (
    <section aria-labelledby="diary-title">
      <h1 id="diary-title">Дневник питания</h1>
      <RequireAuth>{diary && <DiaryDay api={diary} pantryApi={pantry} now={today} />}</RequireAuth>
    </section>
  )
}

const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return dayFormat.format(new Date(y!, m! - 1, d!))
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: DiaryEntry[] }

function DiaryDay({
  api,
  pantryApi,
  now,
}: {
  api: DiaryApi
  pantryApi: PantryApi | null
  now: Date
}) {
  const today = localDate(now)
  const [params, setParams] = useSearchParams()
  const requested = params.get('date')
  const date = isValidDate(requested) ? requested : today
  // Загруженный день; пока загружается другой — «загрузка». Повтор после ошибки — attempt.
  const [loaded, setLoaded] = useState<{ date: string; attempt: number; state: State } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const state: State =
    loaded?.date === date && loaded.attempt === attempt ? loaded.state : { status: 'loading' }
  const [message, setMessage] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // День — в адресе: «назад» возвращает к прежнему дню, ссылку можно открыть заново.
  const go = (next: string) => {
    setMessage(null)
    setAdding(false)
    setParams(next === today ? {} : { date: next })
  }

  useEffect(() => {
    let cancelled = false
    const done = (next: State) => !cancelled && setLoaded({ date, attempt, state: next })
    api.listDay(date).then(
      (entries) => done({ status: 'ready', entries }),
      (e: unknown) =>
        done({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
    )
    return () => {
      cancelled = true
    }
  }, [api, date, attempt])

  const update = (fn: (entries: DiaryEntry[]) => DiaryEntry[]) =>
    setLoaded((l) =>
      l && l.state.status === 'ready'
        ? { ...l, state: { ...l.state, entries: sortDay(fn(l.state.entries)) } }
        : l,
    )

  return (
    <>
      <nav className="day-nav" aria-label="Выбор дня">
        <button
          type="button"
          aria-label="Предыдущий день"
          title="Предыдущий день"
          onClick={() => go(shiftDate(date, -1))}
        >
          ←
        </button>
        <label className="day-picker">
          <span className="visually-hidden">День</span>
          <input
            type="date"
            value={date}
            onChange={(e) => isValidDate(e.target.value) && go(e.target.value)}
          />
        </label>
        <button
          type="button"
          aria-label="Следующий день"
          title="Следующий день"
          onClick={() => go(shiftDate(date, 1))}
        >
          →
        </button>
        {date !== today && (
          <button type="button" className="link" onClick={() => go(today)}>
            Сегодня
          </button>
        )}
      </nav>
      <h2 className="day-title">
        {date === today ? 'Сегодня, ' : ''}
        {formatDay(date)}
      </h2>

      {message && (
        <p className="success small" role="status">
          {message}
        </p>
      )}

      {state.status === 'loading' && <p aria-busy="true">Загрузка дневника…</p>}
      {state.status === 'error' && (
        <div className="error" role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)}>
            Повторить
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <DayEntries
          api={api}
          entries={state.entries}
          onChanged={(entry, text) => {
            setMessage(text)
            update((list) =>
              entry.eatenOn === date
                ? list.map((e) => (e.id === entry.id ? entry : e))
                : list.filter((e) => e.id !== entry.id),
            )
          }}
          onDeleted={(entry) => {
            setMessage(`Запись «${entry.title}» удалена.`)
            update((list) => list.filter((e) => e.id !== entry.id))
          }}
        />
      )}

      {state.status === 'ready' &&
        (adding ? (
          <AddWithoutRecipe
            api={api}
            pantryApi={pantryApi}
            date={date}
            now={now}
            onCancel={() => setAdding(false)}
            onSaved={(entry) => {
              setAdding(false)
              setMessage(
                `Записано: ${entry.title}, ${describeEaten(entry)}` +
                  (entry.eatenOn === date ? '.' : ` — на ${formatDay(entry.eatenOn)}.`),
              )
              if (entry.eatenOn === date) update((list) => [...list, entry])
            }}
          />
        ) : (
          <p>
            <button
              type="button"
              onClick={() => {
                setMessage(null)
                setAdding(true)
              }}
            >
              + Продукт или блюдо без рецепта
            </button>
          </p>
        ))}
    </>
  )
}

function DayEntries({
  api,
  entries,
  onChanged,
  onDeleted,
}: {
  api: DiaryApi
  entries: DiaryEntry[]
  onChanged(entry: DiaryEntry, message: string): void
  onDeleted(entry: DiaryEntry): void
}) {
  if (entries.length === 0)
    return (
      <p className="muted">
        За этот день записей нет. Блюдо по рецепту записывается кнопкой «Съедено» на странице
        рецепта; продукт или покупное блюдо — ниже.
      </p>
    )
  const summary = daySummary(entries)
  return (
    <>
      <section className="card day-total" aria-labelledby="day-total-title">
        <h3 id="day-total-title">Итого за день</h3>
        <p>
          <MacrosLine macros={summary.total} className="macros-total" />
        </p>
        {summary.incomplete && (
          <p className="note-missing small">
            Часть записей посчитана неполно (не все продукты учтены) — фактически калорий больше.
          </p>
        )}
        <p className="muted small">КБЖУ ориентировочные: расчёт по ингредиентам и справочнику.</p>
      </section>
      {summary.meals.map((group) => (
        <section key={group.meal} className="meal" aria-labelledby={`meal-${group.meal}`}>
          <h3 id={`meal-${group.meal}`}>
            {MEAL_LABEL[group.meal]}{' '}
            <span className="muted small">{formatKcal(group.total.kcal)} ккал</span>
          </h3>
          <ul className="diary-entries">
            {group.entries.map((entry) => (
              <EntryItem
                key={entry.id}
                api={api}
                entry={entry}
                onChanged={onChanged}
                onDeleted={onDeleted}
              />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

function recipeLink(entry: DiaryEntry): string | null {
  if (entry.recipeId === null) return null
  return `/recipes/${entry.recipeId}${entry.versionId ? `?version=${entry.versionId}` : ''}`
}

function EntryItem({
  api,
  entry,
  onChanged,
  onDeleted,
}: {
  api: DiaryApi
  entry: DiaryEntry
  onChanged(entry: DiaryEntry, message: string): void
  onDeleted(entry: DiaryEntry): void
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const link = recipeLink(entry)

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await api.remove(entry.id)
      onDeleted(entry)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (mode === 'edit')
    return (
      <li className="diary-entry">
        <EntryEditor
          api={api}
          entry={entry}
          onCancel={() => setMode('view')}
          onSaved={(saved) => {
            setMode('view')
            onChanged(
              saved,
              saved.eatenOn === entry.eatenOn
                ? 'Запись изменена.'
                : `Запись перенесена на ${formatDay(saved.eatenOn)}.`,
            )
          }}
        />
      </li>
    )

  return (
    <li className="diary-entry">
      <div className="diary-entry-head">
        <span>
          {link ? <Link to={link}>{entry.title}</Link> : entry.title}
          {entry.eatenTime && <span className="muted small"> · {entry.eatenTime}</span>}
        </span>
        <span className="amount">{describeEaten(entry)}</span>
      </div>
      <p className="small">
        <MacrosLine macros={entry.eaten} />
        {entry.incomplete && <span className="badge">расчёт неполный</span>}
      </p>
      {entry.note && <p className="muted small">{entry.note}</p>}
      {entry.composition.length > 0 && (
        <details className="small">
          <summary>Состав на момент записи</summary>
          <ul>
            {entry.composition.map((c, i) => (
              <li key={i}>
                {c.name}
                {c.amount && <span className="muted"> — {c.amount}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
      {mode === 'confirm-delete' ? (
        <div className="actions" role="group" aria-label={`Удалить запись «${entry.title}»?`}>
          <span className="small">Удалить запись?</span>
          <button type="button" className="danger" disabled={busy} onClick={() => void remove()}>
            Да, удалить
          </button>
          <button type="button" disabled={busy} onClick={() => setMode('view')}>
            Нет
          </button>
        </div>
      ) : (
        <div className="actions">
          <button
            type="button"
            aria-label={`Изменить: ${entry.title}`}
            onClick={() => setMode('edit')}
          >
            Изменить
          </button>
          <button
            type="button"
            aria-label={`Удалить: ${entry.title}`}
            onClick={() => setMode('confirm-delete')}
          >
            Удалить
          </button>
        </div>
      )}
    </li>
  )
}

/** Правка записи: дата, время, приём пищи, количество, название, заметка. Снимок не меняется. */
function EntryEditor({
  api,
  entry,
  onSaved,
  onCancel,
}: {
  api: DiaryApi
  entry: DiaryEntry
  onSaved(entry: DiaryEntry): void
  onCancel(): void
}) {
  const [state, setState] = useState(() => formStateFromEntry(entry))
  const [title, setTitle] = useState(entry.title)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const { fields, error: problem } = readForm(state)
    if (!fields) return setError(problem)
    if (!title.trim()) return setError('Укажите название.')
    setBusy(true)
    setError(null)
    try {
      onSaved(await api.update(entry.id, { ...fields, title }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <form className="entry-editor" aria-label={`Изменить запись: ${entry.title}`} onSubmit={submit}>
      <label className="inline-field">
        Название
        <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <EatenFields snapshot={entry} value={state} onChange={setState} />
      <p className="muted small">
        Состав и КБЖУ блюда сохранены на момент записи и не меняются; меняется только количество.
      </p>
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          Сохранить
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
