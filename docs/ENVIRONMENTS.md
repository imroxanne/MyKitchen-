# Окружения и конфигурация

## Окружения

| Окружение      | Где                                      | База данных                                      | `VITE_APP_ENV` |
| -------------- | ---------------------------------------- | ------------------------------------------------ | -------------- |
| **local**      | компьютер разработчика, `npm run dev`    | локальный Supabase в Docker (`npm run db:start`) | `local`        |
| **test**       | юнит-тесты, CI                           | без БД (юнит) / чистый Postgres из миграций (CI) | `test`         |
| **preview**    | Vercel, сборка каждой ветки кроме `main` | облачный проект `mykitchen`                      | `preview`      |
| **production** | Vercel, ветка `main`                     | облачный проект `mykitchen`                      | `production`   |

Отдельной облачной БД для preview нет: план Free допускает 2 активных проекта,
а ветвление БД Supabase платное. Поэтому изменения схемы проверяются в CI на чистом
Postgres **до** применения к облаку, и миграции делаются только добавляющими
(без удаления данных) либо отдельно согласуются.

## Переменные

Описаны в `.env.example`. Все `VITE_*` попадают в браузер — только публичные значения.

| Переменная                      | Значение                                            |
| ------------------------------- | --------------------------------------------------- |
| `VITE_APP_ENV`                  | `local` / `test` / `preview` / `production`         |
| `VITE_SUPABASE_URL`             | `https://doxryfmjiyhlfyhnuwdu.supabase.co` (облако) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | публикуемый ключ `sb_publishable_…` проекта         |

В Vercel переменные заданы в настройках проекта для Production и Preview.
Секретные ключи (`service_role`, пароль БД) в код и в `VITE_*` не попадают никогда.

## Облачные ресурсы

| Ресурс          | Идентификатор                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase проект | `mykitchen`, ref `doxryfmjiyhlfyhnuwdu`, eu-central-1                                                                                                                   |
| Vercel проект   | `mykitchen` в команде «Roxanne's projects», https://mykitchen-roxanne-s-projects2.vercel.app (Vercel Authentication на всех адресах, включая mykitchen-pied.vercel.app) |
| GitHub          | `imroxanne/MyKitchen-`                                                                                                                                                  |

## Миграции БД

1. Новая миграция — файл `supabase/migrations/<timestamp>_<имя>.sql`.
2. CI (`database`) поднимает чистый Postgres и применяет все миграции с нуля.
3. После прохождения CI миграция применяется к облаку (Supabase MCP/CLI) с той же
   версией, что и имя файла, — история в `supabase_migrations` и в Git совпадает.

## Воспроизведение проекта с нуля

```bash
nvm use            # Node 22 (.nvmrc)
npm ci
cp .env.example .env.local   # заполнить
npm run dev        # http://127.0.0.1:5173
npm run check      # lint + типы + юнит + сборка + e2e
npm run db:start   # локальный Supabase (нужен Docker)
```
