import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type {
  IngredientComposition,
  Relation,
  RestrictionGroup,
  RestrictionKind,
  RestrictionsApi,
  UserRestriction,
} from './types'

type Client = SupabaseClient<Database>

function fail(error: PostgrestError, action: string): never {
  if (error.code === '23505') throw new Error('Такое ограничение уже есть — измените его вид')
  if (error.code === '42501') throw new Error('Нет прав на это действие — войдите заново')
  if (/fetch|network/i.test(error.message))
    throw new Error(`Нет связи с сервером: не удалось ${action}. Попробуйте ещё раз.`)
  throw new Error(`Не удалось ${action}: ${error.message}`)
}

const COLUMNS =
  'id, kind, group_code, ingredient_id, note, user_restriction_exceptions (ingredient_id)'

interface Row {
  id: number
  kind: string
  group_code: string | null
  ingredient_id: number | null
  note: string | null
  user_restriction_exceptions: { ingredient_id: number }[]
}

const toRestriction = (row: Row): UserRestriction => ({
  id: row.id,
  kind: row.kind as RestrictionKind,
  groupCode: row.group_code,
  ingredientId: row.ingredient_id,
  note: row.note,
  exceptions: row.user_restriction_exceptions.map((e) => e.ingredient_id).sort((a, b) => a - b),
})

export function createSupabaseRestrictionsApi(supabase: Client): RestrictionsApi {
  async function read(id: number, action: string) {
    const { data, error } = await supabase
      .from('user_restrictions')
      .select(COLUMNS)
      .eq('id', id)
      .single()
    if (error) fail(error, action)
    return toRestriction(data as unknown as Row)
  }

  return {
    async loadReference() {
      const [groups, ingredients, relations] = await Promise.all([
        supabase.from('restriction_groups').select('code, kind, name, description').order('sort'),
        supabase.from('ingredients').select('id, composition_reviewed, composition_note'),
        supabase
          .from('ingredient_restriction_groups')
          .select('ingredient_id, group_code, relation'),
      ])
      for (const result of [groups, ingredients, relations])
        if (result.error) fail(result.error, 'загрузить справочник ограничений')
      const composition = new Map<number, IngredientComposition>()
      for (const i of ingredients.data ?? [])
        composition.set(i.id, {
          reviewed: i.composition_reviewed,
          note: i.composition_note,
          groups: [],
        })
      for (const r of relations.data ?? [])
        composition
          .get(r.ingredient_id)
          ?.groups.push({ code: r.group_code, relation: r.relation as Relation })
      return { groups: (groups.data ?? []) as RestrictionGroup[], composition }
    },

    async list() {
      const { data, error } = await supabase
        .from('user_restrictions')
        .select(COLUMNS)
        .order('created_at')
      if (error) fail(error, 'загрузить ваши ограничения')
      return (data as unknown as Row[]).map(toRestriction)
    },

    async add(r) {
      const { data, error } = await supabase
        .from('user_restrictions')
        .insert({
          kind: r.kind,
          group_code: r.groupCode,
          ingredient_id: r.ingredientId,
          note: r.note,
        })
        .select(COLUMNS)
        .single()
      if (error) fail(error, 'добавить ограничение')
      return toRestriction(data as unknown as Row)
    },

    async update(id, patch) {
      const { error } = await supabase
        .from('user_restrictions')
        .update({ kind: patch.kind, note: patch.note })
        .eq('id', id)
      if (error) fail(error, 'изменить ограничение')
      // Смена на аллергию снимает переносимые продукты (в БД) — читаем заново.
      return read(id, 'загрузить изменённое ограничение')
    },

    async remove(id) {
      const { error } = await supabase.from('user_restrictions').delete().eq('id', id)
      if (error) fail(error, 'удалить ограничение')
    },

    async setExceptions(id, ingredientIds) {
      const { error: deleteError } = await supabase
        .from('user_restriction_exceptions')
        .delete()
        .eq('restriction_id', id)
      if (deleteError) fail(deleteError, 'сохранить переносимые продукты')
      if (ingredientIds.length > 0) {
        const { error } = await supabase
          .from('user_restriction_exceptions')
          .insert(ingredientIds.map((ingredient_id) => ({ restriction_id: id, ingredient_id })))
        if (error) fail(error, 'сохранить переносимые продукты')
      }
      return read(id, 'загрузить ограничение')
    },
  }
}
