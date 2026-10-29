import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { FavoriteButton } from '../favorites/FavoriteButton'
import type { FavoritesApi } from '../favorites/types'
import { useFavorites, useFavoritesApi, type Favorites } from '../favorites/useFavorites'
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
import { CookingSteps } from './CookingSteps'
import type { RecipeBackState } from './RecipeCard'
import { TrustBadges } from './TrustBadges'
import type { RecipeDetail, RecipesApi, RecipeSource } from './types'
import { useRecipesApi } from './useRecipesApi'

export function RecipePage({
  api,
  pantryApi,
  favoritesApi,
}: {
  api?: RecipesApi
  pantryApi?: PantryApi
  favoritesApi?: FavoritesApi
}) {
  const effectiveApi = useRecipesApi(api)
  const pantry = usePantryApi(pantryApi)
  const favorites = useFavorites(useFavoritesApi(favoritesApi))
  const { id } = useParams()
  return (
    <article>
      <BackLink />
      <RequireAuth>
        {effectiveApi && (
          <RecipeView api={effectiveApi} pantryApi={pantry} favorites={favorites} id={Number(id)} />
        )}
      </RequireAuth>
    </article>
  )
}

/**
 * Если рецепт открыт из списка или избранного — «назад» по истории: сохраняются фильтры
 * и место прокрутки. По прямой ссылке — обычный переход к списку.
 */
function BackLink() {
  const backTo = (useLocation().state as RecipeBackState | null)?.backTo
  const navigate = useNavigate()
  const fromFavorites = backTo === 'favorites'
  return (
    <p>
      <Link
        to={fromFavorites ? '/favorites' : '/'}
        onClick={(e) => {
          if (!backTo) return
          e.preventDefault()
          navigate(-1)
        }}
      >
        {fromFavorites ? '← Избранное' : '← Все рецепты'}
      </Link>
    </p>
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
  favorites,
  id,
}: {
  api: RecipesApi
  pantryApi: PantryApi | null
  favorites: Favorites
  id: number
}) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [favoriteNote, setFavoriteNote] = useState('')
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

      <div className="recipe-actions" role="group" aria-label="Действия с рецептом">
        <FavoriteButton
          favorites={favorites}
          recipeId={r.id}
          title={r.title}
          withText
          onToggle={(on) =>
            setFavoriteNote(on ? 'Рецепт сохранён в избранном.' : 'Рецепт убран из избранного.')
          }
        />
        {r.source?.url && (
          <a className="button-link" href={r.source.url} target="_blank" rel="noopener noreferrer">
            Открыть оригинал ({sourceSiteName(r.source)}) ↗
          </a>
        )}
      </div>
      <p className="muted small" role="status">
        {favorites.error ? '' : favoriteNote}
      </p>
      {favorites.error && (
        <p className="error small" role="alert">
          {favorites.error}
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

      <CookingSteps recipeId={r.id} steps={r.steps} />

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
