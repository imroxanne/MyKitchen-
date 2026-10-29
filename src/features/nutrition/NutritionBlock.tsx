import { calculateNutrition, type Conversion, type LineResult } from './calc'
import { EXCLUSION_LABEL, formatGrams, formatKcal } from './present'
import type { Macros, NutritionLine, NutritionSource } from './types'

const ROWS: { key: keyof Macros; label: string; format: (v: number) => string }[] = [
  { key: 'kcal', label: 'Калории, ккал', format: formatKcal },
  { key: 'protein', label: 'Белки, г', format: formatGrams },
  { key: 'fat', label: 'Жиры, г', format: formatGrams },
  { key: 'carbs', label: 'Углеводы, г', format: formatGrams },
]

const UNIT_LABEL: Record<string, string> = {
  pcs: 'шт.',
  clove: 'зубчик',
  bunch: 'пучок',
  pack: 'упаковка',
  tsp: 'ч. л.',
  tbsp: 'ст. л.',
  cup: 'стакан',
  ml: 'мл',
  l: 'л',
}

/** «1 шт. ≈ 110 г» или «1 ст. л. ≈ 16,6 г». */
function describeConversion(c: Conversion, unitCode: string | null): string {
  const unit = (unitCode && UNIT_LABEL[unitCode]) ?? 'ед.'
  const grams = c.kind === 'piece' ? c.gramsPerPiece : c.mlPerUnit * c.gramsPerMl
  return `1 ${unit} ≈ ${formatGrams(grams)} г`
}

const names = (lines: LineResult[]) => lines.map((l) => l.line.name).join(', ')

/** Расчёт КБЖУ блюда по ингредиентам: на порцию, на всё блюдо, на 100 г (если известен выход). */
export function NutritionBlock({
  lines,
  servings,
  yieldGrams,
  sources,
}: {
  lines: NutritionLine[]
  servings: number | null
  yieldGrams: number | null
  sources: NutritionSource[]
}) {
  const result = calculateNutrition(lines, servings, yieldGrams)
  const columns = [
    result.perServing && { title: 'На порцию', values: result.perServing },
    { title: 'На всё блюдо', values: result.total },
    result.per100g && { title: 'На 100 г', values: result.per100g },
  ].filter((c) => !!c)
  const approximateData = result.counted.filter((r) => r.line.nutrition?.approximate)
  const usedSources = sources.filter((s) =>
    result.counted.some((r) => r.line.nutrition?.sourceCode === s.code),
  )

  return (
    <section className="card" aria-labelledby="nutrition-title">
      <h2 id="nutrition-title">
        КБЖУ <span className="badge">ориентировочно</span>
      </h2>

      {result.counted.length === 0 ? (
        <p className="muted">Посчитать не удалось: нет данных ни для одного ингредиента.</p>
      ) : (
        <table className="nutrition-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Показатель</span>
              </th>
              {columns.map((c) => (
                <th scope="col" key={c.title}>
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {columns.map((c) => (
                  <td key={c.title}>{row.format(c.values[row.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result.incomplete && (
        <p className="note-missing">
          Расчёт неполный, итог занижен. Не учтено:{' '}
          {result.missing
            .map((m) => `${m.line.name} (${EXCLUSION_LABEL[m.excluded ?? 'no_data']})`)
            .join(', ')}
          .
        </p>
      )}
      {result.minor.length > 0 && (
        <p className="muted small">
          Не учтено «по вкусу»: {names(result.minor)} — вклад обычно мал.
        </p>
      )}
      {result.optional.length > 0 && (
        <p className="muted small">
          Не учтено «по желанию»: {names(result.optional)} — добавьте к итогу, если используете.
        </p>
      )}
      {!servings && (
        <p className="muted small">
          Число порций не указано в источнике — расчёт только на всё блюдо.
        </p>
      )}
      {!yieldGrams && (
        <p className="muted small">
          На 100 г не считаем: масса готового блюда неизвестна, а при варке и жарке вес меняется.
        </p>
      )}
      <p className="muted small">
        Считается по сырым продуктам из рецепта. Масло и жир учтены полностью, хотя часть остаётся
        на посуде; потери при готовке не учитываются.
      </p>

      {result.counted.length > 0 && (
        <details className="nutrition-details">
          <summary>Как посчитано</summary>
          <ul className="nutrition-lines">
            {result.counted
              .filter((r) => r.grams !== null && r.line.nutrition)
              .map((r) => {
                const n = r.line.nutrition!
                return (
                  <li key={r.line.name}>
                    <span>
                      {r.line.name}
                      {n.approximate && ' *'}
                      <span className="muted small nutrition-line-detail">
                        {r.conversion
                          ? `≈ ${formatGrams(r.grams ?? 0)} г (${describeConversion(r.conversion, r.line.unitCode)}, мера USDA: ${r.conversion.portion})`
                          : `${formatGrams(r.grams ?? 0)} г`}
                        {' · '}
                        <a
                          href={`https://fdc.nal.usda.gov/food-details/${n.sourceFoodId}/nutrients`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={n.sourceFoodName}
                        >
                          USDA {n.sourceFoodId}
                        </a>
                      </span>
                    </span>
                    <span className="amount">{formatKcal(r.values?.kcal ?? 0)} ккал</span>
                  </li>
                )
              })}
          </ul>
          {approximateData.length > 0 && (
            <p className="muted small">
              * Состав приближённый:{' '}
              {approximateData.map((r) => `${r.line.name} — ${r.line.nutrition?.note}`).join('; ')}.
            </p>
          )}
          <p className="muted small">
            Штуки и ложки переведены в граммы по средним мерам; настоящая масса может отличаться.
            Значения на 100 г съедобной части.
          </p>
          {usedSources.map((s) => (
            <p key={s.code} className="small">
              Источник:{' '}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title}
              </a>
              {s.datasetVersion && ` (${s.datasetVersion})`}, {s.license}.
            </p>
          ))}
        </details>
      )}
    </section>
  )
}
