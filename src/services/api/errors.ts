export type ApiFailureKind =
  | 'unavailable'
  | 'unauthorized'
  | 'forbidden'
  | 'server'
  | 'invalid-response'
  | 'rate-limit'
  | 'request'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly kind: ApiFailureKind = failureKind(status),
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get retryable() {
    return ['unavailable', 'server', 'invalid-response', 'rate-limit'].includes(this.kind)
  }
}

function failureKind(status: number): ApiFailureKind {
  if (status === 0 || status === 502 || status === 503 || status === 504) return 'unavailable'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 429) return 'rate-limit'
  if (status >= 500) return 'server'
  return 'request'
}

export function invalidApiResponse(status = 200) {
  return new ApiError(
    'The server returned an invalid response. Try again; if this continues, contact your administrator.',
    status,
    'INVALID_RESPONSE',
    'invalid-response',
  )
}

export function requestFailure(status: number, path: string, payload: unknown) {
  const error =
    payload && typeof payload === 'object' && 'error' in payload ? payload.error : undefined
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : undefined

  if (status === 401)
    return new ApiError(
      path === '/auth/login'
        ? (message ?? 'Sign-in failed. Check your email and password.')
        : 'Your session has expired. Sign in again.',
      status,
      code,
    )
  if (status === 403)
    return new ApiError('You do not have permission to access this information.', status, code)
  if (status === 503 && code === 'DATABASE_MIGRATIONS_REQUIRED')
    return new ApiError(
      'The workspace database needs an update. Ask your administrator to apply the pending migrations.',
      status,
      code,
    )
  if (status === 502 || status === 503 || status === 504)
    return new ApiError(
      'The service is temporarily unavailable. Please try again shortly.',
      status,
      code,
    )
  if (status >= 500)
    return new ApiError(
      'The server could not complete this request. Please try again.',
      status,
      code,
    )
  if (status === 429)
    return new ApiError(
      'Too many requests. Please wait a moment before trying again.',
      status,
      code,
    )
  if (status === 404)
    return new ApiError(message ?? 'The requested information could not be found.', status, code)
  const fieldErrors: Record<string, string> = {}
  if (code === 'VALIDATION_ERROR' && error && typeof error === 'object' && 'details' in error) {
    const details = error.details
    if (
      details &&
      typeof details === 'object' &&
      'fieldErrors' in details &&
      details.fieldErrors &&
      typeof details.fieldErrors === 'object'
    ) {
      for (const [field, messages] of Object.entries(details.fieldErrors)) {
        if (Array.isArray(messages) && typeof messages[0] === 'string')
          fieldErrors[field] = messages[0]
      }
    }
  }
  return new ApiError(
    message ?? 'The request could not be completed.',
    status,
    code,
    failureKind(status),
    fieldErrors,
  )
}

export function validationFields(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fieldErrors : {}
}
