import { Link } from 'react-router'

export function NotFound() {
  return (
    <section>
      <h1>Страница не найдена</h1>
      <p>
        <Link to="/">На главную</Link>
      </p>
    </section>
  )
}
