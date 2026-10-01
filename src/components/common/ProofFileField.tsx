import { useEffect, useId, useState } from 'react'
import { FieldHeading } from './FieldHeading'
import { paymentProofTypes, validatePaymentProof } from './payment-proof'
import './proofs.css'

export function ProofFileField({
  file,
  onChange,
  disabled = false,
  error,
}: {
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
  error?: string
}) {
  const id = useId()
  const [preview, setPreview] = useState('')
  const [selectionError, setSelectionError] = useState('')
  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const message = selectionError || error
  return (
    <div className="proof-file-field">
      <label className="field-label" htmlFor={id}>
        <FieldHeading required>Receipt / payment proof</FieldHeading>
        <input
          id={id}
          className="form-input"
          type="file"
          accept={paymentProofTypes.join(',')}
          disabled={disabled}
          aria-required="true"
          aria-invalid={Boolean(message)}
          aria-describedby={`${id}-help${message ? ` ${id}-error` : ''}`}
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null
            const invalid = selected ? validatePaymentProof(selected) : ''
            setSelectionError(invalid)
            onChange(invalid ? null : selected)
            if (invalid) event.target.value = ''
          }}
        />
      </label>
      <p id={`${id}-help`} className="proof-help">
        JPEG, PNG, or WebP · up to 10 MB. Include a receipt or acknowledgement for cash payments.
      </p>
      {message && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {message}
        </p>
      )}
      {file && preview && (
        <figure className="proof-image-preview">
          <img
            src={preview}
            alt={`Selected payment proof: ${file.name}`}
            onError={() => {
              setSelectionError('This image could not be previewed. Choose a valid image file.')
              onChange(null)
            }}
          />
          <figcaption>
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </figcaption>
        </figure>
      )}
    </div>
  )
}
