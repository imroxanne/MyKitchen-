import { useState } from 'react'
import { calculateNutrition, type Conversion, type LineResult } from './calc'
import { formatDate } from '../recipes/present'
import { EXCLUSION_LABEL, formatGrams, formatKcal } from './present'
import type { Macros, NutritionLine, NutritionSource, YieldMeasurement } from './types'

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
  g: 'г',
  kg: 'кг',
}

const AMOUNT_UNIT = { g: 'г', ml: 'мл' }

/** «1 шт. ≈ 110 г», «1 ст. л. ≈ 16,6 г» или «1 г ≈ 0,97 мл». */
function describeConversion(c: Conversion, unitCode: string | null): string {
  const unit = (unitCode && UNIT_LABEL[unitCode]) ?? 'ед.'
  if (c.kind === 'piece') return `1 ${unit} ≈ ${formatGrams(c.gramsPerPiece)} г`
  if (c.kind === 'volume') return `1 ${unit} ≈ ${formatGrams(c.mlPerUnit * c.gramsPerMl)} г`
  return `1 мл ≈ ${c.gramsPerMl.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} г`
}

const names = (lines: LineResult[]) => lines.map((l) => l.line.name).join(', ')

/**
 * Расчёт КБЖУ блюда по ингредиентам: на порцию, на всё блюдо и — если готовое блюдо взвешено —
 * на 100 г готового блюда (ТЗ §9).
 */
export function NutritionBlock({
  lines,
  servings,
  yieldGrams,
  sources,
  measuredYield = null,
  onSaveYield,
}: {
  lines: NutritionLine[]
  servings: number | null
  /** Масса готового блюда по данным источника. */
  yieldGrams: number | null
  sources: NutritionSource[]
  /** Масса готового блюда по вашему взвешиванию — приоритетнее данных источника. */
  measuredYield?: YieldMeasurement | null
  /** Сохранить или удалить (null) своё взвешивание; без него поле ввода не показывается. */
  onSaveYield?: (grams: number | null) => Promise<void>
}) {
  const effectiveYield = measuredYield?.grams ?? yieldGrams
  const result = calculateNutrition(lines, servings, effectiveYield)
  const columns = [
    result.perServing && { title: 'На порцию', values: result.perServing },
    { title: 'На всё блюдо', values: result.total },
    result.per100g && { title: 'На 100 г готового', values: result.per100g },
  ].filter((c) => !!c)
  const approximateData = result.counted.filter(
    (r) => r.source === 'reference' && r.line.nutrition?.approximate,
  )
  const fromPackage = result.counted.filter((r) => r.source === 'package')
  const usedSources = sources.filter((s) =>
    result.counted.some((r) => r.source === 'reference' && r.line.nutrition?.sourceCode === s.code),
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
      {fromPackage.length > 0 && (
        <p className="small">
          По вашим данным с упаковки:{' '}
          {fromPackage
            .map(
              (r) =>
                r.line.name +
                (r.line.userNutrition?.brand ? ` (${r.line.userNutrition.brand})` : ''),
            )
            .join(', ')}
          .
        </p>
      )}
      {!servings && (
        <p className="muted small">
          Число порций не указано в источнике — расчёт только на всё блюдо.
        </p>
      )}
      {measuredYield ? (
        <p className="muted small">
          На 100 г — по вашему взвешиванию готового блюда: {formatGrams(measuredYield.grams)} г (
          {formatDate(measuredYield.measuredAt)}).
        </p>
      ) : (
        !yieldGrams && (
          <p className="muted small">
            На 100 г не считаем: масса готового блюда неизвестна, а при варке и жарке вес меняется.
            {onSaveYield && ' Взвесьте готовое блюдо и укажите массу ниже.'}
          </p>
        )
      )}
      {onSaveYield && <YieldForm measured={measuredYield} onSave={onSaveYield} />}
      <p className="muted small">
        Считается по продуктам в исходном виде (до приготовления). Масло и жир учтены полностью,
        хотя часть остаётся на посуде; потери при готовке не учитываются.
      </p>

      {result.counted.length > 0 && (
        <details className="nutrition-details">
          <summary>Как посчитано</summary>
          <ul className="nutrition-lines">
            {result.counted
              .filter((r) => r.amount !== null)
              .map((r) => (
                <li key={r.line.name}>
                  <span>
                    {r.line.name}
                    {r.source === 'reference' && r.line.nutrition?.approximate && ' *'}
                    <span className="muted small nutrition-line-detail">
                      {r.approximate ? '≈ ' : ''}
                      {formatGrams(r.amount ?? 0)} {AMOUNT_UNIT[r.amountUnit]}
                      {r.conversion &&
                        ` (${describeConversion(r.conversion, r.line.unitCode)}; мера: ${r.conversion.portion})`}
                      {' · '}
                      <LineSource result={r} />
                    </span>
                  </span>
                  <span className="amount">{formatKcal(r.values?.kcal ?? 0)} ккал</span>
                </li>
              ))}
          </ul>
          {approximateData.length > 0 && (
            <p className="muted small">
              * Состав приближённый:{' '}
              {approximateData.map((r) => `${r.line.name} — ${r.line.nutrition?.note}`).join('; ')}.
            </p>
          )}
          <p className="muted small">
            Штуки и ложки переведены в граммы по средним мерам; настоящая масса может отличаться.
            Справочные значения — на 100 г съедобной части.
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

function LineSource({ result }: { result: LineResult }) {
  const user = result.line.userNutrition
  if (result.source === 'package' && user)
    return (
      <>
        ваша упаковка{user.brand ? ` «${user.brand}»` : ''}, на{' '}
        {user.basis === '100ml' ? '100 мл' : '100 г'}
      </>
    )
  const n = result.line.nutrition
  if (!n) return null
  return (
    <a
      href={`https://fdc.nal.usda.gov/food-details/${n.sourceFoodId}/nutrients`}
      target="_blank"
      rel="noopener noreferrer"
      title={n.sourceFoodName}
    >
      USDA {n.sourceFoodId}
    </a>
  )
}

/** Масса готового блюда по взвешиванию: целое положительное число граммов. */
function YieldForm({
  measured,
  onSave,
}: {
  measured: YieldMeasurement | null
  onSave: (grams: number | null) => Promise<void>
}) {
  const [value, setValue] = useState(measured ? String(measured.grams) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const grams = Number(value.replace(',', '.'))
  const valid = value.trim() !== '' && Number.isFinite(grams) && grams > 0 && grams <= 100000

  const run = async (next: number | null) => {
    setBusy(true)
    setError(null)
    try {
      await onSave(next)
      if (next === null) setValue('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="yield-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) void run(Math.round(grams))
      }}
    >
      <label className="inline-field">
        Масса готового блюда, г
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={value.trim() !== '' && !valid}
          placeholder="например, 850"
        />
      </label>
      <div className="actions">
        <button type="submit" disabled={!valid || busy}>
          Сохранить массу
        </button>
        {measured && (
          <button type="button" className="link" disabled={busy} onClick={() => void run(null)}>
            Удалить взвешивание
          </button>
        )}
      </div>
      {value.trim() !== '' && !valid && (
        <p className="error small">Укажите массу в граммах — число больше нуля.</p>
      )}
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
