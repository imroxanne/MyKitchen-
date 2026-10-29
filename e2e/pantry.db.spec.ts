import { expect, test, type Page } from '@playwright/test'

// Сквозной сценарий A3 на настоящем Supabase (локальный стек в CI).
// Запускается только при E2E_DB=1, когда сборка указывает на тестовую БД.
test.skip(!process.env.E2E_DB, 'нужен локальный Supabase (E2E_DB=1)')

const PASSWORD = 'Test-password-123'

function uniqueEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

async function signUp(page: Page, email: string) {
  await page.goto('/pantry')
  await page.getByRole('button', { name: 'Нет аккаунта? Зарегистрироваться' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(PASSWORD)
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
  await expect(page.getByRole('heading', { name: 'Добавить продукты' })).toBeVisible()
}

async function signIn(page: Page, email: string) {
  await page.goto('/pantry')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(PASSWORD)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Добавить продукты' })).toBeVisible()
}

async function search(page: Page, query: string) {
  const box = page.getByRole('searchbox', { name: 'Найти продукт' })
  await box.fill(query)
}

const group = (page: Page, name: 'Сейчас есть' | 'Обычно есть') =>
  page.getByRole('list', { name, exact: true })

test('продукты сохраняются в аккаунте, переживают перезагрузку и не видны другим', async ({
  page,
  browser,
}) => {
  const email = uniqueEmail('owner')
  await signUp(page, email)

  // Поиск по синонимам, выбор нескольких продуктов.
  await search(page, 'помидоры')
  await page.getByRole('checkbox', { name: /^Томат \(помидоры?\)/ }).check()
  await search(page, 'морковка')
  await page.getByRole('checkbox', { name: /^Морковь/ }).check()
  await page.getByRole('button', { name: 'Добавить выбранные (2)' }).click()
  await expect(group(page, 'Сейчас есть').getByRole('listitem')).toHaveCount(2)

  // Количество, единица и срок для томата.
  await group(page, 'Сейчас есть').getByRole('button', { name: /Томат/ }).click()
  const tomato = page.getByRole('form', { name: 'Изменить: Томат' })
  await tomato.getByLabel('Количество').fill('1,5')
  await tomato.getByLabel('Единица').selectOption('kg')
  await tomato.getByLabel('Годен до').fill('2030-01-15')
  await tomato.getByRole('button', { name: 'Сохранить' }).click()
  await expect(group(page, 'Сейчас есть').getByText('1,5 кг')).toBeVisible()

  // Морковь — в «Обычно есть».
  await group(page, 'Сейчас есть')
    .getByRole('button', { name: /Морковь/ })
    .click()
  const carrot = page.getByRole('form', { name: 'Изменить: Морковь' })
  await carrot.getByRole('radio', { name: 'Обычно есть' }).check()
  await carrot.getByRole('button', { name: 'Сохранить' }).click()
  await expect(group(page, 'Обычно есть').getByText('Морковь')).toBeVisible()

  // Свой продукт.
  await search(page, 'Соус бабушки')
  await page.getByRole('button', { name: 'Добавить «Соус бабушки» как свой продукт' }).click()
  await expect(group(page, 'Сейчас есть').getByText('Соус бабушки')).toBeVisible()

  const expectSaved = async (p: Page) => {
    await expect(group(p, 'Сейчас есть').getByText('Томат')).toBeVisible()
    await expect(group(p, 'Сейчас есть').getByText('1,5 кг')).toBeVisible()
    await expect(group(p, 'Сейчас есть').getByText('Соус бабушки')).toBeVisible()
    await expect(group(p, 'Обычно есть').getByText('Морковь')).toBeVisible()
  }

  // Перезагрузка страницы — тот же список.
  await page.reload()
  await expectSaved(page)

  // «Другое устройство»: новый браузерный контекст, вход тем же аккаунтом.
  const device2 = await browser.newContext()
  const page2 = await device2.newPage()
  await signIn(page2, email)
  await expectSaved(page2)
  await device2.close()

  // Другой пользователь не видит чужие продукты и чужой личный продукт.
  const stranger = await browser.newContext()
  const page3 = await stranger.newPage()
  await signUp(page3, uniqueEmail('stranger'))
  await expect(group(page3, 'Сейчас есть')).toHaveCount(0)
  await expect(page3.getByText('Пока пусто.')).toHaveCount(2)
  await search(page3, 'Соус бабушки')
  await expect(page3.getByText('Ничего не найдено')).toBeVisible()
  await stranger.close()

  // Выход из аккаунта скрывает данные.
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Выйти' }).click()
  await page.goto('/pantry')
  await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible()
})
