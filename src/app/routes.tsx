import type { ReactNode } from 'react'
import type { RouteObject } from 'react-router'
import { Layout } from './Layout'
import { sections } from './sections'
import { PantryPage } from '../features/pantry/PantryPage'
import { SectionPlaceholder } from '../pages/SectionPlaceholder'
import { ProfilePage } from '../pages/ProfilePage'
import { SystemStatus } from '../pages/SystemStatus'
import { NotFound } from '../pages/NotFound'

// Реализованные разделы; остальные пока показывают заглушку.
const implemented: Record<string, ReactNode> = {
  '/pantry': <PantryPage />,
  '/profile': <ProfilePage />,
}

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      ...sections.map((section) => ({
        path: section.path,
        element: implemented[section.path] ?? <SectionPlaceholder section={section} />,
      })),
      { path: '/status', element: <SystemStatus /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
