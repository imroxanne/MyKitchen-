import { Link } from 'react-router'
import { Icon } from '../../app/icons'
import { FavoriteButton } from '../favorites/FavoriteButton'
import type { Favorites } from '../favorites/useFavorites'
import { explain, type RecipeMatch } from '../matching/match'
import { calculateNutrition } from '../nutrition/calc'
import { kcalSummary } from '../nutrition/present'
import { cardTrustBadge, describeServings, describeTime } from './present'

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
  const kcal = kcalSummary(calculateNutrition(r.ingredients, r.servings))
  const trust = cardTrustBadge(r.trust)
  // Первая заметка о запасах — в нижнюю строку карточки, остальные пояснения — в тело.
  const [availability, ...reasons] = usePantry
    ? explain(match, usePantry)
    : [null, ...explain(match, usePantry)]
  const missing = availability?.startsWith('Не хватает') ?? false
  return (
    <li className="recipe-card-item">
      {/* Вся карточка — ссылка на рецепт (ТЗ §8); сердечко — отдельная кнопка поверх. */}
      <Link
        to={`/recipes/${r.id}`}
        state={{ backTo } satisfies RecipeBackState}
        className="recipe-card"
      >
        {/* Обложка: фото блюда, если есть права на него, иначе оттенок зелёного с иконкой. */}
        <span className={`recipe-card-cover tone-${r.id % 4}`}>
          {r.image ? (
            <img src={r.image.url} alt="" loading="lazy" decoding="async" />
          ) : (
            <Icon name="cook" />
          )}
        </span>
        <span className="recipe-card-body">
          <span className="recipe-card-title">{r.title}</span>
          <span className="recipe-card-pills">
            <span className="pill">{describeTime(r.prepMinutes, r.cookMinutes)}</span>
            <span className="pill">{describeServings(r.servings)}</span>
            {kcal && <span className="pill recipe-card-kcal">{kcal}</span>}
          </span>
          {reasons.length > 0 && (
            <span className="recipe-card-notes muted small">
              {reasons.map((note) => (
                <span key={note}>{note}</span>
              ))}
            </span>
          )}
        </span>
        {availability && (
          <span className={missing ? 'recipe-card-foot foot-missing' : 'recipe-card-foot foot-ok'}>
            <Icon name={missing ? 'pantry' : 'check'} />
            <span>
              {availability}
              <span className="muted">
                {' '}
                · есть {match.availableCount} из {match.requiredCount}
              </span>
            </span>
          </span>
        )}
        {/* Значок стоит на обложке (CSS), но в имени ссылки идёт после названия. */}
        <span className={`recipe-card-trust trust-${trust.tone}`}>{trust.label}</span>
      </Link>
      <FavoriteButton favorites={favorites} recipeId={r.id} title={r.title} />
    </li>
  )
}
