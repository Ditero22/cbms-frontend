import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/services/api/client'

export function useExpenseMutation() {
  const queryClient = useQueryClient()
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const refresh = () =>
    Promise.all(
      [
        ['module', 'expenses'],
        ['expense-detail'],
        ['expense-options'],
        ['dashboard-summary'],
        ['report'],
        ['maintenance-detail'],
        ['driver-allowance-detail'],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )

  async function run(action: () => Promise<unknown>, message: string) {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError(null)
    setAlreadyReviewed(false)
    try {
      await action()
      await refresh()
      toast.success(message)
      return true
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The expense could not be saved.'
      setError(message)
      if (reason instanceof ApiError && reason.status === 409) {
        setAlreadyReviewed(reason.code === 'EXPENSE_ALREADY_REVIEWED')
        await refresh()
      }
      toast.error(message)
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return {
    busy,
    error,
    alreadyReviewed,
    run,
    clearError: () => {
      setError(null)
      setAlreadyReviewed(false)
    },
  }
}
