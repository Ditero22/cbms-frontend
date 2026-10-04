import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDialog } from '@/components/common/AppDialog'
import { StatusBadge } from '@/components/common/StatusBadge'
import { RecordHistoryPanel } from '@/components/common/RecordHistoryPanel'
import { formatQuantity } from '@/features/modules/order-decimals'
import { getInventoryDetail } from './inventory.api'
import { QueryState } from '@/components/common/QueryState'
import { StockMovementLedger } from './StockMovementLedger'
import type { InventoryDetailFilters, InventoryRecord } from './types'

export function InventoryDetailDialog({
  id,
  open,
  permissions,
  onClose,
  onAdjust,
  onReorder,
  onCorrect,
}: {
  id: string
  open: boolean
  permissions: string[]
  onClose: () => void
  onAdjust: (inventory: InventoryRecord) => void
  onReorder: (inventory: InventoryRecord) => void
  onCorrect: (inventory: InventoryRecord, addition: { id: string; quantity: string }) => void
}) {
  const [filters, setFilters] = useState<InventoryDetailFilters>({
    movementPage: 1,
    movementType: '',
    dateFrom: '',
    dateTo: '',
    historyPage: 1,
  })
  const query = useQuery({
    queryKey: ['inventory-detail', id, filters],
    queryFn: () => getInventoryDetail(id, filters),
    placeholderData: (previous) => previous,
  })
  const inventory = query.data?.inventory
  const activeTarget = inventory?.productStatus === 'Active' && inventory?.branchStatus === 'Active'
  const canAdjust = permissions.includes('inventory.adjust') && activeTarget
  const canReorder = permissions.includes('inventory.reorder') && activeTarget
  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={inventory?.productName ?? 'Inventory details'}
      description={
        inventory
          ? `${inventory.sku} · ${inventory.branchName} · ${inventory.unit}`
          : 'Branch quantities and recorded stock movements'
      }
      size="lg"
    >
      <QueryState
        loadingMessage="Loading inventory…"
        errorTitle="Could not load inventory."
        loading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      >
        {inventory && query.data && (
          <>
            <div className="inventory-overview">
              <strong>{inventory.branchName}</strong>
              <StatusBadge value={inventory.status} />
            </div>
            <dl className="inventory-summary">
              {[
                ['On hand', inventory.quantity],
                ['Reserved', inventory.reservedQuantity],
                ['Available', inventory.availableQuantity],
                ['Reorder point', inventory.reorderLevel],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {formatQuantity(value)} <small>{inventory.unit}</small>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="form-helper">
              On hand is physical stock at this branch. Reserved stock is committed to open orders;
              available stock is on hand minus reservations.
            </p>
            {(inventory.productStatus !== 'Active' || inventory.branchStatus !== 'Active') && (
              <p className="form-helper">
                This product or branch is inactive. Its stock and recorded movements remain
                available for review.
              </p>
            )}
            <div className="inventory-detail-actions">
              {canAdjust && query.data.latestAddition && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => onCorrect(inventory, query.data!.latestAddition!)}
                >
                  Correct latest addition
                </button>
              )}
              {canAdjust && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => onAdjust(inventory)}
                >
                  Adjust this stock
                </button>
              )}
              {canReorder && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => onReorder(inventory)}
                >
                  Edit reorder point
                </button>
              )}
            </div>
            <StockMovementLedger
              detail={query.data}
              filters={filters}
              busy={query.isFetching}
              onChange={setFilters}
            />
            {permissions.includes('audit.read') && (
              <RecordHistoryPanel
                entries={query.data.history}
                page={query.data.historyPage}
                pageSize={query.data.historyPageSize}
                total={query.data.historyTotal}
                busy={query.isFetching}
                onPageChange={(historyPage) =>
                  setFilters((current) => ({ ...current, historyPage }))
                }
              />
            )}
          </>
        )}
      </QueryState>
    </AppDialog>
  )
}
