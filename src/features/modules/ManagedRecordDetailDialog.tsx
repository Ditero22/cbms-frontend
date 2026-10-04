import { useQuery } from '@tanstack/react-query'
import { AppDialog } from '@/components/common/AppDialog'
import { StatusBadge } from '@/components/common/StatusBadge'
import { createFieldsByModule } from './create-fields'
import { getManagedRecord } from './modules.api'
import type { ManagedModuleId, ManagedRecord } from './types'
import { ManagedRecordArchivePolicy } from './ManagedRecordArchivePolicy'

type ManagedRecordDetailDialogProps = {
  moduleId: ManagedModuleId
  moduleTitle: string
  recordId: string | null
  canUpdate: boolean
  canReadAudit: boolean
  onClose: () => void
  onEdit: (record: ManagedRecord) => void
  onArchive: (record: ManagedRecord) => void
}

export function ManagedRecordDetailDialog({
  moduleId,
  moduleTitle,
  recordId,
  canUpdate,
  canReadAudit,
  onClose,
  onEdit,
  onArchive,
}: ManagedRecordDetailDialogProps) {
  const recordQuery = useQuery({
    queryKey: ['managed-record', moduleId, recordId],
    queryFn: () => getManagedRecord(moduleId, recordId!),
    enabled: Boolean(recordId),
  })
  const record = recordQuery.data
  const name = record ? String(record.name ?? moduleTitle) : `${moduleTitle} details`
  const subtitle = record ? getSubtitle(moduleId, record) : undefined

  return (
    <AppDialog
      open={Boolean(recordId)}
      onOpenChange={(open) => !open && onClose()}
      title={name}
      description={subtitle}
      size="md"
    >
      {recordQuery.isPending ? (
        <div className="employee-detail-state" role="status">
          Loading record details…
        </div>
      ) : recordQuery.isError ? (
        <div className="employee-detail-state" role="alert">
          <strong>Could not load this record.</strong>
          <span>{recordQuery.error.message}</span>
          <button className="button button-outline" onClick={() => void recordQuery.refetch()}>
            Try again
          </button>
        </div>
      ) : record ? (
        <>
          <div className="managed-record-status">
            <StatusBadge value={record.status} />
          </div>
          <section className="employee-detail-section" aria-label="Record information">
            <dl className="managed-record-fields">
              {moduleId === 'customers' && (
                <div>
                  <dt>Branch</dt>
                  <dd>{String(record.branchName ?? 'Unassigned')}</dd>
                </div>
              )}
              {createFieldsByModule[moduleId].map((field) => (
                <div key={field.name}>
                  <dt>{field.label}</dt>
                  <dd>{formatFieldValue(field.name, record)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <RelatedRecords moduleId={moduleId} record={record} />
          {record.archivePolicy && <ManagedRecordArchivePolicy policy={record.archivePolicy} />}
          {canReadAudit && (
            <section className="employee-history" aria-labelledby="managed-record-history">
              <div className="employee-detail-section-heading">
                <h3 id="managed-record-history">Recent history</h3>
              </div>
              {record.history.length ? (
                <ol className="employee-history-list">
                  {record.history.map((entry) => (
                    <li key={entry.id}>
                      <div className="employee-history-marker" aria-hidden="true" />
                      <div>
                        <strong>{sentenceCase(entry.action)}</strong>
                        <span>
                          {entry.actorName || 'System'} · {formatDateTime(entry.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="employee-history-empty">
                  No audit history is available for this record.
                </p>
              )}
            </section>
          )}
          <div className="managed-record-metadata">
            Created {formatDateTime(record.createdAt)} · Updated {formatDateTime(record.updatedAt)}
          </div>
          <div className="dialog-actions">
            {canUpdate && (
              <>
                <button className="button button-outline" onClick={() => onArchive(record)}>
                  Archive
                </button>
                <button className="button button-primary" onClick={() => onEdit(record)}>
                  Edit {singularName(moduleId)}
                </button>
              </>
            )}
          </div>
        </>
      ) : null}
    </AppDialog>
  )
}

function RelatedRecords({
  moduleId,
  record,
}: {
  moduleId: ManagedModuleId
  record: ManagedRecord
}) {
  const related = record.related ?? {}
  const counts = [
    ['Employees', related.employeeCount],
    ['Products stocked', related.stockedProductCount],
    ['Orders', related.orderCount],
    ['Products supplied', related.productCount],
  ] as const
  const visibleCounts = record.archivePolicy
    ? []
    : counts.filter(([, count]) => count !== undefined)
  const inventory = moduleId === 'products' ? related.inventory : undefined
  if (!visibleCounts.length && !inventory) return null

  return (
    <section className="managed-record-related" aria-labelledby="managed-record-related-title">
      <div className="employee-detail-section-heading">
        <h3 id="managed-record-related-title">Related data</h3>
      </div>
      {visibleCounts.length > 0 && (
        <dl className="managed-related-counts">
          {visibleCounts.map(([label, count]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
      )}
      {inventory &&
        (inventory.length ? (
          <div className="managed-inventory-list">
            {inventory.map((item) => (
              <div key={item.branchId}>
                <strong>{item.branchName}</strong>
                <span>
                  {item.quantity} on hand · reorder at {item.reorderLevel}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="employee-history-empty">No branch inventory is available.</p>
        ))}
    </section>
  )
}

function getSubtitle(moduleId: ManagedModuleId, record: ManagedRecord) {
  if (moduleId === 'branches') return `Code ${record.code}`
  if (moduleId === 'products') return `SKU ${record.sku}`
  return undefined
}

function formatFieldValue(fieldName: string, record: ManagedRecord) {
  if (fieldName === 'supplierId') return String(record.supplierName ?? '—')
  const value = record[fieldName]
  if (value === null || value === undefined || value === '') return '—'
  if (fieldName === 'unitPrice') {
    const amount = Number(value)
    return Number.isFinite(amount)
      ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(amount)
      : String(value)
  }
  return String(value)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function singularName(moduleId: ManagedModuleId) {
  return {
    branches: 'branch',
    customers: 'customer',
    suppliers: 'supplier',
    products: 'product',
  }[moduleId]
}
