import type { ReactNode } from 'react'

export function FieldHeading({
  children,
  required = false,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <span>
      {children}
      {required && (
        <span className="required-mark" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </span>
  )
}
