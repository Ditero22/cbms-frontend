import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RecordHistoryPanel } from '@/components/common/RecordHistoryPanel'
import { getRoleDetail } from './modules.api'

export function RoleHistoryPanel({ roleId }: { roleId: string }) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['role-detail', roleId, page],
    queryFn: () => getRoleDetail(roleId, page),
  })

  if (query.isPending)
    return (
      <p className="role-loading-state" role="status">
        Loading role history…
      </p>
    )
  if (query.isError)
    return (
      <div className="field-error" role="alert">
        Role history could not be loaded. {query.error.message}
        <button
          type="button"
          className="button button-quiet button-small"
          onClick={() => void query.refetch()}
        >
          Try again
        </button>
      </div>
    )
  return (
    <RecordHistoryPanel
      entries={query.data.history}
      page={query.data.historyPage}
      pageSize={query.data.historyPageSize}
      total={query.data.historyTotal}
      onPageChange={setPage}
      busy={query.isFetching}
    />
  )
}
