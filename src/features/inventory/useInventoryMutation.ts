import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function useInventoryMutation() {
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
          ['module', 'inventory'],
          ['inventory-detail'],
          ['inventory-options'],
          ['dashboard-summary'],
          ['report'],
          ['module', 'orders'],
          ['order-detail'],
          ['order-options'],
          ['module', 'deliveries'],
          ['delivery-options'],
          ['module', 'transfers'],
          ['transfer-options'],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      toast.success(message)
      return true
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Stock could not be updated.'
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
