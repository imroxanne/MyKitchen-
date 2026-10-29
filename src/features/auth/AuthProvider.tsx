import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import type { Database } from '../../lib/database.types'
import { AuthContext, type AuthState } from './authContext'

// Сессия Supabase хранится в localStorage браузера и обновляется автоматически.
export function AuthProvider({
  client,
  children,
}: {
  client: SupabaseClient<Database> | null
  children: ReactNode
}) {
  const [state, setState] = useState<AuthState>(
    client ? { status: 'loading' } : { status: 'unconfigured' },
  )

  useEffect(() => {
    if (!client) return
    const apply = (session: Session | null) =>
      setState(session ? { status: 'signed-in', session } : { status: 'signed-out' })
    client.auth.getSession().then(({ data }) => apply(data.session))
    const { data } = client.auth.onAuthStateChange((_event, session) => apply(session))
    return () => data.subscription.unsubscribe()
  }, [client])

  return <AuthContext.Provider value={{ state, client }}>{children}</AuthContext.Provider>
}
