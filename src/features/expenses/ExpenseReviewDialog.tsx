import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { AppDialog } from '@/components/common/AppDialog'
import { FieldHeading } from '@/components/common/FieldHeading'
import { formatPeso } from '@/features/modules/order-decimals'
import type { ExpenseRecord } from './types'

export function ExpenseReviewDialog({
  expense,
  decision,
  busy,
  error,
  alreadyReviewed,
  onClose,
  onSave,
}: {
  expense: ExpenseRecord
  decision: 'Approved' | 'Rejected'
  busy: boolean
  error: string | null
  alreadyReviewed: boolean
  onClose: () => void
  onSave: (note: string) => Promise<boolean>
}) {
  const id = useId()
  const [note, setNote] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const rejecting = decision === 'Rejected'
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || alreadyReviewed) return
    setValidationError(null)
    if (rejecting && !note.trim()) {
      setValidationError('Add a reason for rejecting this expense.')
      return
    }
    if (await onSave(note.trim())) onClose()
  }

  return (
    <AppDialog
      open
      onOpenChange={(next) => !next && !busy && onClose()}
      title={rejecting ? 'Reject expense?' : 'Approve expense?'}
      description={`${expense.description} · ${formatPeso(expense.amount)} · ${expense.branchName}`}
    >
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <p className="form-helper">
          {rejecting
            ? 'Record the reason this expense should be rejected.'
            : 'Approve this recorded expense for inclusion in approved expense totals.'}
        </p>
        <label className="field-label" htmlFor={id}>
          <FieldHeading required={rejecting}>
            {rejecting ? 'Rejection reason' : 'Review note'}
          </FieldHeading>
          <textarea
            id={id}
            aria-label={rejecting ? 'Rejection reason' : 'Review note'}
            className="form-input"
            autoFocus
            rows={3}
            maxLength={500}
            required={rejecting}
            value={note}
            disabled={busy}
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? `${id}-error` : undefined}
            onChange={(event) => {
              setNote(event.target.value)
              setValidationError(null)
            }}
          />
          {validationError && (
            <span id={`${id}-error`} className="field-error" role="alert">
              {validationError}
            </span>
          )}
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {alreadyReviewed && (
          <p className="form-helper">
            The latest expense state has been refreshed. Open it to review the recorded decision.
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button button-outline" disabled={busy} onClick={onClose}>
            {alreadyReviewed ? 'View latest expense' : 'Cancel'}
          </button>
          <button
            type="submit"
            className={rejecting ? 'button button-danger' : 'button button-primary'}
            disabled={busy || alreadyReviewed}
          >
            {busy ? 'Saving…' : rejecting ? 'Confirm rejection' : 'Confirm approval'}
          </button>
        </div>
      </form>
    </AppDialog>
  )
}
