import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../lib/database.types'
import type { UserNutrition } from '../nutrition/types'
import type {
  CatalogItem,
  PantryApi,
  ProductKind,
  ProductPatch,
  ReferenceNutrition,
  UserProduct,
} from './types'

type Client = SupabaseClient<Database>

/** Ошибка с понятным пользователю текстом. */
export class PantryError extends Error {}

function fail(error: PostgrestError | Error, action: string): never {
  const code = 'code' in error ? error.code : undefined
  if (code === '23505') throw new PantryError('Такой продукт уже есть')
  if (code === '42501') throw new PantryError('Нет прав на это действие — войдите заново')
  if (/fetch|network/i.test(error.message))
    throw new PantryError(`Нет связи с сервером: не удалось ${action}. Попробуйте ещё раз.`)
  throw new PantryError(`Не удалось ${action}: ${error.message}`)
}

function toProduct(row: Tables<'user_products'>): UserProduct {
  return {
    id: row.id,
    ingredientId: row.ingredient_id,
    kind: row.kind as ProductKind,
    quantity: row.quantity,
    unitCode: row.unit_code,
    expiresOn: row.expires_on,
    isExcluded: row.is_excluded,
  }
}

const PRODUCT_COLUMNS = 'id, ingredient_id, kind, quantity, unit_code, expires_on, is_excluded'

const USER_NUTRITION_COLUMNS =
  'ingredient_id, brand, basis, kcal, protein_g, fat_g, carbs_g, package_grams, piece_grams, note'

function toUserNutrition(
  row: Omit<Tables<'user_ingredient_nutrition'>, 'user_id' | 'updated_at'>,
): UserNutrition {
  return {
    ingredientId: row.ingredient_id,
    brand: row.brand,
    basis: row.basis as UserNutrition['basis'],
    kcal: row.kcal,
    protein: row.protein_g,
    fat: row.fat_g,
    carbs: row.carbs_g,
    packageGrams: row.package_grams,
    pieceGrams: row.piece_grams,
    note: row.note,
  }
}

export function createSupabasePantryApi(supabase: Client): PantryApi {
  return {
    async loadCatalog() {
      const [ingredients, synonyms, categories, units] = await Promise.all([
        supabase.from('ingredients').select('id, name, category_slug, default_unit, owner_id'),
        supabase.from('ingredient_synonyms').select('ingredient_id, synonym'),
        supabase.from('ingredient_categories').select('slug, name').order('sort'),
        supabase
          .from('units')
          .select('code, name, kind, is_approximate, base_factor')
          .order('sort'),
      ])
      for (const result of [ingredients, synonyms, categories, units]) {
        if (result.error) fail(result.error, 'загрузить справочник')
      }
      const synonymsById = new Map<number, string[]>()
      for (const s of synonyms.data ?? []) {
        synonymsById.set(s.ingredient_id, [...(synonymsById.get(s.ingredient_id) ?? []), s.synonym])
      }
      return {
        items: (ingredients.data ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          categorySlug: i.category_slug,
          defaultUnit: i.default_unit,
          isOwn: i.owner_id !== null,
          synonyms: synonymsById.get(i.id) ?? [],
        })),
        categories: categories.data ?? [],
        units: (units.data ?? []).map((u) => ({
          code: u.code,
          name: u.name,
          kind: u.kind as 'mass' | 'volume' | 'count' | 'other',
          isApproximate: u.is_approximate,
          baseFactor: u.base_factor,
        })),
      }
    },

    async listProducts() {
      const { data, error } = await supabase
        .from('user_products')
        .select(PRODUCT_COLUMNS)
        .order('created_at')
      if (error) fail(error, 'загрузить ваши продукты')
      return (data as Tables<'user_products'>[]).map(toProduct)
    },

    async addProducts(items) {
      const { data, error } = await supabase
        .from('user_products')
        .insert(items.map((i) => ({ ingredient_id: i.ingredientId, kind: i.kind })))
        .select(PRODUCT_COLUMNS)
      if (error) fail(error, 'добавить продукты')
      return (data as Tables<'user_products'>[]).map(toProduct)
    },

    async updateProduct(id: number, patch: ProductPatch) {
      const { data, error } = await supabase
        .from('user_products')
        .update({
          ...(patch.kind !== undefined && { kind: patch.kind }),
          ...(patch.quantity !== undefined && { quantity: patch.quantity }),
          ...(patch.unitCode !== undefined && { unit_code: patch.unitCode }),
          ...(patch.expiresOn !== undefined && { expires_on: patch.expiresOn }),
          ...(patch.isExcluded !== undefined && { is_excluded: patch.isExcluded }),
        })
        .eq('id', id)
        .select(PRODUCT_COLUMNS)
        .single()
      if (error) fail(error, 'сохранить изменения')
      return toProduct(data as Tables<'user_products'>)
    },

    async deleteProduct(id: number) {
      const { error } = await supabase.from('user_products').delete().eq('id', id)
      if (error) fail(error, 'удалить продукт')
    },

    async createOwnIngredient(name: string, categorySlug: string): Promise<CatalogItem> {
      const { data: auth } = await supabase.auth.getSession()
      const ownerId = auth.session?.user.id
      if (!ownerId) throw new PantryError('Войдите, чтобы добавить свой продукт')
      const { data, error } = await supabase
        .from('ingredients')
        .insert({ name: name.trim(), category_slug: categorySlug, owner_id: ownerId })
        .select('id, name, category_slug, default_unit')
        .single()
      if (error) fail(error, 'добавить свой продукт')
      return {
        id: data.id,
        name: data.name,
        categorySlug: data.category_slug,
        defaultUnit: data.default_unit,
        isOwn: true,
        synonyms: [],
      }
    },

    async listUserNutrition() {
      const { data, error } = await supabase
        .from('user_ingredient_nutrition')
        .select(USER_NUTRITION_COLUMNS)
      if (error) fail(error, 'загрузить ваши данные с упаковки')
      return data.map(toUserNutrition)
    },

    async saveUserNutrition(n) {
      const { data, error } = await supabase
        .from('user_ingredient_nutrition')
        .upsert(
          {
            ingredient_id: n.ingredientId,
            brand: n.brand?.trim() || null,
            basis: n.basis,
            kcal: n.kcal,
            protein_g: n.protein,
            fat_g: n.fat,
            carbs_g: n.carbs,
            package_grams: n.packageGrams,
            piece_grams: n.pieceGrams,
            note: n.note?.trim() || null,
          },
          { onConflict: 'user_id,ingredient_id' },
        )
        .select(USER_NUTRITION_COLUMNS)
        .single()
      if (error) fail(error, 'сохранить данные с упаковки')
      return toUserNutrition(data)
    },

    async deleteUserNutrition(ingredientId) {
      const { error } = await supabase
        .from('user_ingredient_nutrition')
        .delete()
        .eq('ingredient_id', ingredientId)
      if (error) fail(error, 'удалить данные с упаковки')
    },

    async loadReferenceNutrition(ingredientId) {
      const [nutrition, weights] = await Promise.all([
        supabase
          .from('ingredient_nutrition')
          .select(
            'state, kcal, protein_g, fat_g, carbs_g, is_approximate, note, source_code, source_food_id, source_food_name',
          )
          .eq('ingredient_id', ingredientId),
        supabase
          .from('ingredient_unit_weights')
          .select('state, unit_code, grams, source_portion')
          .eq('ingredient_id', ingredientId),
      ])
      if (nutrition.error) fail(nutrition.error, 'загрузить справочные КБЖУ')
      if (weights.error) fail(weights.error, 'загрузить справочные КБЖУ')
      return nutrition.data
        .map((n): ReferenceNutrition => ({
          state: n.state as ReferenceNutrition['state'],
          nutrition: {
            kcal: n.kcal,
            protein: n.protein_g,
            fat: n.fat_g,
            carbs: n.carbs_g,
            approximate: n.is_approximate,
            note: n.note,
            sourceCode: n.source_code,
            sourceFoodId: n.source_food_id,
            sourceFoodName: n.source_food_name,
          },
          weights: weights.data
            .filter((w) => w.state === n.state)
            .map((w) => ({ unitCode: w.unit_code, grams: w.grams, portion: w.source_portion })),
        }))
        .sort((a, b) => (a.state === 'as_purchased' ? -1 : b.state === 'as_purchased' ? 1 : 0))
    },
  }
}
