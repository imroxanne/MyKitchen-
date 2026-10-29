import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NutritionBlock } from './NutritionBlock'
import type { NutritionLine } from './types'

// ТЕСТОВЫЕ данные.
const base: NutritionLine = {
  name: 'Мука',
  categorySlug: 'grains',
  importance: 'key',
  quantity: 100,
  unitCode: 'g',
  unitKind: 'mass',
  unitBaseFactor: 1,
  nutrition: {
    kcal: 350,
    protein: 10,
    fat: 1,
    carbs: 75,
    approximate: true,
    note: 'ТЕСТОВОЕ пояснение',
    sourceCode: 'test',
    sourceFoodId: '1',
    sourceFoodName: 'TEST flour',
  },
  unitWeights: [],
}

describe('блок КБЖУ', () => {
  it('неполный расчёт назван неполным, неизвестное перечислено с причиной', () => {
    render(
      <NutritionBlock
        lines={[
          base,
          { ...base, name: 'Мясо (любое)', nutrition: null },
          { ...base, name: 'Масло', quantity: null, unitCode: null },
          { ...base, name: 'Перец', quantity: null, unitCode: 'to_taste', importance: 'minor' },
        ]}
        servings={2}
        yieldGrams={null}
        sources={[]}
      />,
    )
    const block = screen.getByRole('region', { name: /КБЖУ/ })
    expect(block).toHaveTextContent(
      'Расчёт неполный, итог занижен. Не учтено: Мясо (любое) (нет данных о составе), Масло (количество не указано).',
    )
    expect(block).toHaveTextContent('Не учтено «по вкусу»: Перец')
    expect(block).toHaveTextContent('* Состав приближённый: Мука — ТЕСТОВОЕ пояснение')
  })

  it('нечего считать — так и сказано, без нулей', () => {
    render(
      <NutritionBlock
        lines={[{ ...base, nutrition: null }]}
        servings={2}
        yieldGrams={null}
        sources={[]}
      />,
    )
    expect(screen.getByText(/Посчитать не удалось/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
