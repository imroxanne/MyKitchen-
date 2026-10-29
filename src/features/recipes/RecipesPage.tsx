import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import {
  explain,
  indexPantry,
  selectRecipes,
  type Filters,
  type Pantry,
  type RecipeMatch,
} from '../matching/match'
import {
  MEAL_LABELS,
  MEAL_TYPES,
  parseFilters,
  serializeFilters,
  TIME_OPTIONS,
} from '../matching/filtersUrl'
import { loadPantry, usePantryApi } from '../matching/usePantry'
import type { PantryApi } from '../pantry/types'
import { describeServings, describeTime } from './present'
import { TrustBadges } from './TrustBadges'
import type { RecipesApi, RecipeSummary } from './types'
import { useRecipesApi } from './useRecipesApi'

export function RecipesPage({ api, pantryApi }: { api?: RecipesApi; pantryApi?: PantryApi }) {
  const recipes = useRecipesApi(api)
  const pantry = usePantryApi(pantryApi)
  return (
    <section aria-labelledby="recipes-title">
      <h1 id="recipes-title">Что приготовить</h1>
      <RequireAuth>
        {recipes && pantry && <RecipeFinder recipesApi={recipes} pantryApi={pantry} />}
      </RequireAuth>
    </section>
  )
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; recipes: RecipeSummary[]; pantry: Pantry }

function RecipeFinder({ recipesApi, pantryApi }: { recipesApi: RecipesApi; pantryApi: PantryApi }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [params, setParams] = useSearchParams()

  const fetchData = useCallback(
    () =>
      Promise.all([recipesApi.listRecipes(), loadPantry(pantryApi)]).then(
        ([recipes, pantry]) => setState({ status: 'ready', recipes, pantry }),
        (e: unknown) =>
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      ),
    [recipesApi, pantryApi],
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
  if (state.status === 'loading' || !index) return <p aria-busy="true">Загрузка рецептов…</p>

  const filters = parseFilters(params, index.isEmpty)
  // flushSync: иначе роутер применяет адрес в переходе (transition), и управляемые переключатели
  // и поле поиска на мгновение откатываются — на медленном телефоне теряется нажатие или буква.
  const update = (patch: Partial<Filters>, replace = false) =>
    setParams(serializeFilters({ ...filters, ...patch }), { replace, flushSync: true })
  const { matches, hiddenUnknownTime } = selectRecipes(state.recipes, index, filters)
  const usePantry = filters.mode !== 'ignore'

  return (
    <>
      <FilterPanel
        filters={filters}
        onChange={update}
        pantryEmpty={index.isEmpty}
        onReset={() => setParams(new URLSearchParams(), { flushSync: true })}
      />

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
            <li key={m.recipe.id}>
              <RecipeCard match={m} usePantry={usePantry} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function RecipeCard({ match, usePantry }: { match: RecipeMatch; usePantry: boolean }) {
  const r = match.recipe
  const notes = explain(match, usePantry)
  return (
    // Вся карточка — ссылка на рецепт (ТЗ §8).
    <Link to={`/recipes/${r.id}`} className="recipe-card">
      <span className="recipe-card-title">{r.title}</span>
      <span className="recipe-card-meta muted small">
        {describeTime(r.prepMinutes, r.cookMinutes)} · {describeServings(r.servings)}
        {usePantry && ` · есть ${match.availableCount} из ${match.requiredCount}`}
      </span>
      {notes.length > 0 && (
        <span className="recipe-card-notes">
          {notes.map((note) => (
            <span key={note} className={note.startsWith('Не хватает') ? 'note-missing' : 'note-ok'}>
              {note}
            </span>
          ))}
        </span>
      )}
      <TrustBadges trust={r.trust} />
    </Link>
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
