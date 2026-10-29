import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'
import { addProducts, PASSWORD, signIn, signUp, uniqueEmail } from './helpers.ts'

// A8: путь MVP целиком — из своих продуктов найти рецепт, открыть, сохранить, увидеть КБЖУ;
// данные на месте после перезагрузки и на другом устройстве.
test.skip(!process.env.E2E_DB, 'нужен локальный Supabase (E2E_DB=1)')

// Ответ 400 на неверный пароль браузер пишет в консоль — это ожидаемо.
test.use({ allowConsoleErrors: [/status of 400/] })

const KASHA = 'Гречневая каша с маслом'
const recipes = (page: Page) => page.getByRole('list', { name: 'Рецепты' })

test('MVP: запасы → подбор → рецепт → избранное и КБЖУ → другое устройство', async ({
  page,
  browser,
}) => {
  const email = uniqueEmail('mvp')

  // Вход с неверными данными — понятная ошибка, а не пустой экран.
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(`${PASSWORD}-wrong`)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Неверный email или пароль')

  await signUp(page, email)

  // Запасы: три продукта для каши и лишний, который удаляем.
  await addProducts(page, [
    ['гречка', /^Гречка/],
    ['сливочное', /^Масло сливочное/],
    ['соль', /^Соль$/],
    ['сахар', /^Сахар$/],
  ])
  const current = page.getByRole('list', { name: 'Сейчас есть', exact: true })
  await current.getByRole('button', { name: /^Сахар/ }).click()
  await page.getByRole('button', { name: 'Удалить' }).click()
  await page.getByRole('button', { name: 'Да, удалить' }).click()
  await expect(current.getByRole('listitem')).toHaveCount(3)

  // Подбор «из имеющегося» и поиск находят кашу; карточка открывается с клавиатуры.
  await page.goto('/?mode=have')
  await page.getByRole('searchbox', { name: 'Поиск по названию и ингредиентам' }).fill('гречк')
  const card = recipes(page).getByRole('link', { name: new RegExp(`^${KASHA}`) })
  await expect(card).toContainText('Все нужные продукты есть')
  await expect(card).toContainText(/≈ 1\s?406 ккал на всё блюдо/)
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: KASHA })).toBeVisible()

  // Внутри рецепта: КБЖУ на всё блюдо (порции в источнике не указаны), избранное, шаги.
  const kbju = page.getByRole('region', { name: /КБЖУ/ })
  await expect(kbju.getByRole('row', { name: /Калории/ })).toContainText(/1\s?406/)
  await expect(kbju).toContainText('Число порций не указано в источнике')
  const favorite = page.getByRole('button', { name: 'В избранное' })
  await expect(favorite).toBeEnabled()
  const saved = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/favorite_recipes') && r.request().method() === 'POST',
  )
  await favorite.click()
  await expect(favorite).toHaveAttribute('aria-pressed', 'true')
  expect((await saved).ok()).toBe(true)
  await expect(
    page.getByRole('region', { name: 'Приготовление' }).getByRole('listitem'),
  ).not.toHaveCount(0)

  // Перезагрузка — избранное на месте; «назад» возвращает к тому же поиску.
  await page.reload()
  await expect(page.getByRole('button', { name: 'В избранное' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Другое устройство: те же запасы, избранное и подбор.
  const device2 = await browser.newContext()
  const page2 = await device2.newPage()
  await signIn(page2, email, '/favorites')
  await expect(
    page2
      .getByRole('list', { name: 'Избранные рецепты' })
      .getByRole('link', { name: new RegExp(`^${KASHA}`) }),
  ).toBeVisible()
  await page2.goto('/pantry')
  await expect(
    page2.getByRole('list', { name: 'Сейчас есть', exact: true }).getByRole('listitem'),
  ).toHaveCount(3)
  await page2.goto('/?mode=have&q=гречк')
  await expect(recipes(page2).getByRole('link', { name: new RegExp(`^${KASHA}`) })).toBeVisible()
  await device2.close()

  // Выход: данные скрыты, раздел просит войти.
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Выйти' }).click()
  await page.goto('/favorites')
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Избранные рецепты' })).toHaveCount(0)
})
