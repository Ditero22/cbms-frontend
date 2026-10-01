const movementLabels: Record<string, string> = {
  Adjustment: 'Adjustment',
  Correction: 'Stock correction',
  RESERVATION_CREATED: 'Stock reserved',
  RESERVATION_RELEASED: 'Reservation released',
  DELIVERY_OUT: 'Delivery',
  TRANSFER_IN: 'Transfer received',
  TRANSFER_OUT: 'Transfer sent',
  RETURN_IN: 'Return received',
  ORDER_CANCELLATION_RESTOCK: 'Cancellation restock',
}

export function stockMovementLabel(transactionType: string): string {
  return movementLabels[transactionType] ?? transactionType
}
