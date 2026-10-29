import { Link } from 'react-router'
import { FavoriteButton } from '../favorites/FavoriteButton'
import type { Favorites } from '../favorites/useFavorites'
import { explain, type RecipeMatch } from '../matching/match'
import { calculateNutrition } from '../nutrition/calc'
import { kcalSummary } from '../nutrition/present'
import { describeServings, describeTime } from './present'
import { TrustBadges } from './TrustBadges'

/** Откуда открыт рецепт: кнопка «назад» на его странице возвращает туда же. */
export interface RecipeBackState {
  backTo: 'list' | 'favorites'
}

export function RecipeCard({
  match,
  usePantry,
  favorites,
  backTo,
}: {
  match: RecipeMatch
  usePantry: boolean
  favorites: Favorites
  backTo: RecipeBackState['backTo']
}) {
  const r = match.recipe
  const notes = explain(match, usePantry)
  const kcal = kcalSummary(calculateNutrition(r.ingredients, r.servings))
  return (
    <li className="recipe-card-item">
      {/* Вся карточка — ссылка на рецепт (ТЗ §8); сердечко — отдельная кнопка поверх. */}
      <Link
        to={`/recipes/${r.id}`}
        state={{ backTo } satisfies RecipeBackState}
        className="recipe-card"
      >
        {/* Плитка с первой буквой — пока у рецептов нет фото с разрешёнными правами. */}
        <span className={`recipe-card-tile tone-${r.id % 4}`} aria-hidden="true">
          {r.title.charAt(0)}
        </span>
        <span className="recipe-card-body">
          <span className="recipe-card-title">{r.title}</span>
          <span className="recipe-card-meta muted small">
            {describeTime(r.prepMinutes, r.cookMinutes)} · {describeServings(r.servings)}
            {usePantry && ` · есть ${match.availableCount} из ${match.requiredCount}`}
          </span>
          {kcal && <span className="recipe-card-kcal small">{kcal}</span>}
          {notes.length > 0 && (
            <span className="recipe-card-notes">
              {notes.map((note) => (
                <span
                  key={note}
                  className={note.startsWith('Не хватает') ? 'note-missing' : 'note-ok'}
                >
                  {note}
                </span>
              ))}
            </span>
          )}
          {/* Значки показаны над названием (CSS order), но в имени ссылки идут после него. */}
          <TrustBadges trust={r.trust} />
        </span>
      </Link>
      <FavoriteButton favorites={favorites} recipeId={r.id} title={r.title} />
    </li>
  )
}
