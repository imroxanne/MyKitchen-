import { useMemo } from 'react'
import { useAuth } from '../auth/authContext'
import { perClient } from '../../lib/lastLoaded'
import { createSupabaseRecipesApi } from './supabaseApi'
import type { RecipesApi } from './types'

const apiFor = perClient(createSupabaseRecipesApi)

/** Переданная реализация (тесты) или Supabase текущего клиента. */
export function useRecipesApi(api?: RecipesApi): RecipesApi | null {
  const { client } = useAuth()
  return useMemo(() => api ?? (client ? apiFor(client) : null), [api, client])
}
