/** Stable list and history shapes shared by feature APIs and presentation components. */
export type RecordRow = Record<string, string>

export type ModuleListQuery = {
  page: number
  limit: number
  search: string
  branchId?: string
  status: string
  sort: string
  order: 'asc' | 'desc'
}

export type ModuleRecordResponse = {
  data: RecordRow[]
  total: number
  page: number
  limit: number
  statusOptions: string[]
}

export type RecordHistoryEntry = {
  id: string
  action: string
  actorName: string | null
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  createdAt: string
}
