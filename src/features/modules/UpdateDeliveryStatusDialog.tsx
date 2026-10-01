import { useEffect, useState, type FormEvent } from 'react'
import { AppDialog } from '@/components/common/AppDialog'
import type { DeliveryStatus } from './types'

const allowedNextStatuses: Record<string, DeliveryStatus[]> = {
  Preparing: ['Scheduled', 'In Transit', 'Failed'],
  Scheduled: ['In Transit', 'Failed'],
  'In Transit': ['Delivered', 'Failed'],
}

type UpdateDeliveryStatusDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  deliveryId: string
  currentStatus: string
  onSave: (
    deliveryId: string,
    status: DeliveryStatus,
    input?: { endOdometer?: string; notes?: string },
  ) => Promise<boolean>
}

export function UpdateDeliveryStatusDialog({
  open,
  onOpenChange,
  deliveryId,
  currentStatus,
  onSave,
}: UpdateDeliveryStatusDialogProps) {
  const options = allowedNextStatuses[currentStatus] ?? []
  const [status, setStatus] = useState<DeliveryStatus | ''>('')
  const [isSaving, setIsSaving] = useState(false)
  const [endOdometer, setEndOdometer] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    setStatus(allowedNextStatuses[currentStatus]?.[0] ?? '')
    setEndOdometer('')
    setNotes('')
  }, [currentStatus, open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!status) return
    setIsSaving(true)
    try {
      if (
        await onSave(deliveryId, status, {
          endOdometer: endOdometer || undefined,
          notes: notes.trim() || undefined,
        })
      )
        onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => !isSaving && onOpenChange(next)}
      title="Update delivery status"
      description={`Current status: ${currentStatus}. Only forward status changes are allowed.`}
    >
      <form className="dialog-form" onSubmit={submit}>
        {options.length > 0 ? (
          <label className="field-label">
            New status
            <select
              className="form-input"
              aria-label="New status"
              disabled={isSaving}
              value={status}
              onChange={(event) => setStatus(event.target.value as DeliveryStatus)}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="form-helper">
            This delivery is finished and has no further status changes.
          </p>
        )}

        {['Delivered', 'Failed'].includes(status) && (
          <label className="field-label">
            Ending odometer (km, if tracked)
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.001"
              value={endOdometer}
              disabled={isSaving}
              onChange={(event) => setEndOdometer(event.target.value)}
            />
          </label>
        )}
        {options.length > 0 && (
          <label className="field-label">
            Activity notes
            <textarea
              className="form-input"
              rows={3}
              maxLength={2000}
              value={notes}
              disabled={isSaving}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        )}

        <div className="dialog-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Close
          </button>
          {options.length > 0 && (
            <button type="submit" className="button button-primary" disabled={isSaving}>
              {isSaving ? 'Saving status…' : 'Save status'}
            </button>
          )}
        </div>
      </form>
    </AppDialog>
  )
}
