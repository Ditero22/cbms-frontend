export function FormOptionsState({
  loading,
  error,
  loadingText,
  onRetry,
}: {
  loading: boolean
  error?: string
  loadingText: string
  onRetry: () => void
}) {
  if (loading)
    return (
      <p className="form-helper" role="status">
        {loadingText}
      </p>
    )
  if (!error) return null
  return (
    <div className="field-error" role="alert">
      <p>{error}</p>
      <button type="button" className="button button-outline button-small" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
