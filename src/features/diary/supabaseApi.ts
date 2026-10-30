import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../lib/database.types'
import type { CompositionItem, DiaryApi, DiaryEntry, Eaten, Meal } from './types'
import { MEALS } from './types'

type Client = SupabaseClient<Database>
type Row = Database['public']['Tables']['diary_entries']['Row']

function fail(error: PostgrestError, action: string): never {
  if (error.code === '42501') throw new Error('Нет прав на это действие — войдите заново')
  if (/fetch|network/i.test(error.message))
    throw new Error(`Нет связи с сервером: не удалось ${action}. Попробуйте ещё раз.`)
  throw new Error(`Не удалось ${action}: ${error.message}`)
}

const COLUMNS =
  'id, eaten_on, eaten_time, meal, kind, title, recipe_id, version_id, ingredient_id, ' +
  'base_servings, serving_unit, base_amount, amount_unit, base_kcal, base_protein, base_fat, ' +
  'base_carbs, nutrition_incomplete, composition, servings, amount, kcal, protein, fat, carbs, ' +
  'note, created_at'

type SelectedRow = Omit<Row, 'user_id' | 'updated_at'>

function toEntry(row: SelectedRow): DiaryEntry {
  const eaten: Eaten =
    row.servings !== null
      ? { servings: row.servings, amount: null }
      : { servings: null, amount: row.amount! }
  return {
    id: row.id,
    eatenOn: row.eaten_on,
    // В БД — «ЧЧ:ММ:СС».
    eatenTime: row.eaten_time?.slice(0, 5) ?? null,
    meal: row.meal as Meal,
    kind: row.kind as DiaryEntry['kind'],
    title: row.title,
    recipeId: row.recipe_id,
    versionId: row.version_id,
    ingredientId: row.ingredient_id,
    baseServings: row.base_servings,
    servingUnit: row.serving_unit as DiaryEntry['servingUnit'],
    baseAmount: row.base_amount,
    amountUnit: row.amount_unit as DiaryEntry['amountUnit'],
    base: {
      kcal: row.base_kcal,
      protein: row.base_protein,
      fat: row.base_fat,
      carbs: row.base_carbs,
    },
    incomplete: row.nutrition_incomplete,
    composition: row.composition as unknown as CompositionItem[],
    ...eaten,
    eaten: {
      kcal: row.kcal ?? 0,
      protein: row.protein ?? 0,
      fat: row.fat ?? 0,
      carbs: row.carbs ?? 0,
    },
    note: row.note,
    createdAt: row.created_at,
  }
}

/** По приёмам пищи в порядке дня, затем по времени (без времени — в конце), затем по записи. */
export function sortDay(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort(
    (a, b) =>
      MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) ||
      (a.eatenTime ?? '99').localeCompare(b.eatenTime ?? '99') ||
      a.id - b.id,
  )
}

export function createSupabaseDiaryApi(supabase: Client): DiaryApi {
  return {
    async listDay(date) {
      const { data, error } = await supabase
        .from('diary_entries')
        .select(COLUMNS)
        .eq('eaten_on', date)
      if (error) fail(error, 'загрузить дневник')
      return sortDay((data as unknown as SelectedRow[]).map(toEntry))
    },

    async add(e) {
      const { data, error } = await supabase
        .from('diary_entries')
        .insert({
          eaten_on: e.eatenOn,
          eaten_time: e.eatenTime,
          meal: e.meal,
          kind: e.kind,
          title: e.title.trim(),
          recipe_id: e.recipeId,
          version_id: e.versionId,
          ingredient_id: e.ingredientId,
          base_servings: e.baseServings,
          serving_unit: e.servingUnit,
          base_amount: e.baseAmount,
          amount_unit: e.amountUnit,
          base_kcal: e.base.kcal,
          base_protein: e.base.protein,
          base_fat: e.base.fat,
          base_carbs: e.base.carbs,
          nutrition_incomplete: e.incomplete,
          composition: e.composition as unknown as Json,
          servings: e.servings,
          amount: e.amount,
          note: e.note,
        })
        .select(COLUMNS)
        .single()
      if (error) fail(error, 'записать в дневник')
      return toEntry(data as unknown as SelectedRow)
    },

    async update(id, patch) {
      const { data, error } = await supabase
        .from('diary_entries')
        .update({
          eaten_on: patch.eatenOn,
          eaten_time: patch.eatenTime,
          meal: patch.meal,
          title: patch.title.trim(),
          servings: patch.servings,
          amount: patch.amount,
          note: patch.note,
        })
        .eq('id', id)
        .select(COLUMNS)
        .single()
      if (error) fail(error, 'изменить запись дневника')
      return toEntry(data as unknown as SelectedRow)
    },

    async remove(id) {
      const { error } = await supabase.from('diary_entries').delete().eq('id', id)
      if (error) fail(error, 'удалить запись дневника')
    },
  }
}
