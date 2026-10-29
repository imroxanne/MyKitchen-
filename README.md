# MyKitchen

Личный веб-сервис: что приготовить из имеющихся продуктов, проверенные рецепты, КБЖУ,
дневник питания, планирование и покупки. Бесплатный стек, телефон и десктоп.

- Что строим — [docs/MyKitchen_TZ.md](docs/MyKitchen_TZ.md)
- В каком порядке — [docs/MyKitchen_Roadmap.md](docs/MyKitchen_Roadmap.md), статус — [docs/STATUS.md](docs/STATUS.md)
- Стек и лимиты — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Окружения и переменные — [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md)
- Где какие данные хранятся — [docs/DATA_MAP.md](docs/DATA_MAP.md)

## Запуск

```bash
npm ci
cp .env.example .env.local   # заполнить адрес и публикуемый ключ Supabase
npm run dev                  # http://127.0.0.1:5173
```

| Команда            | Что делает                                        |
| ------------------ | ------------------------------------------------- |
| `npm run check`    | lint + проверка типов + юнит-тесты + сборка + e2e |
| `npm test`         | юнит-тесты (Vitest)                               |
| `npm run test:e2e` | сквозные тесты (Playwright, телефон и десктоп)    |
| `npm run db:start` | локальный Supabase в Docker                       |
| `npm run format`   | автоформатирование                                |
