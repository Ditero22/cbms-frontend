import { apiDownload, apiRequest } from '@/services/api/client'

export type ProofEntityType =
  'vehicle-maintenance' | 'driver-allowance' | 'payment' | 'payroll-entry'
export type ProofProps = { entityType: ProofEntityType; entityId: string; onUploaded?: () => void }
export type ProofAttachment = {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
  uploadedByName: string
  createdAt: string
}
export const proofQueryKey = (entityType: ProofEntityType, entityId: string) => [
  'proofs',
  entityType,
  entityId,
]

function proofQuery(entityType: ProofEntityType, entityId: string) {
  return new URLSearchParams({ entityType, entityId }).toString()
}
export function getProofs(entityType: ProofEntityType, entityId: string) {
  return apiRequest<{ items: ProofAttachment[] }>(
    `/attachments?${proofQuery(entityType, entityId)}`,
  )
}
export function uploadProofFile(entityType: ProofEntityType, entityId: string, file: File) {
  return apiRequest<{ id: string }>(`/attachments?${proofQuery(entityType, entityId)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type, 'x-file-name': encodeURIComponent(file.name) },
    body: file,
  })
}
export function downloadProofFile(file: ProofAttachment) {
  return apiDownload(`/attachments/${file.id}/content`, file.fileName)
}
