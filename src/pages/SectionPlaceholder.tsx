import type { Section } from '../app/sections'

// Заглушка раздела: честно показывает, что функциональность ещё не реализована.
export function SectionPlaceholder({ section }: { section: Section }) {
  return (
    <section aria-labelledby="section-title">
      <h1 id="section-title">{section.title}</h1>
      <p>{section.summary}</p>
      <p className="notice" role="note">
        Раздел ещё не реализован. Появится в пунктах дорожной карты: {section.roadmap.join(', ')}.
      </p>
    </section>
  )
}
