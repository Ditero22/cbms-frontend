export const paymentProofTypes = ['image/jpeg', 'image/png', 'image/webp']
const maxProofSize = 10 * 1024 * 1024

export function validatePaymentProof(file: File | null) {
  if (!file) return 'Choose a receipt or payment proof image.'
  if (!paymentProofTypes.includes(file.type)) return 'Choose a JPEG, PNG, or WebP image.'
  if (!file.size || file.size > maxProofSize)
    return 'The proof image must be between 1 byte and 10 MB.'
  return ''
}
