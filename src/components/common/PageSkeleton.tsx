import './loading.css'

type PageSkeletonProps = {
  title: string
  description?: string
  actionLabel?: string
}

export function PageSkeleton({ title, description, actionLabel }: PageSkeletonProps) {
  return (
    <section
      className="page-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`Loading ${title}`}
    >
      <span className="sr-only">Loading {title}…</span>
      <div className="page-skeleton-heading" aria-hidden="true">
        <div className="page-skeleton-title-group">
          <span className="skeleton-block skeleton-title" />
          {description && <span className="skeleton-block skeleton-description" />}
        </div>
        {actionLabel && <span className="skeleton-block skeleton-action" />}
      </div>

      <div className="page-skeleton-tools" aria-hidden="true">
        <span className="skeleton-block skeleton-search" />
        <span className="skeleton-block skeleton-filter" />
        <span className="skeleton-block skeleton-sort" />
        <span className="skeleton-block skeleton-export" />
      </div>

      <div className="page-skeleton-table" aria-hidden="true">
        <span className="skeleton-block skeleton-table-heading" />
        {Array.from({ length: 3 }, (_, index) => (
          <span className="skeleton-block skeleton-table-row" key={index} />
        ))}
      </div>

      <div className="page-skeleton-cards" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="page-skeleton-card" key={index}>
            <span className="skeleton-card-top">
              <span className="skeleton-block skeleton-card-heading" />
              <span className="skeleton-block skeleton-card-status" />
            </span>
            {Array.from({ length: title === 'Deliveries' ? 4 : 3 }, (_, fieldIndex) => (
              <span className="skeleton-block skeleton-card-field" key={fieldIndex} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
