// Своя версия рецепта с заменой из справочника (B5): оригинал не меняется — получается
// черновик версии (B2), который пользователь проверяет и сохраняет сам.
import type { PantryApi } from '../pantry/types'
import type { RecipeDetail } from '../recipes/types'
import { draftFromRecipe, replaceIngredient, updateLine } from '../versions/draft'
import type { VersionDraft } from '../versions/types'
import type { Substitution } from './types'

/** До 3 знаков, как в черновике версии. */
const round = (q: number) => Math.round(q * 1000) / 1000

export async function draftWithSubstitution(
  recipe: RecipeDetail,
  substitution: Substitution,
  pantryApi: PantryApi,
): Promise<VersionDraft> {
  const [catalog, reference] = await Promise.all([
    pantryApi.loadCatalog(),
    pantryApi.loadReferenceNutrition(substitution.toIngredientId),
  ])
  const base = reference.find((r) => r.state === 'as_purchased')
  const unit = substitution.toUnit
    ? catalog.units.find((u) => u.code === substitution.toUnit)
    : undefined
  if (substitution.toUnit && !unit) throw new Error('Единица замены не найдена в справочнике')
  const name = `С заменой: ${substitution.toName}`.slice(0, 100)
  let draft = draftFromRecipe(recipe, name)
  for (const line of recipe.ingredients) {
    if (line.ingredientId !== substitution.fromIngredientId) continue
    draft = replaceIngredient(draft, line.position, {
      ingredientId: substitution.toIngredientId,
      name: substitution.toName,
      categorySlug: substitution.toCategorySlug,
      nutrition: base?.nutrition ?? null,
      unitWeights: base?.weights ?? [],
    })
    // Количество — по пропорции; без количества («по вкусу») оставляем как есть.
    if (line.quantity !== null)
      draft = updateLine(draft, line.position, {
        quantity: round(line.quantity * substitution.ratio),
        ...(unit && {
          unitCode: unit.code,
          unitName: unit.name,
          unitKind: unit.kind,
          unitBaseFactor: unit.baseFactor,
        }),
      })
  }
  return draft
}
