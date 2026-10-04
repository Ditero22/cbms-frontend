import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AppDialog } from '@/components/common/AppDialog'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RecordHistoryPanel } from '@/components/common/RecordHistoryPanel'
import { getUserDetail } from '@/features/modules/modules.api'
import type { UserAccountRecord } from '@/features/modules/types'
import { getPermissionLabel } from '@/features/modules/permission-labels'
import './users.css'

export function UserDetailDialog({
  userId,
  canReadAudit,
  canUpdate,
  canDelete,
  onClose,
  onEdit,
  onResetPassword,
  onChangeStatus,
  onDelete,
}: {
  userId: string | null
  canReadAudit: boolean
  canUpdate: boolean
  canDelete: boolean
  onClose: () => void
  onEdit: (user: UserAccountRecord) => void
  onResetPassword: (user: UserAccountRecord) => void
  onChangeStatus: (user: UserAccountRecord) => void
  onDelete: (user: UserAccountRecord) => void
}) {
  const [historyPage, setHistoryPage] = useState(1)
  const query = useQuery({
    queryKey: ['user-detail', userId, historyPage],
    queryFn: () => getUserDetail(userId!, historyPage),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  })
  const user = query.data?.user
  const canManage = canUpdate && user?.canManage
  const canDeleteAccount = canDelete && user?.canManage

  return (
    <AppDialog
      open={Boolean(userId)}
      onOpenChange={(open) => !open && onClose()}
      title={user?.name ?? 'User details'}
      description={user?.email ?? 'Account information and access'}
      size="md"
    >
      {query.isPending ? (
        <p className="employee-detail-state" role="status">
          Loading user details…
        </p>
      ) : query.isError ? (
        <div className="employee-detail-state" role="alert">
          <strong>Could not load this user.</strong>
          <span>{query.error.message}</span>
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : user && query.data ? (
        <>
          <div className="user-detail-heading">
            <span>{user.roleName}</span>
            <StatusBadge value={user.status} />
          </div>
          <div className="user-detail-sections">
            <section>
              <h3>Account information</h3>
              <dl>
                <Field label="Name" value={user.name} />
                <Field label="Email" value={user.email} />
                <Field label="Created" value={formatDate(user.createdAt)} />
                <Field label="Last updated" value={formatDate(user.updatedAt)} />
                <Field
                  label="Last sign-in"
                  value={user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never signed in'}
                />
              </dl>
            </section>
            <section>
              <h3>Access and permissions</h3>
              <dl>
                <Field label="Role" value={user.roleName} />
                <Field label="Branch" value={user.branchName ?? 'No home branch'} />
                <Field
                  label="Branch access"
                  value={user.isCrossBranch ? 'Across all branches' : 'Assigned branch only'}
                />
              </dl>
              {user.roleDescription && <p className="form-helper">{user.roleDescription}</p>}
              <details className="user-permissions">
                <summary>View role permissions ({user.permissions.length})</summary>
                {user.permissions.length ? (
                  <ul>
                    {user.permissions.map((key) => (
                      <li key={key}>{getPermissionLabel(key)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="form-helper">This role has no permissions.</p>
                )}
              </details>
            </section>
          </div>
          {canUpdate && !user.canManage && user.managementReason && (
            <p className="form-helper">{user.managementReason}</p>
          )}
          {canReadAudit && (
            <RecordHistoryPanel
              entries={query.data.history}
              page={query.data.historyPage}
              pageSize={query.data.historyPageSize}
              total={query.data.historyTotal}
              onPageChange={setHistoryPage}
              busy={query.isFetching}
            />
          )}
          <div className="dialog-actions">
            {canManage && (
              <>
                <button className="button button-outline" onClick={() => onResetPassword(user)}>
                  Reset password
                </button>
                <button
                  className={
                    user.status === 'Active' ? 'button button-danger' : 'button button-outline'
                  }
                  onClick={() => onChangeStatus(user)}
                >
                  {user.status === 'Active' ? 'Deactivate account' : 'Activate account'}
                </button>
                <button className="button button-primary" onClick={() => onEdit(user)}>
                  Edit account
                </button>
              </>
            )}
            {canDeleteAccount && (
              <button className="button button-danger" onClick={() => onDelete(user)}>
                Delete account
              </button>
            )}
          </div>
        </>
      ) : null}
    </AppDialog>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}
