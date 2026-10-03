import { AppDialog, DialogCancelButton } from '@/components/common/AppDialog'
import type { ReactNode } from 'react'

export function FleetConfirmDialog({
  title,
  description,
  onCancel,
  onConfirm,
  busy,
  error,
  children,
  confirmLabel = 'Confirm',
  danger = false,
}: {
  title: string
  description: string
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
  error?: string | null
  children?: ReactNode
  confirmLabel?: string
  danger?: boolean
}) {
  return (
    <AppDialog
      open
      onOpenChange={(next) => !next && !busy && onCancel()}
      title={title}
      description={description}
    >
      {children}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <DialogCancelButton disabled={busy} />
        <button
          type="button"
          className={`button ${danger ? 'button-danger' : 'button-primary'}`}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Saving…' : confirmLabel}
        </button>
      </div>
    </AppDialog>
  )
}
