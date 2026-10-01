import { useId } from 'react'
import type { UseFormRegister } from 'react-hook-form'
import { FieldHeading } from '@/components/common/FieldHeading'
import type { RoleRecord, RoleValues } from './types'

export function RoleEditorFields({
  role,
  isCreating,
  disabled,
  register,
  nameError,
  actorIsCrossBranch,
}: {
  role: RoleRecord | undefined
  isCreating: boolean
  disabled: boolean
  register: UseFormRegister<RoleValues>
  nameError?: string
  actorIsCrossBranch: boolean
}) {
  const formId = useId()
  return (
    <>
      {!isCreating && role && (
        <dl className="role-metadata">
          <div>
            <dt>{actorIsCrossBranch ? 'Assigned users' : 'Users in your branch'}</dt>
            <dd>
              {role.assignedUserCount} assigned {role.assignedUserCount === 1 ? 'user' : 'users'}
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDate(role.createdAt)}</dd>
          </div>
        </dl>
      )}
      <div className="dialog-field-grid">
        <label className="field-label">
          <FieldHeading required>Role name</FieldHeading>
          <input
            className="form-input"
            disabled={disabled}
            maxLength={80}
            aria-required="true"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? `${formId}-name-error` : undefined}
            {...register('name', {
              required: 'Enter a role name.',
              validate: (value) =>
                value.trim().length >= 2 || 'Role name must be at least 2 characters.',
            })}
          />
          {nameError && (
            <span id={`${formId}-name-error`} className="field-error" role="alert">
              {nameError}
            </span>
          )}
        </label>
        <label className="field-label">
          Description
          <textarea
            className="form-input form-textarea"
            disabled={disabled}
            rows={2}
            maxLength={240}
            placeholder="Describe who this role is for"
            {...register('description')}
          />
        </label>
      </div>
    </>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}
