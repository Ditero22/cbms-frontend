import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Outlet, useLocation } from 'react-router-dom'
import type { AuthenticatedUser } from '@/features/auth/types'
import { ModuleRuntimeProvider } from '@/features/modules/ModuleRuntimeProvider'
import { useAppearancePreferences } from '@/features/settings/useAppearancePreferences'
import { MobileDrawer } from './MobileDrawer'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

type AppShellProps = {
  user: AuthenticatedUser
  onLogout: () => void
}

export function AppShell({ user, onLogout }: AppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem('cbms-sidebar-collapsed') === 'true',
  )
  const [profileOpen, setProfileOpen] = useState(false)
  const { isDark, setTheme } = useAppearancePreferences()

  useEffect(() => {
    const desktopViewport = window.matchMedia('(min-width: 901px)')
    const onViewportBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileNavigationOpen(false)
      }
      setProfileOpen(false)
    }

    desktopViewport.addEventListener('change', onViewportBreakpointChange)
    return () => desktopViewport.removeEventListener('change', onViewportBreakpointChange)
  }, [])

  useEffect(() => {
    setMobileNavigationOpen(false)
    setProfileOpen(false)
  }, [location.pathname])

  function toggleTheme() {
    setTheme(isDark ? 'light' : 'dark')
  }

  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => {
      const nextCollapsed = !collapsed
      window.localStorage.setItem('cbms-sidebar-collapsed', String(nextCollapsed))
      return nextCollapsed
    })
  }

  function closeMobileNavigation() {
    setMobileNavigationOpen(false)
  }

  return (
    <Dialog.Root open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
      <ModuleRuntimeProvider user={user}>
        <div className={`app-root${isDark ? ' dark' : ''}`}>
          <a className="skip-link" href="#main-content">
            Skip to main content
          </a>
          <Sidebar user={user} collapsed={sidebarCollapsed} />
          <div className={`main-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
            <Topbar
              user={user}
              dark={isDark}
              sidebarCollapsed={sidebarCollapsed}
              mobileNavigationOpen={mobileNavigationOpen}
              profileOpen={profileOpen}
              onToggleSidebar={toggleSidebar}
              onToggleTheme={toggleTheme}
              onToggleProfile={() => setProfileOpen((open) => !open)}
              onLogout={onLogout}
            />
            <main className="page-container" id="main-content" tabIndex={-1}>
              <Outlet />
            </main>
          </div>
          <MobileDrawer user={user} onLogout={onLogout} onNavigate={closeMobileNavigation} />
        </div>
      </ModuleRuntimeProvider>
    </Dialog.Root>
  )
}
