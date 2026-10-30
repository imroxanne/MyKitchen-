import { expect, test } from './fixtures.ts'
import { signUp, uniqueEmail } from './helpers.ts'

// B3: дневник на настоящем Supabase — 0,5/1,5 порции, снимок не меняется при правке версии,
// правка и удаление записей переживают перезагрузку.
test.skip(!process.env.E2E_DB, 'нужен локальный Supabase (E2E_DB=1)')

test('«Съедено»: доли порций, суммы за день, прошлые записи не меняются при правке рецепта', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('b3'))
  await page
    .getByRole('list', { name: 'Рецепты' })
    .getByRole('link', { name: /^Шакшука/ })
    .click()
  const recipeUrl = page.url()

  // Шакшука: 365,43 ккал на 3 порции; 1,5 порции ≈ 182,7 ккал.
  await page.getByRole('button', { name: 'Съедено' }).click()
  let form = page.getByRole('form', { name: 'Записать как съеденное' })
  await form.getByLabel('Приём пищи').selectOption({ label: 'Обед' })
  await form.getByRole('button', { name: '1,5' }).click()
  await expect(form.getByText(/^Съедено:/)).toContainText('183 ккал')
  await form.getByRole('button', { name: 'Записать в дневник' }).click()
  await expect(page.getByText('Записано в дневник: Шакшука, 1,5 порции.')).toBeVisible()

  // Своя версия: 2 яйца вместо 3 (−71,5 ккал) → 293,93 ккал, 1 порция ≈ 98 ккал.
  await page.getByRole('button', { name: '+ Своя версия' }).click()
  const editor = page.getByRole('region', { name: 'Моя версия' })
  await editor.getByLabel('Название версии').fill('Два яйца')
  await editor.getByLabel('Количество: Яйцо куриное').fill('2')
  await editor.getByRole('button', { name: 'Сохранить версию' }).click()
  await expect(page.getByText('Версия сохранена. Оригинальный рецепт не изменился.')).toBeVisible()
  await page.getByRole('button', { name: 'Съедено' }).click()
  form = page.getByRole('form', { name: 'Записать как съеденное' })
  await expect(form).toContainText('версия «Два яйца»')
  await form.getByLabel('Приём пищи').selectOption({ label: 'Ужин' })
  await expect(form.getByText(/^Съедено:/)).toContainText('98 ккал')
  await form.getByRole('button', { name: 'Записать в дневник' }).click()
  await expect(page.getByText('Записано в дневник: Шакшука (Два яйца), 1 порция.')).toBeVisible()

  // Версию изменили — 6 яиц. Запись в дневнике остаётся прежней.
  const saved = page.getByRole('region', { name: 'Моя версия' })
  await saved.getByLabel('Количество: Яйцо куриное').fill('6')
  await saved.getByRole('button', { name: 'Сохранить версию' }).click()
  await expect(saved.getByText('Версия сохранена', { exact: false })).toBeVisible()

  await page.getByRole('link', { name: 'Открыть дневник' }).click()
  const total = page.getByRole('region', { name: 'Итого за день' })
  // 182,72 + 97,98 = 280,7.
  await expect(total).toContainText('281 ккал')
  const lunch = page.getByRole('region', { name: /Обед/ })
  const dinner = page.getByRole('region', { name: /Ужин/ })
  await expect(lunch).toContainText('1,5 порции')
  await expect(dinner).toContainText('98 ккал')
  await dinner.getByText('Состав на момент записи').click()
  await expect(dinner.getByText('Яйцо куриное — 2 шт.', { exact: true })).toBeVisible()

  // 1,5 → 0,5 порции: 60,9 + 97,98 ≈ 159.
  await lunch.getByRole('button', { name: 'Изменить: Шакшука' }).click()
  const edit = page.getByRole('form', { name: 'Изменить запись: Шакшука' })
  await edit.getByRole('button', { name: '0,5' }).click()
  await expect(edit.getByText(/^Съедено:/)).toContainText('61 ккал')
  await edit.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('Запись изменена.')).toBeVisible()
  await expect(total).toContainText('159 ккал')

  // После перезагрузки — то же; удаление записи версии.
  await page.reload()
  await expect(total).toContainText('159 ккал')
  await expect(lunch).toContainText('0,5 порции')
  await dinner.getByRole('button', { name: 'Удалить: Шакшука (Два яйца)' }).click()
  await dinner.getByRole('button', { name: 'Да, удалить' }).click()
  await expect(page.getByText('Запись «Шакшука (Два яйца)» удалена.')).toBeVisible()
  await expect(total).toContainText('61 ккал')
  await page.reload()
  await expect(total).toContainText('61 ккал')
  await expect(dinner).toHaveCount(0)

  // Исходный рецепт по-прежнему 365 ккал на блюдо.
  await page.goto(recipeUrl)
  await expect(
    page.getByRole('region', { name: /КБЖУ/ }).getByRole('row', { name: /Калории/ }),
  ).toContainText(/122\s*365/)
})
