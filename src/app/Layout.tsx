import { NavLink, Outlet, useLocation } from 'react-router'
import { sections } from './sections'
import { config } from '../lib/env'

export function Layout() {
  // Страница рецепта относится к разделу «Что приготовить».
  const onRecipe = useLocation().pathname.startsWith('/recipes/')
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          MyKitchen
        </NavLink>
        {config.environment !== 'production' && (
          <span className="env-badge" title="Окружение сборки">
            {config.environment}
          </span>
        )}
      </header>

      <main className="content" id="main">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Разделы">
        {sections.map((section) => (
          <NavLink
            key={section.path}
            to={section.path}
            end={section.path === '/'}
            className={({ isActive }) =>
              isActive || (onRecipe && section.path === '/') ? 'tab tab-active' : 'tab'
            }
          >
            {section.shortTitle}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
