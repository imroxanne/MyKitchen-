import type { SupabaseClient } from '@supabase/supabase-js'

export type HealthResult =
  | { status: 'not-configured' }
  | { status: 'ok'; serverTime: string }
  | { status: 'error'; message: string }

/**
 * Проверяет, что БД отвечает: вызывает функцию public.app_health()
 * из миграции supabase/migrations/*_app_health.sql.
 */
export async function checkDatabase(supabase: SupabaseClient | null): Promise<HealthResult> {
  if (!supabase) return { status: 'not-configured' }
  try {
    const { data, error } = await supabase.rpc('app_health')
    if (error) return { status: 'error', message: error.message }
    const row = data as { server_time?: string } | null
    if (!row?.server_time) return { status: 'error', message: 'Пустой ответ app_health()' }
    return { status: 'ok', serverTime: row.server_time }
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}
