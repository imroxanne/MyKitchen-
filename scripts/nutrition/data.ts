// Общие части скриптов пищевой ценности.

/** Американские меры объёма в миллилитрах (меры USDA). */
export const US_VOLUME_ML: Record<string, number> = {
  cup: 236.588,
  tbsp: 14.787,
  tablespoon: 14.787,
  tsp: 4.929,
  teaspoon: 4.929,
  ml: 1,
  'fl oz': 29.574,
}

/** Строки TSV без комментариев; проверяет число столбцов. */
export function parseTsv(text: string, columns: number): string[][] {
  const rows: string[][] = []
  text.split('\n').forEach((raw, index) => {
    if (!raw.trim() || raw.startsWith('#')) return
    const cells = raw.split('\t')
    if (cells.length !== columns)
      throw new Error(`строка ${index + 1}: ожидалось столбцов ${columns}, есть ${cells.length}`)
    rows.push(cells.map((c) => c.trim()))
  })
  return rows
}
