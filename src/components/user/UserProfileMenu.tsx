import { useEffect, useRef } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import type { AuthenticatedUser } from '@/features/auth/types'
import { userInitials } from '@/utils/userInitials'

type UserProfileMenuProps = {
  user: AuthenticatedUser
  open: boolean
  onToggle: () => void
  onLogout: () => void
}

export function UserProfileMenu({ user, open, onToggle, onLogout }: UserProfileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) onToggle()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      onToggle()
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onToggle, open])

  return (
    <div ref={menuRef} className="popover-wrap profile-wrap navbar-profile">
      <button
        ref={triggerRef}
        type="button"
        className="profile-trigger top-avatar"
        onClick={onToggle}
        aria-label={open ? 'Close user menu' : `Open user menu for ${user.name}`}
        aria-expanded={open}
        aria-controls="user-profile-menu"
      >
        <span className="avatar avatar-blue">{userInitials(user.name)}</span>
        <span className="profile-trigger-name">{user.name}</span>
        <ChevronDown className="profile-chevron" size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          id="user-profile-menu"
          className="popover-menu profile-menu"
          role="group"
          aria-label="User account"
        >
          <div className="profile-card">
            <div className="avatar avatar-blue">{userInitials(user.name)}</div>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <button type="button" className="logout-action" onClick={onLogout}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
