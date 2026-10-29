import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

// A5: подбор по продуктам на настоящем Supabase и реальных рецептах партии batch-01.
test.skip(!process.env.E2E_DB, 'нужен локальный Supabase (E2E_DB=1)')

async function addProducts(page: Page, picks: [query: string, name: RegExp][]) {
  await page.goto('/pantry')
  const search = page.getByRole('searchbox', { name: 'Найти продукт' })
  for (const [query, name] of picks) {
    await search.fill(query)
    await page.getByRole('checkbox', { name }).check()
  }
  await page.getByRole('button', { name: `Добавить выбранные (${picks.length})` }).click()
  await expect(page.getByText(`Добавлено: ${picks.length}`)).toBeVisible()
}

const cards = (page: Page) => page.getByRole('list', { name: 'Рецепты' }).getByRole('link')

test('подбор учитывает недостающие продукты, фильтры совмещаются', async ({ page }) => {
  const email = `e2e-match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  await page.goto('/')
  await page.getByRole('button', { name: 'Нет аккаунта? Зарегистрироваться' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill('Test-password-123')
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

  // Без запасов — подбор без учёта запасов, все 22 рецепта.
  await expect(page.getByRole('radio', { name: 'Без учёта запасов' })).toBeChecked()
  await expect(cards(page)).toHaveCount(22)

  // Всё для шакшуки, кроме масла.
  await addProducts(page, [
    ['яйцо', /^Яйцо куриное/],
    ['помидор', /^Томат \(помидор\)/],
    ['болгарский', /^Перец болгарский/],
    ['репчатый', /^Лук репчатый/],
    ['чеснок', /^Чеснок$/],
    ['томатная паста', /^Томатная паста/],
  ])

  // «Из имеющегося» — шакшуки нет: не хватает масла для жарки.
  await page.goto('/?mode=have')
  await expect(page.getByRole('status')).toContainText('Найдено')
  await expect(cards(page).filter({ hasText: 'Шакшука' })).toHaveCount(0)

  // «Докупить не больше 1» + поиск — шакшука с пояснением.
  await page.getByRole('radio', { name: 'Докупить не больше' }).check()
  await page.getByLabel('Сколько продуктов можно докупить').selectOption('1')
  await page.getByRole('searchbox', { name: 'Поиск по названию и ингредиентам' }).fill('шакш')
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('Не хватает: Масло оливковое')

  // Фильтр по типу блюда «Десерт» вместе с поиском — пусто.
  await page.getByText('Фильтры', { exact: true }).click()
  await page.getByRole('button', { name: 'Десерт' }).click()
  await expect(page.getByText('Под выбранные условия рецептов нет.')).toBeVisible()

  // Добавили масло — шакшука в режиме «из имеющегося».
  await addProducts(page, [['оливковое', /^Масло оливковое/]])
  await page.goto('/?mode=have&q=шакш')
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page).first()).toContainText('Все нужные продукты есть')

  // На странице рецепта — отметки наличия.
  await cards(page).first().click()
  const ingredients = page.getByRole('region', { name: 'Ингредиенты' })
  await expect(ingredients).toContainText('По вашим запасам все нужные продукты есть.')
  await expect(ingredients.getByText('есть, количество не сравнивалось').first()).toBeVisible()
})
