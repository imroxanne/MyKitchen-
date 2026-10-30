import type { Session } from '@supabase/supabase-js'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'react-dom'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/authContext'
import { FavoritesPage } from '../favorites/FavoritesPage'
import { createMemoryFavoritesApi } from '../../test/memoryFavoritesApi'
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
  favorites = createMemoryFavoritesApi(),
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
      {
        path: '/',
        element: <RecipesPage api={api} pantryApi={pantry.api} favoritesApi={favorites.api} />,
      },
      {
        path: '/recipes/:id',
        element: <RecipePage api={api} pantryApi={pantry.api} favoritesApi={favorites.api} />,
      },
      {
        path: '/favorites',
        element: <FavoritesPage api={api} pantryApi={pantry.api} favoritesApi={favorites.api} />,
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
      <RouterProvider router={router} flushSync={(fn) => void flushSync(fn)} />
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

describe('избранное, возврат к списку, шаги', () => {
  it('сердечко на карточке сохраняет рецепт, не открывая его', async () => {
    const user = userEvent.setup()
    const favorites = createMemoryFavoritesApi()
    const router = renderAt('/', [], favorites)
    const heart = await screen.findByRole('button', { name: 'В избранное: Тестовый суп' })
    await waitFor(() => expect(heart).toBeEnabled())
    expect(heart).toHaveAttribute('aria-pressed', 'false')

    await user.click(heart)
    expect(heart).toHaveAttribute('aria-pressed', 'true')
    expect(router.state.location.pathname).toBe('/')
    await waitFor(() => expect(favorites.store.ids).toEqual([1]))

    // Карточка по-прежнему открывается нажатием.
    await user.click(screen.getByRole('link', { name: /Тестовый суп/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Тестовый суп' })).toBeVisible()
  })

  it('избранное внутри рецепта и на экране «Избранное»; назад — в избранное', async () => {
    const user = userEvent.setup()
    const favorites = createMemoryFavoritesApi()
    const router = renderAt('/favorites', [], favorites)
    expect(await screen.findByText('В избранном пока ничего нет.')).toBeInTheDocument()

    await router.navigate('/recipes/3')
    const button = await screen.findByRole('button', { name: 'В избранное' })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Рецепт сохранён в избранном.')).toBeInTheDocument()
    await waitFor(() => expect(favorites.store.ids).toEqual([3]))

    await router.navigate('/favorites')
    const list = await screen.findByRole('list', { name: 'Избранные рецепты' })
    const card = within(list).getByRole('link', { name: /Тестовая молочная каша/ })
    await user.click(card)
    await screen.findByRole('heading', { level: 1, name: 'Тестовая молочная каша' })
    await user.click(screen.getByRole('link', { name: '← Избранное' }))
    expect(await screen.findByRole('list', { name: 'Избранные рецепты' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/favorites')

    // Убранный рецепт остаётся на экране до ухода — нажатие можно отменить.
    await user.click(screen.getByRole('button', { name: 'В избранное: Тестовая молочная каша' }))
    await waitFor(() => expect(favorites.store.ids).toEqual([]))
    expect(screen.getByRole('status')).toHaveTextContent('Сохранено: 0')
    expect(screen.getByRole('link', { name: /Тестовая молочная каша/ })).toBeInTheDocument()
  })

  it('ошибка сохранения: сердечко возвращается, причина показана', async () => {
    const user = userEvent.setup()
    const favorites = createMemoryFavoritesApi()
    favorites.store.failNext = true
    renderAt('/', [], favorites)
    const heart = await screen.findByRole('button', { name: 'В избранное: Тестовый суп' })
    await waitFor(() => expect(heart).toBeEnabled())
    await user.click(heart)
    expect(await screen.findByRole('alert')).toHaveTextContent('не удалось сохранить избранное')
    expect(heart).toHaveAttribute('aria-pressed', 'false')
    expect(favorites.store.ids).toEqual([])
  })

  it('«назад» из рецепта возвращает к списку с теми же фильтрами', async () => {
    const user = userEvent.setup()
    const router = renderAt('/?mode=ignore&meal=breakfast')
    expect(await listTitles()).toEqual(['Тестовая молочная каша'])
    await user.click(screen.getByRole('link', { name: /Тестовая молочная каша/ }))
    await screen.findByRole('heading', { level: 1, name: 'Тестовая молочная каша' })
    await user.click(screen.getByRole('link', { name: '← Все рецепты' }))
    expect(await listTitles()).toEqual(['Тестовая молочная каша'])
    expect(router.state.location.search).toBe('?mode=ignore&meal=breakfast')
  })

  it('по прямой ссылке «назад» ведёт к списку рецептов', async () => {
    const user = userEvent.setup()
    const router = renderAt('/recipes/1')
    await screen.findByRole('heading', { level: 1, name: 'Тестовый суп' })
    await user.click(screen.getByRole('link', { name: '← Все рецепты' }))
    expect(await screen.findByRole('list', { name: 'Рецепты' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('шаги приготовления отмечаются, переживают уход со страницы и сбрасываются', async () => {
    const user = userEvent.setup()
    const router = renderAt('/recipes/1')
    const reopen = async () => {
      await router.navigate('/')
      await screen.findByRole('list', { name: 'Рецепты' })
      await router.navigate('/recipes/1')
      return screen.findByRole('region', { name: 'Приготовление' })
    }
    let steps = await screen.findByRole('region', { name: 'Приготовление' })
    expect(steps).toHaveTextContent('Выполнено шагов: 0 из 2')
    await user.click(within(steps).getByRole('checkbox', { name: /Нарезать свёклу/ }))
    expect(steps).toHaveTextContent('Выполнено шагов: 1 из 2')

    steps = await reopen()
    expect(within(steps).getByRole('checkbox', { name: /Нарезать свёклу/ })).toBeChecked()
    await user.click(within(steps).getByRole('button', { name: 'Сбросить отметки' }))
    expect(steps).toHaveTextContent('Выполнено шагов: 0 из 2')

    steps = await reopen()
    expect(within(steps).getByRole('checkbox', { name: /Нарезать свёклу/ })).not.toBeChecked()
  })
})

describe('КБЖУ', () => {
  it('на странице рецепта: на порцию и на всё блюдо, источник, неучтённое «по желанию»', async () => {
    const user = userEvent.setup()
    renderAt('/recipes/1')
    const block = await screen.findByRole('region', { name: /КБЖУ/ })
    // ТЕСТОВЫЕ данные: свёкла 300 г × 40 ккал/100 г = 120 ккал; 4 порции → 30.
    const cell = (row: string, column: number) =>
      within(within(block).getByRole('row', { name: new RegExp(row) })).getAllByRole('cell')[column]
    expect(
      within(block)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Показатель', 'На порцию', 'На всё блюдо'])
    expect(cell('Калории', 0)).toHaveTextContent('30')
    expect(cell('Калории', 1)).toHaveTextContent('120')
    expect(cell('Белки', 0)).toHaveTextContent('1,5')
    expect(cell('Углеводы', 1)).toHaveTextContent('30')
    expect(block).toHaveTextContent('ориентировочно')
    expect(block).toHaveTextContent('Не учтено «по желанию»: Сметана')
    expect(block).not.toHaveTextContent('Расчёт неполный')
    expect(block).toHaveTextContent('масса готового блюда неизвестна')

    await user.click(within(block).getByText('Как посчитано'))
    expect(within(block).getByText(/Свёкла/)).toHaveTextContent('300 г')
    expect(within(block).getByRole('link', { name: 'ТЕСТОВЫЙ справочник' })).toHaveAttribute(
      'href',
      'https://example.test/nutrition',
    )
  })

  it('без числа порций — только на всё блюдо, с пояснением', async () => {
    renderAt('/recipes/2')
    const block = await screen.findByRole('region', { name: /КБЖУ/ })
    expect(within(block).queryByRole('columnheader', { name: 'На порцию' })).toBeNull()
    expect(block).toHaveTextContent('Число порций не указано в источнике')
  })

  it('на карточке — калории на порцию', async () => {
    renderAt('/?mode=ignore')
    // Каша: молоко 200 мл ≈ 200 г × 60 = 120 + морковь 2 × 50 г × 40 = 40; 2 порции → 80.
    expect(await screen.findByRole('link', { name: /Тестовая молочная каша/ })).toHaveTextContent(
      '≈ 80 ккал на порцию',
    )
    expect(screen.getByRole('link', { name: /Тестовый салат без проверки/ })).toHaveTextContent(
      '≈ 120 ккал на всё блюдо',
    )
  })
})

describe('уточнённый справочник (B1)', () => {
  // ТЕСТОВЫЕ данные: своя упаковка свёклы — 50 ккал на 100 г (в справочнике 40).
  const ownBeet = {
    ingredientId: 6,
    brand: 'ТЕСТ',
    basis: '100g' as const,
    kcal: 50,
    protein: 2,
    fat: 0,
    carbs: 10,
    packageGrams: null,
    pieceGrams: null,
    note: null,
  }

  it('свои данные с упаковки заменяют справочные в рецепте и на карточке', async () => {
    const user = userEvent.setup()
    const pantry = createMemoryPantryApi(testCatalog)
    pantry.store.userNutrition.push(ownBeet)
    const recipes = createMemoryRecipesApi([openLicenseRecipe])
    const router = createMemoryRouter(
      [
        { path: '/', element: <RecipesPage api={recipes} pantryApi={pantry.api} /> },
        { path: '/recipes/:id', element: <RecipePage api={recipes} pantryApi={pantry.api} /> },
      ],
      { initialEntries: ['/?mode=ignore'] },
    )
    render(
      <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
        <RouterProvider router={router} flushSync={(fn) => void flushSync(fn)} />
      </AuthContext.Provider>,
    )
    // 300 г × 50 / 100 = 150 ккал; 4 порции → 37,5 ≈ 38.
    expect(await screen.findByRole('link', { name: /Тестовый суп/ })).toHaveTextContent(
      '≈ 38 ккал на порцию',
    )
    await user.click(screen.getByRole('link', { name: /Тестовый суп/ }))
    const block = await screen.findByRole('region', { name: /КБЖУ/ })
    expect(
      await within(block).findByText(/По вашим данным с упаковки: Свёкла \(ТЕСТ\)/),
    ).toBeInTheDocument()
    expect(within(block).getByRole('row', { name: /Калории/ })).toHaveTextContent('150')
    await user.click(within(block).getByText('Как посчитано'))
    expect(within(block).getByText(/ваша упаковка «ТЕСТ», на 100 г/)).toBeInTheDocument()
  })

  it('масса готового блюда: на 100 г появляется, сохраняется и удаляется', async () => {
    const user = userEvent.setup()
    renderAt('/recipes/1')
    const block = await screen.findByRole('region', { name: /КБЖУ/ })
    expect(block).toHaveTextContent('На 100 г не считаем')
    const input = within(block).getByLabelText('Масса готового блюда, г')

    await user.type(input, '0')
    expect(within(block).getByRole('button', { name: 'Сохранить массу' })).toBeDisabled()
    expect(block).toHaveTextContent('число больше нуля')

    await user.clear(input)
    await user.type(input, '600')
    await user.click(within(block).getByRole('button', { name: 'Сохранить массу' }))
    // 120 ккал на блюдо / 600 г × 100 = 20 ккал на 100 г.
    expect(
      await within(block).findByRole('columnheader', { name: 'На 100 г готового' }),
    ).toBeInTheDocument()
    expect(within(block).getByRole('row', { name: /Калории/ })).toHaveTextContent(/30\s*120\s*20/)
    expect(block).toHaveTextContent('по вашему взвешиванию готового блюда: 600 г')

    await user.click(within(block).getByRole('button', { name: 'Удалить взвешивание' }))
    expect(await within(block).findByText(/На 100 г не считаем/)).toBeInTheDocument()
    expect(within(block).queryByRole('columnheader', { name: 'На 100 г готового' })).toBeNull()
  })
})

describe('порции и своя версия рецепта (B2)', () => {
  // ТЕСТОВЫЕ справочные данные свёклы для замены.
  const beetReference = [
    {
      state: 'as_purchased' as const,
      nutrition: {
        kcal: 40,
        protein: 2,
        fat: 0,
        carbs: 10,
        approximate: false,
        note: null,
        sourceCode: 'test',
        sourceFoodId: '6',
        sourceFoodName: 'TEST beet',
      },
      weights: [],
    },
  ]

  function renderRecipe(path: string) {
    const pantry = createMemoryPantryApi(testCatalog)
    pantry.store.reference.set(6, beetReference)
    const recipes = createMemoryRecipesApi([openLicenseRecipe, milkRecipe])
    const router = createMemoryRouter(
      [{ path: '/recipes/:id', element: <RecipePage api={recipes} pantryApi={pantry.api} /> }],
      { initialEntries: [path] },
    )
    render(
      <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
        <RouterProvider router={router} flushSync={(fn) => void flushSync(fn)} />
      </AuthContext.Provider>,
    )
    return { router, recipes }
  }

  const kcalRow = (block: HTMLElement) => within(block).getByRole('row', { name: /Калории/ })

  it('пересчёт порций при просмотре: количества и КБЖУ блюда меняются, на порцию — нет', async () => {
    const user = userEvent.setup()
    renderRecipe('/recipes/1')
    const ingredients = await screen.findByRole('region', { name: 'Ингредиенты' })
    expect(within(ingredients).getByText('4 порции')).toBeInTheDocument()
    await user.click(within(ingredients).getByRole('button', { name: 'Больше порций' }))
    await user.click(within(ingredients).getByRole('button', { name: 'Больше порций' }))
    expect(within(ingredients).getByText('6 порций')).toBeInTheDocument()
    expect(within(ingredients).getByText('450 г')).toBeInTheDocument()
    expect(within(ingredients).getByText('по вкусу')).toBeInTheDocument()
    // ТЕСТ: 300 г × 40 = 120 ккал на 4 порции → 180 на 6, на порцию по-прежнему 30.
    const block = screen.getByRole('region', { name: /КБЖУ/ })
    expect(kcalRow(block)).toHaveTextContent(/30\s*180/)
    // Взвешивание относится к рецепту как он есть — при пересчёте его не вводим.
    expect(within(block).queryByLabelText('Масса готового блюда, г')).toBeNull()
    await user.click(within(ingredients).getByRole('button', { name: 'как в рецепте' }))
    expect(within(ingredients).getByText('300 г')).toBeInTheDocument()
  })

  it('своя версия: изменение, замена, удаление и возврат; КБЖУ сразу; оригинал неизменен', async () => {
    const user = userEvent.setup()
    const { router, recipes } = renderRecipe('/recipes/3')
    await user.click(await screen.findByRole('button', { name: '+ Своя версия' }))
    const editor = screen.getByRole('region', { name: 'Моя версия' })
    const block = within(editor).getByRole('region', { name: /КБЖУ/ })
    // ТЕСТ: молоко 200 мл ≈ 200 г × 60 = 120 + морковь 2 × 50 г × 40 = 40 → 160, 2 порции → 80.
    expect(kcalRow(block)).toHaveTextContent(/80\s*160/)

    // Количество моркови: 1 шт. → КБЖУ пересчитан сразу, отмечено «было».
    const carrot = within(editor).getByLabelText('Количество: Морковь')
    await user.clear(carrot)
    await user.type(carrot, '1')
    expect(kcalRow(block)).toHaveTextContent(/70\s*140/)
    expect(editor).toHaveTextContent('было: 2 шт.')

    // Замена молока на свёклу; единица — граммы: 200 г × 40 = 80 + 20 → 100.
    const composition = within(editor).getByRole('list', { name: 'Состав версии' })
    const milkLine = within(composition).getByText('Молоко').closest('li')!
    await user.click(within(milkLine).getByRole('button', { name: 'Заменить' }))
    await user.type(within(milkLine).getByRole('searchbox'), 'свёк')
    await user.click(within(milkLine).getByRole('button', { name: /Свёкла/ }))
    expect(await within(editor).findByText('заменено, было: Молоко')).toBeInTheDocument()
    await user.selectOptions(within(editor).getByLabelText('Единица: Свёкла'), 'g')
    expect(kcalRow(block)).toHaveTextContent(/50\s*100/)

    // Убрали морковь и вернули.
    await user.click(within(editor).getByRole('button', { name: 'Убрать: Морковь' }))
    expect(editor).toHaveTextContent('Убрано из оригинала: Морковь (2 шт.)')
    await user.click(within(editor).getByRole('button', { name: 'вернуть' }))
    expect(within(editor).getByLabelText('Количество: Морковь')).toHaveValue('2')

    // Сохранение: вкладка версии, в адресе — номер версии.
    await user.click(within(editor).getByRole('button', { name: 'Сохранить версию' }))
    expect(
      await screen.findByText(/Версия сохранена\. Оригинальный рецепт не изменился/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Моя версия 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(router.state.location.search).toMatch(/version=\d+/)
    const [saved] = await recipes.listVersions(3)
    expect(saved.ingredients.map((l) => [l.name, l.quantity, l.unitCode])).toEqual([
      ['Свёкла', 200, 'g'],
      ['Морковь', 2, 'pcs'],
    ])

    // Оригинал не изменился.
    await user.click(screen.getByRole('button', { name: 'Оригинал' }))
    const ingredients = screen.getByRole('region', { name: 'Ингредиенты' })
    expect(within(ingredients).getByText('Молоко')).toBeInTheDocument()
    expect(within(ingredients).getByText('200 мл')).toBeInTheDocument()
    expect(kcalRow(screen.getByRole('region', { name: /КБЖУ/ }))).toHaveTextContent(/80\s*160/)

    // Удаление версии.
    await user.click(screen.getByRole('button', { name: 'Моя версия 1' }))
    await user.click(screen.getByRole('button', { name: 'Удалить версию' }))
    await user.click(screen.getByRole('button', { name: 'Да' }))
    expect(await screen.findByRole('region', { name: 'Ингредиенты' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Моя версия 1' })).toBeNull()
    expect(await recipes.listVersions(3)).toEqual([])
  })

  it('ошибки ввода в версии не сохраняются', async () => {
    const user = userEvent.setup()
    renderRecipe('/recipes/3')
    await user.click(await screen.findByRole('button', { name: '+ Своя версия' }))
    const editor = screen.getByRole('region', { name: 'Моя версия' })
    const milk = within(editor).getByLabelText('Количество: Молоко')
    await user.clear(milk)
    await user.type(milk, 'много')
    expect(within(editor).getByRole('list', { name: 'Что исправить' })).toHaveTextContent(
      'Молоко: количество — число больше нуля или пусто.',
    )
    expect(within(editor).getByRole('button', { name: 'Сохранить версию' })).toBeDisabled()
    await user.clear(within(editor).getByLabelText('Название версии'))
    expect(within(editor).getByRole('list', { name: 'Что исправить' })).toHaveTextContent(
      'Укажите название версии.',
    )
  })
})
