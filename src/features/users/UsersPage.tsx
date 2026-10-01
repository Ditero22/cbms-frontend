import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Plus, ShieldCheck } from 'lucide-react'
import { AppDialog } from '@/components/common/AppDialog'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { DataTable } from '@/components/common/DataTable'
import { PageHeading } from '@/components/common/PageHeading'
import { modules } from '@/features/modules/modules'
import {
  getModuleRecords,
  getRoles,
  getRolePermissionOptions,
  getUserManagementOptions,
} from '@/features/modules/modules.api'
import { useModuleRuntime } from '@/features/modules/useModuleRuntime'
import { UserAccountDialog } from '@/features/modules/UserAccountDialog'
import { ResetUserPasswordDialog } from '@/features/modules/ResetUserPasswordDialog'
import { RoleManagementDialog } from '@/features/modules/RoleManagementDialog'
import type {
  ModuleListQuery,
  UserAccountRecord,
  UserAccountValues,
} from '@/features/modules/types'
import { UserDetailDialog } from './UserDetailDialog'
import { useUserManagement } from './useUserManagement'

const usersModule = modules.find((module) => module.id === 'users')!

export function UsersPage() {
  const runtime = useModuleRuntime()
  const actions = useUserManagement()
  const [listQuery, setListQuery] = useState<ModuleListQuery>({
    page: 1,
    limit: 25,
    search: '',
    status: '',
    sort: '',
    order: 'asc',
  })
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccountRecord | null>(null)
  const [resetUser, setResetUser] = useState<UserAccountRecord | null>(null)
  const [statusUser, setStatusUser] = useState<UserAccountRecord | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserAccountRecord | null>(null)
  const [rolesOpen, setRolesOpen] = useState(false)
  const canRead = runtime.permissions.includes('users.read')
  const canCreate = runtime.permissions.includes('users.create')
  const canUpdate = runtime.permissions.includes('users.update')
  const canReadRoles = runtime.permissions.includes('roles.read')
  const canCreateRoles = runtime.permissions.includes('roles.create')
  const canUpdateRoles = runtime.permissions.includes('roles.update')
  const canModifyRoles = canCreateRoles || canUpdateRoles
  const list = useQuery({
    queryKey: ['module', 'users', listQuery],
    queryFn: () => getModuleRecords('users', listQuery),
    enabled: canRead,
    placeholderData: keepPreviousData,
  })
  const options = useQuery({
    queryKey: ['user-management-options'],
    queryFn: getUserManagementOptions,
    enabled: canRead && accountOpen && (canCreate || canUpdate),
  })
  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
    enabled: canReadRoles && rolesOpen,
  })
  const permissionOptions = useQuery({
    queryKey: ['role-permission-options'],
    queryFn: getRolePermissionOptions,
    enabled: canReadRoles && canModifyRoles && rolesOpen,
  })

  async function saveAccount(userId: string | null, values: UserAccountValues) {
    const saved = await actions.saveUser(userId, values)
    if (saved) {
      setAccountOpen(false)
      setEditingUser(null)
    }
    return saved
  }

  function openAccount(user: UserAccountRecord | null) {
    actions.clearError()
    setSelectedUserId(null)
    setEditingUser(user)
    setAccountOpen(true)
  }

  async function confirmStatus() {
    if (!statusUser) return
    const next = statusUser.status === 'Active' ? 'Inactive' : 'Active'
    if (await actions.changeStatus(statusUser.id, next)) setStatusUser(null)
  }

  async function confirmDelete() {
    if (!deleteUser) return
    if (await actions.deleteUser(deleteUser.id)) setDeleteUser(null)
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/dashboard' },
          { label: 'Management' },
          { label: usersModule.title },
        ]}
      />
      <PageHeading title={usersModule.title} description={usersModule.description}>
        {canReadRoles && (
          <button
            className="button button-outline"
            onClick={() => {
              actions.clearError()
              setRolesOpen(true)
            }}
          >
            <ShieldCheck size={16} /> Manage roles
          </button>
        )}
        {canCreate && (
          <button className="button button-primary" onClick={() => openAccount(null)}>
            <Plus size={17} />
            {usersModule.addLabel}
          </button>
        )}
      </PageHeading>
      {list.isPending ? (
        <div className="table-empty" role="status">
          <strong>Loading users…</strong>
        </div>
      ) : list.isError ? (
        <div className="table-empty" role="alert">
          <strong>Could not load users.</strong>
          <span>{list.error.message}</span>
          <button className="button button-outline" onClick={() => void list.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <DataTable
          module={usersModule}
          rows={list.data.data}
          total={list.data.total}
          statusOptions={list.data.statusOptions}
          query={listQuery}
          onQueryChange={setListQuery}
          onRowClick={(row) => setSelectedUserId(row.id)}
          busy={list.isFetching}
        />
      )}

      <UserDetailDialog
        key={selectedUserId ?? 'closed'}
        userId={selectedUserId}
        canReadAudit={runtime.permissions.includes('audit.read')}
        canUpdate={canUpdate}
        canDelete={runtime.isCrossBranch && canUpdate}
        onClose={() => setSelectedUserId(null)}
        onEdit={openAccount}
        onResetPassword={(user) => {
          actions.clearError()
          setSelectedUserId(null)
          setResetUser(user)
        }}
        onChangeStatus={(user) => {
          actions.clearError()
          setSelectedUserId(null)
          setStatusUser(user)
        }}
        onDelete={(user) => {
          actions.clearError()
          setSelectedUserId(null)
          setDeleteUser(user)
        }}
      />
      <UserAccountDialog
        open={accountOpen}
        onOpenChange={(open) => {
          if (!actions.busy) {
            setAccountOpen(open)
            if (!open) setEditingUser(null)
          }
        }}
        onSave={saveAccount}
        user={editingUser}
        options={options.data}
        isLoadingOptions={options.isPending}
        optionsError={options.error?.message}
        submitError={actions.error ?? undefined}
        onRetryOptions={() => void options.refetch()}
      />
      {resetUser && (
        <ResetUserPasswordDialog
          open
          onOpenChange={(open) => {
            if (!open && !actions.busy) setResetUser(null)
          }}
          userName={resetUser.name}
          submitError={actions.error ?? undefined}
          onSave={async (password) => {
            const saved = await actions.resetPassword(resetUser.id, password)
            if (saved) setResetUser(null)
            return saved
          }}
        />
      )}
      <RoleManagementDialog
        open={rolesOpen}
        onOpenChange={setRolesOpen}
        roles={roles.data ?? []}
        permissions={permissionOptions.data ?? []}
        isLoading={roles.isPending || (canModifyRoles && permissionOptions.isPending)}
        canCreate={canCreateRoles}
        canUpdate={canUpdateRoles}
        canReadAudit={runtime.permissions.includes('audit.read')}
        actorIsCrossBranch={runtime.isCrossBranch}
        optionsError={
          roles.error?.message ?? (canModifyRoles ? permissionOptions.error?.message : undefined)
        }
        onRetryOptions={() => {
          void roles.refetch()
          if (canModifyRoles) void permissionOptions.refetch()
        }}
        onSave={actions.saveRole}
        onDelete={actions.deleteRole}
      />
      <AppDialog
        open={Boolean(statusUser)}
        onOpenChange={(open) => {
          if (!open && !actions.busy) setStatusUser(null)
        }}
        title={
          statusUser?.status === 'Active' ? 'Deactivate user account?' : 'Reactivate user account?'
        }
        description={
          statusUser?.status === 'Active'
            ? `${statusUser.name} will be unable to sign in, and their active sessions will end. You can reactivate the account later.`
            : `Restore ${statusUser?.name ?? 'this user'}'s ability to sign in.`
        }
      >
        {actions.error && (
          <p className="field-error" role="alert">
            {actions.error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button button-outline"
            disabled={actions.busy}
            onClick={() => setStatusUser(null)}
          >
            Cancel
          </button>
          <button
            className={
              statusUser?.status === 'Active' ? 'button button-danger' : 'button button-primary'
            }
            disabled={actions.busy}
            onClick={() => void confirmStatus()}
          >
            {actions.busy ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </AppDialog>
      <AppDialog
        open={Boolean(deleteUser)}
        onOpenChange={(open) => {
          if (!open && !actions.busy) setDeleteUser(null)
        }}
        title="Delete user account?"
        description={`${deleteUser?.name ?? 'This account'} will be removed from active user lists, blocked from signing in, and have all active sessions ended. Its account email, audit, and business history will be retained; the email cannot be reused. This cannot be undone in the app.`}
      >
        {actions.error && (
          <p className="field-error" role="alert">
            {actions.error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button button-outline"
            disabled={actions.busy}
            onClick={() => setDeleteUser(null)}
          >
            Cancel
          </button>
          <button
            className="button button-danger"
            disabled={actions.busy}
            onClick={() => void confirmDelete()}
          >
            {actions.busy ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </AppDialog>
    </>
  )
}
