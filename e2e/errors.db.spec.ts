import { expect, test } from './fixtures.ts'
import { addProducts, signUp, uniqueEmail } from './helpers.ts'

// A8: ошибки загрузки и сохранения — понятное сообщение, повтор, никаких «тихих» потерь.
test.skip(!process.env.E2E_DB, 'нужен локальный Supabase (E2E_DB=1)')

// Специально оборванные запросы браузер пишет в консоль — это ожидаемо.
test.use({ allowConsoleErrors: [/Failed to load resource/] })

test('нет связи: список рецептов, запасы и избранное сообщают об ошибке и восстанавливаются', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('errors'))
  await expect(page.getByRole('list', { name: 'Рецепты' }).getByRole('listitem')).toHaveCount(22)

  // Список рецептов не загрузился → сообщение и «Повторить».
  await page.route('**/rest/v1/recipes*', (route) => route.abort())
  await page.reload()
  // Запросы на чтение клиент Supabase сам повторяет 3 раза (через 1, 2 и 4 с) — кратковременный
  // сбой связи пользователь не заметит; сообщение появляется примерно через 7 с.
  await expect(page.getByRole('alert')).toContainText('Нет связи с сервером', { timeout: 15_000 })
  await page.unroute('**/rest/v1/recipes*')
  await page.getByRole('button', { name: 'Повторить' }).click()
  await expect(page.getByRole('list', { name: 'Рецепты' }).getByRole('listitem')).toHaveCount(22)

  // Избранное не сохранилось → сердечко возвращается, причина показана.
  await page.route('**/rest/v1/favorite_recipes*', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  )
  const heart = page.getByRole('button', { name: 'В избранное: Шакшука' })
  await heart.click()
  await expect(page.getByRole('alert')).toContainText('не удалось добавить в избранное')
  await expect(heart).toHaveAttribute('aria-pressed', 'false')
  await page.unroute('**/rest/v1/favorite_recipes*')

  // Продукт не добавился → ошибка, список не делает вид, что продукт есть; повтор удаётся.
  await page.route('**/rest/v1/user_products*', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  )
  await page.goto('/pantry')
  await page.getByRole('searchbox', { name: 'Найти продукт' }).fill('гречка')
  await page.getByRole('checkbox', { name: /^Гречка/ }).check()
  await page.getByRole('button', { name: 'Добавить выбранные (1)' }).click()
  await expect(page.getByRole('alert')).toContainText('Нет связи с сервером')
  await expect(page.getByRole('list', { name: 'Сейчас есть', exact: true })).toHaveCount(0)
  await page.unroute('**/rest/v1/user_products*')
  await addProducts(page, [['гречка', /^Гречка/]])
  await page.reload()
  await expect(
    page.getByRole('list', { name: 'Сейчас есть', exact: true }).getByRole('listitem'),
  ).toHaveCount(1)
})

test('несуществующий рецепт и неизвестный адрес — понятные страницы', async ({ page }) => {
  await signUp(page, uniqueEmail('missing'), '/recipes/999999')
  await expect(page.getByRole('heading', { name: 'Рецепт не найден' })).toBeVisible()
  await page.getByRole('link', { name: '← Все рецепты' }).click()
  await expect(page.getByRole('list', { name: 'Рецепты' })).toBeVisible()
  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible()
})
