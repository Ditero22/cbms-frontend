import { invalidatePayrollRun } from './payroll-cache'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { DataTable } from '@/components/common/DataTable'
import { PageHeading } from '@/components/common/PageHeading'
import { getModuleRecords } from '@/features/modules/modules.api'
import { modules } from '@/features/modules/modules'
import type { ModuleListQuery } from '@/features/modules/types'
import { useModuleRuntime } from '@/features/modules/useModuleRuntime'
import { getPayrollOptions, getPayrollRunForEdit, savePayrollRun } from './payroll.api'
import { PayrollRunDialog } from './PayrollRunDialog'
import { PayrollRunDetailDialog } from './PayrollRunDetailDialog'
import { PayrollEntryDetailDialog } from './PayrollEntryDetailDialog'
import { PayrollLedgerTable } from './PayrollLedgerTable'
import { LegacyAllowanceLedger } from './LegacyAllowanceLedger'
import type { PayrollRunInput } from './types'
import './payroll.css'

const module = modules.find((candidate) => candidate.id === 'payroll')!

export function PayrollPage() {
  const runtime = useModuleRuntime()
  const client = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const view =
    searchParams.get('view') === 'runs'
      ? 'runs'
      : searchParams.get('view') === 'legacy'
        ? 'legacy'
        : 'employees'
  const setView = (value: string) => setSearchParams(value === 'employees' ? {} : { view: value })
  const [query, setQuery] = useState<ModuleListQuery>({
    page: 1,
    limit: 25,
    search: '',
    status: '',
    sort: '',
    order: 'asc',
  })
  const [formOpen, setFormOpen] = useState(false)
  const [editingRunId, setEditingRunId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [branchId, setBranchId] = useState('')
  const records = useQuery({
    queryKey: ['module', 'payroll', query],
    queryFn: () => getModuleRecords('payroll', query),
    placeholderData: (previous) => previous,
    enabled: view === 'runs',
  })
  const canReadLegacy = runtime.permissions.includes('driver-allowances.read')
  const legacyRecords = useQuery({
    queryKey: ['module', 'driver-allowances', 'legacy-presence'],
    queryFn: () =>
      getModuleRecords('driver-allowances', {
        page: 1,
        limit: 1,
        search: '',
        status: '',
        sort: '',
        order: 'asc',
      }),
    enabled: canReadLegacy,
  })
  const options = useQuery({
    queryKey: ['payroll-options', branchId],
    queryFn: () => getPayrollOptions(branchId || undefined),
    enabled: formOpen,
  })
  const editData = useQuery({
    queryKey: ['payroll-run-edit', editingRunId],
    queryFn: () => getPayrollRunForEdit(editingRunId!),
    enabled: formOpen && Boolean(editingRunId),
  })
  useEffect(() => {
    if (formOpen && !branchId && options.data?.selectedBranchId) {
      setBranchId(options.data.selectedBranchId)
    }
  }, [branchId, formOpen, options.data?.selectedBranchId])

  async function saveDraft(values: PayrollRunInput, requestKey?: string) {
    setSaving(true)
    try {
      await savePayrollRun(editingRunId, values, requestKey)
      await invalidatePayrollRun(client, editingRunId)
      toast.success(editingRunId ? 'Draft pay run updated.' : 'Draft pay run saved.')
      setView('runs')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The pay run could not be saved.')
      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/dashboard' },
          { label: 'Finance' },
          { label: module.title },
        ]}
      />
      <PageHeading title={module.title} description={module.description}>
        {runtime.permissions.includes('payroll.create') && (
          <button type="button" className="button button-primary" onClick={() => setFormOpen(true)}>
            <Plus size={16} /> Create pay run
          </button>
        )}
      </PageHeading>
      <div className="payroll-views" role="group" aria-label="Payroll views">
        <button
          type="button"
          className={`button ${view === 'employees' ? 'button-primary' : 'button-outline'}`}
          aria-pressed={view === 'employees'}
          onClick={() => setView('employees')}
        >
          Employee payroll
        </button>
        <button
          type="button"
          className={`button ${view === 'runs' ? 'button-primary' : 'button-outline'}`}
          aria-pressed={view === 'runs'}
          onClick={() => setView('runs')}
        >
          Pay runs
        </button>
        {canReadLegacy && Boolean(legacyRecords.data?.total) && (
          <button
            type="button"
            className={`button ${view === 'legacy' ? 'button-primary' : 'button-outline'}`}
            aria-pressed={view === 'legacy'}
            onClick={() => setView('legacy')}
          >
            Legacy allowances
          </button>
        )}
      </div>
      {view === 'employees' && <PayrollLedgerTable onOpen={setSelectedEntryId} />}
      {view === 'legacy' &&
        (canReadLegacy ? (
          <LegacyAllowanceLedger />
        ) : (
          <p className="payroll-note" role="alert">
            You do not have permission to view historical allowances.
          </p>
        ))}
      {view === 'runs' &&
        (records.isPending ? (
          <div className="table-empty">
            <strong>Loading payroll…</strong>
          </div>
        ) : records.isError ? (
          <div className="table-empty" role="alert">
            <strong>Could not load payroll.</strong>
            <span>{records.error.message}</span>
            <button
              type="button"
              className="button button-outline"
              onClick={() => void records.refetch()}
            >
              Try again
            </button>
          </div>
        ) : (
          <DataTable
            module={module}
            rows={records.data.data}
            total={records.data.total}
            statusOptions={records.data.statusOptions}
            query={query}
            onQueryChange={setQuery}
            onRowClick={(row) => setSelectedId(row.id)}
            busy={records.isFetching}
          />
        ))}
      <PayrollRunDialog
        open={formOpen}
        runId={editingRunId}
        initialRun={editData.data}
        initialRunLoading={Boolean(editingRunId) && editData.isPending}
        initialRunError={editData.error?.message}
        options={options.data}
        branches={options.data?.branches ?? []}
        loading={options.isPending}
        error={options.error?.message}
        saving={saving}
        onRetry={() => {
          void options.refetch()
          if (editingRunId) void editData.refetch()
        }}
        onBranchChange={setBranchId}
        onClose={() => {
          setFormOpen(false)
          setEditingRunId(null)
          setBranchId('')
        }}
        onSave={saveDraft}
      />
      {selectedId && (
        <PayrollRunDetailDialog
          key={selectedId}
          runId={selectedId}
          permissions={runtime.permissions}
          onClose={() => setSelectedId(null)}
          onEdit={(runId) => {
            setSelectedId(null)
            setEditingRunId(runId)
            setBranchId('')
            setFormOpen(true)
          }}
          onChanged={() => void client.invalidateQueries({ queryKey: ['module', 'payroll'] })}
        />
      )}
      {selectedEntryId && (
        <PayrollEntryDetailDialog
          key={selectedEntryId}
          id={selectedEntryId}
          permissions={runtime.permissions}
          onClose={() => setSelectedEntryId(null)}
          onRun={(id) => {
            setSelectedEntryId(null)
            setSelectedId(id)
          }}
        />
      )}
    </>
  )
}
