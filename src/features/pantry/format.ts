import type { Unit } from './types'

/**
 * Разбирает введённое количество: «2», «0,5», « 1.25 ». Пустая строка — null
 * (количество неизвестно). Некорректное или неположительное значение — undefined.
 */
export function parseQuantity(input: string): number | null | undefined {
  const text = input.trim().replace(',', '.')
  if (!text) return null
  if (!/^\d+(\.\d+)?$/.test(text)) return undefined
  const value = Number(text)
  return value > 0 ? value : undefined
}

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 })

export function formatQuantity(
  quantity: number | null,
  unitCode: string | null,
  units: Unit[],
): string {
  if (quantity === null || unitCode === null) return 'количество не указано'
  const unit = units.find((u) => u.code === unitCode)
  return `${numberFormat.format(quantity)} ${unit?.name ?? unitCode}`
}

export type ExpiryStatus = 'expired' | 'soon' | 'ok'

/** Срок годности относительно сегодняшней даты: «просрочено», «скоро» (≤ 2 дней), «ок». */
export function describeExpiry(
  expiresOn: string,
  today: Date = new Date(),
): { text: string; status: ExpiryStatus } {
  const [y, m, d] = expiresOn.split('-').map(Number)
  const expiry = Date.UTC(y, m - 1, d)
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((expiry - now) / 86_400_000)
  const date = new Date(expiry).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  if (days < 0) return { text: `просрочено (${date})`, status: 'expired' }
  if (days === 0) return { text: 'годен до сегодня', status: 'soon' }
  if (days <= 2) return { text: `годен до ${date}`, status: 'soon' }
  return { text: `годен до ${date}`, status: 'ok' }
}
