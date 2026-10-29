// Как показывать рецепт: статусы доверия, время, количества. Чистые функции.
import type { RecipeIngredientLine, RecipeSource, RecipeTrust } from './types'

export interface TrustBadge {
  key: string
  label: string
  tone: 'ok' | 'warn' | 'neutral'
  explanation: string
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
export const formatDate = (iso: string) => dateFormat.format(new Date(iso))

/**
 * Раздельные статусы (ТЗ §4): проверка приготовлением и проверка источника/полноты
 * показываются всегда — и когда есть, и когда нет. Тестовые данные помечаются отдельно.
 */
export function trustBadges(trust: RecipeTrust): TrustBadge[] {
  const badges: TrustBadge[] = []
  if (trust.isSample)
    badges.push({
      key: 'sample',
      label: 'Тестовые данные',
      tone: 'warn',
      explanation: 'Демонстрационная запись, не настоящий рецепт.',
    })
  badges.push(
    trust.cookedVerifiedAt
      ? {
          key: 'cooked',
          label: 'Проверен приготовлением',
          tone: 'ok',
          explanation: `${formatDate(trust.cookedVerifiedAt)}: ${trust.cookedVerifiedNote ?? ''}`,
        }
      : {
          key: 'cooked',
          label: 'Не проверен приготовлением',
          tone: 'warn',
          explanation: 'По этой карточке ещё не готовили и не подтвердили результат.',
        },
  )
  badges.push(
    trust.sourceCheckedAt
      ? {
          key: 'source',
          label: 'Источник и полнота проверены',
          tone: 'ok',
          explanation: `${formatDate(trust.sourceCheckedAt)}: ${trust.sourceCheckedNote ?? ''}`,
        }
      : {
          key: 'source',
          label: 'Источник не проверен',
          tone: 'warn',
          explanation: 'Полноту ингредиентов и шагов ещё не сверяли с оригиналом.',
        },
  )
  if (trust.origin === 'user')
    badges.push({
      key: 'user',
      label: 'Добавлен пользователем',
      tone: 'neutral',
      explanation: 'Рецепт добавлен пользователем MyKitchen.',
    })
  return badges
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} мин`
  return m ? `${h} ч ${m} мин` : `${h} ч`
}

/** Общее время. Если источник его не указывает — так и говорим. */
export function describeTime(prep: number | null, cook: number | null): string {
  if (prep === null && cook === null) return 'время не указано в источнике'
  const total = (prep ?? 0) + (cook ?? 0)
  const partial = prep === null || cook === null ? ' (указано не полностью)' : ''
  return `${formatMinutes(total)}${partial}`
}

export function describeServings(servings: number | null): string {
  if (servings === null) return 'число порций не указано в источнике'
  const n = Number.isInteger(servings) ? servings : servings.toLocaleString('ru-RU')
  return `${n} ${plural(servings, ['порция', 'порции', 'порций'])}`
}

function plural(n: number, forms: [string, string, string]): string {
  if (!Number.isInteger(n)) return forms[1]
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

/** Количество ингредиента: число с единицей или текст источника, без выдумывания. */
export function describeAmount(line: RecipeIngredientLine): string {
  if (line.quantity !== null && line.unitName)
    return `${numberFormat.format(line.quantity)} ${line.unitName}`
  if (line.quantityText) return line.quantityText
  if (line.unitName) return line.unitName
  return 'количество не указано'
}

export const IMPORTANCE_LABEL: Record<RecipeIngredientLine['importance'], string | null> = {
  key: 'основа блюда',
  main: null,
  minor: null,
  optional: 'по желанию',
}

export const RIGHTS_LABEL: Record<string, string> = {
  own: 'Собственный текст MyKitchen',
  permission: 'Используется с разрешения автора',
  open_license: 'Открытая лицензия',
  link_only: 'Только структура и ссылка на оригинал',
  public_domain: 'Общественное достояние',
  unknown: 'Права не установлены',
}

export function sourceSiteName(source: RecipeSource): string {
  if (!source.url) return source.title
  try {
    const host = new URL(source.url).hostname.replace(/^www\./, '')
    if (host === 'ru.wikibooks.org') return 'Викиучебник'
    return host
  } catch {
    return source.title
  }
}
