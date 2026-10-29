import { useState, type FormEvent } from 'react'
import { useAuth } from './authContext'

type Mode = 'sign-in' | 'sign-up'

function translateError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Неверный email или пароль'
  if (/email not confirmed/i.test(message))
    return 'Email ещё не подтверждён — откройте ссылку из письма'
  if (/already registered/i.test(message)) return 'Этот email уже зарегистрирован — войдите'
  if (/password should be at least/i.test(message)) return 'Пароль слишком короткий'
  if (/rate limit/i.test(message)) return 'Слишком много попыток, подождите немного'
  if (/fetch|network/i.test(message)) return 'Нет связи с сервером, попробуйте ещё раз'
  return message
}

export function SignInForm() {
  const { client } = useAuth()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (!client) {
    return <p className="notice">Нет настроек подключения к базе данных.</p>
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!client) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'sign-in') {
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) setError(translateError(error.message))
      } else {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) setError(translateError(error.message))
        else if (!data.session)
          setInfo(
            'Аккаунт создан. Откройте письмо и перейдите по ссылке для подтверждения, затем войдите здесь.',
          )
      }
    } catch (e) {
      setError(translateError(e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card auth-form" onSubmit={submit} aria-labelledby="auth-title">
      <h2 id="auth-title">{mode === 'sign-in' ? 'Вход' : 'Регистрация'}</h2>
      <p className="muted">Ваши продукты сохраняются в аккаунте и доступны с любого устройства.</p>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Пароль
        <input
          type="password"
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="notice" role="status">
          {info}
        </p>
      )}
      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Подождите…' : mode === 'sign-in' ? 'Войти' : 'Зарегистрироваться'}
      </button>
      <button
        type="button"
        className="link"
        onClick={() => {
          setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
          setError(null)
          setInfo(null)
        }}
      >
        {mode === 'sign-in' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
      </button>
    </form>
  )
}
