import type { ReactNode } from 'react'
import { ApiError } from '@/services/api/errors'
import './query-state.css'

type QueryStateProps = {
  loading?: boolean
  error?: Error | null
  loadingMessage?: string
  errorTitle?: string
  className?: string
  onRetry?: () => void
  children?: ReactNode
}

export function QueryState({
  loading,
  error,
  loadingMessage = 'Loading records…',
  errorTitle = 'Could not load these records.',
  className = '',
  onRetry,
  children,
}: QueryStateProps) {
  if (loading)
    return (
      <div className={`query-state ${className}`} role="status" aria-live="polite">
        {loadingMessage}
      </div>
    )
  if (error)
    return (
      <div className={`query-state ${className}`} role="alert">
        <strong>{errorTitle}</strong>
        <span>{error.message}</span>
        {onRetry && (!(error instanceof ApiError) || error.retryable) && (
          <button className="button button-outline" type="button" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    )
  return children
}
