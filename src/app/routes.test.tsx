import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'
import { sections } from './sections'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('маршруты', () => {
  it('навигация открывает каждый раздел', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const nav = screen.getByRole('navigation', { name: 'Разделы' })

    for (const section of sections) {
      const links = nav.querySelectorAll(`a[href="${section.path}"]`)
      expect(links).toHaveLength(1)
      await user.click(links[0] as HTMLElement)
      expect(screen.getByRole('heading', { level: 1, name: section.title })).toBeInTheDocument()
    }
  })

  it('раздел-заглушка не выдаёт себя за готовую функцию', () => {
    renderAt('/pantry')
    expect(screen.getByRole('note')).toHaveTextContent('Раздел ещё не реализован')
  })

  it('экран состояния без настроек не пытается обращаться к БД', async () => {
    renderAt('/status')
    expect(await screen.findByText(/нет настроек подключения/)).toBeInTheDocument()
  })

  it('неизвестный адрес показывает «не найдено»', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument()
  })
})
