import * as Dialog from '@radix-ui/react-dialog'
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { UserProfileMenu } from '@/components/user/UserProfileMenu'
import type { AuthenticatedUser } from '@/features/auth/types'
import { modules } from '@/features/modules/modules'

type TopbarProps = {
  user: AuthenticatedUser
  dark: boolean
  sidebarCollapsed: boolean
  mobileNavigationOpen: boolean
  profileOpen: boolean
  onToggleSidebar: () => void
  onToggleTheme: () => void
  onToggleProfile: () => void
  onLogout: () => void
}

export function Topbar({
  user,
  dark,
  sidebarCollapsed,
  mobileNavigationOpen,
  profileOpen,
  onToggleSidebar,
  onToggleTheme,
  onToggleProfile,
  onLogout,
}: TopbarProps) {
  const location = useLocation()

  const currentRoute = location.pathname.split('/')[1] || 'dashboard'
  const currentModule = modules.find((module) => module.id === currentRoute)
  const title =
    currentRoute === 'dashboard'
      ? 'Overview'
      : currentRoute === 'design-system'
        ? 'Design system'
        : currentRoute === 'settings'
          ? 'Settings'
          : (currentModule?.title ?? 'Materials Supply Operations & Finance')

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="icon-button mobile-menu"
            aria-label={mobileNavigationOpen ? 'Close navigation' : 'Open navigation'}
            aria-controls="mobile-navigation"
            aria-expanded={mobileNavigationOpen}
          >
            {mobileNavigationOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </Dialog.Trigger>
        <button
          type="button"
          className="icon-button desktop-collapse"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <span className="workspace-label">Materials Supply Operations &amp; Finance</span>
        <strong className="crumb-current">{title}</strong>
      </div>

      <div className="topbar-right">
        <div className="branch-context" role="group" aria-label="Current branch scope">
          <span className={`branch-dot${user.isCrossBranch ? ' muted' : ''}`} aria-hidden="true" />
          <span>{user.isCrossBranch ? 'All branches' : user.branch}</span>
        </div>
        <button
          type="button"
          className="icon-button theme-toggle"
          onClick={onToggleTheme}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <UserProfileMenu
          user={user}
          open={profileOpen}
          onToggle={onToggleProfile}
          onLogout={onLogout}
        />
      </div>
    </header>
  )
}
