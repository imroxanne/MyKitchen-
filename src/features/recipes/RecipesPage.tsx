import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { useFavorites, useFavoritesApi, useUserId } from '../favorites/useFavorites'
import type { FavoritesApi } from '../favorites/types'
import { indexPantry, selectRecipes, type Filters, type Pantry } from '../matching/match'
import {
  MEAL_LABELS,
  MEAL_TYPES,
  parseFilters,
  serializeFilters,
  TIME_OPTIONS,
} from '../matching/filtersUrl'
import { loadPantry, usePantryApi } from '../matching/usePantry'
import { applyUserNutrition } from '../nutrition/userNutrition'
import type { PantryApi } from '../pantry/types'
import { createLastLoaded } from '../../lib/lastLoaded'
import { RecipeCard } from './RecipeCard'
import type { RecipesApi, RecipeSummary } from './types'
import { useRecipesApi } from './useRecipesApi'

export function RecipesPage({
  api,
  pantryApi,
  favoritesApi,
}: {
  api?: RecipesApi
  pantryApi?: PantryApi
  favoritesApi?: FavoritesApi
}) {
  const recipes = useRecipesApi(api)
  const pantry = usePantryApi(pantryApi)
  const favorites = useFavoritesApi(favoritesApi)
  return (
    <section aria-labelledby="recipes-title">
      <h1 id="recipes-title">Что приготовить</h1>
      <RequireAuth>
        {recipes && pantry && (
          <RecipeFinder recipesApi={recipes} pantryApi={pantry} favoritesApi={favorites} />
        )}
      </RequireAuth>
    </section>
  )
}

type Loaded = { recipes: RecipeSummary[]; pantry: Pantry }
type State =
  { status: 'loading' } | { status: 'error'; message: string } | ({ status: 'ready' } & Loaded)

const lastLoaded = createLastLoaded<RecipesApi, Loaded>()

function RecipeFinder({
  recipesApi,
  pantryApi,
  favoritesApi,
}: {
  recipesApi: RecipesApi
  pantryApi: PantryApi
  favoritesApi: FavoritesApi | null
}) {
  const userId = useUserId()
  const [state, setState] = useState<State>(() => {
    const cached = lastLoaded.get(recipesApi, userId)
    return cached ? { status: 'ready', ...cached } : { status: 'loading' }
  })
  const [params, setParams] = useSearchParams()
  const favorites = useFavorites(favoritesApi)

  const fetchData = useCallback(
    () =>
      Promise.all([recipesApi.listRecipes(), loadPantry(pantryApi)]).then(
        ([recipes, pantry]) => {
          lastLoaded.set(recipesApi, userId, { recipes, pantry })
          setState({ status: 'ready', recipes, pantry })
        },
        // Если список уже показан (из прошлой загрузки), ошибка обновления его не скрывает.
        (e: unknown) =>
          setState((prev) =>
            prev.status === 'ready'
              ? prev
              : { status: 'error', message: e instanceof Error ? e.message : String(e) },
          ),
      ),
    [recipesApi, pantryApi, userId],
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const index = useMemo(
    () => (state.status === 'ready' ? indexPantry(state.pantry) : null),
    [state],
  )
  // Свои данные с упаковки (B1) участвуют и в подборе, и в КБЖУ карточек.
  const recipes = useMemo(
    () =>
      state.status === 'ready'
        ? state.recipes.map((r) => ({
            ...r,
            ingredients: applyUserNutrition(r.ingredients, state.pantry.userNutrition),
          }))
        : [],
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
  if (state.status === 'loading' || !index) return <p aria-busy="true">Загрузка рецептов…</p>

  const filters = parseFilters(params, index.isEmpty)
  // flushSync: иначе роутер применяет адрес в переходе (transition), и управляемые переключатели
  // и поле поиска на мгновение откатываются — на медленном телефоне теряется нажатие или буква.
  const update = (patch: Partial<Filters>, replace = false) =>
    setParams(serializeFilters({ ...filters, ...patch }), {
      replace,
      flushSync: true,
      // Смена фильтра не прокручивает страницу наверх.
      preventScrollReset: true,
    })
  const { matches, hiddenUnknownTime } = selectRecipes(recipes, index, filters)
  const usePantry = filters.mode !== 'ignore'

  return (
    <>
      <FilterPanel
        filters={filters}
        onChange={update}
        pantryEmpty={index.isEmpty}
        onReset={() =>
          setParams(new URLSearchParams(), { flushSync: true, preventScrollReset: true })
        }
      />

      {favorites.error && (
        <p className="error small" role="alert">
          {favorites.error}
        </p>
      )}

      <p className="muted small" role="status">
        Найдено: {matches.length}
        {hiddenUnknownTime > 0 &&
          ` · скрыто ${hiddenUnknownTime} без указанного в источнике времени`}
      </p>

      {matches.length === 0 ? (
        <div className="notice">
          <p>Под выбранные условия рецептов нет.</p>
          <p>
            Попробуйте увеличить число продуктов для покупки, снять ограничение по времени или
            выбрать «Без учёта запасов».
          </p>
        </div>
      ) : (
        <ul className="recipe-list" aria-label="Рецепты">
          {matches.map((m) => (
            <RecipeCard
              key={m.recipe.id}
              match={m}
              usePantry={usePantry}
              favorites={favorites}
              backTo="list"
            />
          ))}
        </ul>
      )}
    </>
  )
}

function FilterPanel({
  filters,
  onChange,
  pantryEmpty,
  onReset,
}: {
  filters: Filters
  onChange(patch: Partial<Filters>, replace?: boolean): void
  pantryEmpty: boolean
  onReset(): void
}) {
  const activeExtra =
    Number(filters.maxMinutes !== null) +
    Number(filters.mealType !== null) +
    Number(filters.verifiedOnly) +
    Number(filters.sort !== 'match')
  return (
    <form className="card filters" role="search" onSubmit={(e) => e.preventDefault()}>
      <label className="search-field">
        <span className="visually-hidden">Поиск по названию и ингредиентам</span>
        <input
          type="search"
          placeholder="Название или ингредиент"
          aria-label="Поиск по названию и ингредиентам"
          value={filters.query}
          onChange={(e) => onChange({ query: e.target.value }, true)}
        />
      </label>

      {pantryEmpty && (
        <p className="notice small">
          В «Моих продуктах» пока пусто — подбор идёт без учёта запасов.{' '}
          <Link to="/pantry">Добавить продукты</Link>
        </p>
      )}

      <fieldset className="segmented mode">
        <legend>Подбор по продуктам</legend>
        <label>
          <input
            type="radio"
            name="mode"
            checked={filters.mode === 'have'}
            onChange={() => onChange({ mode: 'have' })}
          />
          Из имеющегося
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={filters.mode === 'buy'}
            onChange={() => onChange({ mode: 'buy' })}
          />
          Докупить не больше
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={filters.mode === 'ignore'}
            onChange={() => onChange({ mode: 'ignore' })}
          />
          Без учёта запасов
        </label>
      </fieldset>
      {filters.mode === 'buy' && (
        <label className="inline-field">
          Сколько продуктов можно докупить
          <select
            value={filters.maxToBuy}
            onChange={(e) => onChange({ maxToBuy: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}

      <details className="more-filters" open={activeExtra > 0 || undefined}>
        <summary>Фильтры{activeExtra > 0 ? ` (${activeExtra})` : ''}</summary>
        <div className="more-filters-body">
          <div className="filter-row">
            <label className="inline-field">
              Время
              <select
                value={filters.maxMinutes ?? ''}
                onChange={(e) =>
                  onChange({ maxMinutes: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">любое</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    до {t} мин
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-field">
              Сортировка
              <select
                value={filters.sort}
                onChange={(e) => onChange({ sort: e.target.value as Filters['sort'] })}
              >
                <option value="match">по подходящим</option>
                <option value="time">сначала быстрые</option>
              </select>
            </label>
          </div>

          <div className="chips" role="group" aria-label="Тип блюда">
            {MEAL_TYPES.map((meal) => (
              <button
                type="button"
                key={meal}
                className={filters.mealType === meal ? 'chip chip-active' : 'chip'}
                aria-pressed={filters.mealType === meal}
                onClick={() => onChange({ mealType: filters.mealType === meal ? null : meal })}
              >
                {MEAL_LABELS[meal]}
              </button>
            ))}
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={(e) => onChange({ verifiedOnly: e.target.checked })}
            />
            Только с проверенным источником
          </label>

          <button type="button" className="link" onClick={onReset}>
            Сбросить фильтры
          </button>
        </div>
      </details>
    </form>
  )
}
