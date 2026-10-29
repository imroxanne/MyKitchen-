import { useMemo } from 'react'
import { useAuth } from '../auth/authContext'
import { perClient } from '../../lib/lastLoaded'
import { createSupabasePantryApi } from '../pantry/supabaseApi'
import type { PantryApi } from '../pantry/types'
import type { Pantry } from './match'

const apiFor = perClient(createSupabasePantryApi)

/** Переданная реализация (тесты) или Supabase текущего клиента. */
export function usePantryApi(api?: PantryApi): PantryApi | null {
  const { client } = useAuth()
  return useMemo(() => api ?? (client ? apiFor(client) : null), [api, client])
}

/** Запасы пользователя в виде, нужном для подбора. */
export async function loadPantry(api: PantryApi): Promise<Pantry> {
  const [catalog, products] = await Promise.all([api.loadCatalog(), api.listProducts()])
  return { products, catalog: catalog.items, units: catalog.units }
}
