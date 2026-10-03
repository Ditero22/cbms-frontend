import type { ReactNode } from 'react'

type PageHeadingProps = {
  eyebrow?: string
  title: string
  description: string
  className?: string
  children?: ReactNode
}

export function PageHeading({
  eyebrow,
  title,
  description,
  className,
  children,
}: PageHeadingProps) {
  return (
    <header className={`page-heading${className ? ` ${className}` : ''}`}>
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </header>
  )
}
