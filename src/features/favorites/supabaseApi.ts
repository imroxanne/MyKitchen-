import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { FavoritesApi } from './types'

type Client = SupabaseClient<Database>

function fail(error: PostgrestError, action: string): never {
  if (error.code === '42501') throw new Error('Нет прав на это действие — войдите заново')
  if (/fetch|network/i.test(error.message))
    throw new Error(`Нет связи с сервером: не удалось ${action}. Попробуйте ещё раз.`)
  throw new Error(`Не удалось ${action}: ${error.message}`)
}

export function createSupabaseFavoritesApi(supabase: Client): FavoritesApi {
  return {
    async listFavorites() {
      const { data, error } = await supabase
        .from('favorite_recipes')
        .select('recipe_id')
        .order('created_at', { ascending: false })
      if (error) fail(error, 'загрузить избранное')
      return data.map((row) => row.recipe_id)
    },

    async add(recipeId) {
      const { error } = await supabase.from('favorite_recipes').insert({ recipe_id: recipeId })
      // 23505 — уже в избранном (например, добавлено с другого устройства).
      if (error && error.code !== '23505') fail(error, 'добавить в избранное')
    },

    async remove(recipeId) {
      const { error } = await supabase.from('favorite_recipes').delete().eq('recipe_id', recipeId)
      if (error) fail(error, 'убрать из избранного')
    },
  }
}
