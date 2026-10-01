import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/common/DataTable'
import { QueryState } from '@/components/common/QueryState'
import { DriverAllowanceDetailDialog } from '@/features/driver-allowances/DriverAllowanceDetailDialog'
import { getModuleRecords } from '@/features/modules/modules.api'
import { modules } from '@/features/modules/modules'
import type { ModuleListQuery } from '@/features/modules/types'
import { useModuleRuntime } from '@/features/modules/useModuleRuntime'

const legacyModule = {
  ...modules.find((module) => module.id === 'driver-allowances')!,
  title: 'Legacy allowances',
}

export function LegacyAllowanceLedger() {
  const runtime = useModuleRuntime()
  const [query, setQuery] = useState<ModuleListQuery>({
    page: 1,
    limit: 25,
    search: '',
    status: '',
    sort: '',
    order: 'asc',
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const records = useQuery({
    queryKey: ['module', 'driver-allowances', query],
    queryFn: () => getModuleRecords('driver-allowances', query),
    placeholderData: (previous) => previous,
  })
  return (
    <>
      <p className="payroll-note">
        Historical driver allowances are retained with their expenses, proof, and receipt history.
        Record new allowances as employee pay adjustments in a pay run.
      </p>
      <QueryState
        loading={records.isPending}
        error={records.error}
        onRetry={() => void records.refetch()}
      >
        <DataTable
          module={legacyModule}
          rows={records.data?.data ?? []}
          total={records.data?.total ?? 0}
          statusOptions={records.data?.statusOptions ?? []}
          query={query}
          onQueryChange={setQuery}
          onRowClick={(row) => setSelectedId(row.id)}
          busy={records.isFetching}
        />
      </QueryState>
      {selectedId && (
        <DriverAllowanceDetailDialog
          id={selectedId}
          permissions={runtime.permissions}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  )
}
