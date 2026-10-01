import type { APIRequestContext } from '@playwright/test'

export const paymentProof = {
  name: 'payment-proof.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
}

export function recordPaymentWithProof(
  request: APIRequestContext,
  apiUrl: string,
  values: Record<string, unknown>,
) {
  return request.post(`${apiUrl}/payments/with-proof`, {
    multipart: {
      data: JSON.stringify({
        requestKey: crypto.randomUUID(),
        paymentDate: new Date().toISOString().slice(0, 10),
        ...values,
      }),
      proofFile: paymentProof,
    },
  })
}
