import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { AppDialog } from '@/components/common/AppDialog'
import { formatPeso, fromMinorUnits, toMinorUnits } from '@/features/modules/order-decimals'
import type {
  PayrollAdjustmentInput,
  PayrollDeductionType,
  PayrollEarningType,
  PayrollOptions,
  PayrollPayBasis,
  PayrollRunDetail,
  PayrollRunInput,
} from './types'

type AdjustmentDraft = PayrollAdjustmentInput & { key: string }

type EntryDraft = {
  key: string
  employeeId: string
  payBasis: PayrollPayBasis
  units: string
  rate: string
  adjustments: AdjustmentDraft[]
}

const earningTypes: PayrollEarningType[] = [
  'Overtime',
  'Bonus',
  'Allowance',
  'Reimbursement',
  'Other compensation',
]
const deductionTypes: PayrollDeductionType[] = ['Deduction', 'Cash advance recovery']

const newEntry = (): EntryDraft => ({
  key: crypto.randomUUID(),
  employeeId: '',
  payBasis: 'Salary',
  units: '1',
  rate: '',
  adjustments: [],
})

const fromRun = (data: PayrollRunDetail): EntryDraft[] =>
  data.entries.map((entry) => ({
    key: crypto.randomUUID(),
    employeeId: entry.employeeId,
    payBasis: entry.payBasis,
    units: entry.units,
    rate: entry.rate,
    adjustments: entry.adjustments.map((adjustment) => ({
      key: crypto.randomUUID(),
      kind: adjustment.kind,
      type: adjustment.type as PayrollEarningType | PayrollDeductionType,
      amount: adjustment.amount,
      notes: adjustment.notes ?? '',
    })),
  }))

function estimate(entry: EntryDraft) {
  try {
    const regular = (toMinorUnits(entry.rate, 2) * toMinorUnits(entry.units, 3) + 500n) / 1000n
    const additional = entry.adjustments
      .filter((item) => item.kind === 'earning' && item.amount)
      .reduce((sum, item) => sum + toMinorUnits(item.amount, 2), 0n)
    const deduction = entry.adjustments
      .filter((item) => item.kind === 'deduction' && item.amount)
      .reduce((sum, item) => sum + toMinorUnits(item.amount, 2), 0n)
    return { regular, additional, deduction, net: regular + additional - deduction }
  } catch {
    return { regular: 0n, additional: 0n, deduction: 0n, net: 0n }
  }
}

export function PayrollRunDialog({
  open,
  runId,
  initialRun,
  initialRunLoading,
  initialRunError,
  options,
  branches,
  loading,
  error,
  saving,
  onRetry,
  onBranchChange,
  onClose,
  onSave,
}: {
  open: boolean
  runId: string | null
  initialRun?: PayrollRunDetail
  initialRunLoading: boolean
  initialRunError?: string
  options?: PayrollOptions
  branches: { id: string; name: string }[]
  loading: boolean
  error?: string
  saving: boolean
  onRetry: () => void
  onBranchChange: (branchId: string) => void
  onClose: () => void
  onSave: (values: PayrollRunInput, requestKey?: string) => Promise<boolean>
}) {
  const [branchId, setBranchId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [entries, setEntries] = useState<EntryDraft[]>([newEntry()])
  const [formError, setFormError] = useState('')
  const submittedIntent = useRef<{ payload: string; requestKey: string } | null>(null)

  useEffect(() => {
    if (!open || !runId || initialRun?.run.id !== runId) return
    setBranchId(initialRun.run.branchId ?? '')
    onBranchChange(initialRun.run.branchId ?? '')
    setPeriodStart(initialRun.run.periodStart)
    setPeriodEnd(initialRun.run.periodEnd)
    setEntries(fromRun(initialRun))
    setFormError('')
  }, [initialRun, onBranchChange, open, runId])

  useEffect(() => {
    if (!open || runId) return
    submittedIntent.current = null
    setBranchId('')
    setPeriodStart('')
    setPeriodEnd('')
    setEntries([newEntry()])
    setFormError('')
  }, [open, runId])

  useEffect(() => {
    if (open && !runId && !branchId && options?.selectedBranchId) {
      setBranchId(options.selectedBranchId)
    }
  }, [branchId, open, options?.selectedBranchId, runId])

  const employees = useMemo(() => options?.employees ?? [], [options?.employees])
  const selected = useMemo(
    () => new Set(entries.map((entry) => entry.employeeId).filter(Boolean)),
    [entries],
  )
  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  )
  const totals = entries.reduce(
    (sum, entry) => {
      const value = estimate(entry)
      return { gross: sum.gross + value.regular + value.additional, net: sum.net + value.net }
    },
    { gross: 0n, net: 0n },
  )

  function updateEntry(key: string, changes: Partial<EntryDraft>) {
    setEntries((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...changes } : entry)),
    )
    setFormError('')
  }

  function updateAdjustment(
    entryKey: string,
    adjustmentKey: string,
    changes: Partial<AdjustmentDraft>,
  ) {
    setEntries((current) =>
      current.map((entry) =>
        entry.key === entryKey
          ? {
              ...entry,
              adjustments: entry.adjustments.map((adjustment) =>
                adjustment.key === adjustmentKey ? { ...adjustment, ...changes } : adjustment,
              ),
            }
          : entry,
      ),
    )
    setFormError('')
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!branchId || !periodStart || !periodEnd || periodStart > periodEnd) {
      setFormError('Choose a branch and a valid payroll period.')
      return
    }
    const validUnits = (value: string) =>
      /^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(value) && Number(value) > 0
    const validMoney = (value: string, required: boolean) => {
      if (!required && value === '') return true
      return (
        /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value) &&
        (required ? Number(value) > 0 : Number(value) >= 0)
      )
    }
    if (
      !entries.length ||
      entries.some(
        (entry) =>
          !entry.employeeId ||
          !validMoney(entry.rate, true) ||
          !validUnits(entry.units) ||
          entry.adjustments.length > 30 ||
          entry.adjustments.some(
            (adjustment) => !validMoney(adjustment.amount, true) || Number(adjustment.amount) <= 0,
          ) ||
          estimate(entry).net < 0n,
      )
    ) {
      setFormError(
        'Select an employee and enter valid pay amounts and positive quantities. Net pay cannot be negative.',
      )
      return
    }
    const payload: PayrollRunInput = {
      branchId: branchId.toLowerCase(),
      periodStart,
      periodEnd,
      entries: entries
        .map((entry) => ({
          employeeId: entry.employeeId.toLowerCase(),
          payBasis: entry.payBasis,
          units: fromMinorUnits(toMinorUnits(entry.units, 3), 3),
          rate: fromMinorUnits(toMinorUnits(entry.rate, 2), 2),
          adjustments: entry.adjustments.map(({ kind, type, amount, notes }) => ({
            kind,
            type,
            amount: fromMinorUnits(toMinorUnits(amount, 2), 2),
            notes: notes.trim(),
          })),
        }))
        .sort((left, right) => left.employeeId.localeCompare(right.employeeId)),
    }
    const intent = JSON.stringify(payload)
    if (!runId && submittedIntent.current?.payload !== intent) {
      submittedIntent.current = { payload: intent, requestKey: crypto.randomUUID() }
    }
    if (!(await onSave(payload, runId ? undefined : submittedIntent.current?.requestKey))) return
    submittedIntent.current = null
    onClose()
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => !next && !saving && onClose()}
      title={runId ? 'Edit draft pay run' : 'Create pay run'}
      description={
        runId
          ? 'Update this draft and its employee pay lines. Processed pay runs are locked.'
          : 'Record regular employee pay for a period, with any separate earnings and deductions.'
      }
      size="wide"
    >
      <form className="dialog-form payroll-form" onSubmit={(event) => void submit(event)}>
        <section className="payroll-form-section" aria-labelledby="payroll-period-title">
          <h3 id="payroll-period-title">Pay period</h3>
          <div className="dialog-field-grid">
            <label className="field-label">
              <span>
                Branch <b aria-hidden="true">*</b>
              </span>
              <select
                className="form-input"
                required
                value={branchId}
                disabled={
                  saving ||
                  loading ||
                  initialRunLoading ||
                  Boolean(initialRunError) ||
                  Boolean(runId)
                }
                onChange={(event) => {
                  setBranchId(event.target.value)
                  onBranchChange(event.target.value)
                  if (!runId) setEntries([newEntry()])
                }}
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              <span>
                Period start <b aria-hidden="true">*</b>
              </span>
              <input
                className="form-input"
                type="date"
                required
                value={periodStart}
                disabled={saving}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
            </label>
            <label className="field-label">
              <span>
                Period end <b aria-hidden="true">*</b>
              </span>
              <input
                className="form-input"
                type="date"
                required
                min={periodStart || undefined}
                value={periodEnd}
                disabled={saving}
                onChange={(event) => setPeriodEnd(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="payroll-form-section" aria-labelledby="payroll-lines-title">
          <div className="payroll-section-heading">
            <div>
              <h3 id="payroll-lines-title">Employee pay</h3>
              <p>
                Add regular pay first; record genuine extras and deductions in their own fields.
              </p>
            </div>
            <button
              type="button"
              className="button button-outline"
              disabled={saving || selected.size >= employees.length}
              onClick={() => setEntries((current) => [...current, newEntry()])}
            >
              <Plus size={15} /> Add employee
            </button>
          </div>
          {initialRunLoading ? (
            <p className="payroll-inline-state" role="status">
              Loading draft pay lines…
            </p>
          ) : null}
          {initialRunError ? (
            <div className="field-error" role="alert">
              Could not load this draft: {initialRunError}
            </div>
          ) : null}
          {!loading && !employees.length ? (
            <p className="payroll-inline-state">Choose a branch with active employees to begin.</p>
          ) : null}
          <div className="payroll-entry-list">
            {entries.map((entry, index) => {
              const preview = estimate(entry)
              const choices = employees.filter(
                (employee) => employee.id === entry.employeeId || !selected.has(employee.id),
              )
              return (
                <fieldset
                  className="payroll-entry-card"
                  key={entry.key}
                  disabled={saving || loading || initialRunLoading || Boolean(initialRunError)}
                >
                  <div className="payroll-entry-heading">
                    <strong>Pay line {index + 1}</strong>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove pay line ${index + 1}`}
                      disabled={entries.length === 1}
                      onClick={() =>
                        setEntries((current) => current.filter((item) => item.key !== entry.key))
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="payroll-fields-grid">
                    <label className="field-label payroll-span-two">
                      <span>
                        Employee <b aria-hidden="true">*</b>
                      </span>
                      <select
                        className="form-input"
                        required
                        value={entry.employeeId}
                        onChange={(event) =>
                          updateEntry(entry.key, { employeeId: event.target.value })
                        }
                      >
                        <option value="">Select employee</option>
                        {choices.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name} · {employee.employeeNumber}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-label">
                      <span>Pay basis</span>
                      <select
                        className="form-input"
                        value={entry.payBasis}
                        onChange={(event) =>
                          updateEntry(entry.key, {
                            payBasis: event.target.value as PayrollPayBasis,
                          })
                        }
                      >
                        {['Salary', 'Daily wage', 'Weekly wage', 'Per-trip pay', 'Other'].map(
                          (basis) => (
                            <option key={basis}>{basis}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="field-label">
                      <span>
                        {entry.payBasis === 'Salary'
                          ? 'Periods / units'
                          : entry.payBasis === 'Per-trip pay'
                            ? 'Trips'
                            : 'Units'}
                      </span>
                      <input
                        className="form-input"
                        type="number"
                        min="0.001"
                        step="0.001"
                        required
                        value={entry.units}
                        onChange={(event) => updateEntry(entry.key, { units: event.target.value })}
                      />
                    </label>
                    <label className="field-label">
                      <span>
                        Rate (PHP) <b aria-hidden="true">*</b>
                      </span>
                      <input
                        className="form-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={entry.rate}
                        onChange={(event) => updateEntry(entry.key, { rate: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="payroll-adjustment-section">
                    <div className="payroll-section-heading">
                      <div>
                        <h4>Adjustments</h4>
                        <p>Optional earnings and deductions are listed separately.</p>
                      </div>
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={entry.adjustments.length >= 30}
                        onClick={() =>
                          updateEntry(entry.key, {
                            adjustments: [
                              ...entry.adjustments,
                              {
                                key: crypto.randomUUID(),
                                kind: 'earning',
                                type: 'Allowance',
                                amount: '',
                                notes: '',
                              },
                            ],
                          })
                        }
                      >
                        <Plus size={15} /> Add adjustment
                      </button>
                    </div>
                    {entry.adjustments.map((adjustment, adjustmentIndex) => (
                      <div className="payroll-adjustment-row" key={adjustment.key}>
                        <label className="field-label">
                          <span>Adjustment {adjustmentIndex + 1} kind</span>
                          <select
                            className="form-input"
                            value={adjustment.kind}
                            onChange={(event) => {
                              const kind = event.target.value as AdjustmentDraft['kind']
                              updateAdjustment(entry.key, adjustment.key, {
                                kind,
                                type: kind === 'earning' ? 'Allowance' : 'Deduction',
                              })
                            }}
                          >
                            <option value="earning">Earning</option>
                            <option value="deduction">Deduction</option>
                          </select>
                        </label>
                        <label className="field-label">
                          <span>Adjustment {adjustmentIndex + 1} type</span>
                          <select
                            className="form-input"
                            value={adjustment.type}
                            onChange={(event) =>
                              updateAdjustment(entry.key, adjustment.key, {
                                type: event.target.value as AdjustmentDraft['type'],
                              })
                            }
                          >
                            {(adjustment.kind === 'earning' ? earningTypes : deductionTypes).map(
                              (type) => (
                                <option key={type}>{type}</option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className="field-label">
                          <span>Adjustment {adjustmentIndex + 1} amount (PHP)</span>
                          <input
                            className="form-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            value={adjustment.amount}
                            onChange={(event) =>
                              updateAdjustment(entry.key, adjustment.key, {
                                amount: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="field-label">
                          <span>Adjustment {adjustmentIndex + 1} notes</span>
                          <input
                            className="form-input"
                            maxLength={300}
                            value={adjustment.notes}
                            onChange={(event) =>
                              updateAdjustment(entry.key, adjustment.key, {
                                notes: event.target.value,
                              })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove adjustment ${adjustmentIndex + 1}`}
                          onClick={() =>
                            updateEntry(entry.key, {
                              adjustments: entry.adjustments.filter(
                                (item) => item.key !== adjustment.key,
                              ),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="payroll-preview" aria-live="polite">
                    <span>
                      Regular pay{' '}
                      <strong>
                        {formatPeso(fromMinorUnits(preview.regular < 0n ? 0n : preview.regular, 2))}
                      </strong>
                    </span>
                    <span>
                      Net pay{' '}
                      <strong>
                        {formatPeso(fromMinorUnits(preview.net < 0n ? 0n : preview.net, 2))}
                      </strong>
                    </span>
                  </div>
                  {entry.employeeId && employeesById.get(entry.employeeId) && (
                    <span className="sr-only">
                      Payee: {employeesById.get(entry.employeeId)?.name}
                    </span>
                  )}
                </fieldset>
              )
            })}
          </div>
          <div className="payroll-total-preview">
            <span>
              {entries.length} employee{entries.length === 1 ? '' : 's'}
            </span>
            <span>
              Estimated gross{' '}
              <strong>
                {formatPeso(fromMinorUnits(totals.gross < 0n ? 0n : totals.gross, 2))}
              </strong>
            </span>
            <span>
              Estimated net{' '}
              <strong>{formatPeso(fromMinorUnits(totals.net < 0n ? 0n : totals.net, 2))}</strong>
            </span>
          </div>
        </section>
        {loading && (
          <p className="payroll-inline-state" role="status">
            Loading branches and employees…
          </p>
        )}
        {error && (
          <div role="alert" className="field-error">
            {error}{' '}
            <button type="button" className="button button-quiet" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
        {formError && (
          <p className="field-error" role="alert">
            {formError}
          </p>
        )}
        <p className="payroll-note">
          This creates a draft pay run. Processing locks its pay lines; payment and employee receipt
          are recorded separately. Trip allowances already recorded in Driver Allowances should not
          be entered again.
        </p>
        <div className="dialog-actions">
          <button
            className="button button-outline"
            type="button"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={
              saving ||
              loading ||
              initialRunLoading ||
              Boolean(initialRunError) ||
              Boolean(error) ||
              !employees.length
            }
          >
            {saving ? 'Saving…' : runId ? 'Save draft changes' : 'Save draft pay run'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
