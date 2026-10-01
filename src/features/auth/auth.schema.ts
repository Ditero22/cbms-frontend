import { z } from 'zod'
import { invalidApiResponse } from '@/services/api/errors'

const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    branch: z.string(),
    branchId: z.string().nullable(),
    isCrossBranch: z.boolean(),
    permissions: z.array(z.string()),
  }),
})

export function parseSessionResponse(payload: unknown) {
  const result = sessionSchema.safeParse(payload)
  if (!result.success) throw invalidApiResponse()
  return result.data
}
