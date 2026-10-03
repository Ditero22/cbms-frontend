import { Link } from 'react-router-dom'

export type BreadcrumbItem = {
  label: string
  to?: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  // The page heading already names the current location. Keep breadcrumbs focused on the
  // navigable path so the current title is not repeated immediately before the page heading.
  const visibleItems = items.length > 1 && !items.at(-1)?.to ? items.slice(0, -1) : items

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {visibleItems.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {index > 0 && (
              <span className="breadcrumb-separator" aria-hidden="true">
                /
              </span>
            )}
            {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
