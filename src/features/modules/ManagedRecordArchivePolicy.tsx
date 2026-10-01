import type { ManagedRecordArchivePolicy as ArchivePolicy } from './types'
import './managed-record.css'

export function ManagedRecordArchivePolicy({ policy }: { policy: ArchivePolicy }) {
  const blockers = policy.dependencies.filter((dependency) => dependency.blockingCount > 0)

  return (
    <section
      className="managed-record-related record-archive-policy"
      aria-labelledby="record-archive-safety"
    >
      <div className="employee-detail-section-heading">
        <h3 id="record-archive-safety">Archive safety</h3>
      </div>
      <p className="form-helper">
        Permanent deletion is unavailable to protect business history. Archiving removes this record
        from active lists and preserves linked records, transactions, and audit history.
      </p>
      {blockers.length > 0 ? (
        <>
          <p className="form-helper">
            Resolve these active dependencies first. Stock, reservations, unfinished work, and
            unsettled payments prevent archiving.
          </p>
          <dl className="managed-record-fields" aria-label="Active archive dependencies">
            {blockers.map((dependency) => (
              <div key={dependency.key}>
                <dt>{dependency.label}</dt>
                <dd>{dependency.blockingCount}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="form-helper">No active dependencies currently prevent archiving.</p>
      )}
      {policy.dependencies.length > 0 && (
        <details>
          <summary>View retained record dependencies</summary>
          <dl className="managed-record-fields" aria-label="Retained record dependencies">
            {policy.dependencies.map((dependency) => (
              <div key={dependency.key}>
                <dt>{dependency.label}</dt>
                <dd>{dependency.count}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  )
}
