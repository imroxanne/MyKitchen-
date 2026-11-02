import { expect, test } from './fixtures.ts'
import { signUp, uniqueEmail } from './helpers.ts'

// B4: строгий отбор по ограничениям на настоящем Supabase и настоящей разметке продуктов.
test.skip(!process.env.E2E_DB, 'нужен локальный Supabase (E2E_DB=1)')

test('аллергия на молоко и вегетарианство: запрещённое скрыто, сомнительное помечено', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('b4'), '/profile')
  const section = page.getByRole('region', { name: 'Пищевые ограничения' })
  await expect(section.getByText(/Ограничений нет/)).toBeVisible()
  const form = section.getByRole('form', { name: 'Добавить ограничение' })
  await form.getByLabel('Вид', { exact: true }).selectOption({ label: 'Аллергия' })
  await form.getByLabel('Группа', { exact: true }).selectOption({ label: 'Молоко (белок молока)' })
  await form.getByRole('button', { name: 'Добавить ограничение' }).click()
  await expect(section.getByText('Добавлено ограничение: Молоко (белок молока).')).toBeVisible()

  // Подбор: сырники (творог) скрыты, оливье (майонез может содержать молоко) — «проверьте».
  await page.goto('/?mode=ignore')
  const list = page.getByRole('list', { name: 'Рецепты' })
  const card = (title: RegExp) => list.getByRole('link', { name: title })
  await expect(card(/^Шакшука/)).toBeVisible()
  await expect(card(/^Шакшука/).locator('.recipe-card-restriction')).toHaveCount(0)
  await expect(card(/^Сырники/)).toHaveCount(0)
  await expect(page.getByRole('status').first()).toContainText('скрыто по вашим ограничениям')
  await expect(card(/^Оливье/)).toContainText('Проверьте: молоко (белок молока)')

  await page.getByRole('button', { name: 'Показать не подходящие по ограничениям' }).click()
  await expect(card(/^Сырники/)).toContainText('Не подходит: молоко (белок молока)')
  await card(/^Сырники/).click()
  await expect(
    page.getByRole('region', { name: 'Не подходит по вашим ограничениям' }),
  ).toContainText('Творог: молоко (белок молока) — аллергия.')

  // Вегетарианство: плов с бараниной скрыт; после перезагрузки — то же.
  await page.goto('/profile')
  await section.getByRole('button', { name: '+ Вегетарианство' }).click()
  await expect(section.getByText('Добавлено: вегетарианство.')).toBeVisible()
  await page.goto('/?mode=ignore')
  await expect(card(/^Шакшука/)).toBeVisible()
  await expect(card(/^Плов/)).toHaveCount(0)
  await page.reload()
  await expect(card(/^Шакшука/)).toBeVisible()
  await expect(card(/^Плов/)).toHaveCount(0)
  await expect(card(/^Сырники/)).toHaveCount(0)
})
