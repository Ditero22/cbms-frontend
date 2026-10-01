import './record-history.css'

export function RecordPagination({
  label,
  page,
  pageSize,
  total,
  busy,
  onPageChange,
}: {
  label: string
  page: number
  pageSize: number
  total: number
  busy: boolean
  onPageChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav className="record-history-pagination" aria-label={label}>
      <span aria-live="polite">
        Page {page} of {pages} · {total} records
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
    </nav>
  )
}
