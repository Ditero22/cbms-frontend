import type { RecordHistoryEntry } from '@/features/modules/types'
import './record-history.css'

export function RecordHistoryPanel({
  entries,
  page,
  pageSize,
  total,
  onPageChange,
  busy = false,
}: {
  entries: RecordHistoryEntry[]
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  busy?: boolean
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <section className="record-history" aria-label="Record history">
      <h3>Record history</h3>
      {entries.length ? (
        <ol className="record-history-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}</strong>
              <span>
                {entry.actorName || 'System'} ·{' '}
                {new Intl.DateTimeFormat('en-PH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(entry.createdAt))}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="form-helper">No recorded changes yet.</p>
      )}
      {pages > 1 && (
        <div className="record-history-pagination">
          <span aria-live="polite">
            Page {page} of {pages}
          </span>
          <div>
            <button
              type="button"
              className="button button-outline"
              disabled={busy || page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Newer
            </button>
            <button
              type="button"
              className="button button-outline"
              disabled={busy || page >= pages}
              onClick={() => onPageChange(page + 1)}
            >
              Older
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
