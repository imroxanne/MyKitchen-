import { Link } from 'react-router'
import { useAuth } from '../features/auth/authContext'
import { RequireAuth } from '../features/auth/RequireAuth'
import { usePantryApi } from '../features/matching/usePantry'
import type { PantryApi } from '../features/pantry/types'
import { RestrictionsSection } from '../features/restrictions/RestrictionsSection'
import type { RestrictionsApi } from '../features/restrictions/types'
import { useRestrictionsApi } from '../features/restrictions/useRestrictions'

export function ProfilePage({
  restrictionsApi,
  pantryApi,
}: {
  restrictionsApi?: RestrictionsApi
  pantryApi?: PantryApi
}) {
  const { state, client } = useAuth()
  const restrictions = useRestrictionsApi(restrictionsApi)
  const pantry = usePantryApi(pantryApi)
  return (
    <section aria-labelledby="profile-title">
      <h1 id="profile-title">Профиль</h1>
      <RequireAuth>
        {restrictions && pantry && <RestrictionsSection api={restrictions} pantryApi={pantry} />}
        <div className="card">
          <h2>Аккаунт</h2>
          <p>{state.status === 'signed-in' ? state.session.user.email : ''}</p>
          <button type="button" onClick={() => client?.auth.signOut()}>
            Выйти
          </button>
        </div>
      </RequireAuth>
      <p className="notice" role="note">
        Оборудование, личные параметры и настройки приватности появятся в пункте E1.
      </p>
      <p>
        <Link to="/status">Состояние системы</Link>
      </p>
    </section>
  )
}
