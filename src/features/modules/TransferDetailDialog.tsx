import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDialog } from '@/components/common/AppDialog'
import { StatusBadge } from '@/components/common/DataTable'
import { RecordHistoryPanel } from '@/components/common/RecordHistoryPanel'
import { getTransferDetail } from './modules.api'
import './transfer-detail.css'

type TransferDetailDialogProps = {
  transferId: string | null
  canReadAudit: boolean
  onClose: () => void
}

export function TransferDetailDialog({
  transferId,
  canReadAudit,
  onClose,
}: TransferDetailDialogProps) {
  const [historyPage, setHistoryPage] = useState(1)
  const detail = useQuery({
    queryKey: ['inventory-transfer-detail', transferId, historyPage],
    queryFn: () => getTransferDetail(transferId!, historyPage),
    enabled: Boolean(transferId),
  })
  const transfer = detail.data

  return (
    <AppDialog
      open={Boolean(transferId)}
      onOpenChange={(open) => !open && onClose()}
      title={transfer ? transfer.reference : 'Transfer details'}
      description="Completed stock movement between branches"
      size="wide"
    >
      {detail.isPending ? (
        <div className="employee-detail-state" role="status">
          Loading transfer details…
        </div>
      ) : detail.isError ? (
        <div className="employee-detail-state" role="alert">
          <strong>Could not load this transfer.</strong>
          <span>{detail.error.message}</span>
          <button
            type="button"
            className="button button-outline"
            onClick={() => void detail.refetch()}
          >
            Try again
          </button>
        </div>
      ) : transfer ? (
        <>
          <div className="employee-detail-overview">
            <div>
              <span className="employee-detail-eyebrow">Transfer reference</span>
              <strong>{transfer.reference}</strong>
              <span>Requested by {transfer.requestedByName || 'Unknown user'}</span>
            </div>
            <StatusBadge value={transfer.status} />
          </div>

          <section className="transfer-detail-section" aria-labelledby="transfer-route-title">
            <h3 id="transfer-route-title">Branch movement</h3>
            <dl className="transfer-detail-fields">
              <div>
                <dt>From</dt>
                <dd>{transfer.fromBranchName}</dd>
              </div>
              <div>
                <dt>To</dt>
                <dd>{transfer.toBranchName}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{formatDateTime(transfer.createdAt)}</dd>
              </div>
              <div>
                <dt>Items</dt>
                <dd>{transfer.items.length}</dd>
              </div>
            </dl>
          </section>

          <section className="transfer-detail-section" aria-labelledby="transfer-items-title">
            <h3 id="transfer-items-title">Transferred items</h3>
            {transfer.items.length ? (
              <ul className="transfer-detail-items">
                {transfer.items.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.productName}</strong>
                      <span>
                        {item.sku} · {item.unit}
                      </span>
                    </div>
                    <strong>
                      {item.quantity} {item.unit}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="form-helper">No item lines were recorded for this transfer.</p>
            )}
          </section>

          {transfer.note && (
            <section className="transfer-detail-section">
              <h3>Note</h3>
              <p className="transfer-detail-note">{transfer.note}</p>
            </section>
          )}

          {canReadAudit && (
            <RecordHistoryPanel
              entries={transfer.history}
              page={transfer.historyPage}
              pageSize={transfer.historyPageSize}
              total={transfer.historyTotal}
              onPageChange={setHistoryPage}
              busy={detail.isFetching}
            />
          )}
        </>
      ) : null}
    </AppDialog>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
