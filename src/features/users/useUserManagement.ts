import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sessionQueryKey } from '@/features/auth/session-cache'
import {
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  saveRole,
  deleteRole,
} from '@/features/modules/modules.api'
import type { RoleValues, UserAccountValues } from '@/features/modules/types'

export function useUserManagement() {
  const queryClient = useQueryClient()
  const pendingRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>, success: string, changesRoles = false) {
    if (pendingRef.current) return false
    pendingRef.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
      await Promise.all(
        [
          ['module', 'users'],
          ['user-detail'],
          ['user-management-options'],
          ['roles'],
          ['role-detail'],
          ['dashboard-summary'],
          ...(changesRoles ? [['role-permission-options'], sessionQueryKey] : []),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      toast.success(success)
      return true
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : 'The account action could not be completed.'
      setError(message)
      toast.error(message)
      return false
    } finally {
      pendingRef.current = false
      setBusy(false)
    }
  }

  function saveUser(userId: string | null, values: UserAccountValues) {
    return run(
      () =>
        userId
          ? updateUser(userId, {
              name: values.name,
              roleId: values.roleId,
              branchId: values.branchId,
              isCrossBranch: values.isCrossBranch,
            })
          : createUser(values),
      userId ? 'User account updated.' : 'User account created.',
    )
  }

  return {
    busy,
    error,
    clearError: () => setError(null),
    saveUser,
    changeStatus: (userId: string, status: 'Active' | 'Inactive') =>
      run(
        () => updateUser(userId, { status }),
        status === 'Active' ? 'User account activated.' : 'User account deactivated.',
      ),
    resetPassword: (userId: string, password: string) =>
      run(() => resetUserPassword(userId, password), 'Password reset. Active sessions were ended.'),
    deleteUser: (userId: string) => run(() => deleteUser(userId), 'User account deleted.'),
    saveRole: (roleId: string | null, values: RoleValues) =>
      run(() => saveRole(roleId, values), roleId ? 'Role updated.' : 'Role created.', true),
    deleteRole: (roleId: string) => run(() => deleteRole(roleId), 'Role deleted.', true),
  }
}
