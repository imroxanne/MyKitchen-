// Конфигурация окружения читается из переменных VITE_* во время сборки.
// В клиентский код попадают только публичные значения: URL проекта Supabase
// и публикуемый (anon/publishable) ключ. Доступ к данным защищается RLS в БД.

export type AppEnvironment = 'local' | 'preview' | 'production' | 'test'

export interface AppConfig {
  environment: AppEnvironment
  supabase: { url: string; publishableKey: string } | null
  /** Почему Supabase не настроен — для экрана состояния. */
  problems: string[]
}

type RawEnv = Record<string, string | boolean | undefined>

const ENVIRONMENTS: AppEnvironment[] = ['local', 'preview', 'production', 'test']

export function readConfig(env: RawEnv): AppConfig {
  const problems: string[] = []

  const rawEnvironment = String(env.VITE_APP_ENV ?? 'local')
  const environment = (ENVIRONMENTS as string[]).includes(rawEnvironment)
    ? (rawEnvironment as AppEnvironment)
    : 'local'
  if (environment !== rawEnvironment) {
    problems.push(`Неизвестное VITE_APP_ENV="${rawEnvironment}", используется "local"`)
  }

  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : ''
  const publishableKey =
    typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string'
      ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim()
      : ''

  if (!url) problems.push('Не задан VITE_SUPABASE_URL')
  else if (!isHttpUrl(url)) problems.push('VITE_SUPABASE_URL не похож на http(s)-адрес')
  if (!publishableKey) problems.push('Не задан VITE_SUPABASE_PUBLISHABLE_KEY')

  const supabaseOk = url && isHttpUrl(url) && publishableKey
  return {
    environment,
    supabase: supabaseOk ? { url: url.replace(/\/+$/, ''), publishableKey } : null,
    problems,
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export const config = readConfig(import.meta.env)
