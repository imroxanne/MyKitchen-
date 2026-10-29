import { expect, test } from './fixtures.ts'
import { addProducts, signUp, uniqueEmail } from './helpers.ts'

// B1: справочник «в исходном виде / после варки», свои данные с упаковки, масса готового блюда.
test.skip(!process.env.E2E_DB, 'нужен локальный Supabase (E2E_DB=1)')

const KASHA = 'Гречневая каша с маслом'

test('свои данные с упаковки и масса готового блюда меняют расчёт и сохраняются', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('b1'))
  await addProducts(page, [['гречка', /^Гречка/]])

  // Справочник: гречка до и после варки (USDA 170685 и 170686).
  await page
    .getByRole('list', { name: 'Сейчас есть', exact: true })
    .getByRole('button', { name: /Гречка/ })
    .click()
  await page.getByText('КБЖУ и упаковка').click()
  await expect(page.getByText(/в исходном виде: 346 ккал/)).toBeVisible()
  await expect(page.getByText(/после варки: 92 ккал/)).toBeVisible()

  // Своя упаковка: 330 ккал на 100 г; сохраняем дважды — второе сохранение заменяет первое.
  const form = page.getByRole('form', { name: 'КБЖУ с упаковки: Гречка' })
  for (const kcal of ['320', '330']) {
    await form.getByLabel('Калории, ккал').fill(kcal)
    await form.getByLabel('Белки, г').fill('12,6')
    await form.getByLabel('Жиры, г').fill('3,3')
    await form.getByLabel('Углеводы, г').fill('64')
    await form.getByLabel('Марка (необязательно)').fill('Тестовая марка')
    await form.getByRole('button', { name: 'Сохранить данные с упаковки' }).click()
    await expect(form.getByRole('status')).toContainText('Сохранено')
  }

  // Рецепт: гречка 2 стакана ≈ 346,6 г × 3,30 = 1143,8 + масло ≈ 206,4 → ≈ 1350 ккал.
  await page.goto('/?mode=ignore&q=гречк')
  const card = page
    .getByRole('list', { name: 'Рецепты' })
    .getByRole('link', { name: new RegExp(`^${KASHA}`) })
  await expect(card).toContainText(/≈ 1\s?350 ккал на всё блюдо/)
  await card.click()
  const kbju = page.getByRole('region', { name: /КБЖУ/ })
  await expect(kbju).toContainText('По вашим данным с упаковки: Гречка (Тестовая марка)')
  await expect(kbju.getByRole('row', { name: /Калории/ })).toContainText(/1\s?350/)

  // Взвесили готовую кашу: 900 г → 1350 / 900 × 100 = 150 ккал на 100 г.
  await kbju.getByLabel('Масса готового блюда, г').fill('900')
  await kbju.getByRole('button', { name: 'Сохранить массу' }).click()
  await expect(kbju.getByRole('columnheader', { name: 'На 100 г готового' })).toBeVisible()
  await expect(kbju.getByRole('row', { name: /Калории/ })).toContainText('150')

  // После перезагрузки всё на месте.
  await page.reload()
  await expect(kbju.getByRole('row', { name: /Калории/ })).toContainText('150')
  await expect(kbju).toContainText('по вашему взвешиванию готового блюда: 900 г')
  await expect(kbju).toContainText('По вашим данным с упаковки: Гречка (Тестовая марка)')
})
