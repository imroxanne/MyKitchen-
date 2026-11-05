import { expect, test } from './fixtures.ts'
import { signUp, uniqueEmail } from './helpers.ts'

// B5: замены на настоящем Supabase, справочнике замен и разметке продуктов.
test.skip(!process.env.E2E_DB, 'нужен локальный Supabase (E2E_DB=1)')

test('аллергия на молоко: недопустимая замена заблокирована, допустимая — своя версия', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('b5'), '/profile')
  const section = page.getByRole('region', { name: 'Пищевые ограничения' })
  const form = section.getByRole('form', { name: 'Добавить ограничение' })
  await form.getByLabel('Вид', { exact: true }).selectOption({ label: 'Аллергия' })
  await form.getByLabel('Группа', { exact: true }).selectOption({ label: 'Молоко (белок молока)' })
  await form.getByRole('button', { name: 'Добавить ограничение' }).click()
  await expect(section.getByText('Добавлено ограничение: Молоко (белок молока).')).toBeVisible()

  // Подбор: каша со сливочным маслом скрыта, в режиме «с заменами» — с пометкой.
  await page.goto('/?mode=ignore')
  const list = page.getByRole('list', { name: 'Рецепты' })
  const porridge = list.getByRole('link', { name: /^Гречневая каша/ })
  await expect(list.getByRole('link', { name: /^Шакшука/ })).toBeVisible()
  await expect(porridge).toHaveCount(0)
  await page.getByRole('button', { name: /^Варианты с заменами/ }).click()
  await expect(page).toHaveURL(/subs=1/)
  await expect(porridge).toContainText('С заменой: Масло сливочное → Масло подсолнечное')

  // Пюре: безлактозное молоко — нельзя (белок молока), вода — только для выпечки.
  await list.getByRole('link', { name: /^Картофельное пюре/ }).click()
  const notice = page.getByRole('region', { name: 'Не подходит по вашим ограничениям' })
  const milk = notice.getByRole('list', { name: 'Замены: Молоко' })
  await expect(milk.getByRole('listitem').filter({ hasText: 'Молоко безлактозное' })).toContainText(
    'Вам не подходит: Молоко безлактозное: молоко (белок молока) — аллергия.',
  )
  await expect(milk.getByRole('listitem').filter({ hasText: /^Вода/ })).toContainText(
    'Не для этого блюда',
  )
  await expect(
    milk.getByRole('button', { name: 'Своя версия с заменой на «Молоко безлактозное»' }),
  ).toHaveCount(0)

  // Каша: своя версия с подсолнечным маслом (2 ст. л. × 0,8) — подходит.
  await page.goBack()
  await porridge.click()
  await page
    .getByRole('list', { name: 'Замены: Масло сливочное' })
    .getByRole('button', { name: 'Своя версия с заменой на «Масло подсолнечное»' })
    .click()
  const editor = page.getByRole('region', { name: 'Моя версия' })
  await expect(editor.getByLabel('Название версии')).toHaveValue('С заменой: Масло подсолнечное')
  await expect(editor).toContainText('заменено, было: Масло сливочное')
  await expect(editor.getByLabel('Количество: Масло подсолнечное')).toHaveValue('1,6')
  await editor.getByRole('button', { name: 'Сохранить версию' }).click()
  await expect(page.getByText('Версия сохранена. Оригинальный рецепт не изменился.')).toBeVisible()
  await expect(page.getByText(/По вашим ограничениям подходит/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/По вашим ограничениям подходит/)).toBeVisible()
})
