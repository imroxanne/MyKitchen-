import type { Session } from '@supabase/supabase-js'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/authContext'
import { createMemoryPantryApi, testCatalog } from '../../test/memoryPantryApi'
import {
  createMemoryRecipesApi,
  milkRecipe,
  openLicenseRecipe,
  unverifiedRecipe,
} from '../../test/recipeFixtures'
import type { UserProduct } from '../pantry/types'
import { RecipePage } from './RecipePage'
import { RecipesPage } from './RecipesPage'

const session = { user: { id: 'u1', email: 'owner@example.test' } } as unknown as Session

function renderAt(
  path: string,
  products: Omit<UserProduct, 'id' | 'kind' | 'expiresOn' | 'isExcluded'>[] = [],
) {
  const api = createMemoryRecipesApi([openLicenseRecipe, unverifiedRecipe, milkRecipe])
  const pantry = createMemoryPantryApi(testCatalog)
  pantry.store.products.push(
    ...products.map((p, i) => ({
      ...p,
      id: i + 1,
      kind: 'current' as const,
      expiresOn: null,
      isExcluded: false,
    })),
  )
  const router = createMemoryRouter(
    [
      { path: '/', element: <RecipesPage api={api} pantryApi={pantry.api} /> },
      { path: '/recipes/:id', element: <RecipePage api={api} pantryApi={pantry.api} /> },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return router
}

// Запасы: свёкла 500 г, молоко без количества.
const PANTRY = [
  { ingredientId: 6, quantity: 500, unitCode: 'g' },
  { ingredientId: 4, quantity: null, unitCode: null },
]

const listTitles = async () =>
  within(await screen.findByRole('list', { name: 'Рецепты' }))
    .getAllByRole('link')
    .map((a) => a.querySelector('.recipe-card-title')?.textContent)

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

describe('подбор по продуктам и фильтры', () => {
  it('без запасов — подбор без учёта запасов и подсказка добавить продукты', async () => {
    renderAt('/')
    expect(await listTitles()).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'Без учёта запасов' })).toBeChecked()
    expect(screen.getByRole('link', { name: 'Добавить продукты' })).toHaveAttribute(
      'href',
      '/pantry',
    )
  })

  it('режимы учитывают недостающие продукты, фильтры совмещаются и сохраняются в адресе', async () => {
    const user = userEvent.setup()
    const router = renderAt('/', PANTRY)
    // По умолчанию «докупить не больше 3»: каше не хватает моркови — она ниже.
    expect(await listTitles()).toEqual([
      'Тестовый суп',
      'Тестовый салат без проверки',
      'Тестовая молочная каша',
    ])
    const porridge = screen.getByRole('link', { name: /Тестовая молочная каша/ })
    expect(porridge).toHaveTextContent('Не хватает: Морковь')
    expect(porridge).toHaveTextContent('Количество не сравнивалось: Молоко')
    expect(porridge).toHaveTextContent('есть 1 из 2')
    expect(screen.getByRole('link', { name: /Тестовый суп/ })).toHaveTextContent(
      'Все нужные продукты есть',
    )

    // «Из имеющегося» — каша исключена.
    await user.click(screen.getByRole('radio', { name: 'Из имеющегося' }))
    expect(await listTitles()).toEqual(['Тестовый суп', 'Тестовый салат без проверки'])
    expect(router.state.location.search).toContain('mode=have')

    // Обратно «докупить» + завтрак + до 15 минут — остаётся только каша.
    await user.click(screen.getByRole('radio', { name: 'Докупить не больше' }))
    await user.click(screen.getByRole('button', { name: 'Завтрак' }))
    await user.selectOptions(screen.getByLabelText('Время'), '15')
    expect(await listTitles()).toEqual(['Тестовая молочная каша'])
    // Докупить не больше 0 нельзя — минимум 1; при 1 каша остаётся.
    await user.selectOptions(screen.getByLabelText('Сколько продуктов можно докупить'), '1')
    expect(await listTitles()).toEqual(['Тестовая молочная каша'])
    expect(router.state.location.search).toMatch(/meal=breakfast/)
    expect(router.state.location.search).toMatch(/t=15/)

    // Поиск по ингредиенту в сочетании с типом блюда ничего не находит — понятное пустое состояние.
    await user.type(
      screen.getByRole('searchbox', { name: 'Поиск по названию и ингредиентам' }),
      'свёкла',
    )
    expect(await screen.findByText('Под выбранные условия рецептов нет.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(await listTitles()).toHaveLength(3)
  })

  it('фильтр по времени скрывает рецепты без указанного времени и сообщает об этом', async () => {
    const user = userEvent.setup()
    renderAt('/?mode=ignore')
    await listTitles()
    await user.selectOptions(screen.getByLabelText('Время'), '60')
    expect(await listTitles()).toEqual(['Тестовая молочная каша', 'Тестовый суп'])
    expect(screen.getByRole('status')).toHaveTextContent(
      'скрыто 1 без указанного в источнике времени',
    )
  })

  it('страница рецепта отмечает, что есть и чего нет', async () => {
    renderAt('/recipes/3', PANTRY)
    await screen.findByRole('heading', { level: 1, name: 'Тестовая молочная каша' })
    const ingredients = screen.getByRole('region', { name: 'Ингредиенты' })
    expect(await within(ingredients).findByText(/Не хватает: Морковь/)).toBeInTheDocument()
    expect(within(ingredients).getByText('есть, количество не сравнивалось')).toBeInTheDocument()
    expect(within(ingredients).getByText('нет')).toBeInTheDocument()
  })
})
