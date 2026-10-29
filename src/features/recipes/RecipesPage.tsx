import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { describeServings, describeTime } from './present'
import { TrustBadges } from './TrustBadges'
import type { RecipesApi, RecipeSummary } from './types'
import { useRecipesApi } from './useRecipesApi'

export function RecipesPage({ api }: { api?: RecipesApi }) {
  const effectiveApi = useRecipesApi(api)
  return (
    <section aria-labelledby="recipes-title">
      <h1 id="recipes-title">Что приготовить</h1>
      <RequireAuth>{effectiveApi && <RecipeList api={effectiveApi} />}</RequireAuth>
    </section>
  )
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; recipes: RecipeSummary[] }

function RecipeList({ api }: { api: RecipesApi }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  const fetchData = useCallback(
    () =>
      api.listRecipes().then(
        (recipes) => setState({ status: 'ready', recipes }),
        (e: unknown) =>
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      ),
    [api],
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (state.status === 'loading') return <p aria-busy="true">Загрузка рецептов…</p>
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

  return (
    <>
      <p className="muted small">
        Подбор по вашим продуктам и фильтры появятся в пункте A5. Сейчас — все рецепты базы.
      </p>
      {state.recipes.length === 0 ? (
        <p className="muted">Рецептов пока нет.</p>
      ) : (
        <ul className="recipe-list" aria-label="Рецепты">
          {state.recipes.map((r) => (
            <li key={r.id}>
              {/* Вся карточка — ссылка на рецепт (ТЗ §8). */}
              <Link to={`/recipes/${r.id}`} className="recipe-card">
                <span className="recipe-card-title">{r.title}</span>
                <span className="recipe-card-meta muted small">
                  {describeTime(r.prepMinutes, r.cookMinutes)} · {describeServings(r.servings)}
                </span>
                <TrustBadges trust={r.trust} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
