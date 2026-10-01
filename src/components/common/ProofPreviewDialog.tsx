import { useEffect, useState } from 'react'
import { apiBlob } from '@/services/api/client'
import { AppDialog } from './AppDialog'
import { QueryState } from './QueryState'
import type { ProofAttachment } from './proofs.api'

export function ProofPreviewDialog({
  file,
  onClose,
}: {
  file: ProofAttachment
  onClose: () => void
}) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let objectUrl = ''
    setLoading(true)
    setError(null)
    void apiBlob(`/attachments/${encodeURIComponent(file.id)}/content`)
      .then((blob) => {
        if (!active) return
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type))
          throw new Error('This attachment can be downloaded, but cannot be previewed as an image.')
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause : new Error('The proof could not be loaded.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file.id, attempt])
  return (
    <AppDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Payment proof"
      description={file.fileName}
      size="wide"
    >
      <QueryState loading={loading} error={error} onRetry={() => setAttempt((value) => value + 1)}>
        {url && (
          <figure className="proof-image-preview">
            <img
              src={url}
              alt={`Payment proof: ${file.fileName}`}
              onError={() =>
                setError(
                  new Error(
                    'This proof image could not be displayed. Download the file to inspect it.',
                  ),
                )
              }
            />
          </figure>
        )}
      </QueryState>
      <div className="dialog-actions">
        <button type="button" className="button button-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </AppDialog>
  )
}
