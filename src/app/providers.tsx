import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppToaster } from '@/components/common/AppToaster'
import { DialogWorkflowProvider } from '@/components/common/DialogWorkflow'
import { ApiError } from '@/services/api/errors'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        failureCount < 1 && (!(error instanceof ApiError) || error.retryable),
      refetchOnWindowFocus: false,
    },
  },
})

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <DialogWorkflowProvider>{children}</DialogWorkflowProvider>
      <AppToaster />
    </QueryClientProvider>
  )
}
