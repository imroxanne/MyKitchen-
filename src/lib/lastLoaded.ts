/**
 * Последние загруженные данные экрана для конкретного источника и пользователя.
 * При возврате «назад» экран показывается сразу (и браузер восстанавливает прокрутку),
 * а свежие данные подгружаются следом.
 */
export function createLastLoaded<K extends object, V>() {
  const store = new WeakMap<K, { userId: string; value: V }>()
  return {
    get(key: K | null, userId: string | null): V | null {
      const entry = key && store.get(key)
      return entry && entry.userId === userId ? entry.value : null
    },
    set(key: K, userId: string | null, value: V) {
      if (userId) store.set(key, { userId, value })
    },
  }
}

/** Один объект API на клиента Supabase — чтобы кеш выше переживал переходы между экранами. */
export function perClient<C extends object, A>(create: (client: C) => A) {
  const apis = new WeakMap<C, A>()
  return (client: C): A => {
    let api = apis.get(client)
    if (!api) {
      api = create(client)
      apis.set(client, api)
    }
    return api
  }
}
