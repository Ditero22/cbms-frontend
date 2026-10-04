import { useEffect } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  ArrowUpRight,
  Bell,
  Building2,
  DatabaseBackup,
  ExternalLink,
  Monitor,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Type,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeading } from '@/components/common/PageHeading'
import type { AuthenticatedUser } from '@/features/auth/types'
import { useAppearancePreferences } from './useAppearancePreferences'
import type { TextSizePreference } from './appearance-context'
import './settings.css'

type SettingsSectionId =
  | 'general'
  | 'appearance'
  | 'notifications'
  | 'security'
  | 'organization'
  | 'branches'
  | 'data-backup'
  | 'system'

type SettingsSection = {
  id: SettingsSectionId
  label: string
  icon: LucideIcon
  adminOnly?: boolean
}

const commonSections: SettingsSection[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: ShieldCheck },
]

const adminSections: SettingsSection[] = [
  { id: 'organization', label: 'Organization', icon: Building2, adminOnly: true },
  { id: 'branches', label: 'Branches', icon: Building2, adminOnly: true },
  { id: 'data-backup', label: 'Data & Backup', icon: DatabaseBackup, adminOnly: true },
  { id: 'system', label: 'System', icon: Settings2, adminOnly: true },
]

const textSizeLevels: { value: TextSizePreference; name: string }[] = [
  { value: 1, name: 'Compact' },
  { value: 2, name: 'Small' },
  { value: 3, name: 'Standard' },
  { value: 4, name: 'Large' },
  { value: 5, name: 'Extra large' },
]

const apiBase = (import.meta.env.VITE_API_URL?.trim() || '/api/v1').replace(/\/+$/, '')
const apiOriginPath = apiBase.replace(/\/api\/v1$/, '')

async function readHealth(path: '/api/health' | '/api/ready', signal: AbortSignal) {
  const response = await fetch(`${apiOriginPath}${path}`, { credentials: 'omit', signal })
  if (!response.ok) throw new Error('Service check failed')
  const payload: unknown = await response.json()
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('status' in payload) ||
    payload.status !== (path === '/api/health' ? 'ok' : 'ready')
  ) {
    throw new Error('Service check failed')
  }
  return 'Available' as const
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <strong>{label}</strong>
        {description && <p>{description}</p>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  )
}

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="settings-panel" aria-labelledby="settings-panel-title">
      <header className="settings-panel-heading">
        <h2 id="settings-panel-title">{title}</h2>
        <p>{description}</p>
      </header>
      <div className="settings-panel-content">{children}</div>
    </section>
  )
}

function StatusValue({ query }: { query: UseQueryResult<'Available', Error> }) {
  if (query.isPending) return <span className="settings-status is-pending">Checking…</span>
  if (query.isError) return <span className="settings-status is-unavailable">Unavailable</span>
  return <span className="settings-status is-available">Available</span>
}

export function SettingsPage({
  user,
  onLogout,
}: {
  user: AuthenticatedUser
  onLogout: () => void
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { theme, density, textSize, setTheme, setDensity, setTextSize } = useAppearancePreferences()
  // The server derives cross-branch scope only for the system Administrator role.
  const isSystemAdministrator = user.isCrossBranch
  const sections = isSystemAdministrator ? [...commonSections, ...adminSections] : commonSections
  const requestedSection = searchParams.get('section') as SettingsSectionId | null
  const section = sections.some((item) => item.id === requestedSection)
    ? requestedSection!
    : 'general'

  useEffect(() => {
    if (requestedSection === section) return
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('section', section)
        return next
      },
      { replace: true },
    )
  }, [requestedSection, section, setSearchParams])

  const health = useQuery({
    queryKey: ['settings-system-health'],
    queryFn: ({ signal }) => readHealth('/api/health', signal),
    enabled: isSystemAdministrator && section === 'system',
    refetchInterval: 60_000,
    retry: false,
  })
  const readiness = useQuery({
    queryKey: ['settings-system-readiness'],
    queryFn: ({ signal }) => readHealth('/api/ready', signal),
    enabled: isSystemAdministrator && section === 'system',
    refetchInterval: 60_000,
    retry: false,
  })

  function selectSection(next: SettingsSectionId) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)
      params.set('section', next)
      return params
    })
  }

  function saveTheme(next: 'light' | 'dark' | 'system') {
    setTheme(next)
    toast.success('Appearance saved on this device.')
  }

  function saveDensity(next: 'comfortable' | 'compact') {
    setDensity(next)
    toast.success('Display density saved on this device.')
  }

  function saveTextSize(next: TextSizePreference) {
    setTextSize(next)
    toast.success('Text size saved for your account on this device.')
  }

  const activeSection = sections.find((item) => item.id === section) ?? sections[0]

  return (
    <div className="settings-page">
      <PageHeading
        eyebrow="WORKSPACE"
        title="Settings"
        description="Manage your personal preferences and view the configuration available to your role."
      />

      <div className="settings-layout">
        <nav className="settings-navigation" aria-label="Settings sections">
          <label className="settings-mobile-select">
            <span>Settings section</span>
            <select
              aria-label="Settings section"
              value={section}
              onChange={(event) => selectSection(event.target.value as SettingsSectionId)}
            >
              {sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="settings-desktop-sections">
            <span className="settings-nav-caption">PERSONAL</span>
            {sections
              .filter((item) => !item.adminOnly)
              .map((item) => (
                <SectionButton
                  key={item.id}
                  section={item}
                  selected={section === item.id}
                  onSelect={selectSection}
                />
              ))}
            {isSystemAdministrator && (
              <>
                <span className="settings-nav-caption settings-nav-admin-caption">
                  ADMINISTRATION
                </span>
                {sections
                  .filter((item) => item.adminOnly)
                  .map((item) => (
                    <SectionButton
                      key={item.id}
                      section={item}
                      selected={section === item.id}
                      onSelect={selectSection}
                    />
                  ))}
              </>
            )}
          </div>
        </nav>

        <div className="settings-content" key={section}>
          {section === 'general' && (
            <SettingsPanel
              title="General"
              description="Application information and regional defaults."
            >
              <SettingsRow
                label="Application"
                description="The business workspace currently in use."
              >
                <span className="settings-value">Materials Supply Operations &amp; Finance</span>
              </SettingsRow>
              <SettingsRow
                label="Currency"
                description="Amounts are displayed in Philippine pesos."
              >
                <span className="settings-value">PHP (₱)</span>
              </SettingsRow>
              <SettingsRow
                label="Date format"
                description="Date formatting is currently defined by each screen; a personal format preference is not available."
              >
                <span className="settings-value">Screen default</span>
              </SettingsRow>
              <SettingsRow
                label="Time zone"
                description="Time zone preferences are not configurable in the current application."
              >
                <span className="settings-value">Not configurable</span>
              </SettingsRow>
            </SettingsPanel>
          )}

          {section === 'appearance' && (
            <SettingsPanel
              title="Appearance"
              description="Choose a display style for your account. Text size is saved per user on this device; theme and density are device preferences."
            >
              <SettingsRow
                label="Text size"
                description="Adjust text throughout the app, including tables, forms, navigation, and dialogs."
              >
                <fieldset className="settings-text-size-control">
                  <legend className="visually-hidden">Choose text size</legend>
                  <div className="settings-text-size-steps">
                    {textSizeLevels.map(({ value, name }) => (
                      <label
                        key={value}
                        className={`settings-text-size-option${textSize === value ? ' is-selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="cbms-text-size"
                          value={value}
                          checked={textSize === value}
                          onChange={() => saveTextSize(value)}
                          aria-label={`Level ${value} — ${name}`}
                        />
                        <span aria-hidden="true">{value}</span>
                      </label>
                    ))}
                  </div>
                  <div className="settings-text-size-endpoints" aria-hidden="true">
                    <span>Compact</span>
                    <span>Extra large</span>
                  </div>
                </fieldset>
              </SettingsRow>
              <section className="settings-text-preview" aria-live="polite">
                <header>
                  <span className="settings-preview-icon">
                    <Type size={16} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Live preview</strong>
                    <small>
                      Level {textSize} · {textSizeLevels[textSize - 1].name}
                    </small>
                  </span>
                </header>
                <div className="settings-preview-card">
                  <span>Customer balance</span>
                  <strong>₱12,450.00</strong>
                  <p>This sample shows how regular app text will appear.</p>
                  <div className="settings-preview-controls">
                    <span className="settings-preview-input">Outstanding balance</span>
                    <span className="settings-status is-available">Up to date</span>
                    <button type="button" className="button button-outline">
                      View details
                    </button>
                  </div>
                </div>
              </section>
              <SettingsRow
                label="Color theme"
                description="System mode follows your device setting. You can still zoom the page normally."
              >
                <select
                  className="form-input settings-select"
                  value={theme}
                  onChange={(event) => saveTheme(event.target.value as 'light' | 'dark' | 'system')}
                  aria-label="Color theme"
                >
                  <option value="system">Use device setting</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </SettingsRow>
              <SettingsRow
                label="Display density"
                description="Compact changes spacing on desktop only. Mobile controls keep their larger touch size."
              >
                <select
                  className="form-input settings-select"
                  value={density}
                  onChange={(event) => saveDensity(event.target.value as 'comfortable' | 'compact')}
                  aria-label="Display density"
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </SettingsRow>
            </SettingsPanel>
          )}

          {section === 'notifications' && (
            <SettingsPanel
              title="Notifications"
              description="The app currently provides in-app feedback for actions and errors."
            >
              <SettingsRow
                label="In-app feedback"
                description="Success and error messages appear while you use the application."
              >
                <span className="settings-value">Enabled by the application</span>
              </SettingsRow>
              <p className="settings-note">
                Per-user notification preferences and email or SMS delivery are not currently
                available, so there are no notification switches to save.
              </p>
            </SettingsPanel>
          )}

          {section === 'security' && (
            <SettingsPanel
              title="Security"
              description="Review the account and branch scope used for this signed-in session."
            >
              <SettingsRow label="Signed-in account">
                <span className="settings-value">
                  {user.name}
                  <small>{user.email}</small>
                </span>
              </SettingsRow>
              <SettingsRow label="Role">
                <span className="settings-value">{user.role}</span>
              </SettingsRow>
              <SettingsRow label="Data scope">
                <span className="settings-value">
                  {user.isCrossBranch ? 'All branches' : user.branch}
                </span>
              </SettingsRow>
              <p className="settings-note">
                Password changes and active-session management are not available in this settings
                page. Session tokens and secrets are never displayed.
              </p>
              <div className="settings-actions">
                <button type="button" className="button button-outline" onClick={onLogout}>
                  Sign out
                </button>
              </div>
            </SettingsPanel>
          )}

          {section === 'organization' && isSystemAdministrator && (
            <SettingsPanel
              title="Organization"
              description="Organization-wide settings are not yet stored by this application."
            >
              <p className="settings-note">
                Business name, contact details, logo, and report defaults do not have a supported
                settings persistence model. No unsaved or temporary controls are shown here.
              </p>
              <SettingsLink
                to="/branches"
                icon={Building2}
                title="Branches"
                description="View and manage the organization’s existing branch records."
              />
              <SettingsLink
                to="/users"
                icon={Users}
                title="Users & roles"
                description="Manage accounts and their assigned roles through the existing user module."
              />
            </SettingsPanel>
          )}

          {section === 'branches' && isSystemAdministrator && (
            <SettingsPanel
              title="Branches"
              description="Branch configuration belongs to the existing branch-management workflow."
            >
              <p className="settings-note">
                Branch defaults and per-branch settings are not available here. Use the branch
                module to manage the branch records already supported by the app.
              </p>
              <SettingsLink
                to="/branches"
                icon={Building2}
                title="Open branch management"
                description="Review existing branches and their current records."
              />
            </SettingsPanel>
          )}

          {section === 'data-backup' && isSystemAdministrator && (
            <SettingsPanel
              title="Data & Backup"
              description="Approved temporary recovery targets for the staging / pre-production environment."
            >
              <SettingsRow label="Recovery point objective (RPO)">
                <span className="settings-value">24 hours (target)</span>
              </SettingsRow>
              <SettingsRow label="Recovery time objective (RTO)">
                <span className="settings-value">1 business day (target)</span>
              </SettingsRow>
              <SettingsRow label="Backup schedule">
                <span className="settings-value">Daily</span>
              </SettingsRow>
              <SettingsRow label="Retention">
                <span className="settings-value">30 days</span>
              </SettingsRow>
              <SettingsRow label="Recovery owner">
                <span className="settings-value">System administrator</span>
              </SettingsRow>
              <p className="settings-note">
                These are approved targets, not proven service levels. The app does not report the
                latest backup run here, and this temporary policy does not describe production.
              </p>
              <a
                className="settings-link-card"
                href="https://github.com/Ditero22/cbms-backend/actions/workflows/staging-daily-backup.yml"
                target="_blank"
                rel="noreferrer"
              >
                <DatabaseBackup size={19} aria-hidden="true" />
                <span>
                  <strong>Daily staging recovery backup</strong>
                  <small>Open the GitHub Actions workflow to review run evidence.</small>
                </span>
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </SettingsPanel>
          )}

          {section === 'system' && isSystemAdministrator && (
            <SettingsPanel
              title="System"
              description="Safe, read-only checks reported by the current application and API."
            >
              <SettingsRow label="Frontend version">
                <span className="settings-value">{__CBMS_VERSION__}</span>
              </SettingsRow>
              <SettingsRow
                label="Frontend build mode"
                description="This is the Vite build mode, not an environment or resource identity."
              >
                <span className="settings-value">{import.meta.env.MODE}</span>
              </SettingsRow>
              <SettingsRow label="API process health">
                <StatusValue query={health} />
              </SettingsRow>
              <SettingsRow
                label="API + database readiness"
                description="The API readiness check confirms that the database connection and required migrations are ready."
              >
                <StatusValue query={readiness} />
              </SettingsRow>
              <SettingsRow label="Object storage">
                <span className="settings-value">Not reported by the application</span>
              </SettingsRow>
              <p className="settings-note">
                No database, storage credentials, connection strings, or secret configuration is
                displayed. Revision/build identifier is not currently supplied.
              </p>
              <button
                type="button"
                className="button button-outline settings-refresh"
                onClick={() => {
                  void health.refetch()
                  void readiness.refetch()
                }}
                disabled={health.isFetching || readiness.isFetching}
              >
                {health.isFetching || readiness.isFetching ? 'Checking…' : 'Check again'}
              </button>
            </SettingsPanel>
          )}

          {!sections.some((item) => item.id === section) && (
            <SettingsPanel
              title={activeSection.label}
              description="This section is not available for your account."
            >
              <p className="settings-note">
                Only settings authorized for the signed-in role are shown.
              </p>
            </SettingsPanel>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionButton({
  section,
  selected,
  onSelect,
}: {
  section: SettingsSection
  selected: boolean
  onSelect: (section: SettingsSectionId) => void
}) {
  const Icon = section.icon
  return (
    <button
      type="button"
      className={`settings-section-button${selected ? ' is-active' : ''}`}
      onClick={() => onSelect(section.id)}
      aria-current={selected ? 'page' : undefined}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{section.label}</span>
    </button>
  )
}

function SettingsLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <Link className="settings-link-card" to={to}>
      <Icon size={19} aria-hidden="true" />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  )
}
