import {
  defaultMeal,
  isValidDate,
  localDate,
  localTime,
  parseDecimal,
  showDecimal,
  validateEaten,
} from './logic'
import type { DiaryEntry, DiaryEntryFields, DiarySnapshot, Eaten, Meal } from './types'

/** Поля формы «Съедено» в виде текста — как их вводит пользователь. */
export interface EatenFormState {
  eatenOn: string
  eatenTime: string
  meal: Meal
  mode: 'servings' | 'amount'
  amountText: string
  note: string
}

/** Новая запись: сегодня, сейчас, приём по времени, 1 порция (или масса, если порций нет). */
export function newFormState(snapshot: DiarySnapshot, now: Date): EatenFormState {
  const byServings = snapshot.baseServings !== null
  return {
    eatenOn: localDate(now),
    eatenTime: localTime(now),
    meal: defaultMeal(now),
    mode: byServings ? 'servings' : 'amount',
    amountText: byServings ? '1' : '',
    note: '',
  }
}

export function formStateFromEntry(entry: DiaryEntry): EatenFormState {
  return {
    eatenOn: entry.eatenOn,
    eatenTime: entry.eatenTime ?? '',
    meal: entry.meal,
    mode: entry.servings !== null ? 'servings' : 'amount',
    amountText: showDecimal(entry.servings ?? entry.amount),
    note: entry.note ?? '',
  }
}

export function eatenFromState(state: EatenFormState): Eaten {
  const value = parseDecimal(state.amountText) ?? Number.NaN
  return state.mode === 'servings'
    ? { servings: value, amount: null }
    : { servings: null, amount: value }
}

/** Поля записи или текст ошибки. */
export function readForm(
  state: EatenFormState,
): { fields: DiaryEntryFields; error: null } | { fields: null; error: string } {
  if (!isValidDate(state.eatenOn)) return { fields: null, error: 'Укажите дату.' }
  const eaten = eatenFromState(state)
  const problem = validateEaten(eaten)
  if (problem) return { fields: null, error: problem }
  return {
    fields: {
      eatenOn: state.eatenOn,
      eatenTime: /^\d{2}:\d{2}$/.test(state.eatenTime) ? state.eatenTime : null,
      meal: state.meal,
      note: state.note.trim() || null,
      ...eaten,
    },
    error: null,
  }
}
