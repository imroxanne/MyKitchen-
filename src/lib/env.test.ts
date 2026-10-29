import { describe, expect, it } from 'vitest'
import { readConfig } from './env'

describe('readConfig', () => {
  it('принимает корректные настройки Supabase', () => {
    const config = readConfig({
      VITE_APP_ENV: 'production',
      VITE_SUPABASE_URL: 'https://abc.supabase.co/',
      VITE_SUPABASE_PUBLISHABLE_KEY: ' key ',
    })
    expect(config).toEqual({
      environment: 'production',
      supabase: { url: 'https://abc.supabase.co', publishableKey: 'key' },
      problems: [],
    })
  })

  it('без настроек работает в режиме local и сообщает, чего не хватает', () => {
    const config = readConfig({})
    expect(config.environment).toBe('local')
    expect(config.supabase).toBeNull()
    expect(config.problems).toEqual([
      'Не задан VITE_SUPABASE_URL',
      'Не задан VITE_SUPABASE_PUBLISHABLE_KEY',
    ])
  })

  it('отклоняет неверный адрес и неизвестное окружение', () => {
    const config = readConfig({
      VITE_APP_ENV: 'staging',
      VITE_SUPABASE_URL: 'abc.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'key',
    })
    expect(config.environment).toBe('local')
    expect(config.supabase).toBeNull()
    expect(config.problems).toHaveLength(2)
  })
})
