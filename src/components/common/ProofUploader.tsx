import { useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { proofQueryKey, uploadProofFile, type ProofProps } from './proofs.api'
import './proofs.css'

export function ProofUploader({
  entityType,
  entityId,
  onUploaded,
  disabled = false,
}: ProofProps & { disabled?: boolean }) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const client = useQueryClient()
  async function upload() {
    if (!file || saving) return
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) ||
      !file.size ||
      file.size > 10 * 1024 * 1024
    ) {
      setError('Choose a JPEG, PNG, WebP, or PDF up to 10 MB.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await uploadProofFile(entityType, entityId, file)
      await client.invalidateQueries({ queryKey: proofQueryKey(entityType, entityId) })
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      onUploaded?.()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The proof could not be uploaded. Try again.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="proof-uploader">
      <label className="field-label" htmlFor={inputId}>
        Attach proof
      </label>
      <p id={`${inputId}-help`} className="proof-help">
        JPEG, PNG, WebP, or PDF · up to 10 MB · private to authorized staff
      </p>
      <div className="proof-upload-controls">
        <input
          ref={inputRef}
          id={inputId}
          className="form-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={disabled || saving}
          aria-describedby={`${inputId}-help${error ? ` ${inputId}-error` : ''}`}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null)
            setError('')
          }}
        />
        <button
          type="button"
          className="button button-outline"
          disabled={!file || disabled || saving}
          onClick={() => void upload()}
        >
          <Upload size={15} />
          {saving ? 'Uploading…' : 'Upload proof'}
        </button>
      </div>
      {error && (
        <p className="field-error" id={`${inputId}-error`} role="alert">
          {error}
        </p>
      )}
      <span className="sr-only" role="status">
        {saving ? 'Uploading proof' : ''}
      </span>
    </div>
  )
}
