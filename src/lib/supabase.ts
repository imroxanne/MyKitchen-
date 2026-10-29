import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { config } from './env'

let client: SupabaseClient<Database> | null = null

/** Клиент Supabase или null, если окружение не настроено (см. .env.example). */
export function getSupabase(): SupabaseClient<Database> | null {
  if (!config.supabase) return null
  client ??= createClient<Database>(config.supabase.url, config.supabase.publishableKey)
  return client
}
