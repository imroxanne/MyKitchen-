import { eatenMacros, validateEaten } from '../features/diary/logic'
import { sortDay } from '../features/diary/supabaseApi'
import type { DiaryApi, DiaryEntry } from '../features/diary/types'

/** Дневник в памяти с правилами БД: количество, снимок неизменен, КБЖУ — из снимка. */
export function createMemoryDiaryApi() {
  const store = {
    entries: [] as DiaryEntry[],
    nextId: 1,
    failNext: null as string | null,
  }

  const maybeFail = async () => {
    await Promise.resolve()
    if (store.failNext) {
      const message = store.failNext
      store.failNext = null
      throw new Error(message)
    }
  }

  // КБЖУ съеденного пересчитывается из снимка — как столбцы-формулы в БД.
  const withEaten = (e: DiaryEntry): DiaryEntry => {
    const problem = validateEaten(e)
    const eaten = eatenMacros(e, e)
    if (problem || !eaten) throw new Error(problem ?? 'Так записать нельзя')
    return { ...e, eaten }
  }

  const api: DiaryApi = {
    async listDay(date) {
      await maybeFail()
      return sortDay(store.entries.filter((e) => e.eatenOn === date)).map((e) => structuredClone(e))
    },
    async add(entry) {
      await maybeFail()
      const saved = withEaten({
        ...structuredClone(entry),
        id: store.nextId++,
        createdAt: '2026-10-30T10:00:00Z',
        eaten: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
      })
      store.entries.push(saved)
      return structuredClone(saved)
    },
    async update(id, patch) {
      await maybeFail()
      const at = store.entries.findIndex((e) => e.id === id)
      if (at < 0) throw new Error('Запись не найдена')
      const saved = withEaten({ ...store.entries[at]!, ...patch } as DiaryEntry)
      store.entries[at] = saved
      return structuredClone(saved)
    },
    async remove(id) {
      await maybeFail()
      store.entries = store.entries.filter((e) => e.id !== id)
    },
  }
  return { api, store }
}
