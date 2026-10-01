import * as Dialog from '@radix-ui/react-dialog'
import { BriefcaseBusiness, LogOut, X } from 'lucide-react'
import type { AuthenticatedUser } from '@/features/auth/types'
import { userInitials } from '@/utils/userInitials'
import { NavigationLinks } from './NavigationLinks'

export function MobileDrawer({
  user,
  onLogout,
  onNavigate,
}: {
  user: AuthenticatedUser
  onLogout: () => void
  onNavigate: () => void
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="mobile-drawer-overlay" />
      <Dialog.Content id="mobile-navigation" className="mobile-drawer-content">
        <header className="mobile-drawer-header">
          <div className="mobile-drawer-brand">
            <span className="brand-mark" aria-hidden="true">
              <BriefcaseBusiness size={20} strokeWidth={1.8} />
            </span>
            <strong>BuildCore</strong>
            <Dialog.Close asChild>
              <button className="icon-button mobile-drawer-close" aria-label="Close navigation">
                <X size={19} />
              </button>
            </Dialog.Close>
          </div>
          <div className="mobile-account-summary">
            <span className="avatar avatar-blue">{userInitials(user.name)}</span>
            <span className="mobile-account-copy">
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </span>
          </div>
          <div className="mobile-branch-context" role="group" aria-label="Current branch scope">
            <span>Branch access</span>
            <strong>{user.isCrossBranch ? 'All branches' : user.branch}</strong>
          </div>
          <Dialog.Title className="sr-only">Main navigation</Dialog.Title>
          <Dialog.Description className="sr-only">
            Navigate to a CBMS workspace area.
          </Dialog.Description>
        </header>
        <NavigationLinks user={user} onNavigate={onNavigate} />
        <footer className="mobile-drawer-footer">
          <button className="mobile-logout-button" onClick={onLogout}>
            <LogOut size={17} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  )
}
