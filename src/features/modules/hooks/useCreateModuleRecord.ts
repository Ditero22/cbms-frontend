import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createModuleRecord } from '../modules.api'
import type { CreateRecordPayload } from '../types'
import { invalidateMasterData } from './invalidateMasterData'

export function useCreateModuleRecord() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ moduleId, values }: { moduleId: string; values: CreateRecordPayload }) =>
      createModuleRecord(moduleId, values),
    onSuccess: async (_response, { moduleId }) => {
      if (['branches', 'employees', 'customers', 'suppliers', 'products'].includes(moduleId)) {
        await invalidateMasterData(queryClient, moduleId)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['module', moduleId] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })

      if (['branches', 'products', 'orders', 'inventory', 'transfers'].includes(moduleId)) {
        await queryClient.invalidateQueries({
          queryKey: ['module', 'inventory'],
        })
        await queryClient.invalidateQueries({
          queryKey: ['inventory-detail'],
        })
        await queryClient.invalidateQueries({
          queryKey: ['inventory-options'],
        })
        await queryClient.invalidateQueries({ queryKey: ['report'] })
      }

      if (moduleId === 'orders' || moduleId === 'payments') {
        await queryClient.invalidateQueries({ queryKey: ['module', 'payments'] })
        await queryClient.invalidateQueries({ queryKey: ['payment-options'] })
      }

      if (moduleId === 'payments') {
        await queryClient.invalidateQueries({ queryKey: ['module', 'orders'] })
      }

      if (moduleId === 'orders' || moduleId === 'deliveries') {
        await queryClient.invalidateQueries({ queryKey: ['delivery-options'] })
      }

      if (['orders', 'payments', 'deliveries'].includes(moduleId)) {
        await queryClient.invalidateQueries({ queryKey: ['order-detail'] })
      }
    },
  })
}
