import { StrictMode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './app/routes'
import { AuthProvider } from './features/auth/AuthProvider'
import { getSupabase } from './lib/supabase'
import './index.css'

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider client={getSupabase()}>
      {/* flushSync: фильтры подбора меняют адрес без перехода (transition) — см. RecipesPage. */}
      <RouterProvider router={router} flushSync={(fn) => void flushSync(fn)} />
    </AuthProvider>
  </StrictMode>,
)
