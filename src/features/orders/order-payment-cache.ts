import type { QueryClient } from '@tanstack/react-query'

/** Orders and Payments display projections of the same receipts, refunds and balances. */
export async function invalidateOrderPaymentQueries(client: QueryClient, orderId?: string) {
  await Promise.all(
    [
      ['module', 'orders'],
      ['module', 'payments'],
      orderId ? ['order-detail', orderId] : ['order-detail'],
      orderId ? ['customer-payment-detail', orderId] : ['customer-payment-detail'],
      ['payment-options'],
      ['dashboard-summary'],
      ['report'],
    ].map((queryKey) => client.invalidateQueries({ queryKey })),
  )
}
