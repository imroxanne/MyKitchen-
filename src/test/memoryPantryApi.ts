import type {
  Catalog,
  CatalogItem,
  NewProduct,
  PantryApi,
  ProductPatch,
  UserProduct,
} from '../features/pantry/types'

/** Хранилище в памяти с поведением, повторяющим ограничения БД (для тестов интерфейса). */
export function createMemoryPantryApi(catalog: Catalog) {
  const store = {
    items: [...catalog.items],
    products: [] as UserProduct[],
    nextId: 1000,
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

  const api: PantryApi = {
    async loadCatalog() {
      await maybeFail()
      return { ...catalog, items: [...store.items] }
    },
    async listProducts() {
      await maybeFail()
      return store.products.map((p) => ({ ...p }))
    },
    async addProducts(items: NewProduct[]) {
      await maybeFail()
      if (items.some((i) => store.products.some((p) => p.ingredientId === i.ingredientId)))
        throw new Error('Такой продукт уже есть')
      const added = items.map((i) => ({
        id: store.nextId++,
        ingredientId: i.ingredientId,
        kind: i.kind,
        quantity: null,
        unitCode: null,
        expiresOn: null,
        isExcluded: false,
      }))
      store.products.push(...added)
      return added.map((p) => ({ ...p }))
    },
    async updateProduct(id: number, patch: ProductPatch) {
      await maybeFail()
      const product = store.products.find((p) => p.id === id)
      if (!product) throw new Error('не найдено')
      const next = { ...product, ...patch }
      if ((next.quantity === null) !== (next.unitCode === null))
        throw new Error('количество и единица задаются вместе')
      Object.assign(product, next)
      return { ...product }
    },
    async deleteProduct(id: number) {
      await maybeFail()
      store.products = store.products.filter((p) => p.id !== id)
    },
    async createOwnIngredient(name: string, categorySlug: string) {
      await maybeFail()
      const item: CatalogItem = {
        id: store.nextId++,
        name,
        categorySlug,
        defaultUnit: null,
        isOwn: true,
        synonyms: [],
      }
      store.items.push(item)
      return item
    },
  }
  return { api, store }
}

export const testCatalog: Catalog = {
  categories: [
    { slug: 'vegetables', name: 'Овощи и зелень' },
    { slug: 'dairy', name: 'Молочные продукты и яйца' },
    { slug: 'sauces', name: 'Соусы и приправы' },
    { slug: 'other', name: 'Другое' },
  ],
  units: [
    { code: 'g', name: 'г', kind: 'mass', isApproximate: false },
    { code: 'kg', name: 'кг', kind: 'mass', isApproximate: false },
    { code: 'ml', name: 'мл', kind: 'volume', isApproximate: false },
    { code: 'pcs', name: 'шт.', kind: 'count', isApproximate: false },
    { code: 'to_taste', name: 'по вкусу', kind: 'other', isApproximate: true },
  ],
  items: [
    {
      id: 1,
      name: 'Томат',
      categorySlug: 'vegetables',
      defaultUnit: 'pcs',
      isOwn: false,
      synonyms: ['помидор', 'помидоры'],
    },
    {
      id: 2,
      name: 'Томатная паста',
      categorySlug: 'sauces',
      defaultUnit: 'g',
      isOwn: false,
      synonyms: [],
    },
    {
      id: 3,
      name: 'Морковь',
      categorySlug: 'vegetables',
      defaultUnit: 'g',
      isOwn: false,
      synonyms: ['морковка'],
    },
    { id: 4, name: 'Молоко', categorySlug: 'dairy', defaultUnit: 'ml', isOwn: false, synonyms: [] },
    {
      id: 5,
      name: 'Соль',
      categorySlug: 'sauces',
      defaultUnit: 'g',
      isOwn: false,
      synonyms: ['соль поваренная'],
    },
    {
      id: 6,
      name: 'Свёкла',
      categorySlug: 'vegetables',
      defaultUnit: 'g',
      isOwn: false,
      synonyms: ['буряк'],
    },
  ],
}
