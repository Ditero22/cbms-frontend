import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sessionExpiredEvent } from '@/services/api/client'
import type { SessionResponse } from '../types'
import { getSession, signIn, signOut } from '../auth.api'

export const sessionQueryKey = ['session'] as const

export function useSession() {
  const queryClient = useQueryClient()
  const sessionQuery = useQuery({
    queryKey: sessionQueryKey,
    queryFn: getSession,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    function clearExpiredSession() {
      if (queryClient.getQueryData<SessionResponse | null>(sessionQueryKey)?.user) {
        toast.info('Your session has expired. Sign in again.')
      }
      queryClient.setQueryData<SessionResponse | null>(sessionQueryKey, null)
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
    }

    window.addEventListener(sessionExpiredEvent, clearExpiredSession)
    return () => window.removeEventListener(sessionExpiredEvent, clearExpiredSession)
  }, [queryClient])

  async function login(email: string, password: string) {
    const response = await signIn(email, password)
    queryClient.setQueryData(sessionQueryKey, response)
  }

  async function logout() {
    await signOut()
    queryClient.setQueryData<SessionResponse | null>(sessionQueryKey, null)
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
  }

  return { sessionQuery, user: sessionQuery.data?.user ?? null, login, logout }
}
