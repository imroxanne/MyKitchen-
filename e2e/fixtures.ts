import { test as base, expect } from '@playwright/test'

/**
 * Общий `test` для сквозных проверок: тест падает, если в браузере была ошибка JavaScript или
 * сообщение об ошибке в консоли — даже когда на экране всё выглядит нормально.
 * Ожидаемые ошибки (например, специально оборванная сеть) разрешаются через allowConsoleErrors.
 */
export const test = base.extend<{ allowConsoleErrors: RegExp[]; consoleGuard: void }>({
  allowConsoleErrors: [[], { option: true }],
  consoleGuard: [
    async ({ page, allowConsoleErrors }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`Ошибка JavaScript: ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error' && !allowConsoleErrors.some((re) => re.test(m.text())))
          errors.push(m.text())
      })
      await use()
      expect(errors, 'ошибки в консоли браузера').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
