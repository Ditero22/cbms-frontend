import type { PropsWithChildren } from 'react'
import { useCreateModuleRecord } from './hooks/useCreateModuleRecord'
import type { AuthenticatedUser } from '@/features/auth/types'
import { ModuleRuntimeContext } from './ModuleRuntimeContext'
import type { CreateRecordPayload } from './types'

export function ModuleRuntimeProvider({
  user,
  children,
}: PropsWithChildren<{ user: AuthenticatedUser }>) {
  const createRecordMutation = useCreateModuleRecord()
  const runtime = {
    userId: user.id,
    branchId: user.branchId,
    branchName: user.branch,
    permissions: user.permissions,
    isCrossBranch: user.isCrossBranch,
    createRecord: (moduleId: string, values: CreateRecordPayload) =>
      createRecordMutation.mutateAsync({ moduleId, values }),
  }

  return <ModuleRuntimeContext.Provider value={runtime}>{children}</ModuleRuntimeContext.Provider>
}
