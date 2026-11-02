import type { Session } from '@supabase/supabase-js'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'react-dom'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/authContext'
import { FavoritesPage } from '../favorites/FavoritesPage'
import { createMemoryFavoritesApi } from '../../test/memoryFavoritesApi'
import { createMemoryPantryApi, testCatalog } from '../../test/memoryPantryApi'
import { createMemoryRestrictionsApi } from '../../test/memoryRestrictionsApi'
import {
  createMemoryRecipesApi,
  milkRecipe,
  openLicenseRecipe,
  unverifiedRecipe,
} from '../../test/recipeFixtures'
import { ProfilePage } from '../../pages/ProfilePage'
import { RecipePage } from '../recipes/RecipePage'
import { RecipesPage } from '../recipes/RecipesPage'

const session = { user: { id: 'u1', email: 'owner@example.test' } } as unknown as Session

// ТЕСТОВЫЕ данные: каша — молоко (основа) и морковь; суп — свёкла, соль и сметана «по желанию».
function setup(
  path: string,
  prepare: (restrictions: ReturnType<typeof createMemoryRestrictionsApi>) => void = () => {},
) {
  const recipes = createMemoryRecipesApi([openLicenseRecipe, unverifiedRecipe, milkRecipe])
  const pantry = createMemoryPantryApi(testCatalog)
  const restrictions = createMemoryRestrictionsApi()
  prepare(restrictions)
  const favorites = createMemoryFavoritesApi()
  const props = {
    api: recipes,
    pantryApi: pantry.api,
    favoritesApi: favorites.api,
    restrictionsApi: restrictions.api,
  }
  const router = createMemoryRouter(
    [
      { path: '/', element: <RecipesPage {...props} /> },
      { path: '/recipes/:id', element: <RecipePage {...props} /> },
      { path: '/favorites', element: <FavoritesPage {...props} /> },
      {
        path: '/profile',
        element: <ProfilePage restrictionsApi={restrictions.api} pantryApi={pantry.api} />,
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
      <RouterProvider router={router} flushSync={(fn) => void flushSync(fn)} />
    </AuthContext.Provider>,
  )
  return { router, restrictions, favorites }
}

const milkAllergy = (store: ReturnType<typeof createMemoryRestrictionsApi>['store']) =>
  store.restrictions.push({
    id: 50,
    kind: 'allergy',
    groupCode: 'milk',
    ingredientId: null,
    note: null,
    exceptions: [],
  })

const titles = async () =>
  within(await screen.findByRole('list', { name: 'Рецепты' }))
    .getAllByRole('link')
    .map((a) => a.querySelector('.recipe-card-title')?.textContent)

describe('ограничения в профиле', () => {
  it('добавить, изменить вид, отметить переносимые, удалить', async () => {
    const user = userEvent.setup()
    const { restrictions } = setup('/profile')
    const section = await screen.findByRole('region', { name: 'Пищевые ограничения' })
    expect(within(section).getByText(/Ограничений нет/)).toBeInTheDocument()

    // Непереносимость лактозы.
    const form = within(section).getByRole('form', { name: 'Добавить ограничение' })
    await user.selectOptions(within(form).getByLabelText('Вид'), 'Непереносимость')
    await user.selectOptions(within(form).getByLabelText('Группа'), 'Лактоза')
    expect(within(form).getByText('Молочный сахар.')).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Добавить ограничение' }))
    expect(await within(section).findByRole('status')).toHaveTextContent(
      'Добавлено ограничение: Лактоза.',
    )
    // Группа, которая уже есть, второй раз не предлагается.
    expect(
      within(within(form).getByLabelText('Группа')).queryByRole('option', { name: 'Лактоза' }),
    ).toBeNull()

    // Переносимые: молоко.
    const list = within(section).getByRole('list', { name: 'Ваши ограничения' })
    await user.click(within(list).getByText(/Переношу/))
    await user.click(within(list).getByRole('checkbox', { name: 'Молоко' }))
    await user.click(within(list).getByRole('button', { name: 'Сохранить переносимые' }))
    expect(await within(section).findByRole('status')).toHaveTextContent(
      'Лактоза: переносимые продукты сохранены.',
    )
    expect(restrictions.store.restrictions[0]).toMatchObject({
      kind: 'intolerance',
      exceptions: [4],
    })

    // Стала аллергией — переносимые снимаются, отметить их нельзя.
    await user.selectOptions(within(list).getByLabelText('Вид ограничения: Лактоза'), 'Аллергия')
    expect(await within(section).findByRole('status')).toHaveTextContent('Лактоза: аллергия.')
    expect(restrictions.store.restrictions[0]!.exceptions).toEqual([])
    expect(within(list).queryByText(/Переношу/)).toBeNull()
    expect(within(list).getByText(/переносимые продукты не отмечаются/)).toBeInTheDocument()

    // Конкретный продукт.
    await user.click(within(form).getByLabelText('конкретный продукт'))
    await user.type(within(form).getByLabelText('Продукт'), 'морк')
    await user.click(within(form).getByRole('button', { name: /Морковь/ }))
    await user.type(within(form).getByLabelText('Заметка (необязательно)'), 'не люблю')
    await user.click(within(form).getByRole('button', { name: 'Добавить ограничение' }))
    expect(await within(list).findByText('Морковь')).toBeInTheDocument()
    // Вид в форме остаётся последним выбранным.
    expect(restrictions.store.restrictions[1]).toMatchObject({
      kind: 'intolerance',
      ingredientId: 3,
      note: 'не люблю',
    })

    // Удаление с подтверждением.
    await user.click(within(list).getByRole('button', { name: 'Удалить: Морковь' }))
    await user.click(within(list).getByRole('button', { name: 'Да, удалить' }))
    expect(await within(section).findByRole('status')).toHaveTextContent(
      'Ограничение «Морковь» удалено.',
    )
    expect(restrictions.store.restrictions).toHaveLength(1)
  })

  it('быстрый набор добавляет только недостающие группы', async () => {
    const user = userEvent.setup()
    const { restrictions } = setup('/profile')
    const section = await screen.findByRole('region', { name: 'Пищевые ограничения' })
    await user.click(within(section).getByRole('button', { name: '+ Вегетарианство' }))
    expect(await within(section).findByRole('status')).toHaveTextContent(
      'Добавлено: вегетарианство.',
    )
    // В тестовом справочнике из вегетарианских групп есть только «Мясо».
    expect(restrictions.store.restrictions.map((r) => [r.kind, r.groupCode])).toEqual([
      ['preference', 'meat'],
    ])
    await user.click(within(section).getByRole('button', { name: '+ Вегетарианство' }))
    expect(await within(section).findByRole('status')).toHaveTextContent('Эти группы уже есть')
  })

  it('ошибка загрузки — сообщение и повтор', async () => {
    const user = userEvent.setup()
    const ctx = createMemoryRestrictionsApi()
    ctx.store.failNext = 'Нет связи с сервером'
    const pantry = createMemoryPantryApi(testCatalog)
    const router = createMemoryRouter(
      [
        {
          path: '/profile',
          element: <ProfilePage restrictionsApi={ctx.api} pantryApi={pantry.api} />,
        },
      ],
      { initialEntries: ['/profile'] },
    )
    render(
      <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
        <RouterProvider router={router} />
      </AuthContext.Provider>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи с сервером')
    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText(/Ограничений нет/)).toBeInTheDocument()
  })
})

describe('строгий отбор', () => {
  it('в рецепте нет продуктов из ограничений — «подходит»', async () => {
    setup('/recipes/3', (r) =>
      r.store.restrictions.push({
        id: 51,
        kind: 'medical',
        groupCode: 'gluten',
        ingredientId: null,
        note: null,
        exceptions: [],
      }),
    )
    expect(await screen.findByText(/По вашим ограничениям подходит/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /по вашим ограничениям/ })).toBeNull()
  })

  it('без ограничений — все рецепты, без пометок', async () => {
    setup('/?mode=ignore')
    expect(await titles()).toHaveLength(3)
    expect(document.querySelector('.recipe-card-restriction')).toBeNull()
  })

  it('аллергия на молоко: каша скрыта, суп помечен; показать скрытые — с пометкой', async () => {
    const user = userEvent.setup()
    const { router } = setup('/?mode=ignore', (r) => milkAllergy(r.store))
    expect(await titles()).not.toContain('Тестовая молочная каша')
    expect(screen.getByRole('status')).toHaveTextContent('скрыто по вашим ограничениям: 1')
    const soup = screen.getByRole('link', { name: /Тестовый суп/ })
    expect(within(soup).getByText('Проверьте: молоко (белок молока)')).toHaveClass(
      'restriction-check',
    )

    await user.click(screen.getByRole('button', { name: 'Показать не подходящие по ограничениям' }))
    expect(router.state.location.search).toContain('restricted=show')
    const porridge = await screen.findByRole('link', { name: /Тестовая молочная каша/ })
    expect(within(porridge).getByText('Не подходит: молоко (белок молока)')).toHaveClass(
      'restriction-forbidden',
    )
    await user.click(screen.getByRole('button', { name: 'Скрыть не подходящие по ограничениям' }))
    expect(await titles()).not.toContain('Тестовая молочная каша')
  })

  it('ограничения не загрузились — список не показывается как подходящий', async () => {
    const user = userEvent.setup()
    setup('/?mode=ignore', (r) => (r.store.failNext = 'Нет связи с сервером'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи с сервером')
    expect(screen.queryByRole('list', { name: 'Рецепты' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await titles()).toHaveLength(3)
  })

  it('рецепт объясняет, что не подходит, и помечает строки; избранное — только помечает', async () => {
    const user = userEvent.setup()
    const { router } = setup('/recipes/3', (r) => milkAllergy(r.store))
    const notice = await screen.findByRole('region', { name: 'Не подходит по вашим ограничениям' })
    expect(notice).toHaveTextContent('Молоко: молоко (белок молока) — аллергия.')
    const ingredients = screen.getByRole('region', { name: 'Ингредиенты' })
    const milkLine = within(ingredients).getByText('Молоко').closest('li')!
    expect(within(milkLine).getByText('нельзя')).toBeInTheDocument()
    // Избранное по ограничениям не скрывается.
    await user.click(screen.getByRole('button', { name: /В избранное/ }))

    await router.navigate('/recipes/1')
    const check = await screen.findByRole('region', { name: 'Проверьте по вашим ограничениям' })
    expect(check).toHaveTextContent(
      'Сметана: молоко (белок молока) — аллергия. Продукт по желанию — можно не добавлять.',
    )

    await router.navigate('/favorites')
    const card = await screen.findByRole('link', { name: /Тестовая молочная каша/ })
    expect(within(card).getByText('Не подходит: молоко (белок молока)')).toBeInTheDocument()
    await user.click(card)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Тестовая молочная каша',
    )
  })
})
