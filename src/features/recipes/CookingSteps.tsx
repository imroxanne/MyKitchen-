import { useEffect, useState } from 'react'
import { formatMinutes } from './present'
import type { RecipeStep } from './types'

// Отметки шагов живут только в этой вкладке: переживают случайную перезагрузку страницы,
// но не попадают ни в базу, ни на другие устройства.
const storageKey = (recipeId: number) => `mykitchen:steps:${recipeId}`

function loadDone(recipeId: number): number[] {
  try {
    const raw = sessionStorage.getItem(storageKey(recipeId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

function saveDone(recipeId: number, done: number[]) {
  try {
    if (done.length) sessionStorage.setItem(storageKey(recipeId), JSON.stringify(done))
    else sessionStorage.removeItem(storageKey(recipeId))
  } catch {
    // Хранилище недоступно (приватный режим) — отметки просто не сохранятся.
  }
}

export function CookingSteps({ recipeId, steps }: { recipeId: number; steps: RecipeStep[] }) {
  const [done, setDone] = useState<number[]>(() => loadDone(recipeId))
  const update = (next: number[]) => {
    setDone(next)
    saveDone(recipeId, next)
  }
  const doneCount = steps.filter((s) => done.includes(s.position)).length

  return (
    <section className="card" aria-labelledby="steps-title">
      <h2 id="steps-title">Приготовление</h2>
      <p className="muted small">Отмечайте выполненные шаги, чтобы не сбиться.</p>
      <ol className="steps">
        {steps.map((step) => {
          const checked = done.includes(step.position)
          return (
            <li key={step.position} className={checked ? 'step step-done' : 'step'}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    update(
                      checked ? done.filter((p) => p !== step.position) : [...done, step.position],
                    )
                  }
                />
                <span>
                  {step.instruction}
                  {step.durationMinutes !== null && (
                    <span className="muted small"> ({formatMinutes(step.durationMinutes)})</span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ol>
      <div className="steps-footer">
        <span className="muted small" aria-live="polite">
          Выполнено шагов: {doneCount} из {steps.length}
        </span>
        {doneCount > 0 && (
          <button type="button" className="link" onClick={() => update([])}>
            Сбросить отметки
          </button>
        )}
      </div>
      <KeepScreenOn />
    </section>
  )
}

/** «Не выключать экран» через Screen Wake Lock; где браузер не умеет — переключателя нет. */
function KeepScreenOn() {
  const [on, setOn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!on) return
    let cancelled = false
    let sentinel: WakeLockSentinel | null = null
    const request = () =>
      navigator.wakeLock.request('screen').then(
        (s) => {
          if (cancelled) void s.release()
          else sentinel = s
        },
        () => {
          if (cancelled) return
          setOn(false)
          setError('Браузер не разрешил оставить экран включённым.')
        },
      )
    // Браузер снимает блокировку, когда вкладка скрыта; при возврате — запрашиваем снова.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) request()
    }
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [on])

  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return null
  return (
    <>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setError(null)
            setOn(e.target.checked)
          }}
        />
        Не выключать экран, пока готовлю
      </label>
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
