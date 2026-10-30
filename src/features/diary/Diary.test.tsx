import type { Session } from '@supabase/supabase-js'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'react-dom'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/authContext'
import { createMemoryDiaryApi } from '../../test/memoryDiaryApi'
import { createMemoryFavoritesApi } from '../../test/memoryFavoritesApi'
import { createMemoryPantryApi, testCatalog } from '../../test/memoryPantryApi'
import {
  createMemoryRecipesApi,
  openLicenseRecipe,
  unverifiedRecipe,
} from '../../test/recipeFixtures'
import { RecipePage } from '../recipes/RecipePage'
import { draftFromRecipe } from '../versions/draft'
import { DiaryPage } from './DiaryPage'

const session = { user: { id: 'u1', email: 'owner@example.test' } } as unknown as Session
// «Сейчас» в дневнике — 30 октября 2026, 13:00 (обед).
const NOW = new Date(2026, 9, 30, 13, 0)

// ТЕСТОВЫЕ данные: суп — 300 г свёклы по 40 ккал/100 г = 120 ккал на 4 порции (30 на порцию).
function setup(path: string) {
  const recipes = createMemoryRecipesApi([
    structuredClone(openLicenseRecipe),
    structuredClone(unverifiedRecipe),
  ])
  const pantry = createMemoryPantryApi(testCatalog)
  const diary = createMemoryDiaryApi()
  const favorites = createMemoryFavoritesApi()
  const router = createMemoryRouter(
    [
      {
        path: '/recipes/:id',
        element: (
          <RecipePage
            api={recipes}
            pantryApi={pantry.api}
            favoritesApi={favorites.api}
            diaryApi={diary.api}
          />
        ),
      },
      {
        path: '/diary',
        element: <DiaryPage api={diary.api} pantryApi={pantry.api} now={NOW} />,
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
      <RouterProvider router={router} flushSync={(fn) => void flushSync(fn)} />
    </AuthContext.Provider>,
  )
  return { router, recipes, pantry, diary }
}

// На странице рецепта есть и другие сообщения (избранное) — ищем сообщение о записи.
const savedNote = () => screen.findByText(/^Записано в дневник/)

const eatenForm = () => screen.findByRole('form', { name: 'Записать как съеденное' })

async function recordEaten(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await user.click(await screen.findByRole('button', { name: 'Съедено' }))
  const form = await eatenForm()
  fireEvent.change(within(form).getByLabelText('Дата'), { target: { value: '2026-10-30' } })
  // Приём пищи по умолчанию зависит от настоящего времени — задаём явно.
  await user.selectOptions(within(form).getByLabelText('Приём пищи'), 'Обед')
  const field = within(form).getByLabelText(/^(Порций|Доля блюда|Масса)/)
  await user.clear(field)
  await user.type(field, amount)
  return form
}

describe('«Съедено» в рецепте', () => {
  it('1,5 порции: КБЖУ сразу, запись в дневник, ссылка на день', async () => {
    const user = userEvent.setup()
    const { router, diary } = setup('/recipes/1')
    const form = await recordEaten(user, '1')
    expect(within(form).getByText(/Тестовый суп — /)).toHaveTextContent('оригинальный рецепт')
    expect(within(form).getByText(/^Съедено:/)).toHaveTextContent('30 ккал')

    await user.click(within(form).getByRole('button', { name: '1,5' }))
    expect(within(form).getByText(/^Съедено:/)).toHaveTextContent('45 ккал')
    await user.selectOptions(within(form).getByLabelText('Приём пищи'), 'Ужин')
    await user.click(within(form).getByRole('button', { name: 'Записать в дневник' }))

    expect(await savedNote()).toHaveTextContent('Записано в дневник: Тестовый суп, 1,5 порции.')
    expect(screen.queryByRole('form', { name: 'Записать как съеденное' })).toBeNull()
    expect(diary.store.entries[0]).toMatchObject({
      eatenOn: '2026-10-30',
      meal: 'dinner',
      servings: 1.5,
      eaten: { kcal: 45 },
    })

    await user.click(screen.getByRole('link', { name: 'Открыть дневник' }))
    expect(router.state.location.search).toBe('?date=2026-10-30')
    const dinner = await screen.findByRole('region', { name: /Ужин/ })
    expect(within(dinner).getByText('1,5 порции')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Итого за день' })).toHaveTextContent('45 ккал')
  })

  it('без числа порций — доля блюда', async () => {
    const user = userEvent.setup()
    const { diary } = setup('/recipes/2')
    const form = await recordEaten(user, '0,5')
    expect(within(form).getByLabelText('Доля блюда (1 — всё блюдо)')).toHaveValue('0,5')
    expect(within(form).getByText(/^Съедено:/)).toHaveTextContent('60 ккал')
    await user.click(within(form).getByRole('button', { name: 'Записать в дневник' }))
    expect(await savedNote()).toHaveTextContent('0,5 блюда')
    expect(diary.store.entries[0]).toMatchObject({ servingUnit: 'dish', baseServings: 1 })
  })

  it('неверное количество и ошибка сервера не теряют ввод', async () => {
    const user = userEvent.setup()
    const { diary } = setup('/recipes/1')
    const form = await recordEaten(user, '0')
    await user.click(within(form).getByRole('button', { name: 'Записать в дневник' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('больше нуля')
    expect(diary.store.entries).toHaveLength(0)

    const field = within(form).getByLabelText(/^(Порций|Доля блюда|Масса)/)
    await user.clear(field)
    await user.type(field, '2')
    diary.store.failNext = 'Нет связи с сервером'
    await user.click(within(form).getByRole('button', { name: 'Записать в дневник' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('Нет связи с сервером')
    expect(field).toHaveValue('2')
    await user.click(within(form).getByRole('button', { name: 'Записать в дневник' }))
    expect(await savedNote()).toHaveTextContent('2 порции')
  })

  it('запись из своей версии не меняется после правки версии', async () => {
    const user = userEvent.setup()
    // Версия создаётся до открытия рецепта 1 — как если бы её сохранили раньше.
    const { recipes, router } = setup('/recipes/2')
    const draft = draftFromRecipe(openLicenseRecipe, 'Двойная')
    draft.ingredients[0]!.quantity = 600
    const version = await recipes.saveVersion(draft)
    await router.navigate(`/recipes/1?version=${version.id}`)

    const form = await recordEaten(user, '1')
    expect(within(form).getByText(/Тестовый суп \(Двойная\)/)).toHaveTextContent('версия «Двойная»')
    expect(within(form).getByText(/^Съедено:/)).toHaveTextContent('60 ккал')
    await user.click(within(form).getByRole('button', { name: 'Записать в дневник' }))
    await savedNote()

    // Версию изменили: втрое больше свёклы.
    await recipes.saveVersion({
      ...draft,
      id: version.id,
      ingredients: draft.ingredients.map((l, i) => (i === 0 ? { ...l, quantity: 1800 } : l)),
    })
    await router.navigate('/diary?date=2026-10-30')
    const lunch = await screen.findByRole('region', { name: /Обед/ })
    expect(within(lunch).getByRole('link', { name: 'Тестовый суп (Двойная)' })).toHaveAttribute(
      'href',
      `/recipes/1?version=${version.id}`,
    )
    expect(lunch).toHaveTextContent('60 ккал')
    await user.click(within(lunch).getByText('Состав на момент записи'))
    expect(within(lunch).getByText(/600 г/)).toBeInTheDocument()
  })

  it('несохранённую новую версию записать нельзя', async () => {
    const user = userEvent.setup()
    setup('/recipes/1')
    await user.click(await screen.findByRole('button', { name: '+ Своя версия' }))
    expect(screen.getByRole('button', { name: 'Съедено' })).toBeDisabled()
    expect(screen.getByText(/сначала сохраните её/)).toBeInTheDocument()
  })
})

describe('дневник', () => {
  async function withTwoEntries() {
    const ctx = setup('/recipes/1')
    const user = userEvent.setup()
    let form = await recordEaten(user, '1,5')
    await user.click(within(form).getByRole('button', { name: 'Записать в дневник' }))
    await savedNote()
    form = await recordEaten(user, '1')
    await user.selectOptions(within(form).getByLabelText('Приём пищи'), 'Завтрак')
    await user.click(within(form).getByRole('button', { name: 'Записать в дневник' }))
    await screen.findByText(/Записано в дневник: Тестовый суп, 1 порция/)
    await ctx.router.navigate('/diary')
    return { ...ctx, user }
  }

  it('итоги за день и по приёмам пищи; правка количества, переноса и удаление', async () => {
    const { user, diary } = await withTwoEntries()
    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent(
      /Сегодня, пятница, 30 октября 2026/,
    )
    const total = await screen.findByRole('region', { name: 'Итого за день' })
    expect(total).toHaveTextContent('75 ккал')
    const meals = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(meals).toEqual(['Итого за день', 'Завтрак 30 ккал', 'Обед 45 ккал'])

    // 1,5 → 0,5 порции: итог дня пересчитан.
    const lunch = screen.getByRole('region', { name: /Обед/ })
    await user.click(within(lunch).getByRole('button', { name: 'Изменить: Тестовый суп' }))
    const editor = screen.getByRole('form', { name: 'Изменить запись: Тестовый суп' })
    await user.click(within(editor).getByRole('button', { name: '0,5' }))
    expect(within(editor).getByText(/^Съедено:/)).toHaveTextContent('15 ккал')
    await user.click(within(editor).getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Запись изменена.')
    expect(total).toHaveTextContent('45 ккал')
    expect(diary.store.entries.find((e) => e.meal === 'lunch')?.base.kcal).toBe(120)

    // Перенос на вчера: запись уходит из этого дня.
    await user.click(
      within(screen.getByRole('region', { name: /Обед/ })).getByRole('button', {
        name: 'Изменить: Тестовый суп',
      }),
    )
    const editor2 = screen.getByRole('form', { name: 'Изменить запись: Тестовый суп' })
    fireEvent.change(within(editor2).getByLabelText('Дата'), { target: { value: '2026-10-29' } })
    await user.click(within(editor2).getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Запись перенесена на четверг, 29 октября 2026',
    )
    expect(screen.queryByRole('region', { name: /Обед/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Предыдущий день' }))
    expect(await screen.findByRole('region', { name: /Обед/ })).toHaveTextContent('0,5 порции')
    await user.click(screen.getByRole('button', { name: 'Сегодня' }))

    // Удаление с подтверждением.
    const breakfast = await screen.findByRole('region', { name: /Завтрак/ })
    await user.click(within(breakfast).getByRole('button', { name: 'Удалить: Тестовый суп' }))
    await user.click(within(breakfast).getByRole('button', { name: 'Нет' }))
    await user.click(within(breakfast).getByRole('button', { name: 'Удалить: Тестовый суп' }))
    await user.click(within(breakfast).getByRole('button', { name: 'Да, удалить' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Запись «Тестовый суп» удалена.')
    expect(screen.getByText(/За этот день записей нет/)).toBeInTheDocument()
    expect(diary.store.entries.map((e) => e.eatenOn)).toEqual(['2026-10-29'])
  })

  it('своё блюдо без рецепта: КБЖУ на порцию, 2 штуки', async () => {
    const user = userEvent.setup()
    const { diary } = setup('/diary')
    await user.click(await screen.findByRole('button', { name: '+ Продукт или блюдо без рецепта' }))
    await user.click(screen.getByLabelText('своё блюдо (например, покупное)'))
    const form = screen.getByRole('form', { name: 'Записать своё блюдо' })
    await user.click(within(form).getByRole('button', { name: 'Записать в дневник' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Укажите название')

    await user.type(within(form).getByLabelText('Название'), 'Сырники из кулинарии')
    await user.click(within(form).getByLabelText('на 1 порцию (штуку, упаковку)'))
    for (const [label, value] of [
      ['Калории, ккал', '180'],
      ['Белки, г', '9'],
      ['Жиры, г', '8'],
      ['Углеводы, г', '18,5'],
    ])
      await user.type(within(form).getByLabelText(label!), value!)
    await user.click(within(form).getByRole('button', { name: '2' }))
    expect(within(form).getByText(/^Съедено:/)).toHaveTextContent('360 ккал')
    await user.click(within(form).getByRole('button', { name: 'Записать в дневник' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Записано: Сырники из кулинарии, 2 порции.',
    )
    expect(screen.getByRole('region', { name: /Обед/ })).toHaveTextContent('360 ккал')
    expect(diary.store.entries[0]).toMatchObject({ kind: 'custom', baseServings: 1 })
  })

  it('продукт из справочника: граммы, данные справочника', async () => {
    const user = userEvent.setup()
    const { pantry } = setup('/diary?date=2026-10-29')
    pantry.store.reference.set(6, [
      {
        state: 'as_purchased',
        // ТЕСТОВЫЕ значения.
        nutrition: {
          kcal: 43,
          protein: 1.6,
          fat: 0.2,
          carbs: 9.6,
          approximate: false,
          note: null,
          sourceCode: 'test',
          sourceFoodId: '1',
          sourceFoodName: 'TEST beet',
        },
        weights: [],
      },
    ])
    await user.click(await screen.findByRole('button', { name: '+ Продукт или блюдо без рецепта' }))
    await user.type(await screen.findByLabelText('Продукт'), 'свёк')
    await user.click(screen.getByRole('button', { name: /Свёкла/ }))
    const form = await screen.findByRole('form', { name: 'Записать продукт: Свёкла' })
    expect(within(form).getByText(/43 ккал/)).toBeInTheDocument()
    // Запись — на открытый день, без времени.
    expect(within(form).getByLabelText('Дата')).toHaveValue('2026-10-29')
    expect(within(form).getByLabelText('Время')).toHaveValue('')
    await user.type(within(form).getByLabelText('Масса, г'), '200')
    expect(within(form).getByText(/^Съедено:/)).toHaveTextContent('86 ккал')
    await user.click(within(form).getByRole('button', { name: 'Записать в дневник' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Записано: Свёкла, 200 г.')
    expect(screen.getByRole('region', { name: 'Итого за день' })).toHaveTextContent('86 ккал')
  })

  it('ошибка загрузки дня — сообщение и повтор', async () => {
    const user = userEvent.setup()
    const ctx = setup('/recipes/1')
    ctx.diary.store.failNext = 'Нет связи с сервером: не удалось загрузить дневник.'
    await ctx.router.navigate('/diary')
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи с сервером')
    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText(/За этот день записей нет/)).toBeInTheDocument()
  })
})
