// Извлекает КБЖУ и массы единиц из USDA FoodData Central (SR Legacy, CSV) по файлам
// content/nutrition/mapping.tsv и portions.tsv. Числа не вводятся вручную — только отсюда.
//   node scripts/nutrition/extract-fdc.ts --fdc <папка с CSV SR Legacy>
// Архив: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseTsv, US_VOLUME_ML } from './data.ts'

/** Разбор CSV FoodData Central: поля в кавычках, кавычка внутри удваивается. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) rows.push([...row, field])
  const [header, ...data] = rows
  return data
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

const NUTRIENTS = { '1008': 'kcal', '1003': 'protein', '1004': 'fat', '1005': 'carbs' } as const
type Nutrient = (typeof NUTRIENTS)[keyof typeof NUTRIENTS]

/** Мера так, как её показывает USDA: «1 cup, chopped = 160g». */
export function renderPortion(p: Record<string, string>, unitName: string): string {
  const parts = [p.amount, unitName === 'undetermined' ? '' : unitName, p.modifier].filter(Boolean)
  return `${parts.join(' ')} = ${p.gram_weight}g`
}

/** Объём меры в миллилитрах, если это мера объёма. */
export function portionVolumeMl(portion: string): number | null {
  const m = /^([\d.]+) (cup|tbsp|tablespoon|tsp|teaspoon|ml|fl oz)\b/.exec(portion)
  return m ? Number(m[1]) * US_VOLUME_ML[m[2]] : null
}

const round = (n: number, digits: number) => Number(n.toFixed(digits))

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const dirArg = process.argv.indexOf('--fdc')
  if (dirArg < 0) throw new Error('Укажите --fdc <папка с CSV SR Legacy>')
  const dir = process.argv[dirArg + 1].replace(/\/$/, '')
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const content = `${root}content/nutrition/`
  const csv = (name: string) => parseCsv(readFileSync(`${dir}/${name}`, 'utf8'))

  const mapping = parseTsv(readFileSync(`${content}mapping.tsv`, 'utf8'), 4)
  const portions = parseTsv(readFileSync(`${content}portions.tsv`, 'utf8'), 6)
  const ids = new Set([...mapping.flatMap((r) => r[1].split('+')), ...portions.map((r) => r[2])])

  const foods = new Map(csv('food.csv').map((f) => [f.fdc_id, f.description]))
  const values = new Map<string, Partial<Record<Nutrient, number>>>()
  for (const n of csv('food_nutrient.csv')) {
    const key = NUTRIENTS[n.nutrient_id as keyof typeof NUTRIENTS]
    if (!key || !ids.has(n.fdc_id)) continue
    values.set(n.fdc_id, { ...values.get(n.fdc_id), [key]: Number(n.amount) })
  }
  const units = new Map(csv('measure_unit.csv').map((u) => [u.id, u.name]))
  const portionsById = new Map<string, string[]>()
  for (const p of csv('food_portion.csv')) {
    if (!ids.has(p.fdc_id)) continue
    const text = renderPortion(p, units.get(p.measure_unit_id) ?? '')
    portionsById.set(p.fdc_id, [...(portionsById.get(p.fdc_id) ?? []), text])
  }

  const errors: string[] = []
  const nutrientLines = mapping.map(([name, fdc, approx, note]) => {
    const parts = fdc.split('+')
    const sums = { kcal: 0, protein: 0, fat: 0, carbs: 0 }
    for (const id of parts) {
      const v = values.get(id)
      if (!foods.has(id) || !v) errors.push(`${name}: нет записи ${id}`)
      for (const k of Object.keys(sums) as Nutrient[]) {
        if (v?.[k] === undefined) errors.push(`${name}: у ${id} нет «${k}»`)
        sums[k] += (v?.[k] ?? 0) / parts.length
      }
    }
    const description = parts.map((id) => foods.get(id)).join(' + ')
    return [name, fdc, description, ...Object.values(sums).map((v) => round(v, 2)), approx, note]
  })
  const weightLines = portions.map(([name, unit, fdc, portion, divisor, note]) => {
    if (!portionsById.get(fdc)?.includes(portion))
      errors.push(`${name}: у ${fdc} нет меры «${portion}»: ${portionsById.get(fdc)?.join('; ')}`)
    const grams = Number(/= ([\d.]+)g$/.exec(portion)?.[1]) / Number(divisor)
    let value = round(grams, 2)
    if (unit === 'ml') {
      const ml = portionVolumeMl(portion)
      if (!ml) errors.push(`${name}: мера «${portion}» — не объём`)
      value = round(grams / (ml ?? 1), 4)
    }
    return [name, unit, value, fdc, portion, note]
  })
  if (errors.length) throw new Error(errors.join('\n'))

  const header = (what: string, columns: string) =>
    `# СГЕНЕРИРОВАНО scripts/nutrition/extract-fdc.ts из USDA FoodData Central, SR Legacy (2018-04).\n` +
    `# Не редактировать вручную. ${what}\n# ${columns}\n`
  writeFileSync(
    `${content}usda-nutrients.tsv`,
    header(
      'КБЖУ на 100 г съедобной части.',
      'продукт\tfdc_id\tописание USDA\tккал\tбелки г\tжиры г\tуглеводы г\tприближённо\tпояснение',
    ) +
      nutrientLines.map((l) => l.join('\t')).join('\n') +
      '\n',
  )
  writeFileSync(
    `${content}usda-unit-weights.tsv`,
    header(
      'Граммы в одной единице (для ml — в 1 мл).',
      'продукт\tединица\tграммы\tfdc_id\tмера USDA\tпояснение',
    ) +
      weightLines.map((l) => l.join('\t')).join('\n') +
      '\n',
  )
  console.log(`КБЖУ: ${nutrientLines.length}, масс единиц: ${weightLines.length}`)
}
