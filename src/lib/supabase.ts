import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from './env'

let client: SupabaseClient | null = null

/** Клиент Supabase или null, если окружение не настроено (см. .env.example). */
export function getSupabase(): SupabaseClient | null {
  if (!config.supabase) return null
  client ??= createClient(config.supabase.url, config.supabase.publishableKey)
  return client
}
