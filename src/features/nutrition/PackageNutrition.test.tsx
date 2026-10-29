import type { Session } from '@supabase/supabase-js'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/authContext'
import { PantryPage } from '../pantry/PantryPage'
import { createMemoryPantryApi, testCatalog } from '../../test/memoryPantryApi'

const session = { user: { id: 'u1', email: 'owner@example.test' } } as unknown as Session

// ТЕСТОВЫЕ справочные данные, не настоящие значения продукта.
function setup() {
  const pantry = createMemoryPantryApi(testCatalog)
  pantry.store.products.push({
    id: 1,
    ingredientId: 4,
    kind: 'current',
    quantity: null,
    unitCode: null,
    expiresOn: null,
    isExcluded: false,
  })
  pantry.store.reference.set(4, [
    {
      state: 'as_purchased',
      nutrition: {
        kcal: 61,
        protein: 3.15,
        fat: 3.25,
        carbs: 4.8,
        approximate: true,
        note: 'ТЕСТ 3,25 %',
        sourceCode: 'test',
        sourceFoodId: '1',
        sourceFoodName: 'TEST',
      },
      weights: [],
    },
  ])
  render(
    <AuthContext.Provider value={{ state: { status: 'signed-in', session }, client: null }}>
      <PantryPage api={pantry.api} />
    </AuthContext.Provider>,
  )
  return pantry
}

async function openPackage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Молоко/ }))
  await user.click(screen.getByText('КБЖУ и упаковка'))
  return screen.getByRole('form', { name: 'КБЖУ с упаковки: Молоко' })
}

describe('КБЖУ с упаковки в «Моих продуктах»', () => {
  it('показывает справочные значения и сохраняет свои — на 100 мл, с маркой', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    const form = await openPackage(user)
    expect(
      await screen.findByText(/в исходном виде: 61 ккал, Б 3,\d, Ж 3,\d, У 4,8/),
    ).toBeInTheDocument()
    expect(screen.getByText(/приближённо: ТЕСТ 3,25 %/)).toBeInTheDocument()

    await user.type(within(form).getByLabelText('Марка (необязательно)'), 'ТЕСТОВАЯ марка')
    await user.click(within(form).getByRole('radio', { name: 'на 100 мл' }))
    await user.type(within(form).getByLabelText('Калории, ккал'), '52')
    await user.type(within(form).getByLabelText('Белки, г'), '2,8')
    await user.type(within(form).getByLabelText('Жиры, г'), '2,5')
    await user.type(within(form).getByLabelText('Углеводы, г'), '4,7')
    await user.type(within(form).getByLabelText('Масса упаковки, г'), '930')
    await user.click(within(form).getByRole('button', { name: 'Сохранить данные с упаковки' }))

    expect(await screen.findByText(/Сохранено\. Ваши данные используются/)).toBeInTheDocument()
    expect(store.userNutrition).toEqual([
      {
        ingredientId: 4,
        brand: 'ТЕСТОВАЯ марка',
        basis: '100ml',
        kcal: 52,
        protein: 2.8,
        fat: 2.5,
        carbs: 4.7,
        packageGrams: 930,
        pieceGrams: null,
        note: null,
      },
    ])
    expect(screen.getByText('КБЖУ и упаковка — ваши данные')).toBeInTheDocument()

    await user.click(within(form).getByRole('button', { name: 'Удалить мои данные' }))
    expect(await screen.findByText(/снова используются справочные/)).toBeInTheDocument()
    expect(store.userNutrition).toEqual([])
  })

  it('не принимает невозможный состав и предупреждает о несходящихся цифрах', async () => {
    const user = userEvent.setup()
    const { store } = setup()
    const form = await openPackage(user)
    const type = async (label: string, value: string) => {
      const input = within(form).getByLabelText(label)
      await user.clear(input)
      await user.type(input, value)
    }
    await type('Калории, ккал', '400')
    await type('Белки, г', '60')
    await type('Жиры, г', '30')
    await type('Углеводы, г', '20')
    await user.click(within(form).getByRole('button', { name: 'Сохранить данные с упаковки' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('не может быть больше 100 г на 100 г')
    expect(store.userNutrition).toEqual([])

    // 4·10 + 9·5 + 4·10 = 125 ккал, а указано 400 — подсказка, но сохранить можно.
    await type('Белки, г', '10')
    await type('Жиры, г', '5')
    await type('Углеводы, г', '10')
    expect(
      within(form).getByText(/Проверьте цифры: обычно калорийность ≈ .* = 125 ккал/),
    ).toBeInTheDocument()
    await type('Масса 1 шт., г', 'abc')
    await user.click(within(form).getByRole('button', { name: 'Сохранить данные с упаковки' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Масса упаковки и штуки')
  })
})
