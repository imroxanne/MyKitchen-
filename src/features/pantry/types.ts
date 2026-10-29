import type { IngredientNutrition, UnitWeight, UserNutrition } from '../nutrition/types'

export type ProductKind = 'staple' | 'current'

export const KIND_TITLES: Record<ProductKind, string> = {
  current: 'Сейчас есть',
  staple: 'Обычно есть',
}

export interface Unit {
  code: string
  name: string
  kind: 'mass' | 'volume' | 'count' | 'other'
  isApproximate: boolean
  /** Сколько граммов (масса) или миллилитров (объём) в одной единице; null — не пересчитывается. */
  baseFactor: number | null
}

export interface Category {
  slug: string
  name: string
}

export interface CatalogItem {
  id: number
  name: string
  categorySlug: string
  defaultUnit: string | null
  /** Личный продукт пользователя (не из общего справочника). */
  isOwn: boolean
  synonyms: string[]
}

export interface Catalog {
  items: CatalogItem[]
  categories: Category[]
  units: Unit[]
}

export interface UserProduct {
  id: number
  ingredientId: number
  kind: ProductKind
  /** null — количество неизвестно. */
  quantity: number | null
  unitCode: string | null
  /** Дата в формате YYYY-MM-DD. */
  expiresOn: string | null
  isExcluded: boolean
}

export interface NewProduct {
  ingredientId: number
  kind: ProductKind
}

export interface ProductPatch {
  kind?: ProductKind
  quantity?: number | null
  unitCode?: string | null
  expiresOn?: string | null
  isExcluded?: boolean
}

/** Справочные КБЖУ продукта: в исходном виде и после варки (B1). */
export interface ReferenceNutrition {
  state: 'as_purchased' | 'cooked'
  nutrition: IngredientNutrition
  weights: UnitWeight[]
}

/** Доступ к данным раздела. Реальная реализация — Supabase, в тестах — память. */
export interface PantryApi {
  loadCatalog(): Promise<Catalog>
  listProducts(): Promise<UserProduct[]>
  addProducts(items: NewProduct[]): Promise<UserProduct[]>
  updateProduct(id: number, patch: ProductPatch): Promise<UserProduct>
  deleteProduct(id: number): Promise<void>
  createOwnIngredient(name: string, categorySlug: string): Promise<CatalogItem>
  /** Свои КБЖУ с упаковки (B1) — для всех продуктов пользователя. */
  listUserNutrition(): Promise<UserNutrition[]>
  saveUserNutrition(data: UserNutrition): Promise<UserNutrition>
  deleteUserNutrition(ingredientId: number): Promise<void>
  /** Справочные КБЖУ продукта; пустой список — справочных данных нет. */
  loadReferenceNutrition(ingredientId: number): Promise<ReferenceNutrition[]>
}
