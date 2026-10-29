import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../lib/database.types'
import type { IngredientNutrition } from '../nutrition/types'
import type {
  RecipeDetail,
  RecipeIngredientLine,
  RecipeIngredientRef,
  RecipesApi,
  RecipeSummary,
} from './types'

type Client = SupabaseClient<Database>

const SUMMARY_COLUMNS =
  'id, title, description, prep_minutes, cook_minutes, servings, meal_types, tags, origin, is_sample, ' +
  'source_checked_at, source_checked_note, cooked_verified_at, cooked_verified_note'

// Пищевая ценность продукта и масса его единиц — для расчёта КБЖУ (A7).
const NUTRITION_COLUMNS =
  'ingredient_nutrition (kcal, protein_g, fat_g, carbs_g, is_approximate, note, source_code, ' +
  'source_food_id, source_food_name), ingredient_unit_weights (unit_code, grams, source_portion)'

const INGREDIENT_REF_COLUMNS =
  'recipe_ingredients (position, ingredient_id, quantity, unit_code, importance, ' +
  `units (name, kind, base_factor), ingredients (name, category_slug, ${NUTRITION_COLUMNS}))`

type NutritionRow = Pick<
  Tables<'ingredient_nutrition'>,
  | 'kcal'
  | 'protein_g'
  | 'fat_g'
  | 'carbs_g'
  | 'is_approximate'
  | 'note'
  | 'source_code'
  | 'source_food_id'
  | 'source_food_name'
>

type IngredientRefRow = Pick<
  Tables<'recipe_ingredients'>,
  'position' | 'ingredient_id' | 'quantity' | 'unit_code' | 'importance'
> & {
  units: Pick<Tables<'units'>, 'name' | 'kind' | 'base_factor'> | null
  ingredients: {
    name: string
    category_slug: string
    // Связь один к одному: PostgREST отдаёт объект; на всякий случай принимаем и массив.
    ingredient_nutrition: NutritionRow | NutritionRow[] | null
    ingredient_unit_weights: Pick<
      Tables<'ingredient_unit_weights'>,
      'unit_code' | 'grams' | 'source_portion'
    >[]
  } | null
}

function toNutrition(value: NutritionRow | NutritionRow[] | null): IngredientNutrition | null {
  const n = Array.isArray(value) ? (value[0] ?? null) : value
  return (
    n && {
      kcal: n.kcal,
      protein: n.protein_g,
      fat: n.fat_g,
      carbs: n.carbs_g,
      approximate: n.is_approximate,
      note: n.note,
      sourceCode: n.source_code,
      sourceFoodId: n.source_food_id,
      sourceFoodName: n.source_food_name,
    }
  )
}

function toRef(row: IngredientRefRow): RecipeIngredientRef {
  return {
    ingredientId: row.ingredient_id,
    name: row.ingredients?.name ?? 'неизвестный продукт',
    categorySlug: row.ingredients?.category_slug ?? 'other',
    quantity: row.quantity,
    unitCode: row.unit_code,
    unitKind: (row.units?.kind as RecipeIngredientRef['unitKind']) ?? null,
    unitBaseFactor: row.units?.base_factor ?? null,
    importance: row.importance as RecipeIngredientRef['importance'],
    nutrition: toNutrition(row.ingredients?.ingredient_nutrition ?? null),
    unitWeights: (row.ingredients?.ingredient_unit_weights ?? []).map((w) => ({
      unitCode: w.unit_code,
      grams: w.grams,
      portion: w.source_portion,
    })),
  }
}

type SummaryRow = Pick<
  Tables<'recipes'>,
  | 'id'
  | 'title'
  | 'description'
  | 'prep_minutes'
  | 'cook_minutes'
  | 'servings'
  | 'meal_types'
  | 'tags'
  | 'origin'
  | 'is_sample'
  | 'source_checked_at'
  | 'source_checked_note'
  | 'cooked_verified_at'
  | 'cooked_verified_note'
>

function toSummary(row: SummaryRow, ingredients: RecipeIngredientRef[]): RecipeSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    servings: row.servings,
    mealTypes: row.meal_types,
    tags: row.tags,
    ingredients,
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
  recipe_ingredients: (IngredientRefRow &
    Pick<Tables<'recipe_ingredients'>, 'quantity_text' | 'note'>)[]
  recipe_steps: Pick<Tables<'recipe_steps'>, 'position' | 'instruction' | 'duration_minutes'>[]
}

export function createSupabaseRecipesApi(supabase: Client): RecipesApi {
  return {
    async listRecipes() {
      const { data, error } = await supabase
        .from('recipes')
        .select(`${SUMMARY_COLUMNS}, ${INGREDIENT_REF_COLUMNS}`)
        .order('title')
      if (error) fail(error.message, 'загрузить рецепты')
      return (data as unknown as (SummaryRow & { recipe_ingredients: IngredientRefRow[] })[]).map(
        (row) =>
          toSummary(
            row,
            [...row.recipe_ingredients].sort((a, b) => a.position - b.position).map(toRef),
          ),
      )
    },

    async getRecipe(id: number) {
      const [recipe, sources] = await Promise.all([
        supabase
          .from('recipes')
          .select(
            '*, recipe_sources (*), ' +
              'recipe_ingredients (position, ingredient_id, quantity, unit_code, quantity_text, ' +
              `importance, note, units (name, kind, base_factor), ingredients (name, category_slug, ${NUTRITION_COLUMNS})), ` +
              'recipe_steps (position, instruction, duration_minutes)',
          )
          .eq('id', id)
          .maybeSingle(),
        supabase.from('nutrition_sources').select('*'),
      ])
      const { data, error } = recipe
      if (error) fail(error.message, 'загрузить рецепт')
      if (sources.error) fail(sources.error.message, 'загрузить источники КБЖУ')
      if (!data) return null
      const row = data as unknown as DetailRow
      const s = row.recipe_sources
      const detail: RecipeDetail = {
        ...toSummary(row, []),
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
            ...toRef(i),
            position: i.position,
            unitName: i.units?.name ?? null,
            quantityText: i.quantity_text,
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
        nutritionSources: sources.data.map((src) => ({
          code: src.code,
          title: src.title,
          url: src.url,
          datasetVersion: src.dataset_version,
          license: src.license,
          licenseUrl: src.license_url,
          citation: src.citation,
        })),
      }
      return detail
    },
  }
}
