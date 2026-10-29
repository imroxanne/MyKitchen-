import { useEffect, useState } from 'react'
import { config } from '../lib/env'
import { checkDatabase, type HealthResult } from '../lib/health'
import { getSupabase } from '../lib/supabase'

// Служебный экран: какое окружение собрано и отвечает ли база данных.
export function SystemStatus() {
  const [health, setHealth] = useState<HealthResult | null>(null)

  useEffect(() => {
    let cancelled = false
    checkDatabase(getSupabase()).then((result) => {
      if (!cancelled) setHealth(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section aria-labelledby="status-title">
      <h1 id="status-title">Состояние системы</h1>
      <dl className="facts">
        <dt>Окружение</dt>
        <dd>{config.environment}</dd>
        <dt>Supabase</dt>
        <dd>{config.supabase ? config.supabase.url : 'не настроен'}</dd>
        <dt>База данных</dt>
        <dd data-testid="db-status" aria-live="polite">
          {describe(health)}
        </dd>
      </dl>
      {config.problems.length > 0 && (
        <ul className="notice">
          {config.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function describe(health: HealthResult | null): string {
  if (!health) return 'проверка…'
  switch (health.status) {
    case 'not-configured':
      return 'не проверялась: нет настроек подключения'
    case 'ok':
      return `отвечает (время сервера ${new Date(health.serverTime).toLocaleString('ru-RU')})`
    case 'error':
      return `ошибка: ${health.message}`
  }
}
