import { Link } from 'react-router'
import { useAuth } from '../features/auth/authContext'
import { RequireAuth } from '../features/auth/RequireAuth'

export function ProfilePage() {
  const { state, client } = useAuth()
  return (
    <section aria-labelledby="profile-title">
      <h1 id="profile-title">Профиль</h1>
      <RequireAuth>
        <div className="card">
          <h2>Аккаунт</h2>
          <p>{state.status === 'signed-in' ? state.session.user.email : ''}</p>
          <button type="button" onClick={() => client?.auth.signOut()}>
            Выйти
          </button>
        </div>
      </RequireAuth>
      <p className="notice" role="note">
        Ограничения, предпочтения и оборудование появятся в пунктах дорожной карты B4, E1.
      </p>
      <p>
        <Link to="/status">Состояние системы</Link>
      </p>
    </section>
  )
}
