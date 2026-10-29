import { expect, test } from './fixtures.ts'

const sections = [
  'Что приготовить',
  'Мои продукты',
  'Избранное',
  'Дневник питания',
  'Планирование',
  'Профиль',
]

test('все разделы открываются из навигации и по прямой ссылке', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Разделы' })
  const links = nav.getByRole('link')
  await expect(links).toHaveCount(sections.length)

  for (let i = 0; i < sections.length; i++) {
    await links.nth(i).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(sections[i])
  }

  // Прямой заход по адресу раздела (проверяет SPA-перенаправление сервера).
  await page.goto('/pantry')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Мои продукты')
})

test('навигация не вызывает горизонтальной прокрутки', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('экран состояния показывает результат проверки БД', async ({ page }) => {
  await page.goto('/status')
  const status = page.getByTestId('db-status')
  await expect(status).not.toHaveText('проверка…')
  // Если тест запущен с настройками Supabase (E2E_EXPECT_DB=1), база обязана отвечать.
  if (process.env.E2E_EXPECT_DB === '1') {
    await expect(status).toContainText('отвечает')
  }
})
