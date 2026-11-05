import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type {
  DishContext,
  IngredientComposition,
  Relation,
  RestrictionGroup,
  RestrictionKind,
  RestrictionsApi,
  Substitution,
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

interface SubstitutionRow {
  id: number
  from_ingredient_id: number
  to_ingredient_id: number
  ratio: number
  to_unit: string | null
  amount_note: string
  contexts: string[]
  scope_note: string
  effect: string
  warning: string
  confidence: string
  to_ingredient: { name: string; category_slug: string }
}

const toSubstitution = (row: SubstitutionRow): Substitution => ({
  id: row.id,
  fromIngredientId: row.from_ingredient_id,
  toIngredientId: row.to_ingredient_id,
  toName: row.to_ingredient.name,
  toCategorySlug: row.to_ingredient.category_slug,
  ratio: row.ratio,
  toUnit: row.to_unit,
  amountNote: row.amount_note,
  contexts: row.contexts as DishContext[],
  scope: row.scope_note,
  effect: row.effect,
  warning: row.warning,
  confidence: row.confidence as Substitution['confidence'],
})

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
      const [groups, ingredients, relations, substitutions] = await Promise.all([
        supabase.from('restriction_groups').select('code, kind, name, description').order('sort'),
        supabase.from('ingredients').select('id, composition_reviewed, composition_note'),
        supabase
          .from('ingredient_restriction_groups')
          .select('ingredient_id, group_code, relation'),
        // Порядок — как в справочнике: первой идёт более удачная замена.
        supabase
          .from('ingredient_substitutions')
          .select(
            'id, from_ingredient_id, to_ingredient_id, ratio, to_unit, amount_note, contexts, ' +
              'scope_note, effect, warning, confidence, ' +
              'to_ingredient:ingredients!ingredient_substitutions_to_ingredient_id_fkey (name, category_slug)',
          )
          .order('id'),
      ])
      for (const result of [groups, ingredients, relations, substitutions])
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
      return {
        groups: (groups.data ?? []) as RestrictionGroup[],
        composition,
        substitutions: ((substitutions.data ?? []) as unknown as SubstitutionRow[]).map(
          toSubstitution,
        ),
      }
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
