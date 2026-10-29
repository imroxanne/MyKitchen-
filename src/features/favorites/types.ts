export interface FavoritesApi {
  /** id избранных рецептов, сначала добавленные последними. */
  listFavorites(): Promise<number[]>
  /** Повторное добавление не считается ошибкой. */
  add(recipeId: number): Promise<void>
  remove(recipeId: number): Promise<void>
}
