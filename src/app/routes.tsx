import type { RouteObject } from 'react-router'
import { Layout } from './Layout'
import { sections } from './sections'
import { SectionPlaceholder } from '../pages/SectionPlaceholder'
import { SystemStatus } from '../pages/SystemStatus'
import { NotFound } from '../pages/NotFound'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      ...sections.map((section) => ({
        path: section.path,
        element: <SectionPlaceholder section={section} />,
      })),
      { path: '/status', element: <SystemStatus /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
