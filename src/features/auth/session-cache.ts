import type { QueryClient } from '@tanstack/react-query'
import type { AuthenticatedUser, SessionResponse } from './types'

export const sessionQueryKey = ['session'] as const

/** Access changes must discard both protected data and drafts from the previous scope. */
export function sessionAccessKey(user: AuthenticatedUser | null | undefined) {
  return user
    ? JSON.stringify([
        user.id,
        user.branchId,
        user.isCrossBranch,
        user.role,
        [...user.permissions].sort(),
      ])
    : 'anonymous'
}

export async function clearProtectedQueries(client: QueryClient) {
  const protectedQueries = {
    predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== 'session',
  }
  // Cancel before removal so a request started by the previous account cannot restore its data.
  await client.cancelQueries(protectedQueries)
  client.removeQueries(protectedQueries)
}

/** Reconcile before publishing the new session, never in a post-render effect. */
export async function prepareSession(client: QueryClient, next: SessionResponse | null) {
  const previous = client.getQueryData<SessionResponse | null>(sessionQueryKey)
  if (sessionAccessKey(previous?.user) !== sessionAccessKey(next?.user)) {
    await clearProtectedQueries(client)
  }
  return next
}
