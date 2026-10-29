import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
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

export function RecipePage({ api }: { api?: RecipesApi }) {
  const effectiveApi = useRecipesApi(api)
  const { id } = useParams()
  return (
    <article>
      <p>
        <Link to="/">← Все рецепты</Link>
      </p>
      <RequireAuth>{effectiveApi && <RecipeView api={effectiveApi} id={Number(id)} />}</RequireAuth>
    </article>
  )
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'missing' }
  | { status: 'ready'; recipe: RecipeDetail }

function RecipeView({ api, id }: { api: RecipesApi; id: number }) {
  const [state, setState] = useState<State>({ status: 'loading' })

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
          {r.prepMinutes !== null && r.cookMinutes !== null && (
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
        <ul className="ingredients">
          {r.ingredients.map((line) => {
            const mark = IMPORTANCE_LABEL[line.importance]
            return (
              <li key={line.position}>
                <span>
                  {line.name}
                  {mark && <span className="badge">{mark}</span>}
                  {line.note && <span className="muted small"> — {line.note}</span>}
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
