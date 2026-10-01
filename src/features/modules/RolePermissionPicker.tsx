import { useId, useState } from 'react'
import { Search } from 'lucide-react'
import { describePermission } from './permission-labels'

export function RolePermissionPicker({
  permissions,
  selected,
  disabled,
  onChange,
}: {
  permissions: string[]
  selected: string[]
  disabled: boolean
  onChange: (permission: string, checked: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const id = useId()
  const available = new Set(permissions)
  const query = search.trim().toLowerCase()
  const choices = [...new Set([...permissions, ...selected])].map(describePermission)
  const visible = choices.filter((permission) =>
    [permission.key, permission.group, permission.label, permission.description]
      .join(' ')
      .toLowerCase()
      .includes(query),
  )
  const groups = [...new Set(visible.map((permission) => permission.group))].sort((a, b) =>
    a.localeCompare(b),
  )

  return (
    <section className="role-permissions" aria-labelledby={`${id}-title`}>
      <div className="role-section-heading">
        <h3 id={`${id}-title`}>Permissions</h3>
        <span aria-live="polite">{selected.length} selected</span>
      </div>
      <p className="role-section-description">
        Choose the access this role needs. Branch scope and workflow checks still apply.
      </p>
      <label className="role-permission-search">
        <Search size={16} aria-hidden="true" />
        <input
          className="form-input"
          type="search"
          aria-label="Search permissions"
          placeholder="Search permissions or modules"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="role-permission-groups">
        {groups.map((group) => (
          <fieldset className="role-permission-group" key={group}>
            <legend>{group}</legend>
            {visible
              .filter((permission) => permission.group === group)
              .map((permission) => {
                const inputId = `${id}-${permission.key}`
                const canGrant = available.has(permission.key)
                return (
                  <div className="role-permission-choice" key={permission.key}>
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={selected.includes(permission.key)}
                      disabled={disabled || !canGrant}
                      aria-describedby={`${inputId}-description`}
                      onChange={(event) => onChange(permission.key, event.target.checked)}
                    />
                    <div>
                      <label htmlFor={inputId}>{permission.label}</label>
                      <p id={`${inputId}-description`}>
                        {permission.description}
                        {!canGrant && ' This permission cannot be granted by your account.'}
                      </p>
                      <code>{permission.key}</code>
                    </div>
                  </div>
                )
              })}
          </fieldset>
        ))}
        {visible.length === 0 && (
          <p className="role-empty-state" role="status">
            {query ? 'No permissions match your search.' : 'No permissions are available.'}
          </p>
        )}
      </div>
    </section>
  )
}
