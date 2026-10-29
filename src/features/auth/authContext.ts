import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Database } from '../../lib/database.types'

export type AuthState =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session }

export interface AuthContextValue {
  state: AuthState
  client: SupabaseClient<Database> | null
}

export const AuthContext = createContext<AuthContextValue>({
  state: { status: 'unconfigured' },
  client: null,
})

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
