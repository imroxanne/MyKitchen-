import { expect, test } from '@playwright/test'

// A4: база рецептов на настоящем Supabase (миграции партии batch-01).
test.skip(!process.env.E2E_DB, 'нужен локальный Supabase (E2E_DB=1)')

test('список рецептов → полный рецепт с источником и статусами → назад', async ({ page }) => {
  const email = `e2e-recipes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  await page.goto('/')
  await page.getByRole('button', { name: 'Нет аккаунта? Зарегистрироваться' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill('Test-password-123')
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

  const list = page.getByRole('list', { name: 'Рецепты' })
  await expect(list.getByRole('listitem')).toHaveCount(22)

  // Вся карточка — ссылка.
  await list.getByRole('link', { name: /^Шакшука/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Шакшука' })).toBeVisible()

  const original = page.getByRole('link', { name: /Открыть оригинал \(Викиучебник\)/ })
  await expect(original).toHaveAttribute('href', 'https://ru.wikibooks.org/wiki/Рецепт:Шакшука')
  await expect(original).toHaveAttribute('target', '_blank')

  const trust = page.getByRole('list', { name: 'Статус проверки' })
  await expect(trust).toContainText('Не проверен приготовлением')
  await expect(trust).toContainText('Источник и полнота проверены')

  const ingredients = page.getByRole('region', { name: 'Ингредиенты' })
  await expect(ingredients).toContainText('Яйцо куриное')
  await expect(ingredients).toContainText('3 шт.')
  await expect(
    page.getByRole('region', { name: 'Приготовление' }).getByRole('listitem'),
  ).toHaveCount(7)

  const source = page.getByRole('region', { name: 'Источник' })
  await expect(source.getByRole('link', { name: 'CC BY-SA 4.0' })).toBeVisible()
  await expect(source.getByRole('link', { name: 'история правок' })).toBeVisible()
  await expect(source).toContainText('версия страницы 270132')

  await page.getByRole('link', { name: '← Все рецепты' }).click()
  await expect(list).toBeVisible()

  // Рецепт с неполным источником обозначен честно.
  await list.getByRole('link', { name: /^Винегрет/ }).click()
  await expect(page.getByRole('list', { name: 'Статус проверки' })).toContainText(
    'Источник не проверен',
  )
  await expect(page.getByRole('region', { name: 'Источник' })).toContainText('Источник неполный')
})
