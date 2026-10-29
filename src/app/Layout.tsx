import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { sections } from './sections'
import { Icon } from './icons'
import { config } from '../lib/env'

export function Layout() {
  // Страница рецепта относится к разделу «Что приготовить».
  const onRecipe = useLocation().pathname.startsWith('/recipes/')
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="cook" />
          </span>
          MyKitchen
        </NavLink>
        {config.environment !== 'production' && (
          <span className="env-badge" title="Окружение сборки">
            {config.environment}
          </span>
        )}
      </header>

      {/* Телефон: пять вкладок внизу, профиль — кружок в шапке. Десктоп: колонка слева. */}
      <nav className="tabbar" aria-label="Разделы">
        {sections.map((section) => (
          <NavLink
            key={section.path}
            to={section.path}
            end={section.path === '/'}
            className={({ isActive }) =>
              [
                'tab',
                section.path === '/profile' && 'tab-profile',
                (isActive || (onRecipe && section.path === '/')) && 'tab-active',
              ]
                .filter(Boolean)
                .join(' ')
            }
          >
            <Icon name={section.icon} />
            <span className="tab-label">{section.shortTitle}</span>
          </NavLink>
        ))}
      </nav>

      <main className="content" id="main">
        <Outlet />
      </main>
      {/* Новый экран открывается сверху; «назад» возвращает прежнюю прокрутку. */}
      <ScrollRestoration />
    </div>
  )
}
