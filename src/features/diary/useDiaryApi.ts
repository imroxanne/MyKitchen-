import { useMemo } from 'react'
import { useAuth } from '../auth/authContext'
import { perClient } from '../../lib/lastLoaded'
import { createSupabaseDiaryApi } from './supabaseApi'
import type { DiaryApi } from './types'

const apiFor = perClient(createSupabaseDiaryApi)

/** Переданная реализация (тесты) или Supabase текущего клиента. */
export function useDiaryApi(api?: DiaryApi): DiaryApi | null {
  const { client } = useAuth()
  return useMemo(() => api ?? (client ? apiFor(client) : null), [api, client])
}
