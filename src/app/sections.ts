// Разделы из ТЗ §2. roadmap — пункты дорожной карты, в которых раздел
// получает рабочую функциональность. Пока пункт не закрыт, раздел — заглушка.

import type { IconName } from './icons'

export interface Section {
  path: string
  title: string
  shortTitle: string
  icon: IconName
  summary: string
  roadmap: string[]
}

export const sections: Section[] = [
  {
    path: '/',
    title: 'Что приготовить',
    shortTitle: 'Готовить',
    icon: 'cook',
    summary: 'Подбор рецептов по продуктам, поиск, фильтры и карточки блюд.',
    roadmap: ['A5', 'A6', 'C5'],
  },
  {
    path: '/pantry',
    title: 'Мои продукты',
    shortTitle: 'Продукты',
    icon: 'pantry',
    summary: 'Постоянные и текущие запасы, количества и сроки годности.',
    roadmap: ['A3', 'D3'],
  },
  {
    path: '/favorites',
    title: 'Избранное',
    shortTitle: 'Избранное',
    icon: 'heart',
    summary: 'Сохранённые рецепты, коллекции и история приготовлений.',
    roadmap: ['A6', 'C6'],
  },
  {
    path: '/diary',
    title: 'Дневник питания',
    shortTitle: 'Дневник',
    icon: 'diary',
    summary: 'Записи о съеденном и КБЖУ по дням и приёмам пищи.',
    roadmap: ['B3'],
  },
  {
    path: '/plan',
    title: 'Планирование',
    shortTitle: 'План',
    icon: 'plan',
    summary: 'Меню на дни и список покупок с учётом запасов.',
    roadmap: ['D1', 'D2'],
  },
  {
    path: '/profile',
    title: 'Профиль',
    shortTitle: 'Профиль',
    icon: 'profile',
    summary: 'Ограничения, предпочтения, оборудование, приватность и синхронизация.',
    roadmap: ['B4', 'E1'],
  },
]
