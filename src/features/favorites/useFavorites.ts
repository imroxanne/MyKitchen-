import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/authContext'
import { createLastLoaded, perClient } from '../../lib/lastLoaded'
import { createSupabaseFavoritesApi } from './supabaseApi'
import type { FavoritesApi } from './types'

const apiFor = perClient(createSupabaseFavoritesApi)
const lastLoaded = createLastLoaded<FavoritesApi, number[]>()

/** Переданная реализация (тесты) или Supabase текущего клиента. */
export function useFavoritesApi(api?: FavoritesApi): FavoritesApi | null {
  const { client } = useAuth()
  return useMemo(() => api ?? (client ? apiFor(client) : null), [api, client])
}

export function useUserId(): string | null {
  const { state } = useAuth()
  return state.status === 'signed-in' ? state.session.user.id : null
}

export interface Favorites {
  /** Избранные рецепты, сначала добавленные последними; null — ещё не загружены. */
  ids: number[] | null
  /** Ошибка загрузки или сохранения — показывается рядом с сердечками. */
  error: string | null
  has(recipeId: number): boolean
  toggle(recipeId: number): void
}

export function useFavorites(api: FavoritesApi | null): Favorites {
  const userId = useUserId()
  const [ids, setIds] = useState<number[] | null>(() => lastLoaded.get(api, userId))
  const [error, setError] = useState<string | null>(null)
  // Запросы по одному рецепту идут строго по очереди: быстрые повторные нажатия
  // не могут прийти на сервер в обратном порядке.
  const queues = useRef(new Map<number, Promise<unknown>>())

  useEffect(() => {
    if (!api) return
    let cancelled = false
    api.listFavorites().then(
      (list) => {
        if (cancelled) return
        lastLoaded.set(api, userId, list)
        setIds(list)
      },
      (e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      cancelled = true
    }
  }, [api, userId])

  const toggle = useCallback(
    (recipeId: number) => {
      if (!api || !ids) return
      const adding = !ids.includes(recipeId)
      const apply = (add: boolean) =>
        setIds((prev) => {
          const rest = (prev ?? []).filter((id) => id !== recipeId)
          const next = add ? [recipeId, ...rest] : rest
          lastLoaded.set(api, userId, next)
          return next
        })
      apply(adding)
      setError(null)
      const previous = queues.current.get(recipeId) ?? Promise.resolve()
      const request = previous
        .then(() => (adding ? api.add(recipeId) : api.remove(recipeId)))
        .catch((e: unknown) => {
          apply(!adding)
          setError(e instanceof Error ? e.message : String(e))
        })
      queues.current.set(recipeId, request)
    },
    [api, ids, userId],
  )

  return {
    ids,
    error,
    has: (recipeId) => ids?.includes(recipeId) ?? false,
    toggle,
  }
}
