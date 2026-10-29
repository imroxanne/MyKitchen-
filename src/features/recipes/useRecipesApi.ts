import { useMemo } from 'react'
import { useAuth } from '../auth/authContext'
import { createSupabaseRecipesApi } from './supabaseApi'
import type { RecipesApi } from './types'

/** Переданная реализация (тесты) или Supabase текущего клиента. */
export function useRecipesApi(api?: RecipesApi): RecipesApi | null {
  const { client } = useAuth()
  return useMemo(() => api ?? (client ? createSupabaseRecipesApi(client) : null), [api, client])
}
