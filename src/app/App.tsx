import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { AppLoadingScreen } from '@/components/common/AppLoadingScreen'
import { PageSkeleton } from '@/components/common/PageSkeleton'
import { UnknownRoutePage } from '@/components/common/UnknownRoutePage'
import { AppShell } from '@/components/layout/AppShell'
import { QueryState } from '@/components/common/QueryState'
import { LoginPage } from '@/features/auth/LoginPage'
import { useSession } from '@/features/auth/hooks/useSession'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { AppearanceProvider } from '@/features/settings/AppearanceProvider'

const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const DesignSystemPage = lazy(() =>
  import('@/features/design-system/DesignSystemPage').then((module) => ({
    default: module.DesignSystemPage,
  })),
)
const ModulePage = lazy(() =>
  import('@/features/modules/ModulePage').then((module) => ({
    default: module.ModulePage,
  })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)

function RouteLoadingState() {
  return <PageSkeleton title="workspace page" description="Opening your selected page…" />
}

export function App() {
  useVisualViewport()
  return <AppRoutes />
}

function AppRoutes() {
  const { sessionQuery, user, accessKey, login, logout } = useSession()

  function handleLogout() {
    void logout().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not sign out. Try again.')
    })
  }

  if (sessionQuery.isPending) {
    return (
      <AppearanceProvider key="anonymous" userId={null}>
        <AppLoadingScreen />
      </AppearanceProvider>
    )
  }

  if (sessionQuery.isError && !user) {
    return (
      <AppearanceProvider key="anonymous-error" userId={null}>
        <main className="login-page">
          <section className="login-card">
            <h1>Unable to connect to your workspace</h1>
            <QueryState
              error={sessionQuery.error}
              errorTitle="We could not verify your session."
              onRetry={() => void sessionQuery.refetch()}
            />
          </section>
        </main>
      </AppearanceProvider>
    )
  }

  return (
    <AppearanceProvider key={accessKey} userId={user?.id ?? null}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={login} />}
          />
          <Route
            element={
              user ? (
                <AppShell user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                user && (
                  <Suspense fallback={<RouteLoadingState />}>
                    <DashboardPage user={user} />
                  </Suspense>
                )
              }
            />
            <Route
              path="design-system"
              element={
                <Suspense fallback={<RouteLoadingState />}>
                  <DesignSystemPage />
                </Suspense>
              }
            />
            <Route
              path="settings"
              element={
                user && (
                  <Suspense fallback={<RouteLoadingState />}>
                    <SettingsPage user={user} onLogout={handleLogout} />
                  </Suspense>
                )
              }
            />
            <Route
              path=":moduleId"
              element={
                <Suspense fallback={<RouteLoadingState />}>
                  <ModulePage />
                </Suspense>
              }
            />
            <Route path="*" element={<UnknownRoutePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppearanceProvider>
  )
}
