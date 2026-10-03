import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LayoutDashboard, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import type { AuthenticatedUser } from '@/features/auth/types'
import { modules, navGroups } from '@/features/modules/modules'
import { canAccessModule, isNavigationModule } from '@/features/modules/module-access'

type NavigationLinksProps = {
  user: AuthenticatedUser
  collapsed?: boolean
  onNavigate?: () => void
}

export function NavigationLinks({ user, collapsed = false, onNavigate }: NavigationLinksProps) {
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null)
  const tooltipAnchor = useRef<{ label: string; element: HTMLElement } | null>(null)
  const scrollFrame = useRef<number | null>(null)
  const tooltipId = useId()
  const location = useLocation()

  const closeTooltip = useCallback(() => {
    tooltipAnchor.current = null
    if (scrollFrame.current !== null) {
      window.cancelAnimationFrame(scrollFrame.current)
      scrollFrame.current = null
    }
    setTooltip(null)
  }, [])

  useEffect(() => {
    closeTooltip()
  }, [collapsed, location.pathname, closeTooltip])

  useEffect(() => {
    if (!collapsed) return
    window.addEventListener('resize', closeTooltip)
    return () => {
      window.removeEventListener('resize', closeTooltip)
      if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current)
    }
  }, [collapsed, closeTooltip])

  function showTooltip(label: string, element: HTMLElement, source: 'hover' | 'focus') {
    if (!collapsed) return
    if (source === 'hover' && !window.matchMedia('(hover: hover) and (pointer: fine)').matches)
      return
    tooltipAnchor.current = { label, element }
    const bounds = element.getBoundingClientRect()
    setTooltip({ label, top: bounds.top + bounds.height / 2 })
  }

  function updateTooltipAfterScroll(nav: HTMLElement) {
    if (!tooltipAnchor.current) return
    if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current)
    // Focus and scroll-into-view may dispatch scroll after the tooltip opens.
    // Keep it attached to the active link; explicit scroll gestures dismiss it.
    scrollFrame.current = window.requestAnimationFrame(() => {
      scrollFrame.current = null
      const anchor = tooltipAnchor.current
      if (!anchor) return
      const { element, label } = anchor
      if (
        !element.isConnected ||
        (document.activeElement !== element && !element.matches(':hover'))
      ) {
        closeTooltip()
        return
      }
      const bounds = element.getBoundingClientRect()
      const navBounds = nav.getBoundingClientRect()
      if (bounds.bottom <= navBounds.top || bounds.top >= navBounds.bottom) {
        closeTooltip()
        return
      }
      setTooltip({ label, top: bounds.top + bounds.height / 2 })
    })
  }

  return (
    <>
      <nav
        className="sidebar-nav"
        aria-label="Main navigation"
        onScroll={(event) => updateTooltipAfterScroll(event.currentTarget)}
        onWheelCapture={closeTooltip}
        onTouchMoveCapture={closeTooltip}
        onPointerDownCapture={closeTooltip}
        onKeyDownCapture={(event) => {
          if (
            ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)
          )
            closeTooltip()
        }}
      >
        <div className="nav-caption">WORKSPACE</div>
        <NavigationItem
          to="/dashboard"
          label="Overview"
          icon={LayoutDashboard}
          onNavigate={onNavigate}
          onTooltip={showTooltip}
          onTooltipClose={closeTooltip}
          tooltipId={collapsed && tooltip?.label === 'Overview' ? tooltipId : undefined}
        />
        {navGroups.map((group) => {
          const visibleModules = modules.filter(
            (module) =>
              module.group === group && isNavigationModule(module) && canAccessModule(module, user),
          )
          if (visibleModules.length === 0) return null

          return (
            <div className="nav-group" key={group}>
              <div className="nav-caption">{group.toUpperCase()}</div>
              {visibleModules.map((module) => (
                <NavigationItem
                  key={module.id}
                  to={`/${module.id}`}
                  label={module.label}
                  icon={module.icon}
                  onNavigate={onNavigate}
                  onTooltip={showTooltip}
                  onTooltipClose={closeTooltip}
                  tooltipId={collapsed && tooltip?.label === module.label ? tooltipId : undefined}
                />
              ))}
            </div>
          )
        })}
        <div className="nav-group">
          <div className="nav-caption">PREFERENCES</div>
          <NavigationItem
            to="/settings"
            label="Settings"
            icon={Settings}
            onNavigate={onNavigate}
            onTooltip={showTooltip}
            onTooltipClose={closeTooltip}
            tooltipId={collapsed && tooltip?.label === 'Settings' ? tooltipId : undefined}
          />
        </div>
      </nav>
      {tooltip &&
        collapsed &&
        createPortal(
          <span id={tooltipId} className="nav-tooltip" role="tooltip" style={{ top: tooltip.top }}>
            {tooltip.label}
          </span>,
          document.body,
        )}
    </>
  )
}

function NavigationItem({
  to,
  label,
  icon: Icon,
  onNavigate,
  onTooltip,
  onTooltipClose,
  tooltipId,
}: {
  to: string
  label: string
  icon: LucideIcon
  onNavigate?: () => void
  onTooltip: (label: string, element: HTMLElement, source: 'hover' | 'focus') => void
  onTooltipClose: () => void
  tooltipId?: string
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      aria-describedby={tooltipId}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      onClick={() => {
        onTooltipClose()
        onNavigate?.()
      }}
      onMouseEnter={(event) => onTooltip(label, event.currentTarget, 'hover')}
      onMouseLeave={(event) => {
        if (document.activeElement !== event.currentTarget) onTooltipClose()
      }}
      onFocus={(event) => onTooltip(label, event.currentTarget, 'focus')}
      onBlur={onTooltipClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onTooltipClose()
      }}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  )
}
