import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../lib/database.types'
import type { RecipeDetail, RecipeIngredientLine, RecipesApi, RecipeSummary } from './types'

type Client = SupabaseClient<Database>

const SUMMARY_COLUMNS =
  'id, title, description, prep_minutes, cook_minutes, servings, meal_types, origin, is_sample, ' +
  'source_checked_at, source_checked_note, cooked_verified_at, cooked_verified_note'

type SummaryRow = Pick<
  Tables<'recipes'>,
  | 'id'
  | 'title'
  | 'description'
  | 'prep_minutes'
  | 'cook_minutes'
  | 'servings'
  | 'meal_types'
  | 'origin'
  | 'is_sample'
  | 'source_checked_at'
  | 'source_checked_note'
  | 'cooked_verified_at'
  | 'cooked_verified_note'
>

function toSummary(row: SummaryRow): RecipeSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    servings: row.servings,
    mealTypes: row.meal_types,
    trust: {
      origin: row.origin as RecipeSummary['trust']['origin'],
      isSample: row.is_sample,
      sourceCheckedAt: row.source_checked_at,
      sourceCheckedNote: row.source_checked_note,
      cookedVerifiedAt: row.cooked_verified_at,
      cookedVerifiedNote: row.cooked_verified_note,
    },
  }
}

function fail(message: string, action: string): never {
  if (/fetch|network/i.test(message))
    throw new Error(`Нет связи с сервером: не удалось ${action}. Попробуйте ещё раз.`)
  throw new Error(`Не удалось ${action}: ${message}`)
}

type DetailRow = Tables<'recipes'> & {
  recipe_sources: Tables<'recipe_sources'> | null
  recipe_ingredients: (Pick<
    Tables<'recipe_ingredients'>,
    'position' | 'quantity' | 'unit_code' | 'quantity_text' | 'importance' | 'note'
  > & { ingredients: { name: string } | null; units: { name: string } | null })[]
  recipe_steps: Pick<Tables<'recipe_steps'>, 'position' | 'instruction' | 'duration_minutes'>[]
}

export function createSupabaseRecipesApi(supabase: Client): RecipesApi {
  return {
    async listRecipes() {
      const { data, error } = await supabase.from('recipes').select(SUMMARY_COLUMNS).order('title')
      if (error) fail(error.message, 'загрузить рецепты')
      return (data as unknown as SummaryRow[]).map(toSummary)
    },

    async getRecipe(id: number) {
      const { data, error } = await supabase
        .from('recipes')
        .select(
          '*, recipe_sources (*), ' +
            'recipe_ingredients (position, quantity, unit_code, quantity_text, importance, note, ' +
            'ingredients (name), units (name)), ' +
            'recipe_steps (position, instruction, duration_minutes)',
        )
        .eq('id', id)
        .maybeSingle()
      if (error) fail(error.message, 'загрузить рецепт')
      if (!data) return null
      const row = data as unknown as DetailRow
      const s = row.recipe_sources
      const detail: RecipeDetail = {
        ...toSummary(row),
        source: s && {
          kind: s.kind,
          title: s.title,
          url: s.url,
          author: s.author,
          authorsUrl: s.authors_url,
          retrievedOn: s.retrieved_on,
          revision: s.source_revision,
          rights: s.rights,
          license: s.license,
          licenseUrl: s.license_url,
        },
        adaptationNote: row.adaptation_note,
        cuisine: row.cuisine,
        cookingMethods: row.cooking_methods,
        equipment: row.equipment,
        tags: row.tags,
        difficulty: row.difficulty,
        yieldGrams: row.yield_grams,
        ingredients: row.recipe_ingredients
          .map((i): RecipeIngredientLine => ({
            position: i.position,
            name: i.ingredients?.name ?? 'неизвестный продукт',
            quantity: i.quantity,
            unitCode: i.unit_code,
            unitName: i.units?.name ?? null,
            quantityText: i.quantity_text,
            importance: i.importance as RecipeIngredientLine['importance'],
            note: i.note,
          }))
          .sort((a, b) => a.position - b.position),
        steps: row.recipe_steps
          .map((s) => ({
            position: s.position,
            instruction: s.instruction,
            durationMinutes: s.duration_minutes,
          }))
          .sort((a, b) => a.position - b.position),
      }
      return detail
    },
  }
}
