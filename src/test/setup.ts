import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // В тестах с окружением node хранилища нет.
  globalThis.sessionStorage?.clear()
})
