import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDialog } from '@/components/common/AppDialog'
import { StatusBadge } from '@/components/common/DataTable'
import { getEmployeeDetail } from './modules.api'
import type { EmployeeHistoryEntry, EmployeeRecord } from './types'

type EmployeeDetailDialogProps = {
  employeeId: string | null
  onClose: () => void
  onEdit: (employee: EmployeeRecord) => void
  onArchive: (employee: EmployeeRecord) => void
  canUpdate: boolean
  canReadAudit?: boolean
}

export function EmployeeDetailDialog({
  employeeId,
  onClose,
  onEdit,
  onArchive,
  canUpdate,
  canReadAudit = false,
}: EmployeeDetailDialogProps) {
  const [historyPage, setHistoryPage] = useState(1)
  const detailQuery = useQuery({
    queryKey: ['employee-detail', employeeId, historyPage],
    queryFn: () => getEmployeeDetail(employeeId!, historyPage),
    enabled: Boolean(employeeId),
  })
  const employee = detailQuery.data?.employee

  return (
    <AppDialog
      open={Boolean(employeeId)}
      onOpenChange={(open) => !open && onClose()}
      title={employee?.name ?? 'Employee details'}
      description={
        employee ? `Employee ID ${employee.employeeNumber}` : 'Employee record and history'
      }
      size="wide"
    >
      {detailQuery.isPending ? (
        <div className="employee-detail-state" role="status">
          Loading employee details…
        </div>
      ) : detailQuery.isError ? (
        <div className="employee-detail-state" role="alert">
          <strong>Could not load this employee.</strong>
          <span>{detailQuery.error.message}</span>
          <button className="button button-outline" onClick={() => void detailQuery.refetch()}>
            Try again
          </button>
        </div>
      ) : employee ? (
        <>
          <div className="employee-detail-overview">
            <div>
              <span className="employee-detail-eyebrow">Position</span>
              <strong>{employee.position}</strong>
              <span>{employee.branchName}</span>
            </div>
            <StatusBadge value={employee.archivedAt ? 'Archived' : employee.status} />
          </div>

          <div className="employee-detail-sections">
            <DetailSection
              title="Employment"
              fields={[
                ['Employee ID', employee.employeeNumber],
                ['Position', employee.position],
                ['Branch', employee.branchName],
                ['Hire date', formatDateOnly(employee.hiredAt)],
              ]}
            />
            <DetailSection
              title="Contact"
              fields={[
                ['Email', employee.email],
                ['Phone', employee.phone],
                ['Address', employee.address],
                ['Emergency contact name', employee.emergencyContactName],
                ['Emergency contact phone', employee.emergencyContactPhone],
              ]}
            />
          </div>

          {employee.isDriver && (
            <section className="employee-detail-section employee-driver-details">
              <div className="employee-detail-section-heading">
                <h3>Driver information</h3>
                <StatusBadge value={employee.driverAvailability} />
              </div>
              <dl className="managed-record-fields">
                <div>
                  <dt>License number</dt>
                  <dd>{employee.licenseNumber || '—'}</dd>
                </div>
                <div>
                  <dt>Classification / restrictions</dt>
                  <dd>{employee.licenseClassification || '—'}</dd>
                </div>
                <div>
                  <dt>License expiration</dt>
                  <dd>{formatDateOnly(employee.licenseExpiresOn)}</dd>
                </div>
              </dl>
            </section>
          )}
          {employee.notes && (
            <section className="employee-detail-section">
              <div className="employee-detail-section-heading">
                <h3>Notes</h3>
              </div>
              <p>{employee.notes}</p>
            </section>
          )}

          {canReadAudit && (
            <section className="employee-history" aria-labelledby="employee-history-title">
              <div className="employee-detail-section-heading">
                <h3 id="employee-history-title">Record history</h3>
                <span>Changes saved in the audit log</span>
              </div>
              {detailQuery.data.history.length ? (
                <ol className="employee-history-list">
                  {detailQuery.data.history.map((entry) => (
                    <HistoryItem key={entry.id} entry={entry} />
                  ))}
                </ol>
              ) : (
                <p className="employee-history-empty">
                  No audit history is available for this record.
                </p>
              )}
              {detailQuery.data.historyTotal > detailQuery.data.historyPageSize && (
                <div className="employee-history-pagination">
                  <span>
                    Page {detailQuery.data.historyPage} of{' '}
                    {Math.ceil(detailQuery.data.historyTotal / detailQuery.data.historyPageSize)}
                  </span>
                  <div>
                    <button
                      className="button button-outline"
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage((page) => page - 1)}
                    >
                      Newer
                    </button>
                    <button
                      className="button button-outline"
                      disabled={
                        historyPage * detailQuery.data.historyPageSize >=
                        detailQuery.data.historyTotal
                      }
                      onClick={() => setHistoryPage((page) => page + 1)}
                    >
                      Older
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
          <div className="dialog-actions">
            <button className="button button-outline" onClick={onClose}>
              Close
            </button>
            {canUpdate && !employee.archivedAt && (
              <>
                <button className="button button-outline" onClick={() => onArchive(employee)}>
                  Archive employee
                </button>
                <button className="button button-primary" onClick={() => onEdit(employee)}>
                  Edit employee
                </button>
              </>
            )}
          </div>
        </>
      ) : null}
    </AppDialog>
  )
}

function DetailSection({ title, fields }: { title: string; fields: [string, string | null][] }) {
  return (
    <section className="employee-detail-section">
      <div className="employee-detail-section-heading">
        <h3>{title}</h3>
      </div>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function HistoryItem({ entry }: { entry: EmployeeHistoryEntry }) {
  const changedFields = getChangedFields(entry)
  return (
    <li>
      <div className="employee-history-marker" aria-hidden="true" />
      <div>
        <strong>{humanizeAction(entry.action)}</strong>
        <span>
          {entry.actorName || 'System'} · {formatDateTime(entry.createdAt)}
        </span>
        {changedFields.length > 0 && <p>Changed: {changedFields.join(', ')}</p>}
      </div>
    </li>
  )
}

const historyFieldNames: Record<string, string> = {
  employeeNumber: 'Employee ID',
  name: 'name',
  position: 'position',
  branchId: 'branch',
  email: 'email',
  phone: 'phone',
  hiredAt: 'hire date',
  status: 'status',
  address: 'address',
  isDriver: 'driver capability',
  licenseNumber: 'license number',
  licenseClassification: 'license classification',
  licenseExpiresOn: 'license expiration',
  driverAvailability: 'availability',
  emergencyContactName: 'emergency contact name',
  emergencyContactPhone: 'emergency contact phone',
  notes: 'notes',
}

function getChangedFields(entry: EmployeeHistoryEntry) {
  if (!entry.oldValue || !entry.newValue) return []
  return Object.entries(historyFieldNames)
    .filter(
      ([key]) => JSON.stringify(entry.oldValue?.[key]) !== JSON.stringify(entry.newValue?.[key]),
    )
    .map(([, label]) => label)
}

function humanizeAction(action: string) {
  return action.charAt(0).toUpperCase() + action.slice(1)
}

function formatDateOnly(value: string | null) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
