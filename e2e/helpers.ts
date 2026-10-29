import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'Test-password-123'

/** Уникальный адрес для тестового аккаунта (домен example.com — не настоящий почтовый ящик). */
export function uniqueEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

/** Регистрация на странице path; ждёт, пока форма входа исчезнет. */
export async function signUp(page: Page, email: string, path = '/') {
  await page.goto(path)
  await page.getByRole('button', { name: 'Нет аккаунта? Зарегистрироваться' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(PASSWORD)
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
  await expect(page.getByLabel('Пароль')).toHaveCount(0)
}

export async function signIn(page: Page, email: string, path = '/') {
  await page.goto(path)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(PASSWORD)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByLabel('Пароль')).toHaveCount(0)
}

/** Добавляет продукты из справочника через поиск в «Моих продуктах». */
export async function addProducts(page: Page, picks: [query: string, name: RegExp][]) {
  await page.goto('/pantry')
  const search = page.getByRole('searchbox', { name: 'Найти продукт' })
  for (const [query, name] of picks) {
    await search.fill(query)
    await page.getByRole('checkbox', { name }).check()
  }
  await page.getByRole('button', { name: `Добавить выбранные (${picks.length})` }).click()
  await expect(page.getByText(`Добавлено: ${picks.length}`)).toBeVisible()
}
