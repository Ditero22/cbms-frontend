import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import { FieldHeading } from '@/components/common/FieldHeading'
import { fromMinorUnits, toMinorUnits } from '@/features/modules/order-decimals'
import { getExpenseOptions } from './expenses.api'
import type { ExpenseValues } from './types'

export function CreateExpenseDialog({
  open,
  busy,
  error,
  onClose,
  onSave,
}: {
  open: boolean
  busy: boolean
  error: string | null
  onClose: () => void
  onSave: (values: ExpenseValues) => Promise<boolean>
}) {
  const id = useId()
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [branchId, setBranchId] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const submittedIntent = useRef<{ payload: string; requestKey: string } | null>(null)
  const options = useQuery({
    queryKey: ['expense-options'],
    queryFn: getExpenseOptions,
    enabled: open,
  })
  useEffect(() => {
    if (!open) return
    setDescription('')
    setCategory('')
    setAmount('')
    setBranchId('')
    setValidationError(null)
    submittedIntent.current = null
  }, [open])
  useEffect(() => {
    if (open && options.data?.branches.length === 1)
      setBranchId((current) => current || options.data!.branches[0]!.id)
  }, [open, options.data])
  const choicesUnavailable = options.isPending || options.isError

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setValidationError(null)
    if (!options.data || choicesUnavailable) return
    if (description.trim().length < 2 || category.trim().length < 2) {
      setValidationError('Enter a description and category of at least two characters.')
      return
    }
    if (!options.data.branches.some((branch) => branch.id === branchId)) {
      setValidationError('Choose an active branch.')
      return
    }
    let cents: bigint
    try {
      cents = toMinorUnits(amount, 2)
      if (cents <= 0n || cents > 99_999_999_999_999n) throw new Error()
    } catch {
      setValidationError(
        'Enter an amount from ₱0.01 to ₱999,999,999,999.99, with at most two decimal places.',
      )
      return
    }
    const values = {
      description: description.trim(),
      category: category.trim(),
      branchId,
      amount: fromMinorUnits(cents, 2),
    }
    const payload = JSON.stringify(values)
    if (submittedIntent.current?.payload !== payload)
      submittedIntent.current = { payload, requestKey: crypto.randomUUID() }
    if (await onSave({ ...values, requestKey: submittedIntent.current.requestKey })) {
      submittedIntent.current = null
      onClose()
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => !next && !busy && onClose()}
      title="New expense"
      description="Record a branch expense for review. Amounts are stored in Philippine pesos."
    >
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <label className="field-label" htmlFor={`${id}-description`}>
          <FieldHeading required>Description</FieldHeading>
          <textarea
            id={`${id}-description`}
            aria-label="Description"
            className="form-input"
            autoFocus
            rows={3}
            minLength={2}
            maxLength={240}
            required
            value={description}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What was the expense for?"
          />
        </label>
        <div className="dialog-field-grid">
          <label className="field-label" htmlFor={`${id}-category`}>
            <FieldHeading required>Category</FieldHeading>
            <input
              id={`${id}-category`}
              aria-label="Category"
              className="form-input"
              list={`${id}-categories`}
              minLength={2}
              maxLength={120}
              required
              value={category}
              disabled={busy}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Choose or enter a category"
            />
            <datalist id={`${id}-categories`}>
              {options.data?.categories.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="field-label" htmlFor={`${id}-amount`}>
            <FieldHeading required>Amount</FieldHeading>
            <input
              id={`${id}-amount`}
              aria-label="Amount"
              className="form-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max="999999999999.99"
              required
              value={amount}
              disabled={busy}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
            <span className="form-helper">PHP · up to two decimal places</span>
          </label>
          <label className="field-label" htmlFor={`${id}-branch`}>
            <FieldHeading required>Branch</FieldHeading>
            <select
              id={`${id}-branch`}
              aria-label="Branch"
              className="form-input"
              required
              value={branchId}
              disabled={busy || choicesUnavailable}
              onChange={(event) => setBranchId(event.target.value)}
            >
              <option value="">Select branch</option>
              {options.data?.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="form-helper">
          Category suggestions come from recorded expenses within your access. You can enter another
          category.
        </p>
        {options.isPending && (
          <p className="form-helper" role="status">
            Loading expense options…
          </p>
        )}
        {options.isError && (
          <div className="expense-form-error" role="alert">
            <span>Could not load expense options. {options.error.message}</span>
            <button
              type="button"
              className="button button-outline button-small"
              disabled={options.isFetching}
              onClick={() => void options.refetch()}
            >
              Try again
            </button>
          </div>
        )}
        {options.data && !choicesUnavailable && options.data.branches.length === 0 && (
          <p className="field-error" role="alert">
            No active branch is available for this account. Contact an administrator.
          </p>
        )}
        {(validationError || error) && (
          <p className="field-error" role="alert">
            {validationError || error}
          </p>
        )}
        <div className="dialog-actions">
          <DialogCancelButton disabled={busy} />
          <button
            type="submit"
            className="button button-primary"
            disabled={busy || choicesUnavailable || !options.data?.branches.length}
          >
            {busy ? 'Saving…' : 'Save expense'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
