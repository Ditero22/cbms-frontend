export type AuthenticatedUser = {
  id: string
  name: string
  email: string
  role: string
  branch: string
  branchId: string | null
  isCrossBranch: boolean
  permissions: string[]
}

export type SessionResponse = { user: AuthenticatedUser }
