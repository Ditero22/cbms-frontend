import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sessionExpiredEvent } from '@/services/api/client'
import type { SessionResponse } from '../types'
import { getSession, signIn, signOut } from '../auth.api'
import {
  clearProtectedQueries,
  prepareSession,
  sessionAccessKey,
  sessionQueryKey,
} from '../session-cache'

export function useSession() {
  const queryClient = useQueryClient()
  const sessionQuery = useQuery({
    queryKey: sessionQueryKey,
    queryFn: async () => prepareSession(queryClient, await getSession()),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const userId = sessionQuery.data?.user?.id
    if (userId) window.localStorage.setItem('cbms-last-user-id', userId)
  }, [sessionQuery.data?.user?.id])

  useEffect(() => {
    function clearExpiredSession() {
      if (queryClient.getQueryData<SessionResponse | null>(sessionQueryKey)?.user) {
        toast.info('Your session has expired. Sign in again.')
      }
      queryClient.setQueryData<SessionResponse | null>(sessionQueryKey, null)
      void clearProtectedQueries(queryClient)
    }

    window.addEventListener(sessionExpiredEvent, clearExpiredSession)
    return () => window.removeEventListener(sessionExpiredEvent, clearExpiredSession)
  }, [queryClient])

  async function login(email: string, password: string) {
    const response = await signIn(email, password)
    await prepareSession(queryClient, response)
    window.localStorage.setItem('cbms-last-user-id', response.user.id)
    queryClient.setQueryData(sessionQueryKey, response)
  }

  async function logout() {
    await signOut()
    queryClient.setQueryData<SessionResponse | null>(sessionQueryKey, null)
    await clearProtectedQueries(queryClient)
  }

  const user = sessionQuery.data?.user ?? null
  return { sessionQuery, user, accessKey: sessionAccessKey(user), login, logout }
}
