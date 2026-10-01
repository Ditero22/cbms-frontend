import { BriefcaseBusiness } from 'lucide-react'
import type { AuthenticatedUser } from '@/features/auth/types'
import { NavigationLinks } from './NavigationLinks'

export function Sidebar({ user, collapsed }: { user: AuthenticatedUser; collapsed: boolean }) {
  return (
    <aside
      id="desktop-navigation"
      className={`sidebar desktop-sidebar${collapsed ? ' collapsed' : ''}`}
      aria-label="Main navigation"
    >
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">
          <BriefcaseBusiness size={23} strokeWidth={1.8} />
        </div>
        <div className="brand-text">
          <strong>BuildCore</strong>
          <span>CBMS WORKSPACE</span>
        </div>
      </div>
      <NavigationLinks user={user} collapsed={collapsed} />
    </aside>
  )
}
