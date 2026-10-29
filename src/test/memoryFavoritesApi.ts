import type { FavoritesApi } from '../features/favorites/types'

/** Избранное в памяти для тестов; failNext — следующий запрос на запись упадёт. */
export function createMemoryFavoritesApi(initial: number[] = []) {
  const store = { ids: [...initial], failNext: false }
  const write = async (change: () => void) => {
    if (store.failNext) {
      store.failNext = false
      throw new Error('Нет связи с сервером: не удалось сохранить избранное. Попробуйте ещё раз.')
    }
    change()
  }
  const api: FavoritesApi = {
    async listFavorites() {
      return [...store.ids]
    },
    add: (id) =>
      write(() => {
        if (!store.ids.includes(id)) store.ids.unshift(id)
      }),
    remove: (id) =>
      write(() => {
        store.ids = store.ids.filter((x) => x !== id)
      }),
  }
  return { api, store }
}
