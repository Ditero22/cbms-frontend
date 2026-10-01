import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { QueryState } from '@/components/common/QueryState'
import { LoginPage } from '@/features/auth/LoginPage'
import { useSession } from '@/features/auth/hooks/useSession'

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

function RouteLoadingState() {
  return (
    <div className="table-empty" role="status" aria-live="polite">
      Opening this workspace…
    </div>
  )
}

export function App() {
  const { sessionQuery, user, login, logout } = useSession()

  if (sessionQuery.isPending) {
    return (
      <main className="login-page">
        <p>Connecting to your CBMS workspace…</p>
      </main>
    )
  }

  if (sessionQuery.isError && !user) {
    return (
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
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={login} />}
        />
        <Route
          element={
            user ? (
              <AppShell
                user={user}
                onLogout={() => {
                  void logout().catch((error: unknown) => {
                    toast.error(
                      error instanceof Error ? error.message : 'Could not sign out. Try again.',
                    )
                  })
                }}
              />
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
            path=":moduleId"
            element={
              <Suspense fallback={<RouteLoadingState />}>
                <ModulePage />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
