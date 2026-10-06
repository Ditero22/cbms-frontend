import { useId, type ReactNode } from 'react'
import { FieldHeading } from './FieldHeading'

type FieldAttributes = {
  id: string
  'aria-required': boolean
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

/** Explicit labels keep dropdown options and validation text out of the control's name. */
export function FormField({
  label,
  required = false,
  error,
  hint,
  width = 'full',
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  width?: 'xs' | 'sm' | 'md' | 'full'
  children: (attributes: FieldAttributes) => ReactNode
}) {
  const id = useId()
  return (
    <div className={`field-label field-${width}`}>
      <label htmlFor={id}>
        <FieldHeading required={required}>{label}</FieldHeading>
      </label>
      {children({
        id,
        'aria-required': required,
        'aria-invalid': Boolean(error),
        'aria-describedby':
          [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined,
      })}
      {hint && (
        <span className="form-helper" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
