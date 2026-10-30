import { useEffect, useState, type FormEvent } from 'react'
import type { RecipeImage, RecipesApi } from './types'

/** Большие фото с телефона уменьшаются до 1600 px по длинной стороне (JPEG). */
const MAX_SIDE = 1600

async function prepareImage(file: File): Promise<Blob> {
  // Без поддержки в браузере (и в тестах) — файл как есть; хранилище ограничит размер.
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.85),
  )
}

/**
 * Фото блюда с подписью об авторе и правах. Владелице — загрузка, замена и удаление фото.
 */
export function RecipePhoto({
  api,
  recipeId,
  title,
  image,
  onChange,
}: {
  api: RecipesApi
  recipeId: number
  title: string
  image: RecipeImage | null
  onChange(image: RecipeImage | null): void
}) {
  const [admin, setAdmin] = useState(false)
  const [editing, setEditing] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [credit, setCredit] = useState('Фото: моё')
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    // Не удалось проверить права — просто не показываем кнопки.
    api.isAdmin().then(
      (yes) => !cancelled && setAdmin(yes),
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [api])

  async function run(action: () => Promise<RecipeImage | null>, done: string) {
    setBusy(true)
    setMessage(null)
    try {
      onChange(await action())
      setEditing(false)
      setFile(null)
      setRights(false)
      setMessage({ error: false, text: done })
    } catch (e) {
      setMessage({ error: true, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    run(
      async () => api.setImage(recipeId, await prepareImage(file), credit.trim(), image),
      'Фото сохранено.',
    )
  }

  return (
    <>
      {image && (
        <figure className="recipe-photo">
          <img src={image.url} alt={`Фото блюда: ${title}`} />
          <figcaption className="muted small">
            {image.sourceUrl ? (
              <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">
                {image.credit}
              </a>
            ) : (
              image.credit
            )}
          </figcaption>
        </figure>
      )}

      {admin && (
        <div className="photo-admin">
          {!editing && (
            <div className="actions">
              <button type="button" onClick={() => setEditing(true)}>
                {image ? 'Заменить фото' : 'Добавить фото'}
              </button>
              {image && (
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    run(async () => (await api.removeImage(recipeId, image), null), 'Фото убрано.')
                  }
                >
                  Убрать фото
                </button>
              )}
            </div>
          )}

          {editing && (
            <form className="card editor" onSubmit={submit} aria-label="Фото блюда">
              <h2>{image ? 'Заменить фото' : 'Добавить фото'}</h2>
              <label className="field-row">
                Файл (JPEG, PNG или WebP)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="field-row">
                Подпись: автор и права
                <input
                  type="text"
                  value={credit}
                  maxLength={300}
                  onChange={(e) => setCredit(e.target.value)}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={rights}
                  onChange={(e) => setRights(e.target.checked)}
                />
                Фото моё или у меня есть право его использовать
              </label>
              <div className="actions">
                <button
                  type="submit"
                  className="primary"
                  disabled={busy || !file || !rights || !credit.trim()}
                >
                  {busy ? 'Загрузка…' : 'Сохранить фото'}
                </button>
                <button type="button" disabled={busy} onClick={() => setEditing(false)}>
                  Отмена
                </button>
              </div>
            </form>
          )}

          {message && (
            <p
              className={message.error ? 'error small' : 'success small'}
              role={message.error ? 'alert' : 'status'}
            >
              {message.text}
            </p>
          )}
        </div>
      )}
    </>
  )
}
