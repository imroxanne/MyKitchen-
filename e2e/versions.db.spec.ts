import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'
import { signUp, uniqueEmail } from './helpers.ts'

// B2: пересчёт порций и своя версия рецепта на настоящем Supabase; оригинал неизменен.
test.skip(!process.env.E2E_DB, 'нужен локальный Supabase (E2E_DB=1)')

test('своя версия сохраняется отдельно, КБЖУ пересчитывается сразу, оригинал неизменен', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('b2'))
  await page
    .getByRole('list', { name: 'Рецепты' })
    .getByRole('link', { name: /^Шакшука/ })
    .click()
  const ingredients = page.getByRole('region', { name: 'Ингредиенты' })
  const kcal = (scope: Page | Locator = page) =>
    scope.getByRole('region', { name: /КБЖУ/ }).getByRole('row', { name: /Калории/ })

  // Пересчёт на 4 порции: яиц 3 → 4, КБЖУ на порцию тот же.
  await ingredients.getByRole('button', { name: 'Больше порций' }).click()
  await expect(ingredients).toContainText('4 порции')
  await expect(ingredients.getByRole('listitem').filter({ hasText: 'Яйцо куриное' })).toContainText(
    '4 шт.',
  )
  await expect(kcal()).toContainText(/122\s*487/)
  await ingredients.getByRole('button', { name: 'как в рецепте' }).click()

  // Своя версия: 2 яйца вместо 3, перец болгарский → морковь.
  // 365,43 − 71,5 (яйцо 50 г × 143) − 30,94 (перец 119 г × 26) + 25,01 (морковь 61 г × 41) ≈ 288.
  await page.getByRole('button', { name: '+ Своя версия' }).click()
  const editor = page.getByRole('region', { name: 'Моя версия' })
  await editor.getByLabel('Название версии').fill('Полегче')
  await editor.getByLabel('Количество: Яйцо куриное').fill('2')
  const pepper = editor
    .getByRole('list', { name: 'Состав версии' })
    .getByRole('listitem')
    .filter({ hasText: 'Перец болгарский' })
  await pepper.getByRole('button', { name: 'Заменить' }).click()
  await pepper.getByRole('searchbox').fill('морков')
  await pepper.getByRole('button', { name: /^Морковь/ }).click()
  await expect(editor).toContainText('заменено, было: Перец болгарский')
  await expect(editor).toContainText('было: 3 шт.')
  await expect(kcal(editor)).toContainText(/96\s*288/)

  await editor.getByRole('button', { name: 'Сохранить версию' }).click()
  await expect(page.getByText('Версия сохранена. Оригинальный рецепт не изменился.')).toBeVisible()
  await expect(page).toHaveURL(/version=\d+/)

  // После перезагрузки версия на месте.
  await page.reload()
  const saved = page.getByRole('region', { name: 'Моя версия' })
  await expect(saved.getByLabel('Количество: Яйцо куриное')).toHaveValue('2')
  await expect(kcal(saved)).toContainText(/96\s*288/)

  // Оригинал не изменился.
  await page.getByRole('button', { name: 'Оригинал' }).click()
  await expect(ingredients.getByRole('listitem').filter({ hasText: 'Яйцо куриное' })).toContainText(
    '3 шт.',
  )
  await expect(ingredients).toContainText('Перец болгарский')
  await expect(kcal()).toContainText(/122\s*365/)

  // Удаление версии.
  await page.getByRole('button', { name: 'Полегче' }).click()
  await page.getByRole('button', { name: 'Удалить версию' }).click()
  await page.getByRole('button', { name: 'Да' }).click()
  await expect(page.getByRole('button', { name: 'Полегче' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Полегче' })).toHaveCount(0)
})
