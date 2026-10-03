import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { RolePermissionPicker } from './RolePermissionPicker'
import { RoleHistoryPanel } from './RoleHistoryPanel'
import { RoleEditorFields } from './RoleEditorFields'
import type { RoleRecord, RoleValues } from './types'
import './roles.css'

type RoleManagementDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: RoleRecord[]
  permissions: string[]
  isLoading: boolean
  optionsError?: string
  onRetryOptions?: () => void
  canCreate: boolean
  canUpdate: boolean
  canReadAudit?: boolean
  actorIsCrossBranch?: boolean
  onSave: (roleId: string | null, values: RoleValues) => Promise<boolean>
  onDelete: (roleId: string) => Promise<boolean>
}

const emptyRole: RoleValues = { name: '', description: '', permissions: [] }

export function RoleManagementDialog({
  open,
  onOpenChange,
  roles,
  permissions,
  isLoading,
  optionsError,
  onRetryOptions,
  canCreate,
  canUpdate,
  canReadAudit = false,
  actorIsCrossBranch = true,
  onSave,
  onDelete,
}: RoleManagementDialogProps) {
  const [roleId, setRoleId] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [saveError, setSaveError] = useState('')
  const initializedRole = useRef<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RoleValues>({ defaultValues: emptyRole })
  const selectedRole = roles.find((role) => role.id === roleId) ?? roles[0]
  const selectedPermissions = watch('permissions') ?? []
  const isSystemRole = !isCreating && selectedRole?.isSystem === 1
  const roleBeyondAccess = !isCreating && selectedRole?.canManage === false
  const canEdit = isCreating
    ? canCreate
    : Boolean(selectedRole && canUpdate && !isSystemRole && !roleBeyondAccess)
  const busy = isLoading || isSubmitting || isDeleting
  const fieldsDisabled = busy || Boolean(optionsError) || !canEdit

  useEffect(() => {
    if (!open) {
      initializedRole.current = null
      return
    }
    const key = isCreating ? 'new' : selectedRole?.id
    if (!key || initializedRole.current === key) return
    initializedRole.current = key
    reset(
      isCreating || !selectedRole
        ? emptyRole
        : {
            name: selectedRole.name,
            description: selectedRole.description ?? '',
            permissions: selectedRole.permissions,
          },
    )
  }, [isCreating, open, reset, selectedRole])

  function handleOpenChange(nextOpen: boolean) {
    if ((isSubmitting || isDeleting) && !nextOpen) return
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setIsCreating(false)
      setDeleteConfirmOpen(false)
      setDeleteError('')
      setSaveError('')
      reset(emptyRole)
    }
  }

  function chooseRole(nextRoleId: string) {
    setIsCreating(false)
    setRoleId(nextRoleId)
    setSaveError('')
  }

  function togglePermission(permission: string, checked: boolean) {
    const next = new Set(selectedPermissions)
    if (checked) next.add(permission)
    else next.delete(permission)
    setValue('permissions', [...next], { shouldDirty: true, shouldValidate: true })
  }

  const submit = handleSubmit(async (values) => {
    if (!canEdit || fieldsDisabled) return
    setSaveError('')
    const saved = await onSave(isCreating ? null : (selectedRole?.id ?? null), {
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
    })
    if (saved) {
      onOpenChange(false)
      setIsCreating(false)
      reset(emptyRole)
    } else {
      setSaveError('The role could not be saved. Review the error message and try again.')
    }
  })

  async function handleDeleteRole() {
    if (!selectedRole || !canEdit) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      if (await onDelete(selectedRole.id)) {
        setDeleteConfirmOpen(false)
        setIsCreating(false)
        setRoleId('')
        onOpenChange(false)
      } else {
        setDeleteError('The role could not be deleted. Review the error message and try again.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <AppDialog
        open={open && !deleteConfirmOpen}
        onOpenChange={handleOpenChange}
        title="Manage roles"
        description="Manage role access within the permissions and branch scope of your account."
        size="wide"
        hasUnsavedChanges={isDirty}
      >
        <form className="dialog-form role-form" onSubmit={submit} aria-busy={busy}>
          <div className="role-chooser" data-dialog-ignore-dirty>
            <label className="field-label">
              Existing role
              <select
                className="form-input"
                value={isCreating ? '' : (selectedRole?.id ?? '')}
                disabled={busy || roles.length === 0}
                onChange={(event) => chooseRole(event.target.value)}
              >
                <option value="" disabled>
                  Select role
                </option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                    {role.isSystem ? ' · System' : ''}
                  </option>
                ))}
              </select>
            </label>
            {canCreate && (
              <button
                type="button"
                className="button button-outline"
                disabled={busy || Boolean(optionsError) || isCreating}
                onClick={() => {
                  setIsCreating(true)
                  setSaveError('')
                }}
              >
                <Plus size={14} aria-hidden="true" /> New role
              </button>
            )}
          </div>
          {isLoading ? (
            <p className="role-loading-state" role="status">
              Loading roles and permissions…
            </p>
          ) : optionsError ? (
            <div className="field-error" role="alert">
              {optionsError}
              {onRetryOptions && (
                <button
                  type="button"
                  className="button button-quiet button-small"
                  onClick={onRetryOptions}
                >
                  Try again
                </button>
              )}
            </div>
          ) : !isCreating && !selectedRole ? (
            <p className="role-empty-state">
              No roles are available.{canCreate && ' Create a new role to get started.'}
            </p>
          ) : (
            <>
              <RoleEditorFields
                role={selectedRole}
                isCreating={isCreating}
                disabled={fieldsDisabled}
                register={register}
                nameError={errors.name?.message}
                actorIsCrossBranch={actorIsCrossBranch}
              />
              {isSystemRole ? (
                <p className="form-helper">System roles are protected from changes.</p>
              ) : roleBeyondAccess ? (
                <p className="form-helper">
                  {selectedRole?.managementReason ?? 'Your account cannot manage this role.'}
                </p>
              ) : (
                !canEdit && (
                  <p className="form-helper">Your account has read-only access to roles.</p>
                )
              )}
              <RolePermissionPicker
                key={`permissions:${isCreating ? 'new' : selectedRole?.id}`}
                permissions={permissions}
                selected={selectedPermissions}
                disabled={fieldsDisabled}
                onChange={togglePermission}
              />
              {!isCreating && selectedRole && canReadAudit && (
                <RoleHistoryPanel key={`history:${selectedRole.id}`} roleId={selectedRole.id} />
              )}
              {saveError && (
                <p className="field-error" role="alert">
                  {saveError}
                </p>
              )}
            </>
          )}
          <div className="dialog-actions">
            {!isCreating && selectedRole && canEdit && (
              <button
                type="button"
                className="button button-danger"
                disabled={busy || selectedRole.assignedUserCount > 0 || Boolean(optionsError)}
                title={
                  selectedRole.assignedUserCount > 0
                    ? 'Reassign users before deleting this role.'
                    : undefined
                }
                onClick={() => {
                  setDeleteError('')
                  setDeleteConfirmOpen(true)
                }}
              >
                Delete role
              </button>
            )}
            <DialogCancelButton disabled={isSubmitting || isDeleting} />
            {canEdit && (
              <button
                type="submit"
                className="button button-primary"
                disabled={fieldsDisabled || !isDirty}
              >
                {isSubmitting ? 'Saving…' : isCreating ? 'Create role' : 'Save role'}
              </button>
            )}
          </div>
          {!isCreating && selectedRole && canEdit && selectedRole.assignedUserCount > 0 && (
            <p className="form-helper">Reassign users before deleting this role.</p>
          )}
        </form>
      </AppDialog>
      <AppDialog
        open={open && deleteConfirmOpen}
        onOpenChange={(nextOpen) => {
          if (!isDeleting) setDeleteConfirmOpen(nextOpen)
        }}
        title="Delete this role?"
        description={`Delete ${selectedRole?.name ?? 'this role'}? This permanently removes an unused custom role.`}
      >
        {deleteError && (
          <p className="field-error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="dialog-actions">
          <DialogCancelButton disabled={isDeleting} />
          <button
            type="button"
            className="button button-danger"
            disabled={isDeleting}
            onClick={() => void handleDeleteRole()}
          >
            {isDeleting ? 'Deleting…' : 'Delete role'}
          </button>
        </div>
      </AppDialog>
    </>
  )
}
