import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { indexPantry, matchRecipe, type Pantry } from '../matching/match'
import { loadPantry, usePantryApi } from '../matching/usePantry'
import { applyUserNutrition } from '../nutrition/userNutrition'
import type { PantryApi } from '../pantry/types'
import { evaluateLines } from '../restrictions/evaluate'
import { restrictionMark } from '../restrictions/present'
import type { RestrictionProfile, RestrictionsApi } from '../restrictions/types'
import { loadRestrictionProfile, useRestrictionsApi } from '../restrictions/useRestrictions'
import { RecipeCard } from '../recipes/RecipeCard'
import type { RecipesApi, RecipeSummary } from '../recipes/types'
import { useRecipesApi } from '../recipes/useRecipesApi'
import type { FavoritesApi } from './types'
import { useFavorites, useFavoritesApi } from './useFavorites'

export function FavoritesPage({
  api,
  pantryApi,
  favoritesApi,
  restrictionsApi,
}: {
  api?: RecipesApi
  pantryApi?: PantryApi
  favoritesApi?: FavoritesApi
  restrictionsApi?: RestrictionsApi
}) {
  const recipes = useRecipesApi(api)
  const pantry = usePantryApi(pantryApi)
  const favorites = useFavoritesApi(favoritesApi)
  const restrictions = useRestrictionsApi(restrictionsApi)
  return (
    <section aria-labelledby="favorites-title">
      <h1 id="favorites-title">Избранное</h1>
      <RequireAuth>
        {recipes && pantry && favorites && (
          <FavoritesList
            recipesApi={recipes}
            pantryApi={pantry}
            favoritesApi={favorites}
            restrictionsApi={restrictions}
          />
        )}
      </RequireAuth>
    </section>
  )
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      recipes: RecipeSummary[]
      pantry: Pantry
      // Избранное не скрывается по ограничениям — только помечается.
      profile: RestrictionProfile | null
    }

function FavoritesList({
  recipesApi,
  pantryApi,
  favoritesApi,
  restrictionsApi,
}: {
  recipesApi: RecipesApi
  pantryApi: PantryApi
  favoritesApi: FavoritesApi
  restrictionsApi: RestrictionsApi | null
}) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const favorites = useFavorites(favoritesApi)
  // Убранный рецепт остаётся на экране с пустым сердечком до ухода со страницы —
  // случайное нажатие можно отменить повторным.
  const [shown, setShown] = useState<number[] | null>(null)
  if (shown === null && favorites.ids !== null) setShown(favorites.ids)

  const fetchData = useCallback(
    () =>
      Promise.all([
        recipesApi.listRecipes(),
        loadPantry(pantryApi),
        restrictionsApi ? loadRestrictionProfile(restrictionsApi) : null,
      ]).then(
        ([recipes, pantry, profile]) => setState({ status: 'ready', recipes, pantry, profile }),
        (e: unknown) =>
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      ),
    [recipesApi, pantryApi, restrictionsApi],
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const index = useMemo(
    () => (state.status === 'ready' ? indexPantry(state.pantry) : null),
    [state],
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
  if (favorites.error && shown === null)
    return (
      <div className="error" role="alert">
        <p>{favorites.error}</p>
      </div>
    )
  if (state.status === 'loading' || !index || shown === null)
    return <p aria-busy="true">Загрузка избранного…</p>

  const byId = new Map(
    state.recipes.map((r) => [
      r.id,
      { ...r, ingredients: applyUserNutrition(r.ingredients, state.pantry.userNutrition) },
    ]),
  )
  // Рецепт мог стать недоступным (снят с публикации) — такие просто не показываем.
  const recipes = shown.flatMap((id) => byId.get(id) ?? [])
  const usePantry = !index.isEmpty

  if (recipes.length === 0)
    return (
      <div className="notice">
        <p>В избранном пока ничего нет.</p>
        <p>
          Нажмите ♡ на карточке или внутри рецепта, чтобы сохранить его здесь.{' '}
          <Link to="/">К рецептам</Link>
        </p>
      </div>
    )

  return (
    <>
      {favorites.error && (
        <p className="error small" role="alert">
          {favorites.error}
        </p>
      )}
      <p className="muted small" role="status">
        Сохранено: {recipes.filter((r) => favorites.has(r.id)).length}
      </p>
      <ul className="recipe-list" aria-label="Избранные рецепты">
        {recipes.map((r) => (
          <RecipeCard
            key={r.id}
            match={matchRecipe(r, index)}
            usePantry={usePantry}
            favorites={favorites}
            backTo="favorites"
            restriction={
              state.profile
                ? restrictionMark(evaluateLines(r.ingredients, state.profile), state.profile)
                : null
            }
          />
        ))}
      </ul>
    </>
  )
}
