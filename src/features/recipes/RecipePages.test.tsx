import type { Session } from '@supabase/supabase-js'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/authContext'
import {
  createMemoryRecipesApi,
  openLicenseRecipe,
  unverifiedRecipe,
} from '../../test/recipeFixtures'
import { RecipePage } from './RecipePage'
import { RecipesPage } from './RecipesPage'

const session = { user: { id: 'u1', email: 'owner@example.test' } } as unknown as Session

function renderAt(path: string) {
  const api = createMemoryRecipesApi([openLicenseRecipe, unverifiedRecipe])
  const router = createMemoryRouter(
    [
      { path: '/', element: <RecipesPage api={api} /> },
      { path: '/recipes/:id', element: <RecipePage api={api} /> },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
}

describe('рецепты', () => {
  it('список → нажатие на карточку → полный рецепт → назад', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const list = await screen.findByRole('list', { name: 'Рецепты' })
    const card = within(list).getByRole('link', { name: /Тестовый суп/ })
    expect(card).toHaveTextContent('1 ч · 4 порции')
    expect(card).toHaveTextContent('Не проверен приготовлением')

    await user.click(card)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Тестовый суп' }),
    ).toBeInTheDocument()

    // Переход к оригиналу — в новой вкладке.
    const original = screen.getByRole('link', { name: /Открыть оригинал \(Викиучебник\)/ })
    expect(original).toHaveAttribute('href', 'https://ru.wikibooks.org/wiki/Тест')
    expect(original).toHaveAttribute('target', '_blank')

    // Статусы с пояснениями.
    const trust = screen.getByRole('list', { name: 'Статус проверки' })
    expect(trust).toHaveTextContent('Не проверен приготовлением')
    expect(trust).toHaveTextContent('Ингредиенты и шаги сверены с версией 123.')

    // Ингредиенты и шаги.
    const ingredients = screen.getByRole('region', { name: 'Ингредиенты' })
    expect(within(ingredients).getByText('300 г')).toBeInTheDocument()
    expect(within(ingredients).getAllByText('по вкусу').length).toBeGreaterThan(0)
    expect(within(ingredients).getByText('по желанию')).toBeInTheDocument()
    const steps = within(screen.getByRole('region', { name: 'Приготовление' })).getAllByRole(
      'listitem',
    )
    expect(steps.map((s) => s.textContent)).toEqual([
      'Нарезать свёклу. (10 мин)',
      'Варить до готовности.',
    ])

    // Источник, лицензия и авторы.
    const source = screen.getByRole('region', { name: 'Источник' })
    expect(within(source).getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/deed.ru',
    )
    expect(within(source).getByRole('link', { name: 'история правок' })).toBeInTheDocument()
    expect(source).toHaveTextContent('Шаги пересказаны своими словами.')
    expect(source).toHaveTextContent('версия страницы 123')

    await user.click(screen.getByRole('link', { name: '← Все рецепты' }))
    expect(await screen.findByRole('list', { name: 'Рецепты' })).toBeInTheDocument()
  })

  it('непроверенный рецепт обозначен честно, неизвестное не выдумано', async () => {
    renderAt('/recipes/2')
    await screen.findByRole('heading', { level: 1, name: 'Тестовый салат без проверки' })
    const trust = screen.getByRole('list', { name: 'Статус проверки' })
    expect(trust).toHaveTextContent('Источник не проверен')
    expect(trust).toHaveTextContent('Не проверен приготовлением')
    expect(screen.getByText('время не указано в источнике')).toBeInTheDocument()
    expect(screen.getByText('число порций не указано в источнике')).toBeInTheDocument()
  })

  it('несуществующий рецепт', async () => {
    renderAt('/recipes/999')
    expect(await screen.findByRole('heading', { name: 'Рецепт не найден' })).toBeInTheDocument()
  })
})
