import { z } from 'zod'

const count = z.number().int().nonnegative()

export const dashboardSummarySchema = z.object({
  operations: z
    .object({
      fleet: z
        .object({ available: count, onService: count, underMaintenance: count, unavailable: count })
        .nullable(),
      maintenanceMonthlyCost: z.string().nullable(),
      pendingAllowances: z.object({ count, amount: z.string(), awaitingReceipt: count }).nullable(),
      customerBalances: z
        .object({ outstandingBalance: z.string(), outstandingOrders: count })
        .nullable(),
    })
    .optional(),
  stats: z.object({
    salesTotal: z.string(),
    openOrders: count,
    stockAlerts: count,
    activeEmployees: count,
  }),
  branchSales: z.array(z.object({ name: z.string(), total: z.string() })),
  recentOrders: z.array(z.record(z.string(), z.string())),
  priorityTasks: z.array(
    z.object({
      type: z.enum(['inventory', 'expense']),
      title: z.string(),
      text: z.string(),
      meta: z.string(),
    }),
  ),
})

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
