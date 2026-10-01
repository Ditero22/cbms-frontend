import { ApiError, invalidApiResponse, requestFailure } from './errors'

export { ApiError } from './errors'

const baseUrl = (import.meta.env.VITE_API_URL?.trim() || '/api/v1').replace(/\/+$/, '')
export const sessionExpiredEvent = 'cbms:session-expired'

function notifyExpiredSession(path: string, status: number) {
  if (status === 401 && path !== '/auth/login' && path !== '/auth/logout') {
    window.dispatchEvent(new Event(sessionExpiredEvent))
  }
}

function reportFailure(error: ApiError, method: string) {
  if (import.meta.env.DEV) {
    // Log transport metadata only: no bodies, credentials, query strings or customer data.
    console.warn('CBMS API request failed', {
      method,
      status: error.status,
      code: error.code,
      kind: error.kind,
    })
  }
  return error
}

async function request(path: string, init?: RequestInit) {
  const method = init?.method ?? 'GET'
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      credentials: 'include',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw reportFailure(
      new ApiError(
        'The backend could not be reached. Check your connection and try again.',
        0,
        'BACKEND_UNREACHABLE',
      ),
      method,
    )
  }
  if (!response.ok) {
    notifyExpiredSession(path, response.status)
    const payload: unknown = await response.json().catch(() => undefined)
    throw reportFailure(requestFailure(response.status, path, payload), method)
  }
  return response
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json')
  const response = await request(path, { ...init, headers })
  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/json' && !contentType?.endsWith('+json')) {
    throw reportFailure(invalidApiResponse(response.status), init?.method ?? 'GET')
  }
  try {
    return (await response.json()) as T
  } catch {
    throw reportFailure(invalidApiResponse(response.status), init?.method ?? 'GET')
  }
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await request(path)
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if (
    !contentType ||
    !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(contentType)
  ) {
    throw reportFailure(invalidApiResponse(response.status), 'GET')
  }
  return response.blob()
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  const response = await request(path)
  if (response.headers.get('content-type')?.includes('text/html'))
    throw reportFailure(invalidApiResponse(response.status), 'GET')
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
