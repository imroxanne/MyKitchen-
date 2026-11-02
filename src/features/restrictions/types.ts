/** Вид ограничения (ТЗ §7): отдельные сущности, без общей шкалы «лёгкая/тяжёлая». */
export type RestrictionKind = 'allergy' | 'intolerance' | 'medical' | 'preference'

export const RESTRICTION_KINDS: RestrictionKind[] = [
  'allergy',
  'intolerance',
  'medical',
  'preference',
]

export const KIND_LABEL: Record<RestrictionKind, string> = {
  allergy: 'Аллергия',
  intolerance: 'Непереносимость',
  medical: 'Другое медицинское ограничение',
  preference: 'Не ем (предпочтение)',
}

/** Переносимые продукты группы можно отметить только при этих видах — не при аллергии. */
export const KINDS_WITH_EXCEPTIONS: RestrictionKind[] = ['intolerance', 'preference']

export interface RestrictionGroup {
  code: string
  kind: 'allergen' | 'diet'
  name: string
  description: string
}

export type Relation = 'contains' | 'may_contain'

/** Разметка продукта по группам; reviewed = false — состав не проверен. */
export interface IngredientComposition {
  reviewed: boolean
  note: string | null
  groups: { code: string; relation: Relation }[]
}

export interface RestrictionReference {
  groups: RestrictionGroup[]
  /** По id продукта; отсутствие продукта — состав не проверен. */
  composition: Map<number, IngredientComposition>
}

export interface UserRestriction {
  id: number
  kind: RestrictionKind
  /** Ровно одно из двух: группа или конкретный продукт. */
  groupCode: string | null
  ingredientId: number | null
  note: string | null
  /** Переносимые продукты группы (при непереносимости и предпочтении). */
  exceptions: number[]
}

export type NewRestriction = Pick<UserRestriction, 'kind' | 'groupCode' | 'ingredientId' | 'note'>

/** Доступ к ограничениям. Реальная реализация — Supabase, в тестах — память. */
export interface RestrictionsApi {
  loadReference(): Promise<RestrictionReference>
  list(): Promise<UserRestriction[]>
  add(restriction: NewRestriction): Promise<UserRestriction>
  update(
    id: number,
    patch: { kind: RestrictionKind; note: string | null },
  ): Promise<UserRestriction>
  remove(id: number): Promise<void>
  /** Заменяет список переносимых продуктов. */
  setExceptions(id: number, ingredientIds: number[]): Promise<UserRestriction>
}

/** Ограничения пользователя вместе со справочником — всё, что нужно для оценки рецепта. */
export interface RestrictionProfile {
  restrictions: UserRestriction[]
  reference: RestrictionReference
}
