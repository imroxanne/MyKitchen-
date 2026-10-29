import { Icon } from '../../app/icons'
import type { Favorites } from './useFavorites'

/**
 * Сердечко избранного. На карточке — только значок (название рецепта — в подписи для
 * экранного диктора), внутри рецепта — с текстом.
 */
export function FavoriteButton({
  favorites,
  recipeId,
  title,
  withText = false,
  onToggle,
}: {
  favorites: Favorites
  recipeId: number
  title: string
  withText?: boolean
  /** Вызывается с новым состоянием: true — добавлен в избранное. */
  onToggle?: (on: boolean) => void
}) {
  const on = favorites.has(recipeId)
  return (
    <button
      type="button"
      className={withText ? 'fav fav-text' : 'fav fav-icon'}
      aria-pressed={on}
      aria-label={withText ? undefined : `В избранное: ${title}`}
      title={on ? 'Убрать из избранного' : 'Добавить в избранное'}
      disabled={favorites.ids === null}
      onClick={() => {
        favorites.toggle(recipeId)
        onToggle?.(!on)
      }}
    >
      <span className={on ? 'fav-heart fav-on' : 'fav-heart'}>
        <Icon name="heart" filled={on} />
      </span>
      {withText && ' В избранное'}
    </button>
  )
}
