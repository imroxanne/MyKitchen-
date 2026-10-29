import type { ReactNode } from 'react'
import { useAuth } from './authContext'
import { SignInForm } from './SignInForm'

/** Показывает содержимое только вошедшему пользователю, иначе — форму входа. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  switch (state.status) {
    case 'unconfigured':
      return <p className="notice">Нет настроек подключения к базе данных.</p>
    case 'loading':
      return <p aria-busy="true">Загрузка…</p>
    case 'signed-out':
      return <SignInForm />
    case 'signed-in':
      return <>{children}</>
  }
}
