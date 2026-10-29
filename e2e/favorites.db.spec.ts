import { expect, test } from './fixtures.ts'

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A6: список → рецепт → назад и избранное на настоящем Supabase.
test.skip(!process.env.E2E_DB, 'нужен локальный Supabase (E2E_DB=1)')

test('список → рецепт → назад, избранное сохраняется', async ({ page }) => {
  const email = `e2e-fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  await page.goto('/?mode=ignore')
  await page.getByRole('button', { name: 'Нет аккаунта? Зарегистрироваться' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill('Test-password-123')
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

  const list = page.getByRole('list', { name: 'Рецепты' })
  await expect(list.getByRole('listitem')).toHaveCount(22)

  // Сердечко на карточке — не открывает рецепт.
  const heart = page.getByRole('button', { name: 'В избранное: Шакшука' })
  await expect(heart).toBeEnabled()
  await heart.click()
  await expect(heart).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/\/\?mode=ignore$/)

  // Последняя карточка внизу списка: рецепт открывается с начала, «назад» — к тому же месту.
  const last = list.getByRole('link').last()
  const lastTitle = (await last.locator('.recipe-card-title').textContent()) ?? ''
  await last.scrollIntoViewIfNeeded()
  await last.click()
  const title = page.getByRole('heading', { level: 1, name: lastTitle })
  await expect(title).toBeInViewport()

  // Избранное внутри рецепта; после перезагрузки страницы отметка на месте.
  const inside = page.getByRole('button', { name: 'В избранное' })
  await expect(inside).toBeEnabled()
  const saved = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/favorite_recipes') && r.request().method() === 'POST',
  )
  await inside.click()
  expect((await saved).ok()).toBe(true)
  await expect(page.getByText('Рецепт сохранён в избранном.')).toBeVisible()
  await expect(inside).toHaveAttribute('aria-pressed', 'true')

  // Шаг отмечается.
  const steps = page.getByRole('region', { name: 'Приготовление' })
  await steps.getByRole('checkbox').first().check()
  await expect(steps).toContainText('Выполнено шагов: 1 из')

  await page.getByRole('link', { name: '← Все рецепты' }).click()
  await expect(page).toHaveURL(/\/\?mode=ignore$/)
  await expect(
    list.getByRole('link', { name: new RegExp(`^${escape(lastTitle)}`) }),
  ).toBeInViewport()

  await page.reload()
  await expect(page.getByRole('button', { name: 'В избранное: Шакшука' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Экран «Избранное»: оба рецепта, последний добавленный — первым.
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Избранное' })
    .click()
  const favorites = page.getByRole('list', { name: 'Избранные рецепты' })
  await expect(favorites.getByRole('listitem')).toHaveCount(2)
  await expect(favorites.getByRole('link').first()).toContainText(lastTitle)
  await favorites.getByRole('link', { name: /^Шакшука/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Шакшука' })).toBeVisible()
  await page.getByRole('link', { name: '← Избранное' }).click()
  await expect(page).toHaveURL(/\/favorites$/)

  // Убрали из избранного — после повторного открытия раздела рецепта нет.
  // Сердечко меняется сразу, запрос уходит следом — перед перезагрузкой ждём ответа сервера.
  const removed = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/favorite_recipes') && r.request().method() === 'DELETE',
  )
  await page.getByRole('button', { name: 'В избранное: Шакшука' }).click()
  await expect(page.getByRole('status')).toContainText('Сохранено: 1')
  expect((await removed).ok()).toBe(true)
  await page.reload()
  await expect(favorites.getByRole('listitem')).toHaveCount(1)
})
