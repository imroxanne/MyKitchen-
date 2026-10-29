// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildMigration, parseCatalog } from '../../../scripts/catalog/build-migration'

describe('справочник продуктов', () => {
  it('исходный файл корректен: категории, единицы, уникальность названий и синонимов', () => {
    const rows = parseCatalog(readFileSync('scripts/catalog/ingredients.tsv', 'utf8'))
    expect(rows.length).toBeGreaterThanOrEqual(200)
    expect(rows.find((r) => r.name === 'Томат')?.synonyms).toContain('помидор')
  })

  it('генератор отклоняет дубликаты и конфликт синонима с названием', () => {
    expect(() => parseCatalog('vegetables\tТомат\tpcs\t\nvegetables\tтомат\tpcs\t')).toThrow(
      /повторяет/,
    )
    expect(() => parseCatalog('vegetables\tСвёкла\tg\tсвекла')).toThrow(/совпадает с названием/)
    expect(() => parseCatalog('vegetables\tА\tg\tх\nfruits\tБ\tg\tх')).toThrow(/уже есть/)
    expect(() => parseCatalog('nope\tА\tg\t')).toThrow(/категория/)
  })

  it('экранирует апострофы в SQL', () => {
    const sql = buildMigration(parseCatalog("other\tO'Neil\tg\t"))
    expect(sql).toContain("('O''Neil', 'other', 'g')")
  })
})
