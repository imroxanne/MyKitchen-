import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../lib/database.types'
import type { IngredientNutrition } from '../nutrition/types'
import type { RecipeVersion, VersionLine } from '../versions/types'
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
  'source_checked_at, source_checked_note, cooked_verified_at, cooked_verified_note, image_url, image_credit, ' +
  'image_source_url'

// Пищевая ценность продукта и масса его единиц — для расчёта КБЖУ (A7).
const NUTRITION_COLUMNS =
  'ingredient_nutrition (state, kcal, protein_g, fat_g, carbs_g, is_approximate, note, source_code, ' +
  'source_food_id, source_food_name), ingredient_unit_weights (state, unit_code, grams, source_portion)'

const INGREDIENT_REF_COLUMNS =
  'recipe_ingredients (position, ingredient_id, quantity, unit_code, importance, ' +
  `units (name, kind, base_factor), ingredients (name, category_slug, ${NUTRITION_COLUMNS}))`

type NutritionRow = Pick<
  Tables<'ingredient_nutrition'>,
  | 'state'
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
    // По строке на состояние продукта (B1); в рецепте — продукт в исходном виде.
    ingredient_nutrition: NutritionRow[] | null
    ingredient_unit_weights: Pick<
      Tables<'ingredient_unit_weights'>,
      'state' | 'unit_code' | 'grams' | 'source_portion'
    >[]
  } | null
}

function toNutrition(rows: NutritionRow[] | null): IngredientNutrition | null {
  const n = rows?.find((r) => r.state === 'as_purchased') ?? null
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
    unitWeights: (row.ingredients?.ingredient_unit_weights ?? [])
      .filter((w) => w.state === 'as_purchased')
      .map((w) => ({
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
  | 'image_url'
  | 'image_credit'
  | 'image_source_url'
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
    // Без подписи об авторе и правах фото не показываем (ТЗ §4; в БД это ещё и ограничение).
    image:
      row.image_url && row.image_credit
        ? { url: row.image_url, credit: row.image_credit, sourceUrl: row.image_source_url }
        : null,
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

const VERSION_COLUMNS =
  'id, recipe_id, name, servings, yield_grams, note, updated_at, ' +
  'recipe_version_ingredients (position, ingredient_id, quantity, unit_code, quantity_text, ' +
  'importance, note, original_position, units (name, kind, base_factor), ' +
  `ingredients (name, category_slug, ${NUTRITION_COLUMNS}))`

type VersionRow = Pick<
  Tables<'recipe_versions'>,
  'id' | 'recipe_id' | 'name' | 'servings' | 'yield_grams' | 'note' | 'updated_at'
> & {
  recipe_version_ingredients: (IngredientRefRow &
    Pick<Tables<'recipe_version_ingredients'>, 'quantity_text' | 'note' | 'original_position'>)[]
}

function toVersion(row: VersionRow): RecipeVersion {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    name: row.name,
    servings: row.servings,
    yieldGrams: row.yield_grams,
    note: row.note,
    updatedAt: row.updated_at,
    ingredients: row.recipe_version_ingredients
      .map((i): VersionLine => ({
        ...toRef(i),
        position: i.position,
        unitName: i.units?.name ?? null,
        quantityText: i.quantity_text,
        note: i.note,
        originalPosition: i.original_position,
      }))
      .sort((a, b) => a.position - b.position),
  }
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

    async getYield(recipeId) {
      const { data, error } = await supabase
        .from('recipe_yield_measurements')
        .select('yield_grams, measured_at')
        .eq('recipe_id', recipeId)
        .maybeSingle()
      if (error) fail(error.message, 'загрузить массу готового блюда')
      return data && { grams: data.yield_grams, measuredAt: data.measured_at }
    },

    async saveYield(recipeId, grams) {
      const { data, error } = await supabase
        .from('recipe_yield_measurements')
        .upsert(
          { recipe_id: recipeId, yield_grams: grams, measured_at: new Date().toISOString() },
          { onConflict: 'user_id,recipe_id' },
        )
        .select('yield_grams, measured_at')
        .single()
      if (error) fail(error.message, 'сохранить массу готового блюда')
      return { grams: data.yield_grams, measuredAt: data.measured_at }
    },

    async deleteYield(recipeId) {
      const { error } = await supabase
        .from('recipe_yield_measurements')
        .delete()
        .eq('recipe_id', recipeId)
      if (error) fail(error.message, 'удалить массу готового блюда')
    },

    async listVersions(recipeId) {
      const { data, error } = await supabase
        .from('recipe_versions')
        .select(VERSION_COLUMNS)
        .eq('recipe_id', recipeId)
        .order('updated_at', { ascending: false })
      if (error) fail(error.message, 'загрузить ваши версии рецепта')
      return (data as unknown as VersionRow[]).map(toVersion)
    },

    async saveVersion(draft) {
      const { data: id, error } = await supabase.rpc('save_recipe_version', {
        p_id: draft.id,
        p_recipe_id: draft.recipeId,
        p_name: draft.name.trim(),
        p_servings: draft.servings,
        p_yield_grams: draft.yieldGrams,
        p_note: draft.note,
        p_lines: draft.ingredients.map((l) => ({
          ingredientId: l.ingredientId,
          quantity: l.quantity,
          unitCode: l.quantity === null ? null : l.unitCode,
          quantityText: l.quantity === null ? l.quantityText : null,
          importance: l.importance,
          note: l.note,
          originalPosition: l.originalPosition,
        })),
      })
      if (error) fail(error.message, 'сохранить версию рецепта')
      const { data, error: readError } = await supabase
        .from('recipe_versions')
        .select(VERSION_COLUMNS)
        .eq('id', id)
        .single()
      if (readError) fail(readError.message, 'загрузить сохранённую версию')
      return toVersion(data as unknown as VersionRow)
    },

    async deleteVersion(id) {
      const { error } = await supabase.from('recipe_versions').delete().eq('id', id)
      if (error) fail(error.message, 'удалить версию рецепта')
    },

    async isAdmin() {
      const { data, error } = await supabase.rpc('is_admin')
      if (error) fail(error.message, 'проверить права')
      return data === true
    },

    async setImage(recipeId, file, credit, previous) {
      const bucket = supabase.storage.from(IMAGE_BUCKET)
      const path = `${recipeId}/${Date.now()}.${file.type === 'image/png' ? 'png' : 'jpg'}`
      const upload = await bucket.upload(path, file, { contentType: file.type, upsert: false })
      if (upload.error) fail(upload.error.message, 'загрузить фото')
      const url = bucket.getPublicUrl(path).data.publicUrl
      const { error } = await supabase.rpc('set_recipe_image', {
        p_recipe_id: recipeId,
        p_url: url,
        p_credit: credit,
        p_source_url: null,
      })
      if (error) {
        // Фото не привязалось к рецепту — файл в хранилище не оставляем.
        await bucket.remove([path])
        fail(error.message, 'сохранить фото рецепта')
      }
      const old = previous && storedPath(previous.url)
      if (old) await bucket.remove([old])
      return { url, credit, sourceUrl: null }
    },

    async removeImage(recipeId, image) {
      const { error } = await supabase.rpc('set_recipe_image', {
        p_recipe_id: recipeId,
        p_url: null,
        p_credit: null,
      })
      if (error) fail(error.message, 'убрать фото')
      const path = storedPath(image.url)
      if (path) await supabase.storage.from(IMAGE_BUCKET).remove([path])
    },
  }
}

const IMAGE_BUCKET = 'recipe-images'

/** Путь файла в хранилище, если фото загружено через сайт; копии из источников — не там. */
function storedPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`
  const at = url.indexOf(marker)
  return at >= 0 ? decodeURIComponent(url.slice(at + marker.length)) : null
}
