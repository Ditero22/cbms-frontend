import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useFleetMutation() {
  const queryClient = useQueryClient()
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(action: () => Promise<unknown>, message: string) {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
      await Promise.all(
        [
          ['module', 'vehicles'],
          ['vehicle-detail'],
          ['maintenance-detail'],
          ['assignment-detail'],
          ['fleet-options'],
          ['allowance-options'],
          ['driver-allowance-detail'],
          ['module', 'driver-allowances'],
          ['module', 'deliveries'],
          ['delivery-options'],
          ['employee-detail'],
          ['module', 'expenses'],
          ['expense-detail'],
          ['expense-options'],
          ['dashboard-summary'],
          ['report'],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      toast.success(message)
      return true
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The record could not be saved.'
      setError(message)
      toast.error(message)
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return { busy, error, run, clearError: () => setError(null) }
}
