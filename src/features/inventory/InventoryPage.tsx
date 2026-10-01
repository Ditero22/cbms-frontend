import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { DataTable } from '@/components/common/DataTable'
import { PageHeading } from '@/components/common/PageHeading'
import { getModuleRecords, getInventoryOptions } from '@/features/modules/modules.api'
import { modules } from '@/features/modules/modules'
import type { ModuleListQuery } from '@/features/modules/types'
import { useModuleRuntime } from '@/features/modules/useModuleRuntime'
import { adjustStock, updateReorderPoint, correctStockAddition } from './inventory.api'
import { StockCorrectionDialog } from './StockCorrectionDialog'
import { InventoryDetailDialog } from './InventoryDetailDialog'
import { QueryState } from '@/components/common/QueryState'
import { ReorderPointDialog } from './ReorderPointDialog'
import { StockAdjustmentDialog } from './StockAdjustmentDialog'
import { useInventoryMutation } from './useInventoryMutation'
import type { InventoryRecord } from './types'
import './inventory.css'

const module = modules.find((candidate) => candidate.id === 'inventory')!

export function InventoryPage() {
  const runtime = useModuleRuntime()
  const mutation = useInventoryMutation()
  const [query, setQuery] = useState<ModuleListQuery>({
    page: 1,
    limit: 25,
    search: '',
    status: '',
    sort: '',
    order: 'asc',
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const [adjustmentInventory, setAdjustmentInventory] = useState<InventoryRecord | null>(null)
  const [reorderInventory, setReorderInventory] = useState<InventoryRecord | null>(null)
  const [correction, setCorrection] = useState<{
    inventory: InventoryRecord
    addition: { id: string; quantity: string }
  } | null>(null)
  const options = useQuery({
    queryKey: ['inventory-options'],
    queryFn: getInventoryOptions,
    enabled: runtime.isCrossBranch,
  })
  const records = useQuery({
    queryKey: ['module', 'inventory', query],
    queryFn: () => getModuleRecords('inventory', query),
    placeholderData: (previous) => previous,
  })

  function openAdjustment(inventory: InventoryRecord | null) {
    mutation.clearError()
    setAdjustmentInventory(inventory)
    setAdjustmentOpen(true)
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/dashboard' },
          { label: 'Operations' },
          { label: 'Inventory' },
        ]}
      />
      <PageHeading title={module.title} description={module.description}>
        {runtime.permissions.includes('inventory.adjust') && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => openAdjustment(null)}
          >
            <Plus size={16} aria-hidden="true" />
            Adjust stock
          </button>
        )}
      </PageHeading>
      {runtime.isCrossBranch && options.isError && (
        <p className="form-error" role="alert">
          Could not load branch filters.{' '}
          <button
            type="button"
            className="button button-outline"
            onClick={() => void options.refetch()}
          >
            Retry filters
          </button>
        </p>
      )}
      <QueryState
        loadingMessage="Loading inventory…"
        errorTitle="Could not load inventory."
        loading={records.isPending}
        error={records.error}
        onRetry={() => void records.refetch()}
      >
        <DataTable
          module={module}
          rows={records.data?.data ?? []}
          total={records.data?.total ?? 0}
          statusOptions={records.data?.statusOptions ?? []}
          query={query}
          onQueryChange={setQuery}
          onRowClick={(row) => setSelectedId(row.id)}
          busy={records.isFetching}
          isCrossBranch={runtime.isCrossBranch}
          branchOptions={
            options.data?.branches.map((branch) => ({ value: branch.id, label: branch.name })) ?? []
          }
        />
      </QueryState>
      {selectedId && (
        <InventoryDetailDialog
          key={selectedId}
          id={selectedId}
          open={!adjustmentOpen && !reorderInventory && !correction}
          permissions={runtime.permissions}
          onClose={() => setSelectedId(null)}
          onAdjust={openAdjustment}
          onCorrect={(inventory, addition) => {
            mutation.clearError()
            setCorrection({ inventory, addition })
          }}
          onReorder={(inventory) => {
            mutation.clearError()
            setReorderInventory(inventory)
          }}
        />
      )}
      <StockAdjustmentDialog
        open={adjustmentOpen}
        inventory={adjustmentInventory}
        busy={mutation.busy}
        error={mutation.error}
        onClose={() => setAdjustmentOpen(false)}
        onSave={(values) => mutation.run(() => adjustStock(values), 'Stock adjustment recorded.')}
      />
      {reorderInventory && (
        <ReorderPointDialog
          inventory={reorderInventory}
          busy={mutation.busy}
          error={mutation.error}
          onClose={() => setReorderInventory(null)}
          onSave={(value) =>
            mutation.run(
              () => updateReorderPoint(reorderInventory.id, value),
              'Reorder point updated.',
            )
          }
        />
      )}
      {correction && (
        <StockCorrectionDialog
          inventory={correction.inventory}
          addition={correction.addition}
          busy={mutation.busy}
          error={mutation.error}
          onClose={() => setCorrection(null)}
          onSave={(values) =>
            mutation.run(
              () => correctStockAddition(correction.inventory.id, values),
              'Stock addition corrected.',
            )
          }
        />
      )}
    </>
  )
}
