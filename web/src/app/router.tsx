import { createBrowserRouter } from 'react-router-dom'
import { LoginPage } from '../pages/LoginPage'
import { LobbyPage } from '../pages/LobbyPage'
import { DashboardPage } from '../pages/DashboardPage'
import { ClaimPage } from '../pages/ClaimPage'
import { AnnotatePage } from '../pages/AnnotatePage'
import { AdjudicationListPage } from '../pages/AdjudicationListPage'
import { AdjudicationDetailPage } from '../pages/AdjudicationDetailPage'
import { ExportsPage } from '../pages/ExportsPage'
import { AdminPage } from '../pages/AdminPage'
import { ForbiddenPage } from '../pages/ForbiddenPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/lobby', element: <LobbyPage /> },
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/claim/:taskType', element: <ClaimPage /> },
  { path: '/annotate/:taskType/:batchId', element: <AnnotatePage /> },
  { path: '/adjudication', element: <AdjudicationListPage /> },
  { path: '/adjudication/:taskType/:sampleId', element: <AdjudicationDetailPage /> },
  { path: '/exports', element: <ExportsPage /> },
  { path: '/admin', element: <AdminPage /> },
  { path: '/forbidden', element: <ForbiddenPage /> },
  { path: '*', element: <NotFoundPage /> },
])
