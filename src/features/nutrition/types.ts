/** КБЖУ: килокалории и граммы белков, жиров, углеводов. */
export interface Macros {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

/** Пищевая ценность продукта на 100 г съедобной части и её источник. */
export interface IngredientNutrition extends Macros {
  /** Состав заметно отличается от российского продукта или выбран один вариант из многих. */
  approximate: boolean
  note: string | null
  sourceCode: string
  sourceFoodId: string
  sourceFoodName: string
}

/** Масса единицы: для ml — граммы в 1 мл, для штучных — граммы в одной штуке. */
export interface UnitWeight {
  unitCode: string
  grams: number
  portion: string
}

export interface NutritionSource {
  code: string
  title: string
  url: string
  datasetVersion: string | null
  license: string
  licenseUrl: string | null
  citation: string
}

/** Строка рецепта в объёме, нужном для расчёта КБЖУ. */
export interface NutritionLine {
  name: string
  categorySlug: string
  /** «По желанию» (optional) в базовый расчёт не входит. */
  importance: 'key' | 'main' | 'minor' | 'optional'
  quantity: number | null
  unitCode: string | null
  unitKind: 'mass' | 'volume' | 'count' | 'other' | null
  /** Граммы (масса) или миллилитры (объём) в одной единице. */
  unitBaseFactor: number | null
  nutrition: IngredientNutrition | null
  unitWeights: UnitWeight[]
}
