import { useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { DataTable } from '@/components/common/DataTable'
import { PageHeading } from '@/components/common/PageHeading'
import { modules } from '@/features/modules/modules'
import { getModuleRecords } from '@/features/modules/modules.api'
import type { ModuleListQuery } from '@/features/modules/types'
import { useModuleRuntime } from '@/features/modules/useModuleRuntime'
import { getCustomerPaymentOptions, recordCustomerPayment } from './customer-payments.api'
import { CustomerPaymentDetailDialog } from './CustomerPaymentDetailDialog'
import { RecordCustomerPaymentDialog } from './RecordCustomerPaymentDialog'
import type { CustomerPaymentValues } from './types'

const paymentModule = modules.find((module) => module.id === 'payments')!

export function PaymentsPage() {
  const runtime = useModuleRuntime()
  const queryClient = useQueryClient()
  const pending = useRef(false)
  const [query, setQuery] = useState<ModuleListQuery>({
    page: 1,
    limit: 25,
    search: '',
    status: '',
    sort: '',
    order: 'asc',
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordOrderId, setRecordOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canRead = runtime.permissions.includes('payments.read')
  const canCreate = runtime.permissions.includes('payments.create')
  const list = useQuery({
    queryKey: ['module', 'payments', query],
    queryFn: () => getModuleRecords('payments', query),
    enabled: canRead,
    placeholderData: keepPreviousData,
  })
  const options = useQuery({
    queryKey: ['payment-options'],
    queryFn: getCustomerPaymentOptions,
    enabled: canCreate && recording,
  })
  function openRecord(orderId: string | null) {
    setError(null)
    setSelectedId(null)
    setRecordOrderId(orderId)
    setRecording(true)
  }
  async function record(values: CustomerPaymentValues, requestKey: string, proofFile: File) {
    if (pending.current) return false
    pending.current = true
    setError(null)
    try {
      await recordCustomerPayment(values, requestKey, proofFile)
      await Promise.all(
        [
          ['module', 'payments'],
          ['customer-payment-detail'],
          ['payment-options'],
          ['order-detail'],
          ['dashboard-summary'],
          ['report'],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      setRecording(false)
      setSelectedId(values.orderId)
      toast.success('Payment and proof recorded.')
      return true
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : 'The payment could not be recorded.'
      setError(message)
      toast.error(message)
      void queryClient.invalidateQueries({ queryKey: ['payment-options'] })
      return false
    } finally {
      pending.current = false
    }
  }
  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/dashboard' },
          { label: 'Finance' },
          { label: 'Payments' },
        ]}
      />
      <PageHeading
        title="Payments"
        description="See each order’s balance, financial status, and payment history."
      >
        {canCreate && (
          <button type="button" className="button button-primary" onClick={() => openRecord(null)}>
            <Plus size={17} />
            Record payment
          </button>
        )}
      </PageHeading>
      {list.isPending ? (
        <div className="table-empty" role="status">
          <strong>Loading customer transactions…</strong>
        </div>
      ) : list.isError ? (
        <div className="table-empty" role="alert">
          <strong>Could not load customer transactions.</strong>
          <span>{list.error.message}</span>
          <button className="button button-outline" onClick={() => void list.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <DataTable
          module={paymentModule}
          rows={list.data.data}
          total={list.data.total}
          statusOptions={list.data.statusOptions}
          query={query}
          onQueryChange={setQuery}
          onRowClick={(row) => setSelectedId(row.id)}
          busy={list.isFetching}
        />
      )}
      <CustomerPaymentDetailDialog
        key={selectedId ?? 'closed'}
        orderId={selectedId}
        canReadAudit={runtime.permissions.includes('audit.read')}
        canCreate={canCreate}
        onClose={() => setSelectedId(null)}
        onRecord={(order) => openRecord(order.id)}
      />
      {recording && (
        <RecordCustomerPaymentDialog
          orderId={recordOrderId}
          options={options.data}
          loading={options.isPending}
          optionsError={options.error?.message}
          submitError={error ?? undefined}
          onRetry={() => void options.refetch()}
          onClose={() => {
            if (!pending.current) {
              setRecording(false)
              if (recordOrderId) setSelectedId(recordOrderId)
            }
          }}
          onSave={record}
        />
      )}
    </>
  )
}
