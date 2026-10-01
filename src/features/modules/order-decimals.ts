export function toMinorUnits(value: string, decimalPlaces: 2 | 3): bigint {
  const normalized = value.trim()
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized)
  if (!match || (match[2]?.length ?? 0) > decimalPlaces) {
    throw new Error(`Expected a non-negative number with at most ${decimalPlaces} decimal places.`)
  }

  const factor = 10n ** BigInt(decimalPlaces)
  const fraction = (match[2] ?? '').padEnd(decimalPlaces, '0')
  return BigInt(match[1]!) * factor + BigInt(fraction)
}

export function fromMinorUnits(value: bigint, decimalPlaces: 2 | 3): string {
  const factor = 10n ** BigInt(decimalPlaces)
  const absolute = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${absolute / factor}.${String(absolute % factor).padStart(decimalPlaces, '0')}`
}

export function isPositiveDecimal(value: string, decimalPlaces: 2 | 3): boolean {
  try {
    return toMinorUnits(value, decimalPlaces) > 0n
  } catch {
    return false
  }
}

export function remainingRefundCents(
  paymentAmount: string,
  refunds: { amount: string; status: string }[],
): bigint {
  const committed = refunds.reduce(
    (total, refund) =>
      ['Processed', 'Requested', 'Approved'].includes(refund.status)
        ? total + toMinorUnits(refund.amount, 2)
        : total,
    0n,
  )
  const remaining = toMinorUnits(paymentAmount, 2) - committed
  return remaining > 0n ? remaining : 0n
}

export function remainingReturnMilli(
  deliveredQuantity: string,
  returns: { quantity: string; status: string }[],
): bigint {
  const committed = returns.reduce(
    (total, returned) =>
      returned.status === 'Rejected' ? total : total + toMinorUnits(returned.quantity, 3),
    0n,
  )
  const remaining = toMinorUnits(deliveredQuantity, 3) - committed
  return remaining > 0n ? remaining : 0n
}

export function nonRestockedRemainder(quantity: string, acceptedQuantity: string): bigint {
  // Incomplete number inputs are expected while editing; browser validation
  // and the receive endpoint still validate the final submitted quantities.
  try {
    const remainder = toMinorUnits(quantity, 3) - toMinorUnits(acceptedQuantity, 3)
    return remainder > 0n ? remainder : 0n
  } catch {
    return 0n
  }
}

export function formatPeso(value: string): string {
  const negative = value.trim().startsWith('-')
  const cents = toMinorUnits(negative ? value.trim().slice(1) : value, 2)
  const whole = new Intl.NumberFormat('en-PH').format(cents / 100n)
  return `${negative ? '-' : ''}₱${whole}.${String(cents % 100n).padStart(2, '0')}`
}

export function formatQuantity(value: string): string {
  const negative = value.trim().startsWith('-')
  const milli = toMinorUnits(negative ? value.trim().slice(1) : value, 3)
  const whole = new Intl.NumberFormat('en-PH').format(milli / 1000n)
  const fraction = String(milli % 1000n)
    .padStart(3, '0')
    .replace(/0+$/, '')
  const formatted = fraction ? `${whole}.${fraction}` : whole
  return negative && milli > 0n ? `-${formatted}` : formatted
}

/** Match the API: round each unit-price times quantity line to cents, then sum. */
export function estimateOrderTotal(
  items: { productId: string; quantity: string }[],
  products: { id: string; unitPrice?: string | number }[],
): string {
  const total = items.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.productId)
    if (!product) return sum
    try {
      const line = toMinorUnits(String(product.unitPrice ?? 0), 2) * toMinorUnits(item.quantity, 3)
      return sum + (line + 500n) / 1000n
    } catch {
      // Incomplete numeric text is expected while editing; submission still validates it.
      return sum
    }
  }, 0n)
  return fromMinorUnits(total, 2)
}
