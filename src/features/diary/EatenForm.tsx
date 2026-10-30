import { useState, type FormEvent } from 'react'
import { EatenFields } from './EatenFields'
import { newFormState, readForm, type EatenFormState } from './formState'
import type { DiaryApi, DiaryEntry, DiarySnapshot } from './types'

/**
 * Подтверждение «Съедено»: дата, время, приём пищи и сколько съедено. В дневник уходит снимок
 * состава и КБЖУ — последующие правки рецепта запись не меняют.
 */
export function EatenForm({
  api,
  snapshot,
  variantName,
  onSaved,
  onCancel,
  now,
}: {
  api: DiaryApi
  snapshot: DiarySnapshot
  /** «Оригинал» или название своей версии — что именно записывается. */
  variantName: string
  onSaved(entry: DiaryEntry): void
  onCancel(): void
  /** «Сейчас» — для тестов. */
  now?: Date
}) {
  const [state, setState] = useState<EatenFormState>(() =>
    newFormState(snapshot, now ?? new Date()),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
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

  return (
    <form className="card eaten-form" aria-label="Записать как съеденное" onSubmit={submit}>
      <h2>Съедено</h2>
      <p className="small">
        {snapshot.title} — <strong>{variantName}</strong>. В дневник сохранятся состав и КБЖУ
        такими, как сейчас: последующие изменения рецепта запись не изменят.
      </p>
      <EatenFields snapshot={snapshot} value={state} onChange={setState} />
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          Записать в дневник
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
