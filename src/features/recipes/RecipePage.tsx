import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import {
  indexPantry,
  ingredientAvailability,
  isRequired,
  matchRecipe,
  type Availability,
  type PantryIndex,
} from '../matching/match'
import { loadPantry, usePantryApi } from '../matching/usePantry'
import type { PantryApi } from '../pantry/types'
import {
  describeAmount,
  describeServings,
  describeTime,
  formatDate,
  formatMinutes,
  IMPORTANCE_LABEL,
  RIGHTS_LABEL,
  sourceSiteName,
} from './present'
import { TrustBadges } from './TrustBadges'
import type { RecipeDetail, RecipesApi, RecipeSource } from './types'
import { useRecipesApi } from './useRecipesApi'

export function RecipePage({ api, pantryApi }: { api?: RecipesApi; pantryApi?: PantryApi }) {
  const effectiveApi = useRecipesApi(api)
  const pantry = usePantryApi(pantryApi)
  const { id } = useParams()
  return (
    <article>
      <p>
        <Link to="/">← Все рецепты</Link>
      </p>
      <RequireAuth>
        {effectiveApi && <RecipeView api={effectiveApi} pantryApi={pantry} id={Number(id)} />}
      </RequireAuth>
    </article>
  )
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'missing' }
  | { status: 'ready'; recipe: RecipeDetail }

const AVAILABILITY: Record<Availability, { label: string; tone: string } | null> = {
  enough: { label: 'есть', tone: 'ok' },
  present: { label: 'есть, количество не сравнивалось', tone: 'neutral' },
  low: { label: 'мало', tone: 'warn' },
  missing: { label: 'нет', tone: 'missing' },
  assumed: null,
}

function RecipeView({
  api,
  pantryApi,
  id,
}: {
  api: RecipesApi
  pantryApi: PantryApi | null
  id: number
}) {
  const [state, setState] = useState<State>({ status: 'loading' })
  // Запасы нужны только для отметок «есть/нет»; без них рецепт всё равно показывается.
  const [pantry, setPantry] = useState<PantryIndex | null>(null)

  useEffect(() => {
    if (!pantryApi) return
    let cancelled = false
    loadPantry(pantryApi).then(
      (p) => !cancelled && setPantry(indexPantry(p)),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [pantryApi])

  const fetchData = useCallback(
    () =>
      (Number.isInteger(id) ? api.getRecipe(id) : Promise.resolve(null)).then(
        (recipe) => setState(recipe ? { status: 'ready', recipe } : { status: 'missing' }),
        (e: unknown) =>
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      ),
    [api, id],
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (state.status === 'loading') return <p aria-busy="true">Загрузка рецепта…</p>
  if (state.status === 'missing')
    return (
      <>
        <h1>Рецепт не найден</h1>
        <p className="muted">Возможно, он удалён или ещё не опубликован.</p>
      </>
    )
  if (state.status === 'error')
    return (
      <div className="error" role="alert">
        <p>{state.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ status: 'loading' })
            fetchData()
          }}
        >
          Повторить
        </button>
      </div>
    )

  const r = state.recipe
  return (
    <>
      <h1>{r.title}</h1>
      <TrustBadges trust={r.trust} detailed />
      {r.source?.url && (
        <p>
          <a className="button-link" href={r.source.url} target="_blank" rel="noopener noreferrer">
            Открыть оригинал ({sourceSiteName(r.source)}) ↗
          </a>
        </p>
      )}

      <dl className="facts recipe-facts">
        <dt>Время</dt>
        <dd>
          {describeTime(r.prepMinutes, r.cookMinutes)}
          {/* Разбивку показываем, только если источник даёт обе части. */}
          {!!r.prepMinutes && !!r.cookMinutes && (
            <span className="muted">
              {' '}
              (подготовка {formatMinutes(r.prepMinutes)}, готовка {formatMinutes(r.cookMinutes)})
            </span>
          )}
        </dd>
        <dt>Порции</dt>
        <dd>{describeServings(r.servings)}</dd>
        {r.cuisine && (
          <>
            <dt>Кухня</dt>
            <dd>{r.cuisine}</dd>
          </>
        )}
        {r.equipment.length > 0 && (
          <>
            <dt>Посуда и техника</dt>
            <dd>{r.equipment.join(', ')}</dd>
          </>
        )}
      </dl>

      {r.description && <p>{r.description}</p>}

      <section className="card" aria-labelledby="ingredients-title">
        <h2 id="ingredients-title">Ингредиенты</h2>
        {pantry && !pantry.isEmpty && <PantrySummary recipe={r} pantry={pantry} />}
        <ul className="ingredients">
          {r.ingredients.map((line) => {
            const mark = IMPORTANCE_LABEL[line.importance]
            const status = pantry && !pantry.isEmpty ? ingredientAvailability(line, pantry) : null
            // «По вкусу» и «по желанию» на подбор не влияют — «нет» у них не показываем.
            const availability =
              status && !(status === 'missing' && !isRequired(line)) ? AVAILABILITY[status] : null
            return (
              <li key={line.position}>
                <span>
                  {line.name}
                  {mark && <span className="badge">{mark}</span>}
                  {line.note && <span className="muted small"> — {line.note}</span>}
                  {availability && (
                    <span className={`avail avail-${availability.tone}`}>{availability.label}</span>
                  )}
                </span>
                <span className="amount">{describeAmount(line)}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="steps-title">
        <h2 id="steps-title">Приготовление</h2>
        <ol className="steps">
          {r.steps.map((step) => (
            <li key={step.position}>
              {step.instruction}
              {step.durationMinutes !== null && (
                <span className="muted small"> ({formatMinutes(step.durationMinutes)})</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {r.source && <SourceBlock source={r.source} adaptationNote={r.adaptationNote} />}
    </>
  )
}

function SourceBlock({
  source,
  adaptationNote,
}: {
  source: RecipeSource
  adaptationNote: string | null
}) {
  return (
    <section className="card source" aria-labelledby="source-title">
      <h2 id="source-title">Источник</h2>
      <p>
        {source.url ? (
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.title}
          </a>
        ) : (
          source.title
        )}{' '}
        — {sourceSiteName(source)}
      </p>
      <dl className="facts">
        {(source.author || source.authorsUrl) && (
          <>
            <dt>Авторы</dt>
            <dd>
              {source.author}
              {source.authorsUrl && (
                <>
                  {source.author ? ' — ' : ''}
                  <a href={source.authorsUrl} target="_blank" rel="noopener noreferrer">
                    история правок
                  </a>
                </>
              )}
            </dd>
          </>
        )}
        <dt>Права</dt>
        <dd>
          {RIGHTS_LABEL[source.rights] ?? source.rights}
          {source.license && (
            <>
              {': '}
              {source.licenseUrl ? (
                <a href={source.licenseUrl} target="_blank" rel="noopener noreferrer">
                  {source.license}
                </a>
              ) : (
                source.license
              )}
            </>
          )}
        </dd>
        {source.retrievedOn && (
          <>
            <dt>Получено</dt>
            <dd>
              {formatDate(source.retrievedOn)}
              {source.revision && (
                <span className="muted"> (версия страницы {source.revision})</span>
              )}
            </dd>
          </>
        )}
        {adaptationNote && (
          <>
            <dt>Изменения</dt>
            <dd>{adaptationNote}</dd>
          </>
        )}
      </dl>
      {source.rights === 'open_license' && source.license && (
        <p className="muted small">
          Адаптированный текст этого рецепта распространяется на условиях той же лицензии (
          {source.license}).
        </p>
      )}
    </section>
  )
}

function PantrySummary({ recipe, pantry }: { recipe: RecipeDetail; pantry: PantryIndex }) {
  const match = matchRecipe({ ...recipe, ingredients: recipe.ingredients }, pantry)
  if (match.toBuy.length === 0)
    return <p className="note-ok">По вашим запасам все нужные продукты есть.</p>
  return (
    <p className="note-missing">
      Не хватает: {match.toBuy.map((m) => m.line.name).join(', ')}.{' '}
      <span className="muted small">«По вкусу» и «по желанию» не учитываются.</span>
    </p>
  )
}
