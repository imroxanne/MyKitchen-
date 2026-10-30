import type { Session } from '@supabase/supabase-js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'react-dom'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/authContext'
import { createMemoryFavoritesApi } from '../../test/memoryFavoritesApi'
import { createMemoryPantryApi, testCatalog } from '../../test/memoryPantryApi'
import {
  createMemoryRecipesApi,
  openLicenseRecipe,
  unverifiedRecipe,
} from '../../test/recipeFixtures'
import { RecipePage } from './RecipePage'

const session = { user: { id: 'u1', email: 'owner@example.test' } } as unknown as Session

function renderRecipe(id: number, admin: boolean) {
  const api = createMemoryRecipesApi([openLicenseRecipe, unverifiedRecipe], { admin })
  const router = createMemoryRouter(
    [
      {
        path: '/recipes/:id',
        element: (
          <RecipePage
            api={api}
            pantryApi={createMemoryPantryApi(testCatalog).api}
            favoritesApi={createMemoryFavoritesApi().api}
          />
        ),
      },
    ],
    { initialEntries: [`/recipes/${id}`] },
  )
  render(
    <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
      <RouterProvider router={router} flushSync={(fn) => void flushSync(fn)} />
    </AuthContext.Provider>,
  )
}

describe('фото блюда', () => {
  it('подпись ведёт на страницу фото с автором и лицензией; кнопок у обычного пользователя нет', async () => {
    renderRecipe(1, false)
    await screen.findByRole('heading', { level: 1, name: 'Тестовый суп' })
    expect(screen.getByRole('img', { name: 'Фото блюда: Тестовый суп' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Фото: тестовая подпись, CC BY-SA 4.0' }),
    ).toHaveAttribute('href', 'https://example.test/soup-photo-page')
    expect(screen.queryByRole('button', { name: /фото/i })).toBeNull()
  })

  it('владелица добавляет фото только с подписью и подтверждением прав, затем убирает его', async () => {
    const user = userEvent.setup()
    renderRecipe(2, true)
    await screen.findByRole('heading', { level: 1, name: 'Тестовый салат без проверки' })
    expect(screen.queryByRole('img', { name: /Фото блюда/ })).toBeNull()

    await user.click(await screen.findByRole('button', { name: 'Добавить фото' }))
    const form = screen.getByRole('form', { name: 'Фото блюда' })
    const save = screen.getByRole('button', { name: 'Сохранить фото' })
    expect(save).toBeDisabled()

    await user.upload(
      screen.getByLabelText('Файл (JPEG, PNG или WebP)'),
      new File(['x'], 'salad.jpg', { type: 'image/jpeg' }),
    )
    // Без подтверждения прав — нельзя.
    expect(save).toBeDisabled()
    await user.click(screen.getByLabelText('Фото моё или у меня есть право его использовать'))
    // Без подписи — тоже нельзя.
    await user.clear(screen.getByLabelText('Подпись: автор и права'))
    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText('Подпись: автор и права'), 'Фото: моё')
    await user.click(save)

    expect(await screen.findByText('Фото сохранено.')).toBeInTheDocument()
    expect(form).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Фото блюда: Тестовый салат без проверки' }),
    ).toHaveAttribute('src', 'https://example.test/uploaded/2.jpg')
    expect(screen.getByText('Фото: моё')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Убрать фото' }))
    expect(await screen.findByText('Фото убрано.')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Фото блюда/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Добавить фото' })).toBeInTheDocument()
  })
})
