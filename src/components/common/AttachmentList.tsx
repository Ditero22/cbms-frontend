import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, Eye } from 'lucide-react'
import { ProofPreviewDialog } from './ProofPreviewDialog'
import { ProofUploader } from './ProofUploader'
import {
  downloadProofFile,
  getProofs,
  proofQueryKey,
  type ProofAttachment,
  type ProofProps,
} from './proofs.api'
import './proofs.css'

export function AttachmentList({
  entityType,
  entityId,
  canUpload = false,
  onUploaded,
}: ProofProps & { canUpload?: boolean }) {
  const query = useQuery({
    queryKey: proofQueryKey(entityType, entityId),
    queryFn: () => getProofs(entityType, entityId),
  })
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<ProofAttachment | null>(null)
  async function download(file: ProofAttachment) {
    setError('')
    setDownloading(file.id)
    try {
      await downloadProofFile(file)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The proof could not be downloaded.')
    } finally {
      setDownloading(null)
    }
  }
  return (
    <section className="proof-section" aria-label="Proof and attachments">
      <h3>Proof & attachments</h3>
      {query.isPending ? (
        <p role="status" className="proof-help">
          Loading proof…
        </p>
      ) : query.isError ? (
        <div role="alert" className="proof-help">
          <p>{query.error.message}</p>
          <button
            type="button"
            className="button button-outline"
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </div>
      ) : query.data.items.length === 0 ? (
        <p className="proof-help">No proof attached yet.</p>
      ) : (
        <ul className="proof-list">
          {query.data.items.map((file) => (
            <li key={file.id}>
              <FileText size={17} aria-hidden="true" />
              <div>
                <strong>{file.fileName}</strong>
                <span>
                  {(file.fileSize / 1024).toFixed(0)} KB · {file.uploadedByName} ·{' '}
                  {new Date(file.createdAt).toLocaleString('en-PH')}
                </span>
              </div>
              {file.mimeType.startsWith('image/') && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setPreviewing(file)}
                  aria-label={`Preview ${file.fileName}`}
                >
                  <Eye size={14} /> Preview
                </button>
              )}
              <button
                type="button"
                className="button button-outline"
                disabled={Boolean(downloading)}
                onClick={() => void download(file)}
                aria-label={`Download ${file.fileName}`}
              >
                <Download size={14} />
                {downloading === file.id ? 'Preparing…' : 'Download'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {canUpload && (
        <ProofUploader entityType={entityType} entityId={entityId} onUploaded={onUploaded} />
      )}
      {previewing && <ProofPreviewDialog file={previewing} onClose={() => setPreviewing(null)} />}
    </section>
  )
}
