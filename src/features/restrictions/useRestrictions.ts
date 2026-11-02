import { useMemo } from 'react'
import { useAuth } from '../auth/authContext'
import { perClient } from '../../lib/lastLoaded'
import { createSupabaseRestrictionsApi } from './supabaseApi'
import type { RestrictionProfile, RestrictionsApi } from './types'

const apiFor = perClient(createSupabaseRestrictionsApi)

/** Переданная реализация (тесты) или Supabase текущего клиента. */
export function useRestrictionsApi(api?: RestrictionsApi): RestrictionsApi | null {
  const { client } = useAuth()
  return useMemo(() => api ?? (client ? apiFor(client) : null), [api, client])
}

/** Ограничения пользователя и справочник для отбора рецептов. */
export async function loadRestrictionProfile(api: RestrictionsApi): Promise<RestrictionProfile> {
  const [reference, restrictions] = await Promise.all([api.loadReference(), api.list()])
  return { reference, restrictions }
}
