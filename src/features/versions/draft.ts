// Черновик своей версии рецепта (B2). Чистые функции, без обращения к сети.
//
// * версия — копия состава оригинала; оригинал не меняется;
// * пересчёт на другое число порций умножает только известные количества: «по вкусу»
//   и текст источника («2–3 шт.») не превращаются в выдуманные числа;
// * отличия от оригинала считаются по связи строки версии со строкой оригинала.
import type { IngredientNutrition, UnitWeight } from '../nutrition/types'
import { describeAmount } from '../recipes/present'
import type { RecipeDetail, RecipeIngredientLine } from '../recipes/types'
import type { RecipeVersion, VersionDraft, VersionLine } from './types'

/** Новый черновик — копия состава, порций и выхода оригинала. */
export function draftFromRecipe(recipe: RecipeDetail, name = 'Моя версия'): VersionDraft {
  return {
    id: null,
    recipeId: recipe.id,
    name,
    servings: recipe.servings,
    yieldGrams: recipe.yieldGrams,
    note: null,
    ingredients: recipe.ingredients.map((line) => ({
      ...line,
      originalPosition: line.position,
    })),
  }
}

export function draftFromVersion(version: RecipeVersion): VersionDraft {
  const { updatedAt: _updatedAt, ...draft } = version
  return structuredClone(draft)
}

/** Количества × коэффициент; неизвестные количества не трогаем. */
export function scaleLines<L extends { quantity: number | null }>(lines: L[], factor: number): L[] {
  if (factor === 1) return lines
  return lines.map((line) =>
    line.quantity === null ? line : { ...line, quantity: roundQuantity(line.quantity * factor) },
  )
}

/** До 3 знаков: умножение не должно давать «0,30000000000000004». */
const roundQuantity = (q: number) => Math.round(q * 1000) / 1000

/** Пересчёт черновика на другое число порций (если исходное известно). */
export function rescaleDraft(draft: VersionDraft, servings: number): VersionDraft {
  if (!draft.servings || servings <= 0) return { ...draft, servings }
  return {
    ...draft,
    servings,
    ingredients: scaleLines(draft.ingredients, servings / draft.servings),
  }
}

const renumber = (lines: VersionLine[]) => lines.map((l, i) => ({ ...l, position: i + 1 }))

export function updateLine(
  draft: VersionDraft,
  position: number,
  patch: Partial<
    Pick<
      VersionLine,
      'quantity' | 'unitCode' | 'unitName' | 'unitKind' | 'unitBaseFactor' | 'quantityText'
    >
  >,
): VersionDraft {
  return {
    ...draft,
    ingredients: draft.ingredients.map((l) => (l.position === position ? { ...l, ...patch } : l)),
  }
}

export function removeLine(draft: VersionDraft, position: number): VersionDraft {
  return {
    ...draft,
    ingredients: renumber(draft.ingredients.filter((l) => l.position !== position)),
  }
}

/** Продукт для замены или добавления — со своими справочными данными. */
export interface PickedIngredient {
  ingredientId: number
  name: string
  categorySlug: string
  nutrition: IngredientNutrition | null
  unitWeights: UnitWeight[]
}

/** Замена продукта: количество и единица остаются, данные КБЖУ — нового продукта. */
export function replaceIngredient(
  draft: VersionDraft,
  position: number,
  picked: PickedIngredient,
): VersionDraft {
  return {
    ...draft,
    ingredients: draft.ingredients.map((l) =>
      l.position === position ? { ...l, ...picked, userNutrition: null, note: null } : l,
    ),
  }
}

/** Новая строка в конце: количество пока не указано. */
export function addLine(
  draft: VersionDraft,
  picked: PickedIngredient,
  unit: {
    code: string
    name: string
    kind: VersionLine['unitKind']
    baseFactor: number | null
  } | null,
): VersionDraft {
  const line: VersionLine = {
    ...picked,
    position: draft.ingredients.length + 1,
    importance: 'main',
    quantity: null,
    unitCode: unit?.code ?? null,
    unitName: unit?.name ?? null,
    unitKind: unit?.kind ?? null,
    unitBaseFactor: unit?.baseFactor ?? null,
    quantityText: null,
    note: null,
    userNutrition: null,
    originalPosition: null,
  }
  return { ...draft, ingredients: [...draft.ingredients, line] }
}

export type LineChange =
  | { kind: 'same' }
  | { kind: 'added' }
  | { kind: 'replaced'; was: string }
  | { kind: 'amount'; was: string }

export interface DraftDiff {
  byPosition: Map<number, LineChange>
  /** Строки оригинала, которых нет в версии. */
  removed: RecipeIngredientLine[]
  changed: boolean
}

/** Чем черновик отличается от оригинала: заменено, изменено количество, добавлено, убрано. */
export function diffWithOriginal(
  original: RecipeIngredientLine[],
  draft: VersionDraft,
  originalServings: number | null,
  originalYield: number | null,
): DraftDiff {
  const byOriginal = new Map(original.map((l) => [l.position, l]))
  const kept = new Set<number>()
  const byPosition = new Map<number, LineChange>()
  for (const line of draft.ingredients) {
    const source =
      line.originalPosition === null ? undefined : byOriginal.get(line.originalPosition)
    if (!source) {
      byPosition.set(line.position, { kind: 'added' })
      continue
    }
    kept.add(source.position)
    if (source.ingredientId !== line.ingredientId)
      byPosition.set(line.position, { kind: 'replaced', was: source.name })
    else if (
      source.quantity !== line.quantity ||
      (source.quantity !== null && source.unitCode !== line.unitCode)
    )
      byPosition.set(line.position, { kind: 'amount', was: describeAmount(source) })
    else byPosition.set(line.position, { kind: 'same' })
  }
  const removed = original.filter((l) => !kept.has(l.position))
  const changed =
    removed.length > 0 ||
    [...byPosition.values()].some((c) => c.kind !== 'same') ||
    draft.servings !== originalServings ||
    draft.yieldGrams !== originalYield
  return { byPosition, removed, changed }
}

/** Ошибки черновика перед сохранением; пустой список — можно сохранять. */
export function validateDraft(draft: VersionDraft): string[] {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push('Укажите название версии.')
  if (draft.name.trim().length > 100) errors.push('Название версии — не длиннее 100 символов.')
  if (draft.servings !== null && !(draft.servings > 0 && draft.servings <= 100))
    errors.push('Число порций — от 1 до 100 (можно дробное, например 1,5).')
  if (draft.yieldGrams !== null && !(draft.yieldGrams > 0 && draft.yieldGrams <= 100000))
    errors.push('Масса готового блюда — число граммов больше нуля.')
  if (draft.ingredients.length === 0)
    errors.push('В версии должен остаться хотя бы один ингредиент.')
  for (const line of draft.ingredients) {
    if (line.quantity !== null && !(line.quantity > 0))
      errors.push(`${line.name}: количество — число больше нуля или пусто.`)
    if (line.quantity !== null && !line.unitCode) errors.push(`${line.name}: укажите единицу.`)
  }
  return errors
}

/** Совпадают ли черновики по тому, что сохраняется (для «есть несохранённые изменения»). */
export function sameDraft(a: VersionDraft, b: VersionDraft): boolean {
  const key = (d: VersionDraft) =>
    JSON.stringify([
      d.name.trim(),
      d.servings,
      d.yieldGrams,
      d.note,
      d.ingredients.map((l) => [
        l.ingredientId,
        l.quantity,
        l.quantity === null ? null : l.unitCode,
        l.importance,
        l.originalPosition,
      ]),
    ])
  return key(a) === key(b)
}
