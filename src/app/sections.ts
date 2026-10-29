// Разделы из ТЗ §2. roadmap — пункты дорожной карты, в которых раздел
// получает рабочую функциональность. Пока пункт не закрыт, раздел — заглушка.

export interface Section {
  path: string
  title: string
  shortTitle: string
  summary: string
  roadmap: string[]
}

export const sections: Section[] = [
  {
    path: '/',
    title: 'Что приготовить',
    shortTitle: 'Готовить',
    summary: 'Подбор рецептов по продуктам, поиск, фильтры и карточки блюд.',
    roadmap: ['A5', 'A6', 'C5'],
  },
  {
    path: '/pantry',
    title: 'Мои продукты',
    shortTitle: 'Продукты',
    summary: 'Постоянные и текущие запасы, количества и сроки годности.',
    roadmap: ['A3', 'D3'],
  },
  {
    path: '/favorites',
    title: 'Избранное',
    shortTitle: 'Избранное',
    summary: 'Сохранённые рецепты, коллекции и история приготовлений.',
    roadmap: ['A6', 'C6'],
  },
  {
    path: '/diary',
    title: 'Дневник питания',
    shortTitle: 'Дневник',
    summary: 'Записи о съеденном и КБЖУ по дням и приёмам пищи.',
    roadmap: ['B3'],
  },
  {
    path: '/plan',
    title: 'Планирование',
    shortTitle: 'План',
    summary: 'Меню на дни и список покупок с учётом запасов.',
    roadmap: ['D1', 'D2'],
  },
  {
    path: '/profile',
    title: 'Профиль',
    shortTitle: 'Профиль',
    summary: 'Ограничения, предпочтения, оборудование, приватность и синхронизация.',
    roadmap: ['B4', 'E1'],
  },
]
