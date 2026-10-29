import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/authContext'
import { RequireAuth } from '../auth/RequireAuth'
import { AddProducts } from './AddProducts'
import { describeExpiry, formatQuantity } from './format'
import { ProductEditor } from './ProductEditor'
import { createSupabasePantryApi } from './supabaseApi'
import {
  KIND_TITLES,
  type Catalog,
  type CatalogItem,
  type PantryApi,
  type ProductKind,
  type UserProduct,
} from './types'

export function PantryPage({ api }: { api?: PantryApi }) {
  const { client } = useAuth()
  const effectiveApi = useMemo(
    () => api ?? (client ? createSupabasePantryApi(client) : null),
    [api, client],
  )
  return (
    <section aria-labelledby="pantry-title">
      <h1 id="pantry-title">Мои продукты</h1>
      <RequireAuth>{effectiveApi && <Pantry api={effectiveApi} />}</RequireAuth>
    </section>
  )
}

type Ready = { status: 'ready'; catalog: Catalog; products: UserProduct[] }
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | Ready

function Pantry({ api }: { api: PantryApi }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [editingId, setEditingId] = useState<number | null>(null)

  const fetchData = useCallback(
    () =>
      Promise.all([api.loadCatalog(), api.listProducts()]).then(
        ([catalog, products]) => setState({ status: 'ready', catalog, products }),
        (e: unknown) =>
          setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      ),
    [api],
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (state.status === 'loading') return <p aria-busy="true">Загрузка…</p>
  if (state.status === 'error')
    return (
      <div className="error" role="alert">
        <p>{state.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ status: 'loading' })
            fetchData()
          }}
        >
          Повторить
        </button>
      </div>
    )

  const { catalog, products } = state
  const byId = new Map(catalog.items.map((item) => [item.id, item]))
  const update = (fn: (current: { catalog: Catalog; products: UserProduct[] }) => Partial<Ready>) =>
    setState((s) => (s.status === 'ready' ? { ...s, ...fn(s) } : s))

  async function add(ingredientIds: number[], kind: ProductKind) {
    const added = await api.addProducts(
      ingredientIds.map((ingredientId) => ({ ingredientId, kind })),
    )
    update((s) => ({ products: [...s.products, ...added] }))
  }

  async function createOwn(name: string, categorySlug: string, kind: ProductKind) {
    const item = await api.createOwnIngredient(name, categorySlug)
    // Сначала фиксируем новый продукт в справочнике: если добавление в список
    // не удастся, его можно будет выбрать из поиска, а не создавать заново.
    update((s) => ({ catalog: { ...s.catalog, items: [...s.catalog.items, item] } }))
    const added = await api.addProducts([{ ingredientId: item.id, kind }])
    update((s) => ({ products: [...s.products, ...added] }))
  }

  return (
    <>
      <AddProducts
        catalog={catalog}
        presentIds={new Set(products.map((p) => p.ingredientId))}
        onAdd={add}
        onCreateOwn={createOwn}
      />
      {(['current', 'staple'] as const).map((kind) => (
        <ProductGroup
          key={kind}
          kind={kind}
          products={products.filter((p) => p.kind === kind)}
          catalog={catalog}
          byId={byId}
          editingId={editingId}
          onEdit={setEditingId}
          onSaved={(saved) => {
            update((s) => ({ products: s.products.map((p) => (p.id === saved.id ? saved : p)) }))
            setEditingId(null)
          }}
          onDeleted={(id) => {
            update((s) => ({ products: s.products.filter((p) => p.id !== id) }))
            setEditingId(null)
          }}
          api={api}
        />
      ))}
    </>
  )
}

interface GroupProps {
  kind: ProductKind
  products: UserProduct[]
  catalog: Catalog
  byId: Map<number, CatalogItem>
  editingId: number | null
  onEdit(id: number | null): void
  onSaved(product: UserProduct): void
  onDeleted(id: number): void
  api: PantryApi
}

function ProductGroup({
  kind,
  products,
  catalog,
  byId,
  editingId,
  onEdit,
  onSaved,
  onDeleted,
  api,
}: GroupProps) {
  const categoryOrder = new Map(catalog.categories.map((c, i) => [c.slug, i]))
  const sorted = [...products].sort((a, b) => {
    const ia = byId.get(a.ingredientId)
    const ib = byId.get(b.ingredientId)
    return (
      (categoryOrder.get(ia?.categorySlug ?? '') ?? 999) -
        (categoryOrder.get(ib?.categorySlug ?? '') ?? 999) ||
      (ia?.name ?? '').localeCompare(ib?.name ?? '', 'ru')
    )
  })
  const titleId = `group-${kind}`

  return (
    <section className="card" aria-labelledby={titleId}>
      <h2 id={titleId}>
        {KIND_TITLES[kind]} <span className="muted">({products.length})</span>
      </h2>
      {kind === 'staple' && (
        <p className="muted small">
          Соль, масло, специи — то, что обычно есть дома. Учитывается при подборе рецептов.
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="muted">Пока пусто.</p>
      ) : (
        <ul className="products" aria-label={KIND_TITLES[kind]}>
          {sorted.map((product) => {
            const item = byId.get(product.ingredientId)
            const name = item?.name ?? 'Неизвестный продукт'
            const editing = editingId === product.id
            const expiry = product.expiresOn ? describeExpiry(product.expiresOn) : null
            return (
              <li key={product.id} className={product.isExcluded ? 'product excluded' : 'product'}>
                <button
                  type="button"
                  className="product-row"
                  aria-expanded={editing}
                  onClick={() => onEdit(editing ? null : product.id)}
                >
                  <span className="product-name">
                    {name}
                    {item?.isOwn && <span className="badge">свой</span>}
                  </span>
                  <span className="product-meta">
                    <span className={product.quantity === null ? 'muted' : undefined}>
                      {formatQuantity(product.quantity, product.unitCode, catalog.units)}
                    </span>
                    {expiry && (
                      <span className={`expiry expiry-${expiry.status}`}>{expiry.text}</span>
                    )}
                    {product.isExcluded && <span className="badge">не учитывается</span>}
                  </span>
                </button>
                {editing && (
                  <ProductEditor
                    product={product}
                    productName={name}
                    defaultUnit={item?.defaultUnit ?? null}
                    units={catalog.units}
                    onClose={() => onEdit(null)}
                    onSave={async (patch) => onSaved(await api.updateProduct(product.id, patch))}
                    onDelete={async () => {
                      await api.deleteProduct(product.id)
                      onDeleted(product.id)
                    }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
