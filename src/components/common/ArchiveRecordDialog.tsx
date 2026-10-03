import { useState } from 'react'
import { AppDialog, DialogCancelButton } from './AppDialog'

export function ArchiveRecordDialog({
  open,
  title,
  description,
  actionLabel = 'Archive',
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  actionLabel?: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function confirm() {
    if (pending) return
    setPending(true)
    setError(undefined)
    try {
      await onConfirm()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'This record could not be archived.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AppDialog
      open={open}
      title={title}
      description={description}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onClose()
      }}
    >
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions" aria-busy={pending}>
        <DialogCancelButton disabled={pending} />
        <button className="button button-danger" disabled={pending} onClick={() => void confirm()}>
          {pending ? 'Archiving…' : actionLabel}
        </button>
      </div>
    </AppDialog>
  )
}
