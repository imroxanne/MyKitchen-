import type { Session } from '@supabase/supabase-js'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'react-dom'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/authContext'
import { createMemoryFavoritesApi } from '../../test/memoryFavoritesApi'
import { createMemoryPantryApi, testCatalog } from '../../test/memoryPantryApi'
import { createMemoryRestrictionsApi } from '../../test/memoryRestrictionsApi'
import {
  createMemoryRecipesApi,
  milkRecipe,
  openLicenseRecipe,
  unverifiedRecipe,
} from '../../test/recipeFixtures'
import { RecipePage } from '../recipes/RecipePage'
import { RecipesPage } from '../recipes/RecipesPage'
import type { UserRestriction } from './types'

const session = { user: { id: 'u1', email: 'owner@example.test' } } as unknown as Session

// ТЕСТОВЫЕ данные: каша (варка) — молоко 200 мл и морковь. Замены молока: безлактозное (везде,
// содержит белок молока) и вода (только выпечка); сметаны — йогурт.
function setup(path: string, restriction: Partial<UserRestriction>) {
  const recipes = createMemoryRecipesApi([openLicenseRecipe, unverifiedRecipe, milkRecipe])
  const pantry = createMemoryPantryApi(testCatalog)
  const restrictions = createMemoryRestrictionsApi()
  restrictions.store.restrictions.push({
    id: 50,
    kind: 'allergy',
    groupCode: null,
    ingredientId: null,
    note: null,
    exceptions: [],
    ...restriction,
  })
  const props = {
    api: recipes,
    pantryApi: pantry.api,
    favoritesApi: createMemoryFavoritesApi().api,
    restrictionsApi: restrictions.api,
  }
  const router = createMemoryRouter(
    [
      { path: '/', element: <RecipesPage {...props} /> },
      { path: '/recipes/:id', element: <RecipePage {...props} /> },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
      <RouterProvider router={router} flushSync={(fn) => void flushSync(fn)} />
    </AuthContext.Provider>,
  )
  return { router, recipes }
}

describe('замены в рецепте', () => {
  it('аллергия на молоко: безлактозное заблокировано с причиной, вода — не для этого блюда', async () => {
    setup('/recipes/3', { kind: 'allergy', groupCode: 'milk' })
    const notice = await screen.findByRole('region', { name: 'Не подходит по вашим ограничениям' })
    const subs = within(notice).getByRole('list', { name: 'Замены: Молоко' })
    const [water, lactoseFree] = within(subs).getAllByRole('listitem')
    expect(water).toHaveTextContent(
      'Вода — 1:1. Не для этого блюда: ТЕСТ: где применима замена «Вода»',
    )
    expect(lactoseFree).toHaveTextContent(
      'Молоко безлактозное — 1:1. Вам не подходит: Молоко безлактозное: молоко (белок молока) — аллергия.',
    )
    expect(within(notice).queryByRole('button', { name: /Своя версия с заменой/ })).toBeNull()
  })

  it('непереносимость лактозы: безлактозное подходит — своя версия с заменой', async () => {
    const user = userEvent.setup()
    const { recipes } = setup('/recipes/3', { kind: 'intolerance', groupCode: 'lactose' })
    const notice = await screen.findByRole('region', { name: 'Не подходит по вашим ограничениям' })
    const subs = within(notice).getByRole('list', { name: 'Замены: Молоко' })
    const lactoseFree = within(subs).getAllByRole('listitem')[0]!
    // У подходящей замены — применимость, влияние, предупреждение и уровень подтверждения.
    expect(lactoseFree).toHaveTextContent('ТЕСТ: где применима замена «Молоко безлактозное»')
    expect(lactoseFree).toHaveTextContent('ТЕСТ: влияние замены «Молоко безлактозное»')
    expect(lactoseFree).toHaveTextContent('⚠ ТЕСТ: предупреждение о замене «Молоко безлактозное»')
    expect(lactoseFree).toHaveTextContent('Подтверждение: распространённая практика')

    await user.click(
      within(lactoseFree).getByRole('button', {
        name: 'Своя версия с заменой на «Молоко безлактозное»',
      }),
    )
    const editor = await screen.findByRole('region', { name: 'Моя версия' })
    expect(within(editor).getByLabelText('Название версии')).toHaveValue(
      'С заменой: Молоко безлактозное',
    )
    expect(editor).toHaveTextContent('заменено, было: Молоко')
    expect(within(editor).getByLabelText('Количество: Молоко безлактозное')).toHaveValue('200')
    await user.click(within(editor).getByRole('button', { name: 'Сохранить версию' }))
    expect(await screen.findByText(/Версия сохранена/)).toBeInTheDocument()
    const [saved] = await recipes.listVersions(3)
    expect(saved?.ingredients.map((l) => [l.ingredientId, l.quantity])).toEqual([
      [20, 200],
      [3, 2],
    ])
    // Сохранённая версия проходит по ограничениям.
    expect(await screen.findByText(/По вашим ограничениям подходит/)).toBeInTheDocument()
  })
})

describe('режим «с заменами» в подборе', () => {
  it('аллергия на молоко: каше нечем заменить молоко — вариантов нет', async () => {
    setup('/?mode=ignore', { kind: 'allergy', groupCode: 'milk' })
    await screen.findByRole('list', { name: 'Рецепты' })
    expect(screen.getByRole('status')).toHaveTextContent('скрыто по вашим ограничениям: 1')
    expect(screen.queryByRole('button', { name: /Варианты с заменами/ })).toBeNull()
  })

  it('непереносимость лактозы: каша показывается с заменой', async () => {
    const user = userEvent.setup()
    const { router } = setup('/?mode=ignore', { kind: 'intolerance', groupCode: 'lactose' })
    const list = await screen.findByRole('list', { name: 'Рецепты' })
    expect(within(list).queryByRole('link', { name: /молочная каша/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Варианты с заменами: 1' }))
    expect(router.state.location.search).toContain('subs=1')
    const card = await screen.findByRole('link', { name: /молочная каша/ })
    expect(within(card).getByText('С заменой: Молоко → Молоко безлактозное')).toHaveClass(
      'restriction-check',
    )
    expect(screen.getByRole('status')).not.toHaveTextContent('скрыто')
    await user.click(screen.getByRole('button', { name: 'Без вариантов с заменами' }))
    expect(screen.queryByRole('link', { name: /молочная каша/ })).toBeNull()
  })
})
