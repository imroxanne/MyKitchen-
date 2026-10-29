import type { Session } from '@supabase/supabase-js'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/authContext'
import { createMemoryPantryApi, testCatalog } from '../../test/memoryPantryApi'
import { PantryPage } from './PantryPage'
import type { PantryApi } from './types'

const session = { user: { id: 'u1', email: 'owner@example.test' } } as unknown as Session

function renderPantry(api: PantryApi) {
  return render(
    <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
      <PantryPage api={api} />
    </AuthContext.Provider>,
  )
}

const group = (name: 'Сейчас есть' | 'Обычно есть') => screen.getByRole('list', { name })

async function addByQuery(user: ReturnType<typeof userEvent.setup>, query: string, pick: RegExp[]) {
  const search = screen.getByRole('searchbox', { name: 'Найти продукт' })
  await user.clear(search)
  await user.type(search, query)
  const results = screen.getByRole('list', { name: 'Найденные продукты' })
  for (const label of pick) await user.click(within(results).getByRole('checkbox', { name: label }))
}

describe('Мои продукты', () => {
  it('добавление нескольких продуктов, редактирование, перенос, удаление и сохранение после «перезапуска»', async () => {
    const user = userEvent.setup()
    const { api, store } = createMemoryPantryApi(testCatalog)
    const view = renderPantry(api)

    expect(await screen.findByText('Добавить продукты')).toBeInTheDocument()
    expect(screen.getAllByText('Пока пусто.')).toHaveLength(2)

    // Поиск по синониму и множественный выбор.
    await addByQuery(user, 'помидоры', [/^Томат/])
    await addByQuery(user, 'морков', [/^Морковь/])
    await user.click(screen.getByRole('button', { name: 'Добавить выбранные (2)' }))
    expect(await screen.findByText(/Добавлено: 2/)).toBeInTheDocument()
    expect(within(group('Сейчас есть')).getAllByRole('listitem')).toHaveLength(2)
    expect(within(group('Сейчас есть')).getAllByText('количество не указано')).toHaveLength(2)

    // Соль — в «Обычно есть» через выбор категории.
    await user.click(screen.getByRole('button', { name: 'Соусы и приправы' }))
    await user.click(screen.getByRole('checkbox', { name: /^Соль/ }))
    await user.click(screen.getByRole('radio', { name: 'Обычно есть' }))
    await user.click(screen.getByRole('button', { name: 'Добавить выбранные (1)' }))
    expect(await within(group('Обычно есть')).findByText('Соль')).toBeInTheDocument()

    // Уже добавленный продукт помечен и не выбирается повторно.
    await addByQuery(user, 'томат', [])
    expect(screen.getByRole('checkbox', { name: /^Томат.*уже в списке/ })).toBeDisabled()

    // Редактирование: количество с запятой, единица, срок.
    await user.click(within(group('Сейчас есть')).getByRole('button', { name: /Томат/ }))
    const editor = screen.getByRole('form', { name: 'Изменить: Томат' })
    await user.type(within(editor).getByLabelText('Количество'), '1,5')
    await user.selectOptions(within(editor).getByLabelText('Единица'), 'kg')
    await user.type(within(editor).getByLabelText('Годен до'), '2030-01-15')
    await user.click(within(editor).getByRole('button', { name: 'Сохранить' }))
    expect(await within(group('Сейчас есть')).findByText('1,5 кг')).toBeInTheDocument()
    expect(within(group('Сейчас есть')).getByText(/годен до 15 янв/)).toBeInTheDocument()

    // Некорректное количество не сохраняется.
    await user.click(within(group('Сейчас есть')).getByRole('button', { name: /Морковь/ }))
    const carrot = screen.getByRole('form', { name: 'Изменить: Морковь' })
    await user.type(within(carrot).getByLabelText('Количество'), '-2')
    await user.click(within(carrot).getByRole('button', { name: 'Сохранить' }))
    expect(within(carrot).getByRole('alert')).toHaveTextContent('положительное число')
    // Перенос в «Обычно есть» и «не учитывать».
    await user.clear(within(carrot).getByLabelText('Количество'))
    await user.click(within(carrot).getByRole('radio', { name: 'Обычно есть' }))
    await user.click(within(carrot).getByRole('checkbox', { name: /Не учитывать/ }))
    await user.click(within(carrot).getByRole('button', { name: 'Сохранить' }))
    expect(await within(group('Обычно есть')).findByText('Морковь')).toBeInTheDocument()
    expect(within(group('Обычно есть')).getByText('не учитывается')).toBeInTheDocument()

    // Удаление — с подтверждением.
    await user.click(within(group('Обычно есть')).getByRole('button', { name: /Соль/ }))
    const salt = screen.getByRole('form', { name: 'Изменить: Соль' })
    await user.click(within(salt).getByRole('button', { name: 'Удалить' }))
    await user.click(within(salt).getByRole('button', { name: 'Да, удалить' }))
    expect(within(group('Обычно есть')).queryByText('Соль')).not.toBeInTheDocument()

    // «Перезапуск»: новая страница с тем же хранилищем показывает тот же список.
    view.unmount()
    renderPantry(api)
    expect(
      await within(await screen.findByRole('list', { name: 'Сейчас есть' })).findByText('1,5 кг'),
    ).toBeInTheDocument()
    expect(within(group('Обычно есть')).getByText('Морковь')).toBeInTheDocument()
    expect(within(group('Обычно есть')).queryByText('Соль')).not.toBeInTheDocument()
    expect(store.products.map((p) => [p.ingredientId, p.kind, p.quantity, p.unitCode])).toEqual([
      [1, 'current', 1.5, 'kg'],
      [3, 'staple', null, null],
    ])
  })

  it('свой продукт, которого нет в справочнике', async () => {
    const user = userEvent.setup()
    const { api, store } = createMemoryPantryApi(testCatalog)
    renderPantry(api)
    await screen.findByText('Добавить продукты')

    await user.type(screen.getByRole('searchbox', { name: 'Найти продукт' }), 'Соус бабушки')
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Категория'), 'sauces')
    await user.click(
      screen.getByRole('button', { name: 'Добавить «Соус бабушки» как свой продукт' }),
    )
    const item = await within(group('Сейчас есть')).findByText('Соус бабушки')
    expect(item.parentElement).toHaveTextContent('свой')
    expect(store.items.at(-1)).toMatchObject({
      name: 'Соус бабушки',
      categorySlug: 'sauces',
      isOwn: true,
    })

    // Для уже известного названия кнопка «свой продукт» не предлагается.
    await user.type(screen.getByRole('searchbox', { name: 'Найти продукт' }), 'буряк')
    expect(screen.queryByRole('button', { name: /как свой продукт/ })).not.toBeInTheDocument()
  })

  it('ошибки загрузки и сохранения показываются, ввод не теряется', async () => {
    const user = userEvent.setup()
    const { api, store } = createMemoryPantryApi(testCatalog)
    store.failNext = 'Нет связи с сервером'
    renderPantry(api)
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи с сервером')
    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    await screen.findByText('Добавить продукты')

    await addByQuery(user, 'молоко', [/^Молоко/])
    store.failNext = 'Нет связи с сервером'
    await user.click(screen.getByRole('button', { name: 'Добавить выбранные (1)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи с сервером')
    // Выбор сохранился — можно повторить.
    await user.click(screen.getByRole('button', { name: 'Добавить выбранные (1)' }))
    expect(await within(group('Сейчас есть')).findByText('Молоко')).toBeInTheDocument()
  })
})

describe('свой продукт при частичном совпадении', () => {
  it('предлагается ссылкой, форма раскрывается по нажатию', async () => {
    const user = userEvent.setup()
    const { api } = createMemoryPantryApi(testCatalog)
    renderPantry(api)
    await screen.findByText('Добавить продукты')
    await user.type(screen.getByRole('searchbox', { name: 'Найти продукт' }), 'пом')
    expect(screen.queryByLabelText('Категория')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Нет нужного\? Добавить «пом»/ }))
    expect(screen.getByLabelText('Категория')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Добавить «пом» как свой продукт' })).toBeEnabled()
  })
})
