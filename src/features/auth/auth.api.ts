import { ApiError, apiRequest } from '@/services/api/client'
import type { SessionResponse } from './types'
import { parseSessionResponse } from './auth.schema'

export async function getSession(signal?: AbortSignal) {
  try {
    return parseSessionResponse(await apiRequest<unknown>('/auth/me', { signal }))
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export async function signIn(email: string, password: string): Promise<SessionResponse> {
  const response = await apiRequest<unknown>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return parseSessionResponse(response)
}

export function signOut() {
  return apiRequest<void>('/auth/logout', { method: 'POST' })
}
