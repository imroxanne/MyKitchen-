// Нормализация названий продуктов. Должна совпадать с SQL-функцией
// public.normalize_name (миграция data_model): регистр, ё→е, пробелы.
export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ')
}
