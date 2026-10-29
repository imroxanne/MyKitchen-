import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { checkDatabase } from './health'

function fakeClient(rpc: () => Promise<unknown>): SupabaseClient {
  return { rpc } as unknown as SupabaseClient
}

describe('checkDatabase', () => {
  it('без клиента сообщает, что подключение не настроено', async () => {
    expect(await checkDatabase(null)).toEqual({ status: 'not-configured' })
  })

  it('возвращает время сервера при успешном ответе', async () => {
    const client = fakeClient(async () => ({
      data: { server_time: '2026-10-28T12:00:00Z' },
      error: null,
    }))
    expect(await checkDatabase(client)).toEqual({
      status: 'ok',
      serverTime: '2026-10-28T12:00:00Z',
    })
  })

  it('передаёт ошибку БД и сетевые сбои', async () => {
    const dbError = fakeClient(async () => ({ data: null, error: { message: 'нет функции' } }))
    expect(await checkDatabase(dbError)).toEqual({ status: 'error', message: 'нет функции' })

    const network = fakeClient(async () => {
      throw new Error('Failed to fetch')
    })
    expect(await checkDatabase(network)).toEqual({ status: 'error', message: 'Failed to fetch' })
  })
})
