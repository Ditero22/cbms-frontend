import { useEffect } from 'react'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

/** Keep server validation beside the same controls as client validation. */
export function useServerValidation<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fields?: Record<string, string>,
) {
  useEffect(() => {
    for (const [field, message] of Object.entries(fields ?? {})) {
      setError(field as Path<T>, { type: 'server', message })
    }
  }, [fields, setError])
}
