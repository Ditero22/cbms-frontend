import { createContext } from 'react'
import type { CreateRecordPayload } from './types'

export type ModuleRuntime = {
  userId: string
  branchId: string | null
  branchName: string | null
  permissions: string[]
  isCrossBranch: boolean
  createRecord: (moduleId: string, values: CreateRecordPayload) => Promise<unknown>
}

export const ModuleRuntimeContext = createContext<ModuleRuntime | null>(null)
